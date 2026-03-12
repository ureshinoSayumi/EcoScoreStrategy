<template>
  <div class="home-page">
    <div class="header">
      <h1>景氣循環投資法</h1>
      <p class="subtitle">選擇功能進入</p>
    </div>

    <el-row :gutter="20" class="route-list">
      <el-col
        v-for="item in routeItems"
        :key="item.path"
        :xs="24"
        :sm="12"
        :md="8"
        :lg="6"
      >
        <RouterLink :to="item.path" class="route-link">
          <el-card shadow="hover" class="route-card">
            <div class="route-content">
              <span class="route-title">{{ item.title }}</span>
              <span class="route-path">{{ item.path }}</span>
            </div>
            <el-icon class="arrow-icon"><ArrowRight /></el-icon>
          </el-card>
        </RouterLink>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight } from '@element-plus/icons-vue'

const router = useRouter()

const routeItems = computed(() => {
  const routes = router.getRoutes()
  const titleMap = {
    home: '首頁',
    ecoScore: '景氣循環投資法',
    technicalAnalysis: '技術分析投資法',
    fetchStock: '取得股票資料',
    recordAnalysis: 'XQ 分析器',
    optimizedIndex: 'XQ 分析器 重製版',
    '2xETFvsSMA200': '2倍ETF vs SMA200',
    strategyCompare: '策略選股比較',
    about: '關於',
  }
  return routes
    .filter((r) => r.path !== '*' && !r.path.includes(':'))
    .map((r) => ({
      path: r.path,
      name: r.name,
      title: titleMap[r.name] ?? r.name ?? r.path,
    }))
})
</script>

<style scoped>
.home-page {
  padding: 40px 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  text-align: center;
  margin-bottom: 40px;
}

.header h1 {
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.subtitle {
  color: #909399;
  font-size: 1rem;
}

.route-list {
  margin-top: 24px;
}

.route-link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.route-card {
  cursor: pointer;
  transition: transform 0.2s;
  margin-bottom: 20px;
}

.route-card:hover {
  transform: translateY(-2px);
}

.route-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.route-title {
  font-weight: 500;
  font-size: 1rem;
}

.route-path {
  font-size: 0.85rem;
  color: #909399;
}

.arrow-icon {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #c0c4cc;
}

.route-card {
  position: relative;
  padding-right: 40px;
}
</style>
