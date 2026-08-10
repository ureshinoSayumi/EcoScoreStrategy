<template>
  <div class="batch-crawl">
    <el-card shadow="hover" class="panel">
      <template #header>
        <span>批次爬取 FinMind 日線</span>
      </template>

      <el-alert
        type="info"
        :closable="false"
        class="format-alert"
        title="台股總覽 CSV"
        description="請上傳含「產業別、股票代碼、股票名稱、市場別」的上市櫃清單。系統僅保留 4 碼股票代號（略過 ETF、債券、權證等），爬取時一併寫入產業別、名稱、市場別。"
      />
      <el-form label-width="100px">
        <el-form-item label="CSV 上傳">
          <input
            type="file"
            accept=".csv"
            class="file-input"
            @change="handleFile"
          />
        </el-form-item>
        <el-form-item label="已選檔案">
          <el-tag v-if="fileName" closable @close="clearFile">{{ fileName }}</el-tag>
          <span v-else class="text-muted">未選擇檔案</span>
        </el-form-item>
        <p v-if="fileMeta.totalRows" class="file-meta">
          原始 {{ fileMeta.totalRows }} 列 · 略過非 4 碼 {{ fileMeta.filteredOut }} 列 ·
          待爬取 {{ stockList.length }} 檔
        </p>
        <el-form-item label="起始日期">
          <el-date-picker
            v-model="startDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="起始日"
          />
        </el-form-item>
        <el-form-item label="結束日期">
          <el-date-picker
            v-model="endDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="結束日"
          />
        </el-form-item>
        <el-form-item label="資料類型">
          <el-radio-group v-model="crawlType">
            <el-radio value="daily">一般日線（TaiwanStockPrice）</el-radio>
            <el-radio value="adj">還原權息日線（TaiwanStockPriceAdj）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="併發數">
          <el-input-number v-model="concurrencyLimit" :min="1" :max="20" :step="1" />
          <span class="hint">同時處理檔數（預設 10）</span>
        </el-form-item>
        <el-form-item label="請求間隔">
          <el-input-number v-model="intervalMs" :min="0" :max="10000" :step="100" />
          <span class="hint">每檔完成後間隔毫秒（預設 2500）</span>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :disabled="!stockList.length || crawling"
            :loading="crawling"
            @click="startCrawl"
          >
            {{ crawlButtonLabel }}
          </el-button>
          <el-button v-if="crawling" type="danger" plain @click="stopCrawl">
            停止
          </el-button>
        </el-form-item>
      </el-form>

      <div v-if="progress.total" class="progress-bar">
        <el-progress
          :percentage="progressPercent"
          :status="progress.failed > 0 && !crawling ? 'warning' : undefined"
        />
        <p class="progress-text">
          處理中 {{ progress.current }} / {{ progress.total }}
          · 成功 {{ progress.success }} · 略過 {{ progress.skipped }} · 失敗 {{ progress.failed }}
          <span v-if="runningCount"> · 進行中 {{ runningCount }} 檔（上限 {{ concurrencyLimit }}）</span>
          <span v-if="currentCode"> · {{ currentCode }}</span>
        </p>
      </div>
    </el-card>

    <el-card shadow="hover" class="panel">
      <template #header>
        <span>Supabase 查詢 DEMO（stock_daily_prices）</span>
      </template>
      <el-alert
        v-if="!supabaseReady"
        type="warning"
        :closable="false"
        title="請在 .env.development.local 設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_KEY"
        class="demo-alert"
      />
      <el-form :inline="true" label-width="80px">
        <el-form-item label="股票代號">
          <el-input
            v-model="queryStockId"
            placeholder="例如 0050"
            style="width: 120px"
            clearable
          />
        </el-form-item>
        <el-form-item label="起始日期">
          <el-date-picker
            v-model="queryStartDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="可選"
            clearable
          />
        </el-form-item>
        <el-form-item label="結束日期">
          <el-date-picker
            v-model="queryEndDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="可選"
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="success"
            :disabled="!supabaseReady || !queryStockId"
            :loading="queryLoading"
            @click="fetchStockFromDb"
          >
            查詢資料庫
          </el-button>
        </el-form-item>
      </el-form>
      <p v-if="querySummary" class="query-summary">{{ querySummary }}</p>
      <el-table
        v-if="dbRows.length"
        :data="dbRows"
        stripe
        max-height="360"
        size="small"
        class="demo-table"
      >
        <el-table-column prop="trade_date" label="交易日" width="110" sortable />
        <el-table-column prop="industry" label="產業別" min-width="120" show-overflow-tooltip />
        <el-table-column prop="open_price" label="開" width="72" />
        <el-table-column prop="high_price" label="高" width="72" />
        <el-table-column prop="low_price" label="低" width="72" />
        <el-table-column prop="close_price" label="收" width="72" />
        <el-table-column prop="volume" label="成交量" width="100" />
        <el-table-column prop="source" label="來源" width="80" />
      </el-table>
    </el-card>

    <el-card v-if="stockList.length" shadow="hover" class="panel">
      <template #header>
        <span>股票清單（{{ stockList.length }} 檔，僅 4 碼上市櫃）</span>
      </template>
      <el-table :data="stockList" stripe max-height="480" size="small">
        <el-table-column type="index" label="#" width="56" />
        <el-table-column prop="code" label="股票代碼" width="100" sortable />
        <el-table-column prop="name" label="股票名稱" min-width="140" show-overflow-tooltip />
        <el-table-column prop="industry" label="產業別" min-width="160" show-overflow-tooltip />
        <el-table-column prop="market" label="市場別" width="88" />
        <el-table-column prop="status" label="爬取狀態" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'success'" type="success" size="small">成功</el-tag>
            <el-tag v-else-if="row.status === 'skipped'" type="info" size="small">略過</el-tag>
            <el-tag v-else-if="row.status === 'failed'" type="danger" size="small">失敗</el-tag>
            <el-tag v-else-if="row.status === 'running'" type="warning" size="small">進行中</el-tag>
            <el-tag v-else type="info" size="small">待處理</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="訊息" min-width="200" show-overflow-tooltip />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { parseTaiwanStockOverviewCsv, normalizeStockCode } from '@/utils/extractStockCodes'
