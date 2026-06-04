<template>
  <div class="analysis-container">
    <el-card shadow="hover" class="control-panel">
      <template #header>
        <div class="card-header">
          <span>SMA20 延伸加碼回測</span>
          <el-tag type="info" size="small">上傳 SMA 延伸持有分析下載的 CSV</el-tag>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        class="mb-12"
        title="回測規則"
        description="選股池為 CSV 信號；持倉滿 baseHoldDays 後，若該筆為 SMA20 路徑（持有區間 > 基礎天數）且帳上仍有空位，於當日加碼一筆獨立交易（剩餘持有期報酬）。"
      />

      <el-form :inline="true">
        <el-form-item label="CSV 上傳">
          <input type="file" accept=".csv" @change="handleFile" class="file-input" />
        </el-form-item>
        <el-form-item label="已選檔案">
          <el-tag v-if="fileName" closable @close="clearFile">{{ fileName }}</el-tag>
          <span v-else class="text-muted">請上傳延伸持有分析匯出的 CSV</span>
        </el-form-item>
      </el-form>

      <el-divider content-position="left">進階設定</el-divider>
      <div class="setting-group">
        <el-form-item label="持有限制">
          <el-input-number v-model="stocksPerRound" :min="1" :max="50" />
        </el-form-item>
        <el-form-item label="基礎持有天數">
          <el-input-number v-model="baseHoldDays" :min="1" :max="500" />
          <span class="field-hint">判定 SMA20 路徑：持有區間須大於此值</span>
        </el-form-item>
        <el-form-item label="加碼門檻">
          <span class="field-hint">持倉日曆天數 &gt; {{ baseHoldDays }} 天且有空位時觸發</span>
        </el-form-item>
        <el-form-item label="一日買入多次">
          <el-switch v-model="dayBuyRepeat" inline-prompt active-text="可" inactive-text="否" />
        </el-form-item>
        <el-form-item label="輸出圖表">
          <el-switch v-model="outputChart" inline-prompt active-text="是" inactive-text="否" />
        </el-form-item>
      </div>

      <div class="action-buttons">
        <el-button type="primary" :disabled="!tableData.length" @click="runBacktest">
          開始回測
        </el-button>
      </div>

      <p v-if="poolMeta.poolTradeCount" class="pool-meta">
        信號池 {{ poolMeta.poolTradeCount }} 筆 · SMA20 路徑 {{ poolMeta.poolSma20Count }} 筆
      </p>
    </el-card>

    <div v-if="hasResult" class="results-section">
      <el-row :gutter="20">
        <el-col :span="12">
          <el-card shadow="hover" class="result-card">
            <template #header>
              <div class="card-header">
                <strong>重複進場</strong>
                <el-tag size="small" type="info">含 SMA20 加碼</el-tag>
              </div>
            </template>
            <Sma20PyramidStatsPanel :stats="returnCard.repeat" />
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="hover" class="result-card">
            <template #header>
              <div class="card-header">
                <strong>不重複進場</strong>
                <el-tag size="small" type="info">含 SMA20 加碼</el-tag>
              </div>
            </template>
            <Sma20PyramidStatsPanel :stats="returnCard.noRepeat" />
          </el-card>
        </el-col>
      </el-row>
    </div>

    <el-card v-if="outputChart && visData.repeatHistory.length" shadow="never" class="chart-container-card">
      <div class="chart-wrapper">
        <h4>資金 / 總資產走勢（重複 vs 不重複）</h4>
        <div ref="chartDom" class="chart"></div>
      </div>
    </el-card>

    <el-card v-if="executedTradesDisplay.length" shadow="hover" class="panel-table">
      <template #header>
        <span>實際成交紀錄（{{ executedTradesDisplay.length }} 筆，不重複進場 · 含加碼）</span>
      </template>
      <p class="table-hint">
        持倉數／空閒資金／總資產／總報酬% 為該筆買入完成當下之帳戶狀態（總資產 = 現金 + 持倉占用本金，與上方走勢圖一致）
      </p>
      <el-table :data="executedTradesDisplay" stripe max-height="420" size="small" border>
        <el-table-column prop="name" label="商品名稱" min-width="100" show-overflow-tooltip />
        <el-table-column prop="code" label="代碼" width="88" />
        <el-table-column prop="buyDay" label="買入日" width="108" />
        <el-table-column prop="sellDay" label="出場日" width="108" />
        <el-table-column label="報酬%" width="88" align="right">
          <template #default="{ row }">
            {{ (Number(row.return) * 100).toFixed(2) }}%
          </template>
        </el-table-column>
        <el-table-column label="類型" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.isAddon" type="warning" size="small">加碼</el-tag>
            <el-tag v-else-if="row.isSma20Path" type="success" size="small">SMA20</el-tag>
            <el-tag v-else type="info" size="small">一般</el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="positionCount"
          label="持倉數"
          width="72"
          align="center"
          sortable
        />
        <el-table-column prop="capital" label="空閒資金" width="96" align="right" sortable>
          <template #default="{ row }">
            {{ formatMoney(row.capital) }}
          </template>
        </el-table-column>
        <el-table-column prop="netAsset" label="總資產" width="96" align="right" sortable>
          <template #default="{ row }">
            {{ formatMoney(row.netAsset) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="totalReturnPct"
          label="總報酬%"
          width="88"
          align="right"
          sortable
        >
          <template #default="{ row }">
            <span :class="returnPctClass(row.totalReturnPct)">
              {{ formatReturnPct(row.totalReturnPct) }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import Sma20PyramidStatsPanel from './components/Sma20PyramidStatsPanel.vue'
import { parseCSV } from '@/utils/csvReader'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { computed, nextTick, reactive, ref } from 'vue'
import {
  calculateSma20PyramidSimulation,
  normalizeCsvTradeRow,
} from './utils/sma20PyramidSimulation'

const fileName = ref('')
const tableData = ref([])
const stocksPerRound = ref(10)
const baseHoldDays = ref(60)
const dayBuyRepeat = ref(true)
const outputChart = ref(true)
const chartDom = ref(null)
const executedTradesDisplay = ref([])

const poolMeta = reactive({
  poolTradeCount: 0,
  poolSma20Count: 0,
})

function refreshPoolMeta() {
  poolMeta.poolTradeCount = tableData.value.length
  poolMeta.poolSma20Count = tableData.value.filter((r) => r.isSma20Path).length
}

const visData = reactive({
  repeatHistory: [],
  noRepeatHistory: [],
})

const returnCard = reactive({
  repeat: makeSimCard(),
  noRepeat: makeSimCard(),
})

const hasResult = computed(() => visData.repeatHistory.length > 0)

const formatMoney = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 2 })
}

