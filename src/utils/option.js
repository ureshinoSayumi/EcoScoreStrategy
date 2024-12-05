// 買入策略選項
export const strategyTypeOption = {
  0: '每月買入',
  1: '全部符合',
  2: '單一符合',
  3: '只用 PMI',
  4: '只用領先指標',
  5: '只用景氣信號',
}

export const getOptionLabel = (option, key) => {
  if (option[key]) {
    return option[key]
  } else {
    return key
  }
}
