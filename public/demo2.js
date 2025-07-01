import { findBusinessSignalsIndex } from '../src/utils/calculateStock.js'
import { businessSignals } from '../src/utils/data/businessSignals.js'; // 景氣指標
import { historPmi } from '../src/utils/data/historPmi.js'
import { historStockMarket } from '../src/utils/data/historStockMarket.js'; // 歷史股價

/**
 * 依據丟入的歷史股價資訊進行策略買進
 * @param historStockPrice - 歷史股價資訊 [{ date: '2024-11', price: 186.15 }
 * @param myStockInfo - 買入策略
 {
  pmi: { index: 50, isOpen: false, dataList: historPmi }, // 買入策略-PMI index: 小於 50 買入, isOpen: true 打開 false 關閉, dataList: 歷史資料
  businessSignalA: { index: 100, isOpen: false, dataList: businessSignals }, // 買入策略-領先指標 index:小於 100 買入, isOpen: true 打開 false 關閉, dataList: 歷史資料
  businessSignalB: { index: 17, isOpen: false, dataList: businessSignals }, // 買入策略-景氣信號 index:: 小於 16 買入, isOpen: true 打開 false 關閉, dataList: 歷史資料
  strategyType: 1, // 使用哪種策略 1: 全部符合 2: 單一符合 3: 只用 PMI, 4: 只用領先指標, 5: 只用景氣信號

  // 買入金額
  currentMoney: 0, // 錢包 每個月如果沒買入，就把錢放入錢包，如果有初始金額也會放在這裡
  eachBuyingPercentage: 50, // 每次買入金額 (百分比)
  eachBuyingFixedAmount: 100, // 每月固定投入金額
  buyType: 1, // 買入規則 1.使用 eachBuyingPercentage 百分比 2.使用 eachBuyingFixedAmount 固定投入金額

  // 統計資料
  buyingCount: 0, // 買入次數
  totalStockCount: 0, // 總買入股數
  totalBuyingAmount: 0, // 總買入成本
  buyingAveragePrice: 0, // 總買入平均價格 = 總買入成本 / 總買入股數
  totalMarketValue: 0, // 總市值 用最後一個收盤日
  // 所有買入歷史紀錄
  log: [
    // {
    // priceDate: item.date, // 本輪日期
    // price: item.price, // 本輪股價
    // pmi: pmiData, // 本輪 pmi
    // businessSignalACase: businessSignal, // 本輪領先指標
    // businessSignalBCase: businessSignal, // 本輪景氣信號
    // buyPrice: buyPrice || 0, // 本輪買入金額
    // totalBuyingAmount: myStock.totalBuyingAmount, // 本輪累積買入金額
    // buyStockCount: buyPrice / item.price || 0, // 買入股數
    // totalStockCount: myStock.totalStockCount, // 本輪累積買入股數
    // currentMoneyp: myStockInfo.currentMoney, // 本輪本金
    // },
  ],
}
 * @returns - 回傳該筆資訊的物件
 */

