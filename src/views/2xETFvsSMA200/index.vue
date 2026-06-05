<template>
  <el-container>
    <el-main>
      <el-row :gutter="20">
        <el-col>
          <input type="file" accept=".csv" multiple @change="inputFile" />
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
          <el-form-item label="DCA 初始資金">
            <el-input-number v-model="dcaInitialCapital" :min="0" :step="100" size="small" />
          </el-form-item>
          <el-form-item label="DCA 每月投入">
            <el-input-number v-model="dcaMonthlyContribution" :min="0" :step="100" size="small" />
          </el-form-item>
          <el-form-item label="檔案名稱">
             <el-text>{{ fileNames.join(',') }}</el-text>
           </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <!-- SMA 策略 -->
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


        <!-- SMA QQQ 策略 -->
        <el-col :span="6">
          <el-card shadow="hover" style="max-width: 480px">
            <el-space direction="vertical" alignment="flex-start">
              <el-text>SMA QQQ: {{ SMA }}</el-text>
              <el-text>總報酬: {{ smaQQQTotalReturn }}</el-text>
              <el-text>區間最大回徹: {{ smaQQQMaxDrawdownValue }}％</el-text>
              <el-text>年度平均報酬率: {{ smaQQQAnnualReturn }}％</el-text>
              <el-text>年度中位數報酬率: {{ smaQQQMedianAnnualReturn }}％</el-text>
              <el-text>最差年度報酬率: {{ smaQQQWorstAnnualReturn }}％</el-text>
              <el-text>最佳年度報酬率: {{ smaQQQBestAnnualReturn }}％</el-text>
              <el-text>交易筆數: {{ smaQQQRotationsNumber }}</el-text>
            </el-space>
            <template #footer>
              <el-space direction="vertical" alignment="flex-start">
                <el-text v-for="item in smaQQQAnnualReturnLog" :key="item.year">{{ item.year }} : {{ item.return }}％</el-text>
              </el-space>
            </template>
          </el-card>
        </el-col>

        <!-- Buy & Hold 策略 -->
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

        <!-- 定期定額 2X ETF + QQQ SMA200 -->
        <el-col :span="6">
          <el-card shadow="hover" style="max-width: 480px">
            <el-space direction="vertical" alignment="flex-start">
              <el-text>定期定額 2X ETF · QQQ SMA{{ SMA }}</el-text>
              <el-text>累計投入: {{ dcaTotalContributions }}</el-text>
              <el-text>期末資產: {{ dcaEndEquity }}</el-text>
              <el-text>總報酬（對投入）: {{ dcaTotalReturn }}</el-text>
              <el-text>區間最大回徹: {{ dcaMaxDrawdownValue }}％</el-text>
              <el-text>年度平均報酬率: {{ dcaAnnualReturn }}％</el-text>
              <el-text>年度中位數報酬率: {{ dcaMedianAnnualReturn }}％</el-text>
              <el-text>最差年度報酬率: {{ dcaWorstAnnualReturn }}％</el-text>
              <el-text>最佳年度報酬率: {{ dcaBestAnnualReturn }}％</el-text>
              <el-text>交易筆數: {{ dcaTradeCount }}</el-text>
            </el-space>
            <template #footer>
              <el-space direction="vertical" alignment="flex-start">
                <el-text v-for="item in dcaAnnualReturnLog" :key="item.year">{{ item.year }} : {{ item.return }}％</el-text>
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
const qqqData = ref([]) // QQQ 資料

const enterSensitive = ref(1) // 連續站上日
const exitSensitive = ref(1) // 連續跌破日
const buyBand = ref(0.00) // 買入band
const sellBand = ref(0.00) // 賣出band
const fee = ref(1.00) // 手續費
const dcaInitialCapital = ref(1000)
const dcaMonthlyContribution = ref(1000)

// SMA 策略統計
const smaTotalReturn = ref('') // 總報酬率
const smaMaxDrawdownValue = ref() // 區間最大回徹
const smaAnnualReturn = ref(0) // 年度平均報酬率
const smaMedianAnnualReturn = ref() // 年度中位數報酬率
const smaWorstAnnualReturn = ref() // 最差年度報酬率
const smaBestAnnualReturn = ref() // 最佳年度報酬率
const smaAnnualReturnLog = ref([]) // 年度報酬率紀錄
const smaRotationsNumber = ref() // 輪動次數

// SMA QQQ 策略統計
const smaQQQTotalReturn = ref('') // 總報酬率
const smaQQQMaxDrawdownValue = ref() // 區間最大回徹
const smaQQQAnnualReturn = ref(0) // 年度平均報酬率
const smaQQQMedianAnnualReturn = ref() // 年度中位數報酬率
const smaQQQWorstAnnualReturn = ref() // 最差年度報酬率
const smaQQQBestAnnualReturn = ref() // 最佳年度報酬率
const smaQQQAnnualReturnLog = ref([]) // 年度報酬率紀錄
const smaQQQRotationsNumber = ref() // 輪動次數

