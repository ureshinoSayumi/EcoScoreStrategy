<template>
  <el-container>
    <el-main>
      <el-row :gutter="20">
        <el-col>
          <input type="file" accept=".csv" multiple @change="handleFile" />
          <el-form-item label="檔案名稱">
             <el-text>{{ fileNames.join(',') }}</el-text>
           </el-form-item>
           <el-form-item label="是否重複進場">
             <el-switch v-model="isRepeat" />
           </el-form-item>
           <el-form-item label="持有限制">
             <el-input-number v-model="stocksPerRound" :min="0" size="small" />
           </el-form-item>
           <el-form-item label="持有天數">
             <el-input-number v-model="holdDays" :min="0" size="small" />
           </el-form-item>
           <el-form-item label="輸出圖表">
             <el-switch v-model="outputChart" />
           </el-form-item>
           <el-form-item label="蒙地卡羅模擬">
             <el-switch v-model="monteCarloTest" />
           </el-form-item>
           <el-form-item label="多策略比較">
             <el-switch v-model="multiStrategyTest" />
           </el-form-item>
          <el-button type="primary" :disabled="multiStrategyTest" @click="dataAnalysisSingle(tableData)"> 單策略分析 </el-button>
          <el-button type="primary" :disabled="!multiStrategyTest"  @click="dataAnalysisMulti()"> 多策略分析 </el-button>
          <el-button type="primary" :disabled="!multiStrategyTest"  @click="dataAnalysisMulti2()"> 多策略分析2 </el-button>
          <el-button type="primary" :disabled="!multiStrategyTest"  @click="dataAnalysisMultiSummary()"> 多策略綜合計算 </el-button>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card shadow="hover" style="max-width: 480px">
            <el-space direction="vertical" alignment="flex-start">
              <el-text>平均報酬: {{ averageReturn }}％</el-text>
              <el-text>交易筆數: {{ multiStrategyTest ? tableDataMulti.length : tableData.length }}</el-text>
              <el-text>平均賺賠比: {{ profitLossRatio }}</el-text>
              <el-text>報酬率中位數: {{ medianReturn }}</el-text>
              <el-text>勝率: {{ winRate }}</el-text>


            </el-space>
            <template #footer>
              <el-space direction="vertical" alignment="flex-start">
                <el-text>總報酬: {{ totalReturn }}</el-text>
                <el-text>區間最大回徹: {{ maxDrawdownValue }}％</el-text>
                <el-text>年度平均報酬率: {{ annualReturn }}％</el-text>
                <el-text>年度中位數報酬率: {{ medianAnnualReturn }}％</el-text>
                <el-text>最差年度報酬率: {{ worstAnnualReturn }}％</el-text>
                <el-text>最佳年度報酬率: {{ bestAnnualReturn }}％</el-text>
                <el-text>輪動次數: {{ rotationsNumber }}</el-text>
                <el-text v-for="item in annualReturnLog" :key="item.year">{{ item.year }} : {{ item.return }}％</el-text>
              </el-space>
            </template>
          </el-card>
        </el-col>
      </el-row>

      <!-- 報酬率分佈圖 -->
      <!-- 統計報酬％數區間分布 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom" style="width: 1500px; height: 600px"></div>
      </div>

      <!-- 每月交易次數分布 -->
      <!-- 以每月為單位，統計整段時間軸的報酬區間 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom2" style="width: 1500px; height: 600px"></div>
      </div>

      <!-- 交易日期報酬分布 -->
      <!-- 統計1～31號買入報酬分布 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom3" style="width: 1500px; height: 600px"></div>
      </div>

      <!-- 交易月報酬分布 -->
      <!-- 統計1～12月買入報酬分布 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom6" style="width: 1500px; height: 600px"></div>
      </div>

       <!-- 交易月最高最低期報酬分布 -->
      <!-- 統計1～12月買入報酬分布 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom7" style="width: 1500px; height: 600px"></div>
      </div>





      <!-- 每年報酬 -->
      <!-- 一年會單位統計滾動績效 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom4" style="width: 1500px; height: 600px"></div>
      </div>

      <!-- 模擬資金報酬曲線 -->
      <div style="width: 100%; overflow-x: scroll">
        <div ref="myChartDom8" style="width: 1500px; height: 600px"></div>
      </div>

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
    </el-main>
  </el-container>
</template>
<script lang="ts" setup>
import { parseCSV } from '@/utils/csvReader';
import { businessSignals } from '@/utils/data/businessSignals.js'; // 景氣指標
import * as echarts from 'echarts';
import { onMounted, reactive, ref } from 'vue';
import { calculateSimulationResult, runMonteCarlo } from './utils/monteCarloMethod';

