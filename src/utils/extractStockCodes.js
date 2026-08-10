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

/** 是否為 4 碼上市櫃股票代號 */
export function isFourDigitStockCode(code) {
  return /^\d{4}$/.test(normalizeStockCode(code))
}

/**
 * 解析台股總覽 CSV（產業別、股票代碼、股票名稱、市場別、更新日期）
 * 僅保留股票代碼為 4 碼的列
 * @returns {Promise<{ stocks: object[], totalRows: number, filteredOut: number }>}
 */
export async function parseTaiwanStockOverviewCsv(file) {
  const rows = await parseCSV(file)
  const map = new Map()
  let filteredOut = 0

  for (const row of rows) {
    const rawCode = getCell(row, '股票代碼', '商品代碼', '代碼', 'code', 'stock_id')
    const code = rawCode ? normalizeStockCode(rawCode) : ''
    if (!code || !isFourDigitStockCode(code)) {
      filteredOut += 1
      continue
    }
    const industry = getCell(row, '產業別', '產業', 'industry')
    const name = getCell(row, '股票名稱', '商品名稱', '商品', 'name', 'stock_name')
    const marketRaw = getCell(row, '市場別', '市場', 'market')
    const market = marketRaw ? marketRaw.toUpperCase() : ''

    if (!map.has(code)) {
      map.set(code, { code, name, industry, market })
    } else {
      const existing = map.get(code)
      if (!existing.name && name) existing.name = name
      if (!existing.industry && industry) existing.industry = industry
      if (!existing.market && market) existing.market = market
    }
  }

  if (map.size === 0) {
    throw new Error('找不到 4 碼股票代碼（請確認 CSV 含「股票代碼」欄位）')
  }

  const stocks = [...map.values()].sort((a, b) =>
    a.code.localeCompare(b.code, 'zh-Hant')
  )

  return {
    stocks,
    totalRows: rows.length,
    filteredOut,
  }
}
