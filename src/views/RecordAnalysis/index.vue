<template>
  <el-container>
    <el-main>
      <el-row :gutter="20">
        <el-col>
          <input  type="file" accept=".csv" multiple @change="handleFile" />
          <el-form-item label="檔案名稱">
             <el-text>{{ fileNames.join(',') }}</el-text>
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
           <el-form-item label="多策略比較">
             <el-switch v-model="multiStrategyTest" />
           </el-form-item>
           <el-form-item label="選持續上漲的">
             <el-switch v-model="selectContinuousUp" />
           </el-form-item>
          <el-button type="primary" :disabled="multiStrategyTest" @click="dataAnalysisSingle(tableData)"> 單策略分析 </el-button>
          <el-button type="primary" :disabled="multiStrategyTest" @click="dataAnalysisSingle2(tableData)"> 單策略分析2 </el-button>
          <el-button type="primary" :disabled="!multiStrategyTest"  @click="dataAnalysisMulti()"> 多策略分析 </el-button>
          <el-button type="primary" :disabled="!multiStrategyTest"  @click="dataAnalysisMulti2()"> 多策略分析2 </el-button>
          <el-button type="primary" :disabled="!multiStrategyTest"  @click="dataAnalysisMultiSummary()"> 多策略綜合計算 </el-button>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card shadow="hover" style="max-width: 480px">
            <el-space direction="vertical" alignment="flex-start">
              <el-text>回測方式: {{ returnCard.backtestType }}、重複進場</el-text>
              <el-text>平均報酬: {{ returnCard.averageReturn }}％</el-text>
              <el-text>交易筆數: {{ multiStrategyTest ? tableDataMulti.length : tableData.length }}</el-text>
              <el-text>平均賺賠比: {{ returnCard.profitLossRatio }}</el-text>
              <el-text>報酬率中位數: {{ returnCard.medianReturn }}</el-text>
              <el-text>勝率: {{ returnCard.winRate }}</el-text>


            </el-space>
            <template #footer>
              <el-space direction="vertical" alignment="flex-start">
                <el-text>總報酬: {{ returnCard.repeat.totalReturn }}</el-text>
                <el-text>區間最大回徹: {{ returnCard.repeat.maxDrawdownValue }}％</el-text>
                <el-text>年度平均報酬率: {{ returnCard.repeat.annualReturn }}％</el-text>
                <el-text>年度中位數報酬率: {{ returnCard.repeat.medianAnnualReturn }}％</el-text>
                <el-text>最差年度報酬率: {{ returnCard.repeat.worstAnnualReturn }}％</el-text>
                <el-text>最佳年度報酬率: {{ returnCard.repeat.bestAnnualReturn }}％</el-text>
                <el-text>輪動次數: {{ returnCard.repeat.rotationsNumber }}</el-text>
                <el-text v-for="item in returnCard.repeat.annualReturnLog" :key="item.year">{{ item.year }} : {{ item.return }}％</el-text>
              </el-space>
            </template>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" style="max-width: 480px">
            <el-space direction="vertical" alignment="flex-start">
              <el-text>回測方式: {{ returnCard.backtestType }}、不重複進場</el-text>
              <el-text>平均報酬: {{ returnCard.averageReturn }}％</el-text>
              <el-text>交易筆數: {{ multiStrategyTest ? tableDataMulti.length : tableData.length }}</el-text>
              <el-text>平均賺賠比: {{ returnCard.profitLossRatio }}</el-text>
              <el-text>報酬率中位數: {{ returnCard.medianReturn }}</el-text>
              <el-text>勝率: {{ returnCard.winRate }}</el-text>


            </el-space>
            <template #footer>
              <el-space direction="vertical" alignment="flex-start">
                <el-text>總報酬: {{ returnCard.noRepeat.totalReturn }}</el-text>
                <el-text>區間最大回徹: {{ returnCard.noRepeat.maxDrawdownValue }}％</el-text>
                <el-text>年度平均報酬率: {{ returnCard.noRepeat.annualReturn }}％</el-text>
                <el-text>年度中位數報酬率: {{ returnCard.noRepeat.medianAnnualReturn }}％</el-text>
                <el-text>最差年度報酬率: {{ returnCard.noRepeat.worstAnnualReturn }}％</el-text>
                <el-text>最佳年度報酬率: {{ returnCard.noRepeat.bestAnnualReturn }}％</el-text>
                <el-text>輪動次數: {{ returnCard.noRepeat.rotationsNumber }}</el-text>
                <el-text v-for="item in returnCard.noRepeat.annualReturnLog" :key="item.year">{{ item.year }} : {{ item.return }}％</el-text>
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
        <div ref="myChartDom1" style="width: 1500px; height: 600px"></div>
      </div>

      <!-- 交易日期報酬分布 -->
      <!-- 統計1～31號買入報酬分布 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom2" style="width: 1500px; height: 600px"></div>
      </div>

      <!-- 交易月報酬分布 -->
      <!-- 統計1～12月買入報酬分布 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom4" style="width: 1500px; height: 600px"></div>
      </div>

       <!-- 交易月最高最低期報酬分布 -->
      <!-- 統計1～12月買入報酬分布 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom5" style="width: 1500px; height: 600px"></div>
      </div>

      <!-- 每年報酬 -->
      <!-- 一年會單位統計滾動績效 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom3" style="width: 1500px; height: 600px"></div>
      </div>

      <!-- 每半年報酬 -->
      <!-- 每半年會單位統計滾動績效 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom7" style="width: 1500px; height: 600px"></div>
      </div>

      <!-- 模擬資金報酬曲線 重複進場 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom6" style="width: 1500px; height: 600px"></div>
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
import { onMounted, reactive, ref } from 'vue';
import { calculateSimulationResult, calculateSimulationResult2, runMonteCarlo } from './utils/monteCarloMethod';