// 輸出報表
const total = reactive({
  averageCompensation: 0
})
const tableData = ref([]) // 交易資料
const tableDataMulti = ref([]) // 多策略交易資料
const chart = ref()
const myChartDom = ref() // 報酬率分佈圖
const myChartDom2 = ref() // 每月交易次數分布
const myChartDom3 = ref() // 交易日期報酬分布
const myChartDom4 = ref() // 每年報酬
const myChartDom6 = ref() // 第四張圖表容器
const myChartDom7 = ref() // 第四張圖表容器
const myChartDom8 = ref() // 第四張圖表容器
const isRepeat = ref(true) // 是否重複進場
const stocksPerRound = ref(10) // 持有限制
const holdDays = ref(60) // 持有天數
const totalReturn = ref('') // 總報酬率
const maxDrawdownValue = ref() // 區間最大回徹
const annualReturn = ref(0) // 年度平均報酬率
const medianAnnualReturn = ref() // 年度中位數報酬率
const worstAnnualReturn = ref() // 最差年度報酬率
const bestAnnualReturn = ref() // 最佳年度報酬率
const annualReturnLog = ref([]) // 年度報酬率紀錄
const rotationsNumber = ref() // 輪動次數
const fileNames = ref([]) // 檔案名稱
const monteCarloTest = ref(false) // 蒙地卡羅模擬測試
const outputChart = ref(true) // 是否輸出圖表
const multiStrategyTest = ref(false) // 多策略比較

const averageReturn = ref(0) // 平均報酬率
const profitLossRatio = ref(0) // 平均賺賠比
const medianReturn = ref(0) // 報酬率中位數
const winRate = ref(0) // 勝率

const reset = () => {
  myChartDom.value = null
  myChartDom2.value = null
  tableData.value = []
}



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
  function backtestBuyAndHold(rawBars, initialCapital = 1_000_000) {
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
const averageReturnComputed = ((data) => {
  if (data.length === 0) return 0

  const total = data.reduce((sum, item) => {
    const r = parseFloat(item.return)
    return isNaN(r) ? sum : sum + r
  }, 0)

  return (total / data.length) * 100 // 乘 100 為百分比
})
// 平均賺賠比
const profitLossRatioComputed = ((data) => {
  const returns = data
    .map(i => parseFloat(i.return))
    .filter(r => !isNaN(r))

  const profits = returns.filter(r => r > 0)
  const losses = returns.filter(r => r < 0)

  const avgProfit = profits.reduce((a, b) => a + b, 0) / (profits.length || 1)

  const avgLoss = losses.reduce((a, b) => a + b, 0) / (losses.length || 1)

  if (avgLoss === 0) return Infinity // 沒虧損交易，賺賠比無限大
  return avgProfit / Math.abs(avgLoss)
})
// 報酬率中位數
const medianReturnComputed = ((data) => {
  const returns = data
    .map(item => parseFloat(item.return))
    .filter(r => !isNaN(r)) // 過濾無效數值
    .sort((a, b) => a - b)  // 由小到大排序

  const len = returns.length
  if (len === 0) return 0

  if (len % 2 === 1) {
    // 奇數筆：回傳中間那筆
    return returns[Math.floor(len / 2)] * 100
  } else {
    // 偶數筆：取中間兩筆平均
    const mid1 = returns[len / 2 - 1]
    const mid2 = returns[len / 2]
    return ((mid1 + mid2) / 2) * 100
  }
})
// 勝率
const winRateComputed = ((data) => {
  const returns = data
    .map(i => parseFloat(i.return))
    .filter(r => !isNaN(r))

  if (returns.length === 0) return 0

  const winCount = returns.filter(r => r > 0).length
  return (winCount / returns.length) * 100
})

const handleFile = async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return
  }
  const data = await parseCSV(file);
  console.log('CSV資料:', data);
  const formatterData = data.map(item => {
    return {
        name: item["商品名稱"],
        code: item["商品代碼"],
        index: item["序號"],
        buyDay: item["進場時間"],
        buyPrice: item["進場價格"],
        buyDirection: item["進場方向"],
        sellDay: item["出場時間"],
        sellPrice: item["出場價格"],
        sellDirection: item["出場方向"],
        days: item["持有區間"],
        return: item["報酬率"],
        note: item["訊息"],
        // sell: item // 若你仍要保留完整原始資料
      }
  })

  if (multiStrategyTest.value) {
    tableDataMulti.value.push(formatterData)
    fileNames.value.push(file.name)

  } else {
    fileNames.value.push(file.name)
    document.title = file.name; // 修改網頁標籤的標題
    tableData.value =  formatterData

  }
  console.log('tableDataMulti', tableDataMulti.value)
}

