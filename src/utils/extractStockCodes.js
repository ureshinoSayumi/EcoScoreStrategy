import { parseCSV, parseStrategyCSV } from '@/utils/csvReader'

/** 去掉 .TW 等後綴，只留商品代碼 */
export function normalizeStockCode(raw) {
  if (raw == null || raw === '') return ''
  return String(raw).trim().replace(/\.TW$/i, '')
}

function getCell(row, ...keys) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') {
      return String(row[key]).trim()
    }
    const found = Object.keys(row).find((k) => k.trim() === key)
    if (found && row[found] != null && String(row[found]).trim() !== '') {
      return String(row[found]).trim()
    }
  }
  return ''
}

function isValidCode(code) {
  return /^\d{4,6}$/.test(code)
}

function addStock(map, code, name) {
  const normalized = normalizeStockCode(code)
  if (!isValidCode(normalized)) return
  if (!map.has(normalized)) {
    map.set(normalized, { code: normalized, name: name || '' })
  } else if (name && !map.get(normalized).name) {
    map.get(normalized).name = name
  }
}

function extractFromRows(rows) {
  const map = new Map()
  for (const row of rows) {
    const code = getCell(row, '商品代碼', '代碼', 'code', 'stock_id')
    const name = getCell(row, '商品名稱', '商品', 'name', 'stock_name')
    addStock(map, code, name)
  }
  return map
}

/**
 * 從 CSV 檔解析出唯一股票清單（支援 XQ 回測格式與策略選股格式）
 */
export async function extractStocksFromCsvFile(file) {
  const map = new Map()

  try {
    const rows = await parseCSV(file)
    extractFromRows(rows).forEach((v, k) => map.set(k, v))
  } catch {
    // parseCSV 失敗時改試策略格式
  }

  if (map.size === 0) {
    try {
      const strategyRows = await parseStrategyCSV(file)
      for (const row of strategyRows) {
        addStock(map, row.code, row.product)
      }
    } catch (err) {
      if (map.size === 0) throw err
    }
  }

  if (map.size === 0) {
    throw new Error('找不到商品代碼欄位（支援：商品代碼、代碼）')
  }

  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code, 'zh-Hant'))
}