// 資料
const tableData = ref([]) // 交易資料
const tableDataMulti = ref([]) // 多策略交易資料

// 圖表
const chart = ref()
const myChartDom = ref() // 報酬率分佈圖
const myChartDom1 = ref() // 每月交易次數分布
const myChartDom2 = ref() // 交易日期報酬分布
const myChartDom3 = ref() // 每年報酬
const myChartDom4 = ref() // 交易月報酬分布
const myChartDom5 = ref() // 交易月最高最低期報酬分布
const myChartDom6 = ref() // 資金 / 持倉成本 / 資產走勢圖 重複進場
const myChartDom7 = ref() // 每半年報酬

// 參數設定
const fileNames = ref([]) // 檔案名稱
const stocksPerRound = ref(10) // 持有限制
const holdDays = ref(60) // 持有天數
const outputChart = ref(true) // 是否輸出圖表
const monteCarloTest = ref(false) // 蒙地卡羅模擬測試
const multiStrategyTest = ref(false) // 多策略比較
const selectContinuousUp = ref(false) // 選持續上漲的

// 報酬卡
const returnCard = reactive({
  backtestType: '', // 回測方式
  averageReturn: 0, // 平均報酬率
  profitLossRatio: 0, // 平均賺賠比
  medianReturn: 0, // 報酬率中位數
  winRate: 0, // 勝率
  // 重複進場
  repeat: {
    totalReturn: 0, // 總報酬率
    maxDrawdownValue: 0, // 區間最大回徹
    annualReturn: 0, // 年度平均報酬率
    medianAnnualReturn: 0, // 年度中位數報酬率
    worstAnnualReturn: 0, // 最差年度報酬率
    bestAnnualReturn: 0, // 最佳年度報酬率
    annualReturnLog: [], // 年度報酬率紀錄
    rotationsNumber: 0, // 輪動次數
  },
  // 不重複進場
  noRepeat: {
    totalReturn: 0, // 總報酬率
    maxDrawdownValue: 0, // 區間最大回徹
    annualReturn: 0, // 年度平均報酬率
    medianAnnualReturn: 0, // 年度中位數報酬率
    worstAnnualReturn: 0, // 最差年度報酬率
    bestAnnualReturn: 0, // 最佳年度報酬率
    annualReturnLog: [], // 年度報酬率紀錄
    rotationsNumber: 0, // 輪動次數
  },
})
// const backtestType = ref('') // 回測方式
// const averageReturn = ref(0) // 平均報酬率
// const profitLossRatio = ref(0) // 平均賺賠比
// const medianReturn = ref(0) // 報酬率中位數
// const winRate = ref(0) // 勝率
// const totalReturn = ref('') // 總報酬率
// const maxDrawdownValue = ref() // 區間最大回徹

// const annualReturn = ref(0) // 年度平均報酬率
// const medianAnnualReturn = ref() // 年度中位數報酬率
// const worstAnnualReturn = ref() // 最差年度報酬率
// const bestAnnualReturn = ref() // 最佳年度報酬率
// const annualReturnLog = ref([]) // 年度報酬率紀錄
// const rotationsNumber = ref() // 輪動次數

