<template>
  <div class="day60-backtest">
    <el-card shadow="hover" class="panel">
      <template #header>
        <div class="card-header">
          <span>SMA20 60日進場回測</span>
          <el-tag type="info" size="small">驗證 60 日正報酬 + SMA 門檻後 SMA 出場</el-tag>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        class="mb-12"
        title="回測邏輯"
        description="CSV 僅需商品代碼與進場時間。系統自 DB 取價，於進場後第 N 個交易日檢查：正報酬且收盤高於 SMA 門檻 → 下一交易日進場；出場為連續跌破 SMA 指定天數。模擬時間軸起點為第一筆進場後第 N 個交易日（交易日，非日曆日）。"
      />

      <el-form label-width="130px">
        <el-divider content-position="left">策略參數</el-divider>
        <el-form-item label="基礎觀察天數">
          <el-input-number
            v-model="strategyParams.baseHoldDays"
            :min="1"
            :max="500"
            :disabled="dbLoading || computing"
          />
          <span class="field-hint">進場後第幾個交易日檢查訊號（預設 60）</span>
        </el-form-item>
        <el-form-item label="均線週期">
          <el-input-number
            v-model="strategyParams.smaPeriod"
            :min="2"
            :max="250"
            :disabled="dbLoading || computing"
          />
        </el-form-item>
        <el-form-item label="SMA 門檻 %">
          <el-input-number
            v-model="strategyParams.smaEntryPremiumPct"
            :min="0"
            :max="100"
            :precision="1"
            :step="1"
            :disabled="dbLoading || computing"
          />
          <span class="field-hint">
            訊號日收盤須高於 SMA{{ strategyParams.smaPeriod }} 此 %（0 = 僅需高於均線）
          </span>
        </el-form-item>
        <el-form-item label="連續破線天數">
          <el-input-number
            v-model="strategyParams.consecutiveBelow"
            :min="1"
            :max="30"
            :disabled="dbLoading || computing"
          />
          <span class="field-hint">模擬進場後，收盤低於均線連續幾日出場</span>
        </el-form-item>
        <el-form-item label="股價資料">
          <el-radio-group v-model="priceType" :disabled="dbLoading || computing">
            <el-radio value="daily">一般日線</el-radio>
            <el-radio value="adj">還原權息日線</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-divider content-position="left">組合回測</el-divider>
        <el-form-item label="持有限制">
          <el-input-number v-model="stocksPerRound" :min="1" :max="50" :disabled="computing" />
        </el-form-item>
        <el-form-item label="一日買入多次">
          <el-switch v-model="dayBuyRepeat" inline-prompt active-text="可" inactive-text="否" />
        </el-form-item>
        <el-form-item label="輸出圖表">
          <el-switch v-model="outputChart" inline-prompt active-text="是" inactive-text="否" />
        </el-form-item>

        <el-divider content-position="left">資料上傳</el-divider>
        <el-form-item label="CSV 上傳">
          <input
            type="file"
            accept=".csv"
            class="file-input"
            :disabled="dbLoading || computing"
            @change="handleFile"
          />
        </el-form-item>
        <el-form-item label="已選檔案">
          <el-tag v-if="fileName" closable @close="clearAll">{{ fileName }}</el-tag>
          <span v-else class="text-muted">請上傳含「商品代碼」「進場時間」的 CSV</span>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :disabled="!rawRows.length || dbLoading || computing || !supabaseReady"
            :loading="dbLoading || computing"
            @click="runBacktest"
          >
            開始回測
          </el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="!supabaseReady"
        type="warning"
        :closable="false"
        title="請設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_KEY"
        class="mb-12"
      />

      <div v-if="dbLoading" class="progress-wrap">
        <el-progress :percentage="progressPct" />
        <p class="progress-text">載入股價 {{ progressCurrent }} / {{ progressTotal }} 檔標的</p>
      </div>
      <p v-if="poolMeta.totalCount" class="pool-meta">
        信號 {{ poolMeta.totalCount }} 筆 · 通過篩選 {{ poolMeta.qualifiedCount }} 筆 · 略過
        {{ poolMeta.rejectedCount }} 筆
        <template v-if="poolMeta.simStartDate">
          · 模擬起點 {{ poolMeta.simStartDate }}
        </template>
      </p>
    </el-card>

    <div v-if="hasResult" class="results-section">
      <el-row :gutter="20">
        <el-col :span="12">
          <el-card shadow="hover" class="result-card">
            <template #header>
              <div class="card-header">
                <strong>重複進場</strong>
                <el-tag v-if="returnCard.repeat.executedTradeCount != null" size="small" type="info">
                  實際成交 {{ returnCard.repeat.executedTradeCount }} 筆
                </el-tag>
              </div>
            </template>
            <Sma20PyramidStatsPanel
              :stats="returnCard.repeat"
              trade-count-label="通過篩選筆數"
            />
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="hover" class="result-card">
            <template #header>
              <div class="card-header">
                <strong>不重複進場</strong>
                <el-tag v-if="returnCard.noRepeat.executedTradeCount != null" size="small" type="info">
                  實際成交 {{ returnCard.noRepeat.executedTradeCount }} 筆
                </el-tag>
              </div>
            </template>
            <Sma20PyramidStatsPanel
              :stats="returnCard.noRepeat"
              trade-count-label="通過篩選筆數"
            />
          </el-card>
        </el-col>
      </el-row>
    </div>

    <el-card v-if="outputChart && visData.repeatHistory.length" shadow="never" class="panel">
      <div class="chart-wrapper">
        <h4>資金 / 總資產走勢（重複 vs 不重複）</h4>
        <div ref="chartDom" class="chart"></div>
      </div>
    </el-card>

    <el-card v-if="qualifiedRows.length" shadow="hover" class="panel">
      <template #header>
        <span>通過篩選（{{ qualifiedRows.length }} 筆）</span>
      </template>
      <el-table :data="qualifiedRows" stripe max-height="400" size="small" border>
        <el-table-column prop="name" label="商品名稱" min-width="100" show-overflow-tooltip />
        <el-table-column prop="code" label="代碼" width="88" />
        <el-table-column prop="originalBuyDay" label="原始進場" width="108" />
        <el-table-column prop="signalDay" label="訊號日" width="108" />
        <el-table-column label="60日報酬%" width="96" align="right">
          <template #default="{ row }">{{ fmtPct(row.return60) }}</template>
        </el-table-column>
        <el-table-column prop="buyDay" label="模擬買入" width="108" />
        <el-table-column prop="sellDay" label="模擬出場" width="108" />
        <el-table-column label="SMA報酬%" width="96" align="right">
          <template #default="{ row }">{{ fmtPct(row.return) }}</template>
        </el-table-column>
        <el-table-column prop="holdDays" label="持有天數" width="88" align="center" />
        <el-table-column prop="note" label="備註" min-width="120" show-overflow-tooltip />
      </el-table>
    </el-card>

    <el-card v-if="rejectedRows.length" shadow="hover" class="panel">
      <template #header>
        <span>未通過篩選（{{ rejectedRows.length }} 筆）</span>
      </template>
      <el-table :data="rejectedRows" stripe max-height="360" size="small" border>
        <el-table-column prop="name" label="商品名稱" min-width="100" show-overflow-tooltip />
        <el-table-column prop="code" label="代碼" width="88" />
        <el-table-column prop="originalBuyDay" label="原始進場" width="108" />
        <el-table-column prop="signalDay" label="訊號日" width="108" />
        <el-table-column label="60日報酬%" width="96" align="right">
          <template #default="{ row }">{{ fmtPct(row.return60) }}</template>
        </el-table-column>
        <el-table-column prop="reason" label="原因" min-width="200" show-overflow-tooltip />
      </el-table>
    </el-card>

    <el-card v-if="executedTradesDisplay.length" shadow="hover" class="panel">
      <template #header>
        <span>實際成交（{{ executedTradesDisplay.length }} 筆，不重複進場）</span>
      </template>
      <el-table :data="executedTradesDisplay" stripe max-height="400" size="small" border>
        <el-table-column prop="name" label="商品名稱" min-width="100" show-overflow-tooltip />
        <el-table-column prop="code" label="代碼" width="88" />
        <el-table-column prop="originalBuyDay" label="原始進場" width="108" />
        <el-table-column prop="buyDay" label="買入日" width="108" />
        <el-table-column prop="sellDay" label="出場日" width="108" />
        <el-table-column label="報酬%" width="88" align="right">
          <template #default="{ row }">{{ fmtPct(row.return) }}</template>
        </el-table-column>
        <el-table-column prop="netAsset" label="總資產" width="96" align="right" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { parseCSV } from '@/utils/csvReader'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { StockPriceCache } from '@/utils/stockPriceCache'
