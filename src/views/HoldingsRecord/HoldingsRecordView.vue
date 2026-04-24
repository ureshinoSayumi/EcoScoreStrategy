<template>
  <div class="holdings-record">
    <el-card shadow="hover" class="page-card">
      <template #header>
        <div class="card-header">
          <span>持股紀錄</span>
          <div class="header-actions">
            <el-text type="info" size="small">未來可串接證交所 API 更新股價與市值</el-text>
            <el-button size="small" :loading="twseLoading" @click="refreshTwseFromApi">
              更新上市行情
            </el-button>
            <el-button size="small" type="primary" :loading="tpexLoading" @click="refreshTpexFromApi">
              更新上櫃行情
            </el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeStrategyTab" type="border-card" class="strategy-tabs">
        <el-tab-pane
          v-for="tab in strategyTabs"
          :key="tab.name"
          :label="tab.label"
          :name="tab.name"
        />
      </el-tabs>

      <div
        v-if="holdingsWithQuotesForTab.length"
        class="tab-stats"
        role="region"
        aria-label="目前策略統計"
      >
        <div class="tab-stats__grid">
          <div class="tab-stats__cell">
            <div class="tab-stats__label">總損益（元）</div>
            <div :class="['tab-stats__value', pnlPercentClass(activeTabStats.totalDollarPnl)]">
              {{ formatSignedNtDollar(activeTabStats.totalDollarPnl) }}
            </div>
          </div>
          <div class="tab-stats__cell">
            <div class="tab-stats__label">平均損益率</div>
            <div :class="['tab-stats__value', pnlPercentClass(activeTabStats.avgPnlPercent)]">
              {{ formatPnlPercent(activeTabStats.avgPnlPercent) }}
            </div>
          </div>
          <div class="tab-stats__cell">
            <div class="tab-stats__label">勝率</div>
            <div class="tab-stats__value tab-stats__value--muted">
              {{ formatWinRate(activeTabStats.winRate) }}
            </div>
          </div>
          <div class="tab-stats__cell">
            <div class="tab-stats__label">損益率中位數</div>
            <div :class="['tab-stats__value', pnlPercentClass(activeTabStats.medianPnlPercent)]">
              {{ formatPnlPercent(activeTabStats.medianPnlPercent) }}
            </div>
          </div>
        </div>
        <el-text
          v-if="
            activeTabStats.samplePct < holdingsWithQuotesForTab.length &&
            activeTabStats.samplePct > 0
          "
          type="info"
          size="small"
          class="tab-stats-note"
        >
          總損益與損益率相關統計僅含已取得行情之 {{ activeTabStats.samplePct }} 筆（共
          {{ holdingsWithQuotesForTab.length }} 筆持股）
        </el-text>
        <el-text
          v-else-if="activeTabStats.samplePct === 0 && holdingsWithQuotesForTab.length"
          type="warning"
          size="small"
          class="tab-stats-note"
        >
          尚未取得行情，無法計算總損益、損益率／勝率／中位數；請更新上市／上櫃行情。
        </el-text>
      </div>

      <el-table
        :data="holdingsWithQuotesForTab"
        border
        stripe
        style="width: 100%"
        class="strategy-table"
        empty-text="尚無持股資料"
      >
        <el-table-column
          prop="buyDate"
          label="買入日期"
          width="110"
          sortable
          :sort-method="sortSlashYmdKey('buyDate')"
        />
        <el-table-column
          prop="sellDate"
          label="賣出日期"
          width="110"
          sortable
          :sort-method="sortSlashYmdKey('sellDate')"
        />
        <el-table-column
          prop="symbol"
          label="標的"
          min-width="100"
          show-overflow-tooltip
          sortable
          :sort-method="sortLocaleStr('symbol')"
        />
        <el-table-column
          prop="signalPrice"
          label="信號價格"
          width="105"
          align="right"
          sortable
          :sort-method="sortNullableNumKey('signalPrice')"
        >
          <template #default="{ row }">{{ formatNumber(row.signalPrice) }}</template>
        </el-table-column>
        <el-table-column
          prop="buyPrice"
          label="買入價格"
          width="105"
          align="right"
          sortable
          :sort-method="sortNullableNumKey('buyPrice')"
        >
          <template #default="{ row }">{{ formatNumber(row.buyPrice) }}</template>
        </el-table-column>
        <el-table-column
          prop="buyCost"
          label="買入成本"
          width="105"
          align="right"
          sortable
          :sort-method="sortNullableNumKey('buyCost')"
        >
          <template #default="{ row }">{{ formatNumber(row.buyCost) }}</template>
        </el-table-column>
        <el-table-column
          prop="_latestPrice"
          label="最新股價"
          width="105"
          align="right"
          sortable
          :sort-method="sortNullableNumKey('_latestPrice')"
        >
          <template #default="{ row }">{{ formatNumber(row._latestPrice) }}</template>
        </el-table-column>
        <el-table-column
          prop="_marketValue"
          label="市值"
          width="100"
          align="right"
          sortable
          :sort-method="sortNullableNumKey('_marketValue')"
        >
          <template #default="{ row }">{{ formatNumber(row._marketValue) }}</template>
        </el-table-column>
        <el-table-column
          prop="_pnlPercent"
          label="損益率"
          width="100"
          align="right"
          sortable
          :sort-method="sortNullableNumKey('_pnlPercent')"
        >
          <template #default="{ row }">
            <span :class="pnlPercentClass(row._pnlPercent)">{{
              formatPnlPercent(row._pnlPercent)
            }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="_efficiency"
          label="效率"
          width="110"
          align="right"
          sortable
          :sort-method="sortNullableNumKey('_efficiency')"
        >
          <template #header>
            <span>效率</span>
            <el-tooltip
              content="損益率 ÷（資料日期與買入日之曆日差）；僅在持有天數 &gt; 0 且有損益率時計算，單位 %／日"
              placement="top"
            >
              <span class="col-hint" aria-label="效率說明">ⓘ</span>
            </el-tooltip>
          </template>
          <template #default="{ row }">
            <span :class="pnlPercentClass(row._efficiency)">{{
              formatEfficiency(row._efficiency)
            }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="_quoteDate"
          label="資料日期"
          width="120"
          align="center"
          sortable
          :sort-method="sortQuoteDateRoc"
        >
          <template #default="{ row }">{{ formatQuoteDate(row._quoteDate) }}</template>
        </el-table-column>
        <el-table-column
          prop="dividend"
          label="股息"
          width="90"
          align="right"
          sortable
          :sort-method="sortNullableNumKey('dividend')"
        >
          <template #default="{ row }">{{ formatNumber(row.dividend) }}</template>
        </el-table-column>
        <el-table-column
          prop="overlap"
          label="重疊"
          min-width="100"
          show-overflow-tooltip
          sortable
          :sort-method="sortLocaleStr('overlap')"
        />
        <el-table-column
          prop="industry"
          label="產業"
          min-width="100"
          show-overflow-tooltip
          sortable
          :sort-method="sortLocaleStr('industry')"
        />
        <el-table-column
          prop="pattern"
          label="型態"
          min-width="90"
          show-overflow-tooltip
          sortable
          :sort-method="sortLocaleStr('pattern')"
        />
        <el-table-column
          prop="volume"
          label="成交量"
          width="100"
          align="right"
          sortable
          :sort-method="sortNullableNumKey('volume')"
        >
          <template #default="{ row }">{{ formatInteger(row.volume) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const QUOTE_TOAST_MS = 3500
import { getTwseStockDayAvgAll, getTpexMainboardQuotes } from '@/api/app'
import { HOLDINGS_SEED } from './holdingsSeed.js'

/** localStorage：以台北「當天日期」為單位，同一天不重複打 API */
const LS_TWSE_AVG = 'ecoscore:cache:twse:STOCK_DAY_AVG_ALL'
const LS_TPEX_QUOTES = 'ecoscore:cache:tpex:mainboard_quotes'

function getTaipeiYmd() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

function readJsonCache(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeJsonCache(key, payload) {
  try {
    localStorage.setItem(key, JSON.stringify(payload))
  } catch (e) {
    console.warn('localStorage 寫入失敗', e)
  }
}

/** 完整行情陣列，供持股對照代碼（與快取／API 同步更新） */
const twseRecords = ref([])
const tpexRecords = ref([])
const twseLoading = ref(false)
const tpexLoading = ref(false)

function twseRequestErrorMessage(error) {
  if (error?.response) {
    return `HTTP ${error.response.status} ${error.response.statusText || ''}`.trim()
  }
  if (error?.request && !error?.response) {
    return '無回應（網路或代理異常）'
  }
  return error?.message || String(error)
}

function applyTwseState(data) {
  twseRecords.value = Array.isArray(data) ? data : []
}

function isSameDayCacheValid(cached, todayYmd) {
  if (cached == null) return false
  if (cached.savedYmd !== todayYmd) return false
  if (!Array.isArray(cached.records)) return false
  return cached.records.length > 0
}

/** 若當日快取有效則套用並回傳結果，否則回傳 null */
function readTwseCacheIfValidForToday(todayYmd) {
  const cached = readJsonCache(LS_TWSE_AVG)
  if (isSameDayCacheValid(cached, todayYmd)) {
    applyTwseState(cached.records)
    return {
      source: 'local',
      savedYmd: todayYmd,
      apiDate: cached.apiDate ?? '',
      count: cached.records.length,
    }
  }
  return null
}

async function fetchTwseFromNetwork(todayYmd) {
  try {
    const { data } = await getTwseStockDayAvgAll()
    if (!Array.isArray(data)) throw new Error('回傳格式不是陣列')
    const first = data[0]
    const apiDate = first?.Date ?? ''
    writeJsonCache(LS_TWSE_AVG, {
      apiDate,
      savedYmd: todayYmd,
      records: data,
    })
    applyTwseState(data)
    return { source: 'api', savedYmd: todayYmd, apiDate, count: data.length }
  } catch (e) {
    twseRecords.value = []
    return { source: 'error', message: twseRequestErrorMessage(e) }
  }
}

/**
 * @param {boolean} [forceRefresh=false] 為 true 時略過快取、強制打 API
 * @returns {Promise<{ source: 'local' | 'api' | 'error', savedYmd?: string, apiDate?: string, count?: number }>}
 */
async function fetchTwseStockDayAvgAll(forceRefresh = false) {
  const today = getTaipeiYmd()

  if (forceRefresh) {
    return fetchTwseFromNetwork(today)
  }

  const fromCache = readTwseCacheIfValidForToday(today)
  if (fromCache) {
    return fromCache
  }

  return fetchTwseFromNetwork(today)
}

function applyTpexState(data) {
  tpexRecords.value = Array.isArray(data) ? data : []
}

function readTpexCacheIfValidForToday(todayYmd) {
  const cached = readJsonCache(LS_TPEX_QUOTES)
  if (isSameDayCacheValid(cached, todayYmd)) {
    applyTpexState(cached.records)
    return {
      source: 'local',
      savedYmd: todayYmd,
      apiDate: cached.apiDate ?? '',
      count: cached.records.length,
    }
  }
  return null
}

async function fetchTpexFromNetwork(todayYmd) {
  try {
    const { data } = await getTpexMainboardQuotes()
    if (!Array.isArray(data)) throw new Error('回傳格式不是陣列')
    const first = data[0]
    const apiDate = first?.Date ?? ''
    writeJsonCache(LS_TPEX_QUOTES, {
      apiDate,
      savedYmd: todayYmd,
      records: data,
    })
    applyTpexState(data)
    return { source: 'api', savedYmd: todayYmd, apiDate, count: data.length }
  } catch (e) {
    tpexRecords.value = []
    return { source: 'error', message: twseRequestErrorMessage(e) }
  }
}

/**
 * @param {boolean} [forceRefresh=false] 為 true 時略過快取、強制打 API
 * @returns {Promise<{ source: 'local' | 'api' | 'error', savedYmd?: string, apiDate?: string, count?: number }>}
 */
async function fetchTpexMainboardQuotes(forceRefresh = false) {
  const today = getTaipeiYmd()

  if (forceRefresh) {
    return fetchTpexFromNetwork(today)
  }

  const fromCache = readTpexCacheIfValidForToday(today)
  if (fromCache) {
    return fromCache
  }

  return fetchTpexFromNetwork(today)
}

/** 簡短提示：本機 / 重新取得 / 失敗 */
function toastQuoteSource(label, r) {
  if (r.source === 'local') {
    ElMessage.info({ message: `${label}：使用本機資料`, duration: QUOTE_TOAST_MS })
  } else if (r.source === 'api') {
    ElMessage.success({ message: `${label}：已重新取得資料`, duration: QUOTE_TOAST_MS })
  } else {
    ElMessage.error({ message: `${label}：取得失敗`, duration: QUOTE_TOAST_MS + 1000 })
  }
}

function toastMountSummary(tw, tp) {
  const word = (r) => {
    if (r.source === 'local') return '本機'
    if (r.source === 'api') return '已更新'
    return '失敗'
  }
  const hasErr = tw.source === 'error' || tp.source === 'error'
  ElMessage({
    message: `上市：${word(tw)}，上櫃：${word(tp)}`,
    type: hasErr ? 'warning' : 'info',
    duration: QUOTE_TOAST_MS,
  })
}

async function refreshTwseFromApi() {
  twseLoading.value = true
  try {
    const r = await fetchTwseStockDayAvgAll(true)
    toastQuoteSource('上市', r)
  } finally {
    twseLoading.value = false
  }
}

async function refreshTpexFromApi() {
  tpexLoading.value = true
  try {
    const r = await fetchTpexMainboardQuotes(true)
    toastQuoteSource('上櫃', r)
  } finally {
    tpexLoading.value = false
  }
}

/** 從「標的」字串結尾取出證券代碼，例如「群光 2385」→ 2385 */
function extractStockCode(symbol) {
  if (symbol == null || symbol === '') return ''
  const m = String(symbol).trim().match(/([0-9A-Za-z]+)\s*$/)
  return m ? m[1] : ''
}

function parseQuotePrice(q) {
  if (!q) return NaN
  const raw = q.ClosingPrice ?? q.Close ?? ''
  const n = parseFloat(String(raw).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : NaN
}

/** API 民國日 1150423 → 本地日界線 timestamp（用於與買入日算曆日差） */
function parseQuoteRocToTime(rocYyyMmDd) {
  if (rocYyyMmDd == null || rocYyyMmDd === '' || rocYyyMmDd === '—') return null
  const s = String(rocYyyMmDd).replace(/\D/g, '')
  if (s.length !== 7) return null
  const rocY = parseInt(s.slice(0, 3), 10)
  const mm = parseInt(s.slice(3, 5), 10)
  const dd = parseInt(s.slice(5, 7), 10)
  if (![rocY, mm, dd].every((x) => Number.isFinite(x))) return null
  const y = rocY + 1911
  return new Date(y, mm - 1, dd).getTime()
}

/** API 民國日 1150423 → 顯示 2026-04-23 */
function formatQuoteDate(rocYyyMmDd) {
  if (rocYyyMmDd == null || rocYyyMmDd === '' || rocYyyMmDd === '—') return '—'
  const s = String(rocYyyMmDd).replace(/\D/g, '')
  if (s.length !== 7) return String(rocYyyMmDd)
  const rocY = parseInt(s.slice(0, 3), 10)
  const mm = s.slice(3, 5)
  const dd = s.slice(5, 7)
  if (!Number.isFinite(rocY)) return String(rocYyyMmDd)
  const y = rocY + 1911
  return `${y}-${mm}-${dd}`
}

/** 兩個本地午夜 timestamp 的曆日差（行情日 − 買入日） */
function diffCalendarDays(tEnd, tStart) {
  if (tEnd == null || tStart == null) return null
  const d = Math.round((tEnd - tStart) / 86400000)
  return Number.isFinite(d) ? d : null
}

const holdingsWithQuotes = computed(() => {
  const twseMap = new Map(
    twseRecords.value.map((r) => [String(r.Code ?? '').trim(), r])
  )
  const tpexMap = new Map(
    tpexRecords.value.map((r) => [String(r.SecuritiesCompanyCode ?? '').trim(), r])
  )

  return holdings.value.map((row) => {
    const code = extractStockCode(row.symbol)
    let quote = code ? twseMap.get(code) : null
    if (!quote && code) quote = tpexMap.get(code)

    const priceNum = parseQuotePrice(quote)
    const buyP = Number(row.buyPrice)
    const buyC = Number(row.buyCost)

    let shares = null
    let marketValue = null
    if (buyP > 0 && Number.isFinite(buyC)) {
      shares = buyC / buyP
    }
    if (shares != null && Number.isFinite(priceNum)) {
      marketValue = shares * priceNum
    }

    let pnlPercent = null
    if (
      marketValue != null &&
      Number.isFinite(marketValue) &&
      buyC > 0 &&
      Number.isFinite(buyC)
    ) {
      pnlPercent = ((marketValue - buyC) / buyC) * 100
    }

    const quoteDayT = parseQuoteRocToTime(quote?.Date ?? '')
    const buyDayT = parseSlashYmdToTime(row.buyDate)
    const heldDays = diffCalendarDays(quoteDayT, buyDayT)
    let efficiency = null
    if (
      heldDays != null &&
      heldDays > 0 &&
      pnlPercent != null &&
      Number.isFinite(pnlPercent)
    ) {
      efficiency = pnlPercent / heldDays
    }

    return {
      ...row,
      _latestPrice: Number.isFinite(priceNum) ? priceNum : null,
      _marketValue: marketValue,
      _pnlPercent: pnlPercent,
      _quoteDate: quote?.Date ?? '',
      _heldDays: heldDays,
      _efficiency: efficiency,
    }
  })
})

onMounted(async () => {
  twseLoading.value = true
  tpexLoading.value = true
  try {
    const [tw, tp] = await Promise.all([
      fetchTwseStockDayAvgAll(),
      fetchTpexMainboardQuotes(),
    ])
    toastMountSummary(tw, tp)
  } finally {
    twseLoading.value = false
    tpexLoading.value = false
  }
})

/**
 * 持股資料（未來可改為 API / 本地儲存載入）
 * @typedef {Object} HoldingRow
 * @property {string} strategyName - 策略名稱
 * @property {string} buyDate - 買入日期
 * @property {string} sellDate - 賣出日期
 * @property {string} symbol - 標的
 * @property {number|null} signalPrice - 信號價格
 * @property {number|null} buyPrice - 買入價格
 * @property {number|null} buyCost - 買入成本
 * @property {number|null} dividend - 股息
 * @property {string} overlap - 重疊
 * @property {string} industry - 產業
 * @property {string} pattern - 型態
 * @property {number|null} volume - 成交量
 * @property {number|null} [_heldDays] - 資料日期與買入日曆日差
 * @property {number|null} [_efficiency] - 損益率／持有天數（%/日）
 */
const holdings = ref([...HOLDINGS_SEED])

/** 依資料列順序，每個 strategyName 一個分頁 */
const strategyTabs = computed(() => {
  const counts = new Map()
  for (const row of holdings.value) {
    const k = row.strategyName
    if (!k) continue
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const seen = new Set()
  const tabs = []
  for (const row of holdings.value) {
    const k = row.strategyName
    if (!k || seen.has(k)) continue
    seen.add(k)
    tabs.push({ name: k, label: `${k}（${counts.get(k)}）` })
  }
  return tabs
})

const activeStrategyTab = ref('')

watch(
  strategyTabs,
  (tabs) => {
    if (!tabs.length) {
      activeStrategyTab.value = ''
      return
    }
    if (!tabs.some((t) => t.name === activeStrategyTab.value)) {
      activeStrategyTab.value = tabs[0].name
    }
  },
  { immediate: true }
)

const holdingsWithQuotesForTab = computed(() => {
  const key = activeStrategyTab.value
  if (!key) return []
  return holdingsWithQuotes.value.filter((r) => r.strategyName === key)
})

function medianOfNumbers(values) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** 目前分頁：總損益金額、平均／中位損益率、勝率（僅計有行情者） */
const activeTabStats = computed(() => {
  const rows = holdingsWithQuotesForTab.value
  const pnlPercents = []
  const dollarPnls = []
  let wins = 0

  for (const r of rows) {
    const pct = finiteNumber(r._pnlPercent)
    const mv = finiteNumber(r._marketValue)
    const cost = finiteNumber(r.buyCost)
    if (pct != null) {
      pnlPercents.push(pct)
      if (pct > 0) wins += 1
    }
    if (mv != null && cost != null) {
      dollarPnls.push(mv - cost)
    }
  }

  const nPct = pnlPercents.length
  const nDollar = dollarPnls.length
  const avgPct = nPct ? pnlPercents.reduce((a, b) => a + b, 0) / nPct : null
  const totalDollar = nDollar ? dollarPnls.reduce((a, b) => a + b, 0) : null
  const winRate = nPct ? wins / nPct : null

  return {
    totalDollarPnl: totalDollar,
    avgPnlPercent: avgPct,
    medianPnlPercent: medianOfNumbers(pnlPercents),
    winRate,
    samplePct: nPct,
    sampleDollar: nDollar,
  }
})

function finiteNumber(val) {
  if (val == null || val === '') return null
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

/** 無效數字排後面 */
function sortNullableNumKey(key) {
  return (a, b) => {
    const fa = finiteNumber(a[key])
    const fb = finiteNumber(b[key])
    if (fa == null && fb == null) return 0
    if (fa == null) return 1
    if (fb == null) return -1
    return fa - fb
  }
}

function parseSlashYmdToTime(s) {
  if (s == null || s === '') return null
  const p = String(s)
    .split('/')
    .map((x) => parseInt(x.trim(), 10))
  if (p.length !== 3 || p.some((x) => !Number.isFinite(x))) return null
  return new Date(p[0], p[1] - 1, p[2]).getTime()
}

function sortSlashYmdKey(key) {
  return (a, b) => {
    const ta = parseSlashYmdToTime(a[key])
    const tb = parseSlashYmdToTime(b[key])
    if (ta == null && tb == null) return 0
    if (ta == null) return 1
    if (tb == null) return -1
    return ta - tb
  }
}

/** 證交所行情 Date 民國 7 碼，數字序即時間序 */
function sortQuoteDateRoc(a, b) {
  const sa = String(a._quoteDate ?? '').replace(/\D/g, '')
  const sb = String(b._quoteDate ?? '').replace(/\D/g, '')
  if (sa === '' && sb === '') return 0
  if (sa === '') return 1
  if (sb === '') return -1
  return sa.localeCompare(sb, undefined, { numeric: true })
}

function sortLocaleStr(key) {
  return (a, b) =>
    String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'zh-Hant', {
      numeric: true,
    })
}

/** 台股慣例：上漲紅、下跌綠 */
function pnlPercentClass(pct) {
  const n = finiteNumber(pct)
  if (n == null) return ''
  if (n > 0) return 'pnl-pos'
  if (n < 0) return 'pnl-neg'
  return ''
}

function formatNumber(val) {
  if (val === null || val === undefined || val === '') return '—'
  const n = Number(val)
  if (Number.isNaN(n)) return String(val)
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 2 })
}

function formatInteger(val) {
  if (val === null || val === undefined || val === '') return '—'
  const n = Number(val)
  if (Number.isNaN(n)) return String(val)
  return Math.round(n).toLocaleString('zh-TW')
}

/** 損益率（%） */
function formatPnlPercent(val) {
  if (val === null || val === undefined || Number.isNaN(val)) return '—'
  const n = Number(val)
  if (Number.isNaN(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

/** 效率：報酬率／天，%/日 */
function formatEfficiency(val) {
  if (val === null || val === undefined || Number.isNaN(val)) return '—'
  const n = Number(val)
  if (Number.isNaN(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(4)}%`
}

function formatWinRate(ratio) {
  if (ratio == null || Number.isNaN(ratio)) return '—'
  return `${(ratio * 100).toFixed(2)}%`
}

/** 損益金額（市值 − 成本），含正負號與 NT$ */
function formatSignedNtDollar(val) {
  if (val == null || Number.isNaN(val)) return '—'
  const n = Number(val)
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  const abs = Math.abs(Math.round(n))
  return `${sign}NT$${abs.toLocaleString('zh-TW')}`
}
</script>

<style scoped>
.holdings-record {
  padding: 20px;
  max-width: 1600px;
  margin: 0 auto;
}

.page-card {
  width: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.header-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.pnl-pos {
  color: #e53935;
  font-weight: 600;
}

.pnl-neg {
  color: #43a047;
  font-weight: 600;
}

.strategy-tabs {
  margin-bottom: 12px;
}

.strategy-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.tab-stats {
  margin: 0 0 14px;
  padding: 12px 14px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  border: 1px solid var(--el-border-color-lighter);
}

.tab-stats__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
  gap: 12px 20px;
}

.tab-stats__label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.tab-stats__value {
  font-size: 15px;
  font-weight: 600;
}

.tab-stats__value--muted {
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.tab-stats-note {
  display: block;
  margin-top: 10px;
}

.strategy-table {
  margin-top: 0;
}

.col-hint {
  margin-left: 4px;
  cursor: help;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  vertical-align: middle;
}
</style>
