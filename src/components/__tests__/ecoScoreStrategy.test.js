import { test, describe, expect, beforeEach } from 'vitest'
import { ecoScoreStrategy } from '../../../public/demo2.js'
console.log('ecoScoreStrategy', ecoScoreStrategy)
// Mock 資料
const mockHistorStockMarket = [
  { date: '2024-04', price: 158.2 },
  { date: '2024-05', price: 157.35 },
  { date: '2024-06', price: 168.65 },
  { date: '2024-07', price: 186.55 },
  { date: '2024-08', price: 185 },
  { date: '2024-09', price: 181.9 },
  { date: '2024-10', price: 183.9 },
]
const historPmi = [
  { date: '2024-10', data: 49.4 },
  { date: '2024-09', data: 47.9 },
  { date: '2024-08', data: 50.1 },
  { date: '2024-07', data: 48 },
  { date: '2024-06', data: 50.8 },
  { date: '2024-05', data: 51.8 },
  { date: '2024-04', data: 47.1 },
]
const businessSignals = [
  { data: 99.35, data2: 22, date: '2024-10' },
  { data: 98.35, data2: 15, date: '2024-09' },
  { data: 103.35, data2: 9, date: '2024-08' },
  { data: 100.35, data2: 30, date: '2024-07' },
  { data: 101.35, data2: 32, date: '2024-06' },
  { data: 103.35, data2: 40, date: '2024-05' },
  { data: 98.35, data2: 28, date: '2024-04' },
]

