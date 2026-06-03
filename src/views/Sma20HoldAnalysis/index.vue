<template>
  <div class="sma20-hold">
    <el-card shadow="hover" class="panel">
      <template #header>
        <span>SMA20 延伸持有分析（60 天後）</span>
      </template>

      <el-form label-width="100px">
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
          <span v-else class="text-muted">請上傳與 XQ 分析器相同格式的交易紀錄 CSV</span>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :disabled="!rawRows.length || dbLoading || computing || !supabaseReady"
            :loading="dbLoading || computing"
            @click="runAnalysis"
          >
            開始分析
          </el-button>
          <el-button
            type="success"
            :disabled="!resultRows.length"
            @click="downloadCsv"
          >
            下載結果 CSV
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
        <p class="progress-text">
          載入股價 {{ progressCurrent }} / {{ progressTotal }} 檔標的
        </p>
      </div>
      <p v-if="computing && !dbLoading" class="computing-hint">計算中…</p>
      <p v-if="cacheStats.cachedStocks" class="cache-stats">
        快取：{{ cacheStats.cachedStocks }} 檔標的 · DB 查詢 {{ cacheStats.dbQueries }} 次 ·
        快取命中 {{ cacheStats.cacheHits }} 次
      </p>
    </el-card>

    <el-card v-if="analysis.extendedCount > 0 || resultRows.length" shadow="hover" class="panel">
      <template #header>
        <span>統計（僅持有超過 60 天、有 SMA20 出場者）</span>
      </template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="延伸持有筆數">
          {{ analysis.extendedCount }}
        </el-descriptions-item>
        <el-descriptions-item label="SMA20 報酬高於 60 天出場">
          {{ analysis.beat60Pct.toFixed(2) }}%
        </el-descriptions-item>
        <el-descriptions-item label="平均高出 60 天出場">
          {{ analysis.avgBeat60Pct >= 0 ? '+' : '' }}{{ analysis.avgBeat60Pct.toFixed(2) }} 個百分點
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="resultRows.length" shadow="hover" class="panel">
      <template #header>
        <span>交易明細（{{ resultRows.length }} 筆）</span>
      </template>
      <el-table :data="resultRows" stripe max-height="560" size="small" border>
        <el-table-column
          prop="name"
          label="商品名稱"
          min-width="100"
          show-overflow-tooltip
          sortable
        />
        <el-table-column prop="code" label="商品代碼" width="90" sortable />
        <el-table-column prop="buyDay" label="進場時間" width="110" sortable />
        <el-table-column prop="exitDay" label="出場日期" width="110" sortable />
        <el-table-column
          prop="return60Pct"
          label="60天報酬%"
          width="100"
          align="right"
          sortable
          :sort-method="sortByReturn60"
        />
        <el-table-column
          prop="sma20ReturnPct"
          label="SMA20報酬%"
          width="110"
          align="right"
          sortable
          :sort-method="sortBySma20Return"
        />
        <el-table-column
          prop="totalHoldDays"
          label="總持有天數"
          width="100"
          align="center"
          sortable
        />
        <el-table-column
          prop="exitSma20"
          label="出場日SMA20"
          width="110"
          align="right"
          sortable
          :sort-method="sortByExitSma20"
        />
        <el-table-column
          prop="status"
          label="狀態"
          width="100"
          sortable
          :sort-method="sortByStatus"
        >
          <template #default="{ row }">
            <el-tag v-if="row.extended" type="success" size="small">延伸</el-tag>
            <el-tag v-else-if="row.skippedNegative" type="info" size="small">60天</el-tag>
            <el-tag v-else type="warning" size="small">略過</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="note" label="備註" min-width="160" show-overflow-tooltip sortable />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import Papa from 'papaparse'
import { parseCSV } from '@/utils/csvReader'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  normalizeTradeRow,
  computeSma20ExtendedExit,
  buildExportRow,
  computeAnalysis,
  BASE_HOLD_DAYS,
} from '@/utils/sma20ExtendedHold'
import { StockPriceCache } from '@/utils/stockPriceCache'

const supabaseReady = isSupabaseConfigured()
const fileName = ref('')
const rawRows = ref([])
const csvHeaders = ref([])
const resultRows = ref([])
const exportRows = ref([])
const dbLoading = ref(false)
const computing = ref(false)
const progressCurrent = ref(0)
const progressTotal = ref(0)

const analysis = reactive({
  extendedCount: 0,
  beat60Pct: 0,
  avgBeat60Pct: 0,
})

