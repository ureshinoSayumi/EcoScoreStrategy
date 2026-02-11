<template>
  <div class="analysis-container">
    <el-card shadow="hover" class="control-panel">
      <template #header>
        <div class="card-header">
          <span>參數設定</span>
        </div>
      </template>
      <el-form :inline="true" class="demo-form-inline">
        <el-form-item label="檔案上傳">
          <input type="file" accept=".csv" multiple @change="handleFile" class="file-input" />
        </el-form-item>
        <el-form-item label="已選檔案">
          <el-tag v-for="name in fileNames" :key="name" class="mx-1" closable @close="removeFile(name)">{{ name }}</el-tag>
          <span v-if="fileNames.length === 0" class="text-gray-400">未選擇檔案</span>
        </el-form-item>
        <el-form-item label="範例檔案">
           <el-select
              v-model="selectedServerFiles"
              multiple
              filterable
              collapse-tags
              placeholder="請選擇範例檔案"
              style="width: 240px; margin-right: 10px;"
            >
              <el-option
                v-for="item in SERVER_FILES"
                :key="item"
                :label="item"
                :value="item"
              />
            </el-select>
            <el-button type="primary" plain @click="loadServerFiles">載入</el-button>
        </el-form-item>
      </el-form>

      <el-divider content-position="left">進階設定</el-divider>

      <div class="setting-group">
        <el-form-item label="持有限制">
          <el-input-number v-model="stocksPerRound" :min="0" size="default" />
        </el-form-item>
        <el-form-item label="輸出圖表">
          <el-switch v-model="outputChart" inline-prompt active-text="是" inactive-text="否" />
        </el-form-item>
        <el-form-item label="蒙地卡羅模擬">
          <el-switch v-model="monteCarloTest" inline-prompt active-text="開啟" inactive-text="關閉" />
        </el-form-item>
        <el-form-item label="多策略比較">
          <el-switch v-model="multiStrategyTest" inline-prompt active-text="開啟" inactive-text="關閉" />
        </el-form-item>
        <el-form-item label="選持續上漲">
          <el-switch v-model="selectContinuousUp" inline-prompt active-text="是" inactive-text="否" />
        </el-form-item>
        <el-form-item label="一日買入多次">
          <el-switch v-model="dayBuyRepeat" inline-prompt active-text="可重複" inactive-text="不可重複" />
        </el-form-item>
      </div>

      <div class="action-buttons">
        <el-button type="primary" :disabled="multiStrategyTest" @click="dataAnalysisSingle(tableData)">單策略分析</el-button>
        <el-button type="success" :disabled="multiStrategyTest" @click="dataAnalysisSingle2(tableData)">單策略分析2</el-button>
        <el-button type="warning" :disabled="!multiStrategyTest" @click="dataAnalysisMulti()">多策略分析2</el-button>
        <el-button type="danger" :disabled="!multiStrategyTest" @click="dataAnalysisMultiSummary()">多策略綜合計算</el-button>
      </div>
    </el-card>

    <div class="results-section">
      <el-row :gutter="20">
        <!-- 重複進場結果 -->
        <el-col :span="12">
          <el-card shadow="hover" class="result-card">
            <template #header>
              <div class="card-header">
                <strong>重複進場</strong>
                <el-tag size="small" type="info">{{ returnCard.backtestType || '尚未分析' }}</el-tag>
              </div>
            </template>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="平均報酬">{{ returnCard.averageReturn.toFixed(2) }}%</el-descriptions-item>
              <el-descriptions-item label="交易筆數">{{ multiStrategyTest ? tableDataMulti.length : tableData.length }}</el-descriptions-item>
              <el-descriptions-item label="平均賺賠比">{{ returnCard.profitLossRatio.toFixed(2) }}</el-descriptions-item>
              <el-descriptions-item label="報酬中位數">{{ returnCard.medianReturn.toFixed(2) }}%</el-descriptions-item>
              <el-descriptions-item label="勝率">{{ returnCard.winRate.toFixed(2) }}%</el-descriptions-item>
              <el-descriptions-item label="夏普值">{{ returnCard.repeat.sharpeRatio.toFixed(4) }}</el-descriptions-item>
            </el-descriptions>

            <el-divider content-position="center">模擬回測詳情</el-divider>

            <el-descriptions :column="1" border size="small" class="detail-desc">
              <el-descriptions-item label="總報酬">{{ returnCard.repeat.totalReturn }}</el-descriptions-item>
              <el-descriptions-item label="區間最大回撤">{{ returnCard.repeat.maxDrawdownValue }}%</el-descriptions-item>
              <el-descriptions-item label="年度平均報酬">{{ returnCard.repeat.annualReturn }}%</el-descriptions-item>
              <el-descriptions-item label="年度中位數報酬">{{ returnCard.repeat.medianAnnualReturn }}%</el-descriptions-item>
              <el-descriptions-item label="最佳/最差年度">{{ returnCard.repeat.bestAnnualReturn }}% / {{ returnCard.repeat.worstAnnualReturn }}%</el-descriptions-item>
              <el-descriptions-item label="輪動次數">{{ returnCard.repeat.rotationsNumber }}</el-descriptions-item>
              <el-descriptions-item label="表格數據">年化/平均/中位/勝率/筆數</el-descriptions-item>
            </el-descriptions>
             <div class="year-log">
                <p v-for="item in returnCard.repeat.annualReturnLog" :key="item.year" class="log-item">
                  <span class="year">{{ item.year }}</span>
                   <span class="val" :class="getReturnColorClass(item.return)">
                    {{ item.return.toFixed(2) }}%
                    <small class="sub-val" v-if="item.avgReturns">
                      / {{ item.avgReturns }}% / {{ item.medianReturns }}% / {{ item.winRates }}% / {{ item.counts }}筆
                    </small>
                   </span>
                </p>
             </div>
          </el-card>
        </el-col>

        <!-- 不重複進場結果 -->
        <el-col :span="12">
          <el-card shadow="hover" class="result-card">
            <template #header>
              <div class="card-header">
                <strong>不重複進場</strong>
                <el-tag size="small" type="info">{{ returnCard.backtestType || '尚未分析' }}</el-tag>
              </div>
            </template>
            <el-descriptions :column="2" border size="small">
               <el-descriptions-item label="平均報酬">{{ returnCard.averageReturn.toFixed(2) }}%</el-descriptions-item>
              <el-descriptions-item label="交易筆數">{{ multiStrategyTest ? tableDataMulti.length : tableData.length }}</el-descriptions-item>
              <el-descriptions-item label="平均賺賠比">{{ returnCard.profitLossRatio.toFixed(2) }}</el-descriptions-item>
              <el-descriptions-item label="報酬中位數">{{ returnCard.medianReturn.toFixed(2) }}%</el-descriptions-item>
              <el-descriptions-item label="勝率">{{ returnCard.winRate.toFixed(2) }}%</el-descriptions-item>
              <el-descriptions-item label="夏普值">{{ returnCard.noRepeat.sharpeRatio.toFixed(4) }}</el-descriptions-item>
            </el-descriptions>

            <el-divider content-position="center">模擬回測詳情</el-divider>

            <el-descriptions :column="1" border size="small" class="detail-desc">
              <el-descriptions-item label="總報酬">{{ returnCard.noRepeat.totalReturn }}</el-descriptions-item>
              <el-descriptions-item label="區間最大回撤">{{ returnCard.noRepeat.maxDrawdownValue }}%</el-descriptions-item>
              <el-descriptions-item label="年度平均報酬">{{ returnCard.noRepeat.annualReturn }}%</el-descriptions-item>
              <el-descriptions-item label="年度中位數報酬">{{ returnCard.noRepeat.medianAnnualReturn }}%</el-descriptions-item>
              <el-descriptions-item label="最佳/最差年度">{{ returnCard.noRepeat.bestAnnualReturn }}% / {{ returnCard.noRepeat.worstAnnualReturn }}%</el-descriptions-item>
              <el-descriptions-item label="輪動次數">{{ returnCard.noRepeat.rotationsNumber }}</el-descriptions-item>
              <el-descriptions-item label="表格數據">年化/平均/中位/勝率/筆數</el-descriptions-item>
            </el-descriptions>
             <div class="year-log">
                <p v-for="item in returnCard.noRepeat.annualReturnLog" :key="item.year" class="log-item">
                  <span class="year">{{ item.year }}</span>
                   <span class="val" :class="getReturnColorClass(item.return)">
                    {{ item.return.toFixed(2) }}%
                    <small class="sub-val" v-if="item.avgReturns">
                      / {{ item.avgReturns }}% / {{ item.medianReturns }}% / {{ item.winRates }}% / {{ item.counts }}筆
                    </small>
                   </span>
                </p>
             </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- Charts Area -->
    <el-card shadow="never" class="chart-container-card">
       <el-tabs v-model="activeTab" type="border-card" @tab-click="resizeCharts">
          <el-tab-pane label="總覽" name="overview">
             <div class="chart-wrapper">
                <h4>資金 / 持倉成本 / 資產走勢圖 (重複進場 vs 不重複)</h4>
                <div ref="myChartDom6" class="chart"></div>
             </div>
             <div class="chart-wrapper">
                <h4>報酬率分佈圖</h4>
                <div ref="myChartDom" class="chart"></div>
             </div>
          </el-tab-pane>

          <el-tab-pane label="時間統計" name="time">
             <el-row :gutter="20">
               <el-col :span="12">
                 <div class="chart-wrapper">
                    <h4>每月交易次數分布</h4>
                    <div ref="myChartDom1" class="chart"></div>
                 </div>
               </el-col>
               <el-col :span="12">
                  <div class="chart-wrapper">
                    <h4>交易日期報酬分布 (1-31號)</h4>
                    <div ref="myChartDom2" class="chart"></div>
                  </div>
               </el-col>
             </el-row>
             <el-row :gutter="20">
               <el-col :span="12">
                  <div class="chart-wrapper">
                    <h4>交易月報酬分布 (1-12月)</h4>
                    <div ref="myChartDom4" class="chart"></div>
                  </div>
               </el-col>
               <el-col :span="12">
                  <div class="chart-wrapper">
                    <h4>交易月最高最低報酬</h4>
                    <div ref="myChartDom5" class="chart"></div>
                  </div>
               </el-col>
             </el-row>
          </el-tab-pane>

          <el-tab-pane label="績效滾動" name="rolling">
            <div class="chart-wrapper">
               <h4>每半年滾動報酬</h4>
               <div ref="myChartDom7" class="chart"></div>
            </div>
             <div class="chart-wrapper">
                <h4>每年滾動報酬</h4>
                <div ref="myChartDom3" class="chart"></div>
             </div>
             <div class="chart-wrapper">
                <h4>買入標的每年滾動報酬</h4>
                <div ref="myChartDom11" class="chart"></div>
             </div>
          </el-tab-pane>

          <el-tab-pane label="標的分析" name="stock">
             <div class="chart-wrapper">
                <h4>持股分散度</h4>
                <div ref="myChartDom8" class="chart"></div>
             </div>
             <div class="chart-wrapper">
                <h4>買入股票與平均報酬率</h4>
                <div ref="myChartDom9" class="chart"></div>
             </div>
             <div class="chart-wrapper">
                <h4>買入股票與平均報酬率比較</h4>
                <div ref="myChartDom10" class="chart"></div>
             </div>
          </el-tab-pane>
       </el-tabs>
    </el-card>

    <!-- Hidden Table for logic compatibility (or useful for debug) -->
    <el-collapse v-if="false" style="margin-top: 20px;">
        <el-collapse-item title="原始交易數據表格 (除錯用)">
          <el-table :data="tableData" height="400" border stripe size="small">
             <el-table-column prop="name" label="商品名稱" sortable />
             <el-table-column prop="code" label="商品代碼" sortable />
             <el-table-column prop="buyDay" label="進場時間" sortable />
             <el-table-column prop="buyPrice" label="進場價格" />
             <el-table-column prop="sellDay" label="出場時間" sortable />
             <el-table-column prop="sellPrice" label="出場價格" />
             <el-table-column prop="return" label="報酬率" sortable>
               <template #default="scope">{{ (Number(scope.row.return)*100).toFixed(2) }}%</template>
             </el-table-column>
          </el-table>
        </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script lang="ts" setup>
