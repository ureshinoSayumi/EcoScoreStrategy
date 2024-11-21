import { test, describe, expect } from 'vitest'
import { findBusinessSignalsIndex, getPreviousMonth } from '@/utils/calculateStock'

const businessSignals = [
  { name: '113年9月', a1: 103.35, a2: 34, date: '2024-09' },
  { name: '113年8月', a1: 103.28, a2: 39, date: '2024-08' },
  { name: '113年7月', a1: 103.14, a2: 35, date: '2024-07' },
  { name: '113年6月', a1: 102.79, a2: 38, date: '2024-06' },
]

describe('findBusinessSignalsIndex', () => {
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
    const result = findBusinessSignalsIndex(businessSignals, '2014-02', true)
    expect(result).toBeNull()
  })

  test('應該處理邊界條件 (最後一筆資料)，回傳 null', () => {
    const result = findBusinessSignalsIndex(businessSignals, '2024-06', true)
    expect(result).toBeNull()
  })

  test('應該處理日期不存在且 behind: false，回傳 null', () => {
    const result = findBusinessSignalsIndex(businessSignals, '2014-02', false)
    expect(result).toBeNull()
  })

  test('應該正確處理落後一個月的計算', () => {
    const result = getPreviousMonth('2024-01')
    expect(result).toBe('2023-12')
  })
})