// 單策略分析
const dataAnalysisSingle = (data) => {
    // 資金總報酬率
    const { finalReturn, maxDrawdown, history, mean, median, worst, best, annualReturnsLog } = calculateSimulationResult(data, 10000, stocksPerRound.value, isRepeat.value)
    totalReturn.value = finalReturn // 總報酬率
    maxDrawdownValue.value = maxDrawdown // 區間最大回徹
    rotationsNumber.value = history.length // 輪動次數
    annualReturn.value = mean // 年度平均報酬率
    medianAnnualReturn.value = median // 年度中位數報酬率
    worstAnnualReturn.value = worst // 最差年度報酬率
    bestAnnualReturn.value = best // 最佳年度報酬率
    annualReturnLog.value = annualReturnsLog // 年度報酬率紀錄

    averageReturn.value = averageReturnComputed(data) // 平均報酬率
    profitLossRatio.value = profitLossRatioComputed(data) // 平均賺賠比
    medianReturn.value = medianReturnComputed(data) // 報酬率中位數
    winRate.value = winRateComputed(data) // 勝率

    // 輸出圖表
    if (outputChart.value) {
      buildChart1(data) // 報酬率分佈圖
      buildChart2(data) // 每月交易次數分布
      buildChart3(data) // 交易日期報酬分布
      buildChart4(data) // 每年報酬
      buildChart6(data) // 交易月報酬分布
      buildChart7(data) // 交易月最高最低期報酬分布
      buildChart0(history) // 資金 / 持倉成本 / 資產走勢圖
    }
    // 蒙地卡羅模擬測試
    if (monteCarloTest.value) {
      runMonteCarlo(tableData.value, 100, 10000, stocksPerRound.value)
    }
}

// 多策略綜合計算
const dataAnalysisMultiSummary = () => {
  const data = []
  tableDataMulti.value.forEach(item => {
    item.forEach(item2 => {
      data.push(item2)
    })
  })
  console.log('data', data)
  dataAnalysisSingle(data)
  if (monteCarloTest.value) {
    runMonteCarlo(data, 100, 10000, stocksPerRound.value)
  }

}

