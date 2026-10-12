/**
 * 0050（或其它指數／ETF）市場三態回測
 *
 * 標籤：未來 forwardDays 日報酬 > upPct → 上漲；< downPct → 下跌；其餘盤整
 * 特徵（訊號日可算）：趨勢、動能、高波動 → 8 種組合
 * 準度：時間序 walk-forward（只用過去樣本估機率）vs 永遠猜當時最常見類別
 */

export const REGIME_UP = 'up'
export const REGIME_SIDE = 'side'
export const REGIME_DOWN = 'down'

export const REGIME_LABELS = {
  [REGIME_UP]: '上漲',
  [REGIME_SIDE]: '盤整',
  [REGIME_DOWN]: '下跌',
}

/** @param {Array<{ trade_date: string, close_price: number|string }>} rows */
export function normalizeCloses(rows) {
  return rows.map((r) => ({
    date: r.trade_date,
    close: Number(r.close_price),
  }))
}

function smaAt(closes, i, period) {
  if (i < period - 1) return null
  let sum = 0
  for (let j = i - period + 1; j <= i; j++) sum += closes[j]
  return sum / period
}

/** 近 window 日報酬（以收盤） */
function retOver(closes, i, window) {
  if (i < window) return null
  const a = closes[i - window]
  const b = closes[i]
  if (!a || !b) return null
  return (b - a) / a
}

/** 近 window 日年化波動（日報酬 std * sqrt(252)） */
function annVolAt(closes, i, window) {
  if (i < window) return null
  const rets = []
  for (let j = i - window + 1; j <= i; j++) {
    const prev = closes[j - 1]
    const cur = closes[j]
    if (!prev) return null
    rets.push((cur - prev) / prev)
  }
  const mean = rets.reduce((s, x) => s + x, 0) / rets.length
  let varSum = 0
  for (const x of rets) varSum += (x - mean) ** 2
  const std = Math.sqrt(varSum / Math.max(1, rets.length - 1))
  return std * Math.sqrt(252)
}

function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null
  const idx = (sortedAsc.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sortedAsc[lo]
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo)
}

function labelFromForwardRet(ret, upPct, downPct) {
  if (ret == null || !Number.isFinite(ret)) return null
  if (ret > upPct) return REGIME_UP
  if (ret < downPct) return REGIME_DOWN
  return REGIME_SIDE
}

function comboKey(trend, mom, highVol) {
  return `${trend ? 1 : 0}${mom ? 1 : 0}${highVol ? 1 : 0}`
}

function comboLabel(key) {
  const [t, m, v] = key.split('').map(Number)
  return [
    t ? '趨勢↑' : '趨勢↓',
    m ? '動能+' : '動能−',
    v ? '高波動' : '低波動',
  ].join(' / ')
}

/** 取每月最後一個交易日 index */
export function monthEndIndices(dates) {
  const out = []
  for (let i = 0; i < dates.length; i++) {
    const ym = dates[i].slice(0, 7)
    const nextYm = i + 1 < dates.length ? dates[i + 1].slice(0, 7) : null
    if (nextYm !== ym) out.push(i)
  }
  return out
}

/**
 * @param {ReturnType<typeof normalizeCloses>} series
 * @param {object} opts
 */