// 計算平均報酬率
const averageReturnComputed = ((data) => {
  if (data.length === 0) return 0

  const total = data.reduce((sum, item) => {
    const r = parseFloat(item.return)
    return isNaN(r) ? sum : sum + r
  }, 0)

  return (total / data.length) * 100 // 乘 100 為百分比
})

// 計算平均賺賠比
const profitLossRatioComputed = ((data) => {
  const returns = data
    .map(i => parseFloat(i.return))
    .filter(r => !isNaN(r))

  const profits = returns.filter(r => r > 0)
  const losses = returns.filter(r => r < 0)

  const avgProfit = profits.reduce((a, b) => a + b, 0) / (profits.length || 1)

  const avgLoss = losses.reduce((a, b) => a + b, 0) / (losses.length || 1)

  if (avgLoss === 0) return Infinity // 沒虧損交易，賺賠比無限大
  return avgProfit / Math.abs(avgLoss)
})

// 計算報酬率中位數
const medianReturnComputed = ((data) => {
  const returns = data
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

// 計算勝率
const winRateComputed = ((data) => {
  const returns = data
    .map(i => parseFloat(i.return))
    .filter(r => !isNaN(r))

  if (returns.length === 0) return 0

  const winCount = returns.filter(r => r > 0).length
  return (winCount / returns.length) * 100
})

// 處理檔案
const handleFile = async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return
  }
  const data = await parseCSV(file);
  console.log('CSV資料:', data);
  const formatterData = data.map(item => {
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

  if (multiStrategyTest.value) {
    tableDataMulti.value.push(formatterData)
    fileNames.value.push(file.name)
    console.log('tableDataMulti', tableDataMulti.value)

  } else {
    fileNames.value.push(file.name)
    document.title = file.name; // 修改網頁標籤的標題
    tableData.value =  formatterData
    console.log('tableData', tableData.value)

  }
}

const dataAnalysisSingle2 = (data) => {
  console.log('dataAnalysisSingle2', data)
  const repeatResult = calculateSimulationResult2(data, 10000, stocksPerRound.value, true)
  console.log('repeatResult', repeatResult)


  // 資金總報酬率 重複進場
  returnCard.repeat.totalReturn = repeatResult.finalReturn // 總報酬率
  returnCard.repeat.maxDrawdownValue = repeatResult.maxDrawdown // 區間最大回徹
  returnCard.repeat.rotationsNumber = repeatResult.rotations // 輪動次數
  returnCard.repeat.annualReturn = repeatResult.mean // 年度平均報酬率
  returnCard.repeat.medianAnnualReturn = repeatResult.median // 年度中位數報酬率
  returnCard.repeat.worstAnnualReturn = repeatResult.worst // 最差年度報酬率
  returnCard.repeat.bestAnnualReturn = repeatResult.best // 最佳年度報酬率
  returnCard.repeat.annualReturnLog = repeatResult.annualReturnsLog // 年度報酬率紀錄

  // 不重複進場
  const noRepeatResult = calculateSimulationResult2(data, 10000, stocksPerRound.value, false)
  returnCard.noRepeat.totalReturn = noRepeatResult.finalReturn // 總報酬率
  returnCard.noRepeat.maxDrawdownValue = noRepeatResult.maxDrawdown // 區間最大回徹
  returnCard.noRepeat.rotationsNumber = noRepeatResult.rotations // 輪動次數
  returnCard.noRepeat.annualReturn = noRepeatResult.mean // 年度平均報酬率
  returnCard.noRepeat.medianAnnualReturn = noRepeatResult.median // 年度中位數報酬率
  returnCard.noRepeat.worstAnnualReturn = noRepeatResult.worst // 最差年度報酬率
  returnCard.noRepeat.bestAnnualReturn = noRepeatResult.best // 最佳年度報酬率
  returnCard.noRepeat.annualReturnLog = noRepeatResult.annualReturnsLog // 年度報酬率紀錄

  // 總策略計算
  returnCard.averageReturn = averageReturnComputed(data) // 平均報酬率
  returnCard.profitLossRatio = profitLossRatioComputed(data) // 平均賺賠比
  returnCard.medianReturn = medianReturnComputed(data) // 報酬率中位數
  returnCard.winRate = winRateComputed(data) // 勝率

  // 輸出圖表
  if (outputChart.value) {
    buildChart(data) // 報酬率分佈圖
    buildChart1(data) // 每月交易次數分布
    buildChart2(data) // 交易日期報酬分布
    buildChart3(data) // 每年報酬
    buildChart4(data) // 交易月報酬分布
    buildChart5(data) // 交易月最高最低期報酬分布
    buildChart6(repeatResult.history, noRepeatResult.history) // 資金 / 持倉成本 / 資產走勢圖
    buildChart7(data) // 每半年報酬
    // buildChart7(noRepeatResult.history) // 資金 / 持倉成本 / 資產走勢圖
  }
  // 蒙地卡羅模擬測試
  if (monteCarloTest.value) {
    runMonteCarlo(tableData.value, 100, 10000, stocksPerRound.value)
  }

}
// 單策略分析
const dataAnalysisSingle = (data) => {
  function findHigherBuyItems(list) {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const MAX_DAYS = 90;

    // 依 name 分組
    const byName = new Map();
    list.forEach(item => {
      if (!byName.has(item.name)) byName.set(item.name, []);
      byName.get(item.name).push(item);
    });

    const result = new Set(); // 用 Set 避免重複

    for (const [name, items] of byName.entries()) {
      // 依 buyDay 排序
      items.sort((a, b) => new Date(a.buyDay) - new Date(b.buyDay));

      for (let i = 0; i < items.length; i++) {
        const prev = items[i];
        const prevDate = new Date(prev.buyDay);
        const prevPrice = Number(prev.buyPrice);

        for (let j = i + 1; j < items.length; j++) {
          const next = items[j];
          const diffDays = (new Date(next.buyDay) - prevDate) / MS_PER_DAY;

          if (diffDays > MAX_DAYS) break;

          if (Number(next.buyPrice) > prevPrice) {
            result.add(next); // 只加後一筆，不重複
          }

        }
      }
    }

    return Array.from(result); // 轉回 array
  }

  console.log('findCloseHigherBuys', findHigherBuyItems(data))

  data = selectContinuousUp.value ? findHigherBuyItems(data) : data


  // 資金總報酬率 重複進場
  const repeatResult = calculateSimulationResult(data, 10000, stocksPerRound.value, true)
  returnCard.repeat.totalReturn = repeatResult.finalReturn // 總報酬率
  returnCard.repeat.maxDrawdownValue = repeatResult.maxDrawdown // 區間最大回徹
  returnCard.repeat.rotationsNumber = repeatResult.history.length // 輪動次數
  returnCard.repeat.annualReturn = repeatResult.mean // 年度平均報酬率
  returnCard.repeat.medianAnnualReturn = repeatResult.median // 年度中位數報酬率
  returnCard.repeat.worstAnnualReturn = repeatResult.worst // 最差年度報酬率
  returnCard.repeat.bestAnnualReturn = repeatResult.best // 最佳年度報酬率
  returnCard.repeat.annualReturnLog = repeatResult.annualReturnsLog // 年度報酬率紀錄

  // 不重複進場
  const noRepeatResult = calculateSimulationResult(data, 10000, stocksPerRound.value, false)
  returnCard.noRepeat.totalReturn = noRepeatResult.finalReturn // 總報酬率
  returnCard.noRepeat.maxDrawdownValue = noRepeatResult.maxDrawdown // 區間最大回徹
  returnCard.noRepeat.rotationsNumber = noRepeatResult.history.length // 輪動次數
  returnCard.noRepeat.annualReturn = noRepeatResult.mean // 年度平均報酬率
  returnCard.noRepeat.medianAnnualReturn = noRepeatResult.median // 年度中位數報酬率
  returnCard.noRepeat.worstAnnualReturn = noRepeatResult.worst // 最差年度報酬率
  returnCard.noRepeat.bestAnnualReturn = noRepeatResult.best // 最佳年度報酬率
  returnCard.noRepeat.annualReturnLog = noRepeatResult.annualReturnsLog // 年度報酬率紀錄

  // 總策略計算
  returnCard.averageReturn = averageReturnComputed(data) // 平均報酬率
  returnCard.profitLossRatio = profitLossRatioComputed(data) // 平均賺賠比
  returnCard.medianReturn = medianReturnComputed(data) // 報酬率中位數
  returnCard.winRate = winRateComputed(data) // 勝率

  // 輸出圖表
  if (outputChart.value) {
    buildChart(data) // 報酬率分佈圖
    buildChart1(data) // 每月交易次數分布
    buildChart2(data) // 交易日期報酬分布
    buildChart3(data) // 每年報酬
    buildChart4(data) // 交易月報酬分布
    buildChart5(data) // 交易月最高最低期報酬分布
    buildChart6(repeatResult.history, noRepeatResult.history) // 資金 / 持倉成本 / 資產走勢圖
    buildChart7(data) // 每半年報酬
    // buildChart7(noRepeatResult.history) // 資金 / 持倉成本 / 資產走勢圖
  }
  // 蒙地卡羅模擬測試
  if (monteCarloTest.value) {
    runMonteCarlo(tableData.value, 100, 10000, stocksPerRound.value)
  }
}

// 多策略綜合計算
const dataAnalysisMultiSummary = () => {
  returnCard.backtestType = '多策略綜合計算'
  const data = []
  tableDataMulti.value.forEach(item => {
    item.forEach(item2 => {
      data.push(item2)
    })
  })
  console.log('data', data)
  dataAnalysisSingle2(data)
  if (monteCarloTest.value) {
    runMonteCarlo(data, 100, 10000, stocksPerRound.value)
  }

}

// 多策略分析 分析全部重疊
const dataAnalysisMulti = () => {
  returnCard.backtestType = '多策略分析'
  // console.log(findFullOverlaps([arr, arr2, arr3], ['策略A','策略B','策略C'])); // []

  const result = findFullOverlaps(tableDataMulti.value, fileNames.value)
  dataAnalysisSingle(result)

  console.log('result', result)

  function toDate(s) {
    return new Date(s.replace(/-/g, '/'));
  }
  function fmt(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');d
    return `${y}/${m}/${da}`;
  }

  function mergeIntervals(intervals) {
    if (intervals.length === 0) return [];
    const sorted = intervals
      .map(iv => ({ start: toDate(iv.buyDay), end: toDate(iv.sellDay) }))
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      const cur = sorted[i];
      if (cur.start <= last.end) {
        last.end = new Date(Math.max(+last.end, +cur.end));
      } else {
        merged.push(cur);
      }
    }
    return merged;
  }

  function intersectIntervalLists(a, b) {
    const res = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      const s = new Date(Math.max(+a[i].start, +b[j].start));
      const e = new Date(Math.min(+a[i].end, +b[j].end));
      if (s <= e) res.push({ start: s, end: e });
      if (a[i].end < b[j].end) i++; else j++;
    }
    return res;
  }

  function findFullOverlaps(strategyLists, strategyNames) {
    const N = strategyLists.length;
    if (!strategyNames || strategyNames.length !== N) {
      strategyNames = Array.from({ length: N }, (_, i) => `strategy_${i + 1}`);
    }

    const perStrategyMap = strategyLists.map(list => {
      const map = new Map();
      for (const rec of list) {
        if (!map.has(rec.name)) map.set(rec.name, []);
        map.get(rec.name).push({ buyDay: rec.buyDay, sellDay: rec.sellDay, rec });
      }
      for (const [nm, intervals] of map) {
        map.set(nm, mergeIntervals(intervals));
      }
      return map;
    });

    const namesInAll = (() => {
      const sets = perStrategyMap.map(m => new Set(m.keys()));
      const base = sets[0];
      const res = [];
      for (const nm of base) {
        if (sets.every(s => s.has(nm))) res.push(nm);
      }
      return res;
    })();

    const result = [];
    for (const nm of namesInAll) {
      let inter = perStrategyMap[0].get(nm);
      for (let k = 1; k < N && inter.length > 0; k++) {
        inter = intersectIntervalLists(inter, perStrategyMap[k].get(nm));
      }
      for (const seg of inter) {
        // 這裡用「第一個策略裡的原始物件」當基底，只是多一個 overlapStrategies 欄位
        const sample = strategyLists[0].find(r => r.name === nm);
        result.push({
          ...sample,
          buyDay: fmt(seg.start),
          sellDay: fmt(seg.end),
          overlapStrategies: [...strategyNames]
        });
      }
    }

    return result;
  }

}
// 多策略分析2 分析只重疊兩個策略
const dataAnalysisMulti2 = () => {
  console.log('fileNames.value', fileNames.value)
  returnCard.backtestType = '多策略分析2'
  const result = findNameAndBuyDayOverlaps(tableDataMulti.value, fileNames.value)
  console.log('result', result)
  dataAnalysisSingle(result)
  // 蒙地卡羅
  if (monteCarloTest.value) {
    runMonteCarlo(result, 100, 10000, stocksPerRound.value)
  }

  console.log('getStrategyStats', getStrategyStats(result))


  /**
   * 尋找多個策略之間，"同名字 + 同買入日期" 的重疊紀錄
   * @param {Array<Array<Object>>} strategyLists - 二維陣列，每個內層代表一個策略的交易紀錄
   * @param {Array<string>} fileNames - 策略名稱陣列，index 對應 strategyLists 的 index
   * @returns {Array<Object>} - 所有有重疊的交易紀錄，一維陣列
   */
  function findNameAndBuyDayOverlaps(strategyLists, fileNames) {
    const N = strategyLists.length;

    // 若沒給名字或長度不符，補一組預設名稱
    if (!fileNames || fileNames.length !== N) {
      fileNames = Array.from({ length: N }, (_, i) => `strategy_${i + 1}`);
    }

    // key = name + buyDay
    const keyMap = new Map();

    for (let sIdx = 0; sIdx < N; sIdx++) {
      const strategyName = fileNames[sIdx];
      const trades = strategyLists[sIdx] || [];

      for (const trade of trades) {
        const { name, buyDay } = trade;
        if (!name || !buyDay) continue; // 沒有 name 或 buyDay 的直接略過

        const key = `${name}||${buyDay}`;
        if (!keyMap.has(key)) {
          keyMap.set(key, {
            name,
            buyDay,
            entries: [] // 每一筆：{ strategyIndex, strategyName, record }
          });
        }
        keyMap.get(key).entries.push({
          strategyIndex: sIdx,
          strategyName,
          record: trade,
        });
      }
    }

    const result = [];

    for (const bucket of keyMap.values()) {
      const { entries } = bucket;

      // 看看有幾個不同策略有這個 name+buyDay
      const distinctStrategies = [...new Set(entries.map(e => e.strategyIndex))];
      if (distinctStrategies.length < 2) {
        // 只有一個策略有這檔股票+這個買入日，不算互相重疊
        continue;
      }

      // 有重疊 → 整理有哪些策略名稱（去重、排序，讓順序穩定）
      const overlapStrategies = [...new Set(entries.map(e => e.strategyName))]
        .sort((a, b) => a.localeCompare(b));

      // 將所有參與重疊的原始紀錄輸出，每筆保留原欄位 + overlapStrategies
      for (const entry of entries) {
        result.push({
          ...entry.record,
          overlapStrategies,
        });
      }
    }

    // 為了輸出穩定性，照 buyDay -> name -> code 排序
    const parseDate = (str) => {
      // 假設 str 形如 "2015/01/06" 或 "2015-01-06"
      return new Date(str.replace(/-/g, '/'));
    };

    result.sort((a, b) => {
      const da = parseDate(a.buyDay) - parseDate(b.buyDay);
      if (da !== 0 && !Number.isNaN(da)) return da;

      const nameCmp = (a.name || '').localeCompare(b.name || '');
      if (nameCmp !== 0) return nameCmp;

      return (a.code || '').localeCompare(b.code || '');
    });

    return result;
  }

  /**
   * 統計每個策略出現幾次，並計算每個策略與其它策略共同出現的次數
   * @param {Array<Object>} result - findNameAndBuyDayOverlaps 的輸出結果
   * @returns {Object}
   * {
   *   strategyCount: { 策略名: 次數 },
   *   coCount: { 策略名: { 其它策略名: 次數 } }
   * }
   */
  function getStrategyStats(result) {
    const strategyCount = {};  // 每個策略自身出現次數
    const coCount = {};        // 每個策略與其他策略的共同出現次數

    for (const rec of result) {
      const arr = rec.overlapStrategies;
      if (!arr || arr.length < 2) continue;

      // ---- 計算單策略出現次數 ----
      for (const s of arr) {
        if (!strategyCount[s]) strategyCount[s] = 0;
        strategyCount[s] += 1;
      }

      // ---- 計算策略之間的共同出現次數（pair）----
      // 例如 ["A","B","C"] → AB, AC, BC
      for (let i = 0; i < arr.length; i++) {
        const s1 = arr[i];
        if (!coCount[s1]) coCount[s1] = {};

        for (let j = i + 1; j < arr.length; j++) {
          const s2 = arr[j];

          // s1 → s2
          if (!coCount[s1][s2]) coCount[s1][s2] = 0;
          coCount[s1][s2] += 1;

          // s2 → s1（雙向統計）
          if (!coCount[s2]) coCount[s2] = {};
          if (!coCount[s2][s1]) coCount[s2][s1] = 0;
          coCount[s2][s1] += 1;
        }
      }
    }

    return { strategyCount, coCount };
  }
}

