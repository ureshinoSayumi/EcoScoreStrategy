/**
 * 接收 'YYYY-MM' 格式的年月字串，並回傳該日期的前一個月：
 *
 * 範例：
 * 2024-07 應該回傳 2024-06
 * 2024-01 應該回傳 2023-12
 *
 * @param dateStr - 'YYYY-MM' 格式的年月字串
 * @returns - 回傳 'YYYY-MM' 格式的該日期的前一個月
 */
export const getPreviousMonth = (dateStr) => {
  // 使用正規表達式驗證格式是否為 'YYYY-MM'
  const regex = /^\d{4}-\d{2}$/
  if (!regex.test(dateStr)) {
    return null
  }

  // 將傳入的日期字串轉換為 Date 物件
  const [year, month] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, 1)

  // 設定為前一個月
  date.setMonth(date.getMonth() - 1)

  // 格式化回傳字串
  const prevYear = date.getFullYear()
  const prevMonth = String(date.getMonth() + 1).padStart(2, '0')

  return `${prevYear}-${prevMonth}`
}
/**
 * 搜尋歷史景氣燈號陣列裡的指定日期資料
 *
 * 範例：
 * classifyAge(10) 應該回傳 "Child"
 * classifyAge(15) 應該回傳 "Teenager"
 * classifyAge(30) 應該回傳 "Adult"
 * classifyAge(70) 應該回傳 "Senior"
 *
 * @param businessSignals - 歷史景氣指標
 * @param date - 要搜尋的日期
 * @param behind - 是否落後一個月
 * @returns - 回傳該筆資訊的物件
 */
export const findBusinessSignalsIndex = (businessSignals, date, behind = true) => {
  const index = businessSignals.findIndex((item) => {
    // 1.落後一個月 = 現實情況  2.月同步 = 理想
    const dateStr = behind === true ? getPreviousMonth(date) : date
    return item.date === dateStr
  })

  // 搜不到日期
  if (index === -1) {
    return null
  }
  // 邊界處理
  if (index === businessSignals.length - 1) {
    return null
  }

  return businessSignals[index]
}

// export const findPmiHistorIndex = (date) => {
//   const index = historPmi.findIndex((item) => item.date === date)

//   // 邊界處理
//   if (index === historPmi.length - 1) {
//     return null
//   } else {
//     // 落後一個月 現實
//     return historPmi[index + 1]
//     // 同步指標 理想
//     // return historPmi[index]
//   }
// }
