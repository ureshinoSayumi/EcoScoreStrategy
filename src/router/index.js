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
    {
      path: '/technicalAnalysis', // 技術分析投資法 單筆買賣
      name: 'technicalAnalysis',
      component: () => import('@/views/TechnicalAnalysis/index.vue'),
    },
    {
      path: '/fetchStock', // 取得股票資料
      name: 'fetchStock',
      component: () => import('@/views/ApiGet/index.vue'),
    },
    // 交易紀錄分析
    {
      path: '/recordAnalysis', // XQ 分析器
      name: 'recordAnalysis',
      component: () => import('@/views/RecordAnalysis/index.vue'),
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
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
  ],
})

export default router
