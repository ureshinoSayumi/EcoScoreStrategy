/**
 * 動能選股滾動回測：每 Y 交易日汰弱留強，一輪 roundCycles * Y 後結算
 */

import { indexOfDate, normalizeTradeDateKey } from '@/utils/momentumRotationData'

/** @typedef {import('./momentumRotationData.js').StockSeries} StockSeries */

export const LIMIT_UP_BUY_THRESHOLD = 0.0999

export const DEFAULT_MOMENTUM_PARAMS = {
  /** 每輪目標持股檔數（等權切分預算用） */
  holdCount: 50,
  /** 建倉選股：momentum=動能排名；random=隨機 */
  selectionMode: 'momentum',
  /** 略過漲幅榜前 N 名後再往下選（僅 momentum 模式） */
  skipTop: 0,
  rebalanceInterval: 30,
  roundCycles: 3,
  holdingMode: 'cycles',
  maxHoldingDays: 90,
  initialCapital: 10000,
  feeRate: 0.003,
  /** 最低成交金額（元）；優先用 DB amount，缺值才用 volume×收盤價 */
  minTurnover: 5_000_000,
  /**
   * 汰弱檔數：fraction=持股÷N（賣約 1/N）；fixed=固定賣 N 檔
   * 實際賣出仍受成交金額門檻影響；且至少留 1 檔
   */
  cullSizeMode: 'fraction',
  /** fraction 模式：除數 N（2=賣一半） */
  cullFractionDivisor: 2,
  /** fixed 模式：目標賣出檔數 */
  cullFixedCount: 5,
  /**
   * 汰弱賣出量能：prevDay=看 D-1；none=不看成交金額
   * （建倉固定看 D-1；結算仍看當天）
   */
  cullSellVolumeMode: 'prevDay',
  /** 汰弱加碼量能：prevDay=看 D-1；none=不看成交金額 */
  cullAddonVolumeMode: 'prevDay',
  skipLimitUpBuy: false,
  /** 最倒楣成交：買用最高價、賣用最低價 */
  buyHighSellLow: false,
  lookbackDays: null, // null = 同 rebalanceInterval
}

function normalizeVolumeMode(v) {
  return v === 'none' ? 'none' : 'prevDay'
}

function normalizeCullSizeMode(v) {
  if (v === 'fixed') return 'fixed'
  if (v === 'negativeReturn') return 'negativeReturn'
  return 'fraction'
}

/**
 * 本次汰弱「目標」賣出檔數（尚未套用成交金額門檻）
 * - fraction / fixed：持股 ≤1 → 0；最多賣 n-1
 * - negativeReturn：由此函式不決定名單，回傳 -1 表示改走負報酬邏輯
 */
export function calcCullSellCount(
  positionCount,
  { cullSizeMode = 'fraction', cullFractionDivisor = 2, cullFixedCount = 5 } = {}
) {
  const mode = normalizeCullSizeMode(cullSizeMode)
  if (mode === 'negativeReturn') return -1

  const n = Math.floor(Number(positionCount) || 0)
  if (n <= 1) return 0

  const maxSell = n - 1
  if (mode === 'fixed') {
    const raw = Math.floor(Number(cullFixedCount) || 0)
    if (raw <= 0) return 0
    return Math.min(maxSell, raw)
  }

  const divisor = Math.max(2, Math.floor(Number(cullFractionDivisor) || 2))
  const raw = Math.floor(n / divisor)
  if (raw <= 0) return 0
  return Math.min(maxSell, raw)
}

