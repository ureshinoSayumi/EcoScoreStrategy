import { parseDateLoose } from '@/utils/sma20ExtendedHold'
import { buildTradingTimeline } from '@/utils/sma20Day60Entry'

function formatDate(str) {
  return String(str ?? '').replaceAll('/', '-')
}

function parseDateMs(str) {
  const t = new Date(formatDate(str)).getTime()
  return Number.isNaN(t) ? null : t
}

function calculateMaxDrawdown(history) {
  let maxAsset = parseFloat(history[0]?.netAsset || 0)
  let maxDrawdown = 0
  history.forEach((h) => {
    const net = parseFloat(h.netAsset)
    if (net > maxAsset) maxAsset = net
    const dd = maxAsset > 0 ? (maxAsset - net) / maxAsset : 0
    if (dd > maxDrawdown) maxDrawdown = dd
  })
  return maxDrawdown
}

function calculateAnnualReturn(history) {
  const annualReturnMap = {}
  history.forEach((h) => {
    const year = new Date(h.date).getFullYear()
    if (!annualReturnMap[year]) annualReturnMap[year] = []
    annualReturnMap[year].push(h)
  })
  const annualReturns = []
  const annualReturnsLog = []
  for (const year in annualReturnMap) {
    const records = annualReturnMap[year].sort((a, b) => new Date(a.date) - new Date(b.date))
    const start = records[0].netAsset
    const end = records[records.length - 1].netAsset
    if (!start || !end || start <= 0) continue
    const r = (end / start - 1) * 100
    annualReturns.push(r)
    annualReturnsLog.push({ year, start, end, return: r })
  }
  const mean = annualReturns.reduce((a, b) => a + b, 0) / (annualReturns.length || 1)
  const sorted2 = [...annualReturns].sort((a, b) => a - b)
  const mid = Math.floor(sorted2.length / 2)
  const median = sorted2.length
    ? sorted2.length % 2 === 0
      ? (sorted2[mid - 1] + sorted2[mid]) / 2
      : sorted2[mid]
    : 0
  const worst = sorted2[0] ?? 0
  const best = sorted2[sorted2.length - 1] ?? 0
  return { mean, median, worst, best, annualReturnsLog }
}

function emptyResult() {
  return {
    finalReturn: 0,
    maxDrawdown: 0,
    rotations: 0,
    mean: 0,
    median: 0,
    worst: 0,
    best: 0,
    annualReturnsLog: [],
    history: [],
    executedTrades: [],
    positionDistribution: {},
  }
}

function snapshotPortfolio(capital, positions, initialCapital) {
  const positionCost = positions.reduce((sum, p) => sum + p.capitalUsed, 0)
  const netAsset = capital + positionCost
  return {
    positionCount: positions.length,
    capital: Math.round(capital * 100) / 100,
    netAsset: Math.round(netAsset * 100) / 100,
    totalReturnPct: Math.round((netAsset / initialCapital - 1) * 10000) / 100,
  }
}

/**
 * 以「交易日」時間軸跑組合回測（買入日 = 模擬進場日 simBuyDay）
 *
 * @param {object[]} tradeLog 通過篩選的交易（含 buyDay, sellDay, return）
 * @param {object} opts
 * @param {string} opts.simStartDate 模擬起點（第一筆進場 + N 交易日）
 * @param {Map<string, object[]>} opts.pricesByCode 各股日線（建時間軸用）
 */