// 多策略分析 分析全部重疊
const dataAnalysisMulti = () => {

  // console.log(findFullOverlaps([arr, arr2, arr3], ['策略A','策略B','策略C'])); // []

  const result = findFullOverlaps(tableDataMulti.value, fileNames.value)
  dataAnalysisSingle(result)

  console.log('result', result)

  function toDate(s) {
    return new Date(s.replace(/-/g, '/'));
  }
  function fmt(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${da}`;
  }

  function mergeIntervals(intervals) {
    if (intervals.length === 0) return [];
    const sorted = intervals
      .map(iv => ({ start: toDate(iv.buyDay), end: toDate(iv.sellDay) }))
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      const cur = sorted[i];
      if (cur.start <= last.end) {
        last.end = new Date(Math.max(+last.end, +cur.end));
      } else {
        merged.push(cur);
      }
    }
    return merged;
  }

  function intersectIntervalLists(a, b) {
    const res = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      const s = new Date(Math.max(+a[i].start, +b[j].start));
      const e = new Date(Math.min(+a[i].end, +b[j].end));
      if (s <= e) res.push({ start: s, end: e });
      if (a[i].end < b[j].end) i++; else j++;
    }
    return res;
  }

  function findFullOverlaps(strategyLists, strategyNames) {
    const N = strategyLists.length;
    if (!strategyNames || strategyNames.length !== N) {
      strategyNames = Array.from({ length: N }, (_, i) => `strategy_${i + 1}`);
    }

    const perStrategyMap = strategyLists.map(list => {
      const map = new Map();
      for (const rec of list) {
        if (!map.has(rec.name)) map.set(rec.name, []);
        map.get(rec.name).push({ buyDay: rec.buyDay, sellDay: rec.sellDay, rec });
      }
      for (const [nm, intervals] of map) {
        map.set(nm, mergeIntervals(intervals));
      }
      return map;
    });

    const namesInAll = (() => {
      const sets = perStrategyMap.map(m => new Set(m.keys()));
      const base = sets[0];
      const res = [];
      for (const nm of base) {
        if (sets.every(s => s.has(nm))) res.push(nm);
      }
      return res;
    })();

    const result = [];
    for (const nm of namesInAll) {
      let inter = perStrategyMap[0].get(nm);
      for (let k = 1; k < N && inter.length > 0; k++) {
        inter = intersectIntervalLists(inter, perStrategyMap[k].get(nm));
      }
      for (const seg of inter) {
        // 這裡用「第一個策略裡的原始物件」當基底，只是多一個 overlapStrategies 欄位
        const sample = strategyLists[0].find(r => r.name === nm);
        result.push({
          ...sample,
          buyDay: fmt(seg.start),
          sellDay: fmt(seg.end),
          overlapStrategies: [...strategyNames]
        });
      }
    }

    return result;
  }

}
// 多策略分析2 分析只重疊兩個策略
const dataAnalysisMulti2 = () => {
  const result = findAnyPairOverlaps(tableDataMulti.value, fileNames.value)
  console.log('result', result)
  dataAnalysisSingle(result)
  // 蒙地卡羅
  if (monteCarloTest.value) {
    runMonteCarlo(result, 100, 10000, stocksPerRound.value)
  }
  const { pairwiseCounts, overlapRatios } = analyzeOverlap(result);
  console.log('pairwiseCounts', pairwiseCounts)
  console.log('overlapRatios', overlapRatios)
  function toDate(s) {
    return new Date(s.replace(/-/g, '/'));
  }
  function fmt(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${da}`;
  }

  // 合併同策略內的重疊區間（僅用於時間運算，不動原始物件）
  function mergeIntervals(intervals) {
    if (intervals.length === 0) return [];
    const sorted = intervals
      .map(iv => ({ start: toDate(iv.buyDay), end: toDate(iv.sellDay) }))
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      const cur = sorted[i];
      if (cur.start <= last.end) {
        last.end = new Date(Math.max(+last.end, +cur.end));
      } else {
        merged.push(cur);
      }
    }
    return merged;
  }

  // 兩組(已合併)區間列表交集
  function intersectIntervalLists(a, b) {
    const res = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      const s = new Date(Math.max(+a[i].start, +b[j].start));
      const e = new Date(Math.min(+a[i].end, +b[j].end));
      if (s <= e) res.push({ start: s, end: e });
      if (a[i].end < b[j].end) i++; else j++;
    }
    return res;
  }

  // 檢查某策略的(已合併)區間列表是否與某段 seg 存在重疊
  function hasOverlapWithSeg(intervals, seg) {
    // 二分或線性皆可，這裡用線性簡潔
    for (const iv of intervals) {
      const s = new Date(Math.max(+iv.start, +seg.start));
      const e = new Date(Math.min(+iv.end, +seg.end));
      if (s <= e) return true;
    }
    return false;
  }

  // 取得某策略中某個 name 的任意原始物件，作為輸出基底
  function pickSampleRecord(strategyList, name) {
    return strategyList.find(r => r.name === name);
  }

  function findAnyPairOverlaps(strategyLists, strategyNames) {
    const N = strategyLists.length;
    if (!strategyNames || strategyNames.length !== N) {
      strategyNames = Array.from({ length: N }, (_, i) => `strategy_${i + 1}`);
    }

    // 每策略：依 name 分組，並生成已合併的時間區間（僅時間，方便交集）
    const perStrategyMap = strategyLists.map(list => {
      const byName = new Map();
      for (const rec of list) {
        if (!byName.has(rec.name)) byName.set(rec.name, []);
        byName.get(rec.name).push(rec);
      }
      const mergedByName = new Map();
      for (const [nm, records] of byName) {
        mergedByName.set(nm, mergeIntervals(records));
      }
      return { raw: list, mergedByName };
    });

    // 所有曾出現在至少一個策略的名稱集合
    const allNames = new Set();
    for (const { mergedByName } of perStrategyMap) {
      for (const nm of mergedByName.keys()) allNames.add(nm);
    }

    const seen = new Set(); // 去重：key = name|buyDay|sellDay|sortedStrategies
    const result = [];

    for (const nm of allNames) {
      // 找出具有此 name 的策略索引
      const carriers = [];
      for (let i = 0; i < N; i++) {
        if (perStrategyMap[i].mergedByName.has(nm)) carriers.push(i);
      }
      if (carriers.length < 2) continue; // 至少要兩個策略含此 name

      // 對所有 pair 做交集，得到 pair 的重疊區間
      for (let a = 0; a < carriers.length; a++) {
        for (let b = a + 1; b < carriers.length; b++) {
          const i = carriers[a], j = carriers[b];
          const interSegs = intersectIntervalLists(
            perStrategyMap[i].mergedByName.get(nm),
            perStrategyMap[j].mergedByName.get(nm)
          );
          if (interSegs.length === 0) continue;

          for (const seg of interSegs) {
            // 擴充：把與 seg 有重疊的其他策略也列入 overlapStrategies（但條件仍為「至少兩個」）
            const overlappers = new Set([i, j]);
            for (let k = 0; k < N; k++) {
              if (k === i || k === j) continue;
              const list = perStrategyMap[k].mergedByName.get(nm);
              if (!list) continue;
              if (hasOverlapWithSeg(list, seg)) overlappers.add(k);
            }

            // 產出一筆輸出。基底物件取 overlappers 中索引最小的那個策略的原始紀錄
            const sortedIdx = [...overlappers].sort((x, y) => x - y);
            const baseIdx = sortedIdx[0];
            const baseRec = pickSampleRecord(strategyLists[baseIdx], nm);
            if (!baseRec) continue; // 理論上不會

            const out = {
              ...baseRec, // 完整原欄位
              buyDay: fmt(seg.start), // 改成重疊期間
              sellDay: fmt(seg.end),
              overlapStrategies: sortedIdx.map(idx => strategyNames[idx]),
            };

            const key = [
              nm,
              out.buyDay,
              out.sellDay,
              out.overlapStrategies.join(',')
            ].join('|');

            if (!seen.has(key)) {
              seen.add(key);
              result.push(out);
            }
          }
        }
      }
    }
    const getDate = (str) => new Date(str.replaceAll('/', '-'))
    return result.sort((a, b) => getDate(a.buyDay) - getDate(b.buyDay));
  }

}

