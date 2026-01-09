<template>
  <el-container>
    <el-main>
      <el-row :gutter="20">
        <el-col>
          <input type="file" accept=".csv" multiple @change="testSMA200" />
          <el-button type="primary" @click="monteCarloSimulation">蒙地卡羅模擬</el-button>
          <el-form-item label="SMA">
            <el-input-number v-model="SMA" :min="0" size="small" />
          </el-form-item>
          <el-form-item label="連續站上日">
            <el-input-number v-model="enterSensitive" :min="0" size="small" />
          </el-form-item>
          <el-form-item label="連續跌破日">
            <el-input-number v-model="exitSensitive" :min="0" size="small" />
          </el-form-item>
          <el-form-item label="站上SMA200%">
            <el-input-number v-model="buyBand" :min="0" size="small" />
          </el-form-item>
          <el-form-item label="跌破SMA200%">
            <el-input-number v-model="sellBand" :min="0" size="small" />
          </el-form-item>
          <el-form-item label="手續費">
            <el-input-number v-model="fee" :min="0" :step="0.1" size="small" />
          </el-form-item>
          <el-form-item label="檔案名稱">
             <el-text>{{ fileNames.join(',') }}</el-text>
           </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card shadow="hover" style="max-width: 480px">
            <el-space direction="vertical" alignment="flex-start">
              <el-text>SMA: {{ SMA }}</el-text>
              <el-text>總報酬: {{ smaTotalReturn }}</el-text>
              <el-text>區間最大回徹: {{ smaMaxDrawdownValue }}％</el-text>
              <el-text>年度平均報酬率: {{ smaAnnualReturn }}％</el-text>
              <el-text>年度中位數報酬率: {{ smaMedianAnnualReturn }}％</el-text>
              <el-text>最差年度報酬率: {{ smaWorstAnnualReturn }}％</el-text>
              <el-text>最佳年度報酬率: {{ smaBestAnnualReturn }}％</el-text>
              <el-text>交易筆數: {{ smaRotationsNumber }}</el-text>
            </el-space>
            <template #footer>
              <el-space direction="vertical" alignment="flex-start">
                <el-text v-for="item in smaAnnualReturnLog" :key="item.year">{{ item.year }} : {{ item.return }}％</el-text>
              </el-space>
            </template>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" style="max-width: 480px">
            <el-space direction="vertical" alignment="flex-start">
              <el-text>Buy & Hold</el-text>
              <el-text>總報酬: {{ bhTotalReturn }}</el-text>
              <el-text>區間最大回徹: {{ bhMaxDrawdownValue }}％</el-text>
              <el-text>年度平均報酬率: {{ bhAnnualReturn }}％</el-text>
              <el-text>年度中位數報酬率: {{ bhMedianAnnualReturn }}％</el-text>
              <el-text>最差年度報酬率: {{ bhWorstAnnualReturn }}％</el-text>
              <el-text>最佳年度報酬率: {{ bhBestAnnualReturn }}％</el-text>
              <el-text>交易筆數: {{  }}</el-text>
            </el-space>
            <template #footer>
              <el-space direction="vertical" alignment="flex-start">
                <el-text v-for="item in bhAnnualReturnLog" :key="item.year">{{ item.year }} : {{ item.return }}％</el-text>
              </el-space>
            </template>
          </el-card>
        </el-col>
      </el-row>

      <!-- 表格 -->
      <el-table
        v-if="false"
        :data="tableData"
        style="margin-top: 20px"
        height="600"
        border
      >
        <el-table-column prop="name" label="商品名稱" sortable />
        <el-table-column prop="name" label="商品名稱" sortable />
        <el-table-column prop="code" label="商品代碼" sortable />
        <el-table-column prop="index" label="序號" sortable />
        <el-table-column prop="buyDay" label="進場時間" sortable />
        <el-table-column prop="buyPrice" label="進場價格" sortable />
        <el-table-column prop="buyDirection" label="進場方向" />
        <el-table-column prop="sellDay" label="出場時間" sortable />
        <el-table-column prop="sellPrice" label="出場價格" sortable />
        <el-table-column prop="sellDirection" label="出場方向" />
        <el-table-column prop="days" label="持有區間" sortable />
        <el-table-column prop="return" label="報酬率" sortable>
          <template #default="scope">
            {{ (Number(scope.row.return) * 100).toFixed(2) }}%
          </template>
        </el-table-column>
        <el-table-column prop="note" label="訊息" />

      </el-table>

       <!-- 模擬資金報酬曲線 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom" style="width: 1500px; height: 600px"></div>
      </div>
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom2" style="width: 1500px; height: 600px"></div>
      </div>
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom3" style="width: 1500px; height: 600px"></div>
      </div>
    </el-main>
  </el-container>