// 景氣信號投資法
export const ecoScoreStrategy = (historStock, myStockInfo) => {
  // 排序
  historStock.sort((a, b) => new Date(a.date) - new Date(b.date)) // 日期由小到大排序

  historStock.forEach((item) => {
    myStockInfo.currentMoney += myStockInfo.eachSaveMoney // 錢包加上每月收入

    // 搜尋前一個月 PMI
    const pmiData = findBusinessSignalsIndex(myStockInfo.pmi.dataList, item.date) || {}
    // 搜尋前一個月領先指標、景氣信號
    const businessSignal =
      findBusinessSignalsIndex(myStockInfo.businessSignalA.dataList, item.date) || {}

    const pmiCase = pmiData.data < myStockInfo.pmi.index // pmi 條件
    const businessSignalACase = businessSignal.data < myStockInfo.businessSignalA.index // 領先指標條件
    const businessSignalBCase = businessSignal.data2 < myStockInfo.businessSignalB.index // 景氣信號條件
    let buyingAveragePrice = myStockInfo.totalBuyingAmount / myStockInfo.totalStockCount // 總買入成本 / 總買入股數 = 總買入平均價格
    const isLowBuyingAveragePrice = item.price < buyingAveragePrice

    let buyPrice = 0 // 本月買入金額
    let buyPricePlus = 0 // 定期不定額加碼金額

    // 買入計算
    function buyComputed(buyType) {
      // 判斷使用哪種買入規則 1.使用現有錢包百分比 2.每月固定投入
      switch (buyType) {
        case 0: // ˙定期定額
          buyPrice = myStockInfo.eachBuyingFixedAmount // 取固定投入金額
          break
        case 1: // ˙定期定額 + 定期不定額
          // 定期不定額加碼金額 = (錢包 - 每月固定投入金額) * 加碼百分比
          buyPricePlus =
            (myStockInfo.currentMoney - myStockInfo.eachBuyingFixedAmount) *
            (myStockInfo.eachBuyingPercentage / 100)
          // 本月買入金額 = 每月固定投入金額 + 加碼金額
          buyPrice = myStockInfo.eachBuyingFixedAmount
          break
        case 2: // 不定期不定額
          // 錢包 * 每次買入百分比
          buyPrice = myStockInfo.currentMoney * (myStockInfo.eachBuyingPercentage / 100) // 取百分比，例如 10 / 100 = 0.1%
          break
      }
      myStockInfo.currentMoney = myStockInfo.currentMoney - (buyPrice + buyPricePlus) // 錢包扣掉這輪的買入金額
      const stockCount = (buyPrice + buyPricePlus) / item.price // 買入股數
      myStockInfo.totalStockCount += stockCount // 總買入股數
      myStockInfo.totalBuyingAmount += buyPrice + buyPricePlus // 總買入成本
      myStockInfo.buyingCount += 1 // 買入數+1
      myStockInfo.buyingCountPlus += buyPricePlus ? 1 : 0 // 加碼次數
    }

    // 判斷使用哪種策略 0: 不使用策略每月買入 1: 全部符合 2: 單一符合 3: 只用 PMI, 4: 只用領先指標, 5: 只用景氣信號
    function strategySelection(strategyType) {
      let resultType = null
      switch (strategyType) {
        case 0:
          resultType = 0
          break
        case 1:
          if (pmiCase && businessSignalACase && businessSignalBCase) {
            resultType = 1
          }
          break
        case 2:
          if (pmiCase || businessSignalACase || businessSignalBCase) {
            resultType = 2
          }
          break
        case 3:
          if (pmiCase) {
            resultType = 3
          }
          break
        case 4:
          if (businessSignalACase) {
            resultType = 4
          }
          break
        case 5:
          if (businessSignalBCase) {
            resultType = 5
          }
          break
        case 6:
          if (isLowBuyingAveragePrice) {
            resultType = 6
          }
          break
      }
      return resultType
    }
    // 定期不定哦
    if (myStockInfo.buyType === 1) {
      // 有無符合指標
      const strategyType = strategySelection(myStockInfo.strategyType)
      // 不符合任何指標就定期定額
      if (strategyType === null) {
        buyComputed(0)
      } else {
        // 符合聽定指標就加碼
        buyComputed(1)
      }
    } else {
      // 判斷策略
      // strategyType === null 有用策略，但沒符合任何策略
      const strategyType = strategySelection(myStockInfo.strategyType)
      if (strategyType !== null) {
        buyComputed(myStockInfo.buyType)
      }
    }

    // 計算此輪平均買入成本
    buyingAveragePrice = myStockInfo.totalBuyingAmount / myStockInfo.totalStockCount // 總買入成本 / 總買入股數 = 總買入平均價格

    // 記錄log
    myStockInfo.log.push({
      priceDate: item.date, // 本輪日期
      price: item.price, // 本輪股價
      pmi: pmiData, // 本輪 pmi
      businessSignalACase: businessSignal, // 本輪領先指標
      businessSignalBCase: businessSignal, // 本輪景氣信號
      buyPrice: buyPrice || 0, // 本輪買入金額
      buyPricePlus: buyPricePlus || 0, // 本輪加碼金額
      totalBuyPrice: buyPrice + buyPricePlus, // 本輪總買入金額 = 本輪買入金額 + 本輪加碼金額
      totalBuyingAmount: myStockInfo.totalBuyingAmount, // 本輪累積買入金額
      buyStockCount: (buyPrice + buyPricePlus) / item.price || 0, // 本輪買入股數 = (本輪買入金 + 本輪加碼金額) / 股價
      totalStockCount: myStockInfo.totalStockCount, // 本輪累積買入股數
      currentMoney: myStockInfo.currentMoney, // 本輪本金
      buyingAveragePrice: buyingAveragePrice, // 買入成本
    })
  })

  // 計算最後統計資料
  myStockInfo.buyingAveragePrice = myStockInfo.totalBuyingAmount / myStockInfo.totalStockCount // 總買入成本 / 總買入股數 = 總買入平均價格
  // 取最後買入價格
  const latestData = historStock.length
    ? historStock.reduce((earliest, current) => {
      return new Date(current.date) > new Date(earliest.date) ? current : earliest
    })
    : {}
  myStockInfo.totalMarketValue = myStockInfo.totalStockCount * latestData.price // 總市值 用最後一個收盤日
  return myStockInfo
}

