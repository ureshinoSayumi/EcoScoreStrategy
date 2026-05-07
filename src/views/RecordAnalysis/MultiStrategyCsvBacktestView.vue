<template>
  <div class="multi-csv-backtest">
    <el-card shadow="hover" class="panel">
      <template #header>
        <div class="card-header">
          <span>多策略 CSV 回測（持股上限均分）</span>
        </div>
      </template>

      <p class="hint">
        每個 CSV 視為<strong>一個獨立策略</strong>（格式同 XQ 分析器重製版）。<strong>總持股上限</strong>會除以<strong>上傳檔案數</strong>，向下取整後作為該檔在
        <code>calculateSimulationResult2</code> 的 <code>maxPositions</code>。<br />
        若除法結果小於 1，請提高總上限或減少檔案數。<br />
        <strong>再平衡模擬</strong>：組合總資金為「初始資金 × 策略數」並均分現金起算；每
        <strong>檢核間隔日</strong>依各策略<strong>過去 N 日</strong>內「<strong>出場時間</strong>」落在區間之已完成交易平均報酬排名（避免用進場日誤用未結束部位），後段組各<strong>鎖定承諾</strong>「當日淨值 × 移轉比例」並排入待償佇列；之後每日<strong>先平倉 → 再還債（有現金即沖銷，實付立刻均分給該期前段名單）→ 再買進</strong>。
      </p>

      <el-form label-width="140px" class="form-main">
        <el-form-item label="上傳 CSV（多選）">
          <input
            ref="fileInputRef"
            type="file"
            accept=".csv"
            multiple
            class="file-input"
            @change="onFilesSelected"
          />
        </el-form-item>
        <el-form-item label="已選策略檔">
          <div v-if="strategies.length" class="file-tags">
            <el-tag
              v-for="s in strategies"
              :key="s.id"
              type="info"
              closable
              class="tag-item"
              @close="removeStrategy(s.id)"
            >
              {{ s.fileName }}（{{ s.tradeCount }} 筆）
            </el-tag>
          </div>
          <el-text v-else type="info">尚未選擇檔案</el-text>
        </el-form-item>
        <el-form-item label="總持股上限">
          <el-input-number v-model="totalMaxPositions" :min="1" :max="100" controls-position="right" />
        </el-form-item>
        <el-form-item label="初始資金">
          <el-input-number v-model="initialCapital" :min="1" :step="1000" controls-position="right" />
        </el-form-item>
        <el-form-item label="一日買入多次">
          <el-switch v-model="dayBuyRepeat" inline-prompt active-text="可" inactive-text="否" />
        </el-form-item>
        <el-divider content-position="left">再平衡參數（可外接調整）</el-divider>
        <el-form-item label="前段比例 %">
          <el-input-number v-model="rebalanceTopPercent" :min="0" :max="100" controls-position="right" />
          <el-text size="small" type="info" class="inline-hint">排名靠前之前若干％策略為接收方</el-text>
        </el-form-item>
        <el-form-item label="後段比例 %">
          <el-input-number v-model="rebalanceBottomPercent" :min="0" :max="100" controls-position="right" />
          <el-text size="small" type="info" class="inline-hint">排名靠後之若干％策略為捐贈方</el-text>
        </el-form-item>
        <el-form-item label="移轉比例 %">
          <el-input-number v-model="rebalanceTransferPercent" :min="0" :max="100" controls-position="right" />
          <el-text size="small" type="info" class="inline-hint">後段於檢核日鎖定「淨值×此比例」為承諾金額，日後有現金再逐步償還</el-text>
        </el-form-item>
        <el-form-item label="檢核間隔（日）">
          <el-input-number v-model="rebalanceReviewDays" :min="1" :max="3650" controls-position="right" />
        </el-form-item>
        <el-form-item label="排名視窗（日）">
          <el-input-number v-model="rebalanceMetricDays" :min="1" :max="3650" controls-position="right" />
          <el-text size="small" type="info" class="inline-hint">過去幾日內「出場時間」之交易報酬平均</el-text>
        </el-form-item>
        <el-form-item label=" ">
          <el-button type="primary" :disabled="!canRun" @click="runAll">執行回測</el-button>
          <el-button @click="clearAll">清空檔案</el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="strategies.length"
        :title="allocationHint"
        type="info"
        show-icon
        :closable="false"
        class="alloc-alert"
      />

      <div v-if="results.length" class="results-wrap">
        <h3 class="results-title">各策略模擬結果</h3>
        <el-table :data="results" border stripe size="small" class="result-table">
          <el-table-column prop="fileName" label="檔案（策略）" min-width="160" show-overflow-tooltip />
          <el-table-column prop="perMaxPositions" label="持股上限" width="100" align="center" />
          <el-table-column prop="tradeCount" label="交易筆數" width="96" align="center" />
          <el-table-column label="重複進場" align="center">
            <el-table-column prop="repeatFinalReturn" label="總報酬%" width="100" align="right" />
            <el-table-column prop="repeatMaxDd" label="最大回撤%" width="110" align="right" />
            <el-table-column prop="repeatRotations" label="輪動" width="72" align="center" />
            <el-table-column prop="repeatMeanY" label="年均%" width="88" align="right" />
            <el-table-column prop="repeatMedianY" label="年中位%" width="96" align="right" />
          </el-table-column>
          <el-table-column label="不重複進場" align="center">
            <el-table-column prop="noRepeatFinalReturn" label="總報酬%" width="100" align="right" />
            <el-table-column prop="noRepeatMaxDd" label="最大回撤%" width="110" align="right" />
            <el-table-column prop="noRepeatRotations" label="輪動" width="72" align="center" />
            <el-table-column prop="noRepeatMeanY" label="年均%" width="88" align="right" />
            <el-table-column prop="noRepeatMedianY" label="年中位%" width="96" align="right" />
          </el-table-column>
        </el-table>

        <div v-if="portfolioSummary" class="total-return-block">
          <h4 class="total-return-title">總報酬</h4>
          <el-descriptions :column="1" border size="small" class="total-return-desc">
            <el-descriptions-item label="合併總報酬（重複進場）">
              <strong>{{ portfolioSummary.repeatCombined.toFixed(2) }}%</strong>
              <el-text size="small" type="info" class="total-return-note">
                每策略各投入 {{ initialCapital }}，期末淨值加總後相對「策略數 × 初始資金」的報酬率（期末合計
                {{ portfolioSummary.endRepeatTotal.toLocaleString() }}）。
              </el-text>
            </el-descriptions-item>
            <el-descriptions-item label="合併總報酬（不重複進場）">
              <strong>{{ portfolioSummary.noRepeatCombined.toFixed(2) }}%</strong>
              <el-text size="small" type="info" class="total-return-note">
                同上；期末合計 {{ portfolioSummary.endNoRepeatTotal.toLocaleString() }}。
              </el-text>
            </el-descriptions-item>
            <el-descriptions-item label="各策略總報酬 · 算術平均">
              <span>重複 {{ portfolioSummary.repeatMean.toFixed(2) }}% ／ 不重複 {{ portfolioSummary.noRepeatMean.toFixed(2) }}%</span>
              <el-text size="small" type="info" class="total-return-note">
                僅將上表各列總報酬%取平均，與合併總報酬（淨值加總）意義不同。
              </el-text>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <div v-if="rebalanceBundle" class="rebalance-wrap">
          <h3 class="results-title">再平衡模擬（共用總資金 · 日曆合併）</h3>
          <p class="rebalance-hint">
            總本金 {{ rebalanceBundle.totalInitialCapital.toLocaleString() }}（＝每策略初始
            {{ initialCapital }} × {{ strategies.length }}）。下列與上方獨立回測並列供比較。
          </p>
          <el-row :gutter="16">
            <el-col :xs="24" :md="12">
              <el-card shadow="never" class="sub-card">
                <template #header>重複進場 + 再平衡</template>
                <el-descriptions v-if="rebalanceBundle.repeat" :column="1" border size="small">
                  <el-descriptions-item label="總報酬 %">
                    {{ rebalanceBundle.repeat.finalReturn.toFixed(2) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="最大回撤 %">
                    {{ rebalanceBundle.repeat.maxDrawdown.toFixed(2) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="輪動（合計）">
                    {{ rebalanceBundle.repeat.rotations }}
                  </el-descriptions-item>
                  <el-descriptions-item label="年化 均／中位／最差／最佳">
                    {{ rebalanceBundle.repeat.mean.toFixed(2) }} ／ {{ rebalanceBundle.repeat.median.toFixed(2) }} ／
                    {{ rebalanceBundle.repeat.worst.toFixed(2) }} ／ {{ rebalanceBundle.repeat.best.toFixed(2) }}
                  </el-descriptions-item>
                </el-descriptions>
              </el-card>
            </el-col>
            <el-col :xs="24" :md="12">
              <el-card shadow="never" class="sub-card">
                <template #header>不重複進場 + 再平衡</template>
                <el-descriptions v-if="rebalanceBundle.noRepeat" :column="1" border size="small">
                  <el-descriptions-item label="總報酬 %">
                    {{ rebalanceBundle.noRepeat.finalReturn.toFixed(2) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="最大回撤 %">
                    {{ rebalanceBundle.noRepeat.maxDrawdown.toFixed(2) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="輪動（合計）">
                    {{ rebalanceBundle.noRepeat.rotations }}
                  </el-descriptions-item>
                  <el-descriptions-item label="年化 均／中位／最差／最佳">
                    {{ rebalanceBundle.noRepeat.mean.toFixed(2) }} ／ {{ rebalanceBundle.noRepeat.median.toFixed(2) }} ／
                    {{ rebalanceBundle.noRepeat.worst.toFixed(2) }} ／ {{ rebalanceBundle.noRepeat.best.toFixed(2) }}
                  </el-descriptions-item>
                </el-descriptions>
              </el-card>
            </el-col>
          </el-row>

          <el-collapse class="rebalance-collapse">
            <el-collapse-item title="再平衡事件紀錄（可展開）" name="log">
              <el-table
                :data="rebalanceEventRows"
                border
                stripe
                size="small"
                max-height="360"
                empty-text="無事件"
              >
                <el-table-column prop="date" label="日期" width="118" />
                <el-table-column prop="summary" label="摘要" min-width="220" show-overflow-tooltip />
                <el-table-column prop="pledgeSum" label="承諾總額" width="110" align="right" />
                <el-table-column prop="note" label="備註" width="120" show-overflow-tooltip />
              </el-table>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { parseCSV } from '@/utils/csvReader'
import { calculateSimulationResult2 } from './utils/monteCarloMethod'
import {
  calculateMultiStrategyRebalanceSimulation,
  REBALANCE_DEFAULTS,
} from './utils/multiStrategyRebalanceSimulation'

let strategyIdSeq = 0

function rowsToTradeLog(rawRows) {
  return rawRows.map((item) => ({
    name: item['商品名稱'],
    code: item['商品代碼'],
    index: item['序號'],
    buyDay: item['進場時間'],
    buyPrice: item['進場價格'],
    sellDay: item['出場時間'],
    sellPrice: item['出場價格'],
    return: item['報酬率'],
  }))
}

const fileInputRef = ref(null)
const strategies = ref([])
const results = ref([])

const totalMaxPositions = ref(10)
const initialCapital = ref(10000)
const dayBuyRepeat = ref(true)

const rebalanceTopPercent = ref(REBALANCE_DEFAULTS.topPercent)
const rebalanceBottomPercent = ref(REBALANCE_DEFAULTS.bottomPercent)
const rebalanceTransferPercent = ref(REBALANCE_DEFAULTS.transferPercent)
const rebalanceReviewDays = ref(REBALANCE_DEFAULTS.reviewIntervalDays)
const rebalanceMetricDays = ref(REBALANCE_DEFAULTS.metricLookbackDays)

const rebalanceBundle = ref(null)

const rebalanceEventRows = computed(() => {
  const b = rebalanceBundle.value
  if (!b?.repeat?.rebalanceLog) return []
  return b.repeat.rebalanceLog.map((ev) => {
    const pledgeSum = ev.skipped
      ? '—'
      : (ev.pledges || []).reduce((s, p) => s + (Number(p.pledged) || 0), 0)
    return {
      date: ev.date,
      skipped: ev.skipped,
      summary: ev.skipped
        ? `略過：${ev.reason || ''}`
        : `鎖定承諾｜贏家 ${ev.winners?.map((w) => w.fileName).join('、') || '—'} ← 輸家 ${ev.losers?.map((x) => x.fileName).join('、') || '—'}`,
      pledgeSum: ev.skipped ? '—' : Number(pledgeSum.toFixed(2)),
      note: ev.skipped ? '—' : '當日不匯款；之後有現金再均分給該期贏家',
    }
  })
})

const perStrategyMax = computed(() => {
  const n = strategies.value.length
  if (n === 0) return 0
  return Math.floor(totalMaxPositions.value / n)
})

const allocationHint = computed(() => {
  const n = strategies.value.length
  if (!n) return ''
  const per = perStrategyMax.value
  const rem = totalMaxPositions.value % n
  return `共 ${n} 個策略；每策略持股上限 = ⌊${totalMaxPositions.value} ÷ ${n}⌋ = ${per}。${
    rem > 0 ? `（總上限除不盡，餘 ${rem} 檔未納入此均分規則）` : ''
  }`
})

const canRun = computed(() => {
  return strategies.value.length > 0 && perStrategyMax.value >= 1
})

/** 多策略各一筆相同初始資金時：合併總報酬 = 期末淨值加總 / 總本金 - 1 */
const portfolioSummary = computed(() => {
  const rows = results.value
  const n = rows.length
  const cap = initialCapital.value
  if (!n || !Number.isFinite(cap) || cap <= 0) return null

  let sumRepeatMult = 0
  let sumNoRepeatMult = 0
  for (const r of rows) {
    sumRepeatMult += 1 + r.repeatFinalReturn / 100
    sumNoRepeatMult += 1 + r.noRepeatFinalReturn / 100
  }

  const repeatCombined = (sumRepeatMult / n - 1) * 100
  const noRepeatCombined = (sumNoRepeatMult / n - 1) * 100
  const endRepeatTotal = cap * sumRepeatMult
  const endNoRepeatTotal = cap * sumNoRepeatMult

  const repeatMean = rows.reduce((s, r) => s + r.repeatFinalReturn, 0) / n
  const noRepeatMean = rows.reduce((s, r) => s + r.noRepeatFinalReturn, 0) / n

  return {
    repeatCombined,
    noRepeatCombined,
    endRepeatTotal,
    endNoRepeatTotal,
    repeatMean,
    noRepeatMean,
  }
})

async function onFilesSelected(ev) {
  const files = ev.target?.files
  if (!files?.length) return

  const next = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      const data = await parseCSV(file)
      const rows = rowsToTradeLog(data)
      next.push({
        id: ++strategyIdSeq,
        fileName: file.name,
        rows,
        tradeCount: rows.length,
      })
    } catch (e) {
      console.error(e)
      ElMessage.error(`解析失敗：${file.name}`)
    }
  }

  if (next.length) {
    strategies.value = next
    results.value = []
    rebalanceBundle.value = null
    ElMessage.success(`已載入 ${next.length} 個策略檔`)
  }
  ev.target.value = ''
}

function removeStrategy(id) {
  strategies.value = strategies.value.filter((s) => s.id !== id)
  results.value = []
  rebalanceBundle.value = null
}

function clearAll() {
  strategies.value = []
  results.value = []
  rebalanceBundle.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function runAll() {
  if (!canRun.value) {
    if (strategies.value.length === 0) {
      ElMessage.warning('請先上傳 CSV')
    } else {
      ElMessage.warning(
        `每策略持股上限為 ${perStrategyMax.value}（需 ≥ 1）。請提高「總持股上限」或減少檔案數。`
      )
    }
    return
  }

  const per = perStrategyMax.value
  const cap = initialCapital.value
  const dbr = dayBuyRepeat.value

  const out = []
  for (const s of strategies.value) {
    const repeatResult = calculateSimulationResult2(s.rows, cap, per, true, dbr)
    const noRepeatResult = calculateSimulationResult2(s.rows, cap, per, false, dbr)

    out.push({
      fileName: s.fileName,
      perMaxPositions: per,
      tradeCount: s.tradeCount,
      repeatFinalReturn: Number(repeatResult.finalReturn.toFixed(2)),
      repeatMaxDd: Number(repeatResult.maxDrawdown.toFixed(2)),
      repeatRotations: repeatResult.rotations,
      repeatMeanY: Number(repeatResult.mean.toFixed(2)),
      repeatMedianY: Number(repeatResult.median.toFixed(2)),
      noRepeatFinalReturn: Number(noRepeatResult.finalReturn.toFixed(2)),
      noRepeatMaxDd: Number(noRepeatResult.maxDrawdown.toFixed(2)),
      noRepeatRotations: noRepeatResult.rotations,
      noRepeatMeanY: Number(noRepeatResult.mean.toFixed(2)),
      noRepeatMedianY: Number(noRepeatResult.median.toFixed(2)),
    })
  }

  results.value = out

  const totalPool = cap * strategies.value.length
  const stratPayload = strategies.value.map((s) => ({ fileName: s.fileName, rows: s.rows }))
  const rebalanceOpts = {
    totalInitialCapital: totalPool,
    maxPositionsPerStrategy: per,
    dayBuyRepeat: dbr,
    topPercent: rebalanceTopPercent.value,
    bottomPercent: rebalanceBottomPercent.value,
    transferPercent: rebalanceTransferPercent.value,
    reviewIntervalDays: rebalanceReviewDays.value,
    metricLookbackDays: rebalanceMetricDays.value,
  }
  const repeatReb = calculateMultiStrategyRebalanceSimulation(stratPayload, {
    ...rebalanceOpts,
    isRepeat: true,
  })
  const noRepeatReb = calculateMultiStrategyRebalanceSimulation(stratPayload, {
    ...rebalanceOpts,
    isRepeat: false,
  })
  rebalanceBundle.value = {
    totalInitialCapital: totalPool,
    repeat: repeatReb,
    noRepeat: noRepeatReb,
  }

  ElMessage.success('獨立與再平衡回測皆已計算完成')
}
</script>

<style scoped>
.multi-csv-backtest {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.panel {
  width: 100%;
}

.card-header {
  font-weight: 600;
}

.hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin: 0 0 16px;
}

.form-main {
  max-width: 720px;
}

.file-input {
  display: block;
}

.file-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  margin: 0;
}

.alloc-alert {
  margin-bottom: 16px;
}

.results-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px;
}

.result-table {
  width: 100%;
}

.total-return-block {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.total-return-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px;
}

.total-return-desc {
  max-width: 720px;
}

.total-return-note {
  display: block;
  margin-top: 6px;
  line-height: 1.5;
}

.inline-hint {
  display: block;
  margin-top: 6px;
}

.rebalance-wrap {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px dashed var(--el-border-color);
}

.rebalance-hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 0 0 12px;
  line-height: 1.5;
}

.sub-card {
  margin-bottom: 16px;
}

.rebalance-collapse {
  margin-top: 12px;
}
</style>