/** DB 載入進度條百分比（0–100） */
const progressPct = computed(() => {
  if (!progressTotal.value) return 0
  return Math.round((progressCurrent.value / progressTotal.value) * 100)
})

const stockCache = new StockPriceCache()
const cacheStats = ref({ dbQueries: 0, cacheHits: 0, cachedStocks: 0 })

/**
 * 向 Supabase 分頁抓取單一 stock_id 的完整日線（供 StockPriceCache 使用）
 */
stockCache.bindFetcher(async (stockId) => {
  const allRows = []
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('stock_daily_prices')
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

/** 同步快取統計到畫面（DB 次數、命中次數、已快取檔數） */
function syncCacheStats() {
  cacheStats.value = stockCache.getStats()
}

/** 上傳 CSV：解析為 rawRows，並重置分析結果 */
const handleFile = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const rows = await parseCSV(file)
    if (!rows.length) throw new Error('CSV 無資料')
    rawRows.value = rows
    csvHeaders.value = Object.keys(rows[0])
    fileName.value = file.name
    resultRows.value = []
    exportRows.value = []
    Object.assign(analysis, { extendedCount: 0, beat60Pct: 0, avgBeat60Pct: 0 })
    ElMessage.success(`已載入 ${rows.length} 筆交易`)
  } catch (err) {
    ElMessage.error(err.message || '讀檔失敗')
    clearAll()
  }
  event.target.value = ''
}

/** 清除檔案、結果表、快取與統計 */
const clearAll = () => {
  fileName.value = ''
  rawRows.value = []
  csvHeaders.value = []
  resultRows.value = []
  exportRows.value = []
  stockCache.clear()
  cacheStats.value = { dbQueries: 0, cacheHits: 0, cachedStocks: 0 }
  Object.assign(analysis, { extendedCount: 0, beat60Pct: 0, avgBeat60Pct: 0 })
}

/** 小數報酬轉顯示用百分比字串（例如 0.12 → 12.00%） */
const fmtPct = (dec) => {
  if (dec == null || Number.isNaN(dec)) return '—'
  return `${(dec * 100).toFixed(2)}%`
}

/** 可排序數值：null / NaN 排到最後 */
const sortNum = (a, b) => {
  const na = a == null || Number.isNaN(a)
  const nb = b == null || Number.isNaN(b)
  if (na && nb) return 0
  if (na) return 1
  if (nb) return -1
  return a - b
}

const sortByReturn60 = (a, b) => sortNum(a.returnDecimal, b.returnDecimal)
const sortBySma20Return = (a, b) => sortNum(a.sma20Return, b.sma20Return)

const sortByExitSma20 = (a, b) => {
  const parse = (v) => (v === '—' || v == null ? null : Number(v))
  return sortNum(parse(a.exitSma20), parse(b.exitSma20))
}

/** 狀態排序：延伸 → 60天 → 略過 */
const sortByStatus = (a, b) => {
  const rank = (row) => {
    if (row.extended) return 0
    if (row.skippedNegative) return 1
    return 2
  }
  return rank(a) - rank(b)
}

/**
 * 主流程：預載股價（顯示進度條）→ 逐筆計算 SMA20 延伸出場 → 統計與表格一次更新
 */