import { parseCSV } from '@/utils/csvReader';
import { businessSignals } from '@/utils/data/businessSignals.js'; // 景氣指標
import * as echarts from 'echarts';
import Papa from 'papaparse';
import { nextTick, reactive, ref } from 'vue';
import { calculateSimulationResult, calculateSimulationResult2, runMonteCarlo } from './utils/monteCarloMethod';

// UI 狀態
const activeTab = ref('overview');

// 資料
const tableData = ref([]) // 交易資料
const tableDataMulti = ref([]) // 多策略交易資料

// 圖表 DOM Refs
const myChartDom = ref() // 報酬率分佈圖
const myChartDom1 = ref() // 每月交易次數分布
const myChartDom2 = ref() // 交易日期報酬分布
const myChartDom3 = ref() // 每年報酬
const myChartDom4 = ref() // 交易月報酬分布
const myChartDom5 = ref() // 交易月最高最低期報酬分布
const myChartDom6 = ref() // 資金 / 持倉成本 / 資產走勢圖 重複進場
const myChartDom7 = ref() // 每半年報酬
const myChartDom8 = ref() // 持股分散度
const myChartDom9 = ref() // 買入股票與平均報酬率
const myChartDom10 = ref() // 買入股票與平均報酬率比較
const myChartDom11 = ref() // 買入標的每年滾動報酬

