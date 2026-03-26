import type { OCRResult, ParsedBill } from '../types';
import { autoMatchCategory } from './categoryRules';

// 账单格式类型定义
export type BillFormat = 'wechat' | 'alipay' | 'bank' | 'unknown';

// 账单结构信息
export interface BillStructure {
  format: BillFormat;
  hasIcon: boolean;        // 是否有图标
  merchantPosition: 'left' | 'right' | 'top' | 'bottom' | 'middle';
  datePosition: 'left' | 'right' | 'top' | 'bottom' | 'middle';
  amountPosition: 'left' | 'right' | 'top' | 'bottom' | 'middle';
  pattern: string;         // 识别到的模式
  confidence: number;      // 格式识别置信度
}

// 微信账单模式
const WECHAT_PATTERNS = [
  {
    pattern: /^收款商\n.*\n\d{4}年\d{1,2}月\d{1,2}日\n\d+\.\d{2}元$/,
    description: '微信标准收款格式',
    structure: {
      format: 'wechat' as BillFormat,
      hasIcon: true,
      merchantPosition: 'top' as const,
      datePosition: 'middle' as const,
      amountPosition: 'bottom' as const,
      confidence: 90
    }
  },
  {
    pattern: /^.*\n\d{4}年\d{1,2}月\d{1,2}日\n.*\d+\.\d{2}元$/,
    description: '微信支出格式',
    structure: {
      format: 'wechat' as BillFormat,
      hasIcon: true,
      merchantPosition: 'top' as const,
      datePosition: 'middle' as const,
      amountPosition: 'bottom' as const,
      confidence: 85
    }
  },
  {
    pattern: /^.*\n\d{4}年\d{1,2}月\d{1,2}日\n\d+\.\d{2}元$/,
    description: '微信简化格式',
    structure: {
      format: 'wechat' as BillFormat,
      hasIcon: false,
      merchantPosition: 'top' as const,
      datePosition: 'middle' as const,
      amountPosition: 'bottom' as const,
      confidence: 80
    }
  }
];

// 支付宝账单模式
const ALIPAY_PATTERNS = [
  {
    pattern: /^交易时间\d{4}-\d{2}-\d{2}.*交易对方.*金额\d+\.\d{2}$/,
    description: '支付宝标准格式',
    structure: {
      format: 'alipay' as BillFormat,
      hasIcon: true,
      merchantPosition: 'middle' as const,
      datePosition: 'left' as const,
      amountPosition: 'right' as const,
      confidence: 90
    }
  },
  {
    pattern: /^.*\d{4}-\d{2}-\d{2}.*\d+\.\d{2}$/,
    description: '支付宝简化格式',
    structure: {
      format: 'alipay' as BillFormat,
      hasIcon: false,
      merchantPosition: 'left' as const,
      datePosition: 'left' as const,
      amountPosition: 'right' as const,
      confidence: 75
    }
  }
];

// 银行账单模式
const BANK_PATTERNS = [
  {
    pattern: /^交易日期\d{4}\/\d{2}\/\d{2}.*商户名称.*交易金额\d+\.\d{2}$/,
    description: '银行标准格式',
    structure: {
      format: 'bank' as BillFormat,
      hasIcon: false,
      merchantPosition: 'middle' as const,
      datePosition: 'left' as const,
      amountPosition: 'right' as const,
      confidence: 90
    }
  },
  {
    pattern: /^\d{4}\/\d{2}\/\d{2}.*\d+\.\d{2}$/,
    description: '银行简化格式',
    structure: {
      format: 'bank' as BillFormat,
      hasIcon: false,
      merchantPosition: 'left' as const,
      datePosition: 'left' as const,
      amountPosition: 'right' as const,
      confidence: 70
    }
  }
];

// 识别账单格式
export function identifyBillFormat(text: string): BillStructure {
  const cleanText = text.replace(/\s+/g, '').trim();
  
  // 检查微信格式
  for (const wechatPattern of WECHAT_PATTERNS) {
    if (wechatPattern.pattern.test(cleanText)) {
      return {
        ...wechatPattern.structure,
        pattern: wechatPattern.description
      };
    }
  }
  
  // 检查支付宝格式
  for (const alipayPattern of ALIPAY_PATTERNS) {
    if (alipayPattern.pattern.test(cleanText)) {
      return {
        ...alipayPattern.structure,
        pattern: alipayPattern.description
      };
    }
  }
  
  // 检查银行格式
  for (const bankPattern of BANK_PATTERNS) {
    if (bankPattern.pattern.test(cleanText)) {
      return {
        ...bankPattern.structure,
        pattern: bankPattern.description
      };
    }
  }
  
  // 未知格式，基于特征推断
  return inferUnknownFormat(cleanText);
}

