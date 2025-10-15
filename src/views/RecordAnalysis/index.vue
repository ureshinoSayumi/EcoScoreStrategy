<template>
  <el-container>
    <el-main>
      <el-row :gutter="20">
        <el-col>
          <input type="file" accept=".csv" @change="handleFile" />
          <el-form-item label="檔案名稱">
             <el-text>{{ fileName }}</el-text>
           </el-form-item>
           <el-form-item label="執行輪數">
             <el-input-number v-model="rounds" :min="0" size="small" />
           </el-form-item>
           <el-form-item label="持有限制">
             <el-input-number v-model="stocksPerRound" :min="0" size="small" />
           </el-form-item>
           <el-form-item label="持有天數">
             <el-input-number v-model="holdDays" :min="0" size="small" />
           </el-form-item>
           <el-form-item label="輸出圖表">
             <el-switch v-model="outputChart" />
           </el-form-item>
           <el-form-item label="蒙地卡羅模擬">
             <el-switch v-model="monteCarloTest" />
           </el-form-item>
          <el-button type="primary" @click="reset()"> 重置 </el-button>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card shadow="hover" style="max-width: 480px">
            <el-space direction="vertical" alignment="flex-start">
              <el-text>平均報酬: {{ averageReturn }}％</el-text>
              <el-text>交易筆數: {{ tableData.length }}</el-text>
              <el-text>平均賺賠比: {{ profitLossRatio }}</el-text>
              <el-text>報酬率中位數: {{ medianReturn }}</el-text>
              <el-text>勝率: {{ winRate }}</el-text>


            </el-space>
            <template #footer>
              <el-space direction="vertical" alignment="flex-start">
                <el-text>總報酬: {{ totalReturn }}</el-text>
                <el-text>區間最大回徹: {{ maxDrawdownValue }}％</el-text>
                <el-text>年度平均報酬率: {{ annualReturn }}％</el-text>
                <el-text>年度中位數報酬率: {{ medianAnnualReturn }}％</el-text>
                <el-text>最差年度報酬率: {{ worstAnnualReturn }}％</el-text>
                <el-text>最佳年度報酬率: {{ bestAnnualReturn }}％</el-text>
                <el-text>輪動次數: {{ rotationsNumber }}</el-text>
                <el-text v-for="item in annualReturnLog" :key="item.year">{{ item.year }} : {{ item.return }}％</el-text>
              </el-space>
            </template>
          </el-card>
        </el-col>
      </el-row>

      <!-- 報酬率分佈圖 -->
      <!-- 統計報酬％數區間分布 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom" style="width: 1500px; height: 600px"></div>
      </div>

      <!-- 每月交易次數分布 -->
      <!-- 以每月為單位，統計整段時間軸的報酬區間 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom2" style="width: 1500px; height: 600px"></div>
      </div>

      <!-- 交易日期報酬分布 -->
      <!-- 統計1～31號買入報酬分布 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom3" style="width: 1500px; height: 600px"></div>
      </div>

      <!-- 交易月報酬分布 -->
      <!-- 統計1～12月買入報酬分布 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom6" style="width: 1500px; height: 600px"></div>
      </div>

       <!-- 交易月最高最低期報酬分布 -->
      <!-- 統計1～12月買入報酬分布 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom7" style="width: 1500px; height: 600px"></div>
      </div>





      <!-- 每年報酬 -->
      <!-- 一年會單位統計滾動績效 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom4" style="width: 1500px; height: 600px"></div>
      </div>

      <!-- 模擬資金報酬曲線 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom8" style="width: 1500px; height: 600px"></div>
      </div>

      <!-- 表格 -->
      <el-table
        v-if="false"
        :data="tableData"
        style="margin-top: 20px"
        height="600"
        border
      >
        <el-table-column prop="name" label="商品名稱" sortable />
        <el-table-column prop="name" label="商品名稱" sortable />
        <el-table-column prop="code" label="商品代碼" sortable />
        <el-table-column prop="index" label="序號" sortable />
        <el-table-column prop="buyDay" label="進場時間" sortable />
        <el-table-column prop="buyPrice" label="進場價格" sortable />
        <el-table-column prop="buyDirection" label="進場方向" />
        <el-table-column prop="sellDay" label="出場時間" sortable />
        <el-table-column prop="sellPrice" label="出場價格" sortable />
        <el-table-column prop="sellDirection" label="出場方向" />
        <el-table-column prop="days" label="持有區間" sortable />
        <el-table-column prop="return" label="報酬率" sortable>
          <template #default="scope">
            {{ (Number(scope.row.return) * 100).toFixed(2) }}%
          </template>
        </el-table-column>
        <el-table-column prop="note" label="訊息" />

      </el-table>
    </el-main>
  </el-container>
