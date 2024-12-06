export const filterAndSortByDate = (range, data) => {
  // 解構日期範圍，並轉為 Date 物件方便比較
  const [startDateStr, endDateStr] = range
  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)

  // 過濾符合日期區間的資料
  const filteredData = data.filter((item) => {
    const itemDate = new Date(item.date + '-01') // 將 YYYY-MM 格式補全為 YYYY-MM-DD
    return itemDate >= startDate && itemDate <= endDate
  })

  // 按照日期排序
  const sortedData = filteredData.sort((a, b) => {
    const dateA = new Date(a.date + '-01')
    const dateB = new Date(b.date + '-01')
    return dateA - dateB
  })

  return sortedData
}

// 民國年轉西元年
export const convertToGregorian = (dateString) => {
  // 拆解民國日期為三個部分：年、月、日
  const [rocYear, month, day] = dateString.split('/').map(Number)
  // 計算西元年：民國年 + 1911
  const gregorianYear = rocYear + 1911
  // 組合成 ISO 格式日期（西元年-月-日）
  const gregorianDate = `${gregorianYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return gregorianDate
}

// 取得當前日期為起點，過去x月的每月第一天
// 輸入 3
// 輸出：['20241201', '20241101', '20241001']
export const getPastMonthsFirstDays = (months) => {
  const today = new Date()
  const results = []

  for (let i = 0; i < months; i++) {
    // 計算過去月份
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
    // 格式化為 'YYYYMMDD'
    const formattedDate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}01`
    results.push(formattedDate)
  }
  return results
}
