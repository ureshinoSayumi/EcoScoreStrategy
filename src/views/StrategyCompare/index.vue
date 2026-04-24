<template>
  <div class="strategy-compare-container">
    <el-card shadow="hover" class="upload-card">
      <template #header>
        <div class="card-header">
          <span>策略選股比較</span>
        </div>
      </template>
      <el-form-item label="上傳 CSV 檔案">
        <input
          type="file"
          accept=".csv"
          multiple
          @change="handleFile"
          class="file-input"
        />
      </el-form-item>
      <el-form-item label="已選檔案">
        <el-tag
          v-for="name in fileNames"
          :key="name"
          class="mx-1"
          closable
          @close="removeFile(name)"
        >
          {{ name }}
        </el-tag>
        <span v-if="fileNames.length === 0" class="text-gray">未選擇檔案</span>
      </el-form-item>
    </el-card>

    <div v-if="strategyList.length > 0" class="results-section">
      <!-- 單一策略或多策略：每個策略一個 card -->
      <el-row :gutter="20">
        <el-col
          v-for="strategy in strategyList"
          :key="strategy.fileName"
          :xs="24"
          :sm="24"
          :md="12"
          :lg="8"
        >
          <el-card shadow="hover" class="strategy-card">
            <template #header>
              <div class="card-header">
                <span class="card-title">{{ strategy.fileName }}</span>
              </div>
            </template>
            <div class="stock-list">
              <div
                v-for="(item, sIdx) in strategy.stocks"
                :key="`${item.code}-${sIdx}`"
                class="stock-item"
              >
                <div class="stock-row stock-row-main">
                  <el-tag size="small" type="info">{{ item.code }}</el-tag>
                  <span class="product-name">{{ item.product }}</span>
                </div>
                <div class="stock-meta">
                  <span v-if="item.totalVolume">總量：{{ item.totalVolume }}</span>
                  <span v-if="item.industry">產業：{{ item.industry }}</span>
                  <span v-if="item.subIndustry">細產業：{{ item.subIndustry }}</span>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
        <!-- 多策略時：顯示被兩個以上策略選到的股票 -->
        <el-col
          v-if="strategyList.length >= 2 && overlapList.length > 0"
          :xs="24"
          :sm="24"
          :md="24"
          :lg="24"
        >
          <el-card shadow="hover" class="overlap-card">
            <template #header>
              <div class="card-header">
                <span class="card-title">被兩個以上策略選到的股票</span>
              </div>
            </template>
            <div class="overlap-list">
              <div
                v-for="item in overlapList"
                :key="item.code"
                class="overlap-item"
              >
                <div class="overlap-header">
                  <el-tag size="small" type="success">{{ item.code }}</el-tag>
                  <span class="product-name">{{ item.product }}</span>
                </div>
                <div class="overlap-meta">
                  <span v-if="item.totalVolume">總量：{{ item.totalVolume }}</span>
                  <span v-if="item.industry">產業：{{ item.industry }}</span>
                  <span v-if="item.subIndustry">細產業：{{ item.subIndustry }}</span>
                </div>
                <div class="strategy-tags">
                  <el-tag
                    v-for="name in item.strategies"
                    :key="name"
                    size="small"
                    type="warning"
                  >
                    {{ name }}
                  </el-tag>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { parseStrategyCSV } from '@/utils/csvReader'
import { ElMessage } from 'element-plus'

const fileNames = ref([])
const strategyList = ref([])

const handleFile = async (event) => {
  const files = event.target.files
  if (!files || files.length === 0) return

  fileNames.value = []
  strategyList.value = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      const stocks = await parseStrategyCSV(file)
      strategyList.value.push({
        fileName: file.name,
        stocks,
      })
      fileNames.value.push(file.name)
    } catch (err) {
      ElMessage.error(`解析 ${file.name} 失敗：${err.message}`)
    }
  }

  event.target.value = ''
}

const removeFile = (name) => {
  const idx = fileNames.value.indexOf(name)
  if (idx !== -1) {
    fileNames.value.splice(idx, 1)
    strategyList.value.splice(idx, 1)
  }
}

/** 被兩個以上策略選到的股票，並顯示被哪些策略選到 */
const overlapList = computed(() => {
  if (strategyList.value.length < 2) return []

  const codeToStrategies = new Map()

  for (const s of strategyList.value) {
    for (const row of s.stocks) {
      const { code, product, totalVolume, industry, subIndustry } = row
      const key = code
      if (!codeToStrategies.has(key)) {
        codeToStrategies.set(key, {
          code,
          product,
          totalVolume: totalVolume || '',
          industry: industry || '',
          subIndustry: subIndustry || '',
          strategies: [],
        })
      } else {
        const e = codeToStrategies.get(key)
        if (!e.totalVolume && totalVolume) e.totalVolume = totalVolume
        if (!e.industry && industry) e.industry = industry
        if (!e.subIndustry && subIndustry) e.subIndustry = subIndustry
      }
      const entry = codeToStrategies.get(key)
      if (!entry.strategies.includes(s.fileName)) {
        entry.strategies.push(s.fileName)
      }
    }
  }

  return [...codeToStrategies.values()].filter(
    (item) => item.strategies.length >= 2
  )
})
</script>

<style scoped>
.strategy-compare-container {
  padding: 20px;
  max-width: 1400px;

  margin: 0 auto;
}

.upload-card {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-weight: 600;
  font-size: 1rem;
}

.file-input {
  margin-left: 8px;
}

.text-gray {
  color: #909399;
  font-size: 14px;
}

.strategy-card,
.overlap-card {
  margin-bottom: 20px;
}

.stock-list,
.overlap-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.stock-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 10px;
  background: #f5f7fa;
  border-radius: 6px;
  min-width: 200px;
}

.stock-row-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stock-meta,
.overlap-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 12px;
  color: #606266;
}

.product-name {
  font-size: 14px;
}

.overlap-item {
  padding: 12px;
  background: #f0f9ff;
  border-radius: 8px;
  margin-bottom: 8px;
}

.overlap-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.strategy-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: 0;
}
</style>