</template>
<script lang="ts" setup>
import { parseCSV } from '@/utils/csvReader';
import * as echarts from 'echarts';
import { onMounted, ref } from 'vue';


const SMA = ref(200)
const myChartDom = ref()
const myChartDom2 = ref()
const myChartDom3 = ref()
const tableData = ref([]) // 交易資料
const fileNames = ref([]) // 檔案名稱

const enterSensitive = ref(1) // 連續站上日
const exitSensitive = ref(1) // 連續跌破日
const buyBand = ref(0.00) // 買入band
const sellBand = ref(0.00) // 賣出band
const fee = ref(0.00) // 手續費

// SMA 策略統計
const smaTotalReturn = ref('') // 總報酬率
const smaMaxDrawdownValue = ref() // 區間最大回徹
const smaAnnualReturn = ref(0) // 年度平均報酬率
const smaMedianAnnualReturn = ref() // 年度中位數報酬率
const smaWorstAnnualReturn = ref() // 最差年度報酬率
const smaBestAnnualReturn = ref() // 最佳年度報酬率
const smaAnnualReturnLog = ref([]) // 年度報酬率紀錄
const smaRotationsNumber = ref() // 輪動次數

// Buy & Hold 策略
const bhTotalReturn = ref('') // 總報酬率
const bhMaxDrawdownValue = ref() // 區間最大回徹
const bhAnnualReturn = ref(0) // 年度平均報酬率
const bhMedianAnnualReturn = ref() // 年度中位數報酬率
const bhWorstAnnualReturn = ref() // 最差年度報酬率
const bhBestAnnualReturn = ref() // 最佳年度報酬率
const bhAnnualReturnLog = ref([]) // 年度報酬率紀錄

/************************************************
 * 主函式：同時計算 Buy&Hold + SMA 策略
 ************************************************/