// 圖表實例儲存（用於調整大小）
const chartInstances = {
    c0: null, c1: null, c2: null, c3: null, c4: null, c5: null, c6: null, c7: null, c8: null, c9: null, c10: null, c11: null
}

const visData = reactive({
  data: [],
  repeatHistory: [],
  noRepeatHistory: [],
  repeatDist: {},
  noRepeatDist: {},
  allBuyStocks: []
})

// 參數設定
const fileNames = ref([]) // 檔案名稱
const stocksPerRound = ref(10) // 持有限制
const outputChart = ref(true) // 是否輸出圖表
const monteCarloTest = ref(false) // 蒙地卡羅模擬測試
const multiStrategyTest = ref(false) // 多策略比較
const selectContinuousUp = ref(false) // 選持續上漲的
const dayBuyRepeat = ref(true) // 一日買入多次

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
    positionDistribution: {}, // 持股分散度
    stockNameMap: {}, // 股票名稱紀錄
    sharpeRatio: 0, // 夏普值
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
    positionDistribution: {}, // 持股分散度
    stockNameMap: {}, // 股票名稱紀錄
    sharpeRatio: 0, // 夏普值
  },
})

// 工具函數：顏色判斷
const getReturnColorClass = (val) => {
    if(val > 0) return 'text-red-500 font-bold';
    if(val < 0) return 'text-green-500 font-bold';
    return 'text-gray-500';
}

const removeFile = (name) => {
    const idx = fileNames.value.indexOf(name);
    if(idx > -1) {
        fileNames.value.splice(idx, 1);
        // 若需要連同資料一起移除需更複雜邏輯，這裡僅移除 UI 顯示
        // 建議清空重選
        if(fileNames.value.length === 0) {
            tableData.value = [];
            tableDataMulti.value = [];
        }
    }
}

// 切換分頁時調整/渲染圖表
const resizeCharts = () => {
    nextTick(() => {
        // 調整現有圖表大小 (僅調整可見的圖表)
        Object.values(chartInstances).forEach(c => {
            if (c) {
                const dom = c.getDom();
                if (dom && dom.offsetWidth > 0 && dom.offsetHeight > 0) {
                    c.resize();
                }
            }
        });
        // 若尚未渲染，嘗試渲染當前分頁的圖表
        renderCharts();
    })
}

// 根據當前分頁渲染可見圖表
const renderCharts = () => {
  nextTick(() => {
    if (activeTab.value === 'overview') {
        if(visData.repeatHistory.length) buildChart6(visData.repeatHistory, visData.noRepeatHistory)
        if(visData.data.length) buildChart(visData.data)
    } else if (activeTab.value === 'time') {
        if(visData.data.length) {
            buildChart1(visData.data)
            buildChart2(visData.data)
            buildChart4(visData.data)
            buildChart5(visData.data)
        }
    } else if (activeTab.value === 'rolling') {
        if(visData.data.length) {
             buildChart3(visData.data)
             buildChart7(visData.data)
        }
        if(visData.allBuyStocks.length) buildChart11(visData.allBuyStocks)
    } else if (activeTab.value === 'stock') {
        if(Object.keys(visData.repeatDist).length) buildChart8(visData.repeatDist, visData.noRepeatDist)
        if(visData.data.length) {
            buildChart10(visData.data)
        }
    }
  })
}

// 初始化或獲取圖表的輔助函數
const initChart = (domRef, key) => {
    if (!domRef || domRef.clientWidth === 0 || domRef.clientHeight === 0) return null;
    let chart = echarts.getInstanceByDom(domRef);
    if (!chart) {
        chart = echarts.init(domRef);
        chartInstances[key] = chart;
    }
    return chart;
}

// ---------------- 以下為原始邏輯 ----------------

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
  const returns = data.map(i => parseFloat(i.return)).filter(r => !isNaN(r))
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
  const returns = data.map(i => parseFloat(i.return)).filter(r => !isNaN(r))
  if (returns.length === 0) return 0
  const winCount = returns.filter(r => r > 0).length
  return (winCount / returns.length) * 100
})

// 計算夏普值
// data: 歷史資料
// annualRf: 年度無風險利率
// tradingDays: 一年交易天數
// useLogReturn: 是否使用對數報酬率
// 回傳值: 夏普值
const sharpeRatioComputed = (data, { annualRf = 0.0, tradingDays = 252, useLogReturn = false } = {}) => {
  if (!Array.isArray(data) || data.length < 2) return 0

  // 1) sort by date asc (保險起見)
  const sorted = [...data].sort((a, b) => String(a.date).localeCompare(String(b.date)))

  // 2) build daily returns
  const returns = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = Number(sorted[i - 1].netAsset)
    const curr = Number(sorted[i].netAsset)
    if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev <= 0 || curr <= 0) continue
    const r = useLogReturn ? Math.log(curr / prev) : (curr / prev - 1)
    if (Number.isFinite(r)) returns.push(r)
  }
  const n = returns.length
  if (n < 2) return 0

  // 3) daily risk-free (近似)
  const rfDaily = (1 + annualRf) ** (1 / tradingDays) - 1

  // 4) mean & sample std (n-1)
  const mean = returns.reduce((a, b) => a + b, 0) / n
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)
  const std = Math.sqrt(variance)
  if (std === 0) return 0
  const sharpeDaily = (mean - rfDaily) / std
  return sharpeDaily * Math.sqrt(tradingDays)
}


