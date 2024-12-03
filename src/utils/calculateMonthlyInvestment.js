import { historStockMarket } from '@/utils/data/historStockMarket.js' // 歷史股價

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
  const latestData = historStockPrice.reduce((earliest, current) => {
    return new Date(current.date) > new Date(earliest.date) ? current : earliest
  })
  myStockInfo.totalMarketValue = myStockInfo.totalStockCount * latestData.price // 總市值

  return myStockInfo
}

// console.log(historStockMarket.length)
calculateMonthlyInvestment([{ date: '2024-11', price: 150 }], myStock)

console.log('當前存款', myStock.log)
console.log('當前存款', myStock.currentMoney)
console.log('買入次數', myStock.buyingCount)
console.log('沒買入次數', myStock.notBuyingCount)
console.log('總買入金額', myStock.totalBuyingAmount)
console.log('總買入股數', myStock.totalStockCount)
console.log('總買入平均價格', myStock.buyingAveragePrice)
console.log('總市值', myStock.totalMarketValue)