</template>
<script lang="ts" setup>
import { parseCSV } from '@/utils/csvReader';
import { businessSignals } from '@/utils/data/businessSignals.js'; // 景氣指標
import * as echarts from 'echarts';
import { computed, onMounted, reactive, ref } from 'vue';
import { calculateSimulationResult, runMonteCarlo } from './utils/monteCarloMethod';

// 輸出報表
const total = reactive({
  averageCompensation: 0
})
const tableData = ref([])
const chart = ref()
const myChartDom = ref() // 報酬率分佈圖
const myChartDom2 = ref() // 每月交易次數分布
const myChartDom3 = ref() // 交易日期報酬分布
const myChartDom4 = ref() // 每年報酬
const myChartDom6 = ref() // 第四張圖表容器
const myChartDom7 = ref() // 第四張圖表容器
const myChartDom8 = ref() // 第四張圖表容器
const rounds = ref(40) // 執行輪數
const stocksPerRound = ref(10) // 持有限制
const holdDays = ref(60) // 持有天數
const totalReturn = ref('') // 總報酬率
const maxDrawdownValue = ref() // 區間最大回徹
const annualReturn = ref(0) // 年度平均報酬率
const medianAnnualReturn = ref() // 年度中位數報酬率
const worstAnnualReturn = ref() // 最差年度報酬率
const bestAnnualReturn = ref() // 最佳年度報酬率
const annualReturnLog = ref([]) // 年度報酬率紀錄
const rotationsNumber = ref() // 輪動次數
const fileName = ref('') // 檔案名稱
const monteCarloTest = ref(false) // 蒙地卡羅模擬測試
const outputChart = ref(true) // 是否輸出圖表

const reset = () => {
  myChartDom.value = null
  myChartDom2.value = null
  tableData.value = []
}

// 平均報酬
const averageReturn = computed(() => {
  if (tableData.value.length === 0) return 0

  const total = tableData.value.reduce((sum, item) => {
    const r = parseFloat(item.return)
    return isNaN(r) ? sum : sum + r
  }, 0)

  return (total / tableData.value.length) * 100 // 乘 100 為百分比
})
// 平均賺賠比
const profitLossRatio = computed(() => {
  const returns = tableData.value
    .map(i => parseFloat(i.return))
    .filter(r => !isNaN(r))

  const profits = returns.filter(r => r > 0)
  const losses = returns.filter(r => r < 0)

  const avgProfit = profits.reduce((a, b) => a + b, 0) / (profits.length || 1)

  const avgLoss = losses.reduce((a, b) => a + b, 0) / (losses.length || 1)

  if (avgLoss === 0) return Infinity // 沒虧損交易，賺賠比無限大
  return avgProfit / Math.abs(avgLoss)
})
// 報酬率中位數
const medianReturn = computed(() => {
  const returns = tableData.value
    .map(item => parseFloat(item.return))
    .filter(r => !isNaN(r)) // 過濾無效數值
    .sort((a, b) => a - b)  // 由小到大排序

  const len = returns.length
  if (len === 0) return 0

  if (len % 2 === 1) {
    // 奇數筆：回傳中間那筆
    return returns[Math.floor(len / 2)] * 100
  } else {
    // 偶數筆：取中間兩筆平均
    const mid1 = returns[len / 2 - 1]
    const mid2 = returns[len / 2]
    return ((mid1 + mid2) / 2) * 100
  }
})
// 勝率
const winRate = computed(() => {
  const returns = tableData.value
    .map(i => parseFloat(i.return))
    .filter(r => !isNaN(r))

  if (returns.length === 0) return 0

  const winCount = returns.filter(r => r > 0).length
  return (winCount / returns.length) * 100
})