export function runRegimeBacktest(series, opts = {}) {
  const {
    smaPeriod = 200,
    momWindow = 63,
    volWindow = 20,
    volLookbackDays = 252 * 5,
    volPercentile = 0.75,
    forwardDays = 63,
    upPct = 0.05,
    downPct = -0.05,
  } = opts

  const closes = series.map((s) => s.close)
  const dates = series.map((s) => s.date)
  const n = closes.length

  // 預先算每日 20 日波動，供分位數用
  const dailyVol = new Array(n).fill(null)
  for (let i = 0; i < n; i++) dailyVol[i] = annVolAt(closes, i, volWindow)

  const sampleIdx = monthEndIndices(dates)
  /** @type {Array<object>} */
  const samples = []

  for (const i of sampleIdx) {
    const fwdEnd = i + forwardDays
    if (fwdEnd >= n) continue

    const sma = smaAt(closes, i, smaPeriod)
    const mom = retOver(closes, i, momWindow)
    const vol = dailyVol[i]
    if (sma == null || mom == null || vol == null) continue

    // 過去 volLookbackDays 內的 vol 分位（不含當日之後）
    const volHist = []
    const histStart = Math.max(volWindow, i - volLookbackDays + 1)
    for (let j = histStart; j <= i; j++) {
      if (dailyVol[j] != null) volHist.push(dailyVol[j])
    }
    if (volHist.length < 60) continue
    volHist.sort((a, b) => a - b)
    const volThr = percentile(volHist, volPercentile)
    if (volThr == null) continue

    const trendOn = closes[i] > sma
    const momOn = mom > 0
    const highVol = vol >= volThr
    const fwdRet = (closes[fwdEnd] - closes[i]) / closes[i]
    const actual = labelFromForwardRet(fwdRet, upPct, downPct)
    if (!actual) continue

    const key = comboKey(trendOn, momOn, highVol)
    samples.push({
      date: dates[i],
      idx: i,
      forwardDate: dates[fwdEnd],
      close: closes[i],
      sma,
      momRet: mom,
      annVol: vol,
      volThr,
      trendOn,
      momOn,
      highVol,
      combo: key,
      comboLabel: comboLabel(key),
      forwardRet: fwdRet,
      actual,
      actualLabel: REGIME_LABELS[actual],
    })
  }

  // 全樣本描述統計
  const unconditional = countRegimes(samples.map((s) => s.actual))
  const comboStats = buildComboStats(samples)

  // Walk-forward：每個樣本只用「更早」的樣本估機率，預測 = 該組合歷史眾數（無歷史則用當時無條件眾數）
  const walk = walkForwardPredict(samples)
  const baseline = walkForwardAlwaysMajority(samples)

  const current =
    samples.length > 0
      ? {
          ...samples[samples.length - 1],
          // 用截至最後可標籤樣本之前的全歷史估機率（最後一筆若已有 forward 則含自己）
          probs: probsFromPrior(samples, samples.length - 1),
        }
      : null

  // 最新可算特徵日（可能尚無 forward 標籤）— 給「現在狀態」用
  const latestSignal = buildLatestSignal({
    closes,
    dates,
    dailyVol,
    smaPeriod,
    momWindow,
    volWindow,
    volLookbackDays,
    volPercentile,
    samples,
  })

  return {
    params: {
      smaPeriod,
      momWindow,
      volWindow,
      volLookbackDays,
      volPercentile,
      forwardDays,
      upPct,
      downPct,
    },
    sampleCount: samples.length,
    dateRange:
      samples.length > 0
        ? { from: samples[0].date, to: samples[samples.length - 1].date }
        : null,
    unconditional,
    comboStats,
    walkForward: walk,
    baselineAlwaysMajority: baseline,
    liftPp: +(walk.accuracyPct - baseline.accuracyPct).toFixed(2),
    samples,
    current,
    latestSignal,
  }
}

function countRegimes(labels) {
  const c = { [REGIME_UP]: 0, [REGIME_SIDE]: 0, [REGIME_DOWN]: 0 }
  for (const x of labels) c[x]++
  const total = labels.length || 1
  return {
    total: labels.length,
    counts: c,
    pct: {
      [REGIME_UP]: +((c[REGIME_UP] / total) * 100).toFixed(2),
      [REGIME_SIDE]: +((c[REGIME_SIDE] / total) * 100).toFixed(2),
      [REGIME_DOWN]: +((c[REGIME_DOWN] / total) * 100).toFixed(2),
    },
    majority: majorityOf(c),
  }
}

function majorityOf(counts) {
  let best = REGIME_SIDE
  let bestN = -1
  for (const k of [REGIME_UP, REGIME_SIDE, REGIME_DOWN]) {
    if (counts[k] > bestN) {
      bestN = counts[k]
      best = k
    }
  }
  return best
}

function buildComboStats(samples) {
  const map = new Map()
  for (const s of samples) {
    if (!map.has(s.combo)) {
      map.set(s.combo, {
        combo: s.combo,
        comboLabel: s.comboLabel,
        n: 0,
        counts: { [REGIME_UP]: 0, [REGIME_SIDE]: 0, [REGIME_DOWN]: 0 },
      })
    }
    const row = map.get(s.combo)
    row.n++
    row.counts[s.actual]++
  }
  return [...map.values()]
    .map((row) => {
      const total = row.n || 1
      const pct = {
        [REGIME_UP]: +((row.counts[REGIME_UP] / total) * 100).toFixed(1),
        [REGIME_SIDE]: +((row.counts[REGIME_SIDE] / total) * 100).toFixed(1),
        [REGIME_DOWN]: +((row.counts[REGIME_DOWN] / total) * 100).toFixed(1),
      }
      return {
        ...row,
        pct,
        mode: majorityOf(row.counts),
        modeLabel: REGIME_LABELS[majorityOf(row.counts)],
      }
    })
    .sort((a, b) => b.n - a.n)
}

