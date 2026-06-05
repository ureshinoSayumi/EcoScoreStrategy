import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomePage.vue'),
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
    // 股票日線走勢圖（K 線 + SMA20）
    {
      path: '/stockPriceChart',
      name: 'stockPriceChart',
      component: () => import('@/views/StockPriceChart/index.vue'),
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
      path: '/sma20PyramidBacktest',
      name: 'sma20PyramidBacktest',
      component: () => import('@/views/RecordAnalysis/Sma20PyramidBacktestView.vue'),
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
