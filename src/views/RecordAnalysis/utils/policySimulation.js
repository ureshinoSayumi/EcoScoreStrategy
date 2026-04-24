/**
 * 自訂政策：最多 N 檔；30 天若 r30<0 則出場，該資金列為「特殊空位」不得買入選股池，
 * 須加碼到「當日已通過 30 天且 r30>0」的持倉；加碼成本以 buyPrice_30 對 sellPrice_60 換算成長至出場。
 * 60 天到期時該檔原始部位與加碼一併出場，釋出之空位可再買選股池。
 * （非 calculateSimulationResult2，日曆滾動邏輯另實作。）
 */

function formatDate(str) {
  return String(str).replaceAll('/', '-')
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

function addonExitMultiplier(buyPrice30, sellPrice60, r60) {
  const bp = Number(buyPrice30)
  const sp = Number(sellPrice60)
  if (Number.isFinite(bp) && bp > 0 && Number.isFinite(sp) && sp > 0) {
    return sp / bp
  }
  if (Number.isFinite(r60)) return 1 + r60
  return 1
}

function exitValueAt60(pos) {
  const m = addonExitMultiplier(pos.buyPrice30, pos.sellPrice60, pos.r60)
  let v
  if (Number.isFinite(pos.buyPrice30) && pos.buyPrice30 > 0 && Number.isFinite(pos.sellPrice60)) {
    v = pos.initialC * (pos.sellPrice60 / pos.buyPrice30)
  } else {
    v = pos.initialC * (1 + pos.r60)
  }
  for (const a of pos.addOns) {
    v += a * m
  }
  return v
}

function exitValueAt30Loser(pos) {
  return pos.initialC * (1 + pos.r30)
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

/**
 * @param {Array<Object>} tradeRows 已篩選之交易列（name, code, buyDay, sellDay30, sellDay60, r30, r60, buyPrice30, sellPrice60）
 * @param {Object} [opts]
 * @param {boolean} [opts.trace=true] 為 true 時 `console.log` / `console.table` 輸出時間軸；並在回傳值附 `timeline`
 */
export function calculatePolicyPyramidSimulation(tradeRows, opts = {}) {
  const initialCapital = opts.initialCapital ?? 10000
  const maxPositions = opts.maxPositions ?? 10
  const isRepeat = opts.isRepeat !== false
  const dayBuyRepeat = opts.dayBuyRepeat !== false
  const trace = opts.trace !== false

  const rows = [...tradeRows].sort(
    (a, b) => new Date(formatDate(a.buyDay)) - new Date(formatDate(b.buyDay))
  )
  if (!rows.length) {
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
      timeline: [],
    }
  }

  const tradeLogMap = new Map()
  rows.forEach((item) => {
    const d = formatDate(item.buyDay)
    if (!tradeLogMap.has(d)) tradeLogMap.set(d, [])
    tradeLogMap.get(d).push(item)
  })

  const startDate = formatDate(rows[0].buyDay)
  let maxSell60 = new Date(formatDate(rows[0].sellDay60)).getTime()
  rows.forEach((r) => {
    const t = new Date(formatDate(r.sellDay60)).getTime()
    if (t > maxSell60) maxSell60 = t
  })
  const endDate = formatDate(new Date(maxSell60))
  const historyDays = genDateRange(startDate, endDate)

  let capital = initialCapital
  /** @type {Array<{ stock: object, initialC: number, addOns: number[], handled30: boolean }>} */
  let positions = []
  /** 每筆 30 天停損釋出、尚未加碼出去的現金（同時代表「特殊空位」數量） */
  const pendingSpecial = []
  let rotations = 0
  let nextPositionId = 1
  /** @type {Array<Record<string, unknown>>} */
  const timeline = []

  function positionCost(pos) {
    return pos.initialC + pos.addOns.reduce((s, x) => s + x, 0)
  }

  function vacantForPool() {
    return maxPositions - positions.length - pendingSpecial.length
  }

  function runPyramid(dateStr) {
    const winners = positions.filter((p) => p.handled30 && p.stock.r30 > 0)
    if (!winners.length || !pendingSpecial.length) return
    const total = pendingSpecial.reduce((a, b) => a + b, 0)
    const share = total / winners.length
    for (const w of winners) {
      capital -= share
      w.addOns.push(share)
    }
    timeline.push({
      date: dateStr,
      type: 'PYRAMID',
      totalDistributed: Math.round(total * 100) / 100,
      perWinner: Math.round(share * 100) / 100,
      winnerCount: winners.length,
      winners: winners.map((w) => ({ positionId: w.id, name: w.stock.name, code: w.stock.code })),
    })
    pendingSpecial.length = 0
  }

  function tryPoolBuys(dateStr) {
    const today = tradeLogMap.get(dateStr) || []
    if (!today.length) return

    let guard = 0
    while (guard++ < maxPositions * 3) {
      const vacant = vacantForPool()
      if (vacant <= 0) break

      let stock = null
      if (isRepeat) {
        stock = today[0] ?? null
      } else {
        stock = today.find((s) => !positions.some((p) => p.stock.name === s.name)) ?? null
      }
      if (!stock) break

      const per = capital / vacant
      if (per <= 0) break

      capital -= per
      const pid = nextPositionId++
      positions.push({
        id: pid,
        stock,
        initialC: per,
        addOns: [],
        handled30: false,
      })
      rotations += 1
      timeline.push({
        date: dateStr,
        type: 'BUY_POOL',
        positionId: pid,
        name: stock.name,
        code: stock.code,
        buyDaySignal: stock.buyDay,
        amount: Math.round(per * 100) / 100,
        vacantForPoolBefore: vacant,
        capitalAfter: Math.round(capital * 100) / 100,
        openPositions: positions.length,
        pendingSpecialSlots: pendingSpecial.length,
      })

      if (!dayBuyRepeat) break
    }
  }

  const history = []

  historyDays.forEach((item, index) => {
    const dateStr = item.date
    const d = new Date(dateStr)

    // 1) 60 天到期：整檔出場（原始 + 加碼）
    for (let i = positions.length - 1; i >= 0; i--) {
      const pos = positions[i]
      const sell60 = new Date(formatDate(pos.stock.sellDay60))
      if (d >= sell60) {
        const v = exitValueAt60({
          initialC: pos.initialC,
          r60: pos.stock.r60,
          buyPrice30: pos.stock.buyPrice30,
          sellPrice60: pos.stock.sellPrice60,
          addOns: pos.addOns,
        })
        capital += v
        timeline.push({
          date: dateStr,
          type: 'EXIT_60',
          positionId: pos.id,
          name: pos.stock.name,
          code: pos.stock.code,
          sellDay60: pos.stock.sellDay60,
          proceeds: Math.round(v * 100) / 100,
          initialC: Math.round(pos.initialC * 100) / 100,
          addOnsSum: Math.round(pos.addOns.reduce((s, x) => s + x, 0) * 100) / 100,
          capitalAfter: Math.round(capital * 100) / 100,
        })
        positions.splice(i, 1)
      }
    }

    // 2) 30 天檢查（僅一次）
    for (let pi = positions.length - 1; pi >= 0; pi--) {
      const pos = positions[pi]
      if (pos.handled30) continue
      const sell30 = new Date(formatDate(pos.stock.sellDay30))
      if (d < sell30) continue
      pos.handled30 = true
      if (pos.stock.r30 < 0) {
        const proceeds = exitValueAt30Loser({
          initialC: pos.initialC,
          r30: pos.stock.r30,
        })
        capital += proceeds
        pendingSpecial.push(proceeds)
        timeline.push({
          date: dateStr,
          type: 'STOP_30',
          positionId: pos.id,
          name: pos.stock.name,
          code: pos.stock.code,
          sellDay30: pos.stock.sellDay30,
          r30: pos.stock.r30,
          proceeds: Math.round(proceeds * 100) / 100,
          pendingSpecialQueueLen: pendingSpecial.length,
          capitalAfter: Math.round(capital * 100) / 100,
        })
        positions.splice(pi, 1)
      }
    }

    // 3) 特殊資金加碼到 r30>0 的已持倉（均分）
    runPyramid(dateStr)

    // 4) 選股池補滿（受「特殊空位」限制）
    tryPoolBuys(dateStr)

    // 模擬區間最後一日：剩餘持倉以 60 天規則估值並平倉（與 monteCarlo 結尾一致）
    if (index === historyDays.length - 1) {
      for (let li = positions.length - 1; li >= 0; li--) {
        const pos = positions[li]
        const v = exitValueAt60({
          initialC: pos.initialC,
          r60: pos.stock.r60,
          buyPrice30: pos.stock.buyPrice30,
          sellPrice60: pos.stock.sellPrice60,
          addOns: pos.addOns,
        })
        capital += v
        timeline.push({
          date: dateStr,
          type: 'FORCE_EXIT_60',
          note: '模擬區間最後一日強制平倉',
          positionId: pos.id,
          name: pos.stock.name,
          code: pos.stock.code,
          proceeds: Math.round(v * 100) / 100,
          capitalAfter: Math.round(capital * 100) / 100,
        })
      }
      positions = []
    }

    const pc = positions.reduce((s, p) => s + positionCost(p), 0)
    const net = capital + pc
    history.push({
      date: dateStr,
      capital,
      netAsset: net,
      returnRate: (net / initialCapital - 1) * 100,
      positionCount: positions.length,
      pendingSpecialSlots: pendingSpecial.length,
    })
  })

  const finalReturn = (capital / initialCapital - 1) * 100
  const maxDrawdown = calculateMaxDrawdown(history) * 100
  const { mean, median, worst, best, annualReturnsLog } = calculateAnnualReturn(history)

  if (trace) {
    console.log('[政策模擬] 時間軸交易紀錄（依處理順序：當日先 EXIT_60 → STOP_30 → PYRAMID → BUY_POOL，最後一日末尾 FORCE_EXIT_60）', timeline)
    console.table(
      timeline.map((e) => ({
        date: e.date,
        type: e.type,
        positionId: e.positionId ?? '—',
        name: e.name ?? '—',
        detail:
          e.type === 'BUY_POOL'
            ? `金額 ${e.amount}`
            : e.type === 'PYRAMID'
              ? `均分 ${e.perWinner} → ${e.winnerCount} 檔`
              : e.type === 'STOP_30'
                ? `r30=${e.r30} 入隊 ${e.pendingSpecialQueueLen}`
                : e.type === 'EXIT_60' || e.type === 'FORCE_EXIT_60'
                  ? `收回 ${e.proceeds}`
                  : '—',
      }))
    )
  }

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
    timeline,
  }
}
