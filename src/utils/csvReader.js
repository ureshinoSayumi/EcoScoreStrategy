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