// 伺服器端檔案列表
const SERVER_FILES = [
  "低成交量均線多頭.csv",
  "動能市值前段班.csv",
  "動能市值前段班_贏過大盤.csv",
  "動能成長股.csv",
  "動能成長股_贏過大盤.csv",
  "動能成長股_贏過大盤_取代均線多頭.csv",
  "基本面同業前30_2015-2025_不成交量篩選.csv",
  "小股本.csv",
  "小股本_贏過大盤.csv",
  "小股本_贏過大盤取代均線多頭.csv",
  "本益比低於歷史.csv",
  "營業利益率創新高.csv",
  "營業利益率創新高_不成交量篩選.csv",
  "營業利益率創新高_成交量大.csv",
  "穩定獲利低本益比.csv",
  "穩定獲利低本益比_贏過大盤.csv",
  "穩定獲利低本益比_贏過大盤_取代均線多頭.csv",
  "穩定發股利高殖利率.csv",
  "穩定發股利高殖利率_贏過大盤.csv",
  "穩定發股利高殖利率_贏過大盤_取代均線多頭.csv",
  "贏過大盤bata.csv"
];

const selectedServerFiles = ref([]);

// 處理並格式化 CSV 數據的通用函數
const processData = (data, filename) => {
  const formatterData = data.map(item => {
    return {
        name: item["商品名稱"],
        code: item["商品代碼"],
        index: item["序號"],
        buyDay: item["進場時間"],
        buyPrice: item["進場價格"],
        sellDay: item["出場時間"],
        sellPrice: item["出場價格"],
        return: item["報酬率"],
        // note: item["訊息"],
        // sell: item // 若你仍要保留完整原始資料
      }
  })

  if (multiStrategyTest.value) {
    if(!fileNames.value.includes(filename)){
        tableDataMulti.value.push(formatterData)
        fileNames.value.push(filename)
    }
  } else {
    fileNames.value.push(filename)
    document.title = filename; // 修改網頁標籤的標題
    tableData.value =  formatterData
  }
}

// 處理本地檔案上傳
const handleFile = async (event) => {
  const files = event.target.files;
  if (!files || files.length === 0) return

  // 支援多檔選取
  for(let i=0; i<files.length; i++) {
        const file = files[i];
        const data = await parseCSV(file);
        processData(data, file.name);
  }
}

// 載入伺服器端檔案
const loadServerFiles = async () => {
    if(selectedServerFiles.value.length === 0) return;

    // 清空單策略模式下的舊資料，若是多策略則不清空以利疊加
    if (!multiStrategyTest.value) {
        fileNames.value = [];
        tableData.value = [];
    }

    for (const filename of selectedServerFiles.value) {
        try {
            const response = await fetch(`/2015-20251231/${filename}`);
            if (!response.ok) throw new Error(`Fetch error: ${response.status}`);
            const text = await response.text();

            // PapaParse 也可以解析字串
            const result = Papa.parse(text, { header: true, skipEmptyLines: true });
            if(result.errors.length) {
                console.error(`CSV Parse Error for ${filename}:`, result.errors);
            }
            processData(result.data, filename);

        } catch (e) {
            console.error(`Failed to load ${filename}:`, e);
        }
    }
    // 載入後清空選擇，避免混亂
    selectedServerFiles.value = [];
}

