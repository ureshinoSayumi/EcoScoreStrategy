<template>
  <el-container>
    <el-main>
      <h1>API GET</h1>
      <el-form label-width="auto">
        <el-form-item label="股票代號">
          <el-input v-model="getStockInfo.stockCode" size="small"> </el-input>
        </el-form-item>
        <el-form-item label="取過去幾個月">
          <el-input v-model="getStockInfo.month" size="small"> </el-input>
        </el-form-item>
        <el-form-item label="起始日期">
          <el-date-picker
            @change="changeDate"
            v-model="getStockInfo.startDate"
            type="date"
            placeholder="選擇起始日"
          />
        </el-form-item>
      </el-form>
      <el-button type="primary" @click="getAllApi()"> 開始取資料 </el-button>
    </el-main>
  </el-container>
</template>
<script lang="ts" setup>
import { ref, reactive, onMounted } from 'vue'
import { getPastMonthsFirstDays, formatDateToYYYYMMDD } from '@/utils/date.js'
import { convertStockDataToEChartsFormat } from '@/utils/ECharts.js'
import { getStock } from '@/api/app.js'

const getStockInfo = reactive({
  startDate: new Date(),
  month: 12,
  stockCode: '0050',
})
const apiList = ref([]) // API回來的資訊

const changeDate = () => {
  const formatDate = formatDateToYYYYMMDD(getStockInfo.startDate)
  console.log('formatDate', formatDate)
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const getAllApi = async () => {
  const formatDate = formatDateToYYYYMMDD(getStockInfo.startDate)
  const dateList = getPastMonthsFirstDays(getStockInfo.month, formatDate)
  console.log('START_date', dateList)
  console.log('START_code', getStockInfo.stockCode)

  try {
    for (let i = 0; i < dateList.length; i++) {
      const res = await getStock({
        date: dateList[i],
        stockNo: getStockInfo.stockCode,
        response: 'json',
        _: new Date().getTime(),
      })
      console.log(i)
      console.log(res.data.data)
      apiList.value.push(...convertStockDataToEChartsFormat(res.data.data))
      // 排序函式
      apiList.value.sort((a, b) => {
        // 將日期字串轉換為時間戳記進行比較
        const dateA = new Date(a[0])
        const dateB = new Date(b[0])
        return dateA - dateB
      })
      console.log('apiList.value', apiList.value)
      await delay(3000)
    }

    console.log('API GET done')
    console.log('apiList SUS', apiList.value)
  } catch (err) {
    console.log('error')
    apiList.value.sort((a, b) => {
      // 將日期字串轉換為時間戳記進行比較
      const dateA = new Date(a[0])
      const dateB = new Date(b[0])
      return dateA - dateB
    })
    apiList.value = convertStockDataToEChartsFormat(apiList.value)
    console.log('apiList ERROR', apiList.value)

    console.error(err)
  }
}

onMounted(() => {
  // getAllApi()
})
</script>