const backtest = (
  rawBars,
  initialCapital = 1000000,
  window = 200,
  enterSensitive = 1,
  exitSensitive = 1,
  buyBand = 0.00,
  sellBand = 0.00,
  fee = 0.00,
) =>  {
  const bh = backtestBuyAndHold(rawBars, initialCapital);
  const sma = backtestSMA(rawBars, window, initialCapital, enterSensitive, exitSensitive, buyBand, sellBand, fee);

  /************************************************
   * 通用：績效統計
   ************************************************/
  function calcStats(equityCurve, rets) {
    const startEquity = equityCurve[0].equity;
    const endEquity = equityCurve[equityCurve.length - 1].equity;
    const totalReturn = endEquity / startEquity - 1;

    const tradingDays = equityCurve.length;
    const years = tradingDays / 252;

    const cagr = Math.pow(1 + totalReturn, 1 / years) - 1;

    // 最大回撤
    let maxEquity = equityCurve[0].equity;
    let maxDrawdown = 0;
    for (const pt of equityCurve) {
      if (pt.equity > maxEquity) maxEquity = pt.equity;
      const dd = pt.equity / maxEquity - 1;
      if (dd < maxDrawdown) maxDrawdown = dd;
    }

    // 年化波動率
    const valid = rets.slice(1);
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    const variance = valid.reduce((s, r) => s + (r - mean) ** 2, 0) / (valid.length - 1 || 1);
    const dailyVol = Math.sqrt(variance);
    const annualVol = dailyVol * Math.sqrt(252);

    // 計算每一年的年化報酬率%數，格式為{ year: 2020, return: 10 }
    function calcAnnualReturns(equityCurve) {
      // equityCurve: [{date, equity}...]
      const byYear = {};

      for (const pt of equityCurve) {
        const d = pt.date instanceof Date ? pt.date : new Date(pt.date);
        const year = d.getFullYear();
        if (!byYear[year]) {
          byYear[year] = { startEquity: pt.equity, endEquity: pt.equity, first: d, last: d };
        }
        if (d < byYear[year].first) {
          byYear[year].first = d;
          byYear[year].startEquity = pt.equity;
        }
        if (d > byYear[year].last) {
          byYear[year].last = d;
          byYear[year].endEquity = pt.equity;
        }
      }

      // 年化計算（按該年份的實際天數做）也可以只算單年單純報酬率
      const annualReturns = [];
      for (const yearStr of Object.keys(byYear).sort()) {
        const year = Number(yearStr);
        const y = byYear[year];
        // 這裡假設每年完整，計算單純報酬率，不年化
        const ret = y.endEquity / y.startEquity - 1;
        annualReturns.push({ year, return: +(ret * 100).toFixed(2) });
      }
      return annualReturns;
    }


    return {
      startEquity,
      endEquity,
      totalReturnPercent: `${(totalReturn * 100).toFixed(2)}%`,
      cagr,
      maxDrawdown,
      annualVol,
      tradingDays,
      annualReturns: calcAnnualReturns(equityCurve),
    };
  }


  /************************************************
   * 策略1：Buy & Hold（從頭買到尾）
   ************************************************/
  function backtestBuyAndHold(rawBars, initialCapital = 1000000) {
    const bars = [...rawBars]
      .map(r => ({
        date: new Date(r.Date),
        date2: r.Date,
        close: Number(r.Close),
      }))
      .sort((a, b) => a.date - b.date);

    let equity = initialCapital;
    const equityCurve = [];
    const rets = [];

    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const prev = i > 0 ? bars[i - 1] : null;

      let ret = 0;
      if (prev) ret = bar.close / prev.close - 1;

      equity *= (1 + ret);

      equityCurve.push({ date: bar.date, date2: bar.date2, equity });
      rets.push(ret);
    }

    return {
      equityCurve,
      stats: calcStats(equityCurve, rets),
    };
  }


  /************************************************
   * 策略2：SMA window 站上就持有、跌破就空手
   * 參數
   * - rawBars: 原始資料
   * - window: SMA窗口
   * - initialCapital: 初始資金
   * - enterSensitive: 連續站上日
   * - exitSensitive: 連續跌破日
   * - buyBand: 站上SMA200% band
   * - sellBand: 跌破SMA200% band
   * - fee: 手續費
   * 回傳值
   * - equityCurve: 資金曲線
   * - stats: 績效統計
   * - tradeCount: 交易次數
   ************************************************/
  function backtestSMA(
    rawBars,
    window = 200,
    initialCapital = 1000000,
    enterSensitive = 1,
    exitSensitive = 1,
    buyBand = 0.00,
    sellBand = 0.00,
    fee = 0.00,
  ) {
    const bars = [...rawBars]
      .map(r => ({
        date: new Date(r.Date),
        date2: r.Date,
        close: Number(r.Close),
      }))
      .sort((a, b) => a.date - b.date);

    const n = bars.length;
    if (n < window + 1) {
      console.log(`資料太短，需要至少 ${window + 1} 根`);
      return;
    }

    // 計算 SMA
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += bars[i].close;
      if (i >= window) sum -= bars[i - window].close;
      bars[i].sma = i >= window - 1 ? sum / window : null;
    }
    console.log('bars', bars);

    // 回測
    let equity = initialCapital;
    let position = 0; // 0: 空手 1: 持有
    const equityCurve = [];
    const rets = [];
    let tradeCount = 0;

    let aboveCount = 0; // 連續站上計數
    let belowCount = 0; // 連續跌破計數

    let retLog = 0
    for (let i = 0; i < n; i++) {
      const bar = bars[i];
      const prev = i > 0 ? bars[i - 1] : null;

      // 今日報酬（昨收 → 今收）
      let ret = 0;
      if (prev) ret = bar.close / prev.close - 1;

      retLog = ret;

      // 用昨天的 position 吃今天的報酬
      equity *= (1 + ret * position);

      equityCurve.push({
        date: bar.date,
        date2: bar.date2,
        equity,
        position,
      });

      rets.push(ret * position);

      // 用今天收盤決定「明天」持倉
      const sma = bar.sma;
      let nextPos = position;

      if (sma === null) {
        aboveCount = 0;
        nextPos = 0; // 一定空手
      } else {
        // 更新連續站上 / 跌破計數
        // 與 SMA 的相對偏離比例，例如 0.03 代表高於 3%
        const relDiff = (bar.close - sma) / sma;

        if (relDiff > (buyBand / 100)) {
          aboveCount++;
          belowCount = 0;
        } else if (relDiff < -(sellBand / 100)) {
          belowCount++;
          aboveCount = 0;
        } else {
          // 嚴格相等時兩邊都歸零（你也可以改成站上不歸零，看你策略定義）
          aboveCount = 0;
          belowCount = 0;
        }

        if (position === 1) {
          // 已持有：連續跌破 exitSensitive 天才出場
          if (belowCount >= exitSensitive) {
            nextPos = 0;
          }
        } else {
          // 原本沒持股：連續站上 enterSensitive 天才進場
          if (aboveCount >= enterSensitive) {
            nextPos = 1;
          }
        }

        // 補充：如果非滿足 entry，持續持有 aboveCount，但不進場
        if (position === 0 && aboveCount < enterSensitive) {
          nextPos = 0;
        }
      }

      // 每次交易產生時，報酬扣掉0.3％手續費
      if (nextPos !== position) {
        tradeCount++;
        console.log("bar.date2", {
          date: bar.date,
          date2: bar.date2,
          equity,
          position,
        });
        equity *= 1 - (fee / 100); // 扣掉手續費
      }

      position = nextPos;
    }

    return {
      equityCurve,
      stats: calcStats(equityCurve, rets),
      tradeCount,
    };
  }

  return {
    buyAndHold: bh.stats,
    smaStrategy: sma.stats,
    tradeCount: sma.tradeCount,
    bhCurve: bh.equityCurve,
    smaCurve: sma.equityCurve,
  };
}


