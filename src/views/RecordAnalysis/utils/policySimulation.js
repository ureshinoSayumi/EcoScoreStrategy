/**
 * 自訂政策：最多 N 檔；30 天若 r30<0 則出場，該資金列為「特殊空位」不得買入選股池，
 * 須加碼到「當日已通過 30 天且 r30>0」的持倉；加碼視為在 30 天價位投入，60 天出場以 sellPrice_60 / sellPrice_30 換算（缺價時用 (1+r60)/(1+r30)）。
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

/**
 * 特殊空位加碼視為在「30 天出場價」投入（與進場 buyPrice30 無關，因兩檔 CSV 進場價常相同）。
 * 60 天變現倍率優先 sellPrice60 / sellPrice30；缺價時用全期報酬還原 30→60 段：(1+r60)/(1+r30)。
 */
function pyramidAddonExitMultiplier(pos) {
  const sp30 = Number(pos.sellPrice30)
  const sp60 = Number(pos.sellPrice60)
  if (Number.isFinite(sp30) && sp30 > 0 && Number.isFinite(sp60) && sp60 > 0) {
    return sp60 / sp30
  }
  if (Number.isFinite(pos.r30) && Number.isFinite(pos.r60) && 1 + pos.r30 !== 0) {
    return (1 + pos.r60) / (1 + pos.r30)
  }
  return addonExitMultiplier(pos.buyPrice30, pos.sellPrice60, pos.r60)
}

function exitValueAt60(pos) {
  const mPyramid = pyramidAddonExitMultiplier(pos)
  let v
  if (Number.isFinite(pos.buyPrice30) && pos.buyPrice30 > 0 && Number.isFinite(pos.sellPrice60)) {
    v = pos.initialCapital * (pos.sellPrice60 / pos.buyPrice30)
  } else {
    v = pos.initialCapital * (1 + pos.r60)
  }
  for (const entry of pos.pyramidEntries) {
    v += entry.buyCost * mPyramid
  }
  return v
}

