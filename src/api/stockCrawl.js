import axios from 'axios'

const stockService = axios.create({
  baseURL:
    import.meta.env.VITE_API_HOST ||
    import.meta.env.VITE_STOCK_SERVICE_URL ||
    'http://localhost:3005',
  timeout: 120 * 1000,
  headers: { 'Content-Type': 'application/json' },
})

export const crawlFinmindStockDaily = (payload) =>
  stockService.post('/api/crawl/finmind/stock-daily', payload)
