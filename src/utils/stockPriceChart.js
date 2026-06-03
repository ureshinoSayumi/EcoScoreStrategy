const SMA_PERIOD = 20

/**
 * 從 Supabase 查詢區間內日線（自動分頁）
 */
export async function fetchStockDailyPrices(supabase, { stockId, startDate, endDate }) {
  const allRows = []
  const pageSize = 1000
  let from = 0

  while (true) {
    let q = supabase
      .from('stock_daily_prices')
      .select('trade_date, open_price, high_price, low_price, close_price, volume')
      .eq('stock_id', stockId)
      .order('trade_date', { ascending: true })
      .range(from, from + pageSize - 1)

    if (startDate) q = q.gte('trade_date', startDate)
    if (endDate) q = q.lte('trade_date', endDate)

    const { data, error } = await q
    if (error) throw error

    const batch = data ?? []
    allRows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  return allRows
}

/**
 * 依收盤價計算 SMA（前 period-1 日為 null）
 */
export function calcSmaSeries(closes, period = SMA_PERIOD) {
  return closes.map((_, i) => {
    if (i < period - 1) return null
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += closes[j]
    return +(sum / period).toFixed(4)
  })
}

/**
 * 組 ECharts option：K 線 + SMA20
 */
export function buildStockChartOption(rows, stockId) {
  const dates = rows.map((r) => r.trade_date)
  const ohlc = rows.map((r) => [
    Number(r.open_price),
    Number(r.close_price),
    Number(r.low_price),
    Number(r.high_price),
  ])
  const closes = rows.map((r) => Number(r.close_price))
  const sma20 = calcSmaSeries(closes, SMA_PERIOD)

  return {
    title: {
      text: `${stockId} 日線走勢`,
      left: 'center',
    },
    legend: {
      data: ['K線', 'SMA20'],
      top: 28,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    grid: {
      left: '8%',
      right: '4%',
      bottom: '12%',
      top: 72,
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: true,
      axisLine: { onZero: false },
      splitLine: { show: false },
    },
    yAxis: {
      scale: true,
      splitArea: { show: true },
    },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { show: true, type: 'slider', top: '90%', start: 0, end: 100 },
    ],
    series: [
      {
        name: 'K線',
        type: 'candlestick',
        data: ohlc,
        itemStyle: {
          color: '#ef5350',
          color0: '#26a69a',
          borderColor: '#ef5350',
          borderColor0: '#26a69a',
        },
      },
      {
        name: 'SMA20',
        type: 'line',
        data: sma20,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: '#f6a623' },
      },
    ],
  }
}
