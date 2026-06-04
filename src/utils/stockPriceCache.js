import { buildPricesWithSma20 } from '@/utils/sma20ExtendedHold'

/**
 * 依 stock_id + 均線週期 快取「歷史股價 + SMA」
 * 同一標的、同一週期只查 DB、只算 SMA 一次
 */
export class StockPriceCache {
  constructor() {
    this.enrichedByStock = new Map()
    this.pending = new Map()
    this.loadErrors = new Map()
    this.dbQueries = 0
    this.cacheHits = 0
    /** 資料庫查詢成功但無任何日線筆數 */
    this.dbNoPriceData = 0
  }

  cacheKey(stockId, smaPeriod) {
    return `${String(stockId).trim()}:${smaPeriod}`
  }

  clear() {
    this.enrichedByStock.clear()
    this.pending.clear()
    this.loadErrors.clear()
    this.dbQueries = 0
    this.cacheHits = 0
    this.dbNoPriceData = 0
  }

  getLoadError(stockId, smaPeriod) {
    return this.loadErrors.get(this.cacheKey(stockId, smaPeriod)) ?? null
  }

  getEnriched(stockId, smaPeriod) {
    return this.enrichedByStock.get(this.cacheKey(stockId, smaPeriod)) ?? []
  }

  getStats() {
    return {
      dbQueries: this.dbQueries,
      cacheHits: this.cacheHits,
      cachedStocks: this.enrichedByStock.size,
      dbNoPriceData: this.dbNoPriceData,
    }
  }

  /**
   * @param {string} stockId
   * @param {{ smaPeriod?: number }} [options]
   */
  async getEnrichedPrices(stockId, options = {}) {
    const id = String(stockId).trim()
    const smaPeriod = Number(options.smaPeriod) || 20
    if (!id) return []

    const key = this.cacheKey(id, smaPeriod)

    if (this.enrichedByStock.has(key)) {
      this.cacheHits += 1
      return this.enrichedByStock.get(key)
    }

    if (this.pending.has(key)) {
      this.cacheHits += 1
      return this.pending.get(key)
    }

    const promise = this._loadAndEnrich(id, smaPeriod)
    this.pending.set(key, promise)
    return promise
  }

  /** 綁定 fetch 函式後批次預載多檔股票 */
  bindFetcher(fetchRaw) {
    this.fetchRaw = fetchRaw
  }

  async preloadStockIds(stockIds, options = {}) {
    const unique = [...new Set(stockIds.filter(Boolean))]
    for (const id of unique) {
      await this.getEnrichedPrices(id, options)
    }
    return unique.length
  }

  async _loadAndEnrich(stockId, smaPeriod) {
    const key = this.cacheKey(stockId, smaPeriod)
    try {
      if (!this.fetchRaw) {
        throw new Error('StockPriceCache 未設定 fetchRaw')
      }
      this.dbQueries += 1
      const raw = await this.fetchRaw(stockId)
      if (!raw?.length) {
        this.dbNoPriceData += 1
        this.enrichedByStock.set(key, [])
        this.loadErrors.set(key, '資料庫無股價資料')
        return []
      }
      const enriched = buildPricesWithSma20(raw, { smaPeriod })
      this.enrichedByStock.set(key, enriched)
      return enriched
    } catch (err) {
      this.enrichedByStock.set(key, [])
      this.loadErrors.set(key, err.message || '載入失敗')
      return []
    } finally {
      this.pending.delete(key)
    }
  }
}

/** 讓出主執行緒，避免大量迴圈時 UI 卡住 */
export function yieldToUi() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
