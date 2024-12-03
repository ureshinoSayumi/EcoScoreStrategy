import { test, describe, expect } from 'vitest'
import { calculateMonthlyInvestment } from '../../../public/demo.js'

describe('calculateMonthlyInvestment()', () => {
  const mockHistorStockMarket = [
    { date: '2024-11', price: 186.15 },
    { date: '2024-10', price: 183.9 },
    { date: '2024-09', price: 181.9 },
  ]

  test('應該正確計算定期定額的總市值和平均成本', () => {
    const myStock = {
      currentMoney: 0,
      eachBuyingAmount: 100,
      buyingCount: 0,
      notBuyingCount: 0,
      totalStockCount: 0,
      totalBuyingAmount: 0,
      buyingAveragePrice: 0,
      totalMarketValue: 0,
      log: [],
    }

    const result = calculateMonthlyInvestment(mockHistorStockMarket, myStock)

    // 驗證總買入次數
    expect(result.buyingCount).toBe(3)
    // 驗證總買入成本
    expect(result.totalBuyingAmount).toBe(300)
    // 驗證總買入股數 (買入金額/股價的總和)
    const expectedTotalStockCount = 100 / 186.15 + 100 / 183.9 + 100 / 181.9
    expect(result.totalStockCount).toBeCloseTo(expectedTotalStockCount, 4)
    // 驗證平均買入價格
    const expectedAveragePrice = result.totalBuyingAmount / result.totalStockCount
    expect(result.buyingAveragePrice).toBeCloseTo(expectedAveragePrice, 4)
    // 驗證總市值 (用最後一筆價格計算)
    const latestPrice = mockHistorStockMarket[0].price
    const expectedMarketValue = result.totalStockCount * latestPrice
    expect(result.totalMarketValue).toBeCloseTo(expectedMarketValue, 4)
    // 驗證日誌
    expect(result.log).toHaveLength(3)
    expect(result.log[0]).toEqual(
      expect.objectContaining({
        priceDate: '2024-11',
        price: 186.15,
        buyPrice: 100,
      }),
    )
  })

  test('應該正確處理空的歷史股價資料', () => {
    const myStock = {
      currentMoney: 0,
      eachBuyingAmount: 100,
      buyingCount: 0,
      notBuyingCount: 0,
      totalStockCount: 0,
      totalBuyingAmount: 0,
      buyingAveragePrice: 0,
      totalMarketValue: 0,
      log: [],
    }

    const result = calculateMonthlyInvestment([], myStock)

    // 買入次數
    expect(result.buyingCount).toBe(0)
    // 總買入成本
    expect(result.totalBuyingAmount).toBe(0)
    // 總買入股數
    expect(result.totalStockCount).toBe(0)
    // 總買入平均價格
    expect(result.buyingAveragePrice).toBe(0)
    // 總市值
    expect(result.totalMarketValue).toBe(0)
    // 歷史買入記錄
    expect(result.log).toHaveLength(0)
  })

  test('應該正確計算只有一筆歷史股價資料的情況', () => {
    const mockHistorStockMarket = [{ date: '2024-11', price: 150 }]

    const myStock = {
      currentMoney: 0,
      eachBuyingAmount: 100,
      buyingCount: 0,
      notBuyingCount: 0,
      totalStockCount: 0,
      totalBuyingAmount: 0,
      buyingAveragePrice: 0,
      totalMarketValue: 0,
      log: [],
    }

    const result = calculateMonthlyInvestment(mockHistorStockMarket, myStock)

    // 買入次數
    expect(result.buyingCount).toBe(1)
    // 總買入成本
    expect(result.totalBuyingAmount).toBe(100)
    // 總買入股數
    expect(result.totalStockCount).toBeCloseTo(100 / 150, 4)
    // 總買入平均價格
    expect(result.buyingAveragePrice).toBeCloseTo(150, 4)
    // 總市值
    expect(result.totalMarketValue).toBeCloseTo(100, 4)
    // 歷史買入記錄
    expect(result.log).toHaveLength(1)
  })

  test('應該正確處理當股價過高，無法買入的情況 (eachBuyingAmount < price)', () => {
    const mockHistorStockMarket = [{ date: '2024-11', price: 1000 }]

    const myStock = {
      currentMoney: 0,
      eachBuyingAmount: 100,
      buyingCount: 0,
      notBuyingCount: 0,
      totalStockCount: 0,
      totalBuyingAmount: 0,
      buyingAveragePrice: 0,
      totalMarketValue: 0,
      log: [],
    }

    const result = calculateMonthlyInvestment(mockHistorStockMarket, myStock)

    // 驗證
    expect(result.buyingCount).toBe(1) // 還是記錄一次買入行為
    expect(result.totalStockCount).toBeCloseTo(100 / 1000, 4) // 買入的股數應非常少
    expect(result.totalBuyingAmount).toBe(100)
    expect(result.buyingAveragePrice).toBeCloseTo(1000, 4)
    expect(result.totalMarketValue).toBeCloseTo((100 / 1000) * 1000, 4)
  })

  test('應該正確處理每月股價下降的情況，驗證總市值應隨之減少', () => {
    const mockHistorStockMarket = [
      { date: '2024-11', price: 200 },
      { date: '2024-10', price: 150 },
      { date: '2024-09', price: 100 },
    ]

    const myStock = {
      currentMoney: 0,
      eachBuyingAmount: 100,
      buyingCount: 0,
      notBuyingCount: 0,
      totalStockCount: 0,
      totalBuyingAmount: 0,
      buyingAveragePrice: 0,
      totalMarketValue: 0,
      log: [],
    }

    const result = calculateMonthlyInvestment(mockHistorStockMarket, myStock)

    // 買入次數
    expect(result.buyingCount).toBe(3)
    // 總買入成本
    expect(result.totalBuyingAmount).toBe(300)
    // 總買入股數
    const expectedTotalStockCount = 100 / 200 + 100 / 150 + 100 / 100
    expect(result.totalStockCount).toBeCloseTo(expectedTotalStockCount, 4)
    // 總買入股數
    const expectedAveragePrice = 300 / expectedTotalStockCount
    expect(result.buyingAveragePrice).toBeCloseTo(expectedAveragePrice, 4)
    // 市值應使用最後一筆股價
    const latestPrice = mockHistorStockMarket[0].price
    expect(result.totalMarketValue).toBeCloseTo(result.totalStockCount * latestPrice, 4)
  })

  test('應該正確處理歷史股價陣列日期順序混亂的情況', () => {
    const mockHistorStockMarket = [
      { date: '2024-10', price: 150 },
      { date: '2024-09', price: 100 },
      { date: '2024-11', price: 200 },
    ]

    const myStock = {
      currentMoney: 0,
      eachBuyingAmount: 100,
      buyingCount: 0,
      notBuyingCount: 0,
      totalStockCount: 0,
      totalBuyingAmount: 0,
      buyingAveragePrice: 0,
      totalMarketValue: 0,
      log: [],
    }

    const result = calculateMonthlyInvestment(mockHistorStockMarket, myStock)

    // 買入次數
    expect(result.buyingCount).toBe(3)
    // 總買入股數
    const expectedTotalStockCount = 100 / 200 + 100 / 150 + 100 / 100
    expect(result.totalStockCount).toBeCloseTo(expectedTotalStockCount, 4)
    // 總買入平均價格
    const expectedAveragePrice = 300 / expectedTotalStockCount
    expect(result.buyingAveragePrice).toBeCloseTo(expectedAveragePrice, 4)
    // 總市值
    const latestPrice = 200 // 最晚日期的價格
    expect(result.totalMarketValue).toBeCloseTo(result.totalStockCount * latestPrice, 4)
  })

  test('應該正確處理未買入任何股數的極端情況 (歷史股價為空)', () => {
    const myStock = {
      currentMoney: 0,
      eachBuyingAmount: 100,
      buyingCount: 0,
      notBuyingCount: 0,
      totalStockCount: 0,
      totalBuyingAmount: 0,
      buyingAveragePrice: 0,
      totalMarketValue: 0,
      log: [],
    }

    const result = calculateMonthlyInvestment([], myStock)

    // 買入次數
    expect(result.buyingCount).toBe(0)
    // 總買入股數
    expect(result.totalStockCount).toBe(0)
    // 總買入成本
    expect(result.totalBuyingAmount).toBe(0)
    // buyingAveragePrice
    expect(result.buyingAveragePrice).toBe(0)
    // 總市值
    expect(result.totalMarketValue).toBe(0)
    // 歷史買入記錄
    expect(result.log).toHaveLength(0)
  })
})
