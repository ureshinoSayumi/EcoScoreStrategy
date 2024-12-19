<template>
  <!-- 股票圖搭配景氣循環指標 -->
  <div style="width: 100%; overflow-x: scroll">
    <div ref="myChartDom" style="width: 1000px; height: 600px"></div>
  </div>
</template>
<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { splitData, calculateKD } from '@/utils/ECharts.js'
import * as echarts from 'echarts'
import { businessSignals } from '@/utils/data/businessSignals.js' // 景氣信號、領先指標
import { historPmi } from '@/utils/data/historPmi.js' // PMI

const charData = defineModel('charData', {
  type: Array,
  default: {},
})

const myChartDom = ref()

// 0050圖表 搭配領先指標、景氣燈號、PMI
const buildStockECharts2 = (dom, chartsData) => {
  const myChart = echarts.init(dom)
  const upColor = '#00da3c'
  const downColor = '#ec0000'
  const data = splitData(JSON.parse(JSON.stringify(chartsData)))

  console.log(chartsData[0][0].slice(0, 7))
  console.log('chartsData', chartsData.length)
  const PMI = []
  const businessSignalsA = []
  const businessSignalsB = []
  chartsData.forEach((item) => {
    const itemDate = item[0].slice(0, 7)
    const isPmi = historPmi.find((pmiItem) => pmiItem.date === itemDate)
    const isBusinessSignals = businessSignals.find(
      (businessSignal) => businessSignal.date === itemDate,
    )

    // console.log('isPmi', isPmi)
    if (isPmi) {
      PMI.push(isPmi.data)
    } else {
      PMI.push(null)
    }

    if (isBusinessSignals) {
      businessSignalsA.push(isBusinessSignals.data)
      businessSignalsB.push(isBusinessSignals.data2)
    } else {
      businessSignalsA.push(null)
      businessSignalsB.push(null)
    }
  })
  // const PMI = filterAndSortByDate(dataRange, historPmi)

  console.log('businessSignalsA', businessSignalsA)
  const option = {
    animation: false, // 關閉動畫效果
    // 圖例組件，用於展示圖表中各個數據系列的標識
    legend: {
      data: ['0050', 'PMI', '領先指標', '景氣信號'],
    },
    // 提示框組件，當鼠標懸停在圖表上時顯示的提示信息
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
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
        dataView: { show: true, readOnly: false },
        restore: { show: true },
        saveAsImage: { show: true },
      },
    },

    // 網格配置，用於控制圖表的佈局和位置，可以設置多個網格
    grid: [
      {
        right: '20%',
        left: '5%',
        height: '70%',
      },
    ],
    // x軸配置，用於定義橫軸的相關屬性，包含兩個軸用於主圖和成交量圖
    xAxis: [
      {
        type: 'category',
        axisTick: {
          alignWithLabel: true,
        },
        data: data.categoryData, // x軸數據
      },
    ],
    // y軸配置，用於定義縱軸的相關屬性，包含兩個軸用於主圖和成交量圖
    yAxis: [
      {
        type: 'value',
        name: '0050',
        position: 'left',
        // alignTicks: true,
        splitNumber: 5, // 分割段數
        min: 'dataMin', // 最小值取數據最小值
        max: 'dataMax', // 最大值取數據最大值
        axisLine: {
          show: true,
        },
        axisLabel: {
          formatter: '{value}',
        },
      },
      {
        type: 'value',
        name: 'PMI',
        position: 'right',
        // alignTicks: true,
        splitNumber: 5, // 分割段數
        min: 35, // 最小值取數據最小值
        max: 70, // 最大值取數據最大值
        axisLine: {
          show: true,
          lineStyle: {},
        },
      },
      {
        type: 'value',
        name: '領先指標',
        position: 'right',
        // alignTicks: true,
        splitNumber: 5, // 分割段數
        min: 94, // 最小值取數據最小值
        max: 107, // 最大值取數據最大值
        offset: 50,
        axisLine: {
          show: true,
          lineStyle: {},
        },
      },
      {
        type: 'value',
        name: '景氣信號',
        position: 'right',
        // alignTicks: true,
        splitNumber: 5, // 分割段數
        min: 9, // 最小值取數據最小值
        max: 45, // 最大值取數據最大值
        offset: 100,
        axisLine: {
          show: true,
          lineStyle: {},
        },
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
        type: 'line', // K線圖
        data: data.values.map((item) => item[1]), // K線數據格式為二維陣列 [[開盤價, 收盤價, 最低價, 最高價], [...], ...]

        yAxisIndex: 0,
      },
      {
        name: 'PMI', // PMI
        type: 'line',
        data: PMI,
        yAxisIndex: 1,
      },
      {
        name: '領先指標',
        type: 'line',
        data: businessSignalsA,
        yAxisIndex: 2,
      },
      {
        name: '景氣信號',
        type: 'line',
        data: businessSignalsB,
        yAxisIndex: 3,
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
  // buildStockECharts(myChartDom.value, charData.value)
  buildStockECharts2(myChartDom.value, charData.value)
})
</script>
