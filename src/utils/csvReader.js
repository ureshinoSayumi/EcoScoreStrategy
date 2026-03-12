// csvReader.js
import Papa from 'papaparse';

/** 將檔案轉成 UTF-8 字串（支援 Big5、GBK 等編碼） */
export const readFileAsUTF8 = async (file) => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // 檢查 UTF-8 BOM
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buffer);
  }

  // 先嘗試 UTF-8
  const utf8Str = new TextDecoder('utf-8').decode(buffer);
  const replacementChar = '\uFFFD';
  if (!utf8Str.includes(replacementChar)) {
    return utf8Str;
  }

  // 嘗試 Big5（繁體中文）或 GBK（簡體中文）
  try {
    return new TextDecoder('big5').decode(buffer);
  } catch {
    try {
      return new TextDecoder('gbk').decode(buffer);
    } catch {
      return utf8Str;
    }
  }
};

export const parseCSV = async (file) => {
  const utf8Text = await readFileAsUTF8(file);
  return new Promise((resolve, reject) => {
    Papa.parse(utf8Text, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        resolve(result.data);
      },
      error: (err) => reject(err),
    });
  });
};

/**
 * 解析策略選股 CSV（含 代碼、商品 欄位）
 * 支援前幾行為 metadata 的格式，自動尋找標題列
 * @returns {Promise<{ code: string, product: string }[]>}
 */
export const parseStrategyCSV = async (file) => {
  const utf8Text = await readFileAsUTF8(file);
  const lines = utf8Text.split(/\r?\n/).filter((line) => line.trim());
  const headerIndex = lines.findIndex(
    (line) => line.includes('代碼') && line.includes('商品')
  );
  if (headerIndex === -1) {
    throw new Error('找不到包含「代碼」與「商品」的標題列');
  }
  const csvFromHeader = lines.slice(headerIndex).join('\n');
  return new Promise((resolve, reject) => {
    Papa.parse(csvFromHeader, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data || [];
        const getVal = (row, key) => {
          const k = Object.keys(row).find((x) => x.trim() === key);
          return (row[k] ?? '').toString().trim();
        };
        const items = rows
          .map((row) => {
            const code = getVal(row, '代碼');
            const product = getVal(row, '商品');
            if (!code && !product) return null;
            return { code, product };
          })
          .filter(Boolean);
        resolve(items);
      },
      error: (err) => reject(err),
    });
  });
};
