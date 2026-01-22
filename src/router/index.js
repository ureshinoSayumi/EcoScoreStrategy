import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
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
    // 2倍作多槓桿型ETF，單筆買入 VS SMA200 策略
    {
      path: '/2xETFvsSMA200',
      name: '2xETFvsSMA200',
      component: () => import('@/views/2xETFvsSMA200/index.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
  ],
})

export default router
