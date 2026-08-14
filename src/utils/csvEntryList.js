import { parseCSV } from '@/utils/csvReader'
import { normalizeStockCode } from '@/utils/extractStockCodes'

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

/** 2026/6/2、2026/06/02、2026-06-02 → YYYY-MM-DD */
export function normalizeCsvEntryDate(raw) {
  if (raw == null) return ''
  const s = String(raw).trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/)
  if (!m) return ''
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

/**
 * 解析量化選股 CSV → 依進場日分組的代號清單（去重、保留出現順序）
 * 優先用「商品代碼」（如 2030.TW），不用 CSV 內建出場價／報酬
 *
 * @returns {{
 *   picksByDate: Map<string, { stockId: string, stockName: string }[]>,
 *   universe: Map<string, string>,
 *   dateRange: { min: string, max: string } | null,
 *   rowCount: number,
 * }}
 */
export async function parseQuantEntryListCsv(file) {
  const rows = await parseCSV(file)
  /** @type {Map<string, { stockId: string, stockName: string }[]>} */
  const picksByDate = new Map()
  /** @type {Map<string, string>} */
  const universe = new Map()
  let rowCount = 0

  for (const row of rows) {
    const rawCode = getCell(row, '商品代碼', '代碼', 'code', 'stock_id')
    const stockId = normalizeStockCode(rawCode)
    if (!/^\d{4,6}$/.test(stockId)) continue

    const entryDate = normalizeCsvEntryDate(
      getCell(row, '進場時間', '進場日', 'entry_date', 'date')
    )
    if (!entryDate) continue

    const stockName = getCell(row, '商品名稱', '商品', 'name', 'stock_name') || stockId
    rowCount += 1
    if (!universe.has(stockId)) universe.set(stockId, stockName)

    let list = picksByDate.get(entryDate)
    if (!list) {
      list = []
      picksByDate.set(entryDate, list)
    }
    if (!list.some((p) => p.stockId === stockId)) {
      list.push({ stockId, stockName })
    }
  }

  if (!picksByDate.size) {
    throw new Error('CSV 無法解析：需要「進場時間」與「商品代碼」（如 2030.TW）')
  }

  const dates = [...picksByDate.keys()].sort()
  return {
    picksByDate,
    universe,
    dateRange: { min: dates[0], max: dates[dates.length - 1] },
    rowCount,
  }
}
