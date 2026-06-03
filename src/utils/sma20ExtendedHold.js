import { normalizeStockCode } from '@/utils/extractStockCodes'

/** 收盤低於 SMA20 連續幾日即觸發出場條件 */
const CONSECUTIVE_BELOW = 5
/** 均線週期 */
const SMA_PERIOD = 20
/** 原始策略固定持有天數（CSV 內 60 天出場） */
const BASE_HOLD_DAYS = 60

/**
 * 寬鬆解析日期字串（支援 / 或 - 分隔）
 * @returns {Date|null}
 */
export function parseDateLoose(s) {
  if (s == null || String(s).trim() === '') return null
  const str = String(s).trim().replace(/\//g, '-')
  const d = new Date(str)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * 將 Date 轉成 YYYY-MM-DD 字串
 * @param {Date} d
 * @returns {string}
 */
export function toDateKey(d) {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 將 CSV 報酬率欄位轉成小數（0.12 或 12% → 0.12）
 * @param {string|number} raw
 * @returns {number|null}
 */
function parseReturnDecimal(raw) {
  const n = Number(String(raw).replace(/%/g, '').trim())
  if (Number.isNaN(n)) return null
  if (Math.abs(n) > 1) return n / 100
  return n
}

/**
 * 統計區間內交易日筆數
 * @param {object[]} sortedPrices 已排序日線
 * @param {string} startDate 區間起日
 * @param {string} endDate 區間迄日
 * @param {boolean} afterStart true 表示不含起始日（用於 60 天出場後的延伸區間）
 * @returns {number|null}
 */
function countTradingDaysBetween(sortedPrices, startDate, endDate, afterStart = false) {
  const start = parseDateLoose(startDate)
  const end = parseDateLoose(endDate)
  if (!start || !end) return null
  return sortedPrices.filter((p) => {
    const d = parseDateLoose(p.trade_date)
    if (!d) return false
    if (afterStart) return d > start && d <= end
    return d >= start && d <= end
  }).length
}

/**
 * 計算 sorted 陣列第 idx 日的 20 日收盤均線
 * @param {object[]} sorted 日線陣列
 * @param {number} idx 索引（須 >= 19）
 * @returns {number}
 */
function sma20AtIndex(sorted, idx) {
  let sum = 0
  for (let i = idx - SMA_PERIOD + 1; i <= idx; i++) {
    sum += Number(sorted[i].close_price)
  }
  return sum / SMA_PERIOD
}

/**
 * 為整檔股票預先算好每日 SMA20（同一標的只需算一次，供快取使用）
 * @param {object[]} sortedPrices DB 原始日線
 * @returns {{ trade_date, open_price, close_price, sma20 }[]}
 */
export function buildPricesWithSma20(sortedPrices) {
  return sortedPrices.map((p, i) => ({
    trade_date: p.trade_date,
    open_price: p.open_price,
    close_price: p.close_price,
    sma20: i >= SMA_PERIOD - 1 ? sma20AtIndex(sortedPrices, i) : null,
  }))
}

/**
 * 取得第 idx 日的 SMA20（優先用預先算好的 sma20 欄位）
 * @param {object[]} sorted 含 sma20 的日線
 * @param {number} idx
 * @returns {number}
 */
function getSmaAtRow(sorted, idx) {
  const row = sorted[idx]
  if (row?.sma20 != null && !Number.isNaN(row.sma20)) return row.sma20
  return sma20AtIndex(sorted, idx)
}

/**
 * 模擬 60 天出場後繼續持有：收盤 < SMA20 連續 5 日 → 次日開盤賣出
 * @param {object} params
 * @param {string} params.buyDay 進場日
 * @param {string|number} params.buyPrice 進場價
 * @param {string} params.sellDay 原策略 60 天出場日
 * @param {object[]} params.sortedPrices 含 SMA20 的歷史日線
 * @returns 成功時含 sma20Return、totalHoldDays、exitSma20 等；失敗時 ok: false
 */
export function computeSma20ExtendedExit({
  buyDay,
  buyPrice,
  sellDay,
  sortedPrices,
}) {
  const buy = parseDateLoose(buyDay)
  const sell = parseDateLoose(sellDay)
  if (!buy || !sell || !sortedPrices?.length) {
    return { ok: false, reason: '日期或股價資料不足' }
  }

  const buyPx = Number(buyPrice)
  if (!buyPx || Number.isNaN(buyPx)) {
    return { ok: false, reason: '進場價格無效' }
  }

  let startIdx = -1
  for (let i = 0; i < sortedPrices.length; i++) {
    const d = parseDateLoose(sortedPrices[i].trade_date)
    if (d && d > sell) {
      startIdx = i
      break
    }
  }

  if (startIdx === -1) {
    return { ok: false, reason: '60 天後無後續股價' }
  }

  const firstCheck = Math.max(startIdx, SMA_PERIOD - 1)
  let consecutive = 0

  for (let i = firstCheck; i < sortedPrices.length; i++) {
    const close = Number(sortedPrices[i].close_price)
    const sma = getSmaAtRow(sortedPrices, i)
    if (Number.isNaN(close) || Number.isNaN(sma)) continue

    if (close < sma) {
      consecutive += 1
      if (consecutive >= CONSECUTIVE_BELOW) {
        const exitIdx = i + 1
        const exitOpen =
          exitIdx < sortedPrices.length
            ? Number(sortedPrices[exitIdx].open_price)
            : Number(sortedPrices[i].close_price)
        const exitDay =
          exitIdx < sortedPrices.length
            ? sortedPrices[exitIdx].trade_date
            : sortedPrices[i].trade_date

        if (Number.isNaN(exitOpen)) {
          return { ok: false, reason: '出場價無效' }
        }

        const days60 =
          countTradingDaysBetween(sortedPrices, buyDay, sellDay, false) ??
          BASE_HOLD_DAYS
        const extraDays =
          countTradingDaysBetween(sortedPrices, sellDay, exitDay, true) ?? 0

        return {
          ok: true,
          extended: true,
          exitDay,
          exitPrice: exitOpen,
          exitSma20: sma,
          sma20Return: (exitOpen - buyPx) / buyPx,
          totalHoldDays: days60 + extraDays,
          extraHoldDays: extraDays,
        }
      }
    } else {
      consecutive = 0
    }
  }

  const last = sortedPrices[sortedPrices.length - 1]
  const exitOpen = Number(last.close_price)
  const days60 =
    countTradingDaysBetween(sortedPrices, buyDay, sellDay, false) ?? BASE_HOLD_DAYS
  const extraDays =
    countTradingDaysBetween(sortedPrices, sellDay, last.trade_date, true) ?? 0

  return {
    ok: true,
    extended: true,
    exitDay: last.trade_date,
    exitPrice: exitOpen,
    exitSma20: getSmaAtRow(sortedPrices, sortedPrices.length - 1),
    sma20Return: (exitOpen - buyPx) / buyPx,
    totalHoldDays: days60 + extraDays,
    extraHoldDays: extraDays,
    reason: '資料結束前未觸發 SMA 出場，以最後收盤價出場',
  }
}

/**
 * 將 CSV 一列轉成統一的交易物件（對應 XQ 匯出欄位名稱）
 * @param {object} raw Papa.parse 單列資料
 * @returns 標準化後的 trade 物件
 */
export function normalizeTradeRow(raw) {
  /** 依欄位名稱取值（容忍前後空白） */
  const get = (key) => {
    if (raw[key] != null && String(raw[key]).trim() !== '') return String(raw[key]).trim()
    const k = Object.keys(raw).find((x) => x.trim() === key)
    return k ? String(raw[k]).trim() : ''
  }

  const code = normalizeStockCode(get('商品代碼') || get('代碼'))
  const ret = parseReturnDecimal(get('報酬率'))

  return {
    raw,
    name: get('商品名稱') || get('商品'),
    code,
    buyDay: get('進場時間'),
    buyPrice: get('進場價格'),
    sellDay: get('出場時間'),
    sellPrice: get('出場價格'),
    returnDecimal: ret,
    returnRaw: get('報酬率'),
  }
}

/**
 * 組出下載用 CSV 列：延伸持有者將「報酬率」改為 SMA20 報酬
 * @param {object} raw 原始 CSV 列
 * @param {{ useSma20Return: boolean, sma20Return?: number }} processed
 * @returns {object}
 */
export function buildExportRow(raw, processed) {
  const row = { ...raw }
  const retKey =
    Object.keys(raw).find((k) => k.trim() === '報酬率') ?? '報酬率'

  if (processed.useSma20Return && processed.sma20Return != null) {
    row[retKey] = processed.sma20Return
  }
  return row
}

/**
 * 統計延伸持有績效：勝過 60 天出場的比例與平均差距
 * @param {object[]} processedRows 已處理的交易列（含 extended、sma20Return、returnDecimal）
 * @returns {{ extendedCount, beat60Pct, avgBeat60Pct }}
 */
export function computeAnalysis(processedRows) {
  const extended = processedRows.filter((r) => r.extended && r.sma20Return != null)
  if (!extended.length) {
    return {
      extendedCount: 0,
      beat60Pct: 0,
      avgBeat60Pct: 0,
    }
  }

  let beat = 0
  let beatSum = 0
  for (const r of extended) {
    const orig = r.returnDecimal ?? 0
    const sma = r.sma20Return ?? 0
    if (sma > orig) beat += 1
    beatSum += (sma - orig) * 100
  }

  return {
    extendedCount: extended.length,
    beat60Pct: (beat / extended.length) * 100,
    avgBeat60Pct: beatSum / extended.length,
  }
}

export { BASE_HOLD_DAYS, parseReturnDecimal }
