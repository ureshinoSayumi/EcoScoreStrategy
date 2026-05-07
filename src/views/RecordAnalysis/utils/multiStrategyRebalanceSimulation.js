/**
 * 多策略共用日曆：每 reviewIntervalDays 日，依各策略「過去 lookbackDays 內出場（sellDay）之已完成交易」之平均報酬排名（避免用進場日誤用尚未結束之部位），
 * 後 bottomPercent% 策略各承諾「當下淨值 × transferPercent%」之鎖定金額（不立即扣款），
 * 以 FIFO 佇列記在該策略上；每日平倉後、買進前先還債：有現金即依序沖銷，每筆實付金額立刻均分給該筆「當期前段名單」。
 * 買賣規則對齊 calculateSimulationResult2。
 */

function formatDate(str) {
  return String(str).replaceAll('/', '-')
}

function parseDay(str) {
  const d = new Date(formatDate(str))
  return Number.isNaN(d.getTime()) ? null : d
}

function genDateRange(startDate, endDate) {
  const result = []
  let current = new Date(formatDate(startDate))
  if (Number.isNaN(current.getTime())) throw new Error('無效日期格式')
  const end = new Date(formatDate(endDate))
  end.setHours(0, 0, 0, 0)
  while (current <= end) {
    const yyyy = current.getFullYear()
    const mm = String(current.getMonth() + 1).padStart(2, '0')
    const dd = String(current.getDate()).padStart(2, '0')
    result.push(`${yyyy}-${mm}-${dd}`)
    current.setDate(current.getDate() + 1)
  }
  return result
}

function prepareTradeLog(rows) {
  return [...rows]
    .filter((i) => i.buyDay && i.sellDay && !Number.isNaN(parseFloat(i.return)))
    .sort((a, b) => new Date(formatDate(a.buyDay)) - new Date(formatDate(b.buyDay)))
}

function buildTradeMap(tradeLog) {
  const m = new Map()
  tradeLog.forEach((item) => {
    const d = formatDate(item.buyDay)
    if (!m.has(d)) m.set(d, [])
    m.get(d).push(item)
  })
  return m
}

function strategyWealth(capital, positions) {
  const pc = positions.reduce((s, p) => s + p.capitalUsed, 0)
  return capital + pc
}

/**
 * 過去 lookbackDays 內、以「出場時間 sellDay」落在 (asOf−N, asOf] 的交易計算平均報酬（小數）。
 * 僅統計檢核日當天以前已出場之交易，避免用進場日納入尚未結算之資料。
 */
function avgReturnLookback(tradeLog, asOfDateStr, lookbackDays) {
  const end = new Date(asOfDateStr)
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(start.getDate() - lookbackDays)
  const rets = []
  for (const row of tradeLog) {
    const sd = parseDay(row.sellDay)
    if (!sd) continue
    if (sd > start && sd <= end) {
      const r = parseFloat(row.return)
      if (!Number.isNaN(r)) rets.push(r)
    }
  }
  if (!rets.length) return null
  return rets.reduce((a, b) => a + b, 0) / rets.length
}

/**
 * @param {number[]} orderIdx 依績效由高到低排列的策略索引
 */
function partitionWinnersLosers(n, orderIdx, topPercent, bottomPercent) {
  if (n === 0) return { winners: [], losers: [] }
  let topK = Math.round((n * topPercent) / 100)
  let bottomK = Math.round((n * bottomPercent) / 100)
  topK = Math.max(0, Math.min(n, topK))
  bottomK = Math.max(0, Math.min(n, bottomK))
  if (topK + bottomK > n) {
    const s = n / (topK + bottomK)
    topK = Math.max(0, Math.floor(topK * s))
    bottomK = Math.max(0, n - topK)
  }
  const winners = orderIdx.slice(0, topK)
  const loseCand = orderIdx.slice(Math.max(0, n - bottomK))
  const winSet = new Set(winners)
  const losers = loseCand.filter((i) => !winSet.has(i))
  return { winners, losers }
}