// Buy & Hold 策略
const bhTotalReturn = ref('') // 總報酬率
const bhMaxDrawdownValue = ref() // 區間最大回徹
const bhAnnualReturn = ref(0) // 年度平均報酬率
const bhMedianAnnualReturn = ref() // 年度中位數報酬率
const bhWorstAnnualReturn = ref() // 最差年度報酬率
const bhBestAnnualReturn = ref() // 最佳年度報酬率
const bhAnnualReturnLog = ref([]) // 年度報酬率紀錄

// 定期定額 SMA200 策略
const dcaTotalReturn = ref('')
const dcaMaxDrawdownValue = ref()
const dcaAnnualReturn = ref(0)
const dcaMedianAnnualReturn = ref()
const dcaWorstAnnualReturn = ref()
const dcaBestAnnualReturn = ref()
const dcaAnnualReturnLog = ref([])
const dcaTradeCount = ref()
const dcaTotalContributions = ref('')
const dcaEndEquity = ref('')

/************************************************
 * 主函式：同時計算 Buy&Hold + SMA 策略
 ************************************************/
const runTest = (
  rawBars,
  initialCapital = 1000000,
  window = 200,
  enterSensitive = 1,
  exitSensitive = 1,
  buyBand = 0.00,
  sellBand = 0.00,
  fee = 0.00,
  dcaInitial = 1000,
  dcaMonthly = 1000,
) =>  {
  const bh = runBuyAndHold(rawBars, initialCapital);

  // 用QLD 200SMA 當訊號來源
  const sma = runSMAQQQ(rawBars, window, initialCapital, enterSensitive, exitSensitive, buyBand, sellBand, fee);

  // 用QLD 200SMA 當訊號來源，用QQQ取代現金
  // const smaQQQ = runSMAQQQ(rawBars, window, initialCapital, enterSensitive, exitSensitive, buyBand, sellBand, fee, qqqData.value);

  // 用QQQ 200SMA 當訊號來源
  const smaQQQ = runSMAFORQQQ(rawBars, window, initialCapital, enterSensitive, exitSensitive, buyBand, sellBand, fee, qqqData.value);

  const dca = runDcaSmaQQQ(
    rawBars,
    window,
    dcaInitial,
    dcaMonthly,
    enterSensitive,
    exitSensitive,
    buyBand,
    sellBand,
    qqqData.value,
  );

  /************************************************
   * 通用：績效統計2
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

  // 策略1：Buy & Hold（從頭買到尾）
  function runBuyAndHold(rawBars, initialCapital = 1000000) {
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

  // 策略2：SMA200 站上就持有QLD、跌破就賣出，或改持有QQQ，用今天收盤決定明天持倉
  function runSMAQQQ(
    rawBars,
    window = 200,
    initialCapital = 1000000,
    enterSensitive = 1,
    exitSensitive = 1,
    buyBand = 0.00,
    sellBand = 0.00,
    fee = 0.00,
    qqqBarsRaw = [], // <<< 新增：請傳入 qqqData.value
  ) {
    // --- QLD bars（需要 Close/High/Low）---
    let tradeDays = []
    const bars = [...rawBars]
      .map(r => ({
        date: new Date(r.Date),
        date2: r.Date,
        close: Number(r.Close),
        high: Number(r.High ?? r.Close),
        low: Number(r.Low ?? r.Close),
        open: Number(r.Open ?? r.Close),
      }))
      .sort((a, b) => a.date - b.date);

    const n = bars.length;
    if (n < window + 1) {
      console.log(`資料太短，需要至少 ${window + 1} 根`);
      return;
    }

    // --- QQQ map：date2 -> {close, high, low} ---
    const qqqMap = new Map();
    if (Array.isArray(qqqBarsRaw)) {
      for (const r of qqqBarsRaw) {
        qqqMap.set(r.Date, {
          close: Number(r.Close),
          high: Number(r.High ?? r.Close),
          low: Number(r.Low ?? r.Close),
          open: Number(r.Open ?? r.Close),
        });
      }
    } else {
      console.warn("你沒有傳入 qqqBarsRaw（qqqData.value），QQQ 報酬會視為 0，且無法做 High/Low 成交懲罰");
    }

    const getQQQBar = (date2) => qqqMap.get(date2) ?? null;

    // 取某資產在當天的 close/high/low；缺資料就用 close 代替
    function getAssetBar(asset, qldBar /* bars[i] */, date2) {
      if (asset === "QLD") return qldBar;
      if (asset === "QQQ") return getQQQBar(date2);
      return null; // CASH
    }

    // --- SMA ---
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += bars[i].close;
      if (i >= window) sum -= bars[i - window].close;
      bars[i].sma = i >= window - 1 ? sum / window : null;
    }

    // --- 回測 ---
    let equity = initialCapital;
    let holding = "CASH"; // "QLD" | "QQQ" | "CASH"
    const equityCurve = [];
    const rets = [];
    let tradeCount = 0;

    let aboveCount = 0;
    let belowCount = 0;

    // 算 QQQ close-to-close ret 用
    let prevQQQClose = null;

    for (let i = 0; i < n; i++) {
      const bar = bars[i];
      const prev = i > 0 ? bars[i - 1] : null;

      // --- QLD ret ---
      let qldRet = 0;
      if (prev) qldRet = bar.close / prev.close - 1;

      // --- QQQ ret（同日期對齊）---
      const qqqBarToday = getQQQBar(bar.date2);
      let qqqRet = 0;

      if (qqqBarToday && prevQQQClose != null) {
        qqqRet = qqqBarToday.close / prevQQQClose - 1;
      } else {
        qqqRet = 0;
      }

      if (qqqBarToday && Number.isFinite(qqqBarToday.close)) {
        prevQQQClose = qqqBarToday.close;
      }

      // --- 用昨天的 holding 吃今天 close-to-close 報酬 ---
      let usedRet = 0;
      if (holding === "QLD") usedRet = qldRet;
      else if (holding === "QQQ") usedRet = qqqRet;
      else usedRet = 0;

      equity *= (1 + usedRet);

      equityCurve.push({
        date: bar.date,
        date2: bar.date2,
        equity,
        holding,
      });
      rets.push(usedRet);


      // --- 用今天收盤決定明天持倉 ---
      const sma = bar.sma;
      let nextHolding = holding;

      if (sma === null) {
          aboveCount = 0;
          belowCount = 0;
          nextHolding = "CASH";
        } else {
        const relDiff = (bar.close - sma) / sma;

          if (relDiff > (buyBand / 100)) {
            aboveCount++;
            belowCount = 0;
          } else if (relDiff < -(sellBand / 100)) {
            belowCount++;
            aboveCount = 0;
          } else {
            aboveCount = 0;
            belowCount = 0;
          }

          if (holding === "QLD") {
          if (belowCount >= exitSensitive) nextHolding = "QQQ";
          } else {
            if (aboveCount >= enterSensitive) nextHolding = "QLD";
          else nextHolding = holding === "CASH" ? "CASH" : "QQQ";
        }
      }

      // --- 換倉：賣用當日 Low、買用當日 High（極端懲罰）---
      if (nextHolding !== holding) {
        tradeCount++;
        tradeDays.push({
          // date: bar.date,
          date2: bar.date2,
          holding,
          nextHolding,
          equity,
          ...bar
        });

        // 1) 先把舊倉「以 close 計價」轉成「以 Low 賣出」
        if (holding !== "CASH") {
          const sellBar = getAssetBar(holding, bar, bar.date2);
          const sellClose = sellBar?.close;
          // const sellLow = sellBar?.low;
          const sellLow = sellBar?.close;

          if (Number.isFinite(sellClose) && Number.isFinite(sellLow) && sellClose > 0) {
            // 把「以 Close 計價的資產」調整成「以 Low 賣出的實際成交結果」Z
            equity *= (sellLow / sellClose);
          } else {
            // 缺資料就不懲罰（或你想更保守也可以直接當作 0.99 之類）
          }
        }

        // 2) 再把新倉「以 High 買入」但「用 close 計價」開始持有
        if (nextHolding !== "CASH") {
          const buyBar = getAssetBar(nextHolding, bar, bar.date2);
          const buyClose = buyBar?.close;
          // const buyHigh = buyBar?.high;
          const buyHigh = buyBar?.close;

          if (Number.isFinite(buyClose) && Number.isFinite(buyHigh) && buyHigh > 0) {
            equity *= (buyClose / buyHigh);
          } else {
            // 缺資料就不懲罰
          }
        }

        // 3) 扣手續費（你原本是每次換倉扣一次）
        equity *= 1 - (fee / 100);
      }

      holding = nextHolding;
    }

    console.log("runSMAQQQ", tradeDays);
    // analyzeSMA200OpenClose(tradeDays);
    return {
      equityCurve,
      stats: calcStats(equityCurve, rets),
      tradeCount,
    };
  }

  // 策略3：SMA200 站上就持有QLD、跌破就賣出，用QQQ 200SMA 當訊號源
  function runSMAFORQQQ(
    rawBars,
    window = 200,
    initialCapital = 1000000,
    enterSensitive = 1,
    exitSensitive = 1,
    buyBand = 0.00,
    sellBand = 0.00,
    fee = 0.00,
    qqqBarsRaw = [],
  ) {
    let tradeDays = [];

    // --- QLD bars（交易日基準）---
    const bars = [...rawBars]
      .map(r => ({
        date: new Date(r.Date),
        date2: r.Date,
        close: Number(r.Close),
        high: Number(r.High ?? r.Close),
        low: Number(r.Low ?? r.Close),
        open: Number(r.Open ?? r.Close),
      }))
      .sort((a, b) => a.date - b.date);

    const n = bars.length;
    if (n < window + 1) {
      console.log(`資料太短，需要至少 ${window + 1} 根`);
      return;
    }

    // --- QQQ map：date2 -> {close, high, low, open} ---
    const qqqMap = new Map();
    if (Array.isArray(qqqBarsRaw)) {
      for (const r of qqqBarsRaw) {
        qqqMap.set(r.Date, {
          close: Number(r.Close),
          high: Number(r.High ?? r.Close),
          low: Number(r.Low ?? r.Close),
          open: Number(r.Open ?? r.Close),
        });
      }
    } else {
      console.warn("你沒有傳入 qqqBarsRaw（qqqData.value），QQQ 報酬會視為 0，且無法做 High/Low 成交懲罰");
    }

    const getQQQBar = (date2) => qqqMap.get(date2) ?? null;

    // 取某資產在當天的 close/high/low；缺資料就回 null
    function getAssetBar(asset, qldBar /* bars[i] */, date2) {
      if (asset === "QLD") return qldBar;
      if (asset === "QQQ") return getQQQBar(date2);
      return null; // CASH
    }

    // 用 QQQ close 算 200MA（對齊 QLD 交易日）
    let qqqSum = 0;
    const qqqCloseWindow = []; // 存最近 window 天的 QQQ close（僅在該日有 QQQ 資料時推進）

    for (let i = 0; i < n; i++) {
      const date2 = bars[i].date2;
      const qqqBar = getQQQBar(date2);

      // 保守：如果 QQQ 當天沒資料，就讓 qqqSma = null
      if (!qqqBar || !Number.isFinite(qqqBar.close)) {
        bars[i].qqqSma = null;
        continue;
      }

      // 推進滑動窗
      qqqCloseWindow.push(qqqBar.close);
      qqqSum += qqqBar.close;

      if (qqqCloseWindow.length > window) {
        qqqSum -= qqqCloseWindow.shift();
      }

      bars[i].qqqSma = (qqqCloseWindow.length === window) ? (qqqSum / window) : null;
    }

    // --- 回測 ---
    let equity = initialCapital;
    let holding = "CASH"; // "QLD" | "QQQ" | "CASH"
    const equityCurve = [];
    const rets = [];
    let tradeCount = 0;

    let aboveCount = 0;
    let belowCount = 0;

    // 算 QQQ close-to-close ret 用
    let prevQQQClose = null;

    for (let i = 0; i < n; i++) {
      const bar = bars[i];
      const prev = i > 0 ? bars[i - 1] : null;

      // --- QLD ret ---
      let qldRet = 0;
      if (prev) qldRet = bar.close / prev.close - 1;

      // --- QQQ ret（同日期對齊）---
      const qqqBarToday = getQQQBar(bar.date2);
      let qqqRet = 0;

      if (qqqBarToday && prevQQQClose != null) {
        qqqRet = qqqBarToday.close / prevQQQClose - 1;
      } else {
        qqqRet = 0;
      }

      if (qqqBarToday && Number.isFinite(qqqBarToday.close)) {
        prevQQQClose = qqqBarToday.close;
      }

      // --- 用昨天的 holding 吃今天 close-to-close 報酬 ---
      let usedRet = 0;
      if (holding === "QLD") usedRet = qldRet;
      else if (holding === "QQQ") usedRet = qqqRet;
      else usedRet = 0;

      equity *= (1 + usedRet);

      equityCurve.push({
        date: bar.date,
        date2: bar.date2,
        equity,
        holding,
      });
      rets.push(usedRet);

      // 訊號來源改用 QQQ close vs QQQ SMA
      const qqqSma = bar.qqqSma;
      let nextHolding = holding;

      // 如果 SMA 不可用（通常是前 window-1 天，或該日 QQQ 缺資料）
      if (qqqSma === null) {
        aboveCount = 0;
        belowCount = 0;
        nextHolding = "CASH"; // 原本邏輯是這樣；若想「缺資料就維持持倉」，可以改成 nextHolding = holding
      } else {
        const qqqCloseToday = qqqBarToday?.close;

        if (!Number.isFinite(qqqCloseToday)) {
          // QQQ 當天缺 close：保守處理
          aboveCount = 0;
          belowCount = 0;
          nextHolding = "CASH";
        } else {
          const relDiff = (qqqCloseToday - qqqSma) / qqqSma;

          if (relDiff > (buyBand / 100)) {
            aboveCount++;
            belowCount = 0;
          } else if (relDiff < -(sellBand / 100)) {
            belowCount++;
            aboveCount = 0;
          } else {
            aboveCount = 0;
            belowCount = 0;
          }

          if (holding === "QLD") {
            if (belowCount >= exitSensitive) nextHolding = "CASH";
          } else {
            if (aboveCount >= enterSensitive) nextHolding = "QLD";
            else nextHolding = holding === "CASH" ? "CASH" : "QLD";
          }
        }
      }

      // --- 換倉：賣用當日 Low、買用當日 High（你目前先改成 close，等同不懲罰）---
      if (nextHolding !== holding) {
        tradeCount++;
        tradeDays.push({
          date2: bar.date2,
          holding,
          nextHolding,
          equity,
          ...bar,
        });

        // 1) 賣出懲罰（目前用 close）
        if (holding !== "CASH") {
          const sellBar = getAssetBar(holding, bar, bar.date2);
          const sellClose = sellBar?.close;
          const sellLow = sellBar?.close;

          if (Number.isFinite(sellClose) && Number.isFinite(sellLow) && sellClose > 0) {
            equity *= (sellLow / sellClose);
          }
        }

        // 2) 買入懲罰（目前用 close）
        if (nextHolding !== "CASH") {
          const buyBar = getAssetBar(nextHolding, bar, bar.date2);
          const buyClose = buyBar?.close;
          const buyHigh = buyBar?.close; // 你原本改成 close

          if (Number.isFinite(buyClose) && Number.isFinite(buyHigh) && buyHigh > 0) {
            equity *= (buyClose / buyHigh);
          }
        }

        // 3) fee（你原本註解掉）
        equity *= 1 - (fee / 100);
      }

      holding = nextHolding;
    }

    console.log("runSMAFORQQQ", tradeDays);
    return {
      equityCurve,
      stats: calcStats(equityCurve, rets),
      tradeCount,
    };
  }

  /**
   * 定期定額 2X ETF：QQQ SMA 訊號 + 每月首個交易日加碼，有訊號時全額投入
   */
  function runDcaSmaQQQ(
    rawBars,
    window = 200,
    initialCapital = 1000,
    monthlyContribution = 1000,
    enterSensitive = 1,
    exitSensitive = 1,
    buyBand = 0.0,
    sellBand = 0.0,
    qqqBarsRaw = [],
  ) {
    const bars = [...rawBars]
      .map((r) => ({
        date: new Date(r.Date),
        date2: r.Date,
        close: Number(r.Close),
      }))
      .sort((a, b) => a.date - b.date);

    const n = bars.length;
    if (n < window + 1) {
      console.log(`DCA 資料太短，需要至少 ${window + 1} 根`);
      return null;
    }

    const qqqMap = new Map();
    for (const r of qqqBarsRaw) {
      qqqMap.set(r.Date, {
        close: Number(r.Close),
      });
    }

    const getQQQBar = (date2) => qqqMap.get(date2) ?? null;

    let qqqSum = 0;
    const qqqCloseWindow = [];
    for (let i = 0; i < n; i++) {
      const date2 = bars[i].date2;
      const qqqBar = getQQQBar(date2);
      if (!qqqBar || !Number.isFinite(qqqBar.close)) {
        bars[i].qqqSma = null;
        continue;
      }
      qqqCloseWindow.push(qqqBar.close);
      qqqSum += qqqBar.close;
      if (qqqCloseWindow.length > window) {
        qqqSum -= qqqCloseWindow.shift();
      }
      bars[i].qqqSma =
        qqqCloseWindow.length === window ? qqqSum / window : null;
    }

    const monthKeyOf = (d) => `${d.getFullYear()}-${d.getMonth()}`;

    let cash = initialCapital;
    let shares = 0;
    let totalContributions = initialCapital;
    let tradeCount = 0;
    let aboveCount = 0;
    let belowCount = 0;
    let inMarket = false;

    const equityCurve = [];

    for (let i = 0; i < n; i++) {
      const bar = bars[i];
      const prevMonth = i > 0 ? monthKeyOf(bars[i - 1].date) : null;
      const curMonth = monthKeyOf(bar.date);

      // 每月首個交易日加碼（含資料第一個月）
      if (curMonth !== prevMonth) {
        cash += monthlyContribution;
        totalContributions += monthlyContribution;
      }

      const qqqBarToday = getQQQBar(bar.date2);
      const qqqSma = bar.qqqSma;
      let wantHold = inMarket;

      if (qqqSma == null || !qqqBarToday?.close) {
        aboveCount = 0;
        belowCount = 0;
        wantHold = false;
      } else {
        const relDiff = (qqqBarToday.close - qqqSma) / qqqSma;
        if (relDiff > buyBand / 100) {
          aboveCount += 1;
          belowCount = 0;
        } else if (relDiff < -(sellBand / 100)) {
          belowCount += 1;
          aboveCount = 0;
        } else {
          aboveCount = 0;
          belowCount = 0;
        }

        if (inMarket) {
          wantHold = belowCount < exitSensitive;
        } else {
          wantHold = aboveCount >= enterSensitive;
        }
      }

      // 跌破 → 全賣；站上 → 閒置資金全買
      if (!wantHold && shares > 0) {
        cash += shares * bar.close;
        shares = 0;
        inMarket = false;
        tradeCount += 1;
      }

      if (wantHold && cash > 0 && bar.close > 0) {
        shares += cash / bar.close;
        cash = 0;
        inMarket = true;
        tradeCount += 1;
      } else if (!wantHold) {
        inMarket = false;
      } else {
        inMarket = shares > 0;
      }

      const equity = cash + shares * bar.close;
      equityCurve.push({
        date: bar.date,
        date2: bar.date2,
        equity,
        contributions: totalContributions,
        holding: inMarket ? 'QLD' : 'CASH',
      });
    }

    return {
      equityCurve,
      stats: calcDcaStats(equityCurve),
      tradeCount,
    };
  }

  function calcAnnualReturnsFromCurve(equityCurve) {
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
    const annualReturns = [];
    for (const yearStr of Object.keys(byYear).sort()) {
      const year = Number(yearStr);
      const y = byYear[year];
      const ret = y.endEquity / y.startEquity - 1;
      annualReturns.push({ year, return: +(ret * 100).toFixed(2) });
    }
    return annualReturns;
  }

  function calcDcaStats(equityCurve) {
    const endEquity = equityCurve[equityCurve.length - 1].equity;
    const totalContributions = equityCurve[equityCurve.length - 1].contributions;
    const totalReturn = endEquity / totalContributions - 1;
    const tradingDays = equityCurve.length;
    const years = tradingDays / 252;
    const cagr = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;

    let maxEquity = equityCurve[0].equity;
    let maxDrawdown = 0;
    for (const pt of equityCurve) {
      if (pt.equity > maxEquity) maxEquity = pt.equity;
      const dd = pt.equity / maxEquity - 1;
      if (dd < maxDrawdown) maxDrawdown = dd;
    }

    const annualReturns = calcAnnualReturnsFromCurve(equityCurve);

    return {
      endEquity,
      totalContributions,
      totalReturn,
      totalReturnPercent: (totalReturn * 100).toFixed(2) + '%',
      maxDrawdown: +(maxDrawdown * 100).toFixed(2),
      cagr: +(cagr * 100).toFixed(2),
      annualReturns,
    };
  }

  return {
    buyAndHold: bh.stats,
    smaStrategy: sma.stats,
    smaQQQStrategy: smaQQQ.stats,
    tradeCount: sma.tradeCount,
    tradeCountQQQ: smaQQQ.tradeCount,
    bhCurve: bh.equityCurve,
    smaCurve: sma.equityCurve,
    smaQQQCurve: smaQQQ.equityCurve,
    dcaStrategy: dca?.stats ?? null,
    dcaCurve: dca?.equityCurve ?? [],
    dcaTradeCount: dca?.tradeCount ?? 0,
  };
}