const analyzeOverlap = (result) => {
  function toDate(s) { return new Date(String(s).replace(/-/g, '/')); }
  function dayDiffInclusive(a, b) {
    return Math.floor((toDate(b) - toDate(a)) / 86400000) + 1;
  }
  function mergeIntervalsRaw(ivList) {
    if (!ivList || ivList.length === 0) return [];
    const arr = ivList
      .map(({ buyDay, sellDay }) => ({ start: toDate(buyDay), end: toDate(sellDay) }))
      .sort((x, y) => x.start - y.start || x.end - y.end);
    const out = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
      const last = out[out.length - 1];
      const cur = arr[i];
      if (cur.start <= last.end) {
        if (cur.end > last.end) last.end = cur.end;
      } else {
        out.push(cur);
      }
    }
    return out.map(iv => ({
      buyDay: iv.start.toISOString().slice(0,10).replace(/-/g,'/'),
      sellDay: iv.end.toISOString().slice(0,10).replace(/-/g,'/')
    }));
  }
  function sumDays(intervals) {
    let total = 0;
    for (const iv of intervals) total += dayDiffInclusive(iv.buyDay, iv.sellDay);
    return total;
  }
  function pairs(arr) {
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) out.push([arr[i], arr[j]]);
    }
    return out;
  }

  // 找出所有策略名稱
  const strategySet = new Set();
  for (const row of result) {
    for (const s of (row.overlapStrategies || [])) strategySet.add(s);
  }
  const strategies = [...strategySet];

  // 1) 策略兩兩重疊次數
  const countMap = new Map();
  for (const s of strategies) countMap.set(s, {});
  for (const row of result) {
    const set = Array.from(new Set(row.overlapStrategies || []));
    for (const [a, b] of pairs(set)) {
      countMap.get(a)[b] = (countMap.get(a)[b] || 0) + 1;
      countMap.get(b)[a] = (countMap.get(b)[a] || 0) + 1;
    }
  }
  const pairwiseCounts = strategies.map((name) => {
    const m = countMap.get(name);
    let best = { name: null, count: 0 };
    for (const [other, c] of Object.entries(m)) {
      if (c > best.count) best = { name: other, count: c };
    }
    return { name, '重疊': m, mostOverlapWith: best };
  });

  // 2) 每個策略的重疊天數
  const overlappedSegmentsByStrategy = new Map();
  for (const s of strategies) overlappedSegmentsByStrategy.set(s, []);
  for (const row of result) {
    const iv = { buyDay: row.buyDay, sellDay: row.sellDay };
    for (const s of (row.overlapStrategies || [])) {
      overlappedSegmentsByStrategy.get(s).push(iv);
    }
  }
  const overlapRatios = strategies.map((name) => {
    const mergedOverlap = mergeIntervalsRaw(overlappedSegmentsByStrategy.get(name));
    const overlapDays = sumDays(mergedOverlap);
    return { name, overlapDays };
  });

  return { pairwiseCounts, overlapRatios };
}