// 推断未知格式
function inferUnknownFormat(text: string): BillStructure {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // 检查是否包含年份格式
  const hasChineseDate = /\d{4}年\d{1,2}月\d{1,2}日/.test(text);
  const hasSlashDate = /\d{4}\/\d{2}\/\d{2}/.test(text);
  const hasDashDate = /\d{4}-\d{2}-\d{2}/.test(text);
  
  // 检查金额位置
  const amountPattern = /\d+\.\d{2}/;
  const amountMatches = [...text.matchAll(amountPattern)];
  
  // 基于特征推断格式
  if (hasChineseDate && lines.length >= 3) {
    return {
      format: 'wechat',
      hasIcon: lines.length >= 4,
      merchantPosition: 'top',
      datePosition: 'middle',
      amountPosition: 'bottom',
      pattern: '推断微信格式',
      confidence: 60
    };
  } else if (hasDashDate && text.includes('交易')) {
    return {
      format: 'alipay',
      hasIcon: false,
      merchantPosition: 'middle',
      datePosition: 'left',
      amountPosition: 'right',
      pattern: '推断支付宝格式',
      confidence: 55
    };
  } else if (hasSlashDate) {
    return {
      format: 'bank',
      hasIcon: false,
      merchantPosition: 'middle',
      datePosition: 'left',
      amountPosition: 'right',
      pattern: '推断银行格式',
      confidence: 50
    };
  }
  
  // 完全未知
  return {
    format: 'unknown',
    hasIcon: false,
    merchantPosition: 'top',
    datePosition: 'middle',
    amountPosition: 'bottom',
    pattern: '未知格式',
    confidence: 30
  };
}

// 根据格式解析账单
export function parseBillByFormat(text: string, structure: BillStructure): ParsedBill[] {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const results: ParsedBill[] = [];
  
  switch (structure.format) {
    case 'wechat':
      return parseWeChatBill(lines, structure);
    case 'alipay':
      return parseAlipayBill(lines, structure);
    case 'bank':
      return parseBankBill(lines, structure);
    default:
      return parseUnknownBill(lines, structure);
  }
}

// 解析微信账单
function parseWeChatBill(lines: string[], structure: BillStructure): ParsedBill[] {
  const results: ParsedBill[] = [];
  
  // 微信格式：商家 -> 日期 -> 金额
  if (lines.length >= 3) {
    let merchant = lines[0];
    let dateStr = lines[1];
    let amountStr = lines[2];
    
    // 如果有图标，跳过第一行
    if (structure.hasIcon && lines.length >= 4) {
      merchant = lines[1];
      dateStr = lines[2];
      amountStr = lines[3];
    }
    
    // 提取金额
    const amountMatch = amountStr.match(/(\d+\.\d{2})/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
    
    // 提取日期
    const date = extractDateFromChinese(dateStr) || new Date().toISOString();
    
    if (amount > 0) {
      results.push({
        amount,
        date,
        description: merchant,
        confidence: structure.confidence
      });
    }
  }
  
  return results;
}

// 解析支付宝账单
function parseAlipayBill(lines: string[], structure: BillStructure): ParsedBill[] {
  const results: ParsedBill[] = [];
  
  // 支付宝格式：通常是单行包含所有信息
  for (const line of lines) {
    const amountMatch = line.match(/(\d+\.\d{2})/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1]);
      
      // 提取商家（在金额前的汉字）
      const beforeAmount = line.substring(0, line.indexOf(amountMatch[0]));
      const merchant = beforeAmount.replace(/[^\u4e00-\u9fa5]/g, '').trim();
      
      // 提取日期
      const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString();
      
      if (amount > 0 && merchant.length > 0) {
        results.push({
          amount,
          date,
          description: merchant,
          confidence: structure.confidence
        });
      }
    }
  }
  
  return results;
}

// 解析银行账单
function parseBankBill(lines: string[], structure: BillStructure): ParsedBill[] {
  const results: ParsedBill[] = [];
  
  // 银行格式：类似支付宝但更正式
  for (const line of lines) {
    const amountMatch = line.match(/(\d+\.\d{2})/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1]);
      
      // 提取商家
      const beforeAmount = line.substring(0, line.indexOf(amountMatch[0]));
      const merchant = beforeAmount.replace(/[^\u4e00-\u9fa5]/g, '').trim();
      
      // 提取日期
      const dateMatch = line.match(/(\d{4}\/\d{2}\/\d{2})/);
      const date = dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString();
      
      if (amount > 0 && merchant.length > 0) {
        results.push({
          amount,
          date,
          description: merchant,
          confidence: structure.confidence
        });
      }
    }
  }
  
  return results;
}

// 解析未知格式账单
function parseUnknownBill(lines: string[], structure: BillStructure): ParsedBill[] {
  const results: ParsedBill[] = [];
  
  // 通用解析：寻找数字和周围的汉字
  for (const line of lines) {
    const amountMatch = line.match(/(\d+\.\d{2})/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1]);
      
      // 提取描述
      const beforeAmount = line.substring(0, line.indexOf(amountMatch[0]));
      const description = beforeAmount.replace(/[^\u4e00-\u9fa5]/g, '').trim();
      
      if (amount > 0) {
        results.push({
          amount,
          date: new Date().toISOString(),
          description: description || '未识别',
          confidence: structure.confidence
        });
      }
    }
  }
  
  return results;
}

// 从中文日期字符串提取日期
function extractDateFromChinese(dateStr: string): string | null {
  const match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    
    if (year >= 2000 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day).toISOString();
    }
  }
  return null;
}

// 主要解析函数
export async function parseBillWithFormatRecognition(text: string): Promise<ParsedBill[]> {
  // 1. 识别账单格式
  const structure = identifyBillFormat(text);
  console.log('识别到账单格式:', structure);
  
  // 2. 根据格式解析
  const results = parseBillByFormat(text, structure);
  
  // 3. 如果没有识别到结果，使用通用解析
  if (results.length === 0) {
    console.log('格式解析失败，使用通用解析');
    return parseUnknownBill(text.split('\n'), structure);
  }
  
  return results;
}
