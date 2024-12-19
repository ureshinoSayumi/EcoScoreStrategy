<template>
  <el-container>
    <el-main>
      <el-row :gutter="20">
        <h1>技術分析投資法</h1>
        <!-- 日期區間選擇器 -->
        <el-col>
          {{ dateRange }}
          <el-date-picker
            v-model="dateRange"
            @change="changeDateRange"
            type="monthrange"
            range-separator="至"
            value-format="YYYY-MM-DD"
            start-placeholder="開始日期"
            end-placeholder="結束日期"
          />
        </el-col>
        <!-- 買入策略 -->
      </el-row>
      <el-row class="mt-5" :gutter="20">
        <el-col :span="4">
          <el-form label-width="auto">
            <el-form-item label="買入策略">
              <el-radio-group v-model="myStockForm.strategyType" @change="changeStrategyType">
                <el-radio v-for="item in useIndicatorOptions" :key="item.value" :value="item.value">
                  {{ item.label }}
                </el-radio>
              </el-radio-group>
            </el-form-item>
          </el-form>
        </el-col>
        <!-- 各數值輸入框 -->
        <el-col :span="4">
          <el-form label-width="auto">
            <el-form-item label="使用指標">
              <el-radio-group v-model="myStockForm.buyType">
                <el-radio :value="0" :disabled="myStockForm.strategyType !== 0">定期定額</el-radio>
                <el-radio :value="1" :disabled="myStockForm.strategyType === 0"
                  >定期不定額</el-radio
                >
                <el-radio :value="2" :disabled="myStockForm.strategyType === 0"
                  >不定期不定額</el-radio
                >
              </el-radio-group>
            </el-form-item>
          </el-form>
        </el-col>
        <el-col :span="6">
          <el-form label-width="auto">
            <el-form-item label="初始錢包">
              <el-input-number v-model="myStockForm.currentMoney" :min="0" size="small">
                <template #suffix>
                  <span>$</span>
                </template>
              </el-input-number>
            </el-form-item>
            <el-form-item label="每月固定投入金額">
              <el-input-number v-model="myStockForm.eachBuyingFixedAmount" :min="0" size="small">
                <template #suffix>
                  <span>$</span>
                </template>
              </el-input-number>
            </el-form-item>
            <el-form-item label="每月存入金額">
              <el-input-number v-model="myStockForm.eachSaveMoney" :min="0" size="small">
                <template #suffix>
                  <span>$</span>
                </template>
              </el-input-number>
            </el-form-item>
            <el-form-item label="加碼數值">
              <el-input-number
                v-model="myStockForm.eachBuyingPercentage"
                :min="0"
                size="small"
                :disabled="myStockForm.strategyType === 0"
              >
                <template #suffix>
                  <span>%</span>
                </template>
              </el-input-number>
            </el-form-item>
          </el-form>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col>
          <el-button type="primary" @click="submit()"> 開始計算 </el-button>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="6" v-for="(item, index) in totalList" :key="index">
          <el-card shadow="hover" style="max-width: 480px" @click="switchLog(index)">
            <template #header>
              <div class="card-header">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px">
                  <el-icon :color="activeIndex === index ? '#000000' : '#D4D7DE'" :size="20"
                    ><StarFilled
                  /></el-icon>
                  <el-icon @click="deleteTotalList(index)" :size="20" style="cursor: pointer"
                    ><Close
                  /></el-icon>
                </div>

                <el-space direction="vertical" alignment="flex-start">
                  <el-text>日期區間: {{ `${item.dateRange[0]} ~ ${item.dateRange[1]}` }}</el-text>
                  <el-text>
                    使用指標:
                    {{ getOptionLabel(strategyTypeOptionAverageLine, item.strategyType) }}
                  </el-text>
                  <el-text
                    v-if="
                      item.strategyType === 3 || item.strategyType === 1 || item.strategyType === 2
                    "
                    style="margin-left: 65px"
                  >
                    {{ `PMI: ${item.pmi.index}` }}
                  </el-text>
                  <el-text
                    v-if="
                      item.strategyType === 4 || item.strategyType === 1 || item.strategyType === 2
                    "
                    style="margin-left: 65px"
                  >
                    {{ `領先指標: ${item.businessSignalA.index}` }}
                  </el-text>
                  <el-text
                    v-if="
                      item.strategyType === 5 || item.strategyType === 1 || item.strategyType === 2
                    "
                    style="margin-left: 65px"
                  >
                    {{ `景氣信號: ${item.businessSignalB.index}` }}
                  </el-text>

                  <el-text>
                    買入策略 :
                    {{ getOptionLabel(buyTypeOpton, item.buyType) }}
                  </el-text>
                </el-space>
              </div>
            </template>
            <el-space direction="vertical" alignment="flex-start">
              <el-text>當前存款: {{ intlNumberFormat(item.currentMoney) }}</el-text>
              <el-text>買入次數: {{ item.buyingCount }}</el-text>
              <el-text>加碼次數: {{ item.buyingCountPlus }}</el-text>
              <el-text>沒買入次數: {{ historStockMarket.length - item.buyingCount }}</el-text>
              <el-text>總買入成本: {{ intlNumberFormat(item.totalBuyingAmount) }}</el-text>
              <el-text>總買入股數: {{ intlNumberFormat(item.totalStockCount) }}</el-text>
              <el-text>總市值: {{ intlNumberFormat(item.totalMarketValue) }}</el-text>
            </el-space>
            <template #footer>
              <el-space direction="vertical" alignment="flex-start">
                <el-text>總買入平均價格: {{ intlNumberFormat(item.buyingAveragePrice) }}</el-text>
                <!-- 資金使用率 = 總買入成本 / (總買入成本 + 當前存款) * 100 -->
                <el-text>
                  資金使用率:
                  {{
                    intlNumberFormat(
                      (item.totalBuyingAmount / (item.currentMoney + item.totalBuyingAmount)) * 100,
                    )
                  }}%
                </el-text>
              </el-space>
            </template>
          </el-card>
        </el-col>
      </el-row>

      <CandlestickChart v-model:charData="stock0050_20100104_20241209" />
      <EconomicIndex v-model:charData="stock0050_20100104_20241209" />

      <!-- <DefaultChart v-model:charData="total" /> -->
      <!-- 表格 -->
      <el-table
        :data="total?.log"
        :row-class-name="tableRowClassName"
        style="margin-top: 20px"
        height="600"
        border
      >
        <el-table-column prop="priceDate" label="日期" />
        <el-table-column prop="price" label="股價" />
        <el-table-column prop="buyPrice" label="此月買入金額">
          <template #default="scope">
            {{ intlNumberFormat(scope.row.buyPrice) }}
          </template>
        </el-table-column>
        <el-table-column prop="sellPrice" label="此月賣出金額">
          <template #default="scope">
            {{ intlNumberFormat(scope.row.sellPrice) }}
          </template>
        </el-table-column>
        <!-- <el-table-column prop="totalBuyPrice" label="此月總買入金額">
          <template #default="scope">
            {{ intlNumberFormat(scope.row.totalBuyPrice) }}
          </template>
        </el-table-column> -->
        <el-table-column prop="buyPricePlus" label="指標" width="220">
          <template #default="scope">
            <span :class="scope.row.price >= scope.row.ma20 ? 'lightText' : ''">
              {{ `ma20: ${scope.row.ma20}` }}
            </span>
            <br />
            <span :class="scope.row.price >= scope.row.ma60 ? 'lightText' : ''">
              {{ `ma60: ${scope.row.ma60}` }}
            </span>
            <br />
            <span :class="scope.row.price >= scope.row.ma120 ? 'lightText' : ''">
              {{ `ma120: ${scope.row.ma120}` }}</span
            >
            <br />
            <span :class="scope.row.price >= scope.row.ma240 ? 'lightText' : ''">
              {{ `ma240: ${scope.row.ma240}` }} </span
            ><br />
          </template>
        </el-table-column>
        <!-- <el-table-column prop="totalBuyingAmount" label="此月累積買入金額">
          <template #default="scope">
            {{ intlNumberFormat(scope.row.totalBuyingAmount) }}
          </template>
        </el-table-column> -->
        <el-table-column prop="buyStockCount" label="此月買入股數">
          <template #default="scope">
            {{ intlNumberFormat(scope.row.buyStockCount) }}
          </template>
        </el-table-column>
        <!-- <el-table-column prop="totalStockCount" label="此月累積買入股數">
          <template #default="scope">
            {{ intlNumberFormat(scope.row.totalStockCount) }}
          </template>
        </el-table-column> -->
        <el-table-column prop="currentMoney" label="此月本金">
          <template #default="scope">
            {{ intlNumberFormat(scope.row.currentMoney) }}
          </template>
        </el-table-column>
      </el-table>
    </el-main>
  </el-container>
