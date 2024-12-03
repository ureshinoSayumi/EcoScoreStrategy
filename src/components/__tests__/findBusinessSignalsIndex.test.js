import { test, describe, expect } from 'vitest'
import { findBusinessSignalsIndex, getPreviousMonth } from '@/utils/calculateStock'
import { businessSignals } from '@/utils/data/businessSignals.js' // 景氣指標
import { historPmi } from '@/utils/data/historPmi.js' // PMI

// const businessSignals = [
//   { name: '113年9月', a1: 103.35, a2: 34, date: '2024-09' },
//   { name: '113年8月', a1: 103.28, a2: 39, date: '2024-08' },
//   { name: '113年7月', a1: 103.14, a2: 35, date: '2024-07' },
//   { name: '113年6月', a1: 102.79, a2: 38, date: '2024-06' },
// ]

describe('getPreviousMonth()-取得指定日期前一個月的日期', () => {
  test('findBusinessSignalsIndex()-[PMI]-應該正確處理落後一個月的計算-case1', () => {
    const result = getPreviousMonth('2024-01')
    expect(result).toBe('2023-12')
  })

  test('findBusinessSignalsIndex()-[PMI]-應該正確處理落後一個月的計算-case2', () => {
    const result = getPreviousMonth('2024-10')
    expect(result).toBe('2024-09')
  })

  test('findBusinessSignalsIndex()-[PMI]-應該正確處理日期格式錯誤-case1', () => {
    const result = getPreviousMonth('2024-1')
    expect(result).toBeNull()
  })

  test('findBusinessSignalsIndex()-[PMI]-應該正確處理日期格式錯誤-case2', () => {
    const result = getPreviousMonth('')
    expect(result).toBeNull()
  })

  test('findBusinessSignalsIndex()-[PMI]-應該正確處理日期格式錯誤-case3', () => {
    const result = getPreviousMonth(null)
    expect(result).toBeNull()
  })
})

describe('尋找景氣指標', () => {
  test('findBusinessSignalsIndex()-[景氣指標]-應該正確找到指定日期資料 (behind: true)', () => {
    const result = findBusinessSignalsIndex(businessSignals, '2024-08', true)
    expect(result).toEqual({ name: '113年7月', data: 103.14, data2: 35, date: '2024-07' })
  })

  test('findBusinessSignalsIndex()-[景氣指標]-應該正確找到指定日期資料 (behind: false)', () => {
    const result = findBusinessSignalsIndex(businessSignals, '2024-08', false)
    expect(result).toEqual({ name: '113年8月', data: 103.28, data2: 39, date: '2024-08' })
  })

  test('findBusinessSignalsIndex()-[景氣指標]-應該處理日期不存在的情況，回傳 null', () => {
    const result = findBusinessSignalsIndex(businessSignals, '2009-01', true)
    expect(result).toBeNull()
  })

  test('findBusinessSignalsIndex()-[景氣指標]-應該處理邊界條件 (最後一筆資料)，回傳 null', () => {
    // 找出最早的日期物件
    const earliestData = businessSignals.reduce((earliest, current) => {
      // 比較日期，若 current 的日期更早，則更新 earliest
      return new Date(current.date) < new Date(earliest.date) ? current : earliest
    })
    const result = findBusinessSignalsIndex(businessSignals, earliestData.date, true)
    expect(result).toBeNull()
  })

  test('findBusinessSignalsIndex()-[景氣指標]-應該處理日期不存在且 behind: false，回傳 null', () => {
    const result = findBusinessSignalsIndex(businessSignals, '2009-02', false)
    expect(result).toBeNull()
  })
})

describe('尋找PMI', () => {
  test('findBusinessSignalsIndex()-[PMI]-應該正確找到指定日期資料 (behind: true)', () => {
    const result = findBusinessSignalsIndex(historPmi, '2024-04', true)
    expect(result).toEqual({ date: '2024-03', data: 47.9 })
  })

  test('findBusinessSignalsIndex()-[PMI]-應該正確找到指定日期資料 (behind: false)', () => {
    const result = findBusinessSignalsIndex(historPmi, '2023-11', false)
    expect(result).toEqual({ date: '2023-11', data: 46.8 })
  })

  test('findBusinessSignalsIndex()-[PMI]-應該處理日期不存在的情況，回傳 null', () => {
    const result = findBusinessSignalsIndex(historPmi, '2009-01', true)
    expect(result).toBeNull()
  })

  test('findBusinessSignalsIndex()-[PMI]-應該處理邊界條件 (最後一筆資料)，回傳 null', () => {
    // 找出最早的日期物件
    const earliestData = historPmi.reduce((earliest, current) => {
      // 比較日期，若 current 的日期更早，則更新 earliest
      return new Date(current.date) < new Date(earliest.date) ? current : earliest
    })
    const result = findBusinessSignalsIndex(historPmi, earliestData.date, true)
    expect(result).toBeNull()
  })

  test('findBusinessSignalsIndex()-[PMI]-應該處理日期不存在且 behind: false，回傳 null', () => {
    const result = findBusinessSignalsIndex(historPmi, '2009-02', false)
    expect(result).toBeNull()
  })
})
