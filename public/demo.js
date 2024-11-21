import { historicalStockPrice } from '../src/utils/data/historicalStockPrice.js' // 歷史股價
import { businessSignals } from '../src/utils/data/businessSignals.js' // 景氣指標
import { historPmi } from '../src/utils/data/historPmi.js'
import { findBusinessSignals } from '../src/utils/calculateStock.js'

// console.log(historicalStockPrice, 'arr')
const myStock = {
  currentMoney: 0, // 當前存款
  eachBuyingAmount: 100, // 每次買入金額
  buyingCount: 0, // 買入次數
  notBuyingCount: 0, // 沒買入次數

  totalStockCount: 0, // 總買入股數
  totalBuyingAmount: 0, // 總買入成本
  buyingAveragePrice: 0, // 總買入平均價格 = 總買入成本 / 總買入股數
  totalMarketValue: 0, // 總市值 用股價100代替
}

// 定期定額計算
const calculateMonthlyInvestment = () => {
  historicalStockPrice.forEach((item) => {
    const stockCount = myStock.eachBuyingAmount / item.price // 買入股數
    myStock.totalStockCount += stockCount // 總買入股數
    myStock.totalBuyingAmount += myStock.eachBuyingAmount // 總買入成本

    myStock.buyingCount += 1 // 總買入股數
  })
  myStock.buyingAveragePrice = myStock.totalBuyingAmount / myStock.totalStockCount // 總買入平均價格
  myStock.totalMarketValue = myStock.totalStockCount * 100 // 總買入平均價格
}

// 景氣信號投資法
const calculateMonthlyInvestment2 = () => {
  const priceLog = []
  historicalStockPrice.forEach((item) => {
    const findIndex = findBusinessSignals(businessSignals, item.date)
    const findPmiIndex = findBusinessSignals(historPmi, item.date)
    // if (findIndex && (findIndex.a2 < 17 && findIndex.a1 < 100))

    if (findPmiIndex && findPmiIndex.pmi < 50) {
      // 每次買入％數
      const buyPrice = myStock.currentMoney * 0.1
      myStock.currentMoney = myStock.currentMoney - buyPrice

      const stockCount = buyPrice / item.price // 買入股數
      myStock.totalStockCount += stockCount // 總買入股數
      myStock.totalBuyingAmount += buyPrice // 總買入成本

      myStock.buyingCount += 1
      priceLog.push({
        priceDate: item.date,
        indexDate: findIndex.date,
        pmiIndexDate: findPmiIndex.date,
        price: item.price,
        pmi: findPmiIndex.pmi,
        a1: findIndex.a1,
        a2: findIndex.a2,
        buyPrice: buyPrice,
        currentMoney: myStock.currentMoney,
      })
    } else {
      myStock.currentMoney += 100
      myStock.notBuyingCount += 1
    }
  })
  console.log(priceLog)
  myStock.buyingAveragePrice = myStock.totalBuyingAmount / myStock.totalStockCount // 總買入平均價格
  myStock.totalMarketValue = myStock.totalStockCount * 100 // 總買入平均價格
}

calculateMonthlyInvestment2()

console.log('當前存款', myStock.currentMoney)
console.log('買入次數', myStock.buyingCount)
console.log('沒買入次數', myStock.notBuyingCount)
console.log('總買入金額', myStock.totalBuyingAmount)
console.log('總買入股數', myStock.totalStockCount)
console.log('總買入平均價格', myStock.buyingAveragePrice)
console.log('總市值', myStock.totalMarketValue)