function exitValueAt30Loser(pos) {
  return pos.initialCapital * (1 + pos.r30)
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

/** 從進場日字串取西元年度 yyyy */
function buyYearFromTradeDay(buyDay) {
  const s = String(buyDay ?? '').trim()
  if (/^\d{4}/.test(s)) return s.slice(0, 4)
  const d = new Date(formatDate(s))
  return Number.isNaN(d.getTime()) ? '' : String(d.getFullYear())
}

/** 依進場年彙總持池 r60（小數），供年度表「平均／中位／勝率／筆數」 */
function poolR60StatsByBuyYear(tradeRows) {
  const byYear = {}
  for (const t of tradeRows) {
    const y = buyYearFromTradeDay(t.buyDay)
    if (!y) continue
    if (!byYear[y]) byYear[y] = []
    if (typeof t.r60 === 'number' && Number.isFinite(t.r60)) byYear[y].push(t.r60)
  }
  return byYear
}

function statsFromR60Decimals(arr) {
  if (!arr?.length) {
    return { count: 0, avgPct: null, medianPct: null, winRatePct: null }
  }
  const n = arr.length
  const avgPct = (arr.reduce((a, b) => a + b, 0) / n) * 100
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(n / 2)
  const medianDec = n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const medianPct = medianDec * 100
  const winRatePct = (arr.filter((r) => r > 0).length / n) * 100
  return { count: n, avgPct, medianPct, winRatePct }
}

/**
 * 與一般回測摘要表對齊：第一欄為模擬淨值在該曆年的漲跌％；其餘為持池依「進場年」之 r60 分布（小數轉％）。
 */
function buildAnnualDetailTable(annualReturnsLog, tradeRows) {
  const poolByYear = poolR60StatsByBuyYear(tradeRows)
  const portfolioByYear = {}
  for (const item of annualReturnsLog) {
    portfolioByYear[String(item.year)] = item.return
  }
  const years = [...new Set([...Object.keys(poolByYear), ...Object.keys(portfolioByYear)])].sort()
  return years.map((year) => {
    const s = statsFromR60Decimals(poolByYear[year])
    const pr = portfolioByYear[year]
    return {
      year,
      portfolioYearReturnPct: pr !== undefined ? pr : null,
      poolAvgReturnPct: s.count ? s.avgPct : null,
      poolMedianReturnPct: s.count ? s.medianPct : null,
      poolWinRatePct: s.count ? s.winRatePct : null,
      poolTradeCount: s.count,
    }
  })
}

function logPolicySimBacktestDetail(payload) {
  const { finalReturn, maxDrawdown, mean, median, worst, best, rotations, annualDetailTable } = payload
  console.log(
    [
      '【政策模擬】模擬回測詳情',
      `總報酬: ${Number(finalReturn).toFixed(2)}%`,
      `區間最大回撤: ${Number(maxDrawdown).toFixed(2)}%`,
      `年度平均報酬: ${Number(mean).toFixed(2)}%`,
      `年度中位數報酬: ${Number(median).toFixed(2)}%`,
      `最佳／最差年度: ${Number(best).toFixed(2)}%／${Number(worst).toFixed(2)}%`,
      `輪動次數: ${rotations}`,
      '表格：淨值年度報酬／持池 r60 平均／中位／勝率／筆數（依進場年）',
    ].join('\n')
  )
  const tableRows = annualDetailTable.map((row) => ({
    年度: row.year,
    淨值年度報酬: row.portfolioYearReturnPct != null ? `${row.portfolioYearReturnPct.toFixed(2)}%` : '—',
    平均: row.poolAvgReturnPct != null ? `${row.poolAvgReturnPct.toFixed(2)}%` : '—',
    中位: row.poolMedianReturnPct != null ? `${row.poolMedianReturnPct.toFixed(2)}%` : '—',
    勝率: row.poolWinRatePct != null ? `${row.poolWinRatePct.toFixed(2)}%` : '—',
    筆數: row.poolTradeCount,
  }))
  console.table(tableRows)
}

/**
 * @param {Array<Object>} tradeRows 已篩選之交易列（name, code, buyDay, sellDay30, sellDay60, r30, r60, buyPrice30, sellPrice30, sellPrice60）
 * @param {Object} [opts]
 * @param {boolean} [opts.trace=true] 為 true 時 `console.log` / `console.table` 輸出時間軸；並在回傳值附 `timeline`
 */
export function calculatePolicyPyramidSimulation(tradeRows, opts = {}) {
  const initialCapital = opts.initialCapital ?? 10000
  const maxPositions = opts.maxPositions ?? 10
  const maxSpecialSlots = Math.max(0, Math.floor(opts.maxSpecialSlots ?? maxPositions))
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
      annualDetailTable: [],
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
  /** @type {Array<{ name:string, code:string, buyDay:string, sellDay30:string, sellDay60:string, r30:number, r60:number, buyPrice30:number, sellPrice30:number, sellPrice60:number, initialCapital:number, pyramidEntries:Array<object>, sell30DateMs:number }>} */
  let positions = []
  /** 30 天停損釋出的特殊空位資金（未加碼前會留在此佇列，附來源明細方便追蹤） */
  const pendingSpecialSlots = []
  let rotations = 0
  let nextSpecialSlotId = 1
  /** @type {Array<Record<string, unknown>>} */
  const timeline = []

  /** 單一持倉成本（原始本金 + 所有特殊空位加碼） */
  function positionCost(pos) {
    return pos.initialCapital + pos.pyramidEntries.reduce((sum, entry) => sum + entry.buyCost, 0)
  }

  function vacantForPool() {
    return maxPositions - positions.length - pendingSpecialSlots.length
  }

  function runPyramid(dateStr) {
    const currentDateMs = new Date(dateStr).getTime()
    const winners = positions.filter((p) => currentDateMs >= p.sell30DateMs && p.r30 > 0)
    if (!winners.length || !pendingSpecialSlots.length) return
    const total = pendingSpecialSlots.reduce((sum, slot) => sum + slot.amount, 0)
    const share = total / winners.length
    for (const w of winners) {
      capital -= share
      const sp30 = Number(w.sellPrice30)
      const sp60 = Number(w.sellPrice60)
      const buyPrice = Number.isFinite(sp30) && sp30 > 0 ? sp30 : null
      const returnRate =
        Number.isFinite(sp30) && sp30 > 0 && Number.isFinite(sp60)
          ? (sp60 - sp30) / sp30
          : null
      const buyCost = share
      const mPyramid = pyramidAddonExitMultiplier(w)
      const sellMarketValueRaw =
        returnRate != null && Number.isFinite(returnRate)
          ? buyCost * (1 + returnRate)
          : buyCost * mPyramid
      const sellMarketValue = Math.round(sellMarketValueRaw * 100) / 100
      w.pyramidEntries.push({
        buyPrice,
        returnRate,
        buyCost,
        sellMarketValue,
        buyDate: dateStr,
      })
    }
    timeline.push({
      date: dateStr,
      type: 'PYRAMID',
      totalDistributed: Math.round(total * 100) / 100,
      perWinner: Math.round(share * 100) / 100,
      winnerCount: winners.length,
      winners: winners.map((w) => {
        const e = w.pyramidEntries[w.pyramidEntries.length - 1]
        return {
          name: w.name,
          code: w.code,
          buyPrice: e?.buyPrice ?? null,
          returnRate: e?.returnRate ?? null,
          buyCost: e?.buyCost ?? null,
          sellMarketValue: e?.sellMarketValue ?? null,
          buyDate: e?.buyDate ?? null,
        }
      }),
      sourceSpecialSlots: pendingSpecialSlots.map((slot) => ({
        specialSlotId: slot.id,
        sourceName: slot.sourceName,
        sourceCode: slot.sourceCode,
        sourceBuyDay: slot.sourceBuyDay,
        amount: Math.round(slot.amount * 100) / 100,
      })),
    })
    pendingSpecialSlots.length = 0
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
        stock = today.find((s) => !positions.some((p) => p.name === s.name)) ?? null
      }
      if (!stock) break

      const per = capital / vacant
      if (per <= 0) break

      capital -= per
      positions.push({
        ...stock,
        initialCapital: per,
        pyramidEntries: [],
        // 建倉時就固定定義 30 天檢查點，後續只做日期比較，不再改動狀態欄位
        sell30DateMs: new Date(formatDate(stock.sellDay30)).getTime(),
      })
      rotations += 1
      timeline.push({
        date: dateStr,
        type: 'BUY_POOL',
        name: stock.name,
        code: stock.code,
        buyDaySignal: stock.buyDay,
        amount: Math.round(per * 100) / 100,
        vacantForPoolBefore: vacant,
        capitalAfter: Math.round(capital * 100) / 100,
        openPositions: positions.length,
        pendingSpecialSlots: pendingSpecialSlots.length,
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
      const sell60 = new Date(formatDate(pos.sellDay60))
      if (d >= sell60) {
        const v = exitValueAt60({
          initialCapital: pos.initialCapital,
          r30: pos.r30,
          r60: pos.r60,
          buyPrice30: pos.buyPrice30,
          sellPrice30: pos.sellPrice30,
          sellPrice60: pos.sellPrice60,
          pyramidEntries: pos.pyramidEntries,
        })
        capital += v
        timeline.push({
          date: dateStr,
          type: 'EXIT_60',
          name: pos.name,
          code: pos.code,
          sellDay60: pos.sellDay60,
          proceeds: Math.round(v * 100) / 100,
          initialCapital: Math.round(pos.initialCapital * 100) / 100,
          pyramidAmountSum:
            Math.round(pos.pyramidEntries.reduce((sum, entry) => sum + entry.buyCost, 0) * 100) / 100,
          capitalAfter: Math.round(capital * 100) / 100,
        })
        positions.splice(i, 1)
      }
    }

    // 2) 30 天檢查（僅一次）
    for (let pi = positions.length - 1; pi >= 0; pi--) {
      const pos = positions[pi]
      if (d.getTime() < pos.sell30DateMs) continue
      if (pos.r30 < 0) {
        const proceeds = exitValueAt30Loser({
          initialCapital: pos.initialCapital,
          r30: pos.r30,
        })
        capital += proceeds
        pendingSpecialSlots.push({
          id: nextSpecialSlotId++,
          date: dateStr,
          sourceName: pos.name,
          sourceCode: pos.code,
          sourceBuyDay: pos.buyDay,
          sourceR30: pos.r30,
          amount: proceeds,
        })
        let queuedAsSpecial = true
        if (pendingSpecialSlots.length > maxSpecialSlots) {
          pendingSpecialSlots.pop()
          queuedAsSpecial = false
        }
        timeline.push({
          date: dateStr,
          type: 'STOP_30',
          name: pos.name,
          code: pos.code,
          sellDay30: pos.sellDay30,
          r30: pos.r30,
          proceeds: Math.round(proceeds * 100) / 100,
          queuedAsSpecial,
          maxSpecialSlots,
          pendingSpecialQueueLen: pendingSpecialSlots.length,
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
          initialCapital: pos.initialCapital,
          r30: pos.r30,
          r60: pos.r60,
          buyPrice30: pos.buyPrice30,
          sellPrice30: pos.sellPrice30,
          sellPrice60: pos.sellPrice60,
          pyramidEntries: pos.pyramidEntries,
        })
        capital += v
        timeline.push({
          date: dateStr,
          type: 'FORCE_EXIT_60',
          note: '模擬區間最後一日強制平倉',
          name: pos.name,
          code: pos.code,
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
      positions: JSON.parse(JSON.stringify(positions)),
      pendingSpecialSlots: JSON.parse(JSON.stringify(pendingSpecialSlots)),
      eligiblePyramidTargets: positions
        .filter((p) => d.getTime() >= p.sell30DateMs && p.r30 > 0)
        .map((p) => ({
          name: p.name,
          code: p.code,
          buyDay: p.buyDay,
          r30: p.r30,
          buyPrice30: p.buyPrice30,
        })),
      capital,
      netAsset: net,
      returnRate: (net / initialCapital - 1) * 100,
      positionCount: positions.length,
      pendingSpecialSlotCount: pendingSpecialSlots.length,
    })
  })

  const finalReturn = (capital / initialCapital - 1) * 100
  const maxDrawdown = calculateMaxDrawdown(history) * 100
  const { mean, median, worst, best, annualReturnsLog } = calculateAnnualReturn(history)
  const annualDetailTable = buildAnnualDetailTable(annualReturnsLog, rows)

  if (trace) {
    logPolicySimBacktestDetail({
      finalReturn,
      maxDrawdown,
      mean,
      median,
      worst,
      best,
      rotations,
      annualDetailTable,
    })
    console.log('timeline', timeline)
    console.log('history', history)
    console.log('[政策模擬] 每日淨值與持倉快照', history)
    // console.table(
    //   timeline.map((e) => ({
    //     date: e.date,
    //     type: e.type,
    //     symbol: `${e.name ?? '—'} ${e.code ?? ''}`,
    //     name: e.name ?? '—',
    //     detail:
    //       e.type === 'BUY_POOL'
    //         ? `金額 ${e.amount}`
    //         : e.type === 'PYRAMID'
    //           ? `均分 ${e.perWinner} → ${e.winnerCount} 檔`
    //           : e.type === 'STOP_30'
    //             ? `r30=${e.r30} 入隊 ${e.pendingSpecialQueueLen}`
    //             : e.type === 'EXIT_60' || e.type === 'FORCE_EXIT_60'
    //               ? `收回 ${e.proceeds}`
    //               : '—',
    //   }))
    // )
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
    annualDetailTable,
    history,
    timeline,
  }
}