</template>
<script lang="ts" setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ecoScoreStrategy } from '../../../public/demo2.js'
import { historPmi } from '@/utils/data/historPmi.js'
import { businessSignals } from '@/utils/data/businessSignals.js' // 景氣信號、領先指標
import { historStockMarket } from '@/utils/data/historStockMarket.js'
import { intlNumberFormat } from '@/utils/number.js'
import { filterAndSortByDate2 } from '@/utils/date.js'
import { strategyTypeOptionAverageLine, buyTypeOpton, getOptionLabel } from '@/utils/optionMap.js'
import * as echarts from 'echarts'
import { convertStockDataToEChartsFormat } from '@/utils/ECharts.js'
import { getStock } from '@/api/app.js'
import CandlestickChart from '@/components/CandlestickChart.vue'
import EconomicIndex from '@/components/EconomicIndex.vue'
import { stock0050_20100104_20241209 } from '@/utils/stockList.js'
import { technicalAnalysisStrategy } from '@/utils/computed.js'

// 策略選項
const useIndicatorOptions = [
  { value: 0, label: '每月買入' },
  { value: 1, label: '站上60均線' },
  { value: 2, label: '站上120均線' },
  { value: 3, label: '站上240均線' },
]
// 儀表板表單
const myStockForm = reactive({
  // 0: 不使用策略每月買入 1: 站上60均線 2: 站上120均線 3: 站上240均線
  strategyType: 0,
  // 買入金額
  currentMoney: 10000, // 錢包 每個月如果沒買入，就把錢放入錢包，如果有初始金額也會放在這裡
  eachBuyingPercentage: 100, // 加碼百分比 (百分比)
  eachBuyingFixedAmount: 0, // 每月固定投入金額
  eachSaveMoney: 0, // 每月存入金額
  // 買入規則 1.不定期不定額 使用 eachBuyingPercentage 百分比 2 定期定額.使用 eachBuyingFixedAmount 固定投入金額 3.定期不定額，低點加上加碼買入
  buyType: 0,
})
// 輸出報表
const total = ref({
  currentMoney: 0,
  buyingCount: 0,
  buyingCountPlus: 0,
  totalStockCount: 0,
  totalBuyingAmount: 0,
  buyingAveragePrice: 0,
  totalMarketValue: 0,
  log: [],
})
const totalList = ref([
  //   {
  //   currentMoney: 0,
  //   buyingCount: 0,
  //   buyingCountPlus: 0,
  //   totalStockCount: 0,
  //   totalBuyingAmount: 0,
  //   buyingAveragePrice: 0,
  //   totalMarketValue: 0,
  //   log: [],
  // }
])
// 歷史股價
const historStockMarketRange = ref(stock0050_20100104_20241209)
const dateRange = ref([]) // 日期區間
const activeIndex = ref(null) // 當前選取的 card