import { DEFAULT_SMA20_PARAMS, normalizeSma20Params } from '@/utils/sma20ExtendedHold'
import {
  normalizeEntryRow,
  buildSimulationTradePool,
} from '@/utils/sma20Day60Entry'
import { calculateDay60SmaSimulation } from '@/views/RecordAnalysis/utils/sma20Day60Simulation'
import Sma20PyramidStatsPanel from '@/views/RecordAnalysis/components/Sma20PyramidStatsPanel.vue'

const supabaseReady = isSupabaseConfigured()
const fileName = ref('')
const rawRows = ref([])
const dbLoading = ref(false)
const computing = ref(false)
const progressCurrent = ref(0)
const progressTotal = ref(0)
const chartDom = ref(null)

const strategyParams = reactive({ ...DEFAULT_SMA20_PARAMS })
const priceType = ref('daily')
const stocksPerRound = ref(10)
const dayBuyRepeat = ref(true)
const outputChart = ref(true)

const qualifiedRows = ref([])
const rejectedRows = ref([])
const executedTradesDisplay = ref([])

const poolMeta = reactive({
  totalCount: 0,
  qualifiedCount: 0,
  rejectedCount: 0,
  simStartDate: '',
})

const visData = reactive({
  repeatHistory: [],
  noRepeatHistory: [],
})

