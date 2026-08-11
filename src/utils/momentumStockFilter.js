import { isFourDigitStockCode, normalizeStockCode } from '@/utils/extractStockCodes'

/** 是否為可納入動能選股的 4 碼普通股（排除 ETF、DR） */
export function isMomentumEligibleStock(stockId, stockName = '') {
  const code = normalizeStockCode(stockId)
  if (!isFourDigitStockCode(code)) return false

  const name = String(stockName ?? '').toUpperCase()
  if (/ETF/.test(name)) return false
  if (/\bDR\b/.test(name) || name.includes('-DR') || name.endsWith('DR')) return false

  return true
}

/** 台股 DB volume 為股數；張數 = volume / 1000 */
export function volumeToLots(volume) {
  const v = Number(volume)
  if (!Number.isFinite(v) || v <= 0) return 0
  return v / 1000
}
