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
