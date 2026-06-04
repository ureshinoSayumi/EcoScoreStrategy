import { normalizeStockCode } from '@/utils/extractStockCodes'

/** 策略參數預設值 */
export const DEFAULT_SMA20_PARAMS = {
  /** 原始策略固定持有天數（CSV 內基礎出場天數） */
  baseHoldDays: 60,
  /** 均線週期 */
  smaPeriod: 20,
  /** 收盤低於均線連續幾日即觸發出場 */
  consecutiveBelow: 5,
  /** 基礎出場日收盤須高於 SMA 此百分比才進入延伸（0 = 僅需高於均線） */
  smaEntryPremiumPct: 10,
}

/** 正規化並限制策略參數範圍 */
export function normalizeSma20Params(input = {}) {
  return {
    baseHoldDays: Math.max(
      1,
      Math.floor(Number(input.baseHoldDays) || DEFAULT_SMA20_PARAMS.baseHoldDays)
    ),
    smaPeriod: Math.max(
      2,
      Math.floor(Number(input.smaPeriod) || DEFAULT_SMA20_PARAMS.smaPeriod)
    ),
    consecutiveBelow: Math.max(
      1,
      Math.floor(Number(input.consecutiveBelow) || DEFAULT_SMA20_PARAMS.consecutiveBelow)
    ),
    smaEntryPremiumPct: Math.max(
      0,
      Number.isFinite(Number(input.smaEntryPremiumPct))
        ? Number(input.smaEntryPremiumPct)
        : DEFAULT_SMA20_PARAMS.smaEntryPremiumPct
    ),
  }
}

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
 * 計算 sorted 陣列第 idx 日的收盤均線
 * @param {object[]} sorted 日線陣列
 * @param {number} idx 索引
 * @param {number} period 均線週期
 * @returns {number}
 */
function smaAtIndex(sorted, idx, period) {
  let sum = 0
  for (let i = idx - period + 1; i <= idx; i++) {
    sum += Number(sorted[i].close_price)
  }
  return sum / period
}

/**
 * 為整檔股票預先算好每日 SMA（同一標的只需算一次，供快取使用）
 * @param {object[]} sortedPrices DB 原始日線
 * @param {{ smaPeriod?: number }} [options]
 * @returns {{ trade_date, open_price, close_price, sma20 }[]}
 */
export function buildPricesWithSma20(sortedPrices, options = {}) {
  const { smaPeriod } = normalizeSma20Params(options)
  return sortedPrices.map((p, i) => ({
    trade_date: p.trade_date,
    open_price: p.open_price,
    close_price: p.close_price,
    sma20: i >= smaPeriod - 1 ? smaAtIndex(sortedPrices, i, smaPeriod) : null,
  }))
}

/**
 * 取得第 idx 日的 SMA（優先用預先算好的 sma20 欄位）
 * @param {object[]} sorted 含 sma20 的日線
 * @param {number} idx
 * @param {number} period
 * @returns {number}
 */
function getSmaAtRow(sorted, idx, period) {
  const row = sorted[idx]
  if (row?.sma20 != null && !Number.isNaN(row.sma20)) return row.sma20
  return smaAtIndex(sorted, idx, period)
}

/** 依 trade_date 找日線索引（日期字串 / / - 皆可） */
function findRowIndexByDate(sortedPrices, dateStr) {
  const target = parseDateLoose(dateStr)
  if (!target) return -1
  const targetTime = target.getTime()
  for (let i = 0; i < sortedPrices.length; i++) {
    const d = parseDateLoose(sortedPrices[i].trade_date)
    if (d && d.getTime() === targetTime) return i
  }
  return -1
}

/**
 * 基礎出場日是否滿足「收盤 > SMA × (1 + 溢價%)」才允許延伸
 */