const inputFile = async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return
  }
  const data = await parseCSV(file);
  console.log('CSV資料:', data);
  // 分析
  analyzeSMA200OpenClose(data);

  // data: 原始資料
  // 1000000: 初始資金
  // SMA.value: SMA窗口
  // enterSensitive.value: 連續站上日
  // exitSensitive.value: 連續跌破日
  // buyBand.value: 站上SMA200% band
  // sellBand.value: 跌破SMA200% band
  // fee.value: 手續費
  backtestSMA200(data);
  buildChart3(data, SMA.value)

}

const backtestSMA200 = (data) => {
  const result = runTest(
    data,
    1000000,
    SMA.value,
    enterSensitive.value,
    exitSensitive.value,
    buyBand.value,
    sellBand.value,
    fee.value,
    dcaInitialCapital.value,
    dcaMonthlyContribution.value,
  );


  console.log("Buy & Hold :", result.buyAndHold);
  console.log("SMA 策略：", result.smaStrategy);
  console.log("交易次數：", result.tradeCount);
  console.log("bhCurve", result.bhCurve);
  console.log("smaCurve", result.smaCurve);
  console.log("smaQQQCurve", result.smaQQQCurve);

  // SMA 策略
  smaTotalReturn.value = result.smaStrategy.totalReturnPercent; // 總報酬率
  smaMaxDrawdownValue.value = result.smaStrategy.maxDrawdown; // 區間最大回徹
  smaAnnualReturn.value = result.smaStrategy.cagr; // 年度平均報酬率
  smaAnnualReturnLog.value = result.smaStrategy.annualReturns; // 年度報酬率紀錄
  smaRotationsNumber.value = result.tradeCount; // 輪動次數
  smaWorstAnnualReturn.value = result.smaStrategy.annualReturns.reduce((min, item) => item.return < min ? item.return : min, 0); // 最差年度報酬率
  smaBestAnnualReturn.value = result.smaStrategy.annualReturns.reduce((max, item) => item.return > max ? item.return : max, 0); // 最佳年度報酬率
  smaMedianAnnualReturn.value = result.smaStrategy.annualReturns.reduce((median, item) => { return median + item.return }, 0) / result.smaStrategy.annualReturns.length; // 年度中位數報酬率

  // SMA QQQ 策略
  smaQQQTotalReturn.value = result.smaQQQStrategy.totalReturnPercent; // 總報酬率
  smaQQQMaxDrawdownValue.value = result.smaQQQStrategy.maxDrawdown; // 區間最大回徹
  smaQQQAnnualReturn.value = result.smaQQQStrategy.cagr; // 年度平均報酬率
  smaQQQAnnualReturnLog.value = result.smaQQQStrategy.annualReturns; // 年度報酬率紀錄
  smaQQQRotationsNumber.value = result.tradeCountQQQ; // 輪動次數
  smaQQQWorstAnnualReturn.value = result.smaQQQStrategy.annualReturns.reduce((min, item) => item.return < min ? item.return : min, 0); // 最差年度報酬率
  smaQQQBestAnnualReturn.value = result.smaQQQStrategy.annualReturns.reduce((max, item) => item.return > max ? item.return : max, 0); // 最佳年度報酬率
  smaQQQMedianAnnualReturn.value = result.smaQQQStrategy.annualReturns.reduce((median, item) => { return median + item.return }, 0) / result.smaQQQStrategy.annualReturns.length; // 年度中位數報酬率

  // Buy & Hold 策略
  bhTotalReturn.value = result.buyAndHold.totalReturnPercent; // 總報酬率
  bhMaxDrawdownValue.value = result.buyAndHold.maxDrawdown; // 區間最大回徹
  bhAnnualReturn.value = result.buyAndHold.cagr; // 年度平均報酬率
  bhAnnualReturnLog.value = result.buyAndHold.annualReturns; // 年度報酬率紀錄
  bhWorstAnnualReturn.value = result.buyAndHold.annualReturns.reduce((min, item) => item.return < min ? item.return : min, 0); // 最差年度報酬率
  bhBestAnnualReturn.value = result.buyAndHold.annualReturns.reduce((max, item) => item.return > max ? item.return : max, 0); // 最佳年度報酬率
  bhMedianAnnualReturn.value = result.buyAndHold.annualReturns.reduce((median, item) => { return median + item.return }, 0) / result.buyAndHold.annualReturns.length; // 年度中位數報酬率

  if (result.dcaStrategy) {
    dcaTotalReturn.value = result.dcaStrategy.totalReturnPercent;
    dcaMaxDrawdownValue.value = result.dcaStrategy.maxDrawdown;
    dcaAnnualReturn.value = result.dcaStrategy.cagr;
    dcaAnnualReturnLog.value = result.dcaStrategy.annualReturns;
    dcaTradeCount.value = result.dcaTradeCount;
    dcaTotalContributions.value = `$${Math.round(result.dcaStrategy.totalContributions).toLocaleString()}`;
    dcaEndEquity.value = `$${Math.round(result.dcaStrategy.endEquity).toLocaleString()}`;
    dcaWorstAnnualReturn.value = result.dcaStrategy.annualReturns.reduce((min, item) => item.return < min ? item.return : min, 0);
    dcaBestAnnualReturn.value = result.dcaStrategy.annualReturns.reduce((max, item) => item.return > max ? item.return : max, 0);
    dcaMedianAnnualReturn.value =
      result.dcaStrategy.annualReturns.reduce((sum, item) => sum + item.return, 0) /
      (result.dcaStrategy.annualReturns.length || 1);
  }

  // 輸出圖表
  buildChart(result.bhCurve, result.smaCurve, result.smaQQQCurve, result.dcaCurve);
}

