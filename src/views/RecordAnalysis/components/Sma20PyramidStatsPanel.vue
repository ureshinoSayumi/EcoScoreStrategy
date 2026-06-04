<template>
  <div>
    <el-descriptions :column="2" border size="small">
      <el-descriptions-item label="平均報酬">{{ stats.averageReturn.toFixed(2) }}%</el-descriptions-item>
      <el-descriptions-item label="成交筆數">{{ stats.tradeCount }}</el-descriptions-item>
      <el-descriptions-item label="平均賺賠比">{{ formatProfitLossRatio(stats.profitLossRatio) }}</el-descriptions-item>
      <el-descriptions-item label="報酬中位數">{{ stats.medianReturn.toFixed(2) }}%</el-descriptions-item>
      <el-descriptions-item label="勝率">{{ stats.winRate.toFixed(2) }}%</el-descriptions-item>
      <el-descriptions-item label="夏普值">{{ stats.sharpeRatio.toFixed(4) }}</el-descriptions-item>
      <el-descriptions-item label="期望值（不含平手）" :span="2">
        {{ stats.expectedReturn.toFixed(2) }}%
      </el-descriptions-item>
      <el-descriptions-item label="加碼筆數" :span="2">
        {{ stats.addonCount }}
      </el-descriptions-item>
    </el-descriptions>

    <el-divider content-position="center">模擬回測詳情</el-divider>

    <el-descriptions :column="1" border size="small" class="detail-desc">
      <el-descriptions-item label="總報酬">{{ stats.totalReturn }}%</el-descriptions-item>
      <el-descriptions-item label="區間最大回撤">{{ stats.maxDrawdownValue }}%</el-descriptions-item>
      <el-descriptions-item label="年度平均報酬">{{ stats.annualReturn }}%</el-descriptions-item>
      <el-descriptions-item label="年度中位數報酬">{{ stats.medianAnnualReturn }}%</el-descriptions-item>
      <el-descriptions-item label="最佳/最差年度">
        {{ stats.bestAnnualReturn }}% / {{ stats.worstAnnualReturn }}%
      </el-descriptions-item>
      <el-descriptions-item label="輪動次數">{{ stats.rotationsNumber }}</el-descriptions-item>
      <el-descriptions-item label="表格數據">年化/平均/中位/勝率/筆數（依買入年）</el-descriptions-item>
    </el-descriptions>

    <div class="year-log">
      <p v-for="item in stats.annualReturnLog" :key="item.year" class="log-item">
        <span class="year">{{ item.year }}</span>
        <span class="val" :class="returnColorClass(item.return)">
          {{ Number(item.return).toFixed(2) }}%
          <small v-if="item.avgReturns != null" class="sub-val">
            / {{ item.avgReturns }}% / {{ item.medianReturns }}% / {{ item.winRates }}% /
            {{ item.counts }}筆
          </small>
        </span>
      </p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  stats: { type: Object, required: true },
})

function formatProfitLossRatio(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '∞'
  return n.toFixed(2)
}

function returnColorClass(val) {
  const n = Number(val)
  if (n > 0) return 'text-up'
  if (n < 0) return 'text-down'
  return 'text-flat'
}
</script>

<style scoped>
.year-log {
  overflow-y: auto;
  max-height: 220px;
  margin-top: 10px;
  padding: 10px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

.log-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.9em;
  margin-bottom: 6px;
  border-bottom: 1px dashed var(--el-border-color-lighter);
  padding-bottom: 2px;
}

.val {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: flex-end;
  text-align: right;
}

.sub-val {
  color: var(--el-text-color-secondary);
  font-size: 0.85em;
  font-weight: normal;
}

.text-up {
  color: #f56c6c;
  font-weight: 600;
}

.text-down {
  color: #67c23a;
  font-weight: 600;
}

.text-flat {
  color: var(--el-text-color-secondary);
}
</style>
