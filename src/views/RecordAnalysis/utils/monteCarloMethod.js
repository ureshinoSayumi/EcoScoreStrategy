// 蒙地卡羅模擬
export const runMonteCarlo = (data, iterations = 1000, initialCapital = 10000, positions = 10) => {
  const returns = []
  const drawdowns = []

  for (let i = 0; i < iterations; i++) {
    const shuffledData = shuffleReturns(data)
    const result = calculateSimulationResult(shuffledData, initialCapital, positions)
    returns.push(result.finalReturn)
    drawdowns.push(result.maxDrawdown)
  }

  // 共用的統計函式
  function summarize(values, label) {
    values.sort((a, b) => a - b)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const median = values.length % 2 === 0
      ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
      : values[Math.floor(values.length / 2)]
    const worst = values[0]
    const best = values[values.length - 1]

    const freq = {}
    values.forEach(v => {
      const key = v.toFixed(1) // 四捨五入到小數點1位
      freq[key] = (freq[key] || 0) + 1
    })
    const mostCommon = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]

    console.log(`📊 ${label} 統計`)
    console.log("平均:", mean.toFixed(2) + "%")
    console.log("中位數:", median.toFixed(2) + "%")
    console.log("最差:", worst.toFixed(2) + "%")
    console.log("最佳:", best.toFixed(2) + "%")
    console.log("最常發生:", mostCommon + "%")

    return { mean, median, worst, best, mostCommon }
  }

  console.log("📊 Monte Carlo 模擬結果")
  console.log("樣本數:", iterations)

  const returnStats = summarize(returns, "最終報酬率")
  const ddStats = summarize(drawdowns, "最大回撤")

  return { returns, drawdowns, returnStats, ddStats }
}

