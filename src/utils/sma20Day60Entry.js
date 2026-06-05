import { normalizeStockCode } from '@/utils/extractStockCodes'
import {
  parseDateLoose,
  toDateKey,
  normalizeSma20Params,
  resolveBuyPrice,
  DEFAULT_SMA20_PARAMS,
} from '@/utils/sma20ExtendedHold'

/** 依 trade_date 找日線索引 */
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

/** 出場價：當日開盤；異常偏離則改收盤 */
function resolveExitPrice(sortedPrices, exitIdx, fallbackIdx) {
  const row = sortedPrices[exitIdx]
  const open = Number(row?.open_price)
  const close = Number(row?.close_price)
  if (Number.isFinite(open) && open > 0) {
    if (Number.isFinite(close) && close > 0) {
      const ratio = open / close
      if (ratio > 3 || ratio < 1 / 3) return close
    }
    return open
  }
  if (Number.isFinite(close) && close > 0) return close
  const fb = Number(sortedPrices[fallbackIdx]?.close_price)
  return Number.isFinite(fb) && fb > 0 ? fb : NaN
}

function getSmaAtRow(sorted, idx, period) {
  const row = sorted[idx]
  if (row?.sma20 != null && !Number.isNaN(row.sma20)) return row.sma20
  let sum = 0
  for (let i = idx - period + 1; i <= idx; i++) {
    sum += Number(sorted[i].close_price)
  }
  return sum / period
}

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
 * 解析 CSV 進場紀錄（僅需代碼與進場時間）
 */
export function normalizeEntryRow(raw) {
  const get = (key) => {
    if (raw[key] != null && String(raw[key]).trim() !== '') return String(raw[key]).trim()
    const k = Object.keys(raw).find((x) => x.trim() === key)
    return k ? String(raw[k]).trim() : ''
  }

  return {
    raw,
    name: get('商品名稱') || get('商品'),
    code: normalizeStockCode(get('商品代碼') || get('代碼')),
    buyDay: get('進場時間'),
  }
}

/**
 * 訊號日後依 SMA 連續破線出場（進場為訊號日下一交易日開盤）
 */
export function computeSmaExitAfterSignal({
  sortedPrices,
  signalDay,
  smaPeriod,
  consecutiveBelow,
}) {
  const params = normalizeSma20Params({ smaPeriod, consecutiveBelow })
  const { smaPeriod: period, consecutiveBelow: belowDays } = params

  const signalIdx = findRowIndexByDate(sortedPrices, signalDay)
  if (signalIdx < 0) return { ok: false, reason: '訊號日無股價' }

  const entryIdx = signalIdx + 1
  if (entryIdx >= sortedPrices.length) {
    return { ok: false, reason: '訊號日後無交易日可進場' }
  }

  const entryDay = sortedPrices[entryIdx].trade_date
  const entryPrice = resolveExitPrice(sortedPrices, entryIdx, signalIdx)
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return { ok: false, reason: '模擬進場價無效' }
  }

  const firstCheck = Math.max(entryIdx, period - 1)
  let consecutive = 0

  for (let i = firstCheck; i < sortedPrices.length; i++) {
    const close = Number(sortedPrices[i].close_price)
    const sma = getSmaAtRow(sortedPrices, i, period)
    if (Number.isNaN(close) || Number.isNaN(sma)) continue

    if (close < sma) {
      consecutive += 1
      if (consecutive >= belowDays) {
        const exitIdx = i + 1
        const exitPrice = resolveExitPrice(
          sortedPrices,
          exitIdx < sortedPrices.length ? exitIdx : i,
          i
        )
        const exitDay =
          exitIdx < sortedPrices.length
            ? sortedPrices[exitIdx].trade_date
            : sortedPrices[i].trade_date

        if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
          return { ok: false, reason: '出場價無效' }
        }

        const holdDays = countTradingDaysBetween(sortedPrices, entryDay, exitDay, false) ?? 0
        return {
          ok: true,
          entryDay,
          entryPrice,
          exitDay,
          exitPrice,
          holdDays,
          returnDecimal: (exitPrice - entryPrice) / entryPrice,
          forcedExit: false,
        }
      }
    } else {
      consecutive = 0
    }
  }

  const last = sortedPrices[sortedPrices.length - 1]
  const exitPrice = resolveExitPrice(sortedPrices, sortedPrices.length - 1, sortedPrices.length - 1)
  if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
    return { ok: false, reason: '出場價無效' }
  }

  const holdDays = countTradingDaysBetween(sortedPrices, entryDay, last.trade_date, false) ?? 0
  return {
    ok: true,
    entryDay,
    entryPrice,
    exitDay: last.trade_date,
    exitPrice,
    holdDays,
    returnDecimal: (exitPrice - entryPrice) / entryPrice,
    forcedExit: true,
    reason: '資料結束前未觸發 SMA 出場，以最後價格出場',
  }
}