const returnCard = reactive({
  repeat: makeSimCard(),
  noRepeat: makeSimCard(),
})

const PRICE_TABLE = {
  daily: 'stock_daily_prices',
  adj: 'stock_daily_prices_adj',
}

const stockCache = new StockPriceCache()

const progressPct = computed(() => {
  if (!progressTotal.value) return 0
  return Math.round((progressCurrent.value / progressTotal.value) * 100)
})

const hasResult = computed(() => visData.repeatHistory.length > 0)

stockCache.bindFetcher(async (stockId) => {
  const table = PRICE_TABLE[priceType.value] ?? PRICE_TABLE.daily
  const allRows = []
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('trade_date, open_price, close_price')
      .eq('stock_id', stockId)
      .order('trade_date', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error
    const batch = data ?? []
    allRows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  return allRows
})

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
    executedTradeCount: 0,
    averageReturn: 0,
    profitLossRatio: 0,
    medianReturn: 0,
    winRate: 0,
    expectedReturn: 0,
    executedTrades: [],
    annualReturnLog: [],
  }
}

const fmtPct = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(2)}%`
}

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

function applySimResult(target, result, qualifiedTrades = []) {
  const executedTrades = result.executedTrades ?? []
  const perTradePool = qualifiedTrades.length ? qualifiedTrades : executedTrades

  target.totalReturn = Number(result.finalReturn).toFixed(2)
  target.maxDrawdownValue = Number(result.maxDrawdown).toFixed(2)
  target.rotationsNumber = result.rotations
  target.annualReturn = Number(result.mean).toFixed(2)
  target.medianAnnualReturn = Number(result.median).toFixed(2)
  target.worstAnnualReturn = Number(result.worst).toFixed(2)
  target.bestAnnualReturn = Number(result.best).toFixed(2)
  target.addonCount = 0
  target.executedTrades = executedTrades
  target.annualReturnLog = result.annualReturnsLog ?? []
  target.sharpeRatio = sharpeRatioComputed(result.history)
  target.executedTradeCount = executedTrades.length
  target.tradeCount = perTradePool.length
  target.averageReturn = averageReturnComputed(perTradePool)
  target.profitLossRatio = profitLossRatioComputed(perTradePool)
  target.medianReturn = medianReturnComputed(perTradePool) || 0
  target.winRate = winRateComputed(perTradePool)
  target.expectedReturn = expectedReturnComputed(perTradePool)
  updateAnnualLogStats(perTradePool, target.annualReturnLog)
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
    rawRows.value = rows
    fileName.value = file.name
    qualifiedRows.value = []
    rejectedRows.value = []
    executedTradesDisplay.value = []
    Object.assign(returnCard.repeat, makeSimCard())
    Object.assign(returnCard.noRepeat, makeSimCard())
    visData.repeatHistory = []
    visData.noRepeatHistory = []
    poolMeta.totalCount = rows.length
    poolMeta.qualifiedCount = 0
    poolMeta.rejectedCount = 0
    poolMeta.simStartDate = ''
    ElMessage.success(`已載入 ${rows.length} 筆進場紀錄`)
  } catch (err) {
    ElMessage.error(err.message || '讀檔失敗')
    clearAll()
  }
  event.target.value = ''
}

const clearAll = () => {
  fileName.value = ''
  rawRows.value = []
  qualifiedRows.value = []
  rejectedRows.value = []
  executedTradesDisplay.value = []
  stockCache.clear()
  Object.assign(returnCard.repeat, makeSimCard())
  Object.assign(returnCard.noRepeat, makeSimCard())
  visData.repeatHistory = []
  visData.noRepeatHistory = []
  poolMeta.totalCount = 0
  poolMeta.qualifiedCount = 0
  poolMeta.rejectedCount = 0
  poolMeta.simStartDate = ''
}

const runBacktest = async () => {
  if (!supabase) {
    ElMessage.error('Supabase 未設定')
    return
  }

  try {
    stockCache.clear()
    const params = normalizeSma20Params(strategyParams)

    const codes = [
      ...new Set(
        rawRows.value.map((r) => normalizeEntryRow(r).code).filter(Boolean)
      ),
    ]

    dbLoading.value = true
    progressTotal.value = codes.length
    progressCurrent.value = 0

    for (let i = 0; i < codes.length; i++) {
      progressCurrent.value = i + 1
      await stockCache.getEnrichedPrices(codes[i], { smaPeriod: params.smaPeriod })
    }

    dbLoading.value = false
    computing.value = true

    const pricesByCode = new Map()
    for (const code of codes) {
      pricesByCode.set(code, stockCache.getEnriched(code, params.smaPeriod))
    }

    const pool = buildSimulationTradePool(rawRows.value, pricesByCode, params)
    qualifiedRows.value = pool.qualified
    rejectedRows.value = pool.rejected

    poolMeta.totalCount = rawRows.value.length
    poolMeta.qualifiedCount = pool.qualified.length
    poolMeta.rejectedCount = pool.rejected.length
    poolMeta.simStartDate = pool.simStartDate || ''

    if (!pool.qualified.length) {
      ElMessage.warning('無交易通過篩選，請調整參數或確認 DB 股價')
      return
    }

    if (!pool.simStartDate) {
      ElMessage.warning('無法建立模擬時間軸起點')
      return
    }

    const simOpts = {
      initialCapital: 10000,
      maxPositions: stocksPerRound.value,
      dayBuyRepeat: dayBuyRepeat.value,
      simStartDate: pool.simStartDate,
      pricesByCode,
    }

    const repeatResult = calculateDay60SmaSimulation(pool.qualified, {
      ...simOpts,
      isRepeat: true,
    })
    const noRepeatResult = calculateDay60SmaSimulation(pool.qualified, {
      ...simOpts,
      isRepeat: false,
    })

    applySimResult(returnCard.repeat, repeatResult, pool.qualified)
    applySimResult(returnCard.noRepeat, noRepeatResult, pool.qualified)

    visData.repeatHistory = repeatResult.history
    visData.noRepeatHistory = noRepeatResult.history
    executedTradesDisplay.value = noRepeatResult.executedTrades

    if (outputChart.value) {
      nextTick(() => buildChart(repeatResult.history, noRepeatResult.history))
    }

    ElMessage.success(
      `回測完成：${pool.qualified.length} 筆通過篩選，成交 ${noRepeatResult.executedTrades.length} 筆（不重複）`
    )
  } catch (err) {
    console.error(err)
    ElMessage.error(err.message || '回測失敗')
  } finally {
    dbLoading.value = false
    computing.value = false
  }
}
</script>

<style scoped>
.day60-backtest {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.panel {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.field-hint {
  margin-left: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
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

.progress-wrap {
  margin-top: 12px;
}

.progress-text {
  margin-top: 8px;
  font-size: 13px;
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
  margin-bottom: 20px;
}

.chart-wrapper {
  padding: 8px 0;
}

.chart {
  width: 100%;
  height: 360px;
}
</style>