const testSMA200 = async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return
  }
  const data = await parseCSV(file);
  console.log('CSV資料:', data);

  // data: 原始資料
  // 1000000: 初始資金
  // SMA.value: SMA窗口
  // enterSensitive.value: 連續站上日
  // exitSensitive.value: 連續跌破日
  // buyBand.value: 站上SMA200% band
  // sellBand.value: 跌破SMA200% band
  // fee.value: 手續費
  backtestSMA200(data);
  test(data, SMA.value)

}

const backtestSMA200 = (data) => {
  const result = backtest(data, 1000000, SMA.value, enterSensitive.value, exitSensitive.value, buyBand.value, sellBand.value, fee.value);


  console.log("Buy & Hold :", result.buyAndHold);
  console.log("SMA 策略：", result.smaStrategy);
  console.log("交易次數：", result.tradeCount);
  console.log("bhCurve", result.bhCurve);
  console.log("smaCurve", result.smaCurve);

  // SMA 策略
  smaTotalReturn.value = result.smaStrategy.totalReturnPercent; // 總報酬率
  smaMaxDrawdownValue.value = result.smaStrategy.maxDrawdown; // 區間最大回徹
  smaAnnualReturn.value = result.smaStrategy.cagr; // 年度平均報酬率
  smaAnnualReturnLog.value = result.smaStrategy.annualReturns; // 年度報酬率紀錄
  smaRotationsNumber.value = result.tradeCount; // 輪動次數
  smaWorstAnnualReturn.value = result.smaStrategy.annualReturns.reduce((min, item) => item.return < min ? item.return : min, 0); // 最差年度報酬率
  smaBestAnnualReturn.value = result.smaStrategy.annualReturns.reduce((max, item) => item.return > max ? item.return : max, 0); // 最佳年度報酬率
  smaMedianAnnualReturn.value = result.smaStrategy.annualReturns.reduce((median, item) => { return median + item.return }, 0) / result.smaStrategy.annualReturns.length; // 年度中位數報酬率

  // Buy & Hold 策略
  bhTotalReturn.value = result.buyAndHold.totalReturnPercent; // 總報酬率
  bhMaxDrawdownValue.value = result.buyAndHold.maxDrawdown; // 區間最大回徹
  bhAnnualReturn.value = result.buyAndHold.cagr; // 年度平均報酬率
  bhAnnualReturnLog.value = result.buyAndHold.annualReturns; // 年度報酬率紀錄
  bhWorstAnnualReturn.value = result.buyAndHold.annualReturns.reduce((min, item) => item.return < min ? item.return : min, 0); // 最差年度報酬率
  bhBestAnnualReturn.value = result.buyAndHold.annualReturns.reduce((max, item) => item.return > max ? item.return : max, 0); // 最佳年度報酬率
  bhMedianAnnualReturn.value = result.buyAndHold.annualReturns.reduce((median, item) => { return median + item.return }, 0) / result.buyAndHold.annualReturns.length; // 年度中位數報酬率

  // 輸出圖表
  buildChart(result.bhCurve, result.smaCurve);
}