const handleFile = async (event) => {
  const file = event.target.files?.[0];
  fileName.value = file.name
  if (file) {
    document.title = file.name; // 修改網頁標籤的標題
    const data = await parseCSV(file);
    console.log('CSV資料:', data);
    tableData.value = data.map(item => {
      return {
        name: item["商品名稱"],
        code: item["商品代碼"],
        index: item["序號"],
        buyDay: item["進場時間"],
        buyPrice: item["進場價格"],
        buyDirection: item["進場方向"],
        sellDay: item["出場時間"],
        sellPrice: item["出場價格"],
        sellDirection: item["出場方向"],
        days: item["持有區間"],
        return: item["報酬率"],
        note: item["訊息"],
        // sell: item // 若你仍要保留完整原始資料
      }
    })

     // 資金總報酬率
    const { finalReturn, maxDrawdown, history, mean, median, worst, best, annualReturnsLog } = calculateSimulationResult(tableData.value, 10000, stocksPerRound.value)
    totalReturn.value = finalReturn // 總報酬率
    maxDrawdownValue.value = maxDrawdown // 區間最大回徹
    rotationsNumber.value = history.length // 輪動次數
    annualReturn.value = mean // 年度平均報酬率
    medianAnnualReturn.value = median // 年度中位數報酬率
    worstAnnualReturn.value = worst // 最差年度報酬率
    bestAnnualReturn.value = best // 最佳年度報酬率
    annualReturnLog.value = annualReturnsLog // 年度報酬率紀錄

    // 輸出圖表
    if (outputChart.value) {
      buildChart1() // 報酬率分佈圖
      buildChart2() // 每月交易次數分布
      buildChart3() // 交易日期報酬分布
      buildChart4() // 每年報酬
      buildChart6() // 交易月報酬分布
      buildChart7() // 交易月最高最低期報酬分布
      buildChart0(history) // 資金 / 持倉成本 / 資產走勢圖
    }
    // 蒙地卡羅模擬測試
    if (monteCarloTest.value) {
      runMonteCarlo(tableData.value, 100, 10000, stocksPerRound.value)
    }
  }
}

const buildChart0 = (history) => {

  // 輸出圖表
  // 計算 netAsset（市值 = 現金 + 成本，這裡不含未實現盈虧，純成本）
  const chart = echarts.init(myChartDom8.value)

  chart.setOption({
    title: { text: '資金 / 持倉成本 / 資產走勢圖' },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const i = params[0].dataIndex
        const d = history[i]
        return `
          日期：${d.buyDay}<br/>
          現金：$${d.capital}<br/>
          總資產（估算）：$${parseFloat(d.netAsset)}<br/>
          報酬率: ${d.returnRate}%
        `
      }
    },
    legend: {
      data: ['現金', '總資產']
    },
    xAxis: {
      type: 'category',
      data: history.map(h => h.buyDay),
      axisLabel: { rotate: 45 }
    },
    yAxis: {
      type: 'value',
      name: '金額（元）'
    },
    series: [
      {
        name: '現金',
        type: 'line',
        data: history.map(h => parseFloat(h.capital))
      },
      {
        name: '總資產',
        type: 'line',
        data: history.map(h => parseFloat(h.netAsset))
      }
    ]
  })
}

