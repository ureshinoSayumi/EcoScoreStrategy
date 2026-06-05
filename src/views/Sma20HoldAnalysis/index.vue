<template>
  <div class="sma20-hold">
    <el-card shadow="hover" class="panel">
      <template #header>
        <span>SMA 延伸持有分析（{{ strategyParams.baseHoldDays }} 天後）</span>
      </template>

      <el-form label-width="120px">
        <el-divider content-position="left">策略參數</el-divider>
        <el-form-item label="基礎持有天數">
          <el-input-number
            v-model="strategyParams.baseHoldDays"
            :min="1"
            :max="500"
            :disabled="dbLoading || computing"
          />
          <span class="field-hint">CSV 原策略固定出場天數</span>
        </el-form-item>
        <el-form-item label="均線週期">
          <el-input-number
            v-model="strategyParams.smaPeriod"
            :min="2"
            :max="250"
            :disabled="dbLoading || computing"
          />
          <span class="field-hint">例如 20 即 SMA20</span>
        </el-form-item>
        <el-form-item label="連續破線天數">
          <el-input-number
            v-model="strategyParams.consecutiveBelow"
            :min="1"
            :max="30"
            :disabled="dbLoading || computing"
          />
          <span class="field-hint">收盤低於均線連續幾日出場</span>
        </el-form-item>
        <el-form-item label="延伸門檻 %">
          <el-input-number
            v-model="strategyParams.smaEntryPremiumPct"
            :min="0"
            :max="100"
            :precision="1"
            :step="1"
            :disabled="dbLoading || computing"
          />
          <span class="field-hint">
            基礎出場日收盤須高於 SMA{{ strategyParams.smaPeriod }} 此 %（0 = 僅需高於均線）
          </span>
        </el-form-item>
        <el-form-item label="股價資料">
          <el-radio-group v-model="priceType" :disabled="dbLoading || computing">
            <el-radio value="daily">一般日線</el-radio>
            <el-radio value="adj">還原權息日線</el-radio>
          </el-radio-group>
          <span class="field-hint">SMA 與報酬計算皆使用同一資料源（DB 進出場價）</span>
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
      <p
        v-if="cacheStats.cachedStocks || cacheStats.dbQueries || cacheStats.dbNoPriceData"
        class="cache-stats"
      >
        快取：{{ cacheStats.cachedStocks }} 檔標的 · DB 查詢 {{ cacheStats.dbQueries }} 次 ·
        快取命中 {{ cacheStats.cacheHits }} 次 · 無股價資料 {{ cacheStats.dbNoPriceData }} 次
      </p>
    </el-card>

    <el-card v-if="analysis.extendedCount > 0 || resultRows.length" shadow="hover" class="panel">
      <template #header>
        <span>統計（僅持有超過 {{ strategyParams.baseHoldDays }} 天、有 SMA 出場者）</span>
      </template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="延伸持有筆數">
          {{ analysis.extendedCount }}
        </el-descriptions-item>
        <el-descriptions-item :label="`SMA${strategyParams.smaPeriod} 報酬高於 ${strategyParams.baseHoldDays} 天出場`">
          {{ analysis.beat60Pct.toFixed(2) }}%
        </el-descriptions-item>
        <el-descriptions-item :label="`平均高出 ${strategyParams.baseHoldDays} 天出場`">
          {{ analysis.avgBeat60Pct >= 0 ? '+' : '' }}{{ analysis.avgBeat60Pct.toFixed(2) }} 個百分點
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="extendedTableRows.length" shadow="hover" class="panel">
      <template #header>
        <span>交易明細（{{ extendedTableRows.length }} 筆，僅延伸持有）</span>
      </template>
      <el-table :data="extendedTableRows" stripe max-height="560" size="small" border>
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
          prop="buyPrice"
          label="進場價格"
          width="96"
          align="right"
          sortable
          :sort-method="sortByBuyPrice"
        />
        <el-table-column
          prop="exit60Price"
          :label="`${strategyParams.baseHoldDays}天出場價格`"
          width="110"
          align="right"
          sortable
          :sort-method="sortByExit60Price"
        />
        <el-table-column
          prop="smaExitPrice"
          :label="`SMA${strategyParams.smaPeriod}出場價格`"
          width="118"
          align="right"
          sortable
          :sort-method="sortBySmaExitPrice"
        />
        <el-table-column
          prop="return60Pct"
          :label="`${strategyParams.baseHoldDays}天報酬%`"
          width="100"
          align="right"
          sortable
          :sort-method="sortByReturn60"
        />
        <el-table-column
          prop="sma20ReturnPct"
          :label="`SMA${strategyParams.smaPeriod}報酬%`"
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
          :label="`出場日SMA${strategyParams.smaPeriod}`"
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
            <el-tag v-else-if="row.skippedNegative" type="info" size="small">
              {{ strategyParams.baseHoldDays }}天
            </el-tag>
            <el-tag v-else-if="row.skippedSmaEntry" type="info" size="small">未達門檻</el-tag>
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
  DEFAULT_SMA20_PARAMS,
  normalizeSma20Params,
  resolveBaseExitPrice,
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

