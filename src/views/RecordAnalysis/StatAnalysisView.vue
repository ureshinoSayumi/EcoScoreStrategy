<template>
  <div class="stat-analysis">
    <el-card shadow="hover" class="panel">
      <template #header>
        <div class="card-header">
          <span>統計分析 · 雙回測 CSV 合併</span>
        </div>
      </template>

      <p class="hint">
        請各上傳一個與「XQ 分析器 重製版」相同格式的 CSV（欄位：商品名稱、商品代碼、序號、進場時間、進場價格、出場時間、出場價格、報酬率…）。<br />
        以<strong>商品名稱</strong>與<strong>進場時間</strong>相同者合併為一列；左檔欄位後綴 <code>_30</code>，右檔 <code>_60</code>。<br />
        <strong>兩個檔案都上傳並解析成功後</strong>才會合併資料並顯示統計與政策模擬（合併明細表目前關閉）。
      </p>

      <el-form label-width="120px" class="upload-form">
        <el-form-item label="CSV（_30）">
          <input
            ref="input30Ref"
            type="file"
            accept=".csv"
            class="file-input"
            @change="onFile30"
          />
          <el-tag v-if="fileName30" type="info" class="file-tag" closable @close="clear30">
            {{ fileName30 }}
          </el-tag>
        </el-form-item>
        <el-form-item label="CSV（_60）">
          <input
            ref="input60Ref"
            type="file"
            accept=".csv"
            class="file-input"
            @change="onFile60"
          />
          <el-tag v-if="fileName60" type="info" class="file-tag" closable @close="clear60">
            {{ fileName60 }}
          </el-tag>
        </el-form-item>
      </el-form>

      <div v-if="mergeHint" class="merge-hint">
        <el-alert :title="mergeHint" :type="mergeHintType" show-icon :closable="false" />
      </div>

      <div v-if="bothFilesReady && sideStatsSummary" class="side-stats">
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-card shadow="never" class="side-stats-card">
              <template #header>
                <div class="side-stats-card__header">
                  <span class="side-stats-card__title">_30（左檔）統計</span>
                  <el-text size="small" type="info">算法同 OptimizedIndex 單策略表格</el-text>
                </div>
              </template>
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="平均報酬">
                  {{ sideStatsSummary.s30.averageReturn.toFixed(2) }}%
                </el-descriptions-item>
                <el-descriptions-item label="報酬中位數">
                  {{ sideStatsSummary.s30.medianReturn.toFixed(2) }}%
                </el-descriptions-item>
                <el-descriptions-item label="勝率">
                  {{ sideStatsSummary.s30.winRate.toFixed(2) }}%
                </el-descriptions-item>
                <el-descriptions-item label="交易筆數">
                  {{ sideStatsSummary.s30.tradeCount }}
                </el-descriptions-item>
              </el-descriptions>
            </el-card>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-card shadow="never" class="side-stats-card">
              <template #header>
                <div class="side-stats-card__header">
                  <span class="side-stats-card__title">_60（右檔）統計</span>
                  <el-text size="small" type="info">算法同 OptimizedIndex 單策略表格</el-text>
                </div>
              </template>
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="平均報酬">
                  {{ sideStatsSummary.s60.averageReturn.toFixed(2) }}%
                </el-descriptions-item>
                <el-descriptions-item label="報酬中位數">
                  {{ sideStatsSummary.s60.medianReturn.toFixed(2) }}%
                </el-descriptions-item>
                <el-descriptions-item label="勝率">
                  {{ sideStatsSummary.s60.winRate.toFixed(2) }}%
                </el-descriptions-item>
                <el-descriptions-item label="交易筆數">
                  {{ sideStatsSummary.s60.tradeCount }}
                </el-descriptions-item>
              </el-descriptions>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <div v-if="bothFilesReady && groupedReturnStats" class="grouped-stats">
        <div class="grouped-stats__head">
          <h3 class="grouped-stats__title">依 _30 報酬正負分組（條件統計）</h3>
          <el-text size="small" type="info">
            僅使用合併表中<strong>兩側報酬均可解析為數字</strong>的列，共
            {{ groupedReturnStats.pairedCount }} 筆。Δ = r<sub>60</sub> − r<sub>30</sub>（與
            CSV 報酬同尺度，表列以 % 顯示）。
          </el-text>
        </div>
        <el-row :gutter="16">
          <el-col :xs="24" :lg="8">
            <el-card shadow="never" class="grouped-card">
              <template #header>
                <span class="grouped-card__title">A. r<sub>30</sub> &gt; 0</span>
              </template>
              <el-descriptions v-if="groupedReturnStats.pos.n > 0" :column="1" border size="small">
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      筆數
                      <el-tooltip :content="groupedStatHelp.count" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ groupedReturnStats.pos.n }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      P(r60&gt;0 | r30&gt;0)
                      <el-tooltip :content="groupedStatHelp.p60Given30Pos" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRatePct(groupedReturnStats.pos.p60When30Pos) }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      r60 平均
                      <el-tooltip :content="groupedStatHelp.r60Mean" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRetPct(groupedReturnStats.pos.meanR60) }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      r60 中位數
                      <el-tooltip :content="groupedStatHelp.r60Median" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRetPct(groupedReturnStats.pos.medianR60) }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      Δ 平均
                      <el-tooltip :content="groupedStatHelp.deltaMean" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRetPct(groupedReturnStats.pos.meanDelta) }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      Δ 中位數
                      <el-tooltip :content="groupedStatHelp.deltaMedian" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRetPct(groupedReturnStats.pos.medianDelta) }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      P(Δ&gt;0)
                      <el-tooltip :content="groupedStatHelp.pDeltaGt0" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRatePct(groupedReturnStats.pos.pDeltaGt0) }}
                </el-descriptions-item>
              </el-descriptions>
              <el-empty v-else description="無樣本" :image-size="64" />
            </el-card>
          </el-col>
          <el-col :xs="24" :lg="8">
            <el-card shadow="never" class="grouped-card">
              <template #header>
                <span class="grouped-card__title">B. r<sub>30</sub> &lt; 0</span>
              </template>
              <el-descriptions v-if="groupedReturnStats.neg.n > 0" :column="1" border size="small">
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      筆數
                      <el-tooltip :content="groupedStatHelp.count" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ groupedReturnStats.neg.n }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      P(r60&lt;0 | r30&lt;0)
                      <el-tooltip :content="groupedStatHelp.p60Given30Neg" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRatePct(groupedReturnStats.neg.p60When30Neg) }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      r60 平均
                      <el-tooltip :content="groupedStatHelp.r60Mean" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRetPct(groupedReturnStats.neg.meanR60) }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      r60 中位數
                      <el-tooltip :content="groupedStatHelp.r60Median" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRetPct(groupedReturnStats.neg.medianR60) }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      Δ 平均
                      <el-tooltip :content="groupedStatHelp.deltaMean" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRetPct(groupedReturnStats.neg.meanDelta) }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      Δ 中位數
                      <el-tooltip :content="groupedStatHelp.deltaMedian" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRetPct(groupedReturnStats.neg.medianDelta) }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      P(Δ&lt;0)
                      <el-tooltip :content="groupedStatHelp.pDeltaLt0" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRatePct(groupedReturnStats.neg.pDeltaLt0) }}
                </el-descriptions-item>
              </el-descriptions>
              <el-empty v-else description="無樣本" :image-size="64" />
            </el-card>
          </el-col>
          <el-col :xs="24" :lg="8">
            <el-card shadow="never" class="grouped-card">
              <template #header>
                <span class="grouped-card__title">C. r<sub>30</sub> = 0</span>
              </template>
              <el-descriptions v-if="groupedReturnStats.zero.n > 0" :column="1" border size="small">
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      筆數
                      <el-tooltip :content="groupedStatHelp.count" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ groupedReturnStats.zero.n }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      P(r60&gt;0)
                      <el-tooltip :content="groupedStatHelp.p60PosUncond" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRatePct(groupedReturnStats.zero.p60Pos) }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      P(r60&lt;0)
                      <el-tooltip :content="groupedStatHelp.p60NegUncond" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRatePct(groupedReturnStats.zero.p60Neg) }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      r60 平均
                      <el-tooltip :content="groupedStatHelp.r60Mean" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRetPct(groupedReturnStats.zero.meanR60) }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      r60 中位數
                      <el-tooltip :content="groupedStatHelp.r60Median" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRetPct(groupedReturnStats.zero.medianR60) }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      Δ 平均（= r60）
                      <el-tooltip :content="groupedStatHelp.deltaMeanEqR60" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRetPct(groupedReturnStats.zero.meanDelta) }}
                </el-descriptions-item>
                <el-descriptions-item>
                  <template #label>
                    <span class="desc-label-with-tip">
                      Δ 中位數
                      <el-tooltip :content="groupedStatHelp.deltaMedian" placement="top" :show-after="400">
                        <el-icon class="stat-help-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  {{ fmtRetPct(groupedReturnStats.zero.medianDelta) }}
                </el-descriptions-item>
              </el-descriptions>
              <el-empty v-else description="無樣本（r30=0）" :image-size="64" />
            </el-card>
          </el-col>
        </el-row>
      </div>

      <div v-if="bothFilesReady && policyTradeRows.length" class="policy-sim">
        <el-card shadow="never" class="policy-sim__card">
          <template #header>
            <div class="policy-sim__head">
              <span class="policy-sim__title">政策模擬（30 天停損 · 特殊空位加碼 · 60 天出場）</span>
              <el-text size="small" type="info">與 XQ 滾動回測不同；依合併表逐日模擬</el-text>
            </div>
          </template>
          <p class="policy-sim__rules">
            最多持有 {{ policyMaxPositions }} 檔（可調整）。滿 30 天若 r<sub>30</sub>&lt;0 則賣出，釋出之「特殊空位」不買選股池，該筆資金均分加碼到當日已滿 30 天且
            r<sub>30</sub>&gt;0 的持倉；加碼至 60 天出場時以 sellPrice<sub>60</sub>/buyPrice<sub>30</sub> 比例一併了結。60
            天正常到期賣出後空位可再買持池。r<sub>30</sub>=0 不視為停損。執行模擬後若開啟「Console 時間軸」，請打開開發者工具 Console 檢視逐日事件。
          </p>
          <el-form :inline="true" class="policy-sim__form">
            <el-form-item label="初始資金">
              <el-input-number v-model="policyInitialCapital" :min="1" :step="1000" controls-position="right" />
            </el-form-item>
            <el-form-item label="最多檔數">
              <el-input-number v-model="policyMaxPositions" :min="1" :max="50" controls-position="right" />
            </el-form-item>
            <el-form-item label="允許重複標的">
              <el-switch v-model="policyIsRepeat" />
            </el-form-item>
            <el-form-item label="同日可多次買滿">
              <el-switch v-model="policyDayBuyRepeat" />
            </el-form-item>
            <el-form-item label="Console 時間軸">
              <el-switch v-model="policyConsoleTrace" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="runPolicySimulation">執行模擬</el-button>
            </el-form-item>
          </el-form>
          <el-text size="small" type="info" class="policy-sim__count">
            持池有效列：{{ policyTradeRows.length }}（來自合併表，雙邊報酬與出場日皆有效）
          </el-text>

          <div v-if="policySimResult" class="policy-sim__result">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="總報酬率">
                {{ policySimResult.finalReturn.toFixed(2) }}%
              </el-descriptions-item>
              <el-descriptions-item label="最大回撤">
                {{ policySimResult.maxDrawdown.toFixed(2) }}%
              </el-descriptions-item>
              <el-descriptions-item label="選股池進場次數">
                {{ policySimResult.rotations }}
              </el-descriptions-item>
              <el-descriptions-item label="年化（均值／中位／最差／最佳）">
                {{ policySimResult.mean.toFixed(2) }}%／{{ policySimResult.median.toFixed(2) }}%／{{
                  policySimResult.worst.toFixed(2)
                }}%／{{ policySimResult.best.toFixed(2) }}%
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-card>
      </div>

      <el-table
        v-if="bothFilesReady && showMergeDetailTable"
        :data="mergedRows"
        border
        stripe
        class="merge-table"
        max-height="640"
        empty-text="尚無資料"
      >
        <el-table-column prop="productName" label="商品名稱" min-width="120" show-overflow-tooltip />
        <el-table-column label="商品代碼" align="center">
          <el-table-column prop="code_30" label="_30" width="88" show-overflow-tooltip />
          <el-table-column prop="code_60" label="_60" width="88" show-overflow-tooltip />
        </el-table-column>
        <el-table-column prop="buyDay" label="進場時間" width="118" />
        <el-table-column label="進場價格" align="right">
          <el-table-column label="_30" width="100" align="right">
            <template #default="{ row }">{{ formatCell(row.buyPrice_30) }}</template>
          </el-table-column>
          <el-table-column label="_60" width="100" align="right">
            <template #default="{ row }">{{ formatCell(row.buyPrice_60) }}</template>
          </el-table-column>
        </el-table-column>
        <el-table-column label="出場時間" align="center">
          <el-table-column prop="sellDay_30" label="_30" width="118" show-overflow-tooltip />
          <el-table-column prop="sellDay_60" label="_60" width="118" show-overflow-tooltip />
        </el-table-column>
        <el-table-column label="出場價格" align="right">
          <el-table-column label="_30" width="100" align="right">
            <template #default="{ row }">{{ formatCell(row.sellPrice_30) }}</template>
          </el-table-column>
          <el-table-column label="_60" width="100" align="right">
            <template #default="{ row }">{{ formatCell(row.sellPrice_60) }}</template>
          </el-table-column>
        </el-table-column>
        <el-table-column label="持有區間（日）" align="right">
          <el-table-column label="_30" width="100" align="right">
            <template #default="{ row }">{{ formatHoldingDays(row.holdingDays_30) }}</template>
          </el-table-column>
          <el-table-column label="_60" width="100" align="right">
            <template #default="{ row }">{{ formatHoldingDays(row.holdingDays_60) }}</template>
          </el-table-column>
        </el-table-column>
        <el-table-column label="報酬率" align="right">
          <el-table-column label="_30" min-width="100" align="right">
            <template #default="{ row }">
              <span :class="returnClass(row.return_30)">{{ formatCell(row.return_30) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="_60" min-width="100" align="right">
            <template #default="{ row }">
              <span :class="returnClass(row.return_60)">{{ formatCell(row.return_60) }}</span>
            </template>
          </el-table-column>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { QuestionFilled } from '@element-plus/icons-vue'
import { parseCSV } from '@/utils/csvReader'
import { calculatePolicyPyramidSimulation } from './utils/policySimulation'

/** 依 r30 分組卡片內，各統計欄位的滑鼠提示說明 */
const groupedStatHelp = {
  count: '符合該卡片條件（例如 r30>0）的樣本筆數。',
  p60Given30Pos:
    '條件機率 P(r60>0 | r30>0)：只在「r30 為正」的交易列中，60 天報酬 r60 仍為正的比例（表列以 % 顯示）。',
  p60Given30Neg:
    '條件機率 P(r60<0 | r30<0)：只在「r30 為負」的交易列中，r60 仍為負的比例。',
  r60Mean:
    '該組樣本之 60 天報酬 r60 的算術平均。數值與 CSV 報酬同尺度，畫面換算成百分比顯示。',
  r60Median: '該組 r60 由小到大排序後的中位數，較不受極端大賺或大賠筆數影響。',
  deltaMean:
    'Δ = r60 − r30。此為該組 Δ 的平均，代表從 30 天觀測到 60 天觀測這段期間，報酬平均變化多少。',
  deltaMedian: '該組 Δ 的中位數。',
  pDeltaGt0:
    '在該組樣本中，Δ > 0 的比例：亦即 30～60 這段相對於 30 天時多賺（報酬變好）的占比。',
  pDeltaLt0:
    '在該組樣本中，Δ < 0 的比例：30～60 這段報酬相對於 30 天時變差（回吐或續跌）的占比。',
  p60PosUncond: '在 r30=0 的子樣本中，r60 為正的比例。',
  p60NegUncond: '在 r30=0 的子樣本中，r60 為負的比例。',
  deltaMeanEqR60: '當 r30=0 時，Δ = r60 − r30 = r60，故此欄數值等同該組 r60 平均。',
}

/** 合併明細表：改為 true 顯示大表（預設關閉） */
const showMergeDetailTable = ref(false)

const input30Ref = ref(null)
const input60Ref = ref(null)
const fileName30 = ref('')
const fileName60 = ref('')
const rawRows30 = ref([])
const rawRows60 = ref([])

/** 與 OptimizedIndex `processData` 一致，供平均／中位／勝率使用 */
function rowsToReturnTableData(rawRows) {
  return rawRows.map((item) => ({ return: item['報酬率'] }))
}

/** 以下三函式與 OptimizedIndex.vue 相同（報酬率欄位為小數，顯示時已換算成 %） */
function averageReturnComputed(data) {
  if (data.length === 0) return 0
  const total = data.reduce((sum, item) => {
    const r = parseFloat(item.return)
    return Number.isNaN(r) ? sum : sum + r
  }, 0)
  return (total / data.length) * 100
}

function medianReturnComputed(data) {
  const returns = data
    .map((item) => parseFloat(item.return))
    .filter((r) => !Number.isNaN(r))
    .sort((a, b) => a - b)
  const len = returns.length
  if (len === 0) return 0
  if (len % 2 === 1) {
    return returns[Math.floor(len / 2)] * 100
  }
  const mid1 = returns[len / 2 - 1]
  const mid2 = returns[len / 2]
  return ((mid1 + mid2) / 2) * 100
}

function winRateComputed(data) {
  const returns = data.map((i) => parseFloat(i.return)).filter((r) => !Number.isNaN(r))
  if (returns.length === 0) return 0
  const winCount = returns.filter((r) => r > 0).length
  return (winCount / returns.length) * 100
}

function normalizeRawRow(item) {
  return {
    name: String(item['商品名稱'] ?? '').trim(),
    code: String(item['商品代碼'] ?? '').trim(),
    buyDay: String(item['進場時間'] ?? '').trim(),
    buyPrice: item['進場價格'],
    sellDay: String(item['出場時間'] ?? '').trim(),
    sellPrice: item['出場價格'],
    ret: item['報酬率'],
  }
}

function mergeKey(name, buyDay) {
  return JSON.stringify([name, buyDay])
}

function parseDateLoose(s) {
  if (s == null || String(s).trim() === '') return null
  const d = new Date(String(s).replace(/-/g, '/'))
  return Number.isNaN(d.getTime()) ? null : d
}

function sellDayValid(d) {
  const s = String(d ?? '').trim()
  if (!s || s === '—' || s === '-') return false
  return parseDateLoose(s) != null
}

function calendarDaysBetween(start, end) {
  const a = parseDateLoose(start)
  const b = parseDateLoose(end)
  if (!a || !b) return null
  const d = Math.round((b.getTime() - a.getTime()) / 86400000)
  return Number.isFinite(d) ? d : null
}

function withSuffix(rec, suffix) {
  const hold = calendarDaysBetween(rec.buyDay, rec.sellDay)
  return {
    [`code${suffix}`]: rec.code || '—',
    [`buyPrice${suffix}`]: rec.buyPrice,
    [`sellDay${suffix}`]: rec.sellDay || '—',
    [`sellPrice${suffix}`]: rec.sellPrice,
    [`return${suffix}`]: rec.ret,
    [`holdingDays${suffix}`]: hold,
  }
}

function rowsToKeyedMap(rows, suffix) {
  const m = new Map()
  for (const item of rows) {
    const rec = normalizeRawRow(item)
    if (!rec.name && !rec.buyDay) continue
    const k = mergeKey(rec.name, rec.buyDay)
    m.set(k, {
      productName: rec.name,
      buyDay: rec.buyDay,
      ...withSuffix(rec, suffix),
    })
  }
  return m
}

/** 兩邊 CSV 皆已成功載入後才做合併與顯示 */
const bothFilesReady = computed(
  () => fileName30.value.length > 0 && fileName60.value.length > 0
)

/** 各檔全列報酬統計（與 OptimizedIndex 單策略表格同一套公式） */
const sideStatsSummary = computed(() => {
  if (!bothFilesReady.value) return null
  const d30 = rowsToReturnTableData(rawRows30.value)
  const d60 = rowsToReturnTableData(rawRows60.value)
  return {
    s30: {
      tradeCount: d30.length,
      averageReturn: averageReturnComputed(d30),
      medianReturn: medianReturnComputed(d30),
      winRate: winRateComputed(d30),
    },
    s60: {
      tradeCount: d60.length,
      averageReturn: averageReturnComputed(d60),
      medianReturn: medianReturnComputed(d60),
      winRate: winRateComputed(d60),
    },
  }
})

const mergedRows = computed(() => {
  if (!bothFilesReady.value) return []

  const m30 = rowsToKeyedMap(rawRows30.value, '_30')
  const m60 = rowsToKeyedMap(rawRows60.value, '_60')
  const keys = [...new Set([...m30.keys(), ...m60.keys()])]

  const emptySuffix = (suffix) => ({
    [`code${suffix}`]: '—',
    [`buyPrice${suffix}`]: null,
    [`sellDay${suffix}`]: '—',
    [`sellPrice${suffix}`]: null,
    [`return${suffix}`]: null,
    [`holdingDays${suffix}`]: null,
  })

  const list = keys.map((k) => {
    const a = m30.get(k)
    const b = m60.get(k)
    const base = {
      productName: a?.productName || b?.productName || '',
      buyDay: a?.buyDay || b?.buyDay || '',
    }
    const part30 = a || { ...base, ...emptySuffix('_30') }
    const part60 = b || { ...base, ...emptySuffix('_60') }
    return {
      ...base,
      code_30: part30.code_30,
      code_60: part60.code_60,
      buyPrice_30: part30.buyPrice_30,
      buyPrice_60: part60.buyPrice_60,
      sellDay_30: part30.sellDay_30,
      sellDay_60: part60.sellDay_60,
      sellPrice_30: part30.sellPrice_30,
      sellPrice_60: part60.sellPrice_60,
      holdingDays_30: part30.holdingDays_30,
      holdingDays_60: part60.holdingDays_60,
      return_30: part30.return_30,
      return_60: part60.return_60,
    }
  })
  list.sort((x, y) => {
    const ta = parseDateLoose(x.buyDay)?.getTime() ?? 0
    const tb = parseDateLoose(y.buyDay)?.getTime() ?? 0
    if (ta !== tb) return ta - tb
    return String(x.productName).localeCompare(String(y.productName), 'zh-Hant')
  })
  return list
})

/** 政策模擬用持池：雙邊報酬可解析且 _30/_60 出場日有效 */
const policyTradeRows = computed(() => {
  const out = []
  for (const row of mergedRows.value) {
    if (!sellDayValid(row.sellDay_30) || !sellDayValid(row.sellDay_60)) continue
    const r30 = parseReturnNum(row.return_30)
    const r60 = parseReturnNum(row.return_60)
    if (r30 == null || r60 == null) continue
    const buyPrice30 = parseFloat(String(row.buyPrice_30 ?? '').replace(/,/g, ''))
    const sellPrice60 = parseFloat(String(row.sellPrice_60 ?? '').replace(/,/g, ''))
    out.push({
      name: row.productName,
      code: row.code_30 || row.code_60 || '',
      buyDay: row.buyDay,
      sellDay30: row.sellDay_30,
      sellDay60: row.sellDay_60,
      r30,
      r60,
      buyPrice30: Number.isFinite(buyPrice30) ? buyPrice30 : NaN,
      sellPrice60: Number.isFinite(sellPrice60) ? sellPrice60 : NaN,
    })
  }
  return out
})

const policyInitialCapital = ref(10000)
const policyMaxPositions = ref(10)
const policyIsRepeat = ref(true)
const policyDayBuyRepeat = ref(true)
const policyConsoleTrace = ref(true)
const policySimResult = ref(null)

function runPolicySimulation() {
  const rows = policyTradeRows.value
  if (!rows.length) {
    ElMessage.warning('沒有符合條件的合併列（需雙邊報酬可解析且出場日有效）')
    return
  }
  console.log('rows', rows)
  policySimResult.value = calculatePolicyPyramidSimulation(rows, {
    initialCapital: policyInitialCapital.value,
    maxPositions: policyMaxPositions.value,
    isRepeat: policyIsRepeat.value,
    dayBuyRepeat: policyDayBuyRepeat.value,
    trace: policyConsoleTrace.value,
  })
  ElMessage.success('政策模擬已完成')
}

function parseReturnNum(val) {
  if (val === null || val === undefined || val === '') return null
  const s = String(val).trim()
  if (s === '—' || s === '-') return null
  const n = parseFloat(s.replace(/%/g, '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function meanArr(arr) {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function medianArr(arr) {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** 小數報酬 → 顯示 % */
function fmtRetPct(decimal) {
  if (decimal == null || Number.isNaN(decimal)) return '—'
  return `${(decimal * 100).toFixed(2)}%`
}

/** 已為 0–100 的比率 → 顯示 % */
function fmtRatePct(pct) {
  if (pct == null || Number.isNaN(pct)) return '—'
  return `${pct.toFixed(2)}%`
}

/**
 * 合併表雙邊皆可解析報酬時，依 r30 正 / 負 / 零 分組的條件統計
 */
const groupedReturnStats = computed(() => {
  if (!bothFilesReady.value) return null
  const pairs = []
  for (const row of mergedRows.value) {
    const r30 = parseReturnNum(row.return_30)
    const r60 = parseReturnNum(row.return_60)
    if (r30 == null || r60 == null) continue
    pairs.push({ r30, r60, delta: r60 - r30 })
  }

  const pos = pairs.filter((p) => p.r30 > 0)
  const neg = pairs.filter((p) => p.r30 < 0)
  const zero = pairs.filter((p) => p.r30 === 0)

  function blockPos(sub) {
    const n = sub.length
    if (n === 0) {
      return {
        n: 0,
        p60When30Pos: null,
        meanR60: null,
        medianR60: null,
        meanDelta: null,
        medianDelta: null,
        pDeltaGt0: null,
      }
    }
    const p60When30Pos = (sub.filter((p) => p.r60 > 0).length / n) * 100
    const r60s = sub.map((p) => p.r60)
    const deltas = sub.map((p) => p.delta)
    const pDeltaGt0 = (sub.filter((p) => p.delta > 0).length / n) * 100
    return {
      n,
      p60When30Pos,
      meanR60: meanArr(r60s),
      medianR60: medianArr(r60s),
      meanDelta: meanArr(deltas),
      medianDelta: medianArr(deltas),
      pDeltaGt0,
    }
  }

  function blockNeg(sub) {
    const n = sub.length
    if (n === 0) {
      return {
        n: 0,
        p60When30Neg: null,
        meanR60: null,
        medianR60: null,
        meanDelta: null,
        medianDelta: null,
        pDeltaLt0: null,
      }
    }
    const p60When30Neg = (sub.filter((p) => p.r60 < 0).length / n) * 100
    const r60s = sub.map((p) => p.r60)
    const deltas = sub.map((p) => p.delta)
    const pDeltaLt0 = (sub.filter((p) => p.delta < 0).length / n) * 100
    return {
      n,
      p60When30Neg,
      meanR60: meanArr(r60s),
      medianR60: medianArr(r60s),
      meanDelta: meanArr(deltas),
      medianDelta: medianArr(deltas),
      pDeltaLt0,
    }
  }

  function blockZero(sub) {
    const n = sub.length
    if (n === 0) {
      return {
        n: 0,
        p60Pos: null,
        p60Neg: null,
        meanR60: null,
        medianR60: null,
        meanDelta: null,
        medianDelta: null,
      }
    }
    const p60Pos = (sub.filter((p) => p.r60 > 0).length / n) * 100
    const p60Neg = (sub.filter((p) => p.r60 < 0).length / n) * 100
    const r60s = sub.map((p) => p.r60)
    const deltas = sub.map((p) => p.delta)
    return {
      n,
      p60Pos,
      p60Neg,
      meanR60: meanArr(r60s),
      medianR60: medianArr(r60s),
      meanDelta: meanArr(deltas),
      medianDelta: medianArr(deltas),
    }
  }

  return {
    pairedCount: pairs.length,
    pos: blockPos(pos),
    neg: blockNeg(neg),
    zero: blockZero(zero),
  }
})

const mergeHint = ref('')
const mergeHintType = ref('info')

watch([rawRows30, rawRows60], () => {
  const n30 = rawRows30.value.length
  const n60 = rawRows60.value.length
  if (!n30 && !n60) {
    mergeHint.value = ''
    return
  }
  if (!n30 || !n60) {
    mergeHint.value =
      '請上傳另一個 CSV：須兩個檔案都載入成功後，才會合併並顯示表格（目前不會預覽單檔）。'
    mergeHintType.value = 'warning'
    return
  }
  const m30 = rowsToKeyedMap(rawRows30.value, '_30')
  const m60 = rowsToKeyedMap(rawRows60.value, '_60')
  const keys = new Set([...m30.keys(), ...m60.keys()])
  let only30 = 0
  let only60 = 0
  let both = 0
  for (const k of keys) {
    const a = m30.has(k)
    const b = m60.has(k)
    if (a && b) both += 1
    else if (a) only30 += 1
    else only60 += 1
  }
  mergeHint.value = `已合併：共 ${keys.size} 列（雙檔皆有 ${both} 筆；僅 _30：${only30}；僅 _60：${only60}）。缺側欄位顯示「—」。`
  mergeHintType.value = 'success'
})

async function onFile30(ev) {
  const file = ev.target.files?.[0]
  if (!file) return
  try {
    const data = await parseCSV(file)
    rawRows30.value = data
    fileName30.value = file.name
    ElMessage.success(`已載入 _30：${file.name}（${data.length} 列）`)
  } catch (e) {
    console.error(e)
    ElMessage.error('CSV（_30）解析失敗')
    rawRows30.value = []
    fileName30.value = ''
  }
  ev.target.value = ''
}

async function onFile60(ev) {
  const file = ev.target.files?.[0]
  if (!file) return
  try {
    const data = await parseCSV(file)
    rawRows60.value = data
    fileName60.value = file.name
    ElMessage.success(`已載入 _60：${file.name}（${data.length} 列）`)
  } catch (e) {
    console.error(e)
    ElMessage.error('CSV（_60）解析失敗')
    rawRows60.value = []
    fileName60.value = ''
  }
  ev.target.value = ''
}

function clear30() {
  rawRows30.value = []
  fileName30.value = ''
  if (input30Ref.value) input30Ref.value.value = ''
}

function clear60() {
  rawRows60.value = []
  fileName60.value = ''
  if (input60Ref.value) input60Ref.value.value = ''
}

function formatCell(val) {
  if (val === null || val === undefined || val === '') return '—'
  return String(val).trim() || '—'
}

function formatHoldingDays(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `${Number(n)}`
}

function returnClass(raw) {
  const s = String(raw ?? '').replace(/%/g, '').replace(/,/g, '').trim()
  const n = parseFloat(s)
  if (Number.isNaN(n)) return ''
  if (n > 0) return 'ret-pos'
  if (n < 0) return 'ret-neg'
  return ''
}
</script>

<style scoped>
.stat-analysis {
  padding: 20px;
  max-width: 1600px;
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

.upload-form {
  margin-bottom: 12px;
}

.file-input {
  display: block;
  margin-bottom: 8px;
}

.file-tag {
  margin-right: 8px;
}

.merge-hint {
  margin-bottom: 16px;
}

.side-stats {
  margin-bottom: 16px;
}

.side-stats-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.side-stats-card__title {
  font-weight: 600;
}

.side-stats-card {
  height: 100%;
}

.grouped-stats {
  margin-bottom: 20px;
}

.grouped-stats__head {
  margin-bottom: 12px;
}

.grouped-stats__title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
}

.grouped-card {
  height: 100%;
  margin-bottom: 16px;
}

.grouped-card__title {
  font-weight: 600;
}

.merge-table {
  width: 100%;
}

.desc-label-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.stat-help-icon {
  cursor: help;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  flex-shrink: 0;
}

.stat-help-icon:hover {
  color: var(--el-color-primary);
}

.ret-pos {
  color: #e53935;
  font-weight: 600;
}

.ret-neg {
  color: #43a047;
  font-weight: 600;
}

.policy-sim {
  margin-bottom: 20px;
}

.policy-sim__card {
  border: 1px solid var(--el-border-color-lighter);
}

.policy-sim__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.policy-sim__title {
  font-weight: 600;
}

.policy-sim__rules {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin: 0 0 12px;
}

.policy-sim__form {
  margin-bottom: 8px;
}

.policy-sim__count {
  display: block;
  margin-bottom: 12px;
}

.policy-sim__result {
  margin-top: 12px;
}
</style>
