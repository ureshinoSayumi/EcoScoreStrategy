/**
 * SMA20 延伸持有 CSV 的持倉回測：基礎邏輯同 calculateSimulationResult2，
 * 另在「SMA20 路徑持倉已超過 baseHoldDays」且有空位時，以剩餘持有期報酬加碼一筆（獨立交易紀錄）。
 */

function formatDate(str) {
  return String(str ?? '').replaceAll('/', '-')
}

function parseDateMs(str) {
  const t = new Date(formatDate(str)).getTime()
  return Number.isNaN(t) ? null : t
}

/** 從「持有區間」欄位取出第一個數字（日） */
export function parseHoldingDays(val) {
  const s = String(val ?? '').trim()
  const m = s.match(/(\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) : null
}

/** 日曆天數差（end − start，不含時間） */
function calendarDaysBetween(startStr, endStr) {
  const a = parseDateMs(startStr)
  const b = parseDateMs(endStr)
  if (a == null || b == null) return 0
  return Math.floor((b - a) / (24 * 60 * 60 * 1000))
}

/**
 * 依全期報酬與剩餘持有比例，估算加碼段報酬（幾何拆分）
 */
export function calcRemainderReturn(fullReturn, buyDay, sellDay, addonBuyDay) {
  const r = parseFloat(fullReturn)
  if (!Number.isFinite(r)) return 0
  const total = calendarDaysBetween(buyDay, sellDay)
  const remain = calendarDaysBetween(addonBuyDay, sellDay)
  if (total <= 0 || remain <= 0) return 0
  return (1 + r) ** (remain / total) - 1
}

function genDateRange(startDate, endDate) {
  const result = []
  let current = new Date(startDate)
  if (Number.isNaN(current.getTime())) throw new Error('無效開始日期')
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)
  while (current <= end) {
    const yyyy = current.getFullYear()
    const mm = String(current.getMonth() + 1).padStart(2, '0')
    const dd = String(current.getDate()).padStart(2, '0')
    result.push({ date: `${yyyy}-${mm}-${dd}` })
    current.setDate(current.getDate() + 1)
  }
  return result
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

function calculatePositionsDistribution(positionsMap) {
  return positionsMap
}

function recordStockName(stockNameMap, stock, buyDay, sellDay, ret) {
  const key = `${stock.name} ${stock.code}`
  const entry = { buy: buyDay, sell: sellDay, return: ret }
  if (!stockNameMap[key]) {
    stockNameMap[key] = { count: 1, data: [entry] }
  } else {
    stockNameMap[key].count += 1
    stockNameMap[key].data.push(entry)
  }
}

/**
 * @param {object} raw CSV 列
 * @param {number} baseHoldDays 判定 SMA20 路徑：持有區間 > 此值
 */
export function normalizeCsvTradeRow(raw, baseHoldDays = 60) {
  const holdDays = parseHoldingDays(raw['持有區間'])
  return {
    name: raw['商品名稱'],
    code: raw['商品代碼'],
    index: raw['序號'],
    buyDay: raw['進場時間'],
    buyPrice: raw['進場價格'],
    sellDay: raw['出場時間'],
    sellPrice: raw['出場價格'],
    return: raw['報酬率'],
    holdDays,
    isSma20Path: holdDays != null && holdDays > baseHoldDays,
  }
}

/**
 * @param {Array<object>} tradeLog 已 normalize 的交易列
 * @param {object} opts
 */
export function calculateSma20PyramidSimulation(tradeLog, opts = {}) {
  const initialCapital = opts.initialCapital ?? 10000
  const maxPositions = opts.maxPositions ?? 10
  const isRepeat = opts.isRepeat !== false
  const dayBuyRepeat = opts.dayBuyRepeat !== false
  const baseHoldDays = opts.baseHoldDays ?? 60

  let rows = tradeLog
    .filter((i) => i.buyDay && i.sellDay && !Number.isNaN(parseFloat(i.return)))
    .map((i) => ({
      ...i,
      isSma20Path:
        i.isSma20Path ??
        (i.holdDays != null ? i.holdDays > baseHoldDays : false),
    }))
    .sort((a, b) => parseDateMs(a.buyDay) - parseDateMs(b.buyDay))

  if (!rows.length) {
    return emptyResult()
  }

  let minBuy = Infinity
  let maxSell = 0
  for (const r of rows) {
    const b = parseDateMs(r.buyDay)
    const s = parseDateMs(r.sellDay)
    if (b != null && b < minBuy) minBuy = b
    if (s != null && s > maxSell) maxSell = s
  }

  const startDate = formatDate(new Date(minBuy))
  const endDate = formatDate(new Date(maxSell))
  const historyDays = genDateRange(startDate, endDate)

  const tradeLogMap = new Map()
  rows.forEach((item) => {
    const d = formatDate(item.buyDay)
    if (!tradeLogMap.has(d)) tradeLogMap.set(d, [])
    tradeLogMap.get(d).push(item)
  })

  let capital = initialCapital
  let positions = []
  let rotations = 0
  let addonCount = 0
  const executedTrades = []
  const positionsMap = {}
  const stockNameMap = {}
  const allBuyStocks = []

  function snapshotPortfolio() {
    const positionCost = positions.reduce((sum, p) => sum + p.capitalUsed, 0)
    const netAsset = capital + positionCost
    return {
      positionCount: positions.length,
      capital: Math.round(capital * 100) / 100,
      netAsset: Math.round(netAsset * 100) / 100,
      totalReturnPct: Math.round((netAsset / initialCapital - 1) * 10000) / 100,
    }
  }

  function pushExecuted(pos, extra = {}) {
    executedTrades.push({
      name: pos.name,
      code: pos.code,
      buyDay: pos.simBuyDay || pos.buyDay,
      sellDay: pos.sellDay,
      return: pos.return,
      isSma20Path: Boolean(pos.isSma20Path),
      isAddon: Boolean(pos.isAddon),
      ...snapshotPortfolio(),
      ...extra,
    })
  }

  function openPosition(stock, simBuyDay, returnDec, flags = {}) {
    const vacant = maxPositions - positions.length
    if (vacant <= 0) return false
    const capitalPerStock = capital / vacant
    if (capitalPerStock <= 0) return false

    capital -= capitalPerStock
    const pos = {
      ...stock,
      return: returnDec,
      simBuyDay,
      capitalUsed: capitalPerStock,
      isAddon: Boolean(flags.isAddon),
      isSma20Path: Boolean(flags.isSma20Path ?? stock.isSma20Path),
      pyramidTriggered: false,
    }
    positions.push(pos)
    rotations += 1
    allBuyStocks.push(stock)
    recordStockName(stockNameMap, stock, simBuyDay, stock.sellDay, parseFloat(returnDec))
    pushExecuted(pos, flags.meta || {})
    return true
  }

  function tryPoolBuys(dateStr) {
    const todayTradeLog = tradeLogMap.get(dateStr) || []
    if (!todayTradeLog.length) return

    const buyOnce = () => {
      if (positions.length >= maxPositions) return
      let stock = null
      if (isRepeat) {
        stock = todayTradeLog[0] ?? null
      } else {
        stock = todayTradeLog.find((s) => !positions.some((p) => p.name === s.name)) ?? null
      }
      if (!stock) return
      openPosition(stock, dateStr, stock.return, { isAddon: false })
    }

    if (dayBuyRepeat) {
      for (let i = positions.length; i < maxPositions; i++) buyOnce()
    } else {
      buyOnce()
    }
  }

  /** SMA20 路徑持倉超過 baseHoldDays 且尚無加碼 → 占用一空位加碼 */
  function tryPyramidAddons(dateStr) {
    if (positions.length >= maxPositions) return

    for (const pos of positions) {
      if (positions.length >= maxPositions) break
      if (pos.isAddon || !pos.isSma20Path || pos.pyramidTriggered) continue

      const held = calendarDaysBetween(pos.buyDay, dateStr)
      if (held <= baseHoldDays) continue

      const rAddon = calcRemainderReturn(pos.return, pos.buyDay, pos.sellDay, dateStr)
      const addonStock = {
        name: pos.name,
        code: pos.code,
        buyDay: pos.buyDay,
        sellDay: pos.sellDay,
        buyPrice: pos.buyPrice,
        sellPrice: pos.sellPrice,
        isSma20Path: true,
      }

      if (
        openPosition(addonStock, dateStr, rAddon, {
          isAddon: true,
          isSma20Path: true,
          meta: { parentBuyDay: pos.buyDay },
        })
      ) {
        pos.pyramidTriggered = true
        addonCount += 1
      }
    }
  }

  historyDays.forEach((item, index) => {
    const dateStr = item.date

    for (let i = positions.length - 1; i >= 0; i--) {
      const date = new Date(dateStr)
      const sellDate = new Date(formatDate(positions[i].sellDay))
      if (date >= sellDate) {
        const pos = positions[i]
        const r = parseFloat(pos.return)
        const profit = !Number.isNaN(r) ? pos.capitalUsed * (1 + r) : pos.capitalUsed
        capital += profit
        positions.splice(i, 1)
      }
    }

    tryPyramidAddons(dateStr)
    tryPoolBuys(dateStr)

    if (index === historyDays.length - 1) {
      positions.forEach((pos) => {
        const r = parseFloat(pos.return)
        const profit = !Number.isNaN(r) ? pos.capitalUsed * (1 + r) : pos.capitalUsed
        capital += profit
      })
      positions = []
    }

    const positionCost = positions.reduce((sum, p) => sum + p.capitalUsed, 0)
    const netAsset = capital + positionCost
    const todayTradeLog = tradeLogMap.get(dateStr) || []

    item.positions = JSON.parse(JSON.stringify(positions))
    item.tradeLogMap = todayTradeLog.length ? JSON.parse(JSON.stringify(todayTradeLog)) : []
    item.capital = capital
    item.netAsset = netAsset
    item.returnRate = (netAsset / initialCapital - 1) * 100
    item.positionCount = positions.length

    const uniquePositions = [...new Set(positions.map((p) => p.name))]
    const slotKey = uniquePositions.length
    if (!positionsMap[slotKey]) positionsMap[slotKey] = 0
    positionsMap[slotKey] += 1
  })

  const finalReturn = (capital / initialCapital - 1) * 100
  const maxDrawdown = calculateMaxDrawdown(historyDays) * 100
  const { mean, median, worst, best, annualReturnsLog } = calculateAnnualReturn(historyDays)

  return {
    finalReturn,
    maxDrawdown,
    rotations,
    mean,
    median,
    worst,
    best,
    annualReturnsLog,
    history: historyDays,
    positionDistribution: calculatePositionsDistribution(positionsMap),
    stockNameMap,
    allBuyStocks,
    executedTrades,
    addonCount,
    poolSma20Count: rows.filter((r) => r.isSma20Path).length,
    poolTradeCount: rows.length,
  }
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
    positionDistribution: {},
    stockNameMap: {},
    allBuyStocks: [],
    executedTrades: [],
    addonCount: 0,
    poolSma20Count: 0,
    poolTradeCount: 0,
  }
}
