import { fetchStockDailyPrices } from '@/utils/stockPriceChart'
import { runWithConcurrency } from '@/utils/runWithConcurrency'
import { isMomentumEligibleStock } from '@/utils/momentumStockFilter'

const CALENDAR_PROXY = '2330'
const TABLE = 'stock_daily_prices_adj'

/** 空／缺 industry 時的選項標籤 */
export const UNCLASSIFIED_INDUSTRY = '(未分類)'

/** 統一為 YYYY-MM-DD（Supabase 可能回傳含時間的字串） */
export function normalizeTradeDateKey(raw) {
  if (raw == null || String(raw).trim() === '') return ''
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

/** 原始 industry 字串；空白視為未分類 */
export function normalizeIndustryKey(raw) {
  const s = String(raw ?? '').trim()
  return s || UNCLASSIFIED_INDUSTRY
}

/**
 * @typedef {Object} PriceBar
 * @property {number|null} open
 * @property {number|null} high
 * @property {number|null} low
 * @property {number} close
 * @property {number} volume
 * @property {number} amount
 */

/**
 * @typedef {Object} StockSeries
 * @property {string} stockId
 * @property {string} stockName
 * @property {Map<string, PriceBar>} barsByDate
 */

/** 取得區間交易日曆（以 2330 為基準） */
export async function fetchTradingCalendar(supabase, startDate, endDate) {
  const rows = await fetchStockDailyPrices(supabase, {
    stockId: CALENDAR_PROXY,
    startDate,
    endDate,
    priceType: 'adj',
  })
  return [...new Set(rows.map((r) => normalizeTradeDateKey(r.trade_date)).filter(Boolean))].sort()
}

/** 分頁抓取單一交易日全部標的（用於建立選股池） */
export async function fetchStocksOnDate(supabase, tradeDate) {
  const allRows = []
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('stock_id, stock_name, market, industry, open_price, close_price, volume, amount')
      .eq('trade_date', tradeDate)
      .order('stock_id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error
    const batch = data ?? []
    allRows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  return allRows
}

/**
 * 從列集合收集不重複產業（未分類永遠排第一）
 * @returns {string[]}
 */
export function collectIndustryOptions(rows) {
  const set = new Set()
  for (const row of rows ?? []) {
    const raw = String(row?.industry ?? '').trim()
    if (raw) set.add(raw)
  }
  const rest = [...set].sort((a, b) => a.localeCompare(b, 'zh-Hant'))
  return [UNCLASSIFIED_INDUSTRY, ...rest]
}

/**
 * 載入產業選項：合併數個交易日快照的 industry（避免全表 DISTINCT）
 * @param {string[]} tradeDates
 */
export async function fetchIndustryOptions(supabase, tradeDates = []) {
  const dates = [...new Set((tradeDates ?? []).map(normalizeTradeDateKey).filter(Boolean))]
  const set = new Set([UNCLASSIFIED_INDUSTRY])
  for (const d of dates) {
    const rows = await fetchStocksOnDate(supabase, d)
    for (const row of rows) {
      const raw = String(row?.industry ?? '').trim()
      if (raw) set.add(raw)
    }
  }
  const rest = [...set].filter((x) => x !== UNCLASSIFIED_INDUSTRY)
  rest.sort((a, b) => a.localeCompare(b, 'zh-Hant'))
  return [UNCLASSIFIED_INDUSTRY, ...rest]
}

/**
 * 從某日行情建立選股池代碼清單
 * @param {object[]} rows
 * @param {{ allowedIndustries?: Set<string>|null }} [options]
 *   allowedIndustries: null/undefined=不限；Set=只保留這些（含 '(未分類)'）
 * @returns {Map<string, string>} stockId -> stockName
 */
export function buildEligibleUniverse(rows, options = {}) {
  const allow = options.allowedIndustries
  const map = new Map()
  for (const row of rows) {
    const id = String(row.stock_id ?? '').trim()
    const name = String(row.stock_name ?? '').trim()
    if (!isMomentumEligibleStock(id, name)) continue
    if (allow instanceof Set) {
      const ind = normalizeIndustryKey(row.industry)
      if (!allow.has(ind)) continue
    }
    if (!map.has(id)) map.set(id, name)
  }
  return map
}

function toBar(row) {
  const open = Number(row.open_price)
  const high = Number(row.high_price)
  const low = Number(row.low_price)
  const close = Number(row.close_price)
  const volume = Number(row.volume)
  const amount = Number(row.amount)
  if (!Number.isFinite(close) || close <= 0) return null
  return {
    open: Number.isFinite(open) && open > 0 ? open : null,
    high: Number.isFinite(high) && high > 0 ? high : null,
    low: Number.isFinite(low) && low > 0 ? low : null,
    close,
    volume: Number.isFinite(volume) ? volume : 0,
    amount: Number.isFinite(amount) ? amount : 0,
  }
}

/** 將日線列轉成 StockSeries */
export function buildStockSeries(stockId, stockName, rows) {
  const barsByDate = new Map()
  for (const row of rows) {
    const bar = toBar(row)
    if (!bar) continue
    const dateKey = normalizeTradeDateKey(row.trade_date)
    if (!dateKey) continue
    barsByDate.set(dateKey, bar)
  }
  return { stockId, stockName: stockName || stockId, barsByDate }
}

/**
 * 併發載入多檔股票日線
 * @param {Map<string, string>} universe stockId -> name
 * @param {{ concurrency?: number, onProgress?: (done: number, total: number) => void }} [options]
 * @returns {Promise<Map<string, StockSeries>>}
 */
export async function loadStockHistories(
  supabase,
  universe,
  startDate,
  endDate,
  options = {}
) {
  const { concurrency = 10, onProgress } = options
  const entries = [...universe.entries()]
  const result = new Map()

  await runWithConcurrency(entries, concurrency, async ([stockId, stockName]) => {
    const rows = await fetchStockDailyPrices(supabase, {
      stockId,
      startDate,
      endDate,
      priceType: 'adj',
    })
    if (rows.length) {
      result.set(stockId, buildStockSeries(stockId, stockName, rows))
    }
  }, {
    onTaskComplete: (done, total) => onProgress?.(done, total),
  })

  return result
}

/** 在交易日曆上找 date 的索引，找不到回 -1 */
export function indexOfDate(calendar, date) {
  const key = normalizeTradeDateKey(date)
  return calendar.indexOf(key)
}

/** 往前取第 n 個交易日（含當日為 n=0） */
export function calendarAtOffset(calendar, idx, offset) {
  const target = idx + offset
  if (target < 0 || target >= calendar.length) return null
  return calendar[target]
}

/**
 * 合併多個選股池快照（取聯集）
 * @param {Map<string, string>[]} universes
 */
export function mergeUniverses(universes) {
  const merged = new Map()
  for (const u of universes) {
    u.forEach((name, id) => {
      if (!merged.has(id)) merged.set(id, name)
    })
  }
  return merged
}
