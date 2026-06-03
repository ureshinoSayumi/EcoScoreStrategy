import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomePage.vue'),
    },
    // 景氣循環投資法（原首頁功能）
    {
      path: '/ecoScore',
      name: 'ecoScore',
      component: () => import('@/views/HomeView.vue'),
    },
    // 技術分析投資法 單筆買賣
    {
      path: '/technicalAnalysis',
      name: 'technicalAnalysis',
      component: () => import('@/views/TechnicalAnalysis/index.vue'),
    },
    // 取得股票資料
    {
      path: '/fetchStock',
      name: 'fetchStock',
      component: () => import('@/views/ApiGet/index.vue'),
    },
    // 批次爬取 FinMind 日線
    {
      path: '/batchCrawl',
      name: 'batchCrawl',
      component: () => import('@/views/BatchCrawl/index.vue'),
    },
    // SMA20 延伸持有分析
    {
      path: '/sma20HoldAnalysis',
      name: 'sma20HoldAnalysis',
      component: () => import('@/views/Sma20HoldAnalysis/index.vue'),
    },
    // XQ 分析器
    {
      path: '/recordAnalysis',
      name: 'recordAnalysis',
      component: () => import('@/views/RecordAnalysis/index.vue'),
    },
    // 最佳化指數
    {
      path: '/optimizedIndex',
      name: 'optimizedIndex',
      component: () => import('@/views/RecordAnalysis/OptimizedIndex.vue'),
    },
    {
      path: '/statAnalysis',
      name: 'statAnalysis',
      component: () => import('@/views/RecordAnalysis/StatAnalysisView.vue'),
    },
    {
      path: '/multiStrategyCsvBacktest',
      name: 'multiStrategyCsvBacktest',
      component: () => import('@/views/RecordAnalysis/MultiStrategyCsvBacktestView.vue'),
    },
    {
      path: '/strategyOverlapCsv',
      name: 'strategyOverlapCsv',
      component: () => import('@/views/RecordAnalysis/StrategyOverlapCsvView.vue'),
    },
    // 2倍作多槓桿型ETF，單筆買入 VS SMA200 策略
    {
      path: '/2xETFvsSMA200',
      name: '2xETFvsSMA200',
      component: () => import('@/views/2xETFvsSMA200/index.vue'),
    },
    // 策略選股比較
    {
      path: '/strategyCompare',
      name: 'strategyCompare',
      component: () => import('@/views/StrategyCompare/index.vue'),
    },
    // 持股紀錄（未來串接證交所 API）
    {
      path: '/holdingsRecord',
      name: 'holdingsRecord',
      component: () => import('@/views/HoldingsRecord/HoldingsRecordView.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
  ],
})

export default router
