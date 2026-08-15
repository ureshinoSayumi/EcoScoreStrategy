<template>
  <div class="momentum-pick">
    <el-card shadow="hover" class="panel">
      <template #header>
        <div class="card-header">
          <span>CSV 名單動能回測</span>
          <el-tag type="info" size="small">CSV 進場 · 汰弱留強 · 還原權息日線</el-tag>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        class="mb-12"
        title="策略規則"
        description="上傳量化選股 CSV（進場時間＋商品代碼）。每輪建倉日若名單有該日標的，依名單順序買入至持股檔數；之後每 Y 日汰弱留強與結算邏輯與動能頁相同。忽略 CSV 內出場價／報酬。"
      />

      <el-form label-width="130px">
        <el-divider content-position="left">選股 CSV</el-divider>
        <el-form-item label="上傳名單">
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".csv,text/csv"
            :on-change="onCsvChange"
            :on-remove="onCsvRemove"
            :disabled="loading || running"
          >
            <el-button :disabled="loading || running">選擇 CSV</el-button>
          </el-upload>
          <span class="field-hint">欄位：進場時間、商品代碼（如 2030.TW）；支援 Big5</span>
        </el-form-item>
        <p v-if="csvMeta.dateCount" class="pool-meta">
          已解析 {{ csvMeta.rowCount }} 列 · {{ csvMeta.stockCount }} 檔 ·
          {{ csvMeta.dateCount }} 個進場日（{{ csvMeta.minDate }} ~ {{ csvMeta.maxDate }}）
        </p>

        <el-divider content-position="left">回測區間</el-divider>
        <el-form-item label="起點日">
          <el-date-picker
            v-model="startDate"
            type="date"
            value-format="YYYY-MM-DD"
            :disabled="loading || running"
          />
        </el-form-item>
        <el-form-item label="結束日">
          <el-date-picker
            v-model="endDate"
            type="date"
            value-format="YYYY-MM-DD"
            :disabled="loading || running"
          />
        </el-form-item>

        <el-divider content-position="left">策略參數</el-divider>
        <el-form-item label="持股檔數">
          <el-input-number
            v-model="holdCount"
            :min="1"
            :max="200"
            :disabled="loading || running"
          />
          <span class="field-hint">目標持有檔數；預算按此等分；從當日 CSV 名單依序買入</span>
        </el-form-item>
        <el-form-item label="換倉間隔 Y">
          <el-input-number
            v-model="rebalanceInterval"
            :min="1"
            :max="250"
            :disabled="loading || running"
          />
          <span class="field-hint">交易日；漲幅排名亦取過去 Y 日</span>
        </el-form-item>
        <el-form-item label="持股週期">
          <el-radio-group v-model="holdingMode" :disabled="loading || running">
            <el-radio value="cycles">週期數模式</el-radio>
            <el-radio value="maxDays">最大持股天數</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="holdingMode === 'cycles'" label="一輪週期數">
          <el-input-number v-model="roundCycles" :min="1" :max="12" :disabled="loading || running" />
          <span class="field-hint">
            一輪 = {{ roundCycles }}×Y = {{ roundCycles * rebalanceInterval }} 交易日；
            汰弱 {{ Math.max(0, roundCycles - 1) }} 次後結算；剩 1 檔提前結算
          </span>
        </el-form-item>
        <el-form-item v-else label="最大持股天數">
          <el-input-number
            v-model="maxHoldingDays"
            :min="1"
            :max="500"
            :disabled="loading || running"
          />
          <span class="field-hint">
            持滿 {{ maxHoldingDays }} 交易日結算；每 Y 日汰弱
            {{ maxCullCount }} 次；剩 1 檔不提前賣，持有至結算日
          </span>
        </el-form-item>
        <el-form-item label="汰弱檔數">
          <el-radio-group v-model="cullSizeMode" :disabled="loading || running">
            <el-radio value="fraction">除法（賣 1/N）</el-radio>
            <el-radio value="fixed">固定檔數</el-radio>
            <el-radio value="negativeReturn">過去 Y 日負報酬</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="cullSizeMode === 'fraction'" label="除數 N">
          <el-input-number
            v-model="cullFractionDivisor"
            :min="2"
            :max="20"
            :disabled="loading || running"
          />
          <span class="field-hint">
            目標賣 floor(持股/N)；N=2 即約一半。實際賣出仍看成交金額；至少留 1 檔
          </span>
        </el-form-item>
        <el-form-item v-else-if="cullSizeMode === 'fixed'" label="固定汰弱檔數">
          <el-input-number
            v-model="cullFixedCount"
            :min="1"
            :max="200"
            :disabled="loading || running"
          />
          <span class="field-hint">
            每次目標賣這麼多檔（超過持股-1 會自動上限）；實際賣出仍看成交金額
          </span>
        </el-form-item>
        <el-form-item v-else label="負報酬汰弱">
          <span class="field-hint">
            淘汰過去 Y 日漲幅 &lt; 0（或缺資料）；賣完若 0 檔則強制結算；金額關卡賣不掉則續抱
          </span>
        </el-form-item>
        <el-form-item label="初始資金">
          <el-input-number
            v-model="initialCapital"
            :min="1000"
            :step="1000"
            :disabled="loading || running"
          />
        </el-form-item>
        <el-form-item label="交易成本">
          <el-input-number
            v-model="feePercent"
            :min="0"
            :max="5"
            :precision="2"
            :step="0.1"
            :disabled="loading || running"
          />
          <span class="field-hint">單边 %（買賣皆扣）</span>
        </el-form-item>
        <el-form-item label="最低成交金額">
          <el-input-number
            v-model="minTurnoverWan"
            :min="0"
            :step="100"
            :disabled="loading || running"
          />
          <span class="field-hint">
            萬元（DB 成交金額）；建倉固定看 D-1，結算仍看當天；汰弱賣／加碼見下方
          </span>
        </el-form-item>
        <el-form-item label="汰弱賣出金額">
          <el-radio-group v-model="cullSellVolumeMode" :disabled="loading || running">
            <el-radio value="prevDay">看 D-1</el-radio>
            <el-radio value="none">不看</el-radio>
          </el-radio-group>
          <span class="field-hint">金額不足則不賣、續抱；缺行情則 0 元出清</span>
        </el-form-item>
        <el-form-item label="汰弱加碼金額">
          <el-radio-group v-model="cullAddonVolumeMode" :disabled="loading || running">
            <el-radio value="prevDay">看 D-1</el-radio>
            <el-radio value="none">不看</el-radio>
          </el-radio-group>
          <span class="field-hint">與賣出獨立；金額不足則該檔不加碼、現金留下</span>
        </el-form-item>
        <el-form-item label="跳過漲停">
          <el-switch
            v-model="skipLimitUpBuy"
            inline-prompt
            active-text="是"
            inactive-text="否"
            :disabled="loading || running"
          />
          <span class="field-hint">建倉／加碼時，開盤或最高價較前一日收盤漲 ≥9.99% 則跳過</span>
        </el-form-item>
        <el-form-item label="買高賣低">
          <el-switch
            v-model="buyHighSellLow"
            inline-prompt
            active-text="是"
            inactive-text="否"
            :disabled="loading || running"
          />
          <span class="field-hint">
            最倒楣成交：建倉／加碼用當日最高價，減碼／結算用當日最低價（預設仍為開盤價）
          </span>
        </el-form-item>
        <el-form-item label="輸出圖表">
          <el-switch v-model="outputChart" inline-prompt active-text="是" inactive-text="否" />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :loading="loading || running"
            :disabled="!supabaseReady || !startDate || !endDate || !csvMeta.dateCount || loading || running"
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

      <div v-if="loading" class="progress-wrap">
        <el-progress :percentage="progressPct" />
        <p class="progress-text">{{ progressText }}</p>
      </div>
      <p v-if="poolMeta.stockCount" class="pool-meta">
        CSV 宇宙 {{ poolMeta.stockCount }} 檔 · 已載入 {{ poolMeta.loadedCount }} 檔 · 交易日
        {{ poolMeta.tradingDays }} 日
      </p>
    </el-card>

    <el-card v-if="result" shadow="hover" class="panel">
      <template #header>
        <span>回測結果</span>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="實際建倉日">
          {{ result.effectiveStartDate ?? '—' }}
          <span v-if="result.startDateAdjusted" class="hint-inline">（起點已自動順延）</span>
        </el-descriptions-item>
        <el-descriptions-item label="完成輪數">
          {{ result.roundCount }}
        </el-descriptions-item>
        <el-descriptions-item label="累積報酬">
          <span :class="returnClass(result.finalReturnPct)">
            {{ formatPct(result.finalReturnPct) }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="最終資金">
          {{ formatMoney(result.finalCash) }}
        </el-descriptions-item>
        <el-descriptions-item label="最大回撤">
          {{ result.maxDrawdownPct.toFixed(2) }}%
        </el-descriptions-item>
        <el-descriptions-item label="賣出勝率">
          {{ result.stats.winRate.toFixed(2) }}%
        </el-descriptions-item>
        <el-descriptions-item label="賣出平均報酬">
          {{ result.stats.avgReturn.toFixed(2) }}%
        </el-descriptions-item>
        <el-descriptions-item label="每輪平均報酬">
          {{ result.roundStats.avgReturnPct.toFixed(2) }}%
        </el-descriptions-item>
        <el-descriptions-item label="每輪中位數報酬">
          {{ result.roundStats.medianReturnPct.toFixed(2) }}%
        </el-descriptions-item>
        <el-descriptions-item label="每輪勝率">
          {{ result.roundStats.winRatePct.toFixed(2) }}%
          <span class="hint-inline">（{{ result.roundStats.roundCount }} 輪）</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="outputChart && result?.history?.length" shadow="never" class="panel chart-card">
      <div class="chart-wrapper">
        <h4>總資產走勢</h4>
        <div ref="chartDom" class="chart"></div>
      </div>
    </el-card>

    <el-card v-if="result?.roundSummaries?.length" shadow="hover" class="panel">
      <template #header>
        <span>各輪結算（{{ result.roundSummaries.length }} 輪）</span>
      </template>
      <el-table :data="result.roundSummaries" stripe size="small" border max-height="360">
        <el-table-column prop="roundNo" label="輪次" width="64" align="center" />
        <el-table-column prop="settleDate" label="結算日" width="112" />
        <el-table-column label="期初資金" width="108" align="right">
          <template #default="{ row }">{{ formatMoney(row.startingCash) }}</template>
        </el-table-column>
        <el-table-column label="期末資金" width="108" align="right">
          <template #default="{ row }">{{ formatMoney(row.endingCash) }}</template>
        </el-table-column>
        <el-table-column label="本輪報酬" width="96" align="right">
          <template #default="{ row }">
            <span :class="returnClass(row.returnPct)">{{ formatPct(row.returnPct) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="pickCount" label="結算檔數" width="88" align="center" />
        <el-table-column label="備註" min-width="140">
          <template #default="{ row }">
            <span v-if="row.note">{{ row.note }}</span>
            <span v-else-if="row.earlySettle">提前結算（僅剩 1 檔）</span>
            <span v-else>—</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-if="result?.events?.length" shadow="hover" class="panel">
      <template #header>
        <span>事件紀錄（{{ result.events.length }} 筆）</span>
      </template>
      <p class="table-hint">點擊列可查看交易明細</p>
      <el-table
        :data="eventRows"
        stripe
        size="small"
        border
        max-height="420"
        class="event-table"
        @row-click="openEventDetail"
      >
        <el-table-column prop="roundNo" label="輪次" width="64" align="center" />
        <el-table-column prop="date" label="日期" width="112" />
        <el-table-column prop="typeLabel" label="類型" width="100" />
        <el-table-column prop="detail" label="摘要" min-width="280" show-overflow-tooltip />
        <el-table-column label="總資產" width="100" align="right">
          <template #default="{ row }">{{ formatMoney(row.netAsset) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="eventDetailVisible"
      :title="dialogTitle"
      width="920px"
      destroy-on-close
      class="event-detail-dialog"
    >
      <template v-if="selectedEvent?.type === 'round_buy'">
        <el-table :data="buyRowsSorted" stripe size="small" border max-height="480">
          <el-table-column label="名單序" width="64" align="center">
            <template #default="{ row }">{{ row.momentumRank ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="商品" min-width="120">
            <template #default="{ row }">{{ row.stockName }} {{ row.stockId }}</template>
          </el-table-column>
          <el-table-column :label="momentumColumnLabel" width="108" align="right" sortable>
            <template #default="{ row }">
              <span :class="returnClass(row.momentumReturnPct)">
                {{ formatPct(row.momentumReturnPct) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="買入日" width="100">
            <template #default="{ row }">{{ formatDisplayDate(row.buyDate) }}</template>
          </el-table-column>
          <el-table-column label="買入價格" width="96" align="right">
            <template #default="{ row }">{{ formatPrice(row.buyPrice) }}</template>
          </el-table-column>
          <el-table-column label="買入金額" width="100" align="right">
            <template #default="{ row }">{{ formatMoney(row.buyAmount) }}</template>
          </el-table-column>
        </el-table>
      </template>

      <template v-else-if="selectedEvent?.type === 'cull'">
        <h4 class="detail-section-title">賣出（{{ (selectedEvent.sold ?? []).length }} 檔）</h4>
        <el-table :data="cullSoldSorted" stripe size="small" border max-height="280">
          <el-table-column label="商品" min-width="110">
            <template #default="{ row }">{{ row.stockName }} {{ row.stockId }}</template>
          </el-table-column>
          <el-table-column :label="momentumColumnLabel" width="108" align="right">
            <template #default="{ row }">
              <span :class="returnClass(row.momentumReturnPct)">
                {{ formatPct(row.momentumReturnPct) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="買入價格" width="88" align="right">
            <template #default="{ row }">{{ formatPrice(row.initialBuyPrice) }}</template>
          </el-table-column>
          <el-table-column label="買入金額" width="92" align="right">
            <template #default="{ row }">{{ formatMoney(row.initialBuyAmount) }}</template>
          </el-table-column>
          <el-table-column label="賣出價格" width="88" align="right">
            <template #default="{ row }">{{ formatPrice(row.sellPrice) }}</template>
          </el-table-column>
          <el-table-column label="賣出金額" width="92" align="right">
            <template #default="{ row }">{{ formatMoney(row.sellAmount) }}</template>
          </el-table-column>
          <el-table-column label="報酬%" width="80" align="right">
            <template #default="{ row }">
              <span :class="returnClass(row.returnPct)">{{ formatPct(row.returnPct) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="備註" min-width="140">
            <template #default="{ row }">{{ row.note || '—' }}</template>
          </el-table-column>
        </el-table>

        <h4 v-if="cullKeptSorted.length" class="detail-section-title">
          留存（{{ cullKeptSorted.length }} 檔）
        </h4>
        <el-table
          v-if="cullKeptSorted.length"
          :data="cullKeptSorted"
          stripe
          size="small"
          border
          max-height="240"
        >
          <el-table-column label="商品" min-width="110">
            <template #default="{ row }">{{ row.stockName }} {{ row.stockId }}</template>
          </el-table-column>
          <el-table-column :label="momentumColumnLabel" width="108" align="right">
            <template #default="{ row }">
              <span :class="returnClass(row.momentumReturnPct)">
                {{ formatPct(row.momentumReturnPct) }}
              </span>
            </template>
          </el-table-column>
        </el-table>

        <h4 v-if="(selectedEvent.addons ?? []).length" class="detail-section-title">
          加碼（{{ selectedEvent.addons.length }} 檔）
        </h4>
        <el-table
          v-if="(selectedEvent.addons ?? []).length"
          :data="selectedEvent.addons"
          stripe
          size="small"
          border
          max-height="240"
        >
          <el-table-column label="商品" min-width="110">
            <template #default="{ row }">{{ row.stockName }} {{ row.stockId }}</template>
          </el-table-column>
          <el-table-column label="加碼日" width="100">
            <template #default="{ row }">{{ formatDisplayDate(row.date) }}</template>
          </el-table-column>
          <el-table-column label="加碼價格" width="96" align="right">
            <template #default="{ row }">{{ formatPrice(row.price) }}</template>
          </el-table-column>
          <el-table-column label="加碼金額" width="100" align="right">
            <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
          </el-table-column>
        </el-table>
      </template>

      <template v-else-if="selectedEvent?.type === 'settle'">
        <el-table :data="selectedEvent.sold ?? []" stripe size="small" border max-height="520">
          <el-table-column label="商品" min-width="110" fixed>
            <template #default="{ row }">{{ row.stockName }} {{ row.stockId }}</template>
          </el-table-column>
          <el-table-column label="買入日" width="88">
            <template #default="{ row }">{{ formatDisplayDate(row.initialBuyDate) }}</template>
          </el-table-column>
          <el-table-column label="買入價格" width="88" align="right">
            <template #default="{ row }">{{ formatPrice(row.initialBuyPrice) }}</template>
          </el-table-column>
          <el-table-column label="買入金額" width="92" align="right">
            <template #default="{ row }">{{ formatMoney(row.initialBuyAmount) }}</template>
          </el-table-column>
          <el-table-column label="加碼價格" width="88" align="right">
            <template #default="{ row }">
              {{ row.avgAddonPrice != null ? formatPrice(row.avgAddonPrice) : '—' }}
            </template>
          </el-table-column>
          <el-table-column label="加碼金額" width="92" align="right">
            <template #default="{ row }">
              {{ row.addonAmount > 0 ? formatMoney(row.addonAmount) : '—' }}
            </template>
          </el-table-column>
          <el-table-column label="賣出價格" width="88" align="right">
            <template #default="{ row }">{{ formatPrice(row.sellPrice) }}</template>
          </el-table-column>
          <el-table-column label="賣出金額" width="92" align="right">
            <template #default="{ row }">{{ formatMoney(row.sellAmount) }}</template>
          </el-table-column>
          <el-table-column label="報酬%" width="80" align="right" fixed="right">
            <template #default="{ row }">
              <span :class="returnClass(row.returnPct)">{{ formatPct(row.returnPct) }}</span>
            </template>
          </el-table-column>
        </el-table>
        <p v-if="selectedEvent.note" class="detail-note">{{ selectedEvent.note }}</p>
      </template>

      <template v-else-if="selectedEvent?.type === 'buy_skip'">
        <p class="detail-note">{{ selectedEvent.reason }}</p>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  fetchTradingCalendar,
  loadStockHistories,
  indexOfDate,
  normalizeTradeDateKey,
} from '@/utils/momentumRotationData'
import {
  runMomentumRotationBacktest,
  DEFAULT_MOMENTUM_PARAMS,
  getMinActionIdx,
  findFirstValidCsvActionIdx,
} from '@/utils/momentumRotationSimulation'
import { parseQuantEntryListCsv } from '@/utils/csvEntryList'

const supabaseReady = isSupabaseConfigured()

const startDate = ref('2020-01-02')
const endDate = ref('2025-12-31')
const holdCount = ref(DEFAULT_MOMENTUM_PARAMS.holdCount)
const rebalanceInterval = ref(DEFAULT_MOMENTUM_PARAMS.rebalanceInterval)
const roundCycles = ref(DEFAULT_MOMENTUM_PARAMS.roundCycles)
const holdingMode = ref(DEFAULT_MOMENTUM_PARAMS.holdingMode)
const maxHoldingDays = ref(DEFAULT_MOMENTUM_PARAMS.maxHoldingDays)
const cullSizeMode = ref(DEFAULT_MOMENTUM_PARAMS.cullSizeMode)
const cullFractionDivisor = ref(DEFAULT_MOMENTUM_PARAMS.cullFractionDivisor)
const cullFixedCount = ref(DEFAULT_MOMENTUM_PARAMS.cullFixedCount)
const initialCapital = ref(DEFAULT_MOMENTUM_PARAMS.initialCapital)
const feePercent = ref(DEFAULT_MOMENTUM_PARAMS.feeRate * 100)
/** UI 用萬元；內部轉成元（建倉／汰弱門檻） */
const minTurnoverWan = ref(DEFAULT_MOMENTUM_PARAMS.minTurnover / 10_000)
const cullSellVolumeMode = ref(DEFAULT_MOMENTUM_PARAMS.cullSellVolumeMode)
const cullAddonVolumeMode = ref(DEFAULT_MOMENTUM_PARAMS.cullAddonVolumeMode)
const skipLimitUpBuy = ref(DEFAULT_MOMENTUM_PARAMS.skipLimitUpBuy)
const buyHighSellLow = ref(DEFAULT_MOMENTUM_PARAMS.buyHighSellLow)
const outputChart = ref(true)

/** @type {import('vue').Ref<Map<string, { stockId: string, stockName: string }[]>|null>} */
const picksByDate = ref(null)
/** @type {import('vue').Ref<Map<string, string>|null>} */
const csvUniverse = ref(null)
const csvMeta = reactive({
  rowCount: 0,
  stockCount: 0,
  dateCount: 0,
  minDate: '',
  maxDate: '',
  fileName: '',
})

const loading = ref(false)
const running = ref(false)
const progressCurrent = ref(0)
const progressTotal = ref(0)
const progressPhase = ref('')
const result = ref(null)
const chartDom = ref(null)
const eventDetailVisible = ref(false)
const selectedEvent = ref(null)

const poolMeta = reactive({
  stockCount: 0,
  loadedCount: 0,
  tradingDays: 0,
})

const progressPct = computed(() => {
  if (!progressTotal.value) return 0
  return Math.round((progressCurrent.value / progressTotal.value) * 100)
})

const progressText = computed(() => {
  if (!progressTotal.value) return progressPhase.value
  return `${progressPhase.value} ${progressCurrent.value} / ${progressTotal.value}`
})

const maxCullCount = computed(() => {
  const y = rebalanceInterval.value
  const max = maxHoldingDays.value
  if (!y || !max) return 0
  let count = 0
  for (let offset = y; offset < max; offset += y) count += 1
  return count
})

const holdingSpanDays = computed(() =>
  holdingMode.value === 'maxDays'
    ? maxHoldingDays.value
    : roundCycles.value * rebalanceInterval.value
)

async function onCsvChange(uploadFile) {
  const file = uploadFile?.raw
  if (!file) return
  try {
    const parsed = await parseQuantEntryListCsv(file)
    picksByDate.value = parsed.picksByDate
    csvUniverse.value = parsed.universe
    csvMeta.rowCount = parsed.rowCount
    csvMeta.stockCount = parsed.universe.size
    csvMeta.dateCount = parsed.picksByDate.size
    csvMeta.minDate = parsed.dateRange?.min || ''
    csvMeta.maxDate = parsed.dateRange?.max || ''
    csvMeta.fileName = file.name
    if (csvMeta.minDate) startDate.value = csvMeta.minDate
    if (csvMeta.maxDate) endDate.value = csvMeta.maxDate
    ElMessage.success(
      `已載入 ${csvMeta.stockCount} 檔、${csvMeta.dateCount} 個進場日`
    )
  } catch (err) {
    console.error(err)
    onCsvRemove()
    ElMessage.error(err.message || 'CSV 解析失敗')
  }
}

function onCsvRemove() {
  picksByDate.value = null
  csvUniverse.value = null
  csvMeta.rowCount = 0
  csvMeta.stockCount = 0
  csvMeta.dateCount = 0
  csvMeta.minDate = ''
  csvMeta.maxDate = ''
  csvMeta.fileName = ''
}

const TYPE_LABELS = {
  round_buy: '建倉',
  cull: '汰弱',
  settle: '結算',
  buy_skip: '略過建倉',
}

const eventRows = computed(() => {
  if (!result.value?.events?.length) return []
  const history = result.value.history ?? []
  return result.value.events.map((ev, i) => ({
    roundNo: ev.roundNo,
    date: ev.date,
    type: ev.type,
    typeLabel: TYPE_LABELS[ev.type] ?? ev.type,
    detail: formatEventDetail(ev),
    netAsset: history[i]?.netAsset ?? null,
    raw: ev,
  }))
})

const dialogTitle = computed(() => {
  if (!selectedEvent.value) return '事件明細'
  const t = TYPE_LABELS[selectedEvent.value.type] ?? selectedEvent.value.type
  return `第 ${selectedEvent.value.roundNo} 輪 · ${t} · ${formatDisplayDate(selectedEvent.value.date)}`
})

const momentumColumnLabel = computed(() => {
  const y = selectedEvent.value?.lookbackDays
  return y ? `過去 ${y} 日漲幅` : '過去 Y 日漲幅'
})

/** 建倉：依 CSV 名單序 */
const buyRowsSorted = computed(() =>
  [...(selectedEvent.value?.buys ?? [])].sort(
    (a, b) => (a.momentumRank ?? 0) - (b.momentumRank ?? 0)
  )
)

/** 汰弱賣出：依動能漲幅低→高（驗證賣最差） */
const cullSoldSorted = computed(() =>
  [...(selectedEvent.value?.sold ?? [])].sort(
    (a, b) => (a.momentumReturnPct ?? Infinity) - (b.momentumReturnPct ?? Infinity)
  )
)

/** 汰弱留存：依動能漲幅高→低（驗證留最強） */
const cullKeptSorted = computed(() =>
  [...(selectedEvent.value?.kept ?? [])].sort(
    (a, b) => (b.momentumReturnPct ?? -Infinity) - (a.momentumReturnPct ?? -Infinity)
  )
)

function openEventDetail(row) {
  selectedEvent.value = row.raw ?? null
  eventDetailVisible.value = Boolean(selectedEvent.value)
}

function formatEventDetail(ev) {
  if (ev.type === 'round_buy') {
    const listN = ev.csvListSize != null ? `（當日名單 ${ev.csvListSize} 檔）` : ''
    return `買入 ${ev.pickCount ?? 0} 檔${listN}`
  }
  if (ev.type === 'cull') {
    if (ev.reason && !(ev.sold ?? []).length) {
      return ev.reason
    }
    const names = (ev.sold ?? []).map((s) => s.stockId).join('、')
    const addonN = (ev.addons ?? []).length
    const zeroN = ev.zeroForceCount ?? 0
    const target =
      ev.targetSellCount != null && ev.targetSellCount !== ev.sellCount
        ? `目標 ${ev.targetSellCount}、`
        : ''
    const zeroTip =
      zeroN > 0
        ? `；⚠ ${zeroN} 檔缺行情以 0 元出清${
            (ev.zeroForceIds ?? []).length ? `（${ev.zeroForceIds.join('、')}）` : ''
          }`
        : ''
    const emptyTip =
      ev.survivorCount === 0 && (ev.sellCount ?? 0) > 0 ? '；強制結算' : ''
    return `${target}賣 ${ev.sellCount ?? 0} 檔${names ? `（${names}）` : ''}，加碼 ${addonN} 檔，存活 ${ev.survivorCount ?? 0} 檔${zeroTip}${emptyTip}`
  }
  if (ev.type === 'settle') {
    return `全數賣出 ${(ev.sold ?? []).length} 檔，期末現金 ${formatMoney(ev.roundCash)}`
  }
  if (ev.type === 'buy_skip') {
    return ev.reason ?? '無符合條件標的'
  }
  return ev.reason ?? '—'
}

const formatMoney = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 2 })
}

const formatPrice = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(4)
}

/** YYYY-MM-DD → M/D */
const formatDisplayDate = (d) => {
  if (!d) return '—'
  const parts = String(d).slice(0, 10).split('-')
  if (parts.length !== 3) return d
  return `${Number(parts[1])}/${Number(parts[2])}`
}

const formatPct = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

const returnClass = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n) || n === 0) return ''
  return n > 0 ? 'text-up' : 'text-down'
}

/** 日曆日偏移（僅用於拉長資料區間） */
function shiftDateString(dateStr, days) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function buildChart(history) {
  if (!chartDom.value || !history?.length) return
  let chart = echarts.getInstanceByDom(chartDom.value)
  if (!chart) chart = echarts.init(chartDom.value)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['總資產', '現金'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: history.map((h) => h.date),
      axisLabel: { rotate: 45 },
    },
    yAxis: { type: 'value', name: '金額' },
    series: [
      { name: '總資產', type: 'line', data: history.map((h) => h.netAsset) },
      { name: '現金', type: 'line', data: history.map((h) => h.cash) },
    ],
  })
}