function meetsSmaEntryCondition(sortedPrices, sellDay, period, premiumPct) {
  const sellIdx = findRowIndexByDate(sortedPrices, sellDay)
  if (sellIdx < period - 1) {
    return { ok: false, reason: '基礎出場日無足夠均線資料' }
  }

  const close = Number(sortedPrices[sellIdx].close_price)
  const sma = getSmaAtRow(sortedPrices, sellIdx, period)
  if (Number.isNaN(close) || Number.isNaN(sma) || sma <= 0) {
    return { ok: false, reason: '基礎出場日股價或均線無效' }
  }

  const minClose = sma * (1 + premiumPct / 100)
  if (close <= minClose) {
    const pctLabel = premiumPct > 0 ? `${premiumPct}%` : '均線'
    return {
      ok: false,
      skippedSmaEntry: true,
      reason: `出場日收盤未高於 SMA${period} ${pctLabel}（收 ${close.toFixed(2)} ≤ 門檻 ${minClose.toFixed(2)}）`,
    }
  }

  return { ok: true }
}

/**
 * 模擬「基礎天數出場後」依 SMA 延伸持有，直到觸發出場條件。
 *
 * 前提：CSV 已走完基礎持有（如 60 天）並在 sellDay 出場；本函式從 sellDay **下一個交易日**起
 * 繼續模擬持有，不再回頭改寫基礎段。
 *
 * 出場規則：收盤 < SMA 連續 consecutiveBelow 日 → **下一個交易日開盤價**賣出。
 * 若資料結束前從未觸發，改以最後一筆收盤價出場。
 *
 * @param {object} params
 * @param {string} params.buyDay 進場日（算總持有天數用）
 * @param {string|number} params.buyPrice 進場價（算 SMA 報酬用）
 * @param {string} params.sellDay CSV 原策略基礎出場日（延伸區間起點）
 * @param {object[]} params.sortedPrices 已排序、含 sma20 欄位的日線
 * @param {number} [params.baseHoldDays] 基礎持有天數（fallback）
 * @param {number} [params.smaPeriod] 均線週期
 * @param {number} [params.consecutiveBelow] 連續破線天數
 * @param {number} [params.smaEntryPremiumPct] 基礎出場日收盤須高於 SMA 的百分比門檻
 * @returns 成功 { ok:true, extended, exitDay, exitPrice, sma20Return, totalHoldDays, ... }
 *          失敗 { ok:false, reason, skippedSmaEntry? }
 */
