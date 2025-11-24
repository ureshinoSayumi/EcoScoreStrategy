<template>
  <el-container>
    <el-main>
      <el-row :gutter="20">
        <el-col>
          <input type="file" accept=".csv" multiple @change="testSMA200" />
          <el-form-item label="SMA">
            <el-input-number v-model="SMA" :min="0" size="small" />
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
    </el-main>
  </el-container>
</template>
<script lang="ts" setup>
import { parseCSV } from '@/utils/csvReader';
import * as echarts from 'echarts';
import { onMounted, ref } from 'vue';


const SMA = ref(200)
const myChartDom = ref()
const tableData = ref([]) // 交易資料
const fileNames = ref([]) // 檔案名稱

// SMA 策略
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
const backtest = (rawBars, initialCapital = 1000000, window = 200) =>  {
  const bh = backtestBuyAndHold(rawBars, initialCapital);
  const sma = backtestSMA(rawBars, window, initialCapital);

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
   ************************************************/
  function backtestSMA(rawBars, window = 200, initialCapital = 1000000) {
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

    // 回測
    let equity = initialCapital;
    let position = 0; // 0: 空手 1: 持有
    const equityCurve = [];
    const rets = [];
    let tradeCount = 0;

    let aboveCount = 0; // 連續站上計數
    let entryCount = 1; // 連續站上日

    for (let i = 0; i < n; i++) {
      const bar = bars[i];
      const prev = i > 0 ? bars[i - 1] : null;

      // 今日報酬（昨收 → 今收）
      let ret = 0;
      if (prev) ret = bar.close / prev.close - 1;

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
        // 站上 -> 增加 aboveCount
        if (bar.close > sma) {
          aboveCount++;
        } else {
          aboveCount = 0;
        }

        if (position === 1) {
          // 已持有，今日一旦跌破就馬上空手
          if (bar.close < sma) {
            nextPos = 0;
          }
        } else {
          // 原本沒持股，現在連續站上 SMA X 天才進場
          if (aboveCount >= entryCount) {
            nextPos = 1;
          }
        }

        // 補充：如果非滿足 entry，持續持有 aboveCount，但不進場
        if (position === 0 && aboveCount < entryCount) {
          nextPos = 0;
        }
      }

      if (nextPos !== position) tradeCount++;

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

  const result = backtest(data, 1000000, SMA.value);


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


onMounted(() => {
  // buildECharts()
})
</script>
<style scoped>
:deep(.el-table .warning-row) {
  background-color: rgb(252.5, 245.7, 235.5);
}
</style>
