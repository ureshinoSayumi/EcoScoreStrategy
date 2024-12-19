<template>
  <!-- 股票標準k線圖 -->
  <div style="width: 100%; overflow-x: scroll">
    <div ref="myChartDom" style="width: 1000px; height: 600px"></div>
  </div>
</template>
<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { splitData, calculateMA, calculateKD } from '@/utils/ECharts.js'
import * as echarts from 'echarts'
import { filterAndSortByDate, getPastMonthsFirstDays } from '@/utils/date.js'

const charData = defineModel('charData', {
  type: Array,
  default: {},
})

const myChartDom = ref()

// 0050圖表 搭配均線、成交量、kd值
const buildStockECharts = (dom, chartsData) => {
  const myChart = echarts.init(dom)
  const upColor = '#00da3c'
  const downColor = '#ec0000'
  const data = splitData(JSON.parse(JSON.stringify(chartsData)))
  const kList = calculateKD(chartsData).map((item) => item.k)
  const dList = calculateKD(chartsData).map((item) => item.d)
  console.log('buildStockECharts', data)
  const option = {
    animation: false, // 關閉動畫效果
    // 圖例組件，用於展示圖表中各個數據系列的標識
    legend: {
      bottom: 10, // 圖例距離底部10px
      left: 'center', // 圖例水平置中
      data: ['0050', '5日均線', '10日均線', '20日均線', '60日均線', '120日均線', '240日均線'], // 圖例顯示的項目
      // data: ['Dow-Jones index', 'MA5', 'MA10', 'MA20', 'MA30'], // 圖例顯示的項目
    },
    // 提示框組件，當鼠標懸停在圖表上時顯示的提示信息
    tooltip: {
      trigger: 'axis', // 觸發類型為坐標軸觸發
      axisPointer: {
        type: 'cross', // 指示器類型為十字準線
      },
      borderWidth: 1, // 提示框邊框寬度
      borderColor: '#ccc', // 提示框邊框顏色
      padding: 10, // 提示框內邊距
      textStyle: {
        color: '#000', // 提示框文字顏色
      },
      // 自定義提示框
      // formatter: function (params) {
      //   const candlestickData = params.find((param) => param.seriesName === '0050')
      //   if (!candlestickData) return ''

      //   return [
      //     `日期：${candlestickData.axisValue}<br/>`,
      //     `開盤：${candlestickData.data[1]}<br/>`,
      //     `收盤：${candlestickData.data[2]}<br/>`,
      //     `最低：${candlestickData.data[3]}<br/>`,
      //     `最高：${candlestickData.data[4]}<br/>`,
      //   ].join('')
      // },
      position: function (pos, params, el, elRect, size) {
        const obj = {
          top: 10, // 提示框距離頂部10px
        }
        obj[['left', 'right'][+(pos[0] < size.viewSize[0] / 2)]] = 30 // 根據鼠標位置決定提示框出現在左側還是右側
        return obj
      },
    },
    // 坐標軸指示器配置，用於展示滑鼠懸停時的十字準線和數據標籤
    axisPointer: {
      link: [
        {
          xAxisIndex: 'all', // 關聯所有x軸的指示器
        },
      ],
      label: {
        backgroundColor: '#777', // 指示器標籤背景色
      },
    },
    // 工具箱組件，提供各種工具按鈕，如數據區域縮放、刷選等功能
    toolbox: {
      feature: {
        dataZoom: {
          yAxisIndex: false, // 不顯示y軸的縮放工具
        },
        brush: {
          type: ['lineX', 'clear'], // 支援橫向選擇和清除功能
        },
      },
    },
    // 刷選組件配置，用於區域選擇和數據過濾
    brush: {
      xAxisIndex: 'all', // 關聯所有x軸的刷選功能
      brushLink: 'all', // 刷選聯動所有圖表
      outOfBrush: {
        colorAlpha: 0.1, // 未選中區域的透明度
      },
    },
    // 視覺映射組件，用於將數據映射到不同的視覺元素（如顏色）上
    visualMap: {
      show: true, // 是否顯示視覺映射組件
      seriesIndex: 7, // 映射到 series 第 7 個系列 成交量
      dimension: 2, // 映射到成交量數據的第3個維度
      pieces: [
        {
          value: 1,
          color: downColor, // 下跌顏色
        },
        {
          value: -1,
          color: upColor, // 上漲顏色
        },
      ],
    },
    // 網格配置，用於控制圖表的佈局和位置，可以設置多個網格
    grid: [
      {
        left: '5%', // 左側留白10%
        right: '5%', // 右側留白8%
        height: '45%', // 高度佔50%
      },
      {
        left: '5%', // 左側留白15%
        right: '5%', // 右側留白85
        top: '60%', // 頂部留白63%
        height: '10%', // 高度佔16%
      },
      {
        left: '5%', // 左側留白10%
        right: '5%', // 右側留白8%
        top: '70%', // 頂部留白63%
        height: '10%', // 高度佔16%
      },
    ],
    // x軸配置，用於定義橫軸的相關屬性，包含兩個軸用於主圖和成交量圖
    xAxis: [
      {
        type: 'category', // 類目軸
        gridIndex: 0,
        data: data.categoryData, // x軸數據
        boundaryGap: false, // 不留白
        axisLine: { onZero: false }, // 軸線不在零刻度上
        splitLine: { show: false }, // 不顯示分隔線
        min: 'dataMin', // 最小值取數據最小值
        max: 'dataMax', // 最大值取數據最大值
        axisPointer: {
          z: 100, // 指示器的z值
        },
      },
      {
        type: 'category', // 類目軸
        gridIndex: 1, // 使用第n個網格
        data: data.categoryData, // x軸數據格式為一維陣列 ['2008-09-22', '2008-09-23', ...] 表示每個資料點的日期
        boundaryGap: false, // 不留白
        axisLine: { onZero: false }, // 軸線不在零刻度上
        axisTick: { show: false }, // 不顯示刻度
        splitLine: { show: false }, // 不顯示分隔線
        axisLabel: { show: false }, // 不顯示軸標籤
        min: 'dataMin', // 最小值取數據最小值
        max: 'dataMax', // 最大值取數據最大值
      },
      {
        type: 'category', // 類目軸
        gridIndex: 2, // 使用第n個網格
        data: data.categoryData, // x軸數據格式為一維陣列 ['2008-09-22', '2008-09-23', ...] 表示每個資料點的日期
        boundaryGap: false, // 不留白
        axisLine: { onZero: false }, // 軸線不在零刻度上
        axisTick: { show: false }, // 不顯示刻度
        splitLine: { show: false }, // 不顯示分隔線
        axisLabel: { show: false }, // 不顯示軸標籤
        min: 'dataMin', // 最小值取數據最小值
        max: 'dataMax', // 最大值取數據最大值
      },
    ],
    // y軸配置，用於定義縱軸的相關屬性，包含兩個軸用於主圖和成交量圖
    yAxis: [
      {
        scale: true, // 不從零開始
        gridIndex: 0,
        splitArea: {
          show: true, // 顯示分隔區域
        },
      },
      {
        scale: true, // 不從零開始
        gridIndex: 1, // 使用第n個網格
        splitNumber: 1, // 分割段數
        // axisLabel: { show: false }, // 不顯示軸標籤
        // axisLine: { show: false }, // 不顯示軸線
        // axisTick: { show: false }, // 不顯示刻度
        // splitLine: { show: false }, // 不顯示分隔線
      },
      {
        scale: true, // 不從零開始
        gridIndex: 2, // 使用第n個網格
        splitNumber: 3, // 分割段數
      },
    ],
    // 數據區域縮放組件，用於放大縮小查看數據的細節
    dataZoom: [
      {
        type: 'inside', // 內置型數據區域縮放組件
        xAxisIndex: [0, 1, 2, 3], // 控制3個x軸
        start: 90, // 數據窗口起始百分比
        end: 100, // 數據窗口結束百分比
      },
      {
        show: true, // 顯示滑動條
        xAxisIndex: [0, 1, 2, 3], // 控制個x軸
        type: 'slider', // 滑動條型數據區域縮放組件
        // 其他可用的type類型:
        // 'inside' - 內置型數據區域縮放組件,可通過鼠標滾輪或觸控板進行縮放
        // 'slider' - 滑動條型數據區域縮放組件,提供可視化的縮放控制
        top: '85%', // 距離頂部85%
        start: 90, // 數據窗口起始百分比
        end: 100, // 數據窗口結束百分比
      },
    ],
    series: [
      // 系列列表，每個系列通過type決定自己的圖表類型，如K線圖、均線圖、成交量圖等
      {
        name: '0050', // 0050
        type: 'candlestick', // K線圖
        data: data.values, // K線數據格式為二維陣列 [開盤價, 收盤價, 最低價, 最高價, 成交量], [...], ...]
        xAxisIndex: 0, // 使用第二個x軸
        yAxisIndex: 0, // 使用第二個y軸
        itemStyle: {
          color: upColor, // 上漲顏色
          color0: downColor, // 下跌顏色
          borderColor: undefined, // 邊框顏色
          borderColor0: undefined, // 下跌時邊框顏色
        },
      },
      {
        name: '5日均線', // 5日均線
        type: 'line', // 線圖
        data: calculateMA(5, data.values), // 計算5日均線數據，格式為一維陣列 [均線值1, 均線值2, ...]
        xAxisIndex: 0, // 使用第二個x軸
        yAxisIndex: 0, // 使用第二個y軸
        smooth: true, // 平滑曲線
        showSymbol: false, // 添加這行來隱藏數據
        lineStyle: {
          opacity: 0.5, // 線條透明度
        },
      },
      {
        name: '10日均線', // 10日均線
        type: 'line', // 線圖
        data: calculateMA(10, data.values), // 計算10日均線數據
        xAxisIndex: 0, // 使用第二個x軸
        yAxisIndex: 0, // 使用第二個y軸
        smooth: true, // 平滑曲線
        showSymbol: false, // 添加這行來隱藏數據
        lineStyle: {
          opacity: 0.5, // 線條透明度
        },
      },
      {
        name: '20日均線', // 20日均線
        type: 'line', // 線圖
        data: calculateMA(20, data.values), // 計算20日均線數據
        xAxisIndex: 0, // 使用第二個x軸
        yAxisIndex: 0, // 使用第二個y軸
        showSymbol: false, // 添加這行來隱藏數據
        smooth: true, // 平滑曲線
        lineStyle: {
          opacity: 0.5, // 線條透明度
        },
      },
      {
        name: '60日均線', // 60日均線
        type: 'line', // 線圖
        data: calculateMA(60, data.values), // 計算30日均線數據
        xAxisIndex: 0, // 使用第二個x軸
        yAxisIndex: 0, // 使用第二個y軸
        showSymbol: false, // 添加這行來隱藏數據
        smooth: true, // 平滑曲線
        lineStyle: {
          opacity: 0.5, // 線條透明度
        },
      },
      {
        name: '120日均線', // 60日均線
        type: 'line', // 線圖
        data: calculateMA(120, data.values), // 計算30日均線數據
        xAxisIndex: 0, // 使用第二個x軸
        yAxisIndex: 0, // 使用第二個y軸
        showSymbol: false, // 添加這行來隱藏數據
        smooth: true, // 平滑曲線
        lineStyle: {
          opacity: 0.5, // 線條透明度
        },
      },
      {
        name: '240日均線', // 240日均線
        type: 'line', // 線圖
        data: calculateMA(240, data.values), // 計算30日均線數據
        xAxisIndex: 0, // 使用第二個x軸
        yAxisIndex: 0, // 使用第二個y軸
        showSymbol: false, // 添加這行來隱藏數據
        smooth: true, // 平滑曲線
        lineStyle: {
          opacity: 0.5, // 線條透明度
        },
      },
      {
        name: '成交量', // 成交量
        type: 'bar', // 柱狀圖
        xAxisIndex: 1, // 使用第二個x軸
        yAxisIndex: 1, // 使用第二個y軸
        data: data.volumes, // 成交量數據格式為二維陣列 [索引值, 成交量, 1或-1(1表示上漲,-1表示下跌)]
      },
      {
        name: 'K值', // 成交量
        type: 'line', // 柱狀圖
        xAxisIndex: 2, // 使用第二個x軸
        yAxisIndex: 2, // 使用第二個y軸
        data: kList, // 成交量數據格式為二維陣列 [索引值, 成交量, 1或-1(1表示上漲,-1表示下跌)]
      },
      {
        name: 'D值', // 成交量
        type: 'line', // 柱狀圖
        xAxisIndex: 2, // 使用第n個x軸
        yAxisIndex: 2, // 使用第n個y軸
        data: dList, // 成交量數據格式為二維陣列 [索引值, 成交量, 1或-1(1表示上漲,-1表示下跌)]
      },
    ],
  }

  myChart.setOption(option, true) // 不合併配置
  // 觸發刷選動作
  myChart.dispatchAction({
    type: 'brush',
    areas: [
      {
        brushType: 'lineX',
        coordRange: [data.categoryData[0], data.categoryData[data.categoryData.length - 1]], // 第一組：前10個數據點
        xAxisIndex: 0,
        yAxisIndex: 0,
        brushStyle: {
          opacity: 0,
        },
      },
      {
        brushType: 'lineX',
        coordRange: ['2024-11-25', '2024-11-29'], // 第二組
        xAxisIndex: 0,
        yAxisIndex: 0,
      },
    ],
  })
}

onMounted(() => {
  buildStockECharts(myChartDom.value, charData.value)
})
</script>