/**
 * 評估單筆：進場後第 N 個交易日是否正報酬且站上 SMA 門檻，通過則計算 SMA 出場
 */
export function evaluateDay60EntrySignal({
  sortedPrices,
  buyDay,
  baseHoldDays = DEFAULT_SMA20_PARAMS.baseHoldDays,
  smaPeriod = DEFAULT_SMA20_PARAMS.smaPeriod,
  smaEntryPremiumPct = DEFAULT_SMA20_PARAMS.smaEntryPremiumPct,
  consecutiveBelow = DEFAULT_SMA20_PARAMS.consecutiveBelow,
}) {
  const params = normalizeSma20Params({
    baseHoldDays,
    smaPeriod,
    smaEntryPremiumPct,
    consecutiveBelow,
  })

  if (!buyDay || !sortedPrices?.length) {
    return { ok: false, reason: '日期或股價資料不足' }
  }

  const entryIdx = findRowIndexByDate(sortedPrices, buyDay)
  if (entryIdx < 0) {
    return { ok: false, reason: '進場日無股價' }
  }

  const signalIdx = entryIdx + params.baseHoldDays
  if (signalIdx >= sortedPrices.length) {
    return {
      ok: false,
      reason: `進場後不足 ${params.baseHoldDays} 個交易日`,
    }
  }

  const signalDay = sortedPrices[signalIdx].trade_date
  const buyPrice = resolveBuyPrice(sortedPrices, buyDay, null)
  const closeAtSignal = Number(sortedPrices[signalIdx].close_price)

  if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
    return { ok: false, reason: '進場價無效', signalDay }
  }
  if (!Number.isFinite(closeAtSignal) || closeAtSignal <= 0) {
    return { ok: false, reason: '訊號日收盤價無效', signalDay }
  }

  const return60 = (closeAtSignal - buyPrice) / buyPrice
  if (return60 <= 0) {
    return {
      ok: false,
      skippedNegative: true,
      reason: `${params.baseHoldDays} 日報酬非正（${(return60 * 100).toFixed(2)}%）`,
      signalDay,
      return60,
      buyPrice,
      closeAtSignal,
    }
  }

  if (signalIdx < params.smaPeriod - 1) {
    return { ok: false, reason: '訊號日無足夠均線資料', signalDay, return60 }
  }

  const sma = getSmaAtRow(sortedPrices, signalIdx, params.smaPeriod)
  const minClose = sma * (1 + params.smaEntryPremiumPct / 100)
  if (closeAtSignal <= minClose) {
    const pctLabel = params.smaEntryPremiumPct > 0 ? `${params.smaEntryPremiumPct}%` : '均線'
    return {
      ok: false,
      skippedSmaEntry: true,
      reason: `訊號日收盤未高於 SMA${params.smaPeriod} ${pctLabel}`,
      signalDay,
      return60,
      buyPrice,
      closeAtSignal,
      smaAtSignal: sma,
    }
  }

  const exit = computeSmaExitAfterSignal({
    sortedPrices,
    signalDay,
    smaPeriod: params.smaPeriod,
    consecutiveBelow: params.consecutiveBelow,
  })

  if (!exit.ok) {
    return { ...exit, signalDay, return60, buyPrice, closeAtSignal, smaAtSignal: sma }
  }

  return {
    ok: true,
    signalDay,
    return60,
    buyPrice,
    closeAtSignal,
    smaAtSignal: sma,
    simBuyDay: exit.entryDay,
    simSellDay: exit.exitDay,
    simBuyPrice: exit.entryPrice,
    simSellPrice: exit.exitPrice,
    simReturn: exit.returnDecimal,
    simHoldDays: exit.holdDays,
    forcedExit: exit.forcedExit,
    note: exit.reason || '',
  }
}