const buildChart0 = (history) => {

  // 輸出圖表
  // 計算 netAsset（市值 = 現金 + 成本，這裡不含未實現盈虧，純成本）
  const chart = echarts.init(myChartDom8.value)

  chart.setOption({
    title: { text: '資金 / 持倉成本 / 資產走勢圖' },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const i = params[0].dataIndex
        const d = history[i]
        return `
          日期：${d.buyDay}<br/>
          現金：$${d.capital}<br/>
          總資產（估算）：$${parseFloat(d.netAsset)}<br/>
          報酬率: ${d.returnRate}%
        `
      }
    },
    legend: {
      data: ['現金', '總資產']
    },
    xAxis: {
      type: 'category',
      data: history.map(h => h.buyDay),
      axisLabel: { rotate: 45 }
    },
    yAxis: {
      type: 'value',
      name: '金額（元）'
    },
    series: [
      {
        name: '現金',
        type: 'line',
        data: history.map(h => parseFloat(h.capital))
      },
      {
        name: '總資產',
        type: 'line',
        data: history.map(h => parseFloat(h.netAsset))
      }
    ]
  })
}

// 報酬率分佈圖
const buildChart1 = (data) => {
  const returns = data.map(i => parseFloat(i.return)).filter(r => !isNaN(r)).map(r => r * 100)
  const binWidth = 5
  const min = Math.floor(Math.min(...returns) / binWidth) * binWidth
  const max = Math.ceil(Math.max(...returns) / binWidth) * binWidth

  const labels = []
  const bins = []
  for (let i = min; i < max; i += binWidth) {
    const from = i, to = i + binWidth
    labels.push(`${from}~${to}%`)
    bins.push(returns.filter(r => r >= from && r < to).length)
  }

  if (!myChartDom.value) return
  chart.value = echarts.init(myChartDom.value)
  chart.value.setOption({
    title: { text: '報酬率分布圖' },
    tooltip: { trigger: 'item' },
    xAxis: {
      type: 'category',
      name: '報酬區間',
      data: labels,
      axisLabel: { rotate: 45 }
    },
    yAxis: { type: 'value', name: '筆數' },
    series: [{ type: 'bar', data: bins, name: '出現次數' }]
  })
}
// 交易月分布
const buildChart2 = (data) => {
  const monthlyStats = {}

  data.forEach(item => {
    const month = item.buyDay?.slice(0, 7).replace('/', '-') // 'YYYY-MM'
    const r = parseFloat(item.return)
    if (!month || isNaN(r)) return

    if (!monthlyStats[month]) {
      monthlyStats[month] = []
    }
    monthlyStats[month].push(r * 100) // 轉為百分比
  })

  const sortedMonths = Object.keys(monthlyStats).sort()

  const avgReturns = []
  const medianReturns = []
  const winRates = []
  const counts = []
  const scores = []

  for (const month of sortedMonths) {
    const list = monthlyStats[month]
    const n = list.length
    const win = list.filter(r => r > 0).length

    const avg = list.reduce((a, b) => a + b, 0) / n
    const sorted = [...list].sort((a, b) => a - b)
    const median = n % 2 === 1
      ? sorted[Math.floor(n / 2)]
      : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    const winRate = (win / n) * 100

    avgReturns.push(avg.toFixed(2))
    medianReturns.push(median.toFixed(2))
    winRates.push(winRate.toFixed(2))
    counts.push(n)

    // 加入外部 businessSignals 的 data2 分數
    const scoreObj = businessSignals.find(d => d.date === month)
    scores.push(scoreObj ? scoreObj.data2 : null)
  }

  if (!myChartDom2.value) return

  const chart = echarts.init(myChartDom2.value)
  chart.setOption({
    title: { text: '每月交易統計圖表' },
    tooltip: {
      trigger: 'axis',
      formatter: function (params) {
        const i = params[0].dataIndex
        return `
          月份：${sortedMonths[i]}<br/>
          筆數：${counts[i]}<br/>
          平均報酬：${avgReturns[i]}%<br/>
          中位報酬：${medianReturns[i]}%<br/>
          勝率：${winRates[i]}%<br/>
          景氣分數：${scores[i] ?? 'N/A'}
        `
      }
    },
    legend: { data: ['平均報酬', '中位報酬', '勝率', '交易筆數', '景氣分數'] },
    xAxis: {
      type: 'category',
      data: sortedMonths,
      name: '交易月份',
      axisLabel: { rotate: 45 }
    },
    yAxis: [
      {
        type: 'value',
        name: '百分比 / 筆數',
      },
      // {
      //   type: 'value',
      //   name: '分數',
      //   position: 'right',
      //   offset: 60
      // }
    ],
    series: [
      { name: '平均報酬', type: 'line', data: avgReturns },
      { name: '中位報酬', type: 'line', data: medianReturns },
      { name: '勝率', type: 'line', data: winRates },
      { name: '交易筆數', type: 'bar', data: counts },
      { name: '景氣分數', type: 'line', data: scores }
    ]
  })
}
// 交易日分布
const buildChart3 = (data) => {
  const dayStats = {}

  // 初始化 1～31 號
  for (let d = 1; d <= 31; d++) {
    dayStats[d] = []
  }

  // 分類進入各日期
  data.forEach(item => {
    const day = Number(item.buyDay?.split('/')?.[2])
    const r = parseFloat(item.return)
    if (!isNaN(day) && day >= 1 && day <= 31 && !isNaN(r)) {
      dayStats[day].push(r * 100) // % 單位
    }
  })

  const days = []
  const avgReturns = []
  const medianReturns = []
  const winRates = []
  const counts = []

  for (let d = 1; d <= 31; d++) {
    const returns = dayStats[d]
    const n = returns.length
    const wins = returns.filter(r => r > 0).length

    const avg = n ? (returns.reduce((a, b) => a + b, 0) / n) : 0
    const sorted = [...returns].sort((a, b) => a - b)
    const median = n
      ? (n % 2 === 1
        ? sorted[Math.floor(n / 2)]
        : (sorted[n / 2 - 1] + sorted[n / 2]) / 2)
      : 0
    const winRate = n ? (wins / n) * 100 : 0

    days.push(d.toString())
    avgReturns.push(avg.toFixed(2))
    medianReturns.push(median.toFixed(2))
    winRates.push(winRate.toFixed(2))
    counts.push(n)
  }

  // 繪圖
  if (!myChartDom3.value) return
  const chart = echarts.init(myChartDom3.value)
  chart.setOption({
    title: { text: '每月各日期交易統計' },
    tooltip: {
      trigger: 'axis',
      formatter: function (params) {
        const i = params[0].dataIndex
        return `
          日期：${days[i]} 號<br/>
          筆數：${counts[i]}<br/>
          平均報酬：${avgReturns[i]}%<br/>
          中位數報酬：${medianReturns[i]}%<br/>
          勝率：${winRates[i]}%
        `
      }
    },
    legend: { data: ['平均報酬', '中位報酬', '勝率'] },
    xAxis: {
      type: 'category',
      data: days,
      name: '進場日',
      nameLocation: 'middle',
      nameGap: 25,
    },
    yAxis: {
      type: 'value',
      name: '報酬 / 勝率（%）'
    },
    series: [
      {
        name: '平均報酬',
        type: 'line',
        data: avgReturns
      },
      {
        name: '中位報酬',
        type: 'line',
        data: medianReturns
      },
      {
        name: '勝率',
        type: 'line',
        data: winRates
      },
      // {
      //   name: '交易筆數',
      //   type: 'bar',
      //   data: counts
      // }
    ]
  })
}
// 依據每筆交易的 buyDay，統計各月份報酬
const buildChart6 = (data) => {
  const monthStats = {}

  // 初始化 1～12 月
  for (let m = 1; m <= 12; m++) {
    monthStats[m] = []
  }

  // 將報酬值分類到對應的月份
  data.forEach(item => {
    const monthStr = item.buyDay?.split('/')?.[1] // 取 MM 月份
    const month = Number(monthStr)
    const r = parseFloat(item.return)
    if (!isNaN(month) && month >= 1 && month <= 12 && !isNaN(r)) {
      monthStats[month].push(r * 100)
    }
  })

  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString())
  const avgReturns = []
  const medianReturns = []
  const winRates = []
  const counts = []

  for (let m = 1; m <= 12; m++) {
    const returns = monthStats[m]
    const n = returns.length
    const wins = returns.filter(r => r > 0).length

    const avg = n ? (returns.reduce((a, b) => a + b, 0) / n) : 0
    const sorted = [...returns].sort((a, b) => a - b)
    const median = n
      ? (n % 2 === 1
        ? sorted[Math.floor(n / 2)]
        : (sorted[n / 2 - 1] + sorted[n / 2]) / 2)
      : 0
    const winRate = n ? (wins / n) * 100 : 0

    avgReturns.push(avg.toFixed(2))
    medianReturns.push(median.toFixed(2))
    winRates.push(winRate.toFixed(2))
    counts.push(n)
  }

  // 畫圖
  const chart = echarts.init(myChartDom6.value)
  chart.setOption({
    title: { text: '每年月份進場報酬統計' },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const i = params[0].dataIndex
        return `
          月份：${months[i]} 月<br/>
          筆數：${counts[i]}<br/>
          平均報酬：${avgReturns[i]}%<br/>
          中位報酬：${medianReturns[i]}%<br/>
          勝率：${winRates[i]}%
        `
      }
    },
    legend: { data: ['平均報酬', '中位報酬', '勝率'] },
    xAxis: {
      type: 'category',
      data: months,
      name: '月份',
      nameLocation: 'middle',
      nameGap: 25
    },
    yAxis: {
      type: 'value',
      name: '報酬 / 勝率（%）'
    },
    series: [
      { name: '平均報酬', type: 'line', data: avgReturns },
      { name: '中位報酬', type: 'line', data: medianReturns },
      { name: '勝率', type: 'line', data: winRates }
    ]
  })
}
// 統計每月最高與最低報酬
const buildChart7 = (data) => {
  const monthStats = {}

  // 初始化 1～12 月
  for (let m = 1; m <= 12; m++) {
    monthStats[m] = []
  }

  // 將報酬分類到對應月份
  data.forEach(item => {
    const monthStr = item.buyDay?.split('/')?.[1] // MM 月
    const month = Number(monthStr)
    const r = parseFloat(item.return)
    if (!isNaN(month) && month >= 1 && month <= 12 && !isNaN(r)) {
      monthStats[month].push(r * 100)
    }
  })

  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString())
  const maxReturns = []
  const minReturns = []

  for (let m = 1; m <= 12; m++) {
    const returns = monthStats[m]
    if (returns.length > 0) {
      const max = Math.max(...returns)
      const min = Math.min(...returns)
      maxReturns.push(max.toFixed(2))
      minReturns.push(min.toFixed(2))
    } else {
      maxReturns.push('0')
      minReturns.push('0')
    }
  }

  const chart = echarts.init(myChartDom7.value)
  chart.setOption({
    title: { text: '每月報酬率最高與最低值' },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const i = params[0].dataIndex
        return `
          月份：${months[i]} 月<br/>
          最高報酬率：${maxReturns[i]}%<br/>
          最低報酬率：${minReturns[i]}%
        `
      }
    },
    legend: { data: ['最高報酬率', '最低報酬率'] },
    xAxis: {
      type: 'category',
      data: months,
      name: '月份',
      nameLocation: 'middle',
      nameGap: 25
    },
    yAxis: {
      type: 'value',
      name: '報酬率（%）'
    },
    series: [
      { name: '最高報酬率', type: 'line', data: maxReturns },
      { name: '最低報酬率', type: 'line', data: minReturns }
    ]
  })
}

