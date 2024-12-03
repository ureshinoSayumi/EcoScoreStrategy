import { historStockMarket } from '../src/utils/data/historStockMarket.js' // 歷史股價
import { businessSignals } from '../src/utils/data/businessSignals.js' // 景氣指標
import { historPmi } from '../src/utils/data/historPmi.js'
import { findBusinessSignalsIndex } from '../src/utils/calculateStock.js'

const myStock = {
  currentMoney: 0, // 當前存款
  eachBuyingAmount: 100, // 每次買入金額
  buyingCount: 0, // 買入次數
  notBuyingCount: 0, // 沒買入次數
  totalStockCount: 0, // 總買入股數
  totalBuyingAmount: 0, // 總買入成本
  buyingAveragePrice: 0, // 總買入平均價格 = 總買入成本 / 總買入股數
  totalMarketValue: 0, // 總市值 用股價100代替
  log: [], // 歷史買入記錄
}

/**
 * 依據丟入的歷史股價資訊進行策略買進
 * @param historStockPrice - 歷史股價資訊 [{ date: '2024-11', price: 186.15 }
 * @param myStockInfo - 買入策略
 * {
 *    currentMoney: 0, // 錢包
      eachBuyingAmount: 100, // 每次買入金額
      buyingCount: 0, // 買入次數
      notBuyingCount: 0, // 沒買入次數
      totalStockCount: 0, // 總買入股數
      totalBuyingAmount: 0, // 總買入成本
      buyingAveragePrice: 0, // 總買入平均價格 = 總買入成本 / 總買入股數
      totalMarketValue: 0, // 總市值 用最後一個交易價格來算
      log: [
        {
          priceDate: '', // 買入日期
          price: 0, // 買入股價
          buyPrice: 0, // 買入金額
          buyingStockCount: 0, // 每次買入股數
          totalStockCount: 0, // 總買入股數
          totalBuyingAmount: 0, // 總買入平均成本 
          currentMoney: 0 // 錢包
        }
      ] // 所有買入歷史紀錄
 * }
 * @returns - 回傳該筆資訊的物件
 */
// 定期定額計算
export const calculateMonthlyInvestment = (historStockPrice, myStockInfo) => {
  historStockPrice.forEach((item) => {
    const stockCount = myStock.eachBuyingAmount / item.price || 0 // 買入股數
    myStockInfo.totalStockCount += stockCount // 總買入股數
    myStockInfo.totalBuyingAmount += myStockInfo.eachBuyingAmount // 總買入成本
    myStockInfo.buyingCount += 1 // 總買入股數

    // 記錄log
    myStockInfo.log.push({
      priceDate: item.date, // 買入日期
      price: item.price, // 買入股價
      buyPrice: myStock.eachBuyingAmount, // 買入金額
      buyingStockCount: stockCount, // 每次買入股數
      totalStockCount: myStockInfo.totalStockCount, // 總買入股數
      currentMoney: myStock.currentMoney, // 錢包
    })
  })
  myStockInfo.buyingAveragePrice = myStockInfo.totalBuyingAmount / myStockInfo.totalStockCount || 0 // 總買入平均價格
  //   console.log('myStockInfo.buyingAveragePrice', myStockInfo.buyingAveragePrice)
  // 取最後買入價格
  const latestData = historStockPrice.length
    ? historStockPrice.reduce((earliest, current) => {
        return new Date(current.date) > new Date(earliest.date) ? current : earliest
      })
    : { date: '', price: 0 }
  myStockInfo.totalMarketValue = myStockInfo.totalStockCount * latestData.price // 總市值

  return myStockInfo
}

// 景氣信號投資法
const ecoScoreStrategy = (historStock) => {
  const priceLog = []
  historStock.forEach((item) => {
    myStock.currentMoney += 100 // 錢包加上每月收入
    const findIndex = findBusinessSignalsIndex(businessSignals, item.date) || {}
    const findPmiIndex = findBusinessSignalsIndex(historPmi, item.date) || {}
    // if (findIndex && (findIndex.a2 < 17 && findIndex.a1 < 100))

    const buyPrice = myStock.currentMoney * 0.5
    if (
      findPmiIndex &&
      findPmiIndex.data < 50 &&
      findIndex &&
      findIndex.data2 < 17 &&
      findIndex.data < 100
    ) {
      // 每次買入％數
      myStock.currentMoney = myStock.currentMoney - buyPrice

      const stockCount = buyPrice / item.price // 買入股數
      myStock.totalStockCount += stockCount // 總買入股數
      myStock.totalBuyingAmount += buyPrice // 總買入成本

      myStock.buyingCount += 1
    } else {
      myStock.notBuyingCount += 1
    }
    priceLog.push({
      priceDate: item.date,
      indexDate: findIndex.date,
      pmiIndexDate: findPmiIndex.date,
      price: item.price,
      pmi: findPmiIndex.data,
      a1: findIndex.data,
      a2: findIndex.data2,
      buyPrice: buyPrice,
      currentMoney: myStock.currentMoney,
    })
  })
  // console.log(priceLog)
  myStock.buyingAveragePrice = myStock.totalBuyingAmount / myStock.totalStockCount // 總買入平均價格
  // 取最後買入價格
  const latestData = historStock.reduce((earliest, current) => {
    return new Date(current.date) > new Date(earliest.date) ? current : earliest
  })
  myStock.totalMarketValue = myStock.totalStockCount * latestData.price // 總市值 用最後一個收盤日
}

// const mockHistorStockMarket = [
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
// console.log(historStockMarket.length)
ecoScoreStrategy(historStockMarket, myStock)

// console.log('當前存款', myStock.log)
// console.log('當前存款', myStock.currentMoney)
// console.log('買入次數', myStock.buyingCount)
// console.log('沒買入次數', myStock.notBuyingCount)
// console.log('總買入金額', myStock.totalBuyingAmount)
// console.log('總買入股數', myStock.totalStockCount)
// console.log('總買入平均價格', myStock.buyingAveragePrice)
// console.log('總市值', myStock.totalMarketValue)