export function calculateDay60SmaSimulation(tradeLog, opts = {}) {
  const initialCapital = opts.initialCapital ?? 10000
  const maxPositions = opts.maxPositions ?? 10
  const isRepeat = opts.isRepeat !== false
  const dayBuyRepeat = opts.dayBuyRepeat !== false
  const simStartDate = opts.simStartDate
  const pricesByCode = opts.pricesByCode ?? new Map()

  let rows = tradeLog
    .filter((i) => i.buyDay && i.sellDay && !Number.isNaN(parseFloat(i.return)))
    .sort((a, b) => parseDateMs(a.buyDay) - parseDateMs(b.buyDay))

  if (!rows.length || !simStartDate) {
    return emptyResult()
  }

  const timeline = buildTradingTimeline(pricesByCode, simStartDate)
  if (!timeline.length) {
    return emptyResult()
  }

  const tradeLogMap = new Map()
  rows.forEach((item) => {
    const d = formatDate(item.buyDay)
    if (!tradeLogMap.has(d)) tradeLogMap.set(d, [])
    tradeLogMap.get(d).push(item)
  })

  let capital = initialCapital
  let positions = []
  let rotations = 0
  const executedTrades = []
  const positionsMap = {}
  const stockNameMap = {}

  function recordStockName(stock, buyDay, sellDay, ret) {
    const key = `${stock.name} ${stock.code}`
    const entry = { buy: buyDay, sell: sellDay, return: ret }
    if (!stockNameMap[key]) {
      stockNameMap[key] = { count: 1, data: [entry] }
    } else {
      stockNameMap[key].count += 1
      stockNameMap[key].data.push(entry)
    }
  }

  function pushExecuted(pos, snap) {
    executedTrades.push({
      name: pos.name,
      code: pos.code,
      buyDay: pos.buyDay,
      sellDay: pos.sellDay,
      return: pos.return,
      originalBuyDay: pos.originalBuyDay,
      signalDay: pos.signalDay,
      return60: pos.return60,
      capitalUsed: pos.capitalUsed,
      positionCount: snap.positionCount,
      capital: snap.capital,
      netAsset: snap.netAsset,
      totalReturnPct: snap.totalReturnPct,
    })
  }

  function tryBuy(todayTrades) {
    if (!todayTrades?.length || positions.length >= maxPositions) return

    const vacant = maxPositions - positions.length
    const capitalPerStock = capital / vacant

    if (dayBuyRepeat) {
      const stock = isRepeat ? todayTrades[0] : todayTrades.find((s) => !positions.some((p) => p.code === s.code))
      if (!stock || capitalPerStock <= 0) return
      capital -= capitalPerStock
      const pos = { ...stock, capitalUsed: capitalPerStock }
      positions.push(pos)
      rotations += 1
      const snap = snapshotPortfolio(capital, positions, initialCapital)
      pushExecuted(pos, snap)
      recordStockName(stock, stock.buyDay, stock.sellDay, parseFloat(stock.return))
      return
    }

    for (const stock of todayTrades) {
      if (positions.length >= maxPositions) break
      if (!isRepeat && positions.some((p) => p.code === stock.code)) continue
      const per = capital / (maxPositions - positions.length)
      if (per <= 0) break
      capital -= per
      const pos = { ...stock, capitalUsed: per }
      positions.push(pos)
      rotations += 1
      const snap = snapshotPortfolio(capital, positions, initialCapital)
      pushExecuted(pos, snap)
      recordStockName(stock, stock.buyDay, stock.sellDay, parseFloat(stock.return))
      if (!isRepeat) break
    }
  }

  const history = []

  timeline.forEach((date, index) => {
    const cur = parseDateLoose(date)

    for (let i = positions.length - 1; i >= 0; i--) {
      const sellMs = parseDateMs(positions[i].sellDay)
      if (sellMs != null && cur && cur.getTime() >= sellMs) {
        const pos = positions[i]
        const r = parseFloat(pos.return)
        const profit = !Number.isNaN(r) ? pos.capitalUsed * (1 + r) : pos.capitalUsed
        capital += profit
        positions.splice(i, 1)
      }
    }

    const todayTrades = tradeLogMap.get(date) || []
    tryBuy(todayTrades)

    if (index === timeline.length - 1) {
      positions.forEach((pos) => {
        const r = parseFloat(pos.return)
        const profit = !Number.isNaN(r) ? pos.capitalUsed * (1 + r) : pos.capitalUsed
        capital += profit
      })
      positions = []
    }

    const snap = snapshotPortfolio(capital, positions, initialCapital)
    const uniqueCount = new Set(positions.map((p) => p.code)).size
    positionsMap[uniqueCount] = (positionsMap[uniqueCount] || 0) + 1

    history.push({
      date,
      capital: snap.capital,
      netAsset: snap.netAsset,
      returnRate: snap.totalReturnPct,
      positionCount: snap.positionCount,
      positions: JSON.parse(JSON.stringify(positions)),
      tradeLogMap: todayTrades,
    })
  })

  const finalReturn = (capital / initialCapital - 1) * 100
  const maxDrawdown = calculateMaxDrawdown(history) * 100
  const { mean, median, worst, best, annualReturnsLog } = calculateAnnualReturn(history)

  return {
    finalReturn,
    maxDrawdown,
    rotations,
    mean,
    median,
    worst,
    best,
    annualReturnsLog,
    history,
    executedTrades,
    positionDistribution: positionsMap,
    stockNameMap,
  }
}