const submit = () => {
  console.log('myStockForm', myStockForm)
  console.log('myStockForm', myStockForm)
  const stockInfo = {
    // 0: 不使用策略每月買入 1: 站上60均線 2: 站上120均線 3: 站上240均線
    strategyType: myStockForm.strategyType,
    status: 0, // 當前買入狀態 0: 未買入 1: 以買入

    // 買入金額
    currentMoney: myStockForm.currentMoney, // 錢包 每個月如果沒買入，就把錢放入錢包，如果有初始金額也會放在這裡
    eachBuyingPercentage: myStockForm.eachBuyingPercentage, // 加碼百分比 (百分比)
    eachBuyingFixedAmount: myStockForm.eachBuyingFixedAmount, // 每月固定投入金額
    eachSaveMoney: myStockForm.eachSaveMoney, // 每月存入金額
    // 買入規則
    // 0 定期定額.使用 eachBuyingFixedAmount 固定投入金額
    // 1.定期不定額，低點加上加碼買入
    // 2.不定期不定額 使用 eachBuyingPercentage 百分比
    buyType: myStockForm.buyType,
    // 統計資料
    buyingCount: 0, // 買入次數
    sallCount: 0, // 賣出次數
    buyingCountPlus: 0, // 加碼次數
    totalStockCount: 0, // 總買入股數
    totalBuyingAmount: 0, // 總買入成本
    buyingAveragePrice: 0, // 總買入平均價格 = 總買入成本 / 總買入股數
    totalMarketValue: 0, // 總市值 用最後一個收盤日
    // 所有買入歷史紀錄
    log: [
      // {
      // priceDate: item.date, // 本輪日期
      // price: item.price, // 本輪股價
      // pmi: pmiData, // 本輪 pmi
      // businessSignalACase: businessSignal, // 本輪領先指標
      // businessSignalBCase: businessSignal, // 本輪景氣信號
      // buyPrice: buyPrice || 0, // 本輪買入金額
      // sellPrice: sellPrice || 0, // 本輪賣出金額
      // totalBuyingAmount: myStock.totalBuyingAmount, // 本輪累積買入金額
      // buyStockCount: buyPrice / item.price || 0, // 買入股數
      // totalStockCount: myStock.totalStockCount, // 本輪累積買入股數
      // currentMoneyp: myStockInfo.currentMoney, // 本輪本金
      // },
    ],
  }
  const res = technicalAnalysisStrategy(
    stockInfo,
    historStockMarketRange.value,
    stock0050_20100104_20241209,
  )
  total.value = res
  console.log('total.value', total.value)
  totalList.value.push({
    dateRange: dateRange.value,
    strategyType: myStockForm.strategyType,
    ...res,
  })
  // buildECharts()
  // console.log('res', res)
  // console.log('當前存款', res.currentMoney)
  // console.log('買入次數', res.buyingCount)
  // console.log('加碼次數', res.buyingCountPlus)
  // console.log('沒買入次數', historStockMarket.length - res.buyingCount)
  // // console.log('沒買入次數', res.notBuyingCount)
  // console.log('總買入成本', res.totalBuyingAmount)
  // console.log('總買入股數', res.totalStockCount)
  // console.log('總買入平均價格', res.buyingAveragePrice)
  // console.log('總市值', res.totalMarketValue)
}