// 報酬率分佈圖
const buildChart1 = () => {
  const returns = tableData.value.map(i => parseFloat(i.return)).filter(r => !isNaN(r)).map(r => r * 100)
  const binWidth = 5
  const min = Math.floor(Math.min(...returns) / binWidth) * binWidth
  const max = Math.ceil(Math.max(...returns) / binWidth) * binWidth

  const labels = []
  const bins = []
  for (let i = min; i < max; i += binWidth) {
    const from = i, to = i + binWidth
    labels.push(`${from}~${to}%`)
    bins.push(returns.filter(r => r >= from && r < to).length)
  }

  if (!myChartDom.value) return
  chart.value = echarts.init(myChartDom.value)
  chart.value.setOption({
    title: { text: '報酬率分布圖' },
    tooltip: { trigger: 'item' },
    xAxis: {
      type: 'category',
      name: '報酬區間',
      data: labels,
      axisLabel: { rotate: 45 }
    },
    yAxis: { type: 'value', name: '筆數' },
    series: [{ type: 'bar', data: bins, name: '出現次數' }]
  })
}
// 交易月分布
const buildChart2 = () => {
  const monthlyStats = {}

  tableData.value.forEach(item => {
    const month = item.buyDay?.slice(0, 7).replace('/', '-') // 'YYYY-MM'
    const r = parseFloat(item.return)
    if (!month || isNaN(r)) return

    if (!monthlyStats[month]) {
      monthlyStats[month] = []
    }
    monthlyStats[month].push(r * 100) // 轉為百分比
  })

  const sortedMonths = Object.keys(monthlyStats).sort()

  const avgReturns = []
  const medianReturns = []
  const winRates = []
  const counts = []
  const scores = []

  for (const month of sortedMonths) {
    const list = monthlyStats[month]
    const n = list.length
    const win = list.filter(r => r > 0).length

    const avg = list.reduce((a, b) => a + b, 0) / n
    const sorted = [...list].sort((a, b) => a - b)
    const median = n % 2 === 1
      ? sorted[Math.floor(n / 2)]
      : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    const winRate = (win / n) * 100

    avgReturns.push(avg.toFixed(2))
    medianReturns.push(median.toFixed(2))
    winRates.push(winRate.toFixed(2))
    counts.push(n)

    // 加入外部 businessSignals 的 data2 分數
    const scoreObj = businessSignals.find(d => d.date === month)
    scores.push(scoreObj ? scoreObj.data2 : null)
  }

  if (!myChartDom2.value) return

  const chart = echarts.init(myChartDom2.value)
  chart.setOption({
    title: { text: '每月交易統計圖表' },
    tooltip: {
      trigger: 'axis',
      formatter: function (params) {
        const i = params[0].dataIndex
        return `
          月份：${sortedMonths[i]}<br/>
          筆數：${counts[i]}<br/>
          平均報酬：${avgReturns[i]}%<br/>
          中位報酬：${medianReturns[i]}%<br/>
          勝率：${winRates[i]}%<br/>
          景氣分數：${scores[i] ?? 'N/A'}
        `
      }
    },
    legend: { data: ['平均報酬', '中位報酬', '勝率', '交易筆數', '景氣分數'] },
    xAxis: {
      type: 'category',
      data: sortedMonths,
      name: '交易月份',
      axisLabel: { rotate: 45 }
    },
    yAxis: [
      {
        type: 'value',
        name: '百分比 / 筆數',
      },
      // {
      //   type: 'value',
      //   name: '分數',
      //   position: 'right',
      //   offset: 60
      // }
    ],
    series: [
      { name: '平均報酬', type: 'line', data: avgReturns },
      { name: '中位報酬', type: 'line', data: medianReturns },
      { name: '勝率', type: 'line', data: winRates },
      { name: '交易筆數', type: 'bar', data: counts },
      { name: '景氣分數', type: 'line', data: scores }
    ]
  })
}
// 交易日分布
const buildChart3 = () => {
  const dayStats = {}

  // 初始化 1～31 號
  for (let d = 1; d <= 31; d++) {
    dayStats[d] = []
  }

  // 分類進入各日期
  tableData.value.forEach(item => {
    const day = Number(item.buyDay?.split('/')?.[2])
    const r = parseFloat(item.return)
    if (!isNaN(day) && day >= 1 && day <= 31 && !isNaN(r)) {
      dayStats[day].push(r * 100) // % 單位
    }
  })

  const days = []
  const avgReturns = []
  const medianReturns = []
  const winRates = []
  const counts = []

  for (let d = 1; d <= 31; d++) {
    const returns = dayStats[d]
    const n = returns.length
    const wins = returns.filter(r => r > 0).length

    const avg = n ? (returns.reduce((a, b) => a + b, 0) / n) : 0
    const sorted = [...returns].sort((a, b) => a - b)
    const median = n
      ? (n % 2 === 1
        ? sorted[Math.floor(n / 2)]
        : (sorted[n / 2 - 1] + sorted[n / 2]) / 2)
      : 0
    const winRate = n ? (wins / n) * 100 : 0

    days.push(d.toString())
    avgReturns.push(avg.toFixed(2))
    medianReturns.push(median.toFixed(2))
    winRates.push(winRate.toFixed(2))
    counts.push(n)
  }

  // 繪圖
  if (!myChartDom3.value) return
  const chart = echarts.init(myChartDom3.value)
  chart.setOption({
    title: { text: '每月各日期交易統計' },
    tooltip: {
      trigger: 'axis',
      formatter: function (params) {
        const i = params[0].dataIndex
        return `
          日期：${days[i]} 號<br/>
          筆數：${counts[i]}<br/>
          平均報酬：${avgReturns[i]}%<br/>
          中位數報酬：${medianReturns[i]}%<br/>
          勝率：${winRates[i]}%
        `
      }
    },
    legend: { data: ['平均報酬', '中位報酬', '勝率'] },
    xAxis: {
      type: 'category',
      data: days,
      name: '進場日',
      nameLocation: 'middle',
      nameGap: 25,
    },
    yAxis: {
      type: 'value',
      name: '報酬 / 勝率（%）'
    },
    series: [
      {
        name: '平均報酬',
        type: 'line',
        data: avgReturns
      },
      {
        name: '中位報酬',
        type: 'line',
        data: medianReturns
      },
      {
        name: '勝率',
        type: 'line',
        data: winRates
      },
      // {
      //   name: '交易筆數',
      //   type: 'bar',
      //   data: counts
      // }
    ]
  })
}
// 依據每筆交易的 buyDay，統計各月份報酬
const buildChart6 = () => {
  const monthStats = {}

  // 初始化 1～12 月
  for (let m = 1; m <= 12; m++) {
    monthStats[m] = []
  }

  // 將報酬值分類到對應的月份
  tableData.value.forEach(item => {
    const monthStr = item.buyDay?.split('/')?.[1] // 取 MM 月份
    const month = Number(monthStr)
    const r = parseFloat(item.return)
    if (!isNaN(month) && month >= 1 && month <= 12 && !isNaN(r)) {
      monthStats[month].push(r * 100)
    }
  })

  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString())
  const avgReturns = []
  const medianReturns = []
  const winRates = []
  const counts = []

  for (let m = 1; m <= 12; m++) {
    const returns = monthStats[m]
    const n = returns.length
    const wins = returns.filter(r => r > 0).length

    const avg = n ? (returns.reduce((a, b) => a + b, 0) / n) : 0
    const sorted = [...returns].sort((a, b) => a - b)
    const median = n
      ? (n % 2 === 1
        ? sorted[Math.floor(n / 2)]
        : (sorted[n / 2 - 1] + sorted[n / 2]) / 2)
      : 0
    const winRate = n ? (wins / n) * 100 : 0

    avgReturns.push(avg.toFixed(2))
    medianReturns.push(median.toFixed(2))
    winRates.push(winRate.toFixed(2))
    counts.push(n)
  }

  // 畫圖
  const chart = echarts.init(myChartDom6.value)
  chart.setOption({
    title: { text: '每年月份進場報酬統計' },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const i = params[0].dataIndex
        return `
          月份：${months[i]} 月<br/>
          筆數：${counts[i]}<br/>
          平均報酬：${avgReturns[i]}%<br/>
          中位報酬：${medianReturns[i]}%<br/>
          勝率：${winRates[i]}%
        `
      }
    },
    legend: { data: ['平均報酬', '中位報酬', '勝率'] },
    xAxis: {
      type: 'category',
      data: months,
      name: '月份',
      nameLocation: 'middle',
      nameGap: 25
    },
    yAxis: {
      type: 'value',
      name: '報酬 / 勝率（%）'
    },
    series: [
      { name: '平均報酬', type: 'line', data: avgReturns },
      { name: '中位報酬', type: 'line', data: medianReturns },
      { name: '勝率', type: 'line', data: winRates }
    ]
  })
}
// 統計每月最高與最低報酬
const buildChart7 = () => {
  const monthStats = {}

  // 初始化 1～12 月
  for (let m = 1; m <= 12; m++) {
    monthStats[m] = []
  }

  // 將報酬分類到對應月份
  tableData.value.forEach(item => {
    const monthStr = item.buyDay?.split('/')?.[1] // MM 月
    const month = Number(monthStr)
    const r = parseFloat(item.return)
    if (!isNaN(month) && month >= 1 && month <= 12 && !isNaN(r)) {
      monthStats[month].push(r * 100)
    }
  })

  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString())
  const maxReturns = []
  const minReturns = []

  for (let m = 1; m <= 12; m++) {
    const returns = monthStats[m]
    if (returns.length > 0) {
      const max = Math.max(...returns)
      const min = Math.min(...returns)
      maxReturns.push(max.toFixed(2))
      minReturns.push(min.toFixed(2))
    } else {
      maxReturns.push('0')
      minReturns.push('0')
    }
  }

  const chart = echarts.init(myChartDom7.value)
  chart.setOption({
    title: { text: '每月報酬率最高與最低值' },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const i = params[0].dataIndex
        return `
          月份：${months[i]} 月<br/>
          最高報酬率：${maxReturns[i]}%<br/>
          最低報酬率：${minReturns[i]}%
        `
      }
    },
    legend: { data: ['最高報酬率', '最低報酬率'] },
    xAxis: {
      type: 'category',
      data: months,
      name: '月份',
      nameLocation: 'middle',
      nameGap: 25
    },
    yAxis: {
      type: 'value',
      name: '報酬率（%）'
    },
    series: [
      { name: '最高報酬率', type: 'line', data: maxReturns },
      { name: '最低報酬率', type: 'line', data: minReturns }
    ]
  })
}