const strategyParams = reactive({ ...DEFAULT_SMA20_PARAMS })
const priceType = ref('daily')

const PRICE_TABLE = {
  daily: 'stock_daily_prices',
  adj: 'stock_daily_prices_adj',
}

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

/** 表格僅顯示成功延伸持有且具 SMA 報酬的筆數（與上方統計一致） */
const extendedTableRows = computed(() =>
  resultRows.value.filter((r) => r.extended && r.sma20Return != null)
)

const stockCache = new StockPriceCache()
const cacheStats = ref({ dbQueries: 0, cacheHits: 0, cachedStocks: 0, dbNoPriceData: 0 })

/**
 * 向 Supabase 分頁抓取單一 stock_id 的完整日線（供 StockPriceCache 使用）
 */
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
  cacheStats.value = { dbQueries: 0, cacheHits: 0, cachedStocks: 0, dbNoPriceData: 0 }
  Object.assign(analysis, { extendedCount: 0, beat60Pct: 0, avgBeat60Pct: 0 })
}

/** 小數報酬轉顯示用百分比字串（例如 0.12 → 12.00%） */
const fmtPct = (dec) => {
  if (dec == null || Number.isNaN(dec)) return '—'
  return `${(dec * 100).toFixed(2)}%`
}

/** 價格顯示（保留 4 位小數） */
const fmtPrice = (val) => {
  if (val == null || Number.isNaN(val)) return '—'
  return Number(val).toFixed(4)
}

const parsePriceCol = (v) => (v === '—' || v == null ? null : Number(v))

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
  return sortNum(parsePriceCol(a.exitSma20), parsePriceCol(b.exitSma20))
}

const sortByBuyPrice = (a, b) => sortNum(parsePriceCol(a.buyPrice), parsePriceCol(b.buyPrice))
const sortByExit60Price = (a, b) => sortNum(parsePriceCol(a.exit60Price), parsePriceCol(b.exit60Price))
const sortBySmaExitPrice = (a, b) => sortNum(parsePriceCol(a.smaExitPrice), parsePriceCol(b.smaExitPrice))

/** 狀態排序：延伸 → 60天 → 未達門檻 → 略過 */
const sortByStatus = (a, b) => {
  const rank = (row) => {
    if (row.extended) return 0
    if (row.skippedNegative) return 1
    if (row.skippedSmaEntry) return 2
    return 3
  }
  return rank(a) - rank(b)
}

/**
 * 主流程：預載股價（顯示進度條）→ 逐筆計算 SMA 延伸出場 → 統計與表格一次更新
 *
 * Phase 1：只對「正報酬且有代碼」的股票查 Supabase 日線並算 SMA（同標的只查一次）
 * Phase 2：逐筆 CSV 判斷是否延伸；全部算完才一次寫入 resultRows / exportRows
 */
