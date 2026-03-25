import Tesseract from 'tesseract.js';
import { OCRResult, ParsedBill } from '../types';
import { fileToBase64 } from '../utils';

// OCR 识别
export async function recognizeText(imageFile: File): Promise<OCRResult> {
  const base64 = await fileToBase64(imageFile);
  
  const result = await Tesseract.recognize(base64, 'eng+chi', {
    logger: (m) => console.log(m),
  });
  
  return {
    text: result.data.text,
    confidence: result.data.confidence,
  };
}

// 批量 OCR 识别
export async function recognizeBatch(
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<OCRResult[]> {
  const results: OCRResult[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const result = await recognizeText(files[i]);
    results.push(result);
    onProgress?.(i + 1, files.length);
  }
  
  return results;
}

// 解析账单文本
export function parseBillText(rawText: string): ParsedBill {
  const lines = rawText.split('\n').filter((line) => line.trim());
  
  let amount = 0;
  let date = new Date().toISOString();
  let description = '';
  let confidence = 0;
  
  // 匹配金额
  const amountPatterns = [
    /[¥￥]?\s*(\d+\.?\d{0,2})/g,
    /金额[：:]\s*[¥￥]?\s*(\d+\.?\d{0,2})/i,
    /总价[：:]\s*[¥￥]?\s*(\d+\.?\d{0,2})/i,
    /合计[：:]\s*[¥￥]?\s*(\d+\.?\d{0,2})/i,
  ];
  
  for (const pattern of amountPatterns) {
    const matches = rawText.match(pattern);
    if (matches) {
      // 取最大的金额
      const amounts = matches
        .map((m) => parseFloat(m.replace(/[¥￥：:]/g, '')))
        .filter((n) => !isNaN(n) && n > 0);
      
      if (amounts.length > 0) {
        amount = Math.max(...amounts);
        confidence += 30;
        break;
      }
    }
  }
  
  // 匹配日期
  const datePatterns = [
    /(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/,
    /(\d{2})[-/](\d{1,2})[-/](\d{1,2})/,
  ];
  
  for (const pattern of datePatterns) {
    const match = rawText.match(pattern);
    if (match) {
      let year: number, month: number, day: number;
      
      if (match[1].length === 4) {
        year = parseInt(match[1]);
        month = parseInt(match[2]);
        day = parseInt(match[3]);
      } else {
        year = 2000 + parseInt(match[1]);
        month = parseInt(match[2]);
        day = parseInt(match[3]);
      }
      
      date = new Date(year, month - 1, day).toISOString();
      confidence += 30;
      break;
    }
  }
  
  // 提取描述（去除金额、日期后的文字）
  description = lines
    .filter((line) => !/\d+\.?\d{0,2}/.test(line) || line.length > 15)
    .filter((line) => !/[\u4e00-\u9fa5]{0,5}[日时月年]/.test(line))
    .join(' ')
    .trim();
  
  // 限制描述长度
  if (description.length > 100) {
    description = description.substring(0, 100);
  }
  
  if (description) {
    confidence += 20;
  }
  
  // 计算总置信度
  confidence = Math.min(100, confidence);
  
  return {
    amount: amount || 0,
    date,
    description: description || '未识别',
    confidence,
  };
}

// 从 OCR 结果批量解析账单
export function parseBillsFromOCR(ocrResults: OCRResult[]): ParsedBill[] {
  return ocrResults.map((result) => parseBillText(result.text));
}

// 估算解析质量
export function estimateParseQuality(parsed: ParsedBill): 'high' | 'medium' | 'low' {
  if (parsed.confidence >= 80 && parsed.amount > 0) {
    return 'high';
  }
  if (parsed.confidence >= 50 && parsed.amount > 0) {
    return 'medium';
  }
  return 'low';
}