// 統計每年滾動報酬
const buildChart4 = () => {
  const yearlyStats = {}

  tableData.value.forEach(item => {
    const year = item.buyDay?.slice(0, 4)
    const r = parseFloat(item.return)
    if (!year || isNaN(r)) return

    if (!yearlyStats[year]) yearlyStats[year] = []
    yearlyStats[year].push(r * 100) // 換成百分比
  })

  const years = Object.keys(yearlyStats).sort()
  const avgReturns = []
  const medianReturns = []
  const winRates = []
  const counts = []

  for (const year of years) {
    const list = yearlyStats[year]
    const n = list.length
    const win = list.filter(r => r > 0).length

    const avg = list.reduce((a, b) => a + b, 0) / n
    const sorted = [...list].sort((a, b) => a - b)
    const median = n % 2 === 1
      ? sorted[Math.floor(n / 2)]
      : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    const winRate = (win / n) * 100

    avgReturns.push(avg.toFixed(2))
    medianReturns.push(median.toFixed(2))
    winRates.push(winRate.toFixed(2))
    counts.push(n)
  }

  const chart = echarts.init(myChartDom4.value)
  chart.setOption({
    title: { text: '每年交易統計' },
    tooltip: {
      trigger: 'axis',
      formatter: function (params) {
        const i = params[0].dataIndex
        return `
          年份：${years[i]}<br/>
          筆數：${counts[i]}<br/>
          平均報酬：${avgReturns[i]}%<br/>
          中位報酬：${medianReturns[i]}%<br/>
          勝率：${winRates[i]}%
        `
      }
    },
    legend: { data: ['平均報酬', '中位報酬', '勝率', '交易筆數'] },
    xAxis: {
      type: 'category',
      data: years,
      name: '年份',
      axisLabel: { rotate: 0 }
    },
    yAxis: [
      { type: 'value', name: '百分比 / 筆數' }
    ],
    series: [
      { name: '平均報酬', type: 'line', data: avgReturns },
      { name: '中位報酬', type: 'line', data: medianReturns },
      { name: '勝率', type: 'line', data: winRates },
      { name: '交易筆數', type: 'bar', data: counts }
    ]
  })
}
onMounted(() => {
  // buildECharts()
})
</script>
<style scoped>
:deep(.el-table .warning-row) {
  background-color: rgb(252.5, 245.7, 235.5);
}
.lightText {
  color: red;
}
</style>
