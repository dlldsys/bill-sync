import Tesseract from 'tesseract.js';
import type { OCRResult, ParsedBill } from '../types';
import { autoMatchCategory } from './categoryRules';

// OCR识别和解析逻辑
export async function recognizeText(file: File): Promise<OCRResult> {
  try {
    const result = await Tesseract.recognize(file, 'chi_sim+eng');
    return {
      text: result.data.text,
      confidence: result.data.confidence,
    };
  } catch (error) {
    console.error('OCR error:', error);
    return { text: '', confidence: 0 };
  }
}

// 解析商家名称（常见格式）
export function extractMerchant(text: string): string | null {
  const patterns = [
    /(?:商家|商户|店名|收款方)[:：]\s*(.+)/i,
    /(?:名称|name)[:：]\s*(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1].trim().substring(0, 50);
  }
  return null;
}

// 解析日期（多种格式）
export function extractDate(text: string): string | null {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentDay = new Date().getDate();

  // 首先尝试匹配带年份的日期
  const yearPatterns = [
    // 标准日期格式：2024-03-25, 2024/03/25, 2024.03.25
    /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/,
    // 中文格式：2024年3月25日
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,
    // 常见账单日期格式：交易时间 2024-03-25
    /(?:交易时间|日期|时间|date|time)[:：]\s*(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/i,
  ];

  for (const pattern of yearPatterns) {
    const match = text.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      
      if (year >= 2000 && year <= currentYear + 1 && 
          month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const localDate = new Date(year, month - 1, day);
        return localDate.toISOString();
      }
    }
  }

  // 尝试匹配不带年份的日期（月-日格式）
  const noYearPatterns = [
    // 月日格式：03月25日, 3月25日
    /(\d{1,2})月(\d{1,2})日/,
    // 微信/支付宝格式：03-25 14:30 或 03-25
    /(\d{1,2})-(\d{1,2})(?:\s+\d{1,2}:\d{2})?/,
    // 斜杠格式：03/25
    /(\d{1,2})\/(\d{1,2})(?:\s+\d{1,2}:\d{2})?/,
  ];

  for (const pattern of noYearPatterns) {
    const match = text.match(pattern);
    if (match) {
      const month = parseInt(match[1]);
      const day = parseInt(match[2]);
      
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        // 使用当前年份
        const localDate = new Date(currentYear, month - 1, day);
        return localDate.toISOString();
      }
    }
  }

  return null;
}

export interface ParseBillResult extends ParsedBill {
  matchedCategoryId?: string;
  matchedCategoryName?: string;
  billType?: 'income' | 'expense';
}

// 解析账单文本并自动匹配分类
export async function parseBillTextWithAutoMatch(rawText: string): Promise<ParseBillResult[]> {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const results: ParseBillResult[] = [];

  // 提取商家名称
  const merchant = extractMerchant(rawText);
  
  // 提取日期（整个文本中的日期）
  const extractedDate = extractDate(rawText);

  // 解析金额
  const amountMatches = rawText.matchAll(/[¥￥]?\s*(\d+\.\d{2})/g);

  for (const match of amountMatches) {
    const amount = parseFloat(match[1]);
    if (!isNaN(amount) && amount > 0) {
      // 查找金额附近的描述
      let description = '';
      for (const line of lines) {
        if (line.includes(match[1])) {
          description = line.replace(/[¥￥]?\s*\d+\.?\d{0,2}/g, '').trim();
          break;
        }
      }

      const result: ParseBillResult = {
        amount,
        date: extractedDate || new Date().toISOString(),
        description: description || '未识别',
        merchant: merchant || undefined,
        confidence: 70,
      };

      // 自动匹配分类
      if (merchant || description) {
        const matchResult = await autoMatchCategory(merchant || '', description);
        if (matchResult) {
          result.matchedCategoryId = matchResult.categoryId;
          result.matchedCategoryName = matchResult.category.name;
          result.category = matchResult.category.name;
        }
      }

      results.push(result);
    }
  }

  return results.length > 0 ? results : [{
    amount: 0,
    date: extractedDate || new Date().toISOString(),
    description: '未识别到内容',
    confidence: 0,
  }];
}

// 保留原有函数兼容性
export function parseBillText(rawText: string): ParsedBill[] {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const results: ParsedBill[] = [];

  // 提取日期
  const extractedDate = extractDate(rawText);

  // 解析金额
  const amountMatches = rawText.matchAll(/[¥￥]?\s*(\d+\.\d{2})/g);

  for (const match of amountMatches) {
    const amount = parseFloat(match[1]);
    if (!isNaN(amount) && amount > 0) {
      // 查找金额附近的描述
      let description = '';
      for (const line of lines) {
        if (line.includes(match[1])) {
          description = line.replace(/[¥￥]?\s*\d+\.?\d{0,2}/g, '').trim();
          break;
        }
      }

      results.push({
        amount,
        date: extractedDate || new Date().toISOString(),
        description: description || '未识别',
        confidence: 70,
      });
    }
  }

  return results.length > 0 ? results : [{
    amount: 0,
    date: extractedDate || new Date().toISOString(),
    description: '未识别到内容',
    confidence: 0,
  }];
}
