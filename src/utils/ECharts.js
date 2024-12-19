import * as echarts from 'echarts'
import { stock0050_20100104_20241209, testList } from '@/utils/stockList.js'
import { convertToGregorian } from '@/utils/date.js'

// 把台灣證交所資料格式整理成圖表格式
export const convertStockDataToEChartsFormat = (data) => {
  let resArr = []
  data.forEach((item) => {
    resArr.push([
      convertToGregorian(item[0]),
      Number(item[3]),
      Number(item[6]),
      Number(item[5]),
      Number(item[4]),
      Number(parseFloat(item[8].replace(/,/g, ''))),
    ])
  })
  return resArr
}

export const splitData = (data) => {
  let categoryData = []
  let values = []
  let volumes = []
  for (let i = 0; i < data.length; i++) {
    categoryData.push(data[i].splice(0, 1)[0]) // 取日期
    values.push(data[i]) // 取 開盤價, 收盤價, 最低價, 最高價
    volumes.push([i, data[i][4], data[i][0] > data[i][1] ? 1 : -1])
  }
  return {
    categoryData: categoryData,
    values: values,
    volumes: volumes,
  }
}

// 計算均線
export const calculateMA = (dayCount, data) => {
  let result = []
  for (var i = 0; i < data.length; i++) {
    if (i < dayCount) {
      result.push('-')
      continue
    }
    var sum = 0
    for (var j = 0; j < dayCount; j++) {
      sum += data[i - j][1]
    }
    result.push(+(sum / dayCount).toFixed(3))
  }
  return result
}
// 計算KD值 待確認
export const calculateKD = (data) => {
  const kValues = [50] // 初始 K 值
  const dValues = [50] // 初始 D 值
  const kdResults = []

  for (let i = 0; i < data.length; i++) {
    const slicedData = data.slice(Math.max(0, i - 8), i + 1) // 最近9日的資料
    const closePrices = slicedData.map((item) => item[2]) // 收盤價
    const lowPrices = slicedData.map((item) => item[3]) // 最低價
    const highPrices = slicedData.map((item) => item[4]) // 最高價

    const close = data[i][2] // 今日收盤價
    const low = Math.min(...lowPrices) // 最近9日最低價
    const high = Math.max(...highPrices) // 最近9日最高價

    let rsv = 0
    if (high !== low) {
      rsv = ((close - low) / (high - low)) * 100
    }

    // 計算 K 值與 D 值
    const k = (2 / 3) * (kValues[i - 1] || 50) + (1 / 3) * rsv
    const d = (2 / 3) * (dValues[i - 1] || 50) + (1 / 3) * k

    kValues.push(k)
    dValues.push(d)

    // 儲存結果
    kdResults.push({
      date: data[i][0],
      close,
      rsv: rsv.toFixed(2),
      k: k.toFixed(2),
      d: d.toFixed(2),
    })
  }

  return kdResults
}
