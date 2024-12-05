export const intlNumberFormat = (number, digits = 4) => {
  if (
    number === '' ||
    number === null ||
    number === undefined ||
    (isNaN(number) && isNaN(Number(`${number}`.replace(/,/, '')))) ||
    (Array.isArray(number) && number.length === 0) ||
    (typeof number === 'object' && Object.keys(number).length === 0)
  ) {
    return 0
  }
  return number.toFixed(digits)
}
