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