export const shuffleArray = (array) => {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export const shuffleReturns = (data) => {
  const returns = data.map(item => item.return)
  const shuffled = shuffleArray(returns)
  return data.map((item, idx) => ({
    ...item,
    return: shuffled[idx] // 保留原時間，只替換 return
  }))
}

export const calculateSimulationResult = (data, initialCapital = 10000, maxPositions = 10, isRepeat = true) => {
  const getDate = (str) => new Date(str.replaceAll('/', '-'))

  let capital = initialCapital
  let positions = [] // { stock, buyDate, sellDate, capitalUsed }
  const history = []
  const positionsMap = {}

  // 照 buyDay 排序
  const sorted = data
    .filter(i =>
      i.buyDay && i.sellDay &&
      !isNaN(parseFloat(i.return))
    )
    .sort((a, b) => getDate(a.buyDay) - getDate(b.buyDay))

  sorted.forEach(stock => {
    const buyDate = getDate(stock.buyDay)
    const sellDate = getDate(stock.sellDay)

    // 檢查已到期部位，結算
    for (let i = positions.length - 1; i >= 0; i--) {
      if (buyDate >= positions[i].sellDate) {
        const pos = positions[i]
        const r = parseFloat(pos.stock.return)
        const profit = !isNaN(r)
          ? pos.capitalUsed * (1 + r)
          : pos.capitalUsed
        capital += profit
        positions.splice(i, 1)
      }
    }

    // 若倉位未滿，進場
    if (positions.length < maxPositions) {
      const vacant = maxPositions - positions.length
      const capitalPerStock = capital / vacant
      if (capitalPerStock <= 0) return

      // 是否允許重複進場
      if (isRepeat) {
        capital -= capitalPerStock
        positions.push({
          stock,
          buyDate,
          sellDate,
          capitalUsed: capitalPerStock
        })
        const positionCost = positions.reduce((sum, p) => sum + p.capitalUsed, 0)
        const netAsset = capital + positionCost

        history.push({
          buyDay: stock.buyDay,
          sellDay: stock.sellDay,
          name: stock.name,
          // return: (parseFloat(stock.return) * 100).toFixed(2) + '%',
          return: parseFloat(stock.return),
          capital: capital,
          positionCount: positions.length,
          netAsset,
          // returnRate: ((netAsset / initialCapital - 1) * 100).toFixed(2) // 總報酬率
          returnRate: (netAsset / initialCapital - 1) * 100 // 總報酬率
        })
      } else {
        if (!positions.some(p => p.stock.name === stock.name)) {
          capital -= capitalPerStock
          positions.push({
            stock,
            buyDate,
            sellDate,
            capitalUsed: capitalPerStock
          })
          const positionCost = positions.reduce((sum, p) => sum + p.capitalUsed, 0)
          const netAsset = capital + positionCost

          history.push({
            buyDay: stock.buyDay,
            sellDay: stock.sellDay,
            name: stock.name,
            // return: (parseFloat(stock.return) * 100).toFixed(2) + '%',
            return: parseFloat(stock.return),
            capital: capital,
            positionCount: positions.length,
            netAsset,
            // returnRate: ((netAsset / initialCapital - 1) * 100).toFixed(2) // 總報酬率
            returnRate: (netAsset / initialCapital - 1) * 100 // 總報酬率
          })
        }
      }


    }
    //
    // 計算 positions 去掉重複後，每個持倉次數的出現次數
    const uniquePositions = [...new Set(positions.map(p => p.stock.name))]
    if (!positionsMap[uniquePositions.length]) {
      positionsMap[uniquePositions.length] = 1
    }
    positionsMap[uniquePositions.length] += 1
  })

  // 出清剩餘倉位
  positions.forEach(pos => {
    const r = parseFloat(pos.stock.return)
    const profit = !isNaN(r)
      ? pos.capitalUsed * (1 + r)
      : pos.capitalUsed
    capital += profit
  })

  const finalReturn = ((capital / initialCapital - 1) * 100)
  // const finalReturn = ((capital / initialCapital - 1) * 100).toFixed(2)


  // ✅ 最大回撤
  let maxAsset = parseFloat(history[0]?.netAsset || 0)
  let maxDrawdown = 0
  let sdate = ''
  let edate = ''
  const sdateArr = []
  const edateArr = []

  history.forEach(h => {
    const net = parseFloat(h.netAsset)
    if (net > maxAsset) {
      maxAsset = net
      edate = h.buyDay
      edateArr.push(edate)
    }
    const dd = (maxAsset - net) / maxAsset
    if (dd > maxDrawdown) {
      maxDrawdown = dd
      sdate = h.sellDay
      sdateArr.push(sdate)
    }
  })

  // ✅ 年化報酬率統計
  const annualReturnMap = {}
  history.forEach(h => {
    const year = new Date(h.buyDay).getFullYear()
    if (!annualReturnMap[year]) annualReturnMap[year] = []
    annualReturnMap[year].push(h)
  })

  const annualReturns = []
  const annualReturnsLog = []

  for (const year in annualReturnMap) {
    const records = annualReturnMap[year].sort((a, b) => new Date(a.buyDay) - new Date(b.buyDay))
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
    ? (sorted2.length % 2 === 0
      ? (sorted2[mid - 1] + sorted2[mid]) / 2
      : sorted2[mid])
    : 0

  const worst = sorted2[0] ?? 0
  const best = sorted2[sorted2.length - 1] ?? 0

  // console.log(`📊 模擬結果：最多同時持有 ${maxPositions} 檔（等權重）`)
  // console.log('✅ 初始資金：$', initialCapital)
  // console.log('✅ 最終資金：$', capital.toFixed(2))
  // console.log('✅ 總報酬率：', finalReturn + '%')
  // console.log('✅ 最大回撤:', (maxDrawdown * 100).toFixed(2) + '%')
  // console.log('✅ 年度平均報酬率:', mean.toFixed(2) + '%')
  // console.log('✅ 年度中位數報酬率:', median.toFixed(2) + '%')
  // console.log('✅ 最差年度報酬率:', worst.toFixed(2) + '%')
  // console.log('✅ 最佳年度報酬率:', best.toFixed(2) + '%')
  // console.log('年度報酬', annualReturnsLog);

  // console.log('輪動次數', history.length);


  console.log(history)
  // 把 positionsMap 全部加起來
  const totalPositions = Object.values(positionsMap).reduce((a, b) => a + b, 0)
  console.log('totalPositions', totalPositions)
  // 計算 positionsMap 的平均值
  for (const key in positionsMap) {
    positionsMap[key] += `/ ${((positionsMap[key] / totalPositions) * 100).toFixed(2)}%`
  }
  console.log('positionsMap', positionsMap)


  // console.log('sdate', sdate);
  // console.log('edate', edate);
  // console.log('sdateArr', sdateArr);
  // console.log('edateArr', edateArr);

  return {
    finalReturn, // 總報酬率
    // maxDrawdown: (maxDrawdown * 100).toFixed(2), // 區間最大回徹
    maxDrawdown: maxDrawdown * 100, // 區間最大回徹
    rotations: history.length, // 輪動次數
    mean, // 年度平均報酬率
    median, // 年度中位數報酬率
    worst, // 最差年度報酬率
    best, // 最佳年度報酬率
    annualReturnsLog: annualReturnsLog, // 年度報酬率紀錄
    history, // 歷史資料
  }
}

export const calculateSimulationResult2 = (tradeLog, initialCapital = 10000, maxPositions = 10, isRepeat = true) => {
  // 把日期格式轉換成 YYYY-MM-DD
  const formatDate = (str) => str.replaceAll('/', '-')

  // 建立歷史日期
  function genDateRange(startDate, endDate) {
    const result = [];
    // 將傳入日期轉成 Date
    let current = new Date(startDate);
    if (isNaN(current)) throw new Error("無效日期格式");
    // 今天日期（只取到 YYYY-MM-DD，不含時間）
    const today = new Date(endDate);
    today.setHours(0, 0, 0, 0);
    while (current <= today) {
      // 轉成 YYYY-MM-DD
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      result.push({
        date: `${yyyy}-${mm}-${dd}`
      });
      // 加一天
      current.setDate(current.getDate() + 1);
    }
    return result;
  }

  // 整理輸入資料，照 buyDay 排序
  tradeLog = tradeLog
    .filter(i =>
      i.buyDay && i.sellDay &&
      !isNaN(parseFloat(i.return))
    )
    .sort((a, b) => new Date(formatDate(a.buyDay)) - new Date(formatDate(b.buyDay)))
  // 如果交易紀錄為空，則回傳空物件
  if (!tradeLog.length) {
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
    }
  }

  const startDate = formatDate(tradeLog[0].buyDay) // 開始日期
  const endDate = formatDate(tradeLog[tradeLog.length - 1].buyDay) // 結束日期
  const history = genDateRange(startDate, endDate) // 生成歷史日期區間

  // 用日期當key建立交易紀錄map表
  const tradeLogMap = new Map();
  tradeLog.forEach(item => {
    if (!tradeLogMap.has(formatDate(item.buyDay))) {
      tradeLogMap.set(formatDate(item.buyDay), []);
    }
    tradeLogMap.get(formatDate(item.buyDay)).push(item);

  });


  let capital = initialCapital // 初始資金
  let positions = [] // 持倉紀錄 { stock, buyDate, sellDate, capitalUsed }
  let rotations = 0 // 輪動次數
  let todayTradeLog = [] // 當天交易紀錄

  // 開始模擬歷史日期滾動
  history.forEach((item, index) => {
    // 檢查已到期部位，結算
    for (let i = positions.length - 1; i >= 0; i--) {
      const date = new Date(item.date)
      const sellDate = new Date(formatDate(positions[i].sellDay))
      if (date >= sellDate) {
        const pos = positions[i]
        const r = parseFloat(pos.return)
        const profit = !isNaN(r)
          ? pos.capitalUsed * (1 + r)
          : pos.capitalUsed
        capital += profit
        positions.splice(i, 1)
      }
    }

    // 若倉位未滿，進場
    if (positions.length < maxPositions) {
      const vacant = maxPositions - positions.length // 空倉數量 = 最大持倉數量 - 目前持倉數量
      const capitalPerStock = capital / vacant // 每倉位資金 = 總資金 / 空倉數量

      // 從交易紀錄map取得今日交易紀錄
      todayTradeLog = tradeLogMap.get(item.date)
      if (todayTradeLog?.length) {

        if (isRepeat) {
          const stock = todayTradeLog[0]
          // 隨機陣列中的一筆
          // const randomIndex = Math.floor(Math.random() * todayTradeLog.length)
          capital -= capitalPerStock
          positions.push({
            ...stock,
            capitalUsed: capitalPerStock
          })
          rotations++
        } else {
          // 找出今天第一檔「尚未持有」的股票
          const stock = todayTradeLog.find(s => !positions.some(p => p.name === s.name))

          if (stock) {
            capital -= capitalPerStock
            positions.push({
              ...stock,
              capitalUsed: capitalPerStock
            })
            rotations++
          }
        }
      }
    }

    // 最後一天的出清剩餘倉位，結算資料
    if (index === history.length - 1) {
      positions.forEach(pos => {
        const r = parseFloat(pos.return)
        const profit = !isNaN(r)
          ? pos.capitalUsed * (1 + r)
          : pos.capitalUsed
        capital += profit
      })
      positions = []
    }

    // 每日結算
    const positionCost = positions.reduce((sum, p) => sum + p.capitalUsed, 0) // 持倉成本
    const netAsset = capital + positionCost // 當天淨資產 = 當天資金 + 持倉成本

    item.positions = JSON.parse(JSON.stringify(positions)) // 持倉紀錄
    item.tradeLogMap = todayTradeLog ? JSON.parse(JSON.stringify(todayTradeLog)) : [] // 當天交易紀錄
    item.capital = capital // 當天資金
    item.netAsset = netAsset // 當天淨資產
    item.returnRate = (netAsset / initialCapital - 1) * 100 // 當天報酬率
    item.positionCount = positions.length // 當天持倉數
  })


  // 統計總報酬
  const finalReturn = ((capital / initialCapital - 1) * 100)

  // ✅ 最大回撤
  let maxAsset = parseFloat(history[0]?.netAsset || 0)
  let maxDrawdown = 0
  let sdate = ''
  let edate = ''
  const sdateArr = []
  const edateArr = []

  history.forEach(h => {
    const net = parseFloat(h.netAsset)
    if (net > maxAsset) {
      maxAsset = net
      edate = h.date
      edateArr.push(edate)
    }
    const dd = (maxAsset - net) / maxAsset
    if (dd > maxDrawdown) {
      maxDrawdown = dd
      sdate = h.date
      sdateArr.push(sdate)
    }
  })

  // ✅ 年化報酬率統計
  const annualReturnMap = {}
  history.forEach(h => {
    const year = new Date(h.date).getFullYear()
    if (!annualReturnMap[year]) annualReturnMap[year] = []
    annualReturnMap[year].push(h)
  })
  console.log('annualReturnMap', annualReturnMap)
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
    ? (sorted2.length % 2 === 0
      ? (sorted2[mid - 1] + sorted2[mid]) / 2
      : sorted2[mid])
    : 0

  const worst = sorted2[0] ?? 0
  const best = sorted2[sorted2.length - 1] ?? 0

  console.log('history', history)
  return {
    finalReturn, // 總報酬率
    maxDrawdown: maxDrawdown * 100, // 區間最大回徹
    rotations, // 輪動次數
    mean, // 年度平均報酬率
    median, // 年度中位數報酬率
    worst, // 最差年度報酬率
    best, // 最佳年度報酬率
    annualReturnsLog: annualReturnsLog, // 年度報酬率紀錄
    history, // 歷史資料
  }
}