import { crawlFinmindStockDaily, crawlFinmindStockDailyAdj } from '@/api/stockCrawl'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { runWithConcurrency } from '@/utils/runWithConcurrency'

const fileName = ref('')
const stockList = ref([])
const startDate = ref('2020-01-01')
const endDate = ref('2025-12-31')
const concurrencyLimit = ref(10)
const intervalMs = ref(2500)
const runningCount = ref(0)
const runningCodes = new Set()
const fileMeta = reactive({
  totalRows: 0,
  filteredOut: 0,
})
const crawlType = ref('daily')
const crawling = ref(false)
const stopRequested = ref(false)
const currentCode = ref('')

const supabaseReady = isSupabaseConfigured()
const queryStockId = ref('0050')
const queryStartDate = ref('')
const queryEndDate = ref('')
const queryLoading = ref(false)
const dbRows = ref([])
const querySummary = ref('')

const progress = reactive({
  current: 0,
  total: 0,
  success: 0,
  skipped: 0,
  failed: 0,
})

const progressPercent = computed(() => {
  if (!progress.total) return 0
  return Math.round((progress.current / progress.total) * 100)
})

const crawlButtonLabel = computed(() =>
  crawlType.value === 'adj' ? '爬取還原權息資料' : '爬取一般日線'
)

const crawlApi = computed(() =>
  crawlType.value === 'adj' ? crawlFinmindStockDailyAdj : crawlFinmindStockDaily
)

function trackRunning(code, active) {
  if (active) {
    runningCodes.add(code)
  } else {
    runningCodes.delete(code)
  }
  runningCount.value = runningCodes.size
  currentCode.value =
    runningCodes.size > 0 ? [...runningCodes].slice(0, 3).join('、') : ''
  if (runningCodes.size > 3) {
    currentCode.value += ` 等 ${runningCodes.size} 檔`
  }
}

const handleFile = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const { stocks, totalRows, filteredOut } = await parseTaiwanStockOverviewCsv(file)
    stockList.value = stocks.map((s) => ({
      ...s,
      status: 'pending',
      message: '',
    }))
    fileName.value = file.name
    fileMeta.totalRows = totalRows
    fileMeta.filteredOut = filteredOut
    ElMessage.success(
      `已解析 ${stocks.length} 檔（略過非 4 碼 ${filteredOut} 列）`
    )
  } catch (err) {
    ElMessage.error(err.message || 'CSV 解析失敗')
    stockList.value = []
    fileName.value = ''
    fileMeta.totalRows = 0
    fileMeta.filteredOut = 0
  }

  event.target.value = ''
}