/**
 * 取得第 N 個交易日後的日期（以該股日線為準）
 */
export function tradingDayAfter(sortedPrices, startDate, offset) {
  const idx = findRowIndexByDate(sortedPrices, startDate)
  if (idx < 0) return null
  const target = idx + offset
  if (target >= sortedPrices.length) return null
  return sortedPrices[target].trade_date
}

/**
 * 建立模擬時間軸起點：第一筆進場 + baseHoldDays 個交易日（以該股日線為準）
 */
export function resolveSimulationStartDate(trades, pricesByCode, baseHoldDays) {
  const sorted = [...trades]
    .filter((t) => t.buyDay && t.code)
    .sort((a, b) => {
      const da = parseDateLoose(a.buyDay)?.getTime() ?? 0
      const db = parseDateLoose(b.buyDay)?.getTime() ?? 0
      return da - db
    })

  for (const t of sorted) {
    const prices = pricesByCode.get(t.code)
    if (!prices?.length) continue
    const start = tradingDayAfter(prices, t.buyDay, baseHoldDays)
    if (start) return start
  }
  return null
}

/**
 * 合併多檔股票交易日，建立模擬時間軸（僅交易日，非日曆日）
 */
export function buildTradingTimeline(pricesByCode, startDate) {
  const start = parseDateLoose(startDate)
  if (!start) return []

  const set = new Set()
  for (const prices of pricesByCode.values()) {
    for (const p of prices) {
      const d = parseDateLoose(p.trade_date)
      if (d && d >= start) {
        set.add(toDateKey(d))
      }
    }
  }
  return [...set].sort()
}

/**
 * 批次處理 CSV 列 → 模擬用交易 + 略過清單
 */
export function buildSimulationTradePool(rawRows, pricesByCode, params = {}) {
  const normalized = normalizeSma20Params(params)
  const qualified = []
  const rejected = []

  for (const raw of rawRows) {
    const trade = normalizeEntryRow(raw)
    const base = {
      name: trade.name,
      code: trade.code,
      originalBuyDay: trade.buyDay,
      note: '',
    }

    if (!trade.code) {
      rejected.push({ ...base, reason: '無商品代碼' })
      continue
    }
    if (!trade.buyDay) {
      rejected.push({ ...base, reason: '無進場時間' })
      continue
    }

    const prices = pricesByCode.get(trade.code)
    if (!prices?.length) {
      rejected.push({ ...base, reason: '資料庫無股價' })
      continue
    }

    const evalResult = evaluateDay60EntrySignal({
      sortedPrices: prices,
      buyDay: trade.buyDay,
      ...normalized,
    })

    if (!evalResult.ok) {
      rejected.push({
        ...base,
        signalDay: evalResult.signalDay || '—',
        return60: evalResult.return60,
        reason: evalResult.reason || '未通過篩選',
        skippedNegative: Boolean(evalResult.skippedNegative),
        skippedSmaEntry: Boolean(evalResult.skippedSmaEntry),
      })
      continue
    }

    qualified.push({
      ...base,
      signalDay: evalResult.signalDay,
      return60: evalResult.return60,
      buyPrice: evalResult.buyPrice,
      closeAtSignal: evalResult.closeAtSignal,
      smaAtSignal: evalResult.smaAtSignal,
      buyDay: evalResult.simBuyDay,
      sellDay: evalResult.simSellDay,
      buyPriceSim: evalResult.simBuyPrice,
      sellPriceSim: evalResult.simSellPrice,
      return: evalResult.simReturn,
      holdDays: evalResult.simHoldDays,
      forcedExit: evalResult.forcedExit,
      note: evalResult.note,
    })
  }

  const simStartDate = resolveSimulationStartDate(
    rawRows.map(normalizeEntryRow),
    pricesByCode,
    normalized.baseHoldDays
  )

  return {
    qualified,
    rejected,
    simStartDate,
    params: normalized,
  }
}