function calculateMaxDrawdown(history) {
  let maxAsset = parseFloat(history[0]?.totalNetAsset || 0)
  let maxDrawdown = 0
  history.forEach((h) => {
    const net = parseFloat(h.totalNetAsset)
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
    const start = records[0].totalNetAsset
    const end = records[records.length - 1].totalNetAsset
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

/**
 * @param {Array<{ fileName: string, rows: object[] }>} strategiesInput
 * @param {object} opts
 * @param {number} opts.totalInitialCapital 組合總初始資金（會均分給各策略現金）
 * @param {number} opts.maxPositionsPerStrategy
 * @param {boolean} opts.isRepeat
 * @param {boolean} opts.dayBuyRepeat
 * @param {number} [opts.topPercent=50]
 * @param {number} [opts.bottomPercent=50]
 * @param {number} [opts.transferPercent=30] 後段策略承諾之淨值比例（%），鎖定為待償金額
 * @param {number} [opts.reviewIntervalDays=90]
 * @param {number} [opts.metricLookbackDays=90] 排名用：過去幾日內「出場時間」落在區間之交易平均報酬
 */
export function calculateMultiStrategyRebalanceSimulation(strategiesInput, opts = {}) {
  const totalInitialCapital = opts.totalInitialCapital ?? 10000
  const maxPositions = opts.maxPositionsPerStrategy ?? 10
  const isRepeat = opts.isRepeat !== false
  const dayBuyRepeat = opts.dayBuyRepeat !== false
  const topPercent = opts.topPercent ?? 50
  const bottomPercent = opts.bottomPercent ?? 50
  const transferPercent = opts.transferPercent ?? 30
  const reviewIntervalDays = opts.reviewIntervalDays ?? 90
  const metricLookbackDays = opts.metricLookbackDays ?? 90

  const n = strategiesInput.length
  if (!n) {
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
      rebalanceLog: [],
    }
  }

  const cashEach = totalInitialCapital / n

  const states = strategiesInput.map((s, idx) => {
    const tradeLog = prepareTradeLog(s.rows)
    return {
      idx,
      fileName: s.fileName,
      tradeLog,
      tradeLogMap: buildTradeMap(tradeLog),
      capital: cashEach,
      positions: [],
      rotations: 0,
      /** @type {{ remaining: number, recipients: number[] }[]} FIFO：remaining 為鎖定待匯出金額，recipients 為該期前段策略索引 */
      debtQueue: [],
    }
  })

  let globalStart = null
  let globalEnd = null
  for (const st of states) {
    for (const row of st.tradeLog) {
      const b = parseDay(row.buyDay)
      const e = parseDay(row.sellDay)
      if (b && (!globalStart || b < globalStart)) globalStart = b
      if (e && (!globalEnd || e > globalEnd)) globalEnd = e
    }
  }
  if (!globalStart || !globalEnd) {
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
      rebalanceLog: [],
    }
  }

  const dateList = genDateRange(globalStart, globalEnd)
  const history = []
  const rebalanceLog = []

  function settleExpired(st, dateStr) {
    const d = new Date(dateStr)
    for (let i = st.positions.length - 1; i >= 0; i--) {
      const sellDate = new Date(formatDate(st.positions[i].sellDay))
      if (d >= sellDate) {
        const pos = st.positions[i]
        const r = parseFloat(pos.return)
        const profit = !Number.isNaN(r) ? pos.capitalUsed * (1 + r) : pos.capitalUsed
        st.capital += profit
        st.positions.splice(i, 1)
      }
    }
  }

  function buyStockForStrategy(st, dateStr) {
    const itemDate = dateStr
    function buyStock() {
      if (st.positions.length >= maxPositions) return
      const vacant = maxPositions - st.positions.length
      const capitalPerStock = st.capital / vacant
      const todayTradeLog = st.tradeLogMap.get(itemDate)
      if (!todayTradeLog?.length) return

      if (isRepeat) {
        const stock = todayTradeLog[0]
        st.capital -= capitalPerStock
        st.positions.push({ ...stock, capitalUsed: capitalPerStock })
        st.rotations += 1
      } else {
        const stock = todayTradeLog.find((s) => !st.positions.some((p) => p.name === s.name))
        if (stock) {
          st.capital -= capitalPerStock
          st.positions.push({ ...stock, capitalUsed: capitalPerStock })
          st.rotations += 1
        }
      }
    }

    if (dayBuyRepeat) {
      const todayTradeLog = st.tradeLogMap.get(itemDate) || []
      const stock = todayTradeLog.find((s) => !st.positions.some((p) => p.name === s.name))
      for (let i = st.positions.length; i < maxPositions; i++) {
        if (stock) buyStock()
      }
    } else {
      buyStock()
    }
  }

  function runRebalance(dateStr) {
    const metrics = states.map((st, i) => ({
      i,
      fileName: st.fileName,
      avg: avgReturnLookback(st.tradeLog, dateStr, metricLookbackDays),
    }))
    const validForRank = metrics.map((m, idx) => ({
      idx,
      avg: m.avg == null ? Number.NEGATIVE_INFINITY : m.avg,
    }))
    validForRank.sort((a, b) => b.avg - a.avg)
    const orderIdx = validForRank.map((x) => x.idx)
    const { winners, losers } = partitionWinnersLosers(n, orderIdx, topPercent, bottomPercent)
    if (!winners.length || !losers.length) {
      rebalanceLog.push({
        date: dateStr,
        skipped: true,
        reason: '贏家組或輸家組為空',
        metrics,
        winners,
        losers,
      })
      return
    }

    const rate = transferPercent / 100
    const recipientIds = [...winners]
    const pledges = []

    for (const li of losers) {
      const st = states[li]
      const w = strategyWealth(st.capital, st.positions)
      const pledged = w * rate
      if (pledged <= 1e-9) {
        pledges.push({ idx: li, fileName: st.fileName, pledged: 0, wealth: w })
        continue
      }
      st.debtQueue.push({ remaining: pledged, recipients: recipientIds })
      pledges.push({ idx: li, fileName: st.fileName, pledged, wealth: w })
    }

    rebalanceLog.push({
      date: dateStr,
      skipped: false,
      deferred: true,
      metrics,
      winners: winners.map((i) => ({ idx: i, fileName: states[i].fileName })),
      losers: losers.map((i) => ({ idx: i, fileName: states[i].fileName })),
      pledges,
    })
  }

  /** 平倉後、買進前：先還待匯款；每筆實付立刻均分給該筆 recipients；多輪直到本日無新進度 */
  function fulfillAllDebts() {
    const EPS = 1e-9
    let guard = 0
    let progress = true
    while (progress && guard++ < 200) {
      progress = false
      for (const st of states) {
        while (st.capital > EPS && st.debtQueue.length > 0) {
          const chunk = st.debtQueue[0]
          const pay = Math.min(st.capital, chunk.remaining)
          if (pay <= EPS) break
          st.capital -= pay
          chunk.remaining -= pay
          const rc = chunk.recipients.length
          if (rc > 0) {
            const share = pay / rc
            for (const ri of chunk.recipients) {
              states[ri].capital += share
            }
          }
          progress = true
          if (chunk.remaining <= EPS) {
            st.debtQueue.shift()
          }
        }
      }
    }
  }

  dateList.forEach((dateStr, index) => {
    for (const st of states) {
      settleExpired(st, dateStr)
    }

    const dayNum = index + 1
    if (dayNum % reviewIntervalDays === 0) {
      runRebalance(dateStr)
    }

    fulfillAllDebts()

    for (const st of states) {
      buyStockForStrategy(st, dateStr)
    }

    if (index === dateList.length - 1) {
      for (const st of states) {
        st.positions.forEach((pos) => {
          const r = parseFloat(pos.return)
          const profit = !Number.isNaN(r) ? pos.capitalUsed * (1 + r) : pos.capitalUsed
          st.capital += profit
        })
        st.positions = []
      }
      fulfillAllDebts()
    }

    let totalNet = 0
    const breakdown = states.map((st) => {
      const pc = st.positions.reduce((s, p) => s + p.capitalUsed, 0)
      const net = st.capital + pc
      totalNet += net
      return { fileName: st.fileName, netAsset: net, capital: st.capital, positionCost: pc }
    })

    history.push({
      date: dateStr,
      totalNetAsset: totalNet,
      returnRate: (totalNet / totalInitialCapital - 1) * 100,
      breakdown,
    })
  })

  const finalCapital = states.reduce((s, st) => s + st.capital, 0)
  const finalReturn = (finalCapital / totalInitialCapital - 1) * 100
  const maxDrawdown = calculateMaxDrawdown(history) * 100
  const rotations = states.reduce((s, st) => s + st.rotations, 0)
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
    rebalanceLog,
    totalInitialCapital,
  }
}

/** 外接表單／API 可用預設 */
export const REBALANCE_DEFAULTS = {
  topPercent: 50,
  bottomPercent: 50,
  transferPercent: 30,
  reviewIntervalDays: 90,
  metricLookbackDays: 90,
}
