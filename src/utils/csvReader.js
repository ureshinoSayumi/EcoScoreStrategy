// csvReader.ts
import Papa from 'papaparse';

export const parseCSV = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true, // 解析欄位名稱
      skipEmptyLines: true,
      complete: (result) => {
        resolve(result.data);
      },
      error: (err) => reject(err),
    });
  });
}
