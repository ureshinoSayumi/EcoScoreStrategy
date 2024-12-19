import { splitData, calculateMA } from '@/utils/ECharts.js'

// 均線買入

// 1.買入策略 2.歷史股價區間 3.歷史股價
export const technicalAnalysisStrategy = (
  myStockInfo,
  historStock,
  stock0050_20100104_20241209,
) => {
  const initData = splitData(JSON.parse(JSON.stringify(stock0050_20100104_20241209)))
  const data = splitData(JSON.parse(JSON.stringify(historStock)))
  console.log('initData', initData)
  console.log('data', data)

  // 均線
  const ma5List = calculateMA(5, initData.values)
  const ma20List = calculateMA(20, initData.values)
  const ma60List = calculateMA(60, initData.values)
  const ma120List = calculateMA(120, initData.values)
  const ma240List = calculateMA(240, initData.values)

  // console.log('data', data)
  // console.log('ma5List', ma5List)
  let listData = []
  for (let i = 0; i < initData.categoryData.length; i++) {
    listData.push({
      date: initData.categoryData[i],
      price: initData.values[i], // 取 開盤價, 收盤價, 最低價, 最高價
      ma5: ma5List[i],
      ma20: ma20List[i],
      ma60: ma60List[i],
      ma120: ma120List[i],
      ma240: ma240List[i],
    })
  }
  const start = initData.categoryData.findIndex((item) => {
    return item === data.categoryData[0]
  })
  const end = initData.categoryData.findIndex((item) => {
    return item === data.categoryData[data.categoryData.length - 1]
  })
  console.log('start', start, data.categoryData[start])
  console.log('end', end, data.categoryData[end])
  // console.log('listData', listData)
  listData = listData.slice(start, end + 1)

  console.log('listData', listData)

  listData.forEach((item) => {
    myStockInfo.currentMoney += myStockInfo.eachSaveMoney // 錢包加上每月收入

    let buyPrice = 0 // 本月買入金額
    let sellPrice = 0 // 本月賣出金額

    const isMa20Top = item.price[1] >= item.ma20 // 收盤價是否站上60均線
    const isMa60Top = item.price[1] >= item.ma60 // 收盤價是否站上60均線
    const isMa120Top = item.price[1] >= item.ma120 // 收盤價是否站上120均線
    const isMa240Top = item.price[1] >= item.ma240 // 收盤價是否站上240均線
    if (isMa240Top) {
      // 買入
      if (myStockInfo.status === 0) {
        buyPrice = myStockInfo.currentMoney
        myStockInfo.currentMoney = 0 // 錢包扣掉這輪的買入金額
        const stockCount = buyPrice / item.price[1] // 買入股數
        myStockInfo.totalStockCount += stockCount // 總買入股數
        myStockInfo.totalBuyingAmount += buyPrice // 總買入成本
        myStockInfo.buyingCount += 1 // 買入數+1
        myStockInfo.status = 1 // 已買入
        console.log('買入', item.date, item.price[1])
      }
    } else {
      // 賣出
      if (myStockInfo.status === 1) {
        sellPrice = myStockInfo.totalStockCount * item.price[1]
        myStockInfo.currentMoney = myStockInfo.totalStockCount * item.price[1] // 錢包加上賣出股票金額
        myStockInfo.totalStockCount = 0 // 總買入股數
        myStockInfo.totalBuyingAmount = 0 // 總買入成本
        myStockInfo.sallCount += 1 // 賣出數+1
        myStockInfo.status = 0 // 已賣出
        console.log('賣出', item.date, item.price[1])
      }
    }

    // 記錄log
    myStockInfo.log.push({
      priceDate: item.date, // 本輪日期
      price: item.price[1], // 本輪股價
      ma20: item.ma20,
      ma60: item.ma60,
      ma120: item.ma120,
      ma240: item.ma240,
      buyPrice: buyPrice || 0, // 本輪買入金額
      sellPrice: sellPrice || 0, // 本輪賣出金額
      // totalBuyPrice: buyPrice, // 本輪總買入金額 = 本輪買入金額
      // totalBuyingAmount: myStockInfo.totalBuyingAmount, // 本輪累積買入金額
      buyStockCount: buyPrice / item.price[1] || 0, // 本輪買入股數 = (本輪買入金 + 本輪加碼金額) / 股價
      // totalStockCount: myStockInfo.totalStockCount, // 本輪累積買入股數
      currentMoney: myStockInfo.currentMoney, // 本輪本金
    })
  })

  // 計算統計資料
  myStockInfo.buyingAveragePrice = myStockInfo.totalBuyingAmount / myStockInfo.totalStockCount // 總買入成本 / 總買入股數 = 總買入平均價格
  // 取最後買入價格
  myStockInfo.totalMarketValue =
    myStockInfo.totalStockCount * listData[listData.length - 1].price[1] // 總市值 用最後一個收盤日
  return myStockInfo
}