const runAnalysis = async () => {
  if (!supabase) {
    ElMessage.error('Supabase 未設定')
    return
  }

  try {
    // --- 初始化：清快取、清舊結果、讀取介面策略參數 ---
    stockCache.clear()
    resultRows.value = []
    exportRows.value = []
    const params = normalizeSma20Params(strategyParams)
    const processed = [] // 供 computeAnalysis 統計用（含 extended、sma20Return）
    const nextResultRows = [] // 表格顯示
    const nextExportRows = [] // 下載 CSV

    // --- Phase 1：收集需查股價的標的（負報酬不延伸，不必查 DB）---
    const positiveCodes = []
    for (const raw of rawRows.value) {
      const t = normalizeTradeRow(raw)
      if (t.returnDecimal > 0 && t.code) positiveCodes.push(t.code)
    }

    const uniqueCodes = [...new Set(positiveCodes)]

    dbLoading.value = true
    progressTotal.value = uniqueCodes.length
    progressCurrent.value = 0

    // 逐檔預載：Supabase 日線 → buildPricesWithSma20 → 存入 StockPriceCache
    for (let i = 0; i < uniqueCodes.length; i++) {
      progressCurrent.value = i + 1
      await stockCache.getEnrichedPrices(uniqueCodes[i], { smaPeriod: params.smaPeriod })
      syncCacheStats()
    }

    dbLoading.value = false
    computing.value = true

    // --- Phase 2：逐筆交易計算 ---
    for (let i = 0; i < rawRows.value.length; i++) {
      const raw = rawRows.value[i]
      const trade = normalizeTradeRow(raw)

      // 預設列：出場日 = CSV 原出場時間，持有天數 = 基礎天數
      let row = {
        name: trade.name,
        code: trade.code,
        buyDay: trade.buyDay,
        exitDay: trade.sellDay || '—',
        buyPrice: '—',
        exit60Price: '—',
        smaExitPrice: '—',
        return60Pct: fmtPct(trade.returnDecimal),
        sma20ReturnPct: '—',
        totalHoldDays: params.baseHoldDays,
        exitSma20: '—',
        extended: false,
        skippedNegative: false,
        skippedSmaEntry: false,
        returnDecimal: trade.returnDecimal,
        sma20Return: null,
        useSma20Return: false,
        note: '',
      }

      // 分支 1：報酬率無法解析 → 略過 SMA 計算
      if (trade.returnDecimal == null) {
        row.note = '報酬率無法解析'
        processed.push({ ...row, raw, trade })
        nextResultRows.push(row)
        nextExportRows.push(buildExportRow(raw, { useSma20Return: false }))
        continue
      }

      // 分支 2：報酬 ≤ 0 → 不延伸，維持 CSV 原 60 天（或設定的基礎天數）出場
      if (trade.returnDecimal <= 0) {
        row.skippedNegative = true
        row.sma20ReturnPct = fmtPct(trade.returnDecimal)
        row.totalHoldDays = params.baseHoldDays
        row.note = `報酬為負，維持 ${params.baseHoldDays} 天出場`
        processed.push({ ...row, raw, trade })
        nextResultRows.push(row)
        nextExportRows.push(buildExportRow(raw, { useSma20Return: false }))
        continue
      }

      // 分支 3：無商品代碼 → 無法查股價
      if (!trade.code) {
        row.note = '無商品代碼'
        processed.push({ ...row, raw, trade })
        nextResultRows.push(row)
        nextExportRows.push(buildExportRow(raw, { useSma20Return: false }))
        continue
      }

      try {
        const prices = stockCache.getEnriched(trade.code, params.smaPeriod)

        const loadErr = stockCache.getLoadError(trade.code, params.smaPeriod)
        // 分支 4：股價載入失敗（DB 無資料或查詢錯誤）
        if (loadErr) {
          row.note = `股價載入失敗：${loadErr}`
          processed.push({ ...row, raw, trade })
          nextResultRows.push(row)
          nextExportRows.push(buildExportRow(raw, { useSma20Return: false }))
          continue
        }

        // 分支 5：正報酬 → 模擬「基礎天數出場後」依 SMA 連續破線出場
        const ext = computeSma20ExtendedExit({
          buyDay: trade.buyDay,
          buyPrice: trade.buyPrice,
          sellDay: trade.sellDay,
          sortedPrices: prices,
          ...params,
        })

        // 分支 5a：未達延伸門檻或計算失敗 → 維持原 CSV 出場
        if (!ext.ok) {
          row.skippedSmaEntry = Boolean(ext.skippedSmaEntry)
          row.note = ext.reason || `計算失敗，維持 ${params.baseHoldDays} 天`
          row.sma20ReturnPct = fmtPct(trade.returnDecimal)
          processed.push({ ...row, raw, trade })
          nextResultRows.push(row)
          nextExportRows.push(buildExportRow(raw, { useSma20Return: false }))
          continue
        }

        // 分支 5b：延伸成功 → 更新出場日、SMA 報酬、總持有天數
        row.extended = ext.extended
        row.exitDay = ext.exitDay || trade.sellDay || '—'
        row.sma20Return = ext.sma20Return
        row.returnDecimal = trade.returnDecimal
        row.sma20ReturnPct = fmtPct(ext.sma20Return)
        row.totalHoldDays = ext.totalHoldDays
        row.exitSma20 =
          ext.exitSma20 != null ? Number(ext.exitSma20).toFixed(4) : '—'
        row.buyPrice = fmtPrice(ext.buyPriceUsed)
        row.exit60Price = fmtPrice(
          resolveBaseExitPrice(prices, trade.sellDay, trade.sellPrice)
        )
        row.smaExitPrice = fmtPrice(ext.exitPrice)
        row.useSma20Return = true
        row.note =
          ext.reason || (ext.extraHoldDays > 0 ? `延伸 ${ext.extraHoldDays} 個交易日` : '')

        processed.push({ ...row, raw, trade })
        nextResultRows.push(row)
        // 下載 CSV：延伸者覆寫報酬率、出場時間、持有區間
        nextExportRows.push(
          buildExportRow(raw, {
            useSma20Return: true,
            sma20Return: ext.sma20Return,
            exitDay: ext.exitDay,
            totalHoldDays: ext.totalHoldDays,
          })
        )
      } catch (err) {
        row.note = err.message || '計算失敗'
        processed.push({ ...row, raw, trade })
        nextResultRows.push(row)
        nextExportRows.push(buildExportRow(raw, { useSma20Return: false }))
      }
    }

    // --- 一次更新 UI（避免逐行渲染造成卡頓）---
    resultRows.value = nextResultRows
    exportRows.value = nextExportRows
    syncCacheStats()
    const stats = computeAnalysis(processed)
    Object.assign(analysis, stats)
    ElMessage.success(
      `分析完成（DB ${cacheStats.value.dbQueries} 次，快取命中 ${cacheStats.value.cacheHits} 次，無股價 ${cacheStats.value.dbNoPriceData} 次）`
    )
  } catch (err) {
    console.error(err)
    ElMessage.error(err.message || '分析失敗')
  } finally {
    dbLoading.value = false
    computing.value = false
  }
}

/** 下載檔名：策略參數 + 原檔名（避免特殊字元） */
function buildDownloadFileName() {
  const p = normalizeSma20Params(strategyParams)
  const base = (fileName.value || 'result')
    .replace(/\.csv$/i, '')
    .replace(/[^\w\u4e00-\u9fff.-]+/g, '_')
    .slice(0, 80)
  const prem = String(p.smaEntryPremiumPct).replace('.', '_')
  const paramTag = `d${p.baseHoldDays}_sma${p.smaPeriod}_cb${p.consecutiveBelow}_延伸門檻${prem}pct`
  return `sma20_hold_${paramTag}_${base}.csv`
}

/** 下載結果 CSV（欄位與上傳檔相同，延伸者報酬率為 SMA 報酬） */
const downloadCsv = () => {
  if (!exportRows.value.length) return

  const csv = Papa.unparse(exportRows.value, {
    columns: csvHeaders.value.length ? csvHeaders.value : undefined,
  })
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const outName = buildDownloadFileName()
  const a = document.createElement('a')
  a.href = url
  a.download = outName
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已下載 ${outName}`)
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