// 測試資料
// const historStockMarket = [
//   { date: '2024-04', price: 158.2 },
//   { date: '2024-05', price: 157.35 },
//   { date: '2024-06', price: 168.65 },
//   { date: '2024-07', price: 186.55 },
//   { date: '2024-08', price: 185 },
//   { date: '2024-09', price: 181.9 },
//   { date: '2024-10', price: 183.9 },
// ]
// const historPmi = [
//   { date: '2024-10', data: 49.4 },
//   { date: '2024-09', data: 47.9 },
//   { date: '2024-08', data: 50.1 },
//   { date: '2024-07', data: 48 },
//   { date: '2024-06', data: 50.8 },
//   { date: '2024-05', data: 51.8 },
//   { date: '2024-04', data: 47.1 },
// ]
// const businessSignals = [
//   { data: 99.35, data2: 22, date: '2024-10' },
//   { data: 98.35, data2: 15, date: '2024-09' },
//   { data: 103.35, data2: 9, date: '2024-08' },
//   { data: 100.35, data2: 30, date: '2024-07' },
//   { data: 101.35, data2: 32, date: '2024-06' },
//   { data: 103.35, data2: 40, date: '2024-05' },
//   { data: 98.35, data2: 28, date: '2024-04' },
// ]

const myStock = {
  pmi: { index: 50, dataList: historPmi }, // 買入策略-PMI index: 小於 50 買入, isOpen: true 打開 false 關閉, dataList: 歷史資料
  businessSignalA: { index: 100, dataList: businessSignals }, // 買入策略-領先指標 index:小於 100 買入, isOpen: true 打開 false 關閉, dataList: 歷史資料
  businessSignalB: { index: 17, dataList: businessSignals }, // 買入策略-景氣信號 index:: 小於 16 買入, isOpen: true 打開 false 關閉, dataList: 歷史資料
  // 使用哪種策略 0: 每月買入 1: 全部符合 2: 單一符合 3: 只用 PMI, 4: 只用領先指標, 5: 只用景氣信號 6: 平均成本
  strategyType: 3,

  // 買入金額
  currentMoney: 0, // 錢包 每個月如果沒買入，就把錢放入錢包，如果有初始金額也會放在這裡
  eachBuyingPercentage: 10, // 加碼百分比 (百分比)
  eachBuyingFixedAmount: 5000, // 每月固定投入金額
  eachSaveMoney: 10000, // 每月存入金額
  // 買入規則
  // 0 定期定額.使用 eachBuyingFixedAmount 固定投入金額
  // 1.定期不定額，低點加上加碼買入
  // 2.不定期不定額 使用 eachBuyingPercentage 百分比
  // 舊版
  // 1.不定期不定額 使用 eachBuyingPercentage 百分比
  // 2 定期定額.使用 eachBuyingFixedAmount 固定投入金額
  // 3.定期不定額，低點加上加碼買入
  buyType: 3,
  // 統計資料
  buyingCount: 0, // 買入次數
  buyingCountPlus: 0, // 加碼次數
  totalStockCount: 0, // 總買入股數
  totalBuyingAmount: 0, // 總買入成本
  buyingAveragePrice: 0, // 總買入平均價格 = 總買入成本 / 總買入股數
  totalMarketValue: 0, // 總市值 用最後一個收盤日
  // 所有買入歷史紀錄
  log: [
    // {
    // priceDate: item.date, // 本輪日期
    // price: item.price, // 本輪股價
    // pmi: pmiData, // 本輪 pmi
    // businessSignalACase: businessSignal, // 本輪領先指標
    // businessSignalBCase: businessSignal, // 本輪景氣信號
    // buyPrice: buyPrice || 0, // 本輪買入金額
    // totalBuyingAmount: myStock.totalBuyingAmount, // 本輪累積買入金額
    // buyStockCount: buyPrice / item.price || 0, // 買入股數
    // totalStockCount: myStock.totalStockCount, // 本輪累積買入股數
    // currentMoneyp: myStockInfo.currentMoney, // 本輪本金
    // },
  ],
}
ecoScoreStrategy(historStockMarket, myStock)

// console.log('log', myStock.log)
// console.log('當前存款', myStock.currentMoney)
// console.log('買入次數', myStock.buyingCount)
// console.log('加碼次數', myStock.buyingCountPlus)
// console.log('沒買入次數', historStockMarket.length - myStock.buyingCount)
// // console.log('沒買入次數', myStock.notBuyingCount)
// console.log('總買入成本', myStock.totalBuyingAmount)
// console.log('總買入股數', myStock.totalStockCount)
// console.log('總買入平均價格', myStock.buyingAveragePrice)
// console.log('總市值', myStock.totalMarketValue)