const clearFile = () => {
  fileName.value = ''
  stockList.value = []
  fileMeta.totalRows = 0
  fileMeta.filteredOut = 0
  resetProgress()
}

const resetProgress = () => {
  progress.current = 0
  progress.total = 0
  progress.success = 0
  progress.skipped = 0
  progress.failed = 0
  runningCodes.clear()
  runningCount.value = 0
  currentCode.value = ''
}

const stopCrawl = () => {
  stopRequested.value = true
}

const fetchStockFromDb = async () => {
  if (!supabase) {
    ElMessage.error('Supabase 未設定')
    return
  }

  const stockId = normalizeStockCode(queryStockId.value)
  if (!stockId) {
    ElMessage.warning('請輸入股票代號')
    return
  }

  queryLoading.value = true
  dbRows.value = []
  querySummary.value = ''

  try {
    let q = supabase
      .from('stock_daily_prices')
      .select('*')
      .eq('stock_id', stockId)
      .order('trade_date', { ascending: true })

    if (queryStartDate.value) {
      q = q.gte('trade_date', queryStartDate.value)
    }
    if (queryEndDate.value) {
      q = q.lte('trade_date', queryEndDate.value)
    }

    const { data, error } = await q

    if (error) throw error

    dbRows.value = data ?? []
    querySummary.value = `${stockId}：共 ${dbRows.value.length} 筆`
    ElMessage.success(querySummary.value)
  } catch (err) {
    ElMessage.error(err.message || '查詢失敗')
  } finally {
    queryLoading.value = false
  }
}

const startCrawl = async () => {
  if (!stockList.value.length) return
  if (!startDate.value || !endDate.value) {
    ElMessage.warning('請選擇起始與結束日期')
    return
  }
  if (startDate.value > endDate.value) {
    ElMessage.warning('起始日不可晚於結束日')
    return
  }

  crawling.value = true
  stopRequested.value = false
  resetProgress()
  progress.total = stockList.value.length

  stockList.value.forEach((row) => {
    row.status = 'pending'
    row.message = ''
  })

  await runWithConcurrency(
    stockList.value,
    concurrencyLimit.value,
    async (row) => {
      if (stopRequested.value) return

      row.status = 'running'
      trackRunning(row.code, true)
      try {
        const res = await crawlApi.value({
          data_id: row.code,
          start_date: startDate.value,
          end_date: endDate.value,
          stock_name: row.name || undefined,
          market: row.market || undefined,
          industry: row.industry || undefined,
        })
        if (res.data?.skipped) {
          row.status = 'skipped'
          row.message = res.data.reason || '後端略過'
          progress.skipped += 1
        } else {
          row.status = 'success'
          row.message = `寫入 ${res.data?.upserted ?? 0} 筆`
          progress.success += 1
        }
      } catch (err) {
        row.status = 'failed'
        row.message =
          err.response?.data?.message || err.message || '請求失敗'
        progress.failed += 1
      } finally {
        trackRunning(row.code, false)
      }
    },
    {
      shouldStop: () => stopRequested.value,
      delayMs: intervalMs.value,
      onTaskComplete: (done) => {
        progress.current = done
      },
    }
  )

  stockList.value.forEach((row) => {
    if (row.status === 'running') row.status = stopRequested.value ? 'pending' : row.status
  })

  runningCodes.clear()
  runningCount.value = 0
  currentCode.value = ''
  crawling.value = false
  progress.current = progress.total

  if (!stopRequested.value) {
    ElMessage.success(
      `完成：成功 ${progress.success}，略過 ${progress.skipped}，失敗 ${progress.failed}`
    )
  }
}
</script>

<style scoped>
.batch-crawl {
  padding: 20px;
  max-width: 960px;
  margin: 0 auto;
}

.panel {
  margin-bottom: 20px;
}

.file-input {
  display: block;
}

.text-muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.hint {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.progress-bar {
  margin-top: 8px;
}

.progress-text {
  margin-top: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.format-alert {
  margin-bottom: 16px;
}

.file-meta {
  margin: -8px 0 16px 100px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.demo-alert {
  margin-bottom: 16px;
}

.query-summary {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.demo-table {
  margin-top: 8px;
}
</style>