// 資金 / 持倉成本 / 資產走勢圖 重複進場
const buildChart6 = (history, history2) => {

  // 輸出圖表
  // 計算 netAsset（市值 = 現金 + 成本，這裡不含未實現盈虧，純成本）
  const chart = echarts.init(myChartDom6.value)

  chart.setOption({
    title: { text: '資金 / 持倉成本 / 資產走勢圖' },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const i = params[0].dataIndex
        const d = history[i]
        const d2 = history2[i]
        return `
          日期：${d?.buyDay || d.date} / ${d2?.buyDay || d2.date}<br/>
          現金：$${d?.capital.toFixed(2)} / $${d2?.capital.toFixed(2)}<br/>
          總資產：$${parseFloat(d?.netAsset).toFixed(2)} / $${parseFloat(d2?.netAsset).toFixed(2)}<br/>
          報酬率: ${d?.returnRate.toFixed(2)}% / ${d2?.returnRate.toFixed(2)}%
        `
      }
    },
    legend: {
      data: ['現金', '總資產', '現金2', '總資產2']
    },
    xAxis: {
      type: 'category',
      data: history.map(h => h.buyDay || h.date),
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
      },
      {
        name: '現金2',
        type: 'line',
        data: history2.map(h => parseFloat(h.capital))
      },
      {
        name: '總資產2',
        type: 'line',
        data: history2.map(h => parseFloat(h.netAsset))
      }
    ]
  })
}