const dataAnalysisSingle2 = (data) => {
  const repeatResult = calculateSimulationResult2(data, 10000, stocksPerRound.value, true, dayBuyRepeat.value)
  returnCard.repeat.totalReturn = repeatResult.finalReturn // 總報酬率
  returnCard.repeat.maxDrawdownValue = repeatResult.maxDrawdown // 區間最大回徹
  returnCard.repeat.rotationsNumber = repeatResult.rotations // 輪動次數
  returnCard.repeat.annualReturn = repeatResult.mean // 年度平均報酬率
  returnCard.repeat.medianAnnualReturn = repeatResult.median // 年度中位數報酬率
  returnCard.repeat.worstAnnualReturn = repeatResult.worst // 最差年度報酬率
  returnCard.repeat.bestAnnualReturn = repeatResult.best // 最佳年度報酬率
  returnCard.repeat.annualReturnLog = repeatResult.annualReturnsLog // 年度報酬率紀錄
  returnCard.repeat.positionDistribution = repeatResult.positionDistribution // 持股分散度
  returnCard.repeat.stockNameMap = repeatResult.stockNameMap // 股票名稱紀錄
  returnCard.repeat.sharpeRatio = sharpeRatioComputed(repeatResult.history) // 夏普值

  const noRepeatResult = calculateSimulationResult2(data, 10000, stocksPerRound.value, false, dayBuyRepeat.value)
  returnCard.noRepeat.totalReturn = noRepeatResult.finalReturn // 總報酬率
  returnCard.noRepeat.maxDrawdownValue = noRepeatResult.maxDrawdown // 區間最大回徹
  returnCard.noRepeat.rotationsNumber = noRepeatResult.rotations // 輪動次數
  returnCard.noRepeat.annualReturn = noRepeatResult.mean // 年度平均報酬率
  returnCard.noRepeat.medianAnnualReturn = noRepeatResult.median // 年度中位數報酬率
  returnCard.noRepeat.worstAnnualReturn = noRepeatResult.worst // 最差年度報酬率
  returnCard.noRepeat.bestAnnualReturn = noRepeatResult.best // 最佳年度報酬率
  returnCard.noRepeat.annualReturnLog = noRepeatResult.annualReturnsLog // 年度報酬率紀錄
  returnCard.noRepeat.positionDistribution = noRepeatResult.positionDistribution // 持股分散度
  returnCard.noRepeat.stockNameMap = noRepeatResult.stockNameMap // 股票名稱紀錄
  returnCard.noRepeat.sharpeRatio = sharpeRatioComputed(noRepeatResult.history) // 夏普值

  // 計算年度日誌的詳細統計數據（恢復原始邏輯）
  updateAnnualLogStats(data, returnCard.noRepeat.annualReturnLog);
  // 可選：如果需要，也更新重複進場日誌，儘管原始版本僅在圖表中明確顯示不重複進場
  updateAnnualLogStats(data, returnCard.repeat.annualReturnLog);


  returnCard.averageReturn = averageReturnComputed(data)
  returnCard.profitLossRatio = profitLossRatioComputed(data)
  returnCard.medianReturn = medianReturnComputed(data)
  returnCard.winRate = winRateComputed(data)

  // Update Visual Data
  visData.data = data;
  visData.repeatHistory = repeatResult.history;
  visData.noRepeatHistory = noRepeatResult.history;
  visData.repeatDist = returnCard.repeat.positionDistribution;
  visData.noRepeatDist = returnCard.noRepeat.positionDistribution;
  visData.allBuyStocks = noRepeatResult.allBuyStocks;

  if (outputChart.value) {
    renderCharts();
  }

  if (monteCarloTest.value) {
    runMonteCarlo(tableData.value, 100, 10000, stocksPerRound.value)
  }
}

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

  data = selectContinuousUp.value ? findHigherBuyItems(data) : data
  const repeatResult = calculateSimulationResult(data, 10000, stocksPerRound.value, true)
  returnCard.repeat.totalReturn = repeatResult.finalReturn // 總報酬率
  returnCard.repeat.maxDrawdownValue = repeatResult.maxDrawdown // 區間最大回徹
  returnCard.repeat.rotationsNumber = repeatResult.history.length // 輪動次數
  returnCard.repeat.annualReturn = repeatResult.mean // 年度平均報酬率
  returnCard.repeat.medianAnnualReturn = repeatResult.median // 年度中位數報酬率
  returnCard.repeat.worstAnnualReturn = repeatResult.worst // 最差年度報酬率
  returnCard.repeat.bestAnnualReturn = repeatResult.best // 最佳年度報酬率
  returnCard.repeat.annualReturnLog = repeatResult.annualReturnsLog // 年度報酬率紀錄

  const noRepeatResult = calculateSimulationResult(data, 10000, stocksPerRound.value, false)
  returnCard.noRepeat.totalReturn = noRepeatResult.finalReturn // 總報酬率
  returnCard.noRepeat.maxDrawdownValue = noRepeatResult.maxDrawdown // 區間最大回徹
  returnCard.noRepeat.rotationsNumber = noRepeatResult.history.length // 輪動次數
  returnCard.noRepeat.annualReturn = noRepeatResult.mean // 年度平均報酬率
  returnCard.noRepeat.medianAnnualReturn = noRepeatResult.median // 年度中位數報酬率
  returnCard.noRepeat.worstAnnualReturn = noRepeatResult.worst // 最差年度報酬率
  returnCard.noRepeat.bestAnnualReturn = noRepeatResult.best // 最佳年度報酬率
  returnCard.noRepeat.annualReturnLog = noRepeatResult.annualReturnsLog // 年度報酬率紀錄

  // 計算詳細統計數據
  updateAnnualLogStats(data, returnCard.noRepeat.annualReturnLog);
  updateAnnualLogStats(data, returnCard.repeat.annualReturnLog);

  returnCard.averageReturn = averageReturnComputed(data)
  returnCard.profitLossRatio = profitLossRatioComputed(data)
  returnCard.medianReturn = medianReturnComputed(data)
  returnCard.winRate = winRateComputed(data)

  // 更新視覺化數據
  visData.data = data;
  visData.repeatHistory = repeatResult.history;
  visData.noRepeatHistory = noRepeatResult.history;
  // 注意：此函數通常不產生完整的分佈數據，或數據為空，但我們仍更新
  visData.repeatDist = {};
  visData.noRepeatDist = {};
  visData.allBuyStocks = []; // 若有需要可推導

  if (outputChart.value) {
    renderCharts();
  }
  if (monteCarloTest.value) {
    runMonteCarlo(tableData.value, 100, 10000, stocksPerRound.value)
  }
}

const dataAnalysisMultiSummary = () => {
  returnCard.backtestType = '多策略綜合計算'
  const data = []
  tableDataMulti.value.forEach(item => {
    item.forEach(item2 => {
      data.push(item2)
    })
  })
  dataAnalysisSingle2(data)
  if (monteCarloTest.value) {
    runMonteCarlo(data, 100, 10000, stocksPerRound.value)
  }
}

