<template>
  <div class="regime-page">
    <el-card shadow="hover" class="panel">
      <template #header>
        <span>0050 市場三態回測（趨勢／動能／波動）</span>
      </template>

      <el-form label-width="140px">
        <el-form-item label="標的代號">
          <el-input v-model="stockId" placeholder="0050" style="width: 120px" clearable />
        </el-form-item>
        <el-form-item label="資料類型">
          <el-radio-group v-model="priceType" :disabled="loading">
            <el-radio value="adj">還原權息（建議）</el-radio>
            <el-radio value="daily">一般日線</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="起始／結束">
          <el-date-picker
            v-model="startDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="起始（可空）"
            clearable
            :disabled="loading"
          />
          <span class="sep">～</span>
          <el-date-picker
            v-model="endDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="結束（可空）"
            clearable
            :disabled="loading"
          />
        </el-form-item>

        <el-divider content-position="left">標籤定義</el-divider>
        <el-form-item label="前瞻交易日">
          <el-input-number v-model="forwardDays" :min="20" :max="126" :disabled="loading" />
          <span class="field-hint">約 63 ≈ 3 個月</span>
        </el-form-item>
        <el-form-item label="上漲門檻 %">
          <el-input-number
            v-model="upPctInput"
            :min="0"
            :max="50"
            :step="0.5"
            :precision="1"
            :disabled="loading"
          />
        </el-form-item>
        <el-form-item label="下跌門檻 %">
          <el-input-number
            v-model="downPctInput"
            :min="-50"
            :max="0"
            :step="0.5"
            :precision="1"
            :disabled="loading"
          />
          <span class="field-hint">介於兩者之間 = 盤整</span>
        </el-form-item>

        <el-divider content-position="left">特徵（訊號日）</el-divider>
        <el-form-item label="趨勢 SMA">
          <el-input-number v-model="smaPeriod" :min="50" :max="300" :disabled="loading" />
        </el-form-item>
        <el-form-item label="動能天數">
          <el-input-number v-model="momWindow" :min="20" :max="252" :disabled="loading" />
          <span class="field-hint">報酬 &gt; 0 為動能+</span>
        </el-form-item>
        <el-form-item label="波動分位">
          <el-input-number
            v-model="volPctInput"
            :min="50"
            :max="95"
            :step="5"
            :disabled="loading"
          />
          <span class="field-hint">近 20 日年化波動 ≥ 過去 5 年此分位 → 高波動</span>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="loading"
            :disabled="!supabaseReady || !stockId"
            @click="run"
          >
            載入並回測
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
      <el-alert
        type="info"
        :closable="false"
        class="mb-12"
        title="說明"
        description="每月底取樣；標籤用「當時起算前瞻 N 日報酬」。準度採 walk-forward（僅用過去樣本估該組合歷史眾數），並與「永遠猜當時最常見類別」比較。三條件共 8 組合。"
      />
    </el-card>

    <template v-if="result">
      <el-card shadow="hover" class="panel">
        <template #header><span>總覽</span></template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="標的">{{ stockIdNorm }}</el-descriptions-item>
          <el-descriptions-item label="樣本數（月）">{{ result.sampleCount }}</el-descriptions-item>
          <el-descriptions-item label="訊號區間">
            {{ result.dateRange ? `${result.dateRange.from} ～ ${result.dateRange.to}` : '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="日線筆數">{{ priceCount }}</el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">無條件基準（全樣本）</el-divider>
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="上漲">
            {{ result.unconditional.pct.up }}%（{{ result.unconditional.counts.up }}）
          </el-descriptions-item>
          <el-descriptions-item label="盤整">
            {{ result.unconditional.pct.side }}%（{{ result.unconditional.counts.side }}）
          </el-descriptions-item>
          <el-descriptions-item label="下跌">
            {{ result.unconditional.pct.down }}%（{{ result.unconditional.counts.down }}）
          </el-descriptions-item>
        </el-descriptions>
        <p class="hint">
          永遠猜「{{ regimeLabel(result.unconditional.majority) }}」的全樣本命中率 ≈
          {{ result.unconditional.pct[result.unconditional.majority] }}%（這才是要擊敗的基準）
        </p>
      </el-card>

      <el-card shadow="hover" class="panel">
        <template #header>
          <span>Walk-forward 準度（暖機 {{ result.walkForward.warmStart }} 個月後）</span>
        </template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="評分樣本">
            {{ result.walkForward.scored }}
          </el-descriptions-item>
          <el-descriptions-item label="模型命中率">
            <strong>{{ result.walkForward.accuracyPct }}%</strong>
            （{{ result.walkForward.hits }} / {{ result.walkForward.scored }}）
          </el-descriptions-item>
          <el-descriptions-item label="基準命中率">
            {{ result.baselineAlwaysMajority.accuracyPct }}%
            （永遠猜當時最常見）
          </el-descriptions-item>
          <el-descriptions-item label="相對基準">
            <span :class="result.liftPp >= 0 ? 'pos' : 'neg'">
              {{ result.liftPp >= 0 ? '+' : '' }}{{ result.liftPp }} 個百分點
            </span>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">各類別召回（實際為該類時猜對比例）</el-divider>
        <el-table :data="byClassRows" size="small" border stripe>
          <el-table-column prop="label" label="實際" width="100" />
          <el-table-column prop="n" label="樣本" width="90" />
          <el-table-column prop="hit" label="猜對" width="90" />
          <el-table-column prop="acc" label="準度" />
        </el-table>
      </el-card>

      <el-card v-if="result.latestSignal" shadow="hover" class="panel">
        <template #header><span>最新訊號（用全歷史同組合機率）</span></template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="日期">{{ result.latestSignal.date }}</el-descriptions-item>
          <el-descriptions-item label="組合">{{ result.latestSignal.comboLabel }}</el-descriptions-item>
          <el-descriptions-item label="歷史同組合樣本">
            {{ result.latestSignal.sampleN }}
          </el-descriptions-item>
          <el-descriptions-item label="經驗眾數">
            <strong>{{ result.latestSignal.predictedLabel }}</strong>
          </el-descriptions-item>
          <el-descriptions-item label="上漲機率">
            {{ result.latestSignal.probs.pct.up }}%
          </el-descriptions-item>
          <el-descriptions-item label="盤整機率">
            {{ result.latestSignal.probs.pct.side }}%
          </el-descriptions-item>
          <el-descriptions-item label="下跌機率">
            {{ result.latestSignal.probs.pct.down }}%
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="hover" class="panel">
        <template #header><span>8 組合經驗機率表（描述用，含未來標籤）</span></template>
        <el-table :data="result.comboStats" size="small" border stripe>
          <el-table-column prop="combo" label="碼" width="70" />
          <el-table-column prop="comboLabel" label="組合" min-width="200" />
          <el-table-column prop="n" label="N" width="70" sortable />
          <el-table-column label="上漲%" width="90">
            <template #default="{ row }">{{ row.pct.up }}</template>
          </el-table-column>
          <el-table-column label="盤整%" width="90">
            <template #default="{ row }">{{ row.pct.side }}</template>
          </el-table-column>
          <el-table-column label="下跌%" width="90">
            <template #default="{ row }">{{ row.pct.down }}</template>
          </el-table-column>
          <el-table-column prop="modeLabel" label="眾數" width="80" />
        </el-table>
      </el-card>

      <el-card shadow="hover" class="panel">
        <template #header><span>月度樣本明細</span></template>
        <el-table :data="result.samples" size="small" border stripe max-height="480">
          <el-table-column prop="date" label="訊號日" width="110" sortable />
          <el-table-column prop="forwardDate" label="前瞻日" width="110" />
          <el-table-column prop="comboLabel" label="組合" min-width="180" show-overflow-tooltip />
          <el-table-column label="前瞻報酬%" width="110" sortable :sort-method="sortFwd">
            <template #default="{ row }">
              {{ (row.forwardRet * 100).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column prop="actualLabel" label="實際" width="80" />
        </el-table>
      </el-card>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { normalizeStockCode } from '@/utils/extractStockCodes'
import { fetchStockDailyPrices } from '@/utils/stockPriceChart'
import {
  REGIME_LABELS,
  normalizeCloses,
  runRegimeBacktest,
} from '@/utils/marketRegimeBacktest'

const supabaseReady = isSupabaseConfigured()
const stockId = ref('0050')
const priceType = ref('adj')
const startDate = ref('')
const endDate = ref('')
const forwardDays = ref(63)
const upPctInput = ref(5)
const downPctInput = ref(-5)
const smaPeriod = ref(200)
const momWindow = ref(63)
const volPctInput = ref(75)

const loading = ref(false)
const priceCount = ref(0)
const result = ref(null)

const stockIdNorm = computed(() => normalizeStockCode(stockId.value) || stockId.value)

const byClassRows = computed(() => {
  if (!result.value) return []
  const bc = result.value.walkForward.byClass
  return ['up', 'side', 'down'].map((k) => ({
    label: REGIME_LABELS[k],
    n: bc[k].n,
    hit: bc[k].hit,
    acc: bc[k].accuracyPct == null ? '—' : `${bc[k].accuracyPct}%`,
  }))
})

function regimeLabel(k) {
  return REGIME_LABELS[k] ?? k
}

function sortFwd(a, b) {
  return a.forwardRet - b.forwardRet
}

async function run() {
  if (!supabase) {
    ElMessage.warning('Supabase 未設定')
    return
  }
  const id = stockIdNorm.value
  if (!id) {
    ElMessage.warning('請輸入代號')
    return
  }

  loading.value = true
  result.value = null
  try {
    const rows = await fetchStockDailyPrices(supabase, {
      stockId: id,
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
      priceType: priceType.value,
    })
    priceCount.value = rows.length
    if (rows.length < 300) {
      ElMessage.warning(`日線只有 ${rows.length} 筆，建議至少爬 5～10 年以上 ${id} 資料`)
    }

    const series = normalizeCloses(rows)
    result.value = runRegimeBacktest(series, {
      smaPeriod: smaPeriod.value,
      momWindow: momWindow.value,
      volWindow: 20,
      volLookbackDays: 252 * 5,
      volPercentile: volPctInput.value / 100,
      forwardDays: forwardDays.value,
      upPct: upPctInput.value / 100,
      downPct: downPctInput.value / 100,
    })

    if (!result.value.sampleCount) {
      ElMessage.warning('無法產生樣本（資料太短或參數過嚴）')
    } else {
      ElMessage.success(
        `完成：${result.value.sampleCount} 個月樣本，walk-forward ${result.value.walkForward.accuracyPct}%`
      )
    }
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.message || String(e))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.regime-page {
  padding: 16px 20px 40px;
  max-width: 1100px;
  margin: 0 auto;
}
.panel {
  margin-bottom: 16px;
}
.field-hint {
  margin-left: 10px;
  color: #888;
  font-size: 13px;
}
.sep {
  margin: 0 8px;
  color: #999;
}
.mb-12 {
  margin-bottom: 12px;
}
.hint {
  margin: 12px 0 0;
  color: #666;
  font-size: 13px;
}
.pos {
  color: #067d3f;
  font-weight: 600;
}
.neg {
  color: #c03639;
  font-weight: 600;
}
</style>