const test = (data, window) => {
   const bars = [...data]
      .map(r => ({
        date: new Date(r.Date),
        date2: r.Date,
        close: Number(r.Close),
      }))
      .sort((a, b) => a.date - b.date);
   // 計算 SMA

  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= window) sum -= bars[i - window].close;
    bars[i].sma = i >= window - 1 ? sum / window : null;
    bars[i].diffPercent = ((bars[i].close - bars[i].sma) / bars[i].sma) * 100;

  }
  console.log('testbars', bars);

  const distribution = bars.reduce((acc, item) => {
  if (item.diffPercent == null || item.diffPercent === Infinity ) return acc;

    const bucket = Math.trunc(item.diffPercent); // 去小數

    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});

  console.log(distribution);

  const histogramData = Object.entries(distribution)
  .map(([value, count]) => ({
    value: Number(value),
    count
  }))
  .sort((a, b) => a.value - b.value);

  console.log('histogramData', histogramData);

  const chart = echarts.init(myChartDom3.value)
  chart.setOption({
    title: { text: '報酬率分布圖' },
    tooltip: { trigger: 'item' },
    xAxis: {
      type: 'category',
      name: '報酬區間',
      data: histogramData.map(h => h.value),
      axisLabel: { rotate: 45 }
    },
    yAxis: { type: 'value', name: '筆數' },
    series: [{ type: 'bar', data: histogramData.map(h => h.count), name: '出現次數' }]
  })



}

const buildChart = (bhCurve, smaCurve) => {
  // 輸出圖表
  // 計算 netAsset（市值 = 現金 + 成本，這裡.value)
  const chart = echarts.init(myChartDom.value)

  chart.setOption({
    title: { text: '資金 / 持倉成本 / 資產走勢圖' },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const i = params[0].dataIndex
        const d = bhCurve[i]
        const s = smaCurve[i]
        return `
          日期：${d.date2}<br/>
          單筆持有：$${d.equity}<br/>
          200 SMA：$${s.equity}<br/>
        `
      }
    },
    legend: {
      data: ['單筆持有', '200 SMA']
    },
    xAxis: {
      type: 'category',
      data: bhCurve.map(h => h.date2),
      axisLabel: { rotate: 45 }
    },
    yAxis: {
      type: 'value',
      name: '金額（元）'
    },
    series: [
      {
        name: '單筆持有',
        type: 'line',
        data: bhCurve.map(h => parseFloat(h.equity))
      },
      {
        name: '200 SMA',
        type: 'line',
        data: smaCurve.map(h => parseFloat(h.equity))
      }
    ]
  })
}

const buildChart2 = (bhCurve) => {
  // 輸出圖表
  // 計算 netAsset（市值 = 現金 + 成本，這裡.value)
  const chart = echarts.init(myChartDom2.value)

  chart.setOption({
    title: { text: '資金 / 持倉成本 / 資產走勢圖' },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const i = params[0].dataIndex
        const d = bhCurve[i]
        return `
          日期：${d.Date}<br/>
          股價：${d.Close}<br/>
        `
      }
    },
    legend: {
      data: ['股價']
    },
    xAxis: {
      type: 'category',
      data: bhCurve.map(h => h.Date),
      axisLabel: { rotate: 45 }
    },
    yAxis: {
      type: 'value',
      name: '金額（元）'
    },
    series: [
      {
        name: '股價',
        type: 'line',
        data: bhCurve.map(h => parseFloat(h.Close))
      },
    ]
  })
}