const dataAnalysisMulti = () => {
  returnCard.backtestType = '多策略分析2'
  const result = findNameAndBuyDayOverlaps(tableDataMulti.value, fileNames.value)
  dataAnalysisSingle2(result)
  if (monteCarloTest.value) {
    runMonteCarlo(result, 10, 10000, stocksPerRound.value)
  }
  console.log('getStrategyStats', getStrategyStats(result))


  /**
   * 尋找多個策略之間，"同名字 + 同買入日期" 的重疊紀錄
   * @param {Array<Array<Object>>} strategyLists - 二維陣列，每個內層代表一個策略的ㄇ交易紀錄
   * @param {Array<string>} fileNames - 策略名稱陣列，index 對應 strategyLists 的 index
   * @returns {Array<Object>} - 所有有重疊的交易紀錄，一維陣列
   */
  function findNameAndBuyDayOverlaps(strategyLists, fileNames) {
    const N = strategyLists.length;
    if (!fileNames || fileNames.length !== N) {
      fileNames = Array.from({ length: N }, (_, i) => `strategy_${i + 1}`);
    } else {
        // 若沒給名字或長度不符，補一組預設名稱
    }
    // key = name + buyDay
    const keyMap = new Map();
    for (let sIdx = 0; sIdx < N; sIdx++) {
      const strategyName = fileNames[sIdx];
      const trades = strategyLists[sIdx] || [];
      for (const trade of trades) {
        const { name, buyDay } = trade;
        if (!name || !buyDay) continue;
        const key = `${name}||${buyDay}`;
        if (!keyMap.has(key)) {
          keyMap.set(key, { name, buyDay, entries: [] }); // 每一筆：{ strategyIndex, strategyName, record }
        }
        keyMap.get(key).entries.push({ strategyIndex: sIdx, strategyName, record: trade });
      }
    }
    const result = [];
    for (const bucket of keyMap.values()) {
      const { entries } = bucket;
      const distinctStrategies = [...new Set(entries.map(e => e.strategyIndex))];
      if (distinctStrategies.length < 2) {
          // 只有一個策略有這檔股票+這個買入日，不算互相重疊
          continue;
      }
      // 有重疊 → 整理有哪些策略名稱（去重、排序，讓順序穩定）
      const overlapStrategies = [...new Set(entries.map(e => e.strategyName))].sort((a, b) => a.localeCompare(b));

      // 將所有參與重疊的原始紀錄輸出，每筆保留原欄位 + overlapStrategies
      for (const entry of entries) {
        result.push({ ...entry.record, overlapStrategies });
      }
    }
    // 為了輸出穩定性，照 buyDay -> name -> code 排序
    const parseDate = (str) => new Date(str.replace(/-/g, '/')); // 假設 str 形如 "2015/01/06" 或 "2015-01-06"
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
    // 每個策略自身出現次數
    const strategyCount = {};
    // 每個策略與其他策略的共同出現次數
    const coCount = {};
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

// 協助更新年度日誌詳細統計數據（從原始 buildChart3 提取）
const updateAnnualLogStats = (data, logArray) => {
    if(!logArray || !logArray.length) return;

    const yearlyStats = {}
    data.forEach(item => {
        const year = item.buyDay?.slice(0, 4)
        const r = parseFloat(item.return)
        if (!year || isNaN(r)) return
        if (!yearlyStats[year]) yearlyStats[year] = []
        yearlyStats[year].push(r * 100)
    })

    logArray.forEach(item => {
        const list = yearlyStats[item.year]
        if(list && list.length) {
            const n = list.length
            const win = list.filter(r => r > 0).length
            const avg = list.reduce((a, b) => a + b, 0) / n
            const sorted = [...list].sort((a, b) => a - b)
            const median = n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2

            item.avgReturns = avg.toFixed(2)
            item.medianReturns = median.toFixed(2)
            item.winRates = ((win / n) * 100).toFixed(2)
            item.counts = n
        } else {
             item.avgReturns = '0.00'
             item.medianReturns = '0.00'
             item.winRates = '0.00'
             item.counts = 0
        }
    })
}

// 圖表構建器 - 稍作重構以分配給適當的引用並使用新容器
const buildChart6 = (history, history2) => {
  if(!myChartDom6.value) return;
  const chart = initChart(myChartDom6.value, 'c6');
  if(!chart) return;

  // 計算 netAsset（市值 = 現金 + 成本，這裡不含未實現盈虧，純成本）
  chart.setOption({
    title: { text: '' }, // 標題已在介面中，故移除
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
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: history.map(h => h.buyDay || h.date),
      axisLabel: { rotate: 45 }
    },
    yAxis: { type: 'value', name: '金額（元）' },
    series: [
      { name: '現金', type: 'line', data: history.map(h => parseFloat(h.capital)) },
      { name: '總資產', type: 'line', data: history.map(h => parseFloat(h.netAsset)) },
      { name: '現金2', type: 'line', data: history2.map(h => parseFloat(h.capital)) },
      { name: '總資產2', type: 'line', data: history2.map(h => parseFloat(h.netAsset)) }
    ]
  })
}

const buildChart = (data) => {
  const returns = data.map(i => parseFloat(i.return)).filter(r => !isNaN(r)).map(r => r * 100)
  const binWidth = 5
  if(returns.length === 0) return;
  const min = Math.floor(Math.min(...returns) / binWidth) * binWidth
  const max = Math.ceil(Math.max(...returns) / binWidth) * binWidth
  const labels = [], bins = []
  for (let i = min; i < max; i += binWidth) {
    const from = i, to = i + binWidth
    labels.push(`${from}~${to}%`)
    bins.push(returns.filter(r => r >= from && r < to).length)
  }
  if (!myChartDom.value) return
  const chart = initChart(myChartDom.value, 'c0');
  if(!chart) return;

  chart.setOption({
    title: { text: '' },
    tooltip: { trigger: 'item' },
    grid: { containLabel: true },
    xAxis: { type: 'category', name: '報酬區間', data: labels, axisLabel: { rotate: 45 } },
    yAxis: { type: 'value', name: '筆數' },
    series: [{ type: 'bar', data: bins, name: '出現次數' }]
  })
}

const buildChart1 = (data) => {
  const monthlyStats = {}
  data.forEach(item => {
    const month = item.buyDay?.slice(0, 7).replace('/', '-')
    const r = parseFloat(item.return)
    if (!month || isNaN(r)) return
    if (!monthlyStats[month]) monthlyStats[month] = []
    monthlyStats[month].push(r * 100)
  })
  const sortedMonths = Object.keys(monthlyStats).sort()
  const avgReturns = [], medianReturns = [], winRates = [], counts = [], scores = []
  for (const month of sortedMonths) {
    const list = monthlyStats[month]
    const n = list.length
    const win = list.filter(r => r > 0).length
    const avg = list.reduce((a, b) => a + b, 0) / n
    const sorted = [...list].sort((a, b) => a - b)
    const median = n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    avgReturns.push(avg.toFixed(2))
    medianReturns.push(median.toFixed(2))
    winRates.push(((win / n) * 100).toFixed(2))
    counts.push(n)
    const scoreObj = businessSignals.find(d => d.date === month)
    scores.push(scoreObj ? scoreObj.data2 : null)
  }
  if (!myChartDom1.value) return
  const chart = initChart(myChartDom1.value, 'c1');
  if(!chart) return;

  chart.setOption({
    title: { text: '' },
    tooltip: { trigger: 'axis' },
    legend: { data: ['平均報酬', '中位報酬', '勝率', '交易筆數', '景氣分數'] },
    grid: { containLabel: true },
    xAxis: { type: 'category', data: sortedMonths, axisLabel: { rotate: 45 } },
    yAxis: [{ type: 'value' }],
    series: [
      { name: '平均報酬', type: 'line', data: avgReturns },
      { name: '中位報酬', type: 'line', data: medianReturns },
      { name: '勝率', type: 'line', data: winRates },
      { name: '交易筆數', type: 'bar', data: counts },
      { name: '景氣分數', type: 'line', data: scores }
    ]
  })
}

const buildChart2 = (data) => {
  const dayStats = {}
  for (let d = 1; d <= 31; d++) dayStats[d] = []
  data.forEach(item => {
    const day = Number(item.buyDay?.split('/')?.[2])
    const r = parseFloat(item.return)
    if (!isNaN(day) && day >= 1 && day <= 31 && !isNaN(r)) dayStats[day].push(r * 100)
  })
  const days = [], avgReturns = [], medianReturns = [], winRates = [], counts = []
  for (let d = 1; d <= 31; d++) {
    const returns = dayStats[d]
    const n = returns.length
    const wins = returns.filter(r => r > 0).length
    const avg = n ? (returns.reduce((a, b) => a + b, 0) / n) : 0
    const sorted = [...returns].sort((a, b) => a - b)
    const median = n ? (n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2) : 0
    days.push(d.toString())
    avgReturns.push(avg.toFixed(2))
    medianReturns.push(median.toFixed(2))
    winRates.push((n ? (wins / n) * 100 : 0).toFixed(2))
    counts.push(n)
  }
  if (!myChartDom2.value) return
  const chart = initChart(myChartDom2.value, 'c2');
  if(!chart) return;

  chart.setOption({
    title: { text: '' },
    tooltip: { trigger: 'axis' },
    legend: { data: ['平均報酬', '中位報酬', '勝率'] },
    grid: { containLabel: true },
    xAxis: { type: 'category', data: days },
    yAxis: { type: 'value' },
    series: [
      { name: '平均報酬', type: 'line', data: avgReturns },
      { name: '中位報酬', type: 'line', data: medianReturns },
      { name: '勝率', type: 'line', data: winRates }
    ]
  })
}

const buildChart4 = (data) => {
  const monthStats = {}
  for (let m = 1; m <= 12; m++) monthStats[m] = []
  data.forEach(item => {
    const month = Number(item.buyDay?.split('/')?.[1])
    const r = parseFloat(item.return)
    if (!isNaN(month) && month >= 1 && month <= 12 && !isNaN(r)) monthStats[month].push(r * 100)
  })
  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString())
  const avgReturns = [], medianReturns = [], winRates = [], counts = []
  for (let m = 1; m <= 12; m++) {
    const returns = monthStats[m]
    const n = returns.length
    const wins = returns.filter(r => r > 0).length
    const avg = n ? (returns.reduce((a, b) => a + b, 0) / n) : 0
    const sorted = [...returns].sort((a, b) => a - b)
    const median = n ? (n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2) : 0
    avgReturns.push(avg.toFixed(2))
    medianReturns.push(median.toFixed(2))
    winRates.push((n ? (wins / n) * 100 : 0).toFixed(2))
    counts.push(n)
  }
  if(!myChartDom4.value) return;
  const chart = initChart(myChartDom4.value, 'c4');
  if(!chart) return;

  chart.setOption({
    title: { text: '' },
    tooltip: { trigger: 'axis' },
    legend: { data: ['平均報酬', '中位報酬', '勝率'] },
    grid: { containLabel: true },
    xAxis: { type: 'category', data: months },
    yAxis: { type: 'value' },
    series: [
      { name: '平均報酬', type: 'line', data: avgReturns },
      { name: '中位報酬', type: 'line', data: medianReturns },
      { name: '勝率', type: 'line', data: winRates }
    ]
  })
}

