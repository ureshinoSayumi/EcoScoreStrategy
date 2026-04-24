import { instance } from '@/utils/request.js'

export const getDataframes = (params) =>
  instance({
    url: '/api/dataframes',
    method: 'GET',
    params,
  })

export const get1999FromNews = (params) =>
  instance({
    url: '/api/get_1999_from_news',
    method: 'GET',
    params,
  })

export const getStock = (params) =>
  instance({
    url: '/api/STOCK_DAY',
    method: 'GET',
    params,
  })

// https://openapi.twse.com.tw
/** 上市個股收盤價及月平均價（全市場，STOCK_DAY_AVG_ALL）— 開發時走 Vite /twse-openapi proxy */
export const getTwseStockDayAvgAll = () =>
  instance({
    url: '/twse-openapi/v1/exchangeReport/STOCK_DAY_AVG_ALL',
    method: 'GET',
  })

// https://www.tpex.org.tw/openapi
/** 上櫃一般板行情（tpex_mainboard_quotes）— 開發時走 Vite /tpex-openapi proxy */
export const getTpexMainboardQuotes = () =>
  instance({
    url: '/tpex-openapi/openapi/v1/tpex_mainboard_quotes',
    method: 'GET',
  })