async function runBacktest() {
  if (!supabase) {
    ElMessage.error('Supabase 未設定')
    return
  }
  if (!picksByDate.value?.size || !csvUniverse.value?.size) {
    ElMessage.warning('請先上傳 CSV 名單')
    return
  }
  if (!startDate.value || !endDate.value) {
    ElMessage.warning('請選擇起訖日期')
    return
  }
  if (startDate.value >= endDate.value) {
    ElMessage.warning('結束日須晚於起點日')
    return
  }

  loading.value = true
  running.value = false
  result.value = null
  progressCurrent.value = 0
  progressTotal.value = 0

  try {
    const lookback = rebalanceInterval.value
    const padCalendarDays = Math.ceil(lookback * 1.6) + holdingSpanDays.value
    const calendarStart = shiftDateString(startDate.value, -padCalendarDays)

    progressPhase.value = '載入交易日曆'
    const calendar = await fetchTradingCalendar(supabase, calendarStart, endDate.value)
    if (calendar.length < lookback + 10) {
      throw new Error('交易日曆資料不足，請確認 DB 已有 2330 日線')
    }

    const requestedStartIdx = indexOfDate(calendar, startDate.value)
    const minStartIdx = getMinActionIdx(lookback)
    const scanFromIdx = Math.max(
      requestedStartIdx >= 0 ? requestedStartIdx : 0,
      minStartIdx
    )

    if (scanFromIdx >= calendar.length) {
      throw new Error('起點日超出資料區間，請選較早的結束日或較晚的起點日')
    }

    const dataStartDate = calendar[0]
    const universe = csvUniverse.value
    poolMeta.stockCount = universe.size

    progressPhase.value = '載入股價'
    progressTotal.value = universe.size
    progressCurrent.value = 0

    const stockData = await loadStockHistories(
      supabase,
      universe,
      dataStartDate,
      endDate.value,
      {
        concurrency: 10,
        onProgress: (done, total) => {
          progressCurrent.value = done
          progressTotal.value = total
        },
      }
    )

    poolMeta.loadedCount = stockData.size
    poolMeta.tradingDays = calendar.length

    if (!stockData.size) {
      throw new Error('CSV 代號在資料庫找不到日線，請先批次爬取')
    }

    loading.value = false
    running.value = true

    progressPhase.value = '尋找可建倉起點（CSV 進場日）'
    const minTurnover = minTurnoverWan.value * 10_000
    const validStartIdx = findFirstValidCsvActionIdx(
      picksByDate.value,
      stockData,
      calendar,
      scanFromIdx,
      minTurnover,
      1,
      buyHighSellLow.value,
      lookback
    )

    if (validStartIdx < 0) {
      throw new Error(
        `在 ${normalizeTradeDateKey(startDate.value)} 之後，找不到「CSV 有名單且可交易」的建倉日。請確認進場日是否為交易日、DB 是否有對應股價，或降低最低成交金額。`
      )
    }

    const effectiveStartDate = calendar[validStartIdx]
    if (validStartIdx !== scanFromIdx) {
      ElMessage.warning(
        `起點 ${startDate.value} 無可用 CSV 名單／不可交易，已順延至 ${effectiveStartDate}`
      )
    }

    const backtest = runMomentumRotationBacktest(stockData, calendar, {
      startDate: startDate.value,
      endDate: endDate.value,
      forcedStartIdx: validStartIdx,
      holdCount: holdCount.value,
      selectionMode: 'csv',
      entryPicksByDate: picksByDate.value,
      rebalanceInterval: rebalanceInterval.value,
      roundCycles: roundCycles.value,
      holdingMode: holdingMode.value,
      maxHoldingDays: maxHoldingDays.value,
      cullSizeMode: cullSizeMode.value,
      cullFractionDivisor: cullFractionDivisor.value,
      cullFixedCount: cullFixedCount.value,
      initialCapital: initialCapital.value,
      feeRate: feePercent.value / 100,
      minTurnover,
      cullSellVolumeMode: cullSellVolumeMode.value,
      cullAddonVolumeMode: cullAddonVolumeMode.value,
      skipLimitUpBuy: skipLimitUpBuy.value,
      buyHighSellLow: buyHighSellLow.value,
    })

    result.value = backtest

    if (outputChart.value) {
      nextTick(() => buildChart(backtest.history))
    }

    ElMessage.success(
      `回測完成：${backtest.roundCount} 輪，累積報酬 ${formatPct(backtest.finalReturnPct)}`
    )
  } catch (err) {
    console.error(err)
    ElMessage.error(err.message || '回測失敗')
  } finally {
    loading.value = false
    running.value = false
  }
}
</script>

<style scoped>
.momentum-pick {
  padding: 20px;
  max-width: 1100px;
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
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
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
  color: var(--el-text-color-secondary);
}

.pool-meta {
  margin-top: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.chart-wrapper h4 {
  margin: 0 0 12px;
  padding-left: 10px;
  border-left: 4px solid #409eff;
}

.chart {
  width: 100%;
  height: 420px;
}

.hint-inline {
  margin-left: 6px;
  font-size: 12px;
  color: var(--el-color-warning);
}

.text-up {
  color: #67c23a;
}

.text-down {
  color: #f56c6c;
}

.table-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.event-table :deep(.el-table__row) {
  cursor: pointer;
}

.detail-section-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.detail-section-title:not(:first-child) {
  margin-top: 16px;
}

.detail-note {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
</style>