function probsFromPrior(samples, i) {
  const prior = samples.slice(0, i)
  const same = prior.filter((s) => s.combo === samples[i].combo)
  const base = countRegimes(prior.map((s) => s.actual))
  if (same.length === 0) {
    return {
      source: 'unconditional',
      n: prior.length,
      ...base,
      predicted: base.majority,
    }
  }
  const c = countRegimes(same.map((s) => s.actual))
  return {
    source: 'combo',
    n: same.length,
    ...c,
    predicted: c.majority,
  }
}

function walkForwardPredict(samples) {
  let hit = 0
  const preds = []
  const conf = {
    [REGIME_UP]: { [REGIME_UP]: 0, [REGIME_SIDE]: 0, [REGIME_DOWN]: 0 },
    [REGIME_SIDE]: { [REGIME_UP]: 0, [REGIME_SIDE]: 0, [REGIME_DOWN]: 0 },
    [REGIME_DOWN]: { [REGIME_UP]: 0, [REGIME_SIDE]: 0, [REGIME_DOWN]: 0 },
  }
  // 需要至少 warmStart 筆歷史才開始評分
  const warmStart = 24
  for (let i = 0; i < samples.length; i++) {
    if (i < warmStart) continue
    const p = probsFromPrior(samples, i)
    const predicted = p.predicted
    const actual = samples[i].actual
    if (predicted === actual) hit++
    conf[actual][predicted]++
    preds.push({
      date: samples[i].date,
      combo: samples[i].combo,
      actual,
      predicted,
      hit: predicted === actual,
      priorN: p.n,
      source: p.source,
    })
  }
  const scored = preds.length || 1
  const byClass = {}
  for (const k of [REGIME_UP, REGIME_SIDE, REGIME_DOWN]) {
    const row = conf[k]
    const tot = row[REGIME_UP] + row[REGIME_SIDE] + row[REGIME_DOWN]
    byClass[k] = {
      n: tot,
      hit: row[k],
      accuracyPct: tot ? +((row[k] / tot) * 100).toFixed(2) : null,
    }
  }
  return {
    warmStart,
    scored: preds.length,
    hits: hit,
    accuracyPct: +((hit / scored) * 100).toFixed(2),
    confusion: conf,
    byClass,
    predictions: preds,
  }
}

function walkForwardAlwaysMajority(samples) {
  let hit = 0
  const warmStart = 24
  let scored = 0
  for (let i = warmStart; i < samples.length; i++) {
    const prior = samples.slice(0, i)
    const maj = countRegimes(prior.map((s) => s.actual)).majority
    scored++
    if (maj === samples[i].actual) hit++
  }
  return {
    warmStart,
    scored,
    hits: hit,
    accuracyPct: scored ? +((hit / scored) * 100).toFixed(2) : 0,
  }
}

function buildLatestSignal({
  closes,
  dates,
  dailyVol,
  smaPeriod,
  momWindow,
  volLookbackDays,
  volPercentile,
  samples,
}) {
  const i = closes.length - 1
  if (i < 0) return null
  const sma = smaAt(closes, i, smaPeriod)
  const mom = retOver(closes, i, momWindow)
  const vol = dailyVol[i]
  if (sma == null || mom == null || vol == null) return null

  const volHist = []
  const histStart = Math.max(20, i - volLookbackDays + 1)
  for (let j = histStart; j <= i; j++) {
    if (dailyVol[j] != null) volHist.push(dailyVol[j])
  }
  if (volHist.length < 60) return null
  volHist.sort((a, b) => a - b)
  const volThr = percentile(volHist, volPercentile)

  const trendOn = closes[i] > sma
  const momOn = mom > 0
  const highVol = vol >= volThr
  const key = comboKey(trendOn, momOn, highVol)

  // 用全部已標籤樣本估機率
  const same = samples.filter((s) => s.combo === key)
  const stats =
    same.length > 0
      ? countRegimes(same.map((s) => s.actual))
      : countRegimes(samples.map((s) => s.actual))

  return {
    date: dates[i],
    close: closes[i],
    sma,
    momRet: mom,
    annVol: vol,
    volThr,
    trendOn,
    momOn,
    highVol,
    combo: key,
    comboLabel: comboLabel(key),
    sampleN: same.length,
    probs: stats,
    predicted: stats.majority,
    predictedLabel: REGIME_LABELS[stats.majority],
  }
}