const buildChart5 = (data) => {
  const monthStats = {}
  for (let m = 1; m <= 12; m++) monthStats[m] = []
  data.forEach(item => {
    const month = Number(item.buyDay?.split('/')?.[1])
    const r = parseFloat(item.return)
    if (!isNaN(month) && month >= 1 && month <= 12 && !isNaN(r)) monthStats[month].push(r * 100)
  })
  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString())
  const maxReturns = [], minReturns = []
  for (let m = 1; m <= 12; m++) {
    const returns = monthStats[m]
    if (returns.length > 0) {
      maxReturns.push(Math.max(...returns).toFixed(2))
      minReturns.push(Math.min(...returns).toFixed(2))
    } else {
      maxReturns.push('0'); minReturns.push('0')
    }
  }
  if(!myChartDom5.value) return
  const chart = initChart(myChartDom5.value, 'c5');
  if(!chart) return;

  chart.setOption({
    title: { text: '' },
    tooltip: { trigger: 'axis' },
    legend: { data: ['最高報酬率', '最低報酬率'] },
    grid: { containLabel: true },
    xAxis: { type: 'category', data: months },
    yAxis: { type: 'value' },
    series: [
      { name: '最高報酬率', type: 'line', data: maxReturns },
      { name: '最低報酬率', type: 'line', data: minReturns }
    ]
  })
}

const buildChart3 = (data) => {
  const yearlyStats = {}
  data.forEach(item => {
    const year = item.buyDay?.slice(0, 4)
    const r = parseFloat(item.return)
    if (!year || isNaN(r)) return
    if (!yearlyStats[year]) yearlyStats[year] = []
    yearlyStats[year].push(r * 100)
  })
  const years = Object.keys(yearlyStats).sort()
  const avgReturns = [], medianReturns = [], winRates = [], counts = []
  for (const year of years) {
    const list = yearlyStats[year]
    const n = list.length
    const win = list.filter(r => r > 0).length
    const avg = list.reduce((a, b) => a + b, 0) / n
    const sorted = [...list].sort((a, b) => a - b)
    const median = n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    avgReturns.push(avg.toFixed(2))
    medianReturns.push(median.toFixed(2))
    winRates.push(((win / n) * 100).toFixed(2))
    counts.push(n)
  }
  if(!myChartDom3.value) return
  const chart = initChart(myChartDom3.value, 'c3');
  if(!chart) return;

  chart.setOption({
    title: { text: '' },
    tooltip: { trigger: 'axis' },
    legend: { data: ['平均報酬', '中位報酬', '勝率', '交易筆數'] },
    grid: { containLabel: true },
    xAxis: { type: 'category', data: years },
    yAxis: [{ type: 'value' }],
    series: [
      { name: '平均報酬', type: 'line', data: avgReturns },
      { name: '中位報酬', type: 'line', data: medianReturns },
      { name: '勝率', type: 'line', data: winRates },
      { name: '交易筆數', type: 'bar', data: counts }
    ]
  })
}

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
    halfStats[key].push(r * 100)
  })
  const periods = Object.keys(halfStats).sort()
  const avgReturns = [], medianReturns = [], winRates = [], counts = []
  for (const p of periods) {
    const list = halfStats[p]
    const n = list.length
    const win = list.filter(r => r > 0).length
    const avg = list.reduce((a, b) => a + b, 0) / n
    const sorted = [...list].sort((a, b) => a - b)
    const median = n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    avgReturns.push(avg.toFixed(2))
    medianReturns.push(median.toFixed(2))
    winRates.push(((win / n) * 100).toFixed(2))
    counts.push(n)
  }
  if(!myChartDom7.value) return;
  const chart = initChart(myChartDom7.value, 'c7');
  if(!chart) return;

  chart.setOption({
    title: { text: '' },
    tooltip: { trigger: 'axis' },
    legend: { data: ['平均報酬', '中位報酬', '勝率', '交易筆數'] },
    grid: { containLabel: true },
    xAxis: { type: 'category', data: periods },
    yAxis: [{ type: 'value' }],
    series: [
      { name: '平均報酬', type: 'line', data: avgReturns },
      { name: '中位報酬', type: 'line', data: medianReturns },
      { name: '勝率', type: 'line', data: winRates },
      { name: '交易筆數', type: 'bar', data: counts }
    ]
  })
}

