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
        以<strong>商品名稱</strong>與<strong>進場時間</strong>相同者合併為一列；左／右檔對應的合併欄位後綴可自訂（預設 <code>_30</code>、<code>_60</code>，亦可改為 <code>_10</code>、<code>_90</code> 等，檔名不必含該字串）。<br />
        <strong>兩個檔案都上傳並解析成功後</strong>才會合併資料並顯示統計與政策模擬（合併明細表目前關閉）。
      </p>

      <el-form label-width="120px" class="upload-form">
        <el-form-item label="左檔合併後綴">
          <el-input
            v-model="mergeSuffixLeft"
            placeholder="_30 或 _10"
            maxlength="16"
            class="suffix-input"
            clearable
          />
          <el-text size="small" type="info" class="suffix-hint">合併表左欄位名稱後綴，可填 _10；只填數字會自動變成 _數字</el-text>
        </el-form-item>
        <el-form-item label="右檔合併後綴">
          <el-input
            v-model="mergeSuffixRight"
            placeholder="_60 或 _90"
            maxlength="16"
            class="suffix-input"
            clearable
          />
          <el-text size="small" type="info" class="suffix-hint">合併表右欄位名稱後綴；須與左檔不同</el-text>
        </el-form-item>
        <el-form-item label="CSV（左檔）">
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
        <el-form-item label="CSV（右檔）">
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
                  <span class="side-stats-card__title">{{ mergeSuffixLeftNorm }}（左檔）統計</span>
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
                  <span class="side-stats-card__title">{{ mergeSuffixRightNorm }}（右檔）統計</span>
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
          <h3 class="grouped-stats__title">依 {{ mergeSuffixLeftNorm }} 報酬正負分組（條件統計）</h3>
          <el-text size="small" type="info">
            僅使用合併表中<strong>兩側報酬均可解析為數字</strong>的列，共
            {{ groupedReturnStats.pairedCount }} 筆。Δ = r<sub>右</sub> − r<sub>左</sub>（右檔 {{ mergeSuffixRightNorm }}、左檔 {{ mergeSuffixLeftNorm }}；與
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
            r<sub>30</sub>&gt;0 的持倉；加碼視為在 30 天價位投入，60 天出場時以 sellPrice<sub>60</sub>/sellPrice<sub>30</sub> 比例一併了結（缺價時以報酬率換算）。60
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
            <p class="policy-sim__annual-hint">
              模擬回測詳情（下表：淨值年度報酬／持池依進場年之 r60 平均／中位／勝率／筆數；開啟 Console 時間軸時會同步輸出摘要與表格）
            </p>
            <el-table
              v-if="policySimResult.annualDetailTable?.length"
              :data="policySimResult.annualDetailTable"
              border
              stripe
              size="small"
              class="policy-sim__annual-table"
              max-height="320"
            >
              <el-table-column prop="year" label="年度" width="72" align="center" />
              <el-table-column label="淨值年度報酬" min-width="120" align="right">
                <template #default="{ row }">{{ fmtPolicyPct(row.portfolioYearReturnPct) }}</template>
              </el-table-column>
              <el-table-column :label="`平均（持池 ${mergeSuffixRightNorm}）`" min-width="120" align="right">
                <template #default="{ row }">{{ fmtPolicyPct(row.poolAvgReturnPct) }}</template>
              </el-table-column>
              <el-table-column :label="`中位（持池 ${mergeSuffixRightNorm}）`" min-width="120" align="right">
                <template #default="{ row }">{{ fmtPolicyPct(row.poolMedianReturnPct) }}</template>
              </el-table-column>
              <el-table-column :label="`勝率（持池 ${mergeSuffixRightNorm}）`" min-width="120" align="right">
                <template #default="{ row }">{{ fmtPolicyPct(row.poolWinRatePct) }}</template>
              </el-table-column>
              <el-table-column prop="poolTradeCount" label="筆數" width="72" align="right" />
            </el-table>
            <div v-if="policySimResult.history?.length" class="policy-sim__charts">
              <div class="policy-sim__chart-wrapper">
                <h4 class="policy-sim__chart-title">資金 / 持倉成本 / 總資產走勢（政策模擬）</h4>
                <div ref="policyChartAssetRef" class="policy-sim__chart"></div>
              </div>
              <div class="policy-sim__chart-wrapper">
                <h4 class="policy-sim__chart-title">持池 {{ mergeSuffixRightNorm }} 報酬率分佈</h4>
                <div ref="policyChartReturnRef" class="policy-sim__chart"></div>
              </div>
            </div>
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
          <el-table-column :prop="`code${mergeSuffixLeftNorm}`" :label="mergeSuffixLeftNorm" width="88" show-overflow-tooltip />
          <el-table-column :prop="`code${mergeSuffixRightNorm}`" :label="mergeSuffixRightNorm" width="88" show-overflow-tooltip />
        </el-table-column>
        <el-table-column prop="buyDay" label="進場時間" width="118" />
        <el-table-column label="進場價格" align="right">
          <el-table-column :label="mergeSuffixLeftNorm" width="100" align="right">
            <template #default="{ row }">{{ formatCell(row[`buyPrice${mergeSuffixLeftNorm}`]) }}</template>
          </el-table-column>
          <el-table-column :label="mergeSuffixRightNorm" width="100" align="right">
            <template #default="{ row }">{{ formatCell(row[`buyPrice${mergeSuffixRightNorm}`]) }}</template>
          </el-table-column>
        </el-table-column>
        <el-table-column label="出場時間" align="center">
          <el-table-column :prop="`sellDay${mergeSuffixLeftNorm}`" :label="mergeSuffixLeftNorm" width="118" show-overflow-tooltip />
          <el-table-column :prop="`sellDay${mergeSuffixRightNorm}`" :label="mergeSuffixRightNorm" width="118" show-overflow-tooltip />
        </el-table-column>
        <el-table-column label="出場價格" align="right">
          <el-table-column :label="mergeSuffixLeftNorm" width="100" align="right">
            <template #default="{ row }">{{ formatCell(row[`sellPrice${mergeSuffixLeftNorm}`]) }}</template>
          </el-table-column>
          <el-table-column :label="mergeSuffixRightNorm" width="100" align="right">
            <template #default="{ row }">{{ formatCell(row[`sellPrice${mergeSuffixRightNorm}`]) }}</template>
          </el-table-column>
        </el-table-column>
        <el-table-column label="持有區間（日）" align="right">
          <el-table-column :label="mergeSuffixLeftNorm" width="100" align="right">
            <template #default="{ row }">{{ formatHoldingDays(row[`holdingDays${mergeSuffixLeftNorm}`]) }}</template>
          </el-table-column>
          <el-table-column :label="mergeSuffixRightNorm" width="100" align="right">
            <template #default="{ row }">{{ formatHoldingDays(row[`holdingDays${mergeSuffixRightNorm}`]) }}</template>
          </el-table-column>
        </el-table-column>
        <el-table-column label="報酬率" align="right">
          <el-table-column :label="mergeSuffixLeftNorm" min-width="100" align="right">
            <template #default="{ row }">
              <span :class="returnClass(row[`return${mergeSuffixLeftNorm}`])">{{ formatCell(row[`return${mergeSuffixLeftNorm}`]) }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="mergeSuffixRightNorm" min-width="100" align="right">
            <template #default="{ row }">
              <span :class="returnClass(row[`return${mergeSuffixRightNorm}`])">{{ formatCell(row[`return${mergeSuffixRightNorm}`]) }}</span>
            </template>
          </el-table-column>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { QuestionFilled } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
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

/** 左／右檔合併欄位後綴（如 _30、_10；檔名不必含此字串） */
const mergeSuffixLeft = ref('_30')
const mergeSuffixRight = ref('_60')

/** 正規化後綴：一律 _開頭；空則用預設 */
function normalizeMergeSuffixInput(raw, fallback) {
  let t = String(raw ?? '').trim().replace(/\s/g, '')
  if (!t) return fallback
  if (!t.startsWith('_')) t = `_${t.replace(/^_+/, '')}`
  return t || fallback
}

const mergeSuffixLeftNorm = computed(() => normalizeMergeSuffixInput(mergeSuffixLeft.value, '_30'))
const mergeSuffixRightNorm = computed(() => normalizeMergeSuffixInput(mergeSuffixRight.value, '_60'))

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

  const sa = mergeSuffixLeftNorm.value
  const sb = mergeSuffixRightNorm.value
  if (sa === sb) return []

  const mL = rowsToKeyedMap(rawRows30.value, sa)
  const mR = rowsToKeyedMap(rawRows60.value, sb)
  const keys = [...new Set([...mL.keys(), ...mR.keys()])]

  const emptySuffix = (suffix) => ({
    [`code${suffix}`]: '—',
    [`buyPrice${suffix}`]: null,
    [`sellDay${suffix}`]: '—',
    [`sellPrice${suffix}`]: null,
    [`return${suffix}`]: null,
    [`holdingDays${suffix}`]: null,
  })

  const list = keys.map((k) => {
    const a = mL.get(k)
    const b = mR.get(k)
    const base = {
      productName: a?.productName || b?.productName || '',
      buyDay: a?.buyDay || b?.buyDay || '',
    }
    const partL = a || { ...base, ...emptySuffix(sa) }
    const partR = b || { ...base, ...emptySuffix(sb) }
    return {
      ...base,
      [`code${sa}`]: partL[`code${sa}`],
      [`code${sb}`]: partR[`code${sb}`],
      [`buyPrice${sa}`]: partL[`buyPrice${sa}`],
      [`buyPrice${sb}`]: partR[`buyPrice${sb}`],
      [`sellDay${sa}`]: partL[`sellDay${sa}`],
      [`sellDay${sb}`]: partR[`sellDay${sb}`],
      [`sellPrice${sa}`]: partL[`sellPrice${sa}`],
      [`sellPrice${sb}`]: partR[`sellPrice${sb}`],
      [`holdingDays${sa}`]: partL[`holdingDays${sa}`],
      [`holdingDays${sb}`]: partR[`holdingDays${sb}`],
      [`return${sa}`]: partL[`return${sa}`],
      [`return${sb}`]: partR[`return${sb}`],
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

/** 政策模擬用持池：左檔＝短天期邏輯（r30／sellDay30…）、右檔＝長天期；雙邊出場日與報酬須有效 */
const policyTradeRows = computed(() => {
  const out = []
  const sa = mergeSuffixLeftNorm.value
  const sb = mergeSuffixRightNorm.value
  if (sa === sb) return out
  for (const row of mergedRows.value) {
    const sellL = row[`sellDay${sa}`]
    const sellR = row[`sellDay${sb}`]
    if (!sellDayValid(sellL) || !sellDayValid(sellR)) continue
    const r30 = parseReturnNum(row[`return${sa}`])
    const r60 = parseReturnNum(row[`return${sb}`])
    if (r30 == null || r60 == null) continue
    const buyPrice30 = parseFloat(String(row[`buyPrice${sa}`] ?? '').replace(/,/g, ''))
    const sellPrice30 = parseFloat(String(row[`sellPrice${sa}`] ?? '').replace(/,/g, ''))
    const sellPrice60 = parseFloat(String(row[`sellPrice${sb}`] ?? '').replace(/,/g, ''))
    out.push({
      name: row.productName,
      code: row[`code${sa}`] || row[`code${sb}`] || '',
      buyDay: row.buyDay,
      sellDay30: sellL,
      sellDay60: sellR,
      r30,
      r60,
      buyPrice30: Number.isFinite(buyPrice30) ? buyPrice30 : NaN,
      sellPrice30: Number.isFinite(sellPrice30) ? sellPrice30 : NaN,
      sellPrice60: Number.isFinite(sellPrice60) ? sellPrice60 : NaN,
    })
  }
  return out
})

const policyInitialCapital = ref(10000)
const policyMaxPositions = ref(10)
const policyIsRepeat = ref(false)
const policyDayBuyRepeat = ref(true)
const policyConsoleTrace = ref(true)
const policySimResult = ref(null)

const policyChartAssetRef = ref(null)
const policyChartReturnRef = ref(null)

function disposePolicyCharts() {
  const a = policyChartAssetRef.value
  const b = policyChartReturnRef.value
  if (a) {
    const inst = echarts.getInstanceByDom(a)
    if (inst) inst.dispose()
  }
  if (b) {
    const inst = echarts.getInstanceByDom(b)
    if (inst) inst.dispose()
  }
}

function resizePolicyCharts() {
  const a = policyChartAssetRef.value && echarts.getInstanceByDom(policyChartAssetRef.value)
  const b = policyChartReturnRef.value && echarts.getInstanceByDom(policyChartReturnRef.value)
  a?.resize()
  b?.resize()
}

/** 與 OptimizedIndex buildChart6 概念一致：現金、持倉成本（淨值−現金）、總資產 */
function buildPolicyAssetChart(history) {
  const el = policyChartAssetRef.value
  if (!el || el.clientWidth === 0 || !history?.length) return
  let chart = echarts.getInstanceByDom(el)
  if (!chart) chart = echarts.init(el)
  const dates = history.map((h) => h.date)
  const capital = history.map((h) => parseFloat(h.capital))
  const netAsset = history.map((h) => parseFloat(h.netAsset))
  const positionCost = history.map((h) => {
    const n = parseFloat(h.netAsset)
    const c = parseFloat(h.capital)
    return Number.isFinite(n) && Number.isFinite(c) ? n - c : 0
  })
  chart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter(params) {
        const i = params[0].dataIndex
        const d = history[i]
        return `日期：${d.date}<br/>現金：$${Number(d.capital).toFixed(2)}<br/>持倉成本：$${positionCost[i].toFixed(2)}<br/>總資產：$${Number(d.netAsset).toFixed(2)}<br/>累積報酬率：${Number(d.returnRate).toFixed(2)}%`
      },
    },
    legend: { data: ['現金', '持倉成本', '總資產'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: dates, axisLabel: { rotate: 45 } },
    yAxis: { type: 'value', name: '金額（元）' },
    series: [
      { name: '現金', type: 'line', data: capital },
      { name: '持倉成本', type: 'line', data: positionCost },
      { name: '總資產', type: 'line', data: netAsset },
    ],
  })
}

/** 與 OptimizedIndex buildChart 相同：5% 一組的 r60 直方圖（小數轉％） */
function buildPolicyReturnDistChart(tradeRows) {
  const el = policyChartReturnRef.value
  if (!el || el.clientWidth === 0) return
  let chart = echarts.getInstanceByDom(el)
  if (!chart) chart = echarts.init(el)
  const returns = tradeRows
    .map((t) => t.r60)
    .filter((r) => typeof r === 'number' && Number.isFinite(r))
    .map((r) => r * 100)
  if (!returns.length) {
    chart.setOption({
      title: {
        text: '無有效 r60',
        left: 'center',
        top: 'middle',
        textStyle: { color: 'var(--el-text-color-secondary)', fontSize: 14 },
      },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value' },
      series: [{ type: 'bar', data: [] }],
    })
    return
  }
  const binWidth = 5
  const min = Math.floor(Math.min(...returns) / binWidth) * binWidth
  const max = Math.ceil(Math.max(...returns) / binWidth) * binWidth
  const labels = []
  const bins = []
  for (let i = min; i < max; i += binWidth) {
    const from = i
    const to = i + binWidth
    labels.push(`${from}~${to}%`)
    bins.push(returns.filter((r) => r >= from && r < to).length)
  }
  chart.setOption({
    title: { text: '' },
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
    xAxis: { type: 'category', name: '報酬區間', data: labels, axisLabel: { rotate: 45 } },
    yAxis: { type: 'value', name: '筆數' },
    series: [{ type: 'bar', name: '出現次數', data: bins }],
  })
}

watch(policySimResult, async (res) => {
  await nextTick()
  if (!res?.history?.length) {
    disposePolicyCharts()
    return
  }
  buildPolicyAssetChart(res.history)
  buildPolicyReturnDistChart(policyTradeRows.value)
  await nextTick()
  resizePolicyCharts()
})

onMounted(() => {
  window.addEventListener('resize', resizePolicyCharts)
})
onUnmounted(() => {
  window.removeEventListener('resize', resizePolicyCharts)
  disposePolicyCharts()
})

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

/** 政策模擬年度表：數值已為「％數字」（如 4.28 代表 4.28%） */
function fmtPolicyPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return `${Number(v).toFixed(2)}%`
}

/**
 * 合併表雙邊皆可解析報酬時，依 r30 正 / 負 / 零 分組的條件統計
 */
const groupedReturnStats = computed(() => {
  if (!bothFilesReady.value) return null
  const sa = mergeSuffixLeftNorm.value
  const sb = mergeSuffixRightNorm.value
  if (sa === sb) return null
  const pairs = []
  for (const row of mergedRows.value) {
    const r30 = parseReturnNum(row[`return${sa}`])
    const r60 = parseReturnNum(row[`return${sb}`])
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

watch([rawRows30, rawRows60, mergeSuffixLeftNorm, mergeSuffixRightNorm], () => {
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
  const sa = mergeSuffixLeftNorm.value
  const sb = mergeSuffixRightNorm.value
  if (sa === sb) {
    mergeHint.value = `左、右合併後綴不可相同（目前皆為 ${sa}），請修改後綴再檢視合併結果。`
    mergeHintType.value = 'error'
    return
  }
  const mL = rowsToKeyedMap(rawRows30.value, sa)
  const mR = rowsToKeyedMap(rawRows60.value, sb)
  const keys = new Set([...mL.keys(), ...mR.keys()])
  let onlyL = 0
  let onlyR = 0
  let both = 0
  for (const k of keys) {
    const a = mL.has(k)
    const b = mR.has(k)
    if (a && b) both += 1
    else if (a) onlyL += 1
    else onlyR += 1
  }
  mergeHint.value = `已合併：共 ${keys.size} 列（雙檔皆有 ${both} 筆；僅左檔（${sa}）：${onlyL}；僅右檔（${sb}）：${onlyR}）。缺側欄位顯示「—」。`
  mergeHintType.value = 'success'
})

async function onFile30(ev) {
  const file = ev.target.files?.[0]
  if (!file) return
  try {
    const data = await parseCSV(file)
    rawRows30.value = data
    fileName30.value = file.name
    ElMessage.success(`已載入左檔：${file.name}（${data.length} 列）`)
  } catch (e) {
    console.error(e)
    ElMessage.error('CSV（左檔）解析失敗')
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
    ElMessage.success(`已載入右檔：${file.name}（${data.length} 列）`)
  } catch (e) {
    console.error(e)
    ElMessage.error('CSV（右檔）解析失敗')
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

.suffix-input {
  max-width: 160px;
}

.suffix-hint {
  display: block;
  margin-top: 6px;
  line-height: 1.4;
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

.policy-sim__annual-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  margin: 12px 0 8px;
}

.policy-sim__annual-table {
  width: 100%;
}

.policy-sim__charts {
  margin-top: 20px;
}

.policy-sim__chart-wrapper {
  margin-bottom: 24px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.policy-sim__chart-title {
  margin: 0 0 12px;
  padding-left: 10px;
  border-left: 4px solid var(--el-color-primary);
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.policy-sim__chart {
  width: 100%;
  height: 420px;
}
</style>