const tableRowClassName = ({ row }) => {
  if (row.buyPrice || row.sellPrice) {
    return 'warning-row'
  }
  return ''
}

const changeDateRange = () => {
  console.log('dateRange', dateRange.value)
  historStockMarketRange.value = filterAndSortByDate2(dateRange.value, stock0050_20100104_20241209)
  console.log('historStockMarketRange.value', historStockMarketRange.value)
}

const changeStrategyType = () => {
  // 指標選擇"每月買入"以外，買入規則就不允許選擇選定期定額
  if (myStockForm.strategyType !== 0 && myStockForm.buyType === 0) {
    myStockForm.buyType = 1
  }
  // 指標選擇"每月買入"，買入規則就不允許選擇選定期定額以外
  if (myStockForm.strategyType === 0 && myStockForm.buyType !== 0) {
    myStockForm.buyType = 0
  }
}

const switchLog = (index) => {
  // 點選同樣的就取消選取
  if (activeIndex.value === index) {
    activeIndex.value = null
  } else {
    activeIndex.value = index
  }
  total.value = totalList.value[index]
}

const deleteTotalList = (index) => {
  if (index === 0) {
    total.value = {
      currentMoney: 0,
      buyingCount: 0,
      buyingCountPlus: 0,
      totalStockCount: 0,
      totalBuyingAmount: 0,
      buyingAveragePrice: 0,
      totalMarketValue: 0,
      log: [],
    }
  } else {
    total.value = totalList.value[index - 1]
  }
  totalList.value.splice(index, 1)
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
