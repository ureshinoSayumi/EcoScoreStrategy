<template>
  <div class="batch-crawl">
    <el-card shadow="hover" class="panel">
      <template #header>
        <span>批次爬取 FinMind 日線</span>
      </template>

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
        <el-form-item label="請求間隔">
          <el-input-number v-model="intervalMs" :min="0" :max="10000" :step="1" />
          <span class="hint">毫秒（預設 1000 = 1 秒）</span>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :disabled="!stockList.length || crawling"
            :loading="crawling"
            @click="startCrawl"
          >
            爬取資料
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
          {{ progress.current }} / {{ progress.total }}
          · 成功 {{ progress.success }} · 略過 {{ progress.skipped }} · 失敗 {{ progress.failed }}
          <span v-if="currentCode"> · 進行中 {{ currentCode }}</span>
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
        <span>股票清單（{{ stockList.length }} 檔，已去重、已去除 .TW）</span>
      </template>
      <el-table :data="stockList" stripe max-height="480" size="small">
        <el-table-column type="index" label="#" width="56" />
        <el-table-column prop="code" label="商品代碼" width="120" sortable />
        <el-table-column prop="name" label="商品名稱" min-width="160" />
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
import { extractStocksFromCsvFile, normalizeStockCode } from '@/utils/extractStockCodes'
import { crawlFinmindStockDaily } from '@/api/stockCrawl'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const fileName = ref('')
const stockList = ref([])
const startDate = ref('2020-01-01')
const endDate = ref('2025-12-31')
const intervalMs = ref(1000)
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const handleFile = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const stocks = await extractStocksFromCsvFile(file)
    stockList.value = stocks.map((s) => ({
      ...s,
      status: 'pending',
      message: '',
    }))
    fileName.value = file.name
    ElMessage.success(`已解析 ${stocks.length} 檔股票`)
  } catch (err) {
    ElMessage.error(err.message || 'CSV 解析失敗')
    stockList.value = []
    fileName.value = ''
  }

  event.target.value = ''
}

const clearFile = () => {
  fileName.value = ''
  stockList.value = []
  resetProgress()
}

const resetProgress = () => {
  progress.current = 0
  progress.total = 0
  progress.success = 0
  progress.skipped = 0
  progress.failed = 0
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

  crawling.value = true
  stopRequested.value = false
  resetProgress()
  progress.total = stockList.value.length

  stockList.value.forEach((row) => {
    row.status = 'pending'
    row.message = ''
  })

  for (let i = 0; i < stockList.value.length; i++) {
    if (stopRequested.value) {
      ElMessage.info('已停止爬取')
      break
    }

    const row = stockList.value[i]
    row.status = 'running'
    currentCode.value = row.code

    try {
      const res = await crawlFinmindStockDaily({
        data_id: row.code,
        start_date: startDate.value,
        end_date: endDate.value,
      })
      if (res.data?.skipped) {
        row.status = 'skipped'
        row.message = res.data.reason || '資料庫已有，略過'
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
    }

    progress.current = i + 1

    if (i < stockList.value.length - 1 && !stopRequested.value) {
      await delay(intervalMs.value)
    }
  }

  const row = stockList.value.find((r) => r.status === 'running')
  if (row) row.status = stopRequested.value ? 'pending' : row.status

  currentCode.value = ''
  crawling.value = false

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