const formatReturnPct = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

const returnPctClass = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n) || n === 0) return ''
  return n > 0 ? 'text-up' : 'text-down'
}

function makeSimCard() {
  return {
    totalReturn: '0',
    maxDrawdownValue: '0',
    rotationsNumber: 0,
    annualReturn: '0',
    medianAnnualReturn: '0',
    worstAnnualReturn: '0',
    bestAnnualReturn: '0',
    sharpeRatio: 0,
    addonCount: 0,
    tradeCount: 0,
    averageReturn: 0,
    profitLossRatio: 0,
    medianReturn: 0,
    winRate: 0,
    expectedReturn: 0,
    executedTrades: [],
    annualReturnLog: [],
  }
}

/** 年度列表小字：依實際買入（含加碼）的 buyDay 彙總報酬 */
function updateAnnualLogStats(data, logArray) {
  if (!logArray?.length) return

  const yearlyStats = {}
  data.forEach((item) => {
    const year = String(item.buyDay ?? '').slice(0, 4)
    const r = parseFloat(item.return)
    if (!year || Number.isNaN(r)) return
    if (!yearlyStats[year]) yearlyStats[year] = []
    yearlyStats[year].push(r * 100)
  })

  logArray.forEach((item) => {
    const list = yearlyStats[item.year]
    if (list?.length) {
      const n = list.length
      const win = list.filter((r) => r > 0).length
      const avg = list.reduce((a, b) => a + b, 0) / n
      const sorted = [...list].sort((a, b) => a - b)
      const median =
        n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2

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

const profitLossRatioComputed = (data) => {
  const returns = data.map((i) => parseFloat(i.return)).filter((r) => !Number.isNaN(r))
  const profits = returns.filter((r) => r > 0)
  const losses = returns.filter((r) => r < 0)
  const avgProfit = profits.reduce((a, b) => a + b, 0) / (profits.length || 1)
  const avgLoss = losses.reduce((a, b) => a + b, 0) / (losses.length || 1)
  if (avgLoss === 0) return Infinity
  return avgProfit / Math.abs(avgLoss)
}

const averageReturnComputed = (data) => {
  if (!data.length) return 0
  const total = data.reduce((sum, item) => {
    const r = parseFloat(item.return)
    return Number.isNaN(r) ? sum : sum + r
  }, 0)
  return (total / data.length) * 100
}

const medianReturnComputed = (data) => {
  const returns = data
    .map((item) => parseFloat(item.return))
    .filter((r) => !Number.isNaN(r))
    .sort((a, b) => a - b)
  const len = returns.length
  if (!len) return 0
  if (len % 2 === 1) return returns[Math.floor(len / 2)] * 100
  return ((returns[len / 2 - 1] + returns[len / 2]) / 2) * 100
}

const winRateComputed = (data) => {
  const returns = data.map((i) => parseFloat(i.return)).filter((r) => !Number.isNaN(r))
  if (!returns.length) return 0
  return (returns.filter((r) => r > 0).length / returns.length) * 100
}

const expectedReturnComputed = (data) => {
  const returns = data.map((i) => parseFloat(i.return)).filter((r) => !Number.isNaN(r))
  const nw = returns.filter((r) => r > 0).length
  const nl = returns.filter((r) => r < 0).length
  const decisive = nw + nl
  if (!decisive) return 0
  const profits = returns.filter((r) => r > 0)
  const losses = returns.filter((r) => r < 0)
  const avgProfit = nw ? profits.reduce((a, b) => a + b, 0) / nw : 0
  const avgLoss = nl ? losses.reduce((a, b) => a + b, 0) / nl : 0
  return ((nw / decisive) * avgProfit + (nl / decisive) * avgLoss) * 100
}

const sharpeRatioComputed = (data) => {
  if (!Array.isArray(data) || data.length < 2) return 0
  const sorted = [...data].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const returns = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = Number(sorted[i - 1].netAsset)
    const curr = Number(sorted[i].netAsset)
    if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev <= 0 || curr <= 0) continue
    const r = curr / prev - 1
    if (Number.isFinite(r)) returns.push(r)
  }
  const n = returns.length
  if (n < 2) return 0
  const mean = returns.reduce((a, b) => a + b, 0) / n
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)
  const std = Math.sqrt(variance)
  if (std === 0) return 0
  return (mean / std) * Math.sqrt(252)
}

function applySimResult(target, result) {
  const trades = result.executedTrades ?? []

  target.totalReturn = Number(result.finalReturn).toFixed(2)
  target.maxDrawdownValue = Number(result.maxDrawdown).toFixed(2)
  target.rotationsNumber = result.rotations
  target.annualReturn = Number(result.mean).toFixed(2)
  target.medianAnnualReturn = Number(result.median).toFixed(2)
  target.worstAnnualReturn = Number(result.worst).toFixed(2)
  target.bestAnnualReturn = Number(result.best).toFixed(2)
  target.addonCount = result.addonCount
  target.executedTrades = trades
  target.annualReturnLog = result.annualReturnsLog ?? []
  target.sharpeRatio = sharpeRatioComputed(result.history)

  target.tradeCount = trades.length
  target.averageReturn = averageReturnComputed(trades)
  target.profitLossRatio = profitLossRatioComputed(trades)
  target.medianReturn = medianReturnComputed(trades) || 0
  target.winRate = winRateComputed(trades)
  target.expectedReturn = expectedReturnComputed(trades)

  updateAnnualLogStats(trades, target.annualReturnLog)
}

function buildChart(repeatHistory, noRepeatHistory) {
  if (!chartDom.value) return
  let chart = echarts.getInstanceByDom(chartDom.value)
  if (!chart) chart = echarts.init(chartDom.value)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['現金(重複)', '總資產(重複)', '現金(不重複)', '總資產(不重複)'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: repeatHistory.map((h) => h.date),
      axisLabel: { rotate: 45 },
    },
    yAxis: { type: 'value', name: '金額' },
    series: [
      { name: '現金(重複)', type: 'line', data: repeatHistory.map((h) => h.capital) },
      { name: '總資產(重複)', type: 'line', data: repeatHistory.map((h) => h.netAsset) },
      { name: '現金(不重複)', type: 'line', data: noRepeatHistory.map((h) => h.capital) },
      { name: '總資產(不重複)', type: 'line', data: noRepeatHistory.map((h) => h.netAsset) },
    ],
  })
}

