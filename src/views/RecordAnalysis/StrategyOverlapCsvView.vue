<template>
  <div class="overlap-page">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>雙策略 CSV 重疊篩選</span>
          <el-text size="small" type="info" class="hint">
            上傳兩個與「XQ 分析器 重製版」相同的交易紀錄 CSV。對<strong>同一商品名稱</strong>且<strong>同一進場時間</strong>，在兩邊<strong>都存在</strong>的組合：若在單一策略有多筆同名同進場日，先取<strong>持有區間</strong>最大的一筆作代表；再以兩邊代表的<strong>持有區間</strong>數值<strong>較大的那一列</strong>輸出（若相同則採<strong>策略一</strong>那筆）。
          </el-text>
        </div>
      </template>

      <el-form label-width="120px" class="upload-form">
        <el-form-item label="策略一 CSV">
          <input
            ref="input1"
            type="file"
            accept=".csv"
            class="file-input"
            @change="onFile1"
          />
          <el-text v-if="fileName1" size="small" class="file-label">{{ fileName1 }}</el-text>
        </el-form-item>
        <el-form-item label="策略二 CSV">
          <input
            ref="input2"
            type="file"
            accept=".csv"
            class="file-input"
            @change="onFile2"
          />
          <el-text v-if="fileName2" size="small" class="file-label">{{ fileName2 }}</el-text>
        </el-form-item>
      </el-form>

      <el-descriptions :column="2" border size="small" class="stats">
        <el-descriptions-item label="策略一筆數">{{ rawRows1.length }}</el-descriptions-item>
        <el-descriptions-item label="策略二筆數">{{ rawRows2.length }}</el-descriptions-item>
        <el-descriptions-item label="重疊筆數（輸出）" :span="2">
          <el-tag :type="overlapRows.length ? 'success' : 'info'">{{ overlapRows.length }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <template v-if="rawRows1.length || rawRows2.length">
        <el-divider content-position="left">持有區間：同一筆進場「>60 天」對「約 60 天」配對報酬</el-divider>
        <el-text v-if="holdingCompareStats.message" type="warning" size="small" class="holding-note">
          {{ holdingCompareStats.message }}
        </el-text>
        <el-descriptions border size="small" :column="2" class="holding-stats">
          <el-descriptions-item label="合併後交易鍵數（名稱＋進場日）">{{ holdingCompareStats.distinctKeyCount }}</el-descriptions-item>
          <el-descriptions-item label="成功配對筆數">{{ holdingCompareStats.pairCount }}</el-descriptions-item>
          <el-descriptions-item label="實際>60天之平均報酬（配對列）">
            {{ holdingCompareStats.meanLongDisplay }}
          </el-descriptions-item>
          <el-descriptions-item label="同筆約60天之平均報酬（配對列）">
            {{ holdingCompareStats.mean60Display }}
          </el-descriptions-item>
          <el-descriptions-item label="平均多出（百分點）" :span="2">
            {{ holdingCompareStats.diffMeanPpDisplay }}
          </el-descriptions-item>
          <el-descriptions-item label="「>60報酬」高於「同筆60天報酬」機率" :span="2">
            {{ holdingCompareStats.probStrictWinDisplay }}
            <el-text v-if="holdingCompareStats.probDetail" type="info" size="small" class="prob-sub">
              {{ holdingCompareStats.probDetail }}
            </el-text>
          </el-descriptions-item>
        </el-descriptions>
        <el-text size="small" type="info" class="formula-hint">
          將<strong>策略一與策略二的所有列</strong>合併，依<strong>商品名稱＋進場時間</strong>分組；僅對<strong>同一組內</strong>同時出現<strong>持有&gt;60</strong>（取該組持有最長的那一列）與<strong>持有四捨五入為60</strong>（取其中一列）者做配對。平均報酬與機率皆只基於這些<strong>成對的同進場交易</strong>，不再混用無關的其他60天單。
        </el-text>
      </template>

      <div class="actions">
        <el-button type="primary" :disabled="!overlapRows.length" @click="downloadOverlapCsv">
          下載重疊結果 CSV
        </el-button>
        <el-button @click="clearAll">清除</el-button>
      </div>

      <el-divider content-position="left">預覽：持有超過60天配對列（全部，含同進場約60天報酬；欄頭可排序）</el-divider>
      <el-table
        v-if="previewHoldingRows.length"
        :data="previewHoldingRows"
        border
        stripe
        size="small"
        max-height="560"
      >
        <el-table-column
          prop="商品名稱"
          label="商品名稱"
          min-width="120"
          sortable
          :sort-method="(a, b) => comparePreviewRows(a, b, '商品名稱')"
          show-overflow-tooltip
        />
        <el-table-column
          prop="商品代碼"
          label="商品代碼"
          min-width="100"
          sortable
          :sort-method="(a, b) => comparePreviewRows(a, b, '商品代碼')"
          show-overflow-tooltip
        />
        <el-table-column
          prop="進場時間"
          label="進場時間"
          min-width="118"
          sortable
          :sort-method="(a, b) => comparePreviewRows(a, b, '進場時間')"
          show-overflow-tooltip
        />
        <el-table-column
          prop="進場方向"
          label="進場方向"
          min-width="88"
          sortable
          :sort-method="(a, b) => comparePreviewRows(a, b, '進場方向')"
          show-overflow-tooltip
        />
        <el-table-column
          prop="進場價格"
          label="進場價格"
          min-width="96"
          sortable
          :sort-method="(a, b) => comparePreviewRows(a, b, '進場價格')"
          show-overflow-tooltip
        />
        <el-table-column
          prop="出場時間"
          label="出場時間"
          min-width="118"
          sortable
          :sort-method="(a, b) => comparePreviewRows(a, b, '出場時間')"
          show-overflow-tooltip
        />
        <el-table-column
          prop="出場價格"
          label="出場價格"
          min-width="96"
          sortable
          :sort-method="(a, b) => comparePreviewRows(a, b, '出場價格')"
          show-overflow-tooltip
        />
        <el-table-column
          prop="持有區間"
          label="持有區間"
          min-width="94"
          sortable
          :sort-method="(a, b) => comparePreviewRows(a, b, '持有區間')"
          show-overflow-tooltip
        />
        <el-table-column
          prop="報酬率"
          label="報酬率"
          min-width="110"
          sortable
          :sort-method="(a, b) => comparePreviewRows(a, b, '報酬率')"
          show-overflow-tooltip
        />
        <el-table-column
          prop="約60天報酬率"
          label="約60天報酬率"
          min-width="130"
          sortable
          :sort-method="(a, b) => comparePreviewRows(a, b, '約60天報酬率')"
          show-overflow-tooltip
        />
        <el-table-column
          prop="報酬差(>60−約60)"
          label="報酬差(>60−約60)"
          min-width="146"
          sortable
          :sort-method="(a, b) => comparePreviewRows(a, b, '報酬差(>60−約60)')"
          show-overflow-tooltip
        />
      </el-table>
      <el-empty v-else description="請先上傳 CSV；需能組出「>60」與「約60」同進場配對後才會顯示" />
    </el-card>
  </div>
</template>

<script setup>
import { parseCSV } from '@/utils/csvReader'
import { ElMessage } from 'element-plus'
import Papa from 'papaparse'
import { computed, ref } from 'vue'

/** 與 OptimizedIndex `processData` 使用的中文欄位一致；輸出欄位順序以此為主，其他欄跟著所有輸出列合併的 key */
const PRIORITY_HEADERS = [
  '序號',
  '商品名稱',
  '商品代碼',
  '進場時間',
  '進場價格',
  '出場時間',
  '出場價格',
  '持有區間',
  '報酬率',
]

const input1 = ref(null)
const input2 = ref(null)
const fileName1 = ref('')
const fileName2 = ref('')
const rawRows1 = ref([])
const rawRows2 = ref([])

/** 預覽表格固定欄（與常見 XQ 匯出欄對齊）；「約60天報酬率」「報酬差(>60−約60)」為預覽加算的欄位 */
const PREVIEW_TABLE_COL_ORDER = [
  '序號',
  '商品名稱',
  '商品代碼',
  '進場時間',
  '進場方向',
  '進場價格',
  '出場時間',
  '出場方向',
  '出場價格',
  '持有區間',
  '報酬率',
  '約60天報酬率',
  '報酬差(>60−約60)',
  '訊息',
]

/** 報酬小數 → 與「約60天報酬率」同一格式：xx.xx% */
function formatReturnPctCell(frac) {
  return frac == null || !Number.isFinite(frac)
    ? '—'
    : `${(frac * 100).toFixed(2)}%`
}

/** (>60 − 約60)，與報酬率欄同語意：Δ(％) */
function formatReturnDiffPctPoints(retLong, ret60) {
  if (
    retLong == null ||
    ret60 == null ||
    !Number.isFinite(retLong) ||
    !Number.isFinite(ret60)
  ) {
    return '—'
  }
  const pp = (retLong - ret60) * 100
  const sign = pp === 0 || Object.is(pp, -0) ? '' : pp > 0 ? '+' : ''
  return `${sign}${pp.toFixed(2)}%`
}

function cellStrForSort(v) {
  if (v == null || v === '') return ''
  const s = String(v).trim()
  return s === '—' ? '' : s
}

function comparableForPreviewSort(col, row) {
  const s = cellStrForSort(row[col])
  if (
    col === '報酬率' ||
    col === '約60天報酬率' ||
    col === '報酬差(>60−約60)'
  ) {
    const m = s.replace(/%/g, '').trim()
    const n = parseFloat(m)
    return Number.isFinite(n)
      ? { kind: 'number', val: n }
      : { kind: 'empty' }
  }
  if (!s) return { kind: 'empty' }
  if (col === '進場價格' || col === '出場價格') {
    const n = parseFloat(s.replace(/,/g, ''))
    return Number.isFinite(n) ? { kind: 'number', val: n } : { kind: 'empty' }
  }
  if (col === '進場時間' || col === '出場時間') {
    const d = new Date(s.replace(/-/g, '/'))
    const t = d.getTime()
    return Number.isFinite(t) ? { kind: 'number', val: t } : { kind: 'string', val: s }
  }
  if (col === '持有區間') {
    const m = s.match(/-?\d+(?:\.\d+)?/)
    const n = m ? parseFloat(m[0]) : NaN
    return Number.isFinite(n) ? { kind: 'number', val: n } : { kind: 'string', val: s }
  }
  if (col === '序號') {
    const n = parseFloat(s)
    return Number.isFinite(n) ? { kind: 'number', val: n } : { kind: 'string', val: s }
  }
  return { kind: 'string', val: s }
}

function cmpPreviewSortBox(aBox, bBox) {
  if (aBox.kind === 'empty' && bBox.kind === 'empty') return 0
  if (aBox.kind === 'empty') return -1
  if (bBox.kind === 'empty') return 1
  if (aBox.kind === 'number' && bBox.kind === 'number') {
    return aBox.val === bBox.val ? 0 : aBox.val - bBox.val
  }
  const sa = aBox.kind === 'number' ? String(aBox.val) : aBox.val
  const sb = bBox.kind === 'number' ? String(bBox.val) : bBox.val
  return String(sa).localeCompare(String(sb), 'zh-Hant')
}

/** Element Plus 表格欄 sort-method */
function comparePreviewRows(rowA, rowB, col) {
  return cmpPreviewSortBox(
    comparableForPreviewSort(col, rowA),
    comparableForPreviewSort(col, rowB)
  )
}

function normalizeName(s) {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 將 / 統一成 -，並去掉空白；日期若可解析會正規化成 YYYY-MM-DD 以利對齊 */
function normalizeBuyDay(s) {
  const raw = String(s ?? '')
    .trim()
    .replace(/\//g, '-')
    .replace(/\s+/g, '')
  if (!raw) return ''
  const d = new Date(raw.replace(/-/g, '/'))
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }
  return raw
}

function tradeKey(row) {
  const n = normalizeName(row['商品名稱'])
  const d = normalizeBuyDay(row['進場時間'])
  if (!n || !d) return null
  return `${n}||${d}`
}

/** 從「持有區間」欄位取出第一個數字；缺值或無法解析視為非常小 */
function parseHoldingDays(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return Number.NEGATIVE_INFINITY
  const m = s.match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : Number.NEGATIVE_INFINITY
}

/** 報酬率轉成「報酬倍率」（顯示時再 ×100 為％）：
 * - 典型 XQ CSV 為倍率小數：0.05≈5%、1.56≈+156%；只要 |x|≤1.5 即視為已是倍率；
 * - 若為整數或大數且不帶小數尾巴：常見為「％數」匯出，如 15、156 → 視為 15%、156%，再除以 100；
 * - 若有小數且 |x|>1.5：視為已是倍率（避免 1.56 被當成 156%數字而再除 100 變成 1.56%）。
 */
function parseReturnFraction(raw) {
  const t = String(raw ?? '').trim().replace(/%/g, '')
  if (!t) return null
  const v = parseFloat(t)
  if (!Number.isFinite(v)) return null
  if (Math.abs(v) <= 1.5) return v
  if (Number.isInteger(v)) return v / 100
  return v
}

function mean(arr) {
  if (!arr.length) return null
  let s = 0
  for (const x of arr) s += x
  return s / arr.length
}

function combinedRowsByTradeKey() {
  const map = new Map()
  function add(rows) {
    for (const r of rows) {
      const k = tradeKey(r)
      if (!k) continue
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(r)
    }
  }
  add(rawRows1.value)
  add(rawRows2.value)
  return map
}

/** 同名同進場日中，選持有區間最大的一列；並列時取較早出現者 */
function pickRowWithMaxHolding(rows) {
  if (!rows.length) return undefined
  let best = rows[0]
  let bestVal = parseHoldingDays(best['持有區間'])
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const v = parseHoldingDays(r['持有區間'])
    if (v > bestVal) {
      best = r
      bestVal = v
    }
  }
  return best
}

/** 合併兩檔後，同進場同時有「>60」與「約60」的配對列表（統計／預覽共用） */
const holdingPairRecords = computed(() => {
  if (!rawRows1.value.length && !rawRows2.value.length) return []

  const byKey = combinedRowsByTradeKey()
  const list = []
  for (const rows of byKey.values()) {
    const longCand = rows.filter((r) => {
      const h = parseHoldingDays(r['持有區間'])
      return Number.isFinite(h) && h > 60
    })
    const d60Cand = rows.filter((r) => {
      const h = parseHoldingDays(r['持有區間'])
      return Number.isFinite(h) && Math.round(h) === 60
    })
    if (!longCand.length || !d60Cand.length) continue
    const rLong = pickRowWithMaxHolding(longCand)
    const r60 = pickRowWithMaxHolding(d60Cand)
    if (!rLong || !r60) continue
    const retL = parseReturnFraction(rLong['報酬率'])
    const retS = parseReturnFraction(r60['報酬率'])
    if (retL == null || retS == null) continue
    list.push({
      rLong,
      r60,
      retLong: retL,
      ret60: retS,
    })
  }
  return list
})

const holdingCompareStats = computed(() => {
  const pooled = [...rawRows1.value, ...rawRows2.value]
  const emptyBase = () => ({
    message: '',
    distinctKeyCount: 0,
    pairCount: 0,
    meanLongDisplay: '—',
    mean60Display: '—',
    diffMeanPpDisplay: '—',
    probStrictWinDisplay: '—',
    probDetail: '',
  })

  if (!pooled.length) {
    return {
      ...emptyBase(),
      message: '請先上傳 CSV 以計算持有區間配對統計。',
    }
  }

  const pairs = holdingPairRecords.value
  const byKey = combinedRowsByTradeKey()
  const fmtPctFromFraction = (f) =>
    f == null ? '—' : `${(f * 100).toFixed(2)}%`

  if (!pairs.length) {
    return {
      ...emptyBase(),
      distinctKeyCount: byKey.size,
      message:
        byKey.size > 0
          ? '兩檔合併後，沒有任何「同名同進場」同時具備「持有>60」與「持有約60」（四捨五入為60）的列對。常見作法：同一策略分別輸出「較長最大持有」與「最大持有60期」CSV，再上傳到此頁交叉比對。'
          : '',
    }
  }

  const retLongs = pairs.map((p) => p.retLong)
  const ret60s = pairs.map((p) => p.ret60)
  const avgLong = mean(retLongs)
  const avg60 = mean(ret60s)
  let winsStrict = 0
  for (const p of pairs) {
    if (p.retLong > p.ret60) winsStrict += 1
  }
  const prob = winsStrict / pairs.length
  const diffPp = (avgLong - avg60) * 100

  return {
    message: '',
    distinctKeyCount: byKey.size,
    pairCount: pairs.length,
    meanLongDisplay: fmtPctFromFraction(avgLong),
    mean60Display: fmtPctFromFraction(avg60),
    diffMeanPpDisplay: `${diffPp >= 0 ? '+' : ''}${diffPp.toFixed(2)} 個百分點`,
    probStrictWinDisplay: `${(prob * 100).toFixed(2)}%`,
    probDetail: `（${winsStrict} / ${pairs.length} 筆配對：每筆實際>60之報酬 嚴格大於 同進場約60天之報酬）`,
  }
})

function groupRowsByTradeKey(rows) {
  const map = new Map()
  for (const r of rows) {
    const k = tradeKey(r)
    if (!k) continue
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(r)
  }
  return map
}

const overlapRows = computed(() => {
  const m1 = groupRowsByTradeKey(rawRows1.value)
  const m2 = groupRowsByTradeKey(rawRows2.value)
  const out = []
  for (const key of Array.from(m1.keys())) {
    if (!m2.has(key)) continue
    const list1 = m1.get(key)
    const list2 = m2.get(key)
    const r1 = pickRowWithMaxHolding(list1)
    const r2 = pickRowWithMaxHolding(list2)
    if (!r1 || !r2) continue
    const v1 = parseHoldingDays(r1['持有區間'])
    const v2 = parseHoldingDays(r2['持有區間'])
    if (v2 > v1) {
      out.push(r2)
    } else {
      out.push(r1)
    }
  }
  return out
})

function buildExportHeadersFromRows(rows) {
  if (!rows.length) return [...PRIORITY_HEADERS]
  const keySet = new Set()
  for (const r of rows) {
    Object.keys(r).forEach((k) => keySet.add(k))
  }
  const rest = Array.from(keySet)
    .filter((k) => !PRIORITY_HEADERS.includes(k))
    .sort((a, b) => a.localeCompare(b, 'zh-Hant'))
  return [...PRIORITY_HEADERS.filter((h) => keySet.has(h)), ...rest]
}

const previewHoldingRows = computed(() => {
  const cols = PREVIEW_TABLE_COL_ORDER
  return holdingPairRecords.value.map((p) => {
    const row = {}
    for (const c of cols) {
      if (c === '約60天報酬率') {
        row[c] = formatReturnPctCell(p.ret60)
      } else if (c === '報酬差(>60−約60)') {
        row[c] = formatReturnDiffPctPoints(p.retLong, p.ret60)
      } else if (c === '報酬率') {
        row[c] = formatReturnPctCell(p.retLong)
      } else {
        const v = p.rLong[c]
        row[c] = v == null ? '' : String(v)
      }
    }
    return row
  })
})

async function onFile1(e) {
  const input = e.target
  const file = input.files?.[0]
  if (!file) return
  try {
    const data = await parseCSV(file)
    rawRows1.value = data
    fileName1.value = file.name
    ElMessage.success(`已載入策略一：${data.length} 筆`)
  } catch (err) {
    console.error(err)
    ElMessage.error('策略一 CSV 解析失敗')
    rawRows1.value = []
    fileName1.value = ''
  }
  input.value = ''
}

async function onFile2(e) {
  const input = e.target
  const file = input.files?.[0]
  if (!file) return
  try {
    const data = await parseCSV(file)
    rawRows2.value = data
    fileName2.value = file.name
    ElMessage.success(`已載入策略二：${data.length} 筆`)
  } catch (err) {
    console.error(err)
    ElMessage.error('策略二 CSV 解析失敗')
    rawRows2.value = []
    fileName2.value = ''
  }
  input.value = ''
}

function downloadOverlapCsv() {
  const rows = overlapRows.value
  if (!rows.length) {
    ElMessage.warning('沒有可下載的重疊資料')
    return
  }
  const headers = buildExportHeadersFromRows(rows)
  const data = rows.map((row) => {
    const o = {}
    for (const h of headers) {
      const v = row[h]
      o[h] = v == null ? '' : String(v)
    }
    return o
  })
  const csv = '\uFEFF' + Papa.unparse(data, { columns: headers })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  a.href = url
  a.download = `strategy_overlap_${stamp}.csv`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已下載 ${rows.length} 筆`)
}

function clearAll() {
  rawRows1.value = []
  rawRows2.value = []
  fileName1.value = ''
  fileName2.value = ''
  if (input1.value) input1.value.value = ''
  if (input2.value) input2.value.value = ''
}
</script>

<style scoped>
.overlap-page {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}
.card-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hint {
  line-height: 1.5;
}
.file-input {
  margin-right: 12px;
}
.file-label {
  margin-left: 8px;
  vertical-align: middle;
}
.upload-form {
  margin-bottom: 16px;
}
.stats {
  margin-bottom: 16px;
}
.actions {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}
.holding-note {
  display: block;
  margin-bottom: 8px;
}
.holding-stats {
  margin-bottom: 8px;
}
.prob-sub {
  display: block;
  margin-top: 4px;
}
.formula-hint {
  display: block;
  line-height: 1.55;
  margin-top: 8px;
}
</style>