const runAnalysis = async () => {
  if (!supabase) {
    ElMessage.error('Supabase 未設定')
    return
  }

  try {
    stockCache.clear()
    resultRows.value = []
    exportRows.value = []
    const processed = []
    const nextResultRows = []
    const nextExportRows = []

    const positiveCodes = []
    for (const raw of rawRows.value) {
      const t = normalizeTradeRow(raw)
      if (t.returnDecimal > 0 && t.code) positiveCodes.push(t.code)
    }

    const uniqueCodes = [...new Set(positiveCodes)]

    dbLoading.value = true
    progressTotal.value = uniqueCodes.length
    progressCurrent.value = 0

    for (let i = 0; i < uniqueCodes.length; i++) {
      progressCurrent.value = i + 1
      await stockCache.getEnrichedPrices(uniqueCodes[i])
      syncCacheStats()
    }

    dbLoading.value = false
    computing.value = true

    for (let i = 0; i < rawRows.value.length; i++) {
      const raw = rawRows.value[i]
      const trade = normalizeTradeRow(raw)

      let row = {
        name: trade.name,
        code: trade.code,
        buyDay: trade.buyDay,
        exitDay: trade.sellDay || '—',
        return60Pct: fmtPct(trade.returnDecimal),
        sma20ReturnPct: '—',
        totalHoldDays: BASE_HOLD_DAYS,
        exitSma20: '—',
        extended: false,
        skippedNegative: false,
        returnDecimal: trade.returnDecimal,
        sma20Return: null,
        useSma20Return: false,
        note: '',
      }

      if (trade.returnDecimal == null) {
        row.note = '報酬率無法解析'
        processed.push({ ...row, raw, trade })
        nextResultRows.push(row)
        nextExportRows.push(buildExportRow(raw, { useSma20Return: false }))
        continue
      }

      if (trade.returnDecimal <= 0) {
        row.skippedNegative = true
        row.sma20ReturnPct = fmtPct(trade.returnDecimal)
        row.totalHoldDays = BASE_HOLD_DAYS
        row.note = '報酬為負，維持 60 天出場'
        processed.push({ ...row, raw, trade })
        nextResultRows.push(row)
        nextExportRows.push(buildExportRow(raw, { useSma20Return: false }))
        continue
      }

      if (!trade.code) {
        row.note = '無商品代碼'
        processed.push({ ...row, raw, trade })
        nextResultRows.push(row)
        nextExportRows.push(buildExportRow(raw, { useSma20Return: false }))
        continue
      }

      try {
        const prices = stockCache.enrichedByStock.get(trade.code) ?? []

        const loadErr = stockCache.getLoadError(trade.code)
        if (loadErr) {
          row.note = `股價載入失敗：${loadErr}`
          processed.push({ ...row, raw, trade })
          nextResultRows.push(row)
          nextExportRows.push(buildExportRow(raw, { useSma20Return: false }))
          continue
        }

        const ext = computeSma20ExtendedExit({
          buyDay: trade.buyDay,
          buyPrice: trade.buyPrice,
          sellDay: trade.sellDay,
          sortedPrices: prices,
        })

        if (!ext.ok) {
          row.note = ext.reason || '計算失敗，維持 60 天'
          row.sma20ReturnPct = fmtPct(trade.returnDecimal)
          processed.push({ ...row, raw, trade })
          nextResultRows.push(row)
          nextExportRows.push(buildExportRow(raw, { useSma20Return: false }))
          continue
        }

        row.extended = ext.extended
        row.exitDay = ext.exitDay || trade.sellDay || '—'
        row.sma20Return = ext.sma20Return
        row.returnDecimal = trade.returnDecimal
        row.sma20ReturnPct = fmtPct(ext.sma20Return)
        row.totalHoldDays = ext.totalHoldDays
        row.exitSma20 =
          ext.exitSma20 != null ? Number(ext.exitSma20).toFixed(4) : '—'
        row.useSma20Return = true
        row.note =
          ext.reason || (ext.extraHoldDays > 0 ? `延伸 ${ext.extraHoldDays} 個交易日` : '')

        processed.push({ ...row, raw, trade })
        nextResultRows.push(row)
        nextExportRows.push(
          buildExportRow(raw, {
            useSma20Return: true,
            sma20Return: ext.sma20Return,
          })
        )
      } catch (err) {
        row.note = err.message || '計算失敗'
        processed.push({ ...row, raw, trade })
        nextResultRows.push(row)
        nextExportRows.push(buildExportRow(raw, { useSma20Return: false }))
      }
    }

    resultRows.value = nextResultRows
    exportRows.value = nextExportRows
    syncCacheStats()
    const stats = computeAnalysis(processed)
    Object.assign(analysis, stats)
    ElMessage.success(
      `分析完成（DB ${cacheStats.value.dbQueries} 次，快取命中 ${cacheStats.value.cacheHits} 次）`
    )
  } catch (err) {
    console.error(err)
    ElMessage.error(err.message || '分析失敗')
  } finally {
    dbLoading.value = false
    computing.value = false
  }
}

/** 下載結果 CSV（欄位與上傳檔相同，延伸者報酬率為 SMA20 報酬） */
const downloadCsv = () => {
  if (!exportRows.value.length) return

  const csv = Papa.unparse(exportRows.value, {
    columns: csvHeaders.value.length ? csvHeaders.value : undefined,
  })
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sma20_hold_${fileName.value || 'result.csv'}`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已下載 CSV')
}
</script>

<style scoped>
.sma20-hold {
  padding: 20px;
  max-width: 1100px;
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

.cache-stats {
  margin-top: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.computing-hint {
  margin-top: 12px;
  font-size: 13px;
  color: var(--el-color-primary);
}
</style>