// 報酬率分佈圖
const buildChart = (data) => {
  const returns = data.map(i => parseFloat(i.return)).filter(r => !isNaN(r)).map(r => r * 100)
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
const buildChart1 = (data) => {
  const monthlyStats = {}

  data.forEach(item => {
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

  if (!myChartDom1.value) return

  const chart = echarts.init(myChartDom1.value)
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
const buildChart2 = (data) => {
  const dayStats = {}

  // 初始化 1～31 號
  for (let d = 1; d <= 31; d++) {
    dayStats[d] = []
  }

  // 分類進入各日期
  data.forEach(item => {
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
  if (!myChartDom2.value) return
  const chart = echarts.init(myChartDom2.value)
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
const buildChart4 = (data) => {
  const monthStats = {}

  // 初始化 1～12 月
  for (let m = 1; m <= 12; m++) {
    monthStats[m] = []
  }

  // 將報酬值分類到對應的月份
  data.forEach(item => {
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
  const chart = echarts.init(myChartDom4.value)
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
const buildChart5 = (data) => {
  const monthStats = {}

  // 初始化 1～12 月
  for (let m = 1; m <= 12; m++) {
    monthStats[m] = []
  }

  // 將報酬分類到對應月份
  data.forEach(item => {
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

  const chart = echarts.init(myChartDom5.value)
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
const buildChart3 = (data) => {
  const yearlyStats = {}

  data.forEach(item => {
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

  const chart = echarts.init(myChartDom3.value)
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

// 統計每半年滾動報酬
const buildChart7 = (data) => {
  const halfStats = {}

  data.forEach(item => {
    const day = item.buyDay
    const r = parseFloat(item.return)
    if (!day || isNaN(r)) return

    const year = day.slice(0, 4)
    const month = parseInt(day.slice(5, 7))
    const half = month <= 6 ? 'H1' : 'H2'
    const key = `${year}-${half}`

    if (!halfStats[key]) halfStats[key] = []
    halfStats[key].push(r * 100) // 轉百分比
  })

  const periods = Object.keys(halfStats).sort()
  const avgReturns = []
  const medianReturns = []
  const winRates = []
  const counts = []

  for (const p of periods) {
    const list = halfStats[p]
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

  const chart = echarts.init(myChartDom7.value)
  chart.setOption({
    title: { text: '每半年交易統計' },
    tooltip: {
      trigger: 'axis',
      formatter: function (params) {
        const i = params[0].dataIndex
        return `
          期間：${periods[i]}<br/>
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
      data: periods,
      name: '期間',
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