const buildChart8 = (repeat, noRepeat) => {
  const data = Object.entries(repeat).map(([key, value]) => ({ name: key, value }))
  const data2 = Object.entries(noRepeat).map(([key, value]) => ({ name: key, value }))
  if(!myChartDom8.value) return;
  const chart = initChart(myChartDom8.value, 'c8');
  if(!chart) return;

  chart.setOption({
    title: { text: '' },
    tooltip: { trigger: 'axis' },
    legend: { data: ['可重複買入', '不可重複買入'] },
    grid: { containLabel: true },
    xAxis: {
      type: 'category',
      data: data.length > data2.length ? data.map(i => i.name) : data2.map(i => i.name),
    },
    yAxis: [{ type: 'value' }],
    series: [
      { name: '可重複買入', type: 'bar', data: data.map(i => i.value) },
      { name: '不可重複買入', type: 'bar', data: data2.map(i => i.value) }
    ]
  })
}

const buildChart10 = (data) => {
  const stockNameMap = {}
  data.forEach(item => {
    const k = `${item.name} ${item.code}`
    if (!stockNameMap[k]) {
      stockNameMap[k] = { count: 1, sum: parseFloat(item.return) }
    } else {
      stockNameMap[k].count += 1
      stockNameMap[k].sum += parseFloat(item.return)
    }
  })
  const mapData = Object.entries(stockNameMap).map(([key, value]) => ({
    name: key,
    count: value.count,
    return: (value.sum / value.count) * 100
  }))
  if(!myChartDom9.value) return;
  const chart = initChart(myChartDom9.value, 'c9');
  if(!chart) return;

  // 使用唯一名稱以避免衝突（注意：chartInstances.c9 已用於 Dom9）

  chart.setOption({
    title: { text: '' },
    tooltip: { trigger: 'axis' },
    legend: { data: ['買入股票次數', '平均報酬'] },
    grid: { containLabel: true },
    xAxis: { type: 'category', data: mapData.map(i => i.name), axisLabel: { rotate: 45 } },
    yAxis: { type: 'value' },
    series: [
      { name: '買入股票次數', type: 'line', data: mapData.map(i => i.count) },
      { name: '平均報酬', type: 'line', data: mapData.map(i => i.return) }
    ]
  })
}

const buildChart11 = (data) => {
  // 邏輯與 buildChart3 相同，但針對特定數據集（如果傳遞方式不同）
  // 重用相同的邏輯結構來構建 'data' 的滾動回報
  const yearlyStats = {}
  data.forEach(item => {
    const year = item.buyDay?.slice(0, 4)
    const r = parseFloat(item.return)
    if (!year || isNaN(r)) return
    if (!yearlyStats[year]) yearlyStats[year] = []
    yearlyStats[year].push(r * 100)
  })
  const years = Object.keys(yearlyStats).sort()
  const avgReturns = [], medianReturns = [], winRates = [], counts = []
  for (const year of years) {
    const list = yearlyStats[year]
    const n = list.length
    const win = list.filter(r => r > 0).length
    const avg = list.reduce((a, b) => a + b, 0) / n
    const sorted = [...list].sort((a, b) => a - b)
    const median = n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    avgReturns.push(avg.toFixed(2))
    medianReturns.push(median.toFixed(2))
    winRates.push(((win / n) * 100).toFixed(2))
    counts.push(n)
  }
  if(!myChartDom11.value) return;
  const chart = initChart(myChartDom11.value, 'c11');
  if(!chart) return;

  chart.setOption({
    title: { text: '' },
    tooltip: { trigger: 'axis' },
    legend: { data: ['平均報酬', '中位報酬', '勝率', '交易筆數'] },
    grid: { containLabel: true },
    xAxis: { type: 'category', data: years },
    yAxis: [{ type: 'value' }],
    series: [
      { name: '平均報酬', type: 'line', data: avgReturns },
      { name: '中位報酬', type: 'line', data: medianReturns },
      { name: '勝率', type: 'line', data: winRates },
      { name: '交易筆數', type: 'bar', data: counts }
    ]
  })
}
</script>

<style scoped>
.analysis-container {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.control-panel {
  margin-bottom: 20px;
}

.setting-group {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin: 15px 0;
}

.action-buttons {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

.result-card {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.year-log {
  overflow-y: auto;
  margin-top: 10px;
  padding: 10px;
  background: #f9fafc;
  border-radius: 4px;
}

.log-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.9em;
  margin-bottom: 6px;
  border-bottom: 1px dashed #eee;
  padding-bottom: 2px;
}

.val {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
    justify-content: flex-end;
    text-align: right;
}
.sub-val {
    color: #888;
    font-size: 0.85em;
    font-weight: normal;
}

.chart-container-card {
  margin-top: 20px;
}

.chart-wrapper {
  margin-bottom: 30px;
  padding: 10px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
}

.chart-wrapper h4 {
  margin: 0 0 15px 0;
  padding-left: 10px;
  border-left: 4px solid #409eff;
  color: #303133;
}

.chart {
  width: 100%;
  height: 500px;
}
.text-red-500 { color: #f56c6c; }
.text-green-500 { color: #67c23a; }
.text-gray-500 { color: #909399; }
.font-bold { font-weight: bold; }
</style>