const handleFile = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const rows = await parseCSV(file)
    if (!rows.length) throw new Error('CSV 無資料')
    tableData.value = rows.map((r) => ({
      ...normalizeCsvTradeRow(r, baseHoldDays.value),
      _raw: r,
    }))
    fileName.value = file.name
    refreshPoolMeta()
    Object.assign(returnCard.repeat, makeSimCard())
    Object.assign(returnCard.noRepeat, makeSimCard())
    executedTradesDisplay.value = []
    ElMessage.success(`已載入 ${rows.length} 筆（SMA20 路徑 ${poolMeta.poolSma20Count} 筆）`)
  } catch (err) {
    ElMessage.error(err.message || '讀檔失敗')
    clearFile()
  }
  event.target.value = ''
}

const clearFile = () => {
  fileName.value = ''
  tableData.value = []
  poolMeta.poolTradeCount = 0
  poolMeta.poolSma20Count = 0
  executedTradesDisplay.value = []
  Object.assign(returnCard.repeat, makeSimCard())
  Object.assign(returnCard.noRepeat, makeSimCard())
}

const runBacktest = () => {
  if (!tableData.value.length) return

  const rows = tableData.value.map((r) =>
    r._raw
      ? normalizeCsvTradeRow(r._raw, baseHoldDays.value)
      : {
          ...r,
          isSma20Path: r.holdDays != null && r.holdDays > baseHoldDays.value,
        }
  )
  poolMeta.poolSma20Count = rows.filter((r) => r.isSma20Path).length

  const repeatResult = calculateSma20PyramidSimulation(rows, {
    initialCapital: 10000,
    maxPositions: stocksPerRound.value,
    isRepeat: true,
    dayBuyRepeat: dayBuyRepeat.value,
    baseHoldDays: baseHoldDays.value,
  })

  const noRepeatResult = calculateSma20PyramidSimulation(rows, {
    initialCapital: 10000,
    maxPositions: stocksPerRound.value,
    isRepeat: false,
    dayBuyRepeat: dayBuyRepeat.value,
    baseHoldDays: baseHoldDays.value,
  })

  applySimResult(returnCard.repeat, repeatResult)
  applySimResult(returnCard.noRepeat, noRepeatResult)

  visData.repeatHistory = repeatResult.history
  visData.noRepeatHistory = noRepeatResult.history
  executedTradesDisplay.value = noRepeatResult.executedTrades

  if (outputChart.value) {
    nextTick(() => buildChart(repeatResult.history, noRepeatResult.history))
  }

  ElMessage.success(
    `回測完成：加碼 ${repeatResult.addonCount} 筆（重複）／${noRepeatResult.addonCount} 筆（不重複）`
  )
}
</script>

<style scoped>
.analysis-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.control-panel,
.chart-container-card,
.panel-table {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.setting-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
}

.field-hint {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.action-buttons {
  margin-top: 12px;
}

.file-input {
  display: block;
}

.text-muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.mb-12 {
  margin-bottom: 12px;
}

.pool-meta {
  margin-top: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.results-section {
  margin-bottom: 20px;
}

.result-card {
  height: 100%;
}

.detail-desc {
  margin-bottom: 0;
}

.chart-wrapper {
  padding: 10px;
}

.chart-wrapper h4 {
  margin: 0 0 12px;
  padding-left: 10px;
  border-left: 4px solid #409eff;
}

.chart {
  width: 100%;
  height: 460px;
}

.table-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: normal;
}

.text-up {
  color: #67c23a;
}

.text-down {
  color: #f56c6c;
}
</style>