// 蒙地卡羅模擬
const monteCarloSimulation = () => {
  // 參數設定
  const days = 4884;               // 總交易日
  const annualReturn = 0.10;       // 目標年化報酬
  const tradingDaysPerYear = 240; // 每年交易天數
  const dailyVolatility = 0.01;
  const simulations = 1000;        // 要產生多少條模擬路徑（你可調成 10000）

  const annualExpenseRates = {
      prototype: 0.002,
      leverage2x: 0.0095,
      leverage3x: 0.0099,
  };

  const dailyExpenseRates = {
      prototype: annualExpenseRates.prototype / tradingDaysPerYear,
      leverage2x: annualExpenseRates.leverage2x / tradingDaysPerYear,
      leverage3x: annualExpenseRates.leverage3x / tradingDaysPerYear,
  };

  const dailyReturnTarget = Math.pow(1 + annualReturn, 1 / tradingDaysPerYear) - 1;


  /***********************************************
   * 2. 用你的格式產生一條 K 線模擬路徑
   ***********************************************/
  function randn_bm() {
      let u = Math.random();
      let v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function simulateBars(multiplier = 1, dailyExpense = 0, startDateStr = "2000-01-01") {
      let bars = [];
      let price = 100;

      const startDate = new Date(startDateStr);

      for (let i = 0; i < days; i++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);

          const open = price;

          // 產生隨機報酬
          const randomShock = randn_bm() * dailyVolatility;
          const dailyChange = dailyReturnTarget + randomShock;
          const actualChange = dailyChange * multiplier - dailyExpense;

          const close = open * (1 + actualChange);

          // 造 High/Low
          const shock = Math.abs(randn_bm()) * dailyVolatility;
          const baseHigh = Math.max(open, close);
          const baseLow = Math.min(open, close);

          const high = baseHigh * (1 + shock / 2);
          const low = baseLow * (1 - shock / 2);

          bars.push({
              Date: date.toISOString().slice(0, 10),
              Open: open.toFixed(6),
              High: high.toFixed(6),
              Low: low.toFixed(6),
              Close: close.toFixed(6),
          });

          price = close;
      }

      return bars;
  }


  /***********************************************
   * 3. 跑 N 條路徑，全部丟進 backtest
   ***********************************************/
  function runSimulationBatch(simCount, multiplier, dailyExpense, backtestOptions) {
      const results = [];

      for (let i = 0; i < simCount; i++) {
          const bars = simulateBars(multiplier, dailyExpense, "2000-01-01");

          // 直接使用你的 backtest（不修改）
          const out = backtest(
              bars,
              backtestOptions.initialCapital,
              backtestOptions.window,
              backtestOptions.enterSensitive,
              backtestOptions.exitSensitive,
              backtestOptions.buyBand,
              backtestOptions.sellBand,
              backtestOptions.fee
          );

          results.push({
            buyAndHold: out.buyAndHold,
            smaStrategy: out.smaStrategy,
            smaCurve: out.smaCurve,
            bhCurve: out.bhCurve
          });   // 只記錄 SMA 策略結果（你可改成記錄多種）
      }

      return results;
  }


  /***********************************************
   * 4. 蒙地卡羅統計（平均 / 中位數 / 5% / 95%）
   ***********************************************/
  function summarizeMC(results) {
    const extract = (field) => results.map(r => r[field]);

    // CAGR / MDD
    const cagrList = extract("cagr").sort((a, b) => a - b);
    const mddList = extract("maxDrawdown").sort((a, b) => a - b);

    // totalReturn = end/start - 1
    const totalReturnList = results
      .map(r => (r.endEquity / r.startEquity - 1))
      .sort((a, b) => a - b);

    const percentile = (arr, p) => arr[Math.floor(arr.length * p)];

    const pct = (x) => x * 100; // 轉百分比

    return {
      count: results.length,

      // --- CAGR (百分比)
      avgCAGR: pct(cagrList.reduce((s, x) => s + x, 0) / cagrList.length),
      medianCAGR: pct(percentile(cagrList, 0.50)),
      cagrWorst5: pct(percentile(cagrList, 0.05)),
      cagrBest5: pct(percentile(cagrList, 0.95)),

      // --- MDD (百分比，注意 MDD 是負值)
      avgMDD: pct(mddList.reduce((s, x) => s + x, 0) / mddList.length),
      mddWorst5: pct(percentile(mddList, 0.95)),

      // --- 總報酬（百分比）
      avgTotalReturn: pct(totalReturnList.reduce((s, x) => s + x, 0) / totalReturnList.length),
      medianTotalReturn: pct(percentile(totalReturnList, 0.50)),
      bestTotalReturn: pct(totalReturnList[totalReturnList.length - 1]),
      worstTotalReturn: pct(totalReturnList[0]),
    };
  }



  /***********************************************
   * 5. 執行：例如用 200 日均線策略
   ***********************************************/
  const results = runSimulationBatch(simulations, 2, dailyExpenseRates.leverage2x, {
      initialCapital: 1000000,
      window: 200,
      enterSensitive: 1,
      exitSensitive: 1,
      buyBand: 0.0,
      sellBand: 0.0,
      fee: 0.0,
  });

  const summary = summarizeMC(results.map(r => r.buyAndHold));
  console.log("模擬回測統計：", summary.count);
  console.log("模擬回測統計：平均年化報酬率", summary.avgCAGR);
  console.log("模擬回測統計：中位數年化報酬率", summary.medianCAGR);
  console.log("模擬回測統計：最差年化報酬率", summary.cagrWorst5);
  console.log("模擬回測統計：最佳年化報酬率", summary.cagrBest5);
  console.log("模擬回測統計：平均最大回撤", summary.avgMDD);
  console.log("模擬回測統計：最差最大回撤", summary.mddWorst5);
  console.log("模擬回測統計：平均總報酬率", summary.avgTotalReturn);
  console.log("模擬回測統計：中位數總報酬率", summary.medianTotalReturn);
  console.log("模擬回測統計：最差總報酬率", summary.worstTotalReturn);
  console.log("模擬回測統計：最佳總報酬率", summary.bestTotalReturn);

  const summarySMA = summarizeMC(results.map(r => r.smaStrategy));
  console.log("模擬回測統計 SMA：", summarySMA.count);
  console.log("模擬回測統計 SMA：平均年化報酬率", summarySMA.avgCAGR);
  console.log("模擬回測統計 SMA：中位數年化報酬率", summarySMA.medianCAGR);
  console.log("模擬回測統計 SMA：最差年化報酬率", summarySMA.cagrWorst5);
  console.log("模擬回測統計 SMA：最佳年化報酬率", summarySMA.cagrBest5);
  console.log("模擬回測統計 SMA：平均最大回撤", summarySMA.avgMDD);
  console.log("模擬回測統計 SMA：最差最大回撤", summarySMA.mddWorst5);
  console.log("模擬回測統計 SMA：平均總報酬率", summarySMA.avgTotalReturn);
  console.log("模擬回測統計 SMA：中位數總報酬率", summarySMA.medianTotalReturn);
  console.log("模擬回測統計 SMA：最差總報酬率", summarySMA.worstTotalReturn);
  console.log("模擬回測統計 SMA：最佳總報酬率", summarySMA.bestTotalReturn);

  console.log("results", results);
  // 輸出圖表
  // 計算 netAsset（市值 = 現金 + 成本，這裡.value)

  // 輸出圖表
  // 計算 netAsset（市值 = 現金 + 成本，這裡.value)
  const chart = echarts.init(myChartDom.value)

  let series = []

  results.forEach(r => {
    series.push({
      name: '200 SMA',
      type: 'line',
      data: r.smaCurve.map(h => parseFloat(h.equity))
    })
    series.push({
      name: '單筆持有',
      type: 'line',
      data: r.bhCurve.map(h => parseFloat(h.equity))
    })
  })
  chart.setOption({
    title: { text: '資金 / 持倉成本 / 資產走勢圖' },
    tooltip: {
      trigger: 'axis',
      // formatter: (params) => {
      //   const i = params[0].dataIndex
      //   const r = results[i]
      //   console.log("params", params);
      //   return `
      //     日期：${r.smaCurve.date2}<br/>
      //     單筆持有：$${r.bhCurve[i].equity}<br/>
      //     200 SMA：$${r.smaCurve[i].equity}<br/>
      //   `
      // }
    },
    legend: {
      data: ['200 SMA', '單筆持有']
    },
    xAxis: {
      type: 'category',
      data: results[0].smaCurve.map(h => h.date2),
      axisLabel: { rotate: 45 }
    },
    yAxis: {
      type: 'value',
      name: '金額（元）'
    },
    series: series
  })


}


onMounted(() => {
  // buildECharts()
})
</script>
<style scoped>
:deep(.el-table .warning-row) {
  background-color: rgb(252.5, 245.7, 235.5);
}
</style>