// 計算與200SMA的區間距離
const buildChart3 = (data, window) => {
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

  const distribution = bars.reduce((acc, item) => {
  if (item.diffPercent == null || item.diffPercent === Infinity ) return acc;

    const bucket = Math.trunc(item.diffPercent); // 去小數

    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});


  const histogramData = Object.entries(distribution)
  .map(([value, count]) => ({
    value: Number(value),
    count
  }))
  .sort((a, b) => a.value - b.value);


  const chart = echarts.init(myChartDom3.value)
  chart.setOption({
    title: { text: '股價與200SMA的區間距離' },
    tooltip: { trigger: 'item' },
    xAxis: {
      type: 'category',
      name: '區間距離',
      data: histogramData.map(h => h.value),
      axisLabel: { rotate: 45 }
    },
    yAxis: { type: 'value', name: '筆數' },
    series: [{ type: 'bar', data: histogramData.map(h => h.count), name: '出現次數' }]
  })
}

const buildChart = (bhCurve, smaCurve, smaQQQCurve, dcaCurve = []) => {
  // 輸出圖表
  // 計算 netAsset（市值 = 現金 + 成本，這裡.value)
  const chart = echarts.init(myChartDom.value)

  const legend = ['單筆持有', '200 SMA', 'SMAQQQ']
  const series = [
    {
      name: '單筆持有',
      type: 'line',
      data: bhCurve.map((h) => parseFloat(h.equity)),
    },
    {
      name: '200 SMA',
      type: 'line',
      data: smaCurve.map((h) => parseFloat(h.equity)),
    },
    {
      name: 'SMAQQQ',
      type: 'line',
      data: smaQQQCurve.map((h) => parseFloat(h.equity)),
    },
  ]

  if (dcaCurve.length) {
    legend.push('定期定額 DCA')
    series.push({
      name: '定期定額 DCA',
      type: 'line',
      data: dcaCurve.map((h) => parseFloat(h.equity)),
    })
  }

  chart.setOption({
    title: { text: '資金 / 持倉成本 / 資產走勢圖' },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const i = params[0].dataIndex
        const d = bhCurve[i]
        const s = smaCurve[i]
        const q = smaQQQCurve[i]
        const dc = dcaCurve[i]
        let html = `
          日期：${d.date2}<br/>
          單筆持有：$${d.equity}<br/>
          200 SMA：$${s.equity}<br/>
          SMAQQQ：$${q.equity}<br/>
        `
        if (dc) {
          html += `定期定額 DCA：$${Math.round(dc.equity)}（累計投入 $${Math.round(dc.contributions)}）<br/>`
        }
        return html
      },
    },
    legend: {
      data: legend,
    },
    xAxis: {
      type: 'category',
      data: bhCurve.map((h) => h.date2),
      axisLabel: { rotate: 45 },
    },
    yAxis: {
      type: 'value',
      name: '金額（元）',
    },
    series,
  })
}