// 統計每年滾動報酬
const buildChart4 = (data) => {
  const yearlyStats = {}

  data.forEach(item => {
    const year = item.buyDay?.slice(0, 4)
    const r = parseFloat(item.return)
    if (!year || isNaN(r)) return

    if (!yearlyStats[year]) yearlyStats[year] = []
    yearlyStats[year].push(r * 100) // 換成百分比
  })

  const years = Object.keys(yearlyStats).sort()
  const avgReturns = []
  const medianReturns = []
  const winRates = []
  const counts = []

  for (const year of years) {
    const list = yearlyStats[year]
    const n = list.length
    const win = list.filter(r => r > 0).length

    const avg = list.reduce((a, b) => a + b, 0) / n
    const sorted = [...list].sort((a, b) => a - b)
    const median = n % 2 === 1
      ? sorted[Math.floor(n / 2)]
      : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    const winRate = (win / n) * 100

    avgReturns.push(avg.toFixed(2))
    medianReturns.push(median.toFixed(2))
    winRates.push(winRate.toFixed(2))
    counts.push(n)
  }

  const chart = echarts.init(myChartDom4.value)
  chart.setOption({
    title: { text: '每年交易統計' },
    tooltip: {
      trigger: 'axis',
      formatter: function (params) {
        const i = params[0].dataIndex
        return `
          年份：${years[i]}<br/>
          筆數：${counts[i]}<br/>
          平均報酬：${avgReturns[i]}%<br/>
          中位報酬：${medianReturns[i]}%<br/>
          勝率：${winRates[i]}%
        `
      }
    },
    legend: { data: ['平均報酬', '中位報酬', '勝率', '交易筆數'] },
    xAxis: {
      type: 'category',
      data: years,
      name: '年份',
      axisLabel: { rotate: 0 }
    },
    yAxis: [
      { type: 'value', name: '百分比 / 筆數' }
    ],
    series: [
      { name: '平均報酬', type: 'line', data: avgReturns },
      { name: '中位報酬', type: 'line', data: medianReturns },
      { name: '勝率', type: 'line', data: winRates },
      { name: '交易筆數', type: 'bar', data: counts }
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
.lightText {
  color: red;
}
</style>
