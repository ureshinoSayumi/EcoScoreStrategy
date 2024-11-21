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

describe('尋找景氣指標', () => {
  test('應該正確找到指定日期資料 (behind: true)', () => {
    const result = findBusinessSignalsIndex(businessSignals, '2024-08', true)
    expect(result).toEqual({ name: '113年7月', a1: 103.14, a2: 35, date: '2024-07' })
  })

  test('應該正確找到指定日期資料 (behind: false)', () => {
    const result = findBusinessSignalsIndex(businessSignals, '2024-08', false)
    expect(result).toEqual({
      name: '113年8月',
      a1: 103.28,
      a2: 39,
      date: '2024-08',
    })
  })

  test('應該處理日期不存在的情況，回傳 null', () => {
    const result = findBusinessSignalsIndex(businessSignals, '2009-01', true)
    expect(result).toBeNull()
  })

  test('應該處理邊界條件 (最後一筆資料)，回傳 null', () => {
    const result = findBusinessSignalsIndex(businessSignals, '2010-01', true)
    expect(result).toBeNull()
  })

  test('應該處理日期不存在且 behind: false，回傳 null', () => {
    const result = findBusinessSignalsIndex(businessSignals, '2009-02', false)
    expect(result).toBeNull()
  })

  test('應該正確處理落後一個月的計算', () => {
    const result = getPreviousMonth('2024-01')
    expect(result).toBe('2023-12')
  })

  test('應該正確處理日期格式錯誤', () => {
    const result = getPreviousMonth('2024-1')
    expect(result).toBeNull()
  })
})

describe('尋找PMI', () => {
  test('應該正確找到指定日期資料 (behind: true)', () => {
    const result = findBusinessSignalsIndex(historPmi, '2024-04', true)
    expect(result).toEqual({ date: '2024-03', pmi: 47.9 })
  })

  test('應該正確找到指定日期資料 (behind: false)', () => {
    const result = findBusinessSignalsIndex(historPmi, '2023-11', false)
    expect(result).toEqual({
      date: '2023-11',
      pmi: 46.8,
    })
  })

  test('應該處理日期不存在的情況，回傳 null', () => {
    const result = findBusinessSignalsIndex(historPmi, '2009-01', true)
    expect(result).toBeNull()
  })

  test('應該處理邊界條件 (最後一筆資料)，回傳 null', () => {
    const result = findBusinessSignalsIndex(historPmi, '2010-01', true)
    expect(result).toBeNull()
  })

  test('應該處理日期不存在且 behind: false，回傳 null', () => {
    const result = findBusinessSignalsIndex(historPmi, '2009-02', false)
    expect(result).toBeNull()
  })

  test('應該正確處理落後一個月的計算', () => {
    const result = getPreviousMonth('2024-01')
    expect(result).toBe('2023-12')
  })

  test('應該正確處理日期格式錯誤', () => {
    const result = getPreviousMonth('2024-1')
    expect(result).toBeNull()
  })
})
