import { buildPricesWithSma20 } from '@/utils/sma20ExtendedHold'

/**
 * 依 stock_id 快取「歷史股價 + SMA20」
 * 同一標的只查 DB、只算 SMA20 一次
 */
export class StockPriceCache {
  constructor() {
    this.enrichedByStock = new Map()
    this.pending = new Map()
    this.loadErrors = new Map()
    this.dbQueries = 0
    this.cacheHits = 0
  }

  clear() {
    this.enrichedByStock.clear()
    this.pending.clear()
    this.loadErrors.clear()
    this.dbQueries = 0
    this.cacheHits = 0
  }

  getLoadError(stockId) {
    return this.loadErrors.get(String(stockId).trim()) ?? null
  }

  getStats() {
    return {
      dbQueries: this.dbQueries,
      cacheHits: this.cacheHits,
      cachedStocks: this.enrichedByStock.size,
    }
  }

  /**
   * @param {string} stockId
   * @param {(id: string) => Promise<object[]>} fetchRaw 從 DB 取原始日線
   */
  async getEnrichedPrices(stockId) {
    const id = String(stockId).trim()
    if (!id) return []

    if (this.enrichedByStock.has(id)) {
      this.cacheHits += 1
      return this.enrichedByStock.get(id)
    }

    if (this.pending.has(id)) {
      this.cacheHits += 1
      return this.pending.get(id)
    }

    const promise = this._loadAndEnrich(id)
    this.pending.set(id, promise)
    return promise
  }

  /** 綁定 fetch 函式後批次預載多檔股票 */
  bindFetcher(fetchRaw) {
    this.fetchRaw = fetchRaw
  }

  async preloadStockIds(stockIds) {
    const unique = [...new Set(stockIds.filter(Boolean))]
    for (const id of unique) {
      await this.getEnrichedPrices(id)
    }
    return unique.length
  }

  async _loadAndEnrich(stockId) {
    try {
      if (!this.fetchRaw) {
        throw new Error('StockPriceCache 未設定 fetchRaw')
      }
      this.dbQueries += 1
      const raw = await this.fetchRaw(stockId)
      const enriched = buildPricesWithSma20(raw ?? [])
      this.enrichedByStock.set(stockId, enriched)
      return enriched
    } catch (err) {
      this.enrichedByStock.set(stockId, [])
      this.loadErrors.set(stockId, err.message || '載入失敗')
      return []
    } finally {
      this.pending.delete(stockId)
    }
  }
}

/** 讓出主執行緒，避免大量迴圈時 UI 卡住 */
export function yieldToUi() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