// 回測驗證在200SMA上下開盤、收盤
const analyzeSMA200OpenClose = (data) => {

  function analyzeOpenClose(bars) {
    const diffs = [];          // signed diff: (Close-Open)/Open
    const closeWins = [];      // diff > 0
    const openWins = [];       // -diff where diff < 0 (Open higher by % of Open)
    let ties = 0;
    let skipped = 0;

    for (const r of bars) {
      const open = Number(r.open) || Number(r.Open);
      const close = Number(r.close) || Number(r.Close);

      if (!Number.isFinite(open) || !Number.isFinite(close) || open <= 0) {
        skipped++;
        continue;
      }

      const diff = (close - open) / open; // signed
      diffs.push(diff);

      if (diff > 0) closeWins.push(diff);
      else if (diff < 0) openWins.push(-diff);
      else ties++;
    }

    const n = diffs.length;
    if (n === 0) {
      return { error: "沒有可用資料（Open/Close 需為數字且 Open > 0）", skipped };
    }

    const mean = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

    const median = (arr) => {
      if (arr.length === 0) return 0;
      const s = [...arr].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };

    const pct = (x, digits = 4) => `${(x * 100).toFixed(digits)}%`;

    return {
      sampleSize: n,
      skipped,
      ties,

      closeWinCount: closeWins.length,
      openWinCount: openWins.length,

      closeHigherWinRate: closeWins.length / n,
      openHigherWinRate: openWins.length / n,
      tieRate: ties / n,

      avgSignedDiff: mean(diffs),
      medianSignedDiff: median(diffs),

      closeWin_avgHigher: mean(closeWins),
      closeWin_medianHigher: median(closeWins),

      openWin_avgHigher: mean(openWins),
      openWin_medianHigher: median(openWins),

      // formatter
      _fmt: { pct },
    };
  }


  function printOpenCloseReport(bars, label = "Open vs Close 分析") {
    const res = analyzeOpenClose(bars);

    if (res.error) {
      console.log(`❌ ${label}`);
      console.log(res);
      return;
    }

    const pct = res._fmt.pct;

    // console.log("==================================================");
    // console.log(`📊 ${label}`);
    // console.log("==================================================");
    // console.log(`樣本數: ${res.sampleSize} 天`);
    if (res.skipped) console.log(`跳過資料: ${res.skipped} 筆（Open/Close 不合法）`);
    // console.log("");

    // console.log("【勝率統計】");
    // console.log(`收盤 > 開盤: ${res.closeWinCount} 天  (${pct(res.closeHigherWinRate, 2)})`);
    // console.log(`開盤 > 收盤: ${res.openWinCount} 天  (${pct(res.openHigherWinRate, 2)})`);
    // console.log(`平手(收盤=開盤): ${res.ties} 天 (${pct(res.tieRate, 2)})`);
    // console.log("");

    // console.log("【整體差異（以開盤為基準，(Close-Open)/Open）】");
    // console.log(`平均差異: ${pct(res.avgSignedDiff, 4)}   （正=收盤較高，負=開盤較高）`);
    // console.log(`中位數差異: ${pct(res.medianSignedDiff, 4)}`);
    // console.log("");

    // console.log("【收盤贏的日子（收盤比開盤高幾%）】");
    // console.log(`平均贏幅: ${pct(res.closeWin_avgHigher, 4)}`);
    // console.log(`中位數贏幅: ${pct(res.closeWin_medianHigher, 4)}`);
    // console.log("");

    // console.log("【開盤贏的日子（開盤比收盤高幾%）】");
    // console.log(`平均贏幅: ${pct(res.openWin_avgHigher, 4)}`);
    // console.log(`中位數贏幅: ${pct(res.openWin_medianHigher, 4)}`);
    // console.log("");

    // console.log("==================================================\n");
  }


  // ✅ 用法：把你的資料陣列丟進去
  printOpenCloseReport(data, "QQQ 開盤/收盤誰比較高？");

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
   * 3. 跑 N 條路徑，全部丟進 runTest
   ***********************************************/
  function runSimulationBatch(simCount, multiplier, dailyExpense, backtestOptions) {
      const results = [];

      for (let i = 0; i < simCount; i++) {
          const bars = simulateBars(multiplier, dailyExpense, "2000-01-01");

          // 直接使用你的 runTest（不修改）
          const out = runTest(
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


onMounted(async () => {
  const res = await fetch('/qqq.csv')
  const csvText = await res.text()
  qqqData.value = await parseCSV(csvText)
})
</script>
<style scoped>
:deep(.el-table .warning-row) {
  background-color: rgb(252.5, 245.7, 235.5);
}
</style>