describe('ecoScoreStrategy', () => {
  test('驗證買入次數是否正確', () => {
    const myStock = {
      pmi: { index: 50, isOpen: true, dataList: historPmi },
      businessSignalA: { index: 100, isOpen: false, dataList: businessSignals },
      businessSignalB: { index: 17, isOpen: false, dataList: businessSignals },
      strategyType: 0, // 0: 不使用策略每月買入
      // 買入金額
      currentMoney: 0, // 錢包 每個月如果沒買入，就把錢放入錢包，如果有初始金額也會放在這裡
      eachBuyingPercentage: 50, // 每次買入金額 (百分比)
      eachBuyingFixedAmount: 200, // 每月固定投入金額
      buyType: 2, // 固定金額投入
      // 統計資料
      buyingCount: 0, // 買入次數
      totalStockCount: 0, // 總買入股數
      totalBuyingAmount: 0, // 總買入成本
      buyingAveragePrice: 0, // 總買入平均價格 = 總買入成本 / 總買入股數
      totalMarketValue: 0, // 總市值 用最後一個收盤日
      log: [], // 所有買入歷史紀錄
    }

    const result = ecoScoreStrategy(mockHistorStockMarket, myStock)

    const expectedTotalBuyingAmount = result.buyingCount * 200 // 每次固定投入 200，總買入成本
    const expectedAveragePrice = expectedTotalBuyingAmount / result.totalStockCount // 總買入成本 / 總買入股數 = 總買入平均價格

    expect(result.totalBuyingAmount).toBe(expectedTotalBuyingAmount)
    expect(result.buyingAveragePrice).toBeCloseTo(expectedAveragePrice, 2) // 檢查平均價格到小數點兩位
  })
  test('驗證平均買入價格是否正確', () => {
    const myStock = {
      pmi: { index: 50, isOpen: true, dataList: historPmi },
      businessSignalA: { index: 100, isOpen: false, dataList: businessSignals },
      businessSignalB: { index: 17, isOpen: false, dataList: businessSignals },
      strategyType: 0, // 0: 不使用策略每月買入
      // 買入金額
      currentMoney: 0, // 錢包 每個月如果沒買入，就把錢放入錢包，如果有初始金額也會放在這裡
      eachBuyingPercentage: 50, // 每次買入金額 (百分比)
      eachBuyingFixedAmount: 200, // 每月固定投入金額
      buyType: 2, // 固定金額投入
      // 統計資料
      buyingCount: 0, // 買入次數
      totalStockCount: 0, // 總買入股數
      totalBuyingAmount: 0, // 總買入成本
      buyingAveragePrice: 0, // 總買入平均價格 = 總買入成本 / 總買入股數
      totalMarketValue: 0, // 總市值 用最後一個收盤日
      log: [], // 所有買入歷史紀錄
    }

    const result = ecoScoreStrategy(mockHistorStockMarket, myStock)

    const expectedTotalBuyingAmount = result.buyingCount * 200 // 每次固定投入 200，總買入成本
    const expectedAveragePrice = expectedTotalBuyingAmount / result.totalStockCount // 總買入成本 / 總買入股數 = 總買入平均價格

    expect(result.totalBuyingAmount).toBe(expectedTotalBuyingAmount)
    expect(result.buyingAveragePrice).toBeCloseTo(expectedAveragePrice, 2) // 檢查平均價格到小數點兩位
  })

  // test('驗證買入次數與總買入金額是否一致', () => {
  //   const myStock = {
  //     pmi: { index: 55, isOpen: true, dataList: historPmi },
  //     businessSignalA: { index: 100, isOpen: false, dataList: businessSignals },
  //     businessSignalB: { index: 20, isOpen: false, dataList: businessSignals },
  //     strategyType: 2, // 策略 單一符合
  //     currentMoney: 5000, // 錢包 每個
  //     eachBuyingPercentage: 20, // 每次買入金額 (百分比)
  //     eachBuyingFixedAmount: 0,  // 每月固定投入金額
  //     buyType: 1, // 百分比投入
  //     buyingCount: 0,
  //     totalStockCount: 0,
  //     totalBuyingAmount: 0,
  //     buyingAveragePrice: 0,
  //     totalMarketValue: 0,
  //     log: [],
  //   }

  //   ecoScoreStrategy(mockHistorStockMarket, myStock)

  //   const expectedBuyingCount = Math.floor(
  //     5000 / (5000 * (20 / 100)), // 模擬多次投入百分比計算
  //   )
  //   const expectedTotalBuyingAmount =
  //     (myStock.eachBuyingPercentage / 100) * myStock.currentMoney * myStock.buyingCount

  //   expect(myStock.buyingCount).toBe(expectedBuyingCount)
  //   expect(myStock.totalBuyingAmount).toBeCloseTo(expectedTotalBuyingAmount, 2)
  // })

  // test('驗證現金餘額是否正確', () => {
  //   const myStock = {
  //     pmi: { index: 60, isOpen: true, dataList: historPmi },
  //     businessSignalA: { index: 90, isOpen: false, dataList: businessSignals },
  //     businessSignalB: { index: 15, isOpen: false, dataList: businessSignals },
  //     strategyType: 3,
  //     currentMoney: 10000,
  //     eachBuyingPercentage: 25,
  //     eachBuyingFixedAmount: 0,
  //     buyType: 1, // 百分比投入
  //     buyingCount: 0,
  //     totalStockCount: 0,
  //     totalBuyingAmount: 0,
  //     buyingAveragePrice: 0,
  //     totalMarketValue: 0,
  //     log: [],
  //   }

  //   ecoScoreStrategy(mockHistorStockMarket, myStock)

  //   const expectedSpentMoney =
  //     ((myStock.currentMoney * myStock.eachBuyingPercentage) / 100) * myStock.buyingCount
  //   const expectedRemainingMoney = 10000 - expectedSpentMoney

  //   expect(myStock.currentMoney).toBeCloseTo(expectedRemainingMoney, 2)
  // })

  // test('驗證總市值是否正確', () => {
  //   const myStock = {
  //     pmi: { index: 55, isOpen: true, dataList: historPmi },
  //     businessSignalA: { index: 100, isOpen: true, dataList: businessSignals },
  //     businessSignalB: { index: 10, isOpen: true, dataList: businessSignals },
  //     strategyType: 2,
  //     currentMoney: 2000,
  //     eachBuyingPercentage: 0,
  //     eachBuyingFixedAmount: 500,
  //     buyType: 2, // 固定金額投入
  //     buyingCount: 0,
  //     totalStockCount: 0,
  //     totalBuyingAmount: 0,
  //     buyingAveragePrice: 0,
  //     totalMarketValue: 0,
  //     log: [],
  //   }

  //   ecoScoreStrategy(mockHistorStockMarket, myStock)

  //   const expectedTotalMarketValue =
  //     myStock.totalStockCount * mockHistorStockMarket[mockHistorStockMarket.length - 1].price

  //   expect(myStock.totalMarketValue).toBeCloseTo(expectedTotalMarketValue, 2)
  // })

  // test('驗證 Log 紀錄內容是否正確', () => {
  //   const myStock = {
  //     pmi: { index: 50, isOpen: true, dataList: historPmi },
  //     businessSignalA: { index: 100, isOpen: false, dataList: businessSignals },
  //     businessSignalB: { index: 17, isOpen: false, dataList: businessSignals },
  //     strategyType: 1,
  //     currentMoney: 10000,
  //     eachBuyingPercentage: 10,
  //     eachBuyingFixedAmount: 0,
  //     buyType: 1,
  //     buyingCount: 0,
  //     totalStockCount: 0,
  //     totalBuyingAmount: 0,
  //     buyingAveragePrice: 0,
  //     totalMarketValue: 0,
  //     log: [],
  //   }

  //   ecoScoreStrategy(mockHistorStockMarket, myStock)

  //   expect(myStock.log.length).toBe(myStock.buyingCount)
  //   myStock.log.forEach((logEntry) => {
  //     expect(logEntry.buyPrice).toBeGreaterThan(0) // 確保買入價格有效
  //     expect(logEntry.buyAmount).toBeGreaterThan(0) // 確保投入金額正確
  //   })
  // })
})
