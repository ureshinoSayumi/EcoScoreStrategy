<template>
  <div class="stock-price-chart-page">
    <el-card shadow="hover" class="panel">
      <template #header>
        <span>股票日線走勢圖</span>
      </template>

      <el-form :inline="true" label-width="80px">
        <el-form-item label="股票代號">
          <el-input
            v-model="stockId"
            placeholder="例如 0050"
            clearable
            style="width: 120px"
          />
        </el-form-item>
        <el-form-item label="起始日期">
          <el-date-picker
            v-model="startDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="起始日"
            clearable
          />
        </el-form-item>
        <el-form-item label="結束日期">
          <el-date-picker
            v-model="endDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="結束日"
            clearable
          />
        </el-form-item>
        <el-form-item label="資料類型">
          <el-radio-group v-model="priceType">
            <el-radio value="daily">一般日線</el-radio>
            <el-radio value="adj">還原權息日線</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :loading="loading"
            :disabled="!supabaseReady || !stockId"
            @click="loadChart"
          >
            查詢
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

      <p v-if="summary" class="summary">{{ summary }}</p>
    </el-card>

    <el-card v-show="hasChart" shadow="hover" class="panel chart-panel">
      <div ref="chartRef" class="chart-container" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { normalizeStockCode } from '@/utils/extractStockCodes'
import { fetchStockDailyPrices, buildStockChartOption } from '@/utils/stockPriceChart'

const supabaseReady = isSupabaseConfigured()
const stockId = ref('0050')
const startDate = ref('2024-01-01')
const endDate = ref('2025-12-31')
const priceType = ref('daily')
const loading = ref(false)
const summary = ref('')
const hasChart = ref(false)

const chartRef = ref(null)
let chartInstance = null

/** 初始化 ECharts 實例 */
function initChart() {
  if (!chartRef.value) return
  if (chartInstance) chartInstance.dispose()
  chartInstance = echarts.init(chartRef.value)
}

/** 視窗縮放時重繪圖表 */
function handleResize() {
  chartInstance?.resize()
}

/** 從 Supabase 載入資料並繪製 K 線 + SMA20 */
async function loadChart() {
  if (!supabase) {
    ElMessage.error('Supabase 未設定')
    return
  }

  const id = normalizeStockCode(stockId.value)
  if (!id) {
    ElMessage.warning('請輸入股票代號')
    return
  }

  loading.value = true
  summary.value = ''
  hasChart.value = false

  try {
    const rows = await fetchStockDailyPrices(supabase, {
      stockId: id,
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
      priceType: priceType.value,
    })

    if (!rows.length) {
      const hint =
        priceType.value === 'adj'
          ? '此區間無還原權息資料，請確認已爬取該股票還原權息日線'
          : '此區間無資料，請確認已爬取該股票日線'
      ElMessage.warning(hint)
      return
    }

    await nextTick()
    hasChart.value = true
    await nextTick()

    initChart()
    chartInstance.setOption(buildStockChartOption(rows, id, priceType.value), true)

    const typeLabel = priceType.value === 'adj' ? '還原權息' : '一般'
    summary.value = `${id}（${typeLabel}）：${rows[0].trade_date} ~ ${rows[rows.length - 1].trade_date}，共 ${rows.length} 個交易日`
    ElMessage.success('圖表已更新')
  } catch (err) {
    console.error(err)
    ElMessage.error(err.message || '查詢失敗')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<style scoped>
.stock-price-chart-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.panel {
  margin-bottom: 20px;
}

.mb-12 {
  margin-bottom: 12px;
}

.summary {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.chart-panel {
  padding-bottom: 8px;
}

.chart-container {
  width: 100%;
  height: 520px;
}
</style>