function hashSeed(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 可重現的 PRNG（同一種子同一序列） */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleInPlace(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

export function normalizeMomentumParams(input = {}) {
  const rebalanceInterval = Math.max(
    1,
    Math.floor(Number(input.rebalanceInterval) || DEFAULT_MOMENTUM_PARAMS.rebalanceInterval)
  )
  const holdCountRaw =
    input.holdCount != null ? input.holdCount : input.topCount
  const selectionMode =
    input.selectionMode === 'random'
      ? 'random'
      : input.selectionMode === 'csv'
        ? 'csv'
        : 'momentum'
  return {
    holdCount: Math.max(
      1,
      Math.floor(Number(holdCountRaw) || DEFAULT_MOMENTUM_PARAMS.holdCount)
    ),
    selectionMode,
    skipTop:
      selectionMode === 'momentum'
        ? Math.max(
            0,
            Math.floor(Number(input.skipTop) || DEFAULT_MOMENTUM_PARAMS.skipTop)
          )
        : 0,
    rebalanceInterval,
    roundCycles: Math.max(
      1,
      Math.floor(Number(input.roundCycles) || DEFAULT_MOMENTUM_PARAMS.roundCycles)
    ),
    holdingMode: input.holdingMode === 'maxDays' ? 'maxDays' : 'cycles',
    maxHoldingDays: Math.max(
      1,
      Math.floor(Number(input.maxHoldingDays) || DEFAULT_MOMENTUM_PARAMS.maxHoldingDays)
    ),
    initialCapital: Math.max(
      1,
      Number(input.initialCapital) || DEFAULT_MOMENTUM_PARAMS.initialCapital
    ),
    feeRate: Math.max(0, Number(input.feeRate) ?? DEFAULT_MOMENTUM_PARAMS.feeRate),
    minTurnover: Math.max(
      0,
      Number(input.minTurnover) ?? DEFAULT_MOMENTUM_PARAMS.minTurnover
    ),
    cullSizeMode: normalizeCullSizeMode(
      input.cullSizeMode ?? DEFAULT_MOMENTUM_PARAMS.cullSizeMode
    ),
    cullFractionDivisor: Math.max(
      2,
      Math.floor(
        Number(input.cullFractionDivisor) || DEFAULT_MOMENTUM_PARAMS.cullFractionDivisor
      )
    ),
    cullFixedCount: Math.max(
      0,
      Math.floor(Number(input.cullFixedCount) || DEFAULT_MOMENTUM_PARAMS.cullFixedCount)
    ),
    cullSellVolumeMode: normalizeVolumeMode(
      input.cullSellVolumeMode ?? DEFAULT_MOMENTUM_PARAMS.cullSellVolumeMode
    ),
    cullAddonVolumeMode: normalizeVolumeMode(
      input.cullAddonVolumeMode ?? DEFAULT_MOMENTUM_PARAMS.cullAddonVolumeMode
    ),
    skipLimitUpBuy: Boolean(input.skipLimitUpBuy),
    buyHighSellLow: Boolean(input.buyHighSellLow),
    lookbackDays: input.lookbackDays != null
      ? Math.max(1, Math.floor(Number(input.lookbackDays)))
      : rebalanceInterval,
  }
}

function getBar(series, date) {
  return series?.barsByDate?.get(date) ?? null
}

/** 漲幅 = (期末收盤 - 期初收盤) / 期初收盤 */
export function calcCloseReturn(series, startDate, endDate) {
  const startBar = getBar(series, startDate)
  const endBar = getBar(series, endDate)
  if (!startBar || !endBar) return null
  if (startBar.close <= 0) return null
  return (endBar.close - startBar.close) / startBar.close
}

/**
 * 單日成交金額（元）
 * 優先 DB amount（FinMind Trading_money）；缺值才用 volume(股)×收盤價估算
 * （還原權息價不宜當主算法，故以 amount 為準）
 */
export function barTurnover(bar) {
  if (!bar) return 0
  const amount = Number(bar.amount)
  if (Number.isFinite(amount) && amount > 0) return amount
  const volume = Number(bar.volume)
  const close = Number(bar.close)
  if (Number.isFinite(volume) && volume > 0 && Number.isFinite(close) && close > 0) {
    return volume * close
  }
  return 0
}

/** 指定日成交金額是否達門檻（無 K 線視為不足） */
export function hasEnoughTurnoverOnDate(series, turnoverDate, minTurnover) {
  if (!turnoverDate) return false
  const bar = getBar(series, turnoverDate)
  if (!bar) return false
  return barTurnover(bar) >= minTurnover
}

/** @deprecated 別名，相容舊呼叫 */
export const hasEnoughVolumeOnDate = hasEnoughTurnoverOnDate

/**
 * 換倉日是否可交易
 * @param {string|null} [volumeDate] 成交金額參考日；null=不看；省略則用 tradeDate（同日）
 */
export function isTradableOnDay(
  series,
  tradeDate,
  minTurnover,
  buyHighSellLow = false,
  volumeDate = undefined
) {
  const bar = getBar(series, tradeDate)
  if (!bar) return false
  if (buyHighSellLow) {
    if (bar.high == null || !Number.isFinite(bar.high) || bar.high <= 0) return false
    if (bar.low == null || !Number.isFinite(bar.low) || bar.low <= 0) return false
  } else if (bar.open == null || !Number.isFinite(bar.open) || bar.open <= 0) {
    return false
  }
  if (volumeDate === null) {
    // 明確不看成交金額
  } else {
    const volDate = volumeDate === undefined ? tradeDate : volumeDate
    if (!hasEnoughTurnoverOnDate(series, volDate, minTurnover)) return false
  }
  return true
}

/** 建倉／加碼成交價：預設開盤；最倒楣模式用最高價 */
export function getBuyFillPrice(bar, buyHighSellLow = false) {
  if (!bar) return null
  if (buyHighSellLow) {
    return bar.high != null && Number.isFinite(bar.high) && bar.high > 0 ? bar.high : null
  }
  return bar.open != null && Number.isFinite(bar.open) && bar.open > 0 ? bar.open : null
}

/** 減碼／結算成交價：預設開盤；最倒楣模式用最低價 */
export function getSellFillPrice(bar, buyHighSellLow = false) {
  if (!bar) return null
  if (buyHighSellLow) {
    return bar.low != null && Number.isFinite(bar.low) && bar.low > 0 ? bar.low : null
  }
  return bar.open != null && Number.isFinite(bar.open) && bar.open > 0 ? bar.open : null
}

export function calcGainFromPrevClose(price, prevClose) {
  if (price == null || !Number.isFinite(price) || price <= 0) return null
  if (!prevClose || prevClose <= 0) return null
  return (price - prevClose) / prevClose
}

/** 建倉／加碼日是否因漲停（≥9.99%）應跳過買入 */
export function isLimitUpOnBuyDay(
  series,
  calendar,
  actionIdx,
  tradeDate,
  threshold = LIMIT_UP_BUY_THRESHOLD
) {
  if (actionIdx <= 0) return false

  const prevBar = getBar(series, calendar[actionIdx - 1])
  const prevClose = prevBar?.close
  if (!prevClose || prevClose <= 0) return false

  const bar = getBar(series, tradeDate)
  if (!bar) return false

  const openGain = calcGainFromPrevClose(bar.open, prevClose)
  const highGain = calcGainFromPrevClose(bar.high, prevClose)

  return (
    (openGain != null && openGain >= threshold) ||
    (highGain != null && highGain >= threshold)
  )
}

/**
 * @param {'prevDay'|'none'|'sameDay'} [volumeMode]
 * prevDay=看 D-1 量；none=不看量；sameDay=看當天量
 */
function shouldSkipBuyOnDay(
  series,
  calendar,
  actionIdx,
  tradeDate,
  minTurnover,
  skipLimitUpBuy,
  buyHighSellLow = false,
  volumeMode = 'prevDay'
) {
  let volumeDate
  if (volumeMode === 'none') volumeDate = null
  else if (volumeMode === 'sameDay') volumeDate = tradeDate
  else volumeDate = actionIdx > 0 ? calendar[actionIdx - 1] : null

  if (volumeMode === 'prevDay' && volumeDate == null) return true
  if (!isTradableOnDay(series, tradeDate, minTurnover, buyHighSellLow, volumeDate)) {
    return true
  }
  if (
    skipLimitUpBuy &&
    isLimitUpOnBuyDay(series, calendar, actionIdx, tradeDate)
  ) {
    return true
  }
  return false
}

/** 依持股模式計算一輪長度與汰弱偏移（交易日） */
export function buildRoundPlan(params) {
  const { holdingMode, roundCycles, rebalanceInterval, maxHoldingDays } = params

  if (holdingMode === 'maxDays') {
    const roundTradingDays = maxHoldingDays
    const cullOffsets = []
    for (let offset = rebalanceInterval; offset < roundTradingDays; offset += rebalanceInterval) {
      cullOffsets.push(offset)
    }
    return { roundTradingDays, cullOffsets }
  }

  const roundTradingDays = roundCycles * rebalanceInterval
  const cullOffsets = []
  for (let c = 1; c < roundCycles; c++) {
    cullOffsets.push(c * rebalanceInterval)
  }
  return { roundTradingDays, cullOffsets }
}

/**
 * 依動能排名（高→低），平手以成交值大的優先
 * @param {string[]} stockIds
 * @param {Map<string, StockSeries>} stockData
 */
export function rankByMomentum(
  stockIds,
  stockData,
  calendar,
  actionIdx,
  lookbackDays,
  minTurnover,
  { requireTradable = false, buyHighSellLow = false } = {}
) {
  if (actionIdx <= 0) return []

  const endDate = calendar[actionIdx - 1]
  const startDate = calendar[actionIdx - 1 - lookbackDays]
  if (!endDate || !startDate) return []

  const actionDate = calendar[actionIdx]
  const volumeDate = actionIdx > 0 ? calendar[actionIdx - 1] : null
  const scored = []

  for (const stockId of stockIds) {
    const series = stockData.get(stockId)
    if (!series) continue

    const ret = calcCloseReturn(series, startDate, endDate)
    if (ret == null) continue

    if (
      requireTradable &&
      (!actionDate ||
        !volumeDate ||
        !isTradableOnDay(series, actionDate, minTurnover, buyHighSellLow, volumeDate))
    ) {
      continue
    }

    const amountBar = getBar(series, endDate)
    scored.push({
      stockId,
      stockName: series.stockName,
      return: ret,
      amount: amountBar?.amount ?? 0,
    })
  }

  scored.sort((a, b) => {
    if (b.return !== a.return) return b.return - a.return
    return (b.amount ?? 0) - (a.amount ?? 0)
  })

  return scored
}

/** 第一次建倉至少需要的交易日索引（含 Y 日回看 + 建倉日） */
export function getMinActionIdx(lookbackDays) {
  return lookbackDays + 1
}

/** 診斷為何無法選出標的 */
export function diagnoseRankFailure(
  stockIds,
  stockData,
  calendar,
  actionIdx,
  lookbackDays,
  minTurnover,
  buyHighSellLow = false
) {
  if (actionIdx <= 0) {
    return '交易日索引不足（資料起始日太晚，無法回看 Y 日漲幅）'
  }

  const endDate = calendar[actionIdx - 1]
  const startDate = calendar[actionIdx - 1 - lookbackDays]
  if (!endDate || !startDate) {
    return `回看期不足：建倉日索引 ${actionIdx}，需至少 ${lookbackDays + 1} 個交易日`
  }

  let hasReturn = 0
  let hasTradable = 0
  const actionDate = calendar[actionIdx]
  const volumeDate = actionIdx > 0 ? calendar[actionIdx - 1] : null

  for (const stockId of stockIds) {
    const series = stockData.get(stockId)
    if (!series) continue
    if (calcCloseReturn(series, startDate, endDate) != null) hasReturn += 1
    if (
      actionDate &&
      isTradableOnDay(series, actionDate, minTurnover, buyHighSellLow, volumeDate)
    ) {
      hasTradable += 1
    }
  }

  return (
    `回看 ${startDate}→${endDate}：可算漲幅 ${hasReturn} 檔；` +
    `建倉日 ${actionDate}（成交金額看 D-1）可交易 ${hasTradable} 檔（池內 ${stockIds.length} 檔）`
  )
}

/**
 * CSV 名單模式：找第一個「該日有名單且至少 minPicks 檔可交易」的交易日
 * @param {Map<string, { stockId: string, stockName?: string }[]>} entryPicksByDate
 */
export function findFirstValidCsvActionIdx(
  entryPicksByDate,
  stockData,
  calendar,
  fromIdx,
  minTurnover,
  minPicks = 1,
  buyHighSellLow = false,
  lookbackDays = 0
) {
  const minIdx = getMinActionIdx(Math.max(1, lookbackDays || 1))
  const start = Math.max(fromIdx, minIdx)
  const need = Math.max(1, Math.floor(Number(minPicks) || 1))

  for (let idx = start; idx < calendar.length; idx++) {
    const actionDate = calendar[idx]
    const picks = entryPicksByDate?.get?.(actionDate)
    if (!picks?.length) continue

    const volumeDate = idx > 0 ? calendar[idx - 1] : null
    if (!volumeDate) continue

    let ok = 0
    for (const pick of picks) {
      const series = stockData.get(pick.stockId)
      if (
        series &&
        isTradableOnDay(series, actionDate, minTurnover, buyHighSellLow, volumeDate)
      ) {
        ok += 1
        if (ok >= need) return idx
      }
    }
  }
  return -1
}

/**
 * 從 fromIdx 起往後找第一個可建倉的交易日
 * momentum：略過前 skipTop 名後至少 minPicks 檔可交易
 * random：池內至少 minPicks 檔可交易
 * @returns {number} 索引；-1 表示找不到
 */
export function findFirstValidActionIdx(
  stockIds,
  stockData,
  calendar,
  fromIdx,
  lookbackDays,
  minTurnover,
  minPicks = 1,
  buyHighSellLow = false,
  skipTop = 0,
  selectionMode = 'momentum'
) {
  const minIdx = getMinActionIdx(lookbackDays)
  const start = Math.max(fromIdx, minIdx)
  const skip = Math.max(0, Math.floor(Number(skipTop) || 0))
  const need = Math.max(1, Math.floor(Number(minPicks) || 1))
  const mode = selectionMode === 'random' ? 'random' : 'momentum'

  for (let idx = start; idx < calendar.length; idx++) {
    const actionDate = calendar[idx]
    const volumeDate = idx > 0 ? calendar[idx - 1] : null
    if (!volumeDate) continue
    let ok = 0

    if (mode === 'random') {
      for (const stockId of stockIds) {
        const series = stockData.get(stockId)
        if (
          series &&
          isTradableOnDay(series, actionDate, minTurnover, buyHighSellLow, volumeDate)
        ) {
          ok += 1
          if (ok >= need) break
        }
      }
    } else {
      const ranked = rankByMomentum(
        stockIds,
        stockData,
        calendar,
        idx,
        lookbackDays,
        minTurnover,
        { requireTradable: false, buyHighSellLow }
      )
      const afterSkip = ranked.slice(skip)
      for (const pick of afterSkip) {
        const series = stockData.get(pick.stockId)
        if (
          series &&
          isTradableOnDay(series, actionDate, minTurnover, buyHighSellLow, volumeDate)
        ) {
          ok += 1
          if (ok >= need) break
        }
      }
    }

    if (ok >= need) return idx
  }
  return -1
}

/**
 * @typedef {Object} PositionAddon
 * @property {string} date
 * @property {number} price
 * @property {number} amount
 * @property {number} shares
 */

/**
 * @typedef {Object} Position
 * @property {string} stockId
 * @property {string} stockName
 * @property {number} shares
 * @property {number} costBasis
 * @property {string} initialBuyDate
 * @property {number} initialBuyPrice
 * @property {number} initialBuyAmount
 * @property {PositionAddon[]} addons
 */

function buyAtOpen(amount, openPrice, feeRate) {
  if (amount <= 0 || openPrice <= 0) return null
  const fee = amount * feeRate
  const net = amount - fee
  const shares = net / openPrice
  if (shares <= 0) return null
  return { shares, costBasis: amount, fee }
}

function sellAtOpen(shares, openPrice, feeRate) {
  if (shares <= 0 || openPrice <= 0) return { proceeds: 0, fee: 0 }
  const gross = shares * openPrice
  const fee = gross * feeRate
  return { proceeds: gross - fee, fee }
}

function toMomentumPct(ret) {
  if (ret == null || !Number.isFinite(ret)) return null
  return Math.round(ret * 10000) / 100
}

function buildSoldDetail(pos, actionDate, result, momentumReturn = null) {
  const addonAmount = pos.addons.reduce((s, a) => s + a.amount, 0)
  let avgAddonPrice = null
  if (addonAmount > 0) {
    const weighted = pos.addons.reduce((s, a) => s + a.price * a.amount, 0)
    avgAddonPrice = weighted / addonAmount
  }
  return {
    stockId: pos.stockId,
    stockName: pos.stockName,
    initialBuyDate: pos.initialBuyDate,
    initialBuyPrice: pos.initialBuyPrice,
    initialBuyAmount: pos.initialBuyAmount,
    addons: pos.addons.map((a) => ({ ...a })),
    addonAmount,
    avgAddonPrice,
    totalCostBasis: pos.costBasis,
    momentumReturnPct: toMomentumPct(momentumReturn),
    sellDate: actionDate,
    sellPrice: result.sellPrice ?? null,
    sellAmount: result.proceeds,
    returnPct: Math.round((result.return ?? 0) * 10000) / 100,
    note: result.note ?? '',
  }
}

function portfolioMarketValue(cash, positions, stockData, date) {
  let positionValue = 0
  for (const pos of positions) {
    const bar = getBar(stockData.get(pos.stockId), date)
    const px = bar?.close ?? bar?.open ?? 0
    positionValue += pos.shares * px
  }
  return cash + positionValue
}

function snapshotState(cash, positions, stockData, date, initialCapital) {
  const netAsset = portfolioMarketValue(cash, positions, stockData, date)
  return {
    date,
    cash: Math.round(cash * 100) / 100,
    netAsset: Math.round(netAsset * 100) / 100,
    positionCount: positions.length,
    totalReturnPct: Math.round((netAsset / initialCapital - 1) * 10000) / 100,
  }
}

/**
 * @param {Map<string, StockSeries>} stockData
 * @param {string[]} calendar
 * @param {object} params
 */
export function runMomentumRotationBacktest(stockData, calendar, rawParams = {}) {
  const params = normalizeMomentumParams(rawParams)
  const {
    holdCount,
    selectionMode,
    skipTop,
    rebalanceInterval,
    roundCycles,
    holdingMode,
    maxHoldingDays,
    initialCapital,
    feeRate,
    minTurnover,
    cullSizeMode,
    cullFractionDivisor,
    cullFixedCount,
    cullSellVolumeMode,
    cullAddonVolumeMode,
    skipLimitUpBuy,
    buyHighSellLow,
    lookbackDays,
  } = params

  const universeIds = [...stockData.keys()]
  const { roundTradingDays, cullOffsets } = buildRoundPlan(params)

  /** @type {Map<string, { stockId: string, stockName?: string }[]>} */
  const entryPicksByDate =
    rawParams.entryPicksByDate instanceof Map
      ? rawParams.entryPicksByDate
      : new Map(Object.entries(rawParams.entryPicksByDate || {}))

  let cash = initialCapital
  /** @type {Position[]} */
  let positions = []
  /** @type {object[]} */
  const events = []
  /** @type {object[]} */
  const history = []
  /** @type {object[]} */
  const roundSummaries = []

  let roundNo = 0
  const requestedStartIdx = indexOfDate(calendar, rawParams.startDate)
  const minStartIdx = getMinActionIdx(lookbackDays)
  let startIdx =
    rawParams.forcedStartIdx != null && rawParams.forcedStartIdx >= 0
      ? rawParams.forcedStartIdx
      : Math.max(requestedStartIdx >= 0 ? requestedStartIdx : 0, minStartIdx)

  const effectiveStartDate = calendar[startIdx] ?? null
  const startDateAdjusted =
    rawParams.forcedStartIdx != null
      ? requestedStartIdx >= 0 && startIdx > requestedStartIdx
      : requestedStartIdx >= 0 && startIdx > requestedStartIdx

  const endIdxLimit = rawParams.endDate
    ? calendar.findIndex((d) => d > normalizeTradeDateKey(rawParams.endDate))
    : calendar.length
  const lastAllowedIdx = endIdxLimit >= 0 ? endIdxLimit - 1 : calendar.length - 1

  function recordEvent(type, date, detail = {}, positionsSnapshot = positions) {
    events.push({
      type,
      date,
      roundNo,
      lookbackDays,
      ...detail,
    })
    history.push(snapshotState(cash, positionsSnapshot, stockData, date, initialCapital))
  }

  function buildEntryCandidates(actionDate, actionIdx) {
    if (selectionMode === 'csv') {
      const picks = entryPicksByDate.get(actionDate) || []
      const lookbackEnd = calendar[actionIdx - 1]
      const lookbackStart = calendar[actionIdx - 1 - lookbackDays]
      return picks.map((pick, i) => {
        const series = stockData.get(pick.stockId)
        const ret =
          series && lookbackStart && lookbackEnd
            ? calcCloseReturn(series, lookbackStart, lookbackEnd)
            : null
        return {
          stockId: pick.stockId,
          stockName: series?.stockName || pick.stockName || pick.stockId,
          return: ret,
          momentumRank: i + 1,
        }
      })
    }

    if (selectionMode === 'random') {
      const lookbackEnd = calendar[actionIdx - 1]
      const lookbackStart = calendar[actionIdx - 1 - lookbackDays]
      const list = []
      for (const stockId of universeIds) {
        const series = stockData.get(stockId)
        if (!series) continue
        const ret =
          lookbackStart && lookbackEnd
            ? calcCloseReturn(series, lookbackStart, lookbackEnd)
            : null
        list.push({
          stockId,
          stockName: series.stockName,
          return: ret,
          momentumRank: null,
        })
      }
      const rand = mulberry32(hashSeed(`${actionDate}|${roundNo}|random-entry`))
      shuffleInPlace(list, rand)
      return list
    }

    const ranked = rankByMomentum(
      universeIds,
      stockData,
      calendar,
      actionIdx,
      lookbackDays,
      minTurnover,
      { requireTradable: false, buyHighSellLow }
    )
    return ranked.slice(skipTop).map((pick, i) => ({
      ...pick,
      momentumRank: skipTop + i + 1,
    }))
  }

  function openInitialPositions(actionDate, actionIdx) {
    const budget = cash
    const candidates = buildEntryCandidates(actionDate, actionIdx)
    if (!candidates.length) {
      const reason =
        selectionMode === 'csv'
          ? `CSV 名單在 ${actionDate} 無標的`
          : selectionMode === 'random'
            ? '選股池無可用標的'
            : diagnoseRankFailure(
                universeIds,
                stockData,
                calendar,
                actionIdx,
                lookbackDays,
                minTurnover,
                buyHighSellLow
              )
      recordEvent('buy_skip', actionDate, {
        reason:
          selectionMode === 'momentum'
            ? `略過前 ${skipTop} 名後無可選標的；${reason}`
            : reason,
        skipTop: selectionMode === 'momentum' ? skipTop : 0,
        holdCount,
        selectionMode,
      })
      return []
    }

    const perStock = budget / holdCount
    /** @type {Position[]} */
    const opened = []
    /** @type {object[]} */
    const buyRecords = []

    for (const pick of candidates) {
      if (opened.length >= holdCount) break

      const series = stockData.get(pick.stockId)
      if (!series) continue
      if (
        shouldSkipBuyOnDay(
          series,
          calendar,
          actionIdx,
          actionDate,
          minTurnover,
          skipLimitUpBuy,
          buyHighSellLow,
          'prevDay'
        )
      ) {
        continue
      }

      const bar = getBar(series, actionDate)
      const buyPrice = getBuyFillPrice(bar, buyHighSellLow)
      if (buyPrice == null) continue
      const bought = buyAtOpen(perStock, buyPrice, feeRate)
      if (!bought) continue
      cash -= perStock
      const pos = {
        stockId: pick.stockId,
        stockName: pick.stockName,
        shares: bought.shares,
        costBasis: bought.costBasis,
        initialBuyDate: actionDate,
        initialBuyPrice: buyPrice,
        initialBuyAmount: perStock,
        addons: [],
      }
      opened.push(pos)
      buyRecords.push({
        stockId: pick.stockId,
        stockName: pick.stockName,
        buyDate: actionDate,
        buyPrice,
        buyAmount: perStock,
        shares: bought.shares,
        momentumReturnPct: toMomentumPct(pick.return),
        momentumRank: pick.momentumRank ?? null,
      })
    }

    recordEvent('round_buy', actionDate, {
      buys: buyRecords,
      pickCount: buyRecords.length,
      holdCount,
      skipTop: selectionMode === 'momentum' ? skipTop : 0,
      selectionMode,
      budget,
      fillMode: buyHighSellLow ? 'buy_high_sell_low' : 'open',
      volumeMode: 'prevDay',
      csvListSize: selectionMode === 'csv' ? candidates.length : undefined,
    }, opened)

    return opened
  }

  /** 汰弱賣出：量能依 cullSellVolumeMode；缺行情則 0 元出清 */
  function executeCullSell(pos, actionDate, actionIdx) {
    const series = stockData.get(pos.stockId)
    if (cullSellVolumeMode === 'prevDay') {
      const prevDate = actionIdx > 0 ? calendar[actionIdx - 1] : null
      if (!hasEnoughTurnoverOnDate(series, prevDate, minTurnover)) {
        return { sold: false, proceeds: 0, reason: 'D-1成交金額不足或不存在' }
      }
    }

    const bar = getBar(series, actionDate)
    const sellPrice = getSellFillPrice(bar, buyHighSellLow)
    if (sellPrice == null || sellPrice <= 0) {
      return {
        sold: true,
        proceeds: 0,
        return: -1,
        sellPrice: 0,
        note: '缺行情以 0 元出清（資料缺失或下市）',
        zeroForce: true,
      }
    }

    const { proceeds } = sellAtOpen(pos.shares, sellPrice, feeRate)
    cash += proceeds
    const ret = pos.costBasis > 0 ? proceeds / pos.costBasis - 1 : 0
    return { sold: true, proceeds, return: ret, sellPrice }
  }

  /** 結算賣出：仍看當天量；失敗則收盤備援（不用 0 元） */
  function executeSettleSell(pos, actionDate) {
    const series = stockData.get(pos.stockId)
    const bar = getBar(series, actionDate)
    if (!bar || !isTradableOnDay(series, actionDate, minTurnover, buyHighSellLow)) {
      return { sold: false, proceeds: 0, reason: '無成交或成交金額不足' }
    }
    const sellPrice = getSellFillPrice(bar, buyHighSellLow)
    if (sellPrice == null) {
      return { sold: false, proceeds: 0, reason: '無成交價' }
    }
    const { proceeds } = sellAtOpen(pos.shares, sellPrice, feeRate)
    cash += proceeds
    const ret = pos.costBasis > 0 ? proceeds / pos.costBasis - 1 : 0
    return { sold: true, proceeds, return: ret, sellPrice }
  }

  function cullWeak(actionDate, actionIdx) {
    if (!positions.length) {
      return { earlySettle: true, reason: '無持股' }
    }

    const isNegMode = cullSizeMode === 'negativeReturn'

    if (!isNegMode && positions.length <= 1) {
      return {
        earlySettle: holdingMode === 'cycles',
        reason: '僅剩 1 檔，無法汰弱',
      }
    }

    const heldIds = positions.map((p) => p.stockId)
    const lookbackEnd = calendar[actionIdx - 1]
    const lookbackStart = calendar[actionIdx - 1 - lookbackDays]

    /** @type {Map<string, number|null>} */
    const momentumMap = new Map()
    /** @type {Set<string>} */
    let toSellIds

    let targetSellCount = 0

    if (isNegMode) {
      toSellIds = new Set()
      for (const stockId of heldIds) {
        const series = stockData.get(stockId)
        const ret =
          series && lookbackStart && lookbackEnd
            ? calcCloseReturn(series, lookbackStart, lookbackEnd)
            : null
        momentumMap.set(stockId, ret)
        // 負報酬或算不出漲幅 → 淘汰
        if (ret == null || ret < 0) toSellIds.add(stockId)
      }
      targetSellCount = toSellIds.size
      if (targetSellCount <= 0) {
        recordEvent(
          'cull',
          actionDate,
          {
            sellCount: 0,
            targetSellCount: 0,
            sold: [],
            kept: positions.map((pos) => ({
              stockId: pos.stockId,
              stockName: pos.stockName,
              momentumReturnPct: toMomentumPct(momentumMap.get(pos.stockId)),
            })),
            addons: [],
            survivorCount: positions.length,
            addonPerStock: 0,
            reason: '過去 Y 日無負報酬標的，略過本次汰弱',
            cullSizeMode,
            fillMode: buyHighSellLow ? 'buy_high_sell_low' : 'open',
            cullSellVolumeMode,
            cullAddonVolumeMode,
            zeroForceCount: 0,
            zeroForceIds: [],
          },
          positions
        )
        return { earlySettle: false }
      }
    } else {
      const sellCount = calcCullSellCount(positions.length, {
        cullSizeMode,
        cullFractionDivisor,
        cullFixedCount,
      })
      targetSellCount = sellCount
      if (sellCount <= 0) {
        recordEvent(
          'cull',
          actionDate,
          {
            sellCount: 0,
            sold: [],
            kept: positions.map((pos) => ({
              stockId: pos.stockId,
              stockName: pos.stockName,
              momentumReturnPct: null,
            })),
            addons: [],
            survivorCount: positions.length,
            addonPerStock: 0,
            reason: '目標賣出檔數為 0，略過本次汰弱',
            cullSizeMode,
            cullFractionDivisor,
            cullFixedCount,
            fillMode: buyHighSellLow ? 'buy_high_sell_low' : 'open',
            cullSellVolumeMode,
            cullAddonVolumeMode,
            zeroForceCount: 0,
            zeroForceIds: [],
          },
          positions
        )
        return { earlySettle: false }
      }

      const ranked = rankByMomentum(
        heldIds,
        stockData,
        calendar,
        actionIdx,
        lookbackDays,
        minTurnover,
        { buyHighSellLow }
      )
      for (const r of ranked) momentumMap.set(r.stockId, r.return)
      toSellIds = new Set(
        [...ranked].reverse().slice(0, sellCount).map((r) => r.stockId)
      )
    }

    const survivors = []
    const soldRecords = []
    const addonRecords = []
    let sellProceeds = 0
    const zeroForceIds = []

    for (const pos of positions) {
      if (!toSellIds.has(pos.stockId)) {
        survivors.push(pos)
        continue
      }
      const result = executeCullSell(pos, actionDate, actionIdx)
      if (result.sold) {
        if (result.zeroForce) zeroForceIds.push(pos.stockId)
        else sellProceeds += result.proceeds
        soldRecords.push(buildSoldDetail(pos, actionDate, result, momentumMap.get(pos.stockId)))
      } else {
        survivors.push(pos)
      }
    }

    if (soldRecords.length && survivors.length) {
      // 賣出所得已在 executeCullSell 進 cash；此處只把要加碼的份額再扣掉。
      const addonEach = sellProceeds / survivors.length
      for (const pos of survivors) {
        const series = stockData.get(pos.stockId)
        const bar = getBar(series, actionDate)
        if (
          !bar ||
          shouldSkipBuyOnDay(
            series,
            calendar,
            actionIdx,
            actionDate,
            minTurnover,
            skipLimitUpBuy,
            buyHighSellLow,
            cullAddonVolumeMode
          )
        ) {
          continue
        }
        const buyPrice = getBuyFillPrice(bar, buyHighSellLow)
        if (buyPrice == null) {
          continue
        }
        const bought = buyAtOpen(addonEach, buyPrice, feeRate)
        if (!bought) {
          continue
        }
        const addonEntry = {
          date: actionDate,
          price: buyPrice,
          amount: bought.costBasis,
          shares: bought.shares,
        }
        pos.addons.push(addonEntry)
        pos.shares += bought.shares
        pos.costBasis += bought.costBasis
        cash -= addonEach
        addonRecords.push({
          stockId: pos.stockId,
          stockName: pos.stockName,
          ...addonEntry,
        })
      }
    }

    const keptRecords = survivors.map((pos) => ({
      stockId: pos.stockId,
      stockName: pos.stockName,
      momentumReturnPct: toMomentumPct(momentumMap.get(pos.stockId)),
    }))

    const forceSettleEmpty = isNegMode && survivors.length === 0

    recordEvent(
      'cull',
      actionDate,
      {
        sellCount: soldRecords.length,
        targetSellCount,
        sold: soldRecords,
        kept: keptRecords,
        addons: addonRecords,
        survivorCount: survivors.length,
        addonPerStock: survivors.length ? sellProceeds / survivors.length : 0,
        fillMode: buyHighSellLow ? 'buy_high_sell_low' : 'open',
        cullSizeMode,
        cullFractionDivisor,
        cullFixedCount,
        cullSellVolumeMode,
        cullAddonVolumeMode,
        zeroForceCount: zeroForceIds.length,
        zeroForceIds,
        reason: forceSettleEmpty
          ? '負報酬全數出清（或目標全汰且已賣完），強制結算'
          : undefined,
      },
      survivors
    )

    positions = survivors
    return { earlySettle: forceSettleEmpty }
  }

  function settleAll(actionDate, roundStartCash, extra = {}) {
    const soldRecords = []
    for (const pos of positions) {
      const result = executeSettleSell(pos, actionDate)
      if (result.sold) {
        soldRecords.push(buildSoldDetail(pos, actionDate, result))
      } else {
        const bar = getBar(stockData.get(pos.stockId), actionDate)
        const px = buyHighSellLow
          ? (getSellFillPrice(bar, true) ?? bar?.close ?? 0)
          : (bar?.close ?? 0)
        const { proceeds } = sellAtOpen(pos.shares, px, feeRate)
        cash += proceeds
        soldRecords.push(
          buildSoldDetail(pos, actionDate, {
            sold: true,
            proceeds,
            return: pos.costBasis > 0 ? proceeds / pos.costBasis - 1 : 0,
            sellPrice: px,
            note: buyHighSellLow
              ? '結算日無法用最低價成交，改備援估價（仍扣手續費）'
              : '結算日無開盤／成交金額不足，改收盤估計（仍扣手續費）',
          })
        )
      }
    }

    positions = []
    const netBefore = cash
    recordEvent('settle', actionDate, {
      sold: soldRecords,
      roundCash: netBefore,
    })

    roundSummaries.push({
      roundNo,
      settleDate: actionDate,
      startingCash: roundStartCash,
      endingCash: netBefore,
      returnPct: Math.round((netBefore / roundStartCash - 1) * 10000) / 100,
      pickCount: soldRecords.length,
      holdingMode,
      plannedHoldDays: roundTradingDays,
      ...extra,
    })

    return netBefore
  }

  while (startIdx <= lastAllowedIdx) {
    if (selectionMode === 'csv') {
      const nextCsvIdx = findFirstValidCsvActionIdx(
        entryPicksByDate,
        stockData,
        calendar,
        startIdx,
        minTurnover,
        1,
        buyHighSellLow,
        lookbackDays
      )
      if (nextCsvIdx < 0) break
      startIdx = nextCsvIdx
    }

    roundNo += 1
    const roundStartIdx = startIdx
    const roundStartDate = calendar[roundStartIdx]
    const roundStartCash = cash

    const idealSettleIdx = roundStartIdx + roundTradingDays
    let settleIdx = Math.min(idealSettleIdx, lastAllowedIdx)
    const forcedEndSettle = idealSettleIdx > lastAllowedIdx

    positions = openInitialPositions(roundStartDate, roundStartIdx)

    if (!positions.length) {
      if (selectionMode === 'csv') {
        startIdx = roundStartIdx + 1
        roundNo -= 1
        continue
      }
      roundSummaries.push({
        roundNo,
        settleDate: roundStartDate,
        startingCash: roundStartCash,
        endingCash: roundStartCash,
        returnPct: 0,
        pickCount: 0,
        holdingMode,
        plannedHoldDays: roundTradingDays,
        note: '無法建倉',
      })
      break
    }

    let earlySettle = false

    for (const offset of cullOffsets) {
      const cullIdx = roundStartIdx + offset
      if (cullIdx > settleIdx) break
      if (cullIdx > lastAllowedIdx) break
      const cullDate = calendar[cullIdx]

      if (positions.length <= 1 && cullSizeMode !== 'negativeReturn') {
        if (holdingMode === 'cycles') {
          settleIdx = cullIdx
          earlySettle = true
          break
        }
        continue
      }

      const cullResult = cullWeak(cullDate, cullIdx)
      if (cullResult.earlySettle) {
        settleIdx = cullIdx
        earlySettle = true
        break
      }
    }

    const settleDate = calendar[settleIdx]
    settleAll(settleDate, roundStartCash, {
      earlySettle:
        earlySettle &&
        (holdingMode === 'cycles' || cullSizeMode === 'negativeReturn'),
      forcedEndSettle,
      note: forcedEndSettle
        ? '回測結束強制結算'
        : earlySettle && cullSizeMode === 'negativeReturn'
          ? '負報酬出清後無持股，強制結算'
          : undefined,
    })

    startIdx = settleIdx + 1
    if (startIdx > lastAllowedIdx) break
  }

  const finalCash = positions.length
    ? portfolioMarketValue(cash, positions, stockData, calendar[lastAllowedIdx])
    : cash

  const maxDrawdown = calcMaxDrawdown(history, initialCapital)
  const tradeReturns = events
    .filter((e) => e.type === 'settle' || e.type === 'cull')
    .flatMap((e) => (e.sold ?? []).map((s) => (s.returnPct ?? 0) / 100))
    .filter((r) => Number.isFinite(r))

  return {
    params,
    effectiveStartDate,
    startDateAdjusted,
    requestedStartDate: rawParams.startDate,
    roundCount: roundSummaries.length,
    roundSummaries,
    events,
    history,
    finalCash,
    finalReturnPct: Math.round((finalCash / initialCapital - 1) * 10000) / 100,
    maxDrawdownPct: Math.round(maxDrawdown * 10000) / 100,
    stats: buildTradeStats(tradeReturns),
    roundStats: buildRoundStats(roundSummaries),
  }
}

function calcMaxDrawdown(history, initialCapital) {
  let peak = initialCapital
  let maxDd = 0
  for (const h of history) {
    const net = Number(h.netAsset)
    if (!Number.isFinite(net)) continue
    if (net > peak) peak = net
    if (peak > 0) {
      const dd = (peak - net) / peak
      if (dd > maxDd) maxDd = dd
    }
  }
  return maxDd
}

function buildRoundStats(roundSummaries) {
  const rounds = roundSummaries.filter((r) => r.note !== '無法建倉')
  if (!rounds.length) {
    return { avgReturnPct: 0, medianReturnPct: 0, winRatePct: 0, roundCount: 0 }
  }

  const returns = rounds.map((r) => Number(r.returnPct)).filter((r) => Number.isFinite(r))
  const wins = rounds.filter((r) => Number(r.endingCash) > Number(r.startingCash)).length
  const sorted = [...returns].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2

  return {
    roundCount: rounds.length,
    avgReturnPct: Math.round((returns.reduce((a, b) => a + b, 0) / returns.length) * 100) / 100,
    medianReturnPct: Math.round(median * 100) / 100,
    winRatePct: Math.round((wins / rounds.length) * 10000) / 100,
  }
}

function buildTradeStats(returns) {
  if (!returns.length) {
    return { tradeCount: 0, winRate: 0, avgReturn: 0, medianReturn: 0 }
  }
  const pct = returns.map((r) => r * 100)
  const wins = pct.filter((r) => r > 0).length
  const sorted = [...pct].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2

  return {
    tradeCount: pct.length,
    winRate: Math.round((wins / pct.length) * 10000) / 100,
    avgReturn: Math.round((pct.reduce((a, b) => a + b, 0) / pct.length) * 100) / 100,
    medianReturn: Math.round(median * 100) / 100,
  }
}