export function computeSma20ExtendedExit({
  buyDay,
  buyPrice,
  sellDay,
  sortedPrices,
  baseHoldDays,
  smaPeriod,
  consecutiveBelow,
  smaEntryPremiumPct,
}) {
  const params = normalizeSma20Params({
    baseHoldDays,
    smaPeriod,
    consecutiveBelow,
    smaEntryPremiumPct,
  })
  const {
    baseHoldDays: baseDays,
    smaPeriod: period,
    consecutiveBelow: belowDays,
    smaEntryPremiumPct: entryPremiumPct,
  } = params

  // --- 基本欄位驗證 ---
  const buy = parseDateLoose(buyDay)
  const sell = parseDateLoose(sellDay)
  if (!buy || !sell || !sortedPrices?.length) {
    return { ok: false, reason: '日期或股價資料不足' }
  }

  const buyPx = Number(buyPrice)
  if (!buyPx || Number.isNaN(buyPx)) {
    return { ok: false, reason: '進場價格無效' }
  }

  // 基礎出場日須收盤 > SMA × (1 + 溢價%)，否則不進入延伸策略
  const entryCheck = meetsSmaEntryCondition(sortedPrices, sellDay, period, entryPremiumPct)
  if (!entryCheck.ok) {
    return entryCheck
  }

  // --- 定位延伸區間起點：sellDay 之後的第一個交易日 ---
  let startIdx = -1
  for (let i = 0; i < sortedPrices.length; i++) {
    const d = parseDateLoose(sortedPrices[i].trade_date)
    if (d && d > sell) {
      startIdx = i
      break
    }
  }

  if (startIdx === -1) {
    return { ok: false, reason: `${baseDays} 天後無後續股價` }
  }

  // SMA 需累積 period 根 K 線；延伸起點與 period-1 取較大者才開始判斷
  const firstCheck = Math.max(startIdx, period - 1)
  let consecutive = 0 // 連續收盤低於 SMA 的交易日數

  // --- 逐日掃描：收盤 < SMA 則累計，否則歸零 ---
  for (let i = firstCheck; i < sortedPrices.length; i++) {
    const close = Number(sortedPrices[i].close_price)
    const sma = getSmaAtRow(sortedPrices, i, period)
    if (Number.isNaN(close) || Number.isNaN(sma)) continue

    if (close < sma) {
      consecutive += 1
      // 連續破線達標 → 次日開盤出場（若無次日則用當日收盤）
      if (consecutive >= belowDays) {
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

        // 總持有 = 進場→sellDay（基礎段）+ sellDay→exitDay（延伸段，不含 sellDay 當日）
        const daysBase =
          countTradingDaysBetween(sortedPrices, buyDay, sellDay, false) ?? baseDays
        const extraDays =
          countTradingDaysBetween(sortedPrices, sellDay, exitDay, true) ?? 0

        return {
          ok: true,
          extended: true,
          exitDay,
          exitPrice: exitOpen,
          exitSma20: sma, // 觸發當日（第 N 次破線）的 SMA，非出場日
          sma20Return: (exitOpen - buyPx) / buyPx,
          totalHoldDays: daysBase + extraDays,
          extraHoldDays: extraDays,
        }
      }
    } else {
      consecutive = 0
    }
  }

  // --- 資料用盡仍未觸發出場：以最後收盤價強制平倉 ---
  const last = sortedPrices[sortedPrices.length - 1]
  const exitOpen = Number(last.close_price)
  const daysBase =
    countTradingDaysBetween(sortedPrices, buyDay, sellDay, false) ?? baseDays
  const extraDays =
    countTradingDaysBetween(sortedPrices, sellDay, last.trade_date, true) ?? 0

  return {
    ok: true,
    extended: true,
    exitDay: last.trade_date,
    exitPrice: exitOpen,
    exitSma20: getSmaAtRow(sortedPrices, sortedPrices.length - 1, period),
    sma20Return: (exitOpen - buyPx) / buyPx,
    totalHoldDays: daysBase + extraDays,
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
 * 依原始 CSV 日期格式輸出（/ 或 -）
 * @param {string} dateKey YYYY-MM-DD 或可被 parseDateLoose 解析的字串
 * @param {string} sampleOriginal 原始出場時間欄位，用來判斷分隔符
 */
function formatExportDate(dateKey, sampleOriginal) {
  const d = parseDateLoose(dateKey)
  if (!d) return dateKey
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const sep = sampleOriginal && String(sampleOriginal).includes('/') ? '/' : '-'
  return `${y}${sep}${m}${sep}${day}`
}

/** 依欄位名稱找 key（容忍前後空白） */
function findColumnKey(raw, name) {
  return Object.keys(raw).find((k) => k.trim() === name) ?? name
}

/**
 * 組出下載用 CSV 列：SMA20 延伸者更新報酬率、出場時間、持有區間
 * @param {object} raw 原始 CSV 列
 * @param {{
 *   useSma20Return: boolean,
 *   sma20Return?: number,
 *   exitDay?: string,
 *   totalHoldDays?: number,
 * }} processed
 * @returns {object}
 */
export function buildExportRow(raw, processed) {
  const row = { ...raw }
  const retKey = findColumnKey(raw, '報酬率')

  if (processed.useSma20Return && processed.sma20Return != null) {
    row[retKey] = processed.sma20Return

    if (processed.exitDay) {
      const sellKey = findColumnKey(raw, '出場時間')
      row[sellKey] = formatExportDate(processed.exitDay, raw[sellKey])
    }

    if (processed.totalHoldDays != null) {
      const daysKey = findColumnKey(raw, '持有區間')
      row[daysKey] = processed.totalHoldDays
    }
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

export { parseReturnDecimal }
