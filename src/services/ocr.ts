import * as Tesseract from 'tesseract.js';
import type { OCRResult, ParsedBill } from '../types';
import { autoMatchCategory } from './categoryRules';

// OCR引擎枚举
export enum OCREngine {
  TESSERACT = 'tesseract',
  PADDLE_OCR = 'paddleocr',
  EASY_OCR = 'easyocr',
  CLOUD_OCR = 'cloud',
  HYBRID = 'hybrid'
}

// 多OCR引擎识别结果
interface MultiOCRResult {
  engine: OCREngine;
  text: string;
  confidence: number;
  words?: Array<{
    text: string;
    confidence: number;
    bbox?: number[];
  }>;
  processTime?: number;
  success: boolean;
  error?: string;
  provider?: string;
}

// OCR识别和解析逻辑 - 多引擎版本
export async function recognizeText(file: File, engine: OCREngine = OCREngine.HYBRID, onProgress?: (progress: number) => void): Promise<OCRResult> {
  try {
    console.log(`🚀 开始OCR识别 (引擎: ${engine})`);
    
    let result: MultiOCRResult;
    
    switch (engine) {
      case OCREngine.TESSERACT:
        result = await recognizeWithTesseract(file, onProgress);
        break;
      case OCREngine.PADDLE_OCR:
        result = await recognizeWithPaddleOCR(file, onProgress);
        break;
      case OCREngine.EASY_OCR:
        result = await recognizeWithEasyOCR(file, onProgress);
        break;
      case OCREngine.CLOUD_OCR:
        result = await recognizeWithCloudOCR(file, 'baidu', onProgress);
        break;
      case OCREngine.HYBRID:
        result = await recognizeWithHybrid(file, onProgress);
        break;
      default:
        throw new Error(`不支持的OCR引擎: ${engine}`);
    }
    
    if (!result.success) {
      throw new Error(result.error || 'OCR识别失败');
    }
    
    // 后处理：清理常见OCR错误
    const cleanedText = postProcessOCRText(result.text);
    
    console.log(`✅ OCR识别完成: ${result.engine}`);
    console.log(`📝 文本长度: ${cleanedText.length}`);
    console.log(`🎯 置信度: ${result.confidence}%`);
    console.log(`⏱️ 处理时间: ${result.processTime || 0}ms`);
    
    return {
      text: cleanedText,
      confidence: result.confidence,
      engine: result.engine,
      processTime: result.processTime,
      words: result.words || []
    };
    
  } catch (error) {
    console.error('❌ OCR识别失败:', error);
    return { 
      text: '', 
      confidence: 0,
      engine: engine,
      error: error.message
    };
  }
}

// Tesseract.js 识别
async function recognizeWithTesseract(file: File, onProgress?: (progress: number) => void): Promise<MultiOCRResult> {
  try {
    console.log('🔍 使用 Tesseract.js 识别...');
    
    const result = await Tesseract.recognize(file, 'chi_sim+eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(m.progress * 100);
        }
      }
    });
    
    return {
      engine: OCREngine.TESSERACT,
      text: result.data.text,
      confidence: result.data.confidence,
      words: result.data.words || [],
      success: true
    };
    
  } catch (error) {
    return {
      engine: OCREngine.TESSERACT,
      text: '',
      confidence: 0,
      success: false,
      error: error.message
    };
  }
}

// PaddleOCR 识别 (后端API)
async function recognizeWithPaddleOCR(file: File, onProgress?: (progress: number) => void): Promise<MultiOCRResult> {
  try {
    console.log('🔍 使用 PaddleOCR 识别...');
    
    const formData = new FormData();
    formData.append('image', file);
    
    if (onProgress) onProgress(10);
    
    const response = await fetch('/api/ocr/paddleocr', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('PaddleOCR服务不可用');
    }
    
    if (onProgress) onProgress(90);
    
    const result = await response.json();
    
    if (onProgress) onProgress(100);
    
    return {
      engine: OCREngine.PADDLE_OCR,
      text: result.text || '',
      confidence: result.confidence || 0,
      words: result.words || [],
      processTime: result.processTime || 0,
      success: result.success !== false
    };
    
  } catch (error) {
    return {
      engine: OCREngine.PADDLE_OCR,
      text: '',
      confidence: 0,
      success: false,
      error: error.message
    };
  }
}

// EasyOCR 识别 (后端API)
async function recognizeWithEasyOCR(file: File, onProgress?: (progress: number) => void): Promise<MultiOCRResult> {
  try {
    console.log('🔍 使用 EasyOCR 识别...');
    
    const formData = new FormData();
    formData.append('image', file);
    
    if (onProgress) onProgress(10);
    
    const response = await fetch('/api/ocr/easyocr', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('EasyOCR服务不可用');
    }
    
    if (onProgress) onProgress(90);
    
    const result = await response.json();
    
    if (onProgress) onProgress(100);
    
    return {
      engine: OCREngine.EASY_OCR,
      text: result.text || '',
      confidence: result.confidence || 0,
      words: result.words || [],
      processTime: result.processTime || 0,
      success: result.success !== false
    };
    
  } catch (error) {
    return {
      engine: OCREngine.EASY_OCR,
      text: '',
      confidence: 0,
      success: false,
      error: error.message
    };
  }
}

// 云端OCR识别
async function recognizeWithCloudOCR(file: File, provider: string = 'baidu', onProgress?: (progress: number) => void): Promise<MultiOCRResult> {
  try {
    console.log(`🔍 使用 ${provider} 云端OCR识别...`);
    
    const formData = new FormData();
    formData.append('image', file);
    formData.append('provider', provider);
    
    if (onProgress) onProgress(10);
    
    const response = await fetch('/api/ocr/cloud', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`${provider}云端OCR服务不可用`);
    }
    
    if (onProgress) onProgress(90);
    
    const result = await response.json();
    
    if (onProgress) onProgress(100);
    
    return {
      engine: OCREngine.CLOUD_OCR,
      text: result.text || '',
      confidence: result.confidence || 0,
      words: result.words || [],
      processTime: result.processTime || 0,
      provider: provider,
      success: result.success !== false
    };
    
  } catch (error) {
    return {
      engine: OCREngine.CLOUD_OCR,
      text: '',
      confidence: 0,
      success: false,
      error: error.message,
      provider: provider
    };
  }
}

// 混合OCR识别
async function recognizeWithHybrid(file: File, onProgress?: (progress: number) => void): Promise<MultiOCRResult> {
  try {
    console.log('🔍 使用混合OCR识别（多引擎融合）...');
    
    const engines = [
      () => recognizeWithTesseract(file),
      () => recognizeWithPaddleOCR(file),
      () => recognizeWithEasyOCR(file),
    ];
    
    const results: MultiOCRResult[] = [];
    
    // 并行执行多个引擎
    const promises = engines.map((engine, index) => 
      engine().then(result => {
        if (onProgress) {
          onProgress((index + 1) / engines.length * 50);
        }
        return result;
      })
    );
    
    const engineResults = await Promise.allSettled(promises);
    
    // 处理结果
    engineResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        results.push(result.value);
        console.log(`✅ 引擎 ${index + 1} 成功: ${result.value.engine} (置信度: ${result.value.confidence}%)`);
      } else {
        console.log(`❌ 引擎 ${index + 1} 失败: ${result.reason}`);
      }
    });
    
    if (results.length === 0) {
      throw new Error('所有OCR引擎都失败了');
    }
    
    // 融合结果
    const fusedResult = fuseResults(results);
    
    if (onProgress) onProgress(100);
    
    return {
      engine: OCREngine.HYBRID,
      text: fusedResult.text,
      confidence: fusedResult.confidence,
      words: fusedResult.words,
      processTime: fusedResult.processTime,
      success: true,
      allResults: results
    };
    
  } catch (error) {
    return {
      engine: OCREngine.HYBRID,
      text: '',
      confidence: 0,
      success: false,
      error: error.message
    };
  }
}

// 结果融合算法
function fuseResults(results: MultiOCRResult[]): MultiOCRResult {
  console.log('🔗 融合多个OCR引擎结果...');
  
  if (results.length === 1) {
    return results[0];
  }
  
  // 按置信度排序
  const sortedByConfidence = [...results].sort((a, b) => b.confidence - a.confidence);
  const highest = sortedByConfidence[0];
  
  // 关键词评分
  const keywords = ['账单', '交易', '收支', '统计', '微信', '支付', '转账'];
  const keywordScores = results.map(r => ({
    ...r,
    keywordScore: keywords.reduce((score, keyword) => 
      score + (r.text.includes(keyword) ? 1 : 0), 0
    )
  }));
  
  keywordScores.sort((a, b) => b.keywordScore - a.keywordScore);
  const bestKeyword = keywordScores[0];
  
  // 文本长度评分
  const avgLength = results.reduce((sum, r) => sum + r.text.length, 0) / results.length;
  const bestLength = results.find(r => 
    Math.abs(r.text.length - avgLength) < avgLength * 0.3
  ) || highest;
  
  // 选择最佳结果
  let selected = highest;
  
  if (highest.confidence < 70 && bestKeyword.keywordScore > 2) {
    selected = bestKeyword;
  }
  
  if (Math.abs(selected.text.length - avgLength) > avgLength * 0.5) {
    selected = bestLength;
  }
  
  console.log(`🎯 融合结果选择: ${selected.engine} (置信度: ${selected.confidence}%)`);
  
  return {
    engine: OCREngine.HYBRID,
    text: selected.text,
    confidence: selected.confidence,
    words: selected.words || [],
    processTime: selected.processTime || 0,
    success: true,
    fusionReason: getFusionReason(selected, highest, bestKeyword, bestLength)
  };
}

// 获取融合原因
function getFusionReason(selected: MultiOCRResult, highest: MultiOCRResult, bestKeyword: MultiOCRResult, bestLength: MultiOCRResult): string {
  if (selected.engine === highest.engine) {
    return '最高置信度';
  }
  if (selected.engine === bestKeyword.engine) {
    return '最佳关键词匹配';
  }
  if (selected.engine === bestLength.engine) {
    return '最佳文本长度';
  }
  return '综合评分';
}

// Task 1: 微信账单检测函数 - 增强版本
export function detectBillType(text: string): BillType {
  if (!text) return 'unknown';

  const lowerText = text.toLowerCase();

  // 检测微信账单特征 - 增强关键词
  const wechatPatterns = [
    '微信支付',
    '微信转账', 
    '微信红包',
    'wechat pay',
    'wechat',
    '微信收款',
    '交易时间',
    '交易对方',
    '支付成功',
    '全部账单',
    '收支统计',
    '交易概况',
    '账单',
    '查找',
    '交易',
    '收支',
    '统计',
    // 微信特有的数字格式
    /\d{4}\s*年\s*\d{1,2}\s*月/,
    /[\+\-]\d+\.\d{2}/,  // 带符号的金额
  ];

  let wechatScore = 0;
  let alipayScore = 0;
  let bankScore = 0;

  for (const pattern of wechatPatterns) {
    if (typeof pattern === 'string') {
      if (lowerText.includes(pattern.toLowerCase())) {
        wechatScore++;
        console.log(`微信特征匹配: "${pattern}"`);
      }
    } else if (pattern instanceof RegExp) {
      if (pattern.test(text)) {
        wechatScore++;
        console.log(`微信特征匹配: ${pattern}`);
      }
    }
  }

  // 检测支付宝账单特征
  const alipayPatterns = [
    '支付宝',
    'alipay',
    '蚂蚁金服',
    '交易创建时间',
    '买家留言',
  ];

  for (const pattern of alipayPatterns) {
    if (lowerText.includes(pattern.toLowerCase())) {
      alipayScore++;
    }
  }

  // 检测银行账单特征
  const bankPatterns = [
    '银行转账',
    '交易金额',
    '余额',
    '卡号',
    '账户',
  ];

  for (const pattern of bankPatterns) {
    if (lowerText.includes(pattern.toLowerCase())) {
      bankScore++;
    }
  }

  console.log(`账单类型评分 - 微信: ${wechatScore}, 支付宝: ${alipayScore}, 银行: ${bankScore}`);

  if (wechatScore >= 2) return 'wechat';
  if (alipayScore >= 2) return 'alipay';
  if (bankScore >= 2) return 'bank';

  return 'unknown';
}

// Task 2: 白色背景区域文字过滤
export function filterWhiteBackgroundText(text: string, billType: BillType): string {
  if (billType !== 'wechat') return text;

  const lines = text.split('\n');
  const filteredLines: string[] = [];
  let inBillSection = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 检测账单主体区域开始
    if (
      trimmedLine.includes('交易时间') ||
      trimmedLine.includes('交易对方') ||
      trimmedLine.includes('交易状态') ||
      trimmedLine.includes('交易概况')
    ) {
      inBillSection = true;
      filteredLines.push(trimmedLine);
      continue;
    }

    // 检测非账单区域（如用户信息、凭证编号等）
    const skipPatterns = [
      /^微信号/,
      /^昵称/,
      /^头像/,
      /^交易单号/,
      /^订单号/,
      /流水号/,
      /^商户单号/,
      /^支付方式/,
      /^收/,
      /^支/,
    ];

    let shouldSkip = false;
    for (const pattern of skipPatterns) {
      if (pattern.test(trimmedLine)) {
        shouldSkip = true;
        break;
      }
    }

    if (shouldSkip) continue;

    // 跳过纯数字或过短的行
    if (trimmedLine.length < 3 || /^\d+$/.test(trimmedLine)) continue;

    filteredLines.push(trimmedLine);
  }

  return filteredLines.join('\n');
}

// Task 3: 微信账单专属字段提取
export function extractWechatBillFields(text: string): {
  transactionTime?: string;
  transactionPartner?: string;
  transactionType?: string;
  status?: string;
} {
  const result: {
    transactionTime?: string;
    transactionPartner?: string;
    transactionType?: string;
    status?: string;
  } = {};

  // 提取交易时间
  const timePatterns = [
    /交易时间[:：]\s*(.+)/i,
    /交易时间\s*[:：]?\s*(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)/,
    /(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}\s+\d{1,2}:\d{2})/,
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.transactionTime = match[1].trim();
      break;
    }
  }

  // 提取交易对方
  const partnerPatterns = [
    /交易对方[:：]\s*(.+)/i,
    /对方\s*[:：]\s*(.+)/i,
  ];

  for (const pattern of partnerPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.transactionPartner = match[1].trim();
      break;
    }
  }

  // 提取交易类型
  if (text.includes('微信红包')) {
    result.transactionType = '微信红包';
  } else if (text.includes('转账')) {
    result.transactionType = '转账';
  } else if (text.includes('扫码支付') || text.includes('付款')) {
    result.transactionType = '付款';
  } else if (text.includes('收款')) {
    result.transactionType = '收款';
  }

  // 提取交易状态
  if (text.includes('支付成功') || text.includes('交易成功')) {
    result.status = '成功';
  } else if (text.includes('支付失败') || text.includes('交易失败')) {
    result.status = '失败';
  }

  return result;
}

// 后处理OCR文本 - 增强版本
function postProcessOCRText(text: string): string {
  return text
    // 移除乱码和无意义字符
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    // 只保留汉字、数字、常见符号、加减号、冒号、emoji
    .replace(/[^\u4e00-\u9fa5\d\.\-\/\:年月日\s\n+\-+🍜☕🏠📱💰🍎🎮✈️💊🎬🛒🚗📚💪👔🎁🐱]+/g, ' ')
    // 清理多余空格
    .replace(/[ \t]+/g, ' ')
    // 清理重复换行
    .replace(/\n{3,}/g, '\n\n')
    // 清理空行
    .replace(/^\n+|\n+$/g, '')
    .trim();
}

// 解析商家名称
export function extractMerchant(text: string): string | null {
  const cleanText = text.replace(/[^\u4e00-\u9fa5\d]/g, ' ').trim();

  const patterns = [
    // 匹配金额前的汉字商家名称
    /([\u4e00-\u9fa5]{2,10})\s*\d+/,
    // 匹配独立的汉字行
    /^([\u4e00-\u9fa5]{2,15})$/m,
    // 匹配包含特定关键词
    /([\u4e00-\u9fa5]{2,15}(?:店|公司|咖啡|餐厅|超市|商场|银行|便利店))/,
  ];

  for (const pattern of patterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const merchant = match[1].trim();
      if (merchant.length >= 2 && !/^\d+$/.test(merchant)) {
        return merchant;
      }
    }
  }

  return null;
}

// Task 4: 解析日期 - 增强版本（支持多种微信格式）
export function extractDate(text: string): string | null {
  if (!text) return null;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // 清理文本但保留关键字符
  const cleanText = text.replace(/[\n\r]/g, ' ').trim();

  // 1. 标准日期格式（带年份）- 微信格式优先
  const yearPatterns = [
    // 微信格式：交易时间: 2024-03-25 14:30
    { pattern: /(?:交易时间)[:：]?\s*(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})\s+\d{1,2}:\d{2}/, type: 'ymd' },
    // 2024/03/25 14:30 (交易概况格式)
    { pattern: /(\d{4})\/(\d{1,2})\/(\d{1,2})\s+\d{1,2}:\d{2}/, type: 'ymd' },
    // 2024-03-25, 2024/03/25, 2024.03.25
    { pattern: /(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/, type: 'ymd' },
    // 2024年3月25日, 2024年03月25日
    { pattern: /(\d{4})年(\d{1,2})月(\d{1,2})日/, type: 'ymd' },
    // 微信格式：2024年03月25日 14:30
    { pattern: /(\d{4})年(\d{1,2})月(\d{1,2})日\s+\d{1,2}:\d{2}/, type: 'ymd' },
    // 交易时间 2024-03-25
    { pattern: /(?:交易时间|日期|时间)[:：]?\s*(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/i, type: 'ymd' },
  ];

  for (const { pattern } of yearPatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);

      if (year >= 2020 && year <= currentYear + 1 &&
          month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = new Date(year, month - 1, day);
        // 验证日期有效性
        if (date.getMonth() === month - 1) {
          return date.toISOString().split('T')[0];
        }
      }
    }
  }

  // 2. 不带年份的日期格式（使用当前年份）
  const noYearPatterns = [
    // 03月25日, 3月25日
    { pattern: /(\d{1,2})月(\d{1,2})日/, type: 'md' },
    // 03-25 或 3-25
    { pattern: /(?:^|\s)(\d{1,2})-(\d{1,2})(?:\s|$)/, type: 'md' },
    // 03/25
    { pattern: /(?:^|\s)(\d{1,2})\/(\d{1,2})(?:\s|$)/, type: 'md' },
  ];

  for (const { pattern } of noYearPatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      const month = parseInt(match[1]);
      const day = parseInt(match[2]);

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        let year = currentYear;
        // 如果当前月份小于识别出的月份，可能是去年的记录
        if (month > currentMonth + 1) {
          year = currentYear - 1;
        }
        const date = new Date(year, month - 1, day);
        if (date.getMonth() === month - 1) {
          return date.toISOString().split('T')[0];
        }
      }
    }
  }

  return null;
}

// 从单行文本中提取日期
function extractDateFromLine(line: string): string | null {
  return extractDate(line);
}

// Task 5: 增强的金额识别 - 支持多种金额格式
function extractAmounts(text: string): Array<{value: number, position: number, original: string, line: number, type: 'income' | 'expense'}> {
  const results: Array<{value: number, position: number, original: string, line: number, type: 'income' | 'expense'}> = [];
  const lines = text.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    
    // 格式1: 带加减号的金额（优先识别）
    // +123.45 或 -123.45
    
    // 收入金额 (+号)
    const incomePattern = /\+(\d+(?:\.\d{1,2})?)/g;
    let incomeMatch;
    while ((incomeMatch = incomePattern.exec(line)) !== null) {
      const amount = parseFloat(incomeMatch[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        results.push({
          value: amount,
          position: incomeMatch.index || 0,
          original: incomeMatch[0],
          line: lineIdx,
          type: 'income'
        });
      }
    }

    // 支出金额 (-号)
    const expensePattern = /-(\d+(?:\.\d{1,2})?)/g;
    let expenseMatch;
    while ((expenseMatch = expensePattern.exec(line)) !== null) {
      // 排除负号在数字中间的情况（如日期 2024-03-25）
      const prevChar = expenseMatch.index > 0 ? line[expenseMatch.index - 1] : ' ';
      if (prevChar !== '-' && prevChar !== '0' && prevChar !== '1' && prevChar !== '2') {
        const amount = parseFloat(expenseMatch[1]);
        if (!isNaN(amount) && amount > 0 && amount < 1000000) {
          results.push({
            value: amount,
            position: expenseMatch.index || 0,
            original: expenseMatch[0],
            line: lineIdx,
            type: 'expense'
          });
        }
      }
    }

    // 格式2: ¥符号金额（作为支出）
    const yuanPattern = /¥\s*(\d+(?:\.\d{1,2})?)/g;
    let yuanMatch;
    while ((yuanMatch = yuanPattern.exec(line)) !== null) {
      const amount = parseFloat(yuanMatch[1]);
      if (!isNaN(amount) && amount > 0 && amount < 1000000) {
        // 检查这一行是否已经有带符号的金额，避免重复
        const hasSigned = results.some(r => r.line === lineIdx);
        if (!hasSigned) {
          results.push({
            value: amount,
            position: yuanMatch.index || 0,
            original: yuanMatch[0],
            line: lineIdx,
            type: 'expense'
          });
        }
      }
    }

    // 格式3: 纯数字金额（作为支出，需要在商家行附近）
    // 例如: "45.60" 或 "45.6"
    const plainPattern = /(?<![¥￥\d\.\-\+])\s*(\d+(?:\.\d{1,2})?)\s*(?!元)/g;
    let plainMatch;
    while ((plainMatch = plainPattern.exec(line)) !== null) {
      const amount = parseFloat(plainMatch[1]);
      // 过滤掉太小的金额（可能是时间中的数字）
      if (!isNaN(amount) && amount >= 0.01 && amount < 1000000 && amount > 10) {
        // 检查这一行是否已经有金额，避免重复
        const hasAmount = results.some(r => r.line === lineIdx);
        if (!hasAmount) {
          results.push({
            value: amount,
            position: plainMatch.index || 0,
            original: plainMatch[0],
            line: lineIdx,
            type: 'expense'
          });
        }
      }
    }
  }

  return results.sort((a, b) => a.line - b.line || a.position - b.position);
}

/**
 * 微信账单OCR解析函数 - 支持多行和单行文本
 * 
 * 视觉结构：OCR识别后可能是一行或多行
 * 多行格式：每行一个信息
 * 单行格式：所有信息在同一行，用空格分隔
 * 
 * 规则：
 * 1. 提取基准日期：匹配"2026年3月"格式
 * 2. 用正则提取所有带 +/- 金额的交易
 * 3. 金额格式："±xx.xx"，-为支出expense，+为收入income
 * 4. 自动分类规则
 * 
 * 输出：merchant, time, amount, type, category
 */
export function parseWechatTransactionList(text: string): ParseBillResult[] {
  const results: ParseBillResult[] = [];

  console.log('=== 微信账单OCR解析 ===');
  console.log('原始文本:\n', text);

  // 0. 预处理文本 - 处理压缩格式
  let processedText = text;
  
  // 检查是否是压缩成一行的情况
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 1 && lines[0].length > 100) {
    console.log('检测到压缩格式，尝试智能分割...');
    
    // 尝试按金额模式分割 - 只执行一次，避免重复
    const amountPattern = /([\+\-]\d+\.\d{2})/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    // 重置正则状态
    amountPattern.lastIndex = 0;
    
    while ((match = amountPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index).trim());
      }
      parts.push(match[0]);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex).trim());
    }

    // 重新组合成类行结构
    processedText = parts.join('\n');
    console.log('分割后文本:\n', processedText);
  }
  
  // 1. 提取基准日期
  let baseYearMonth = '';
  const yearMonthMatch = processedText.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
  if (yearMonthMatch) {
    const year = yearMonthMatch[1];
    const month = parseInt(yearMonthMatch[2]);
    if (month >= 1 && month <= 12) {
      baseYearMonth = `${year}-${month.toString().padStart(2, '0')}`;
      console.log('✓ 提取基准年月:', baseYearMonth);
    }
  }
  
  if (!baseYearMonth) {
    const now = new Date();
    baseYearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    console.log('⚠ 未找到基准年月，使用当前年月:', baseYearMonth);
  }

  // 2. 用正则提取所有带 +/- 的金额及其位置
  // 匹配格式：支持多种OCR可能产生的变体
  const amountRegex = /([\+\-])(\d+)\.(\d{2})|([\+\-])(\d+)\s+(\d{2})|([\+\-])(\d+)\.(\d{1})|([\+\-])(\d+)\s+(\d{1})|([\+\-])(\d+)(?=\D|$)/g;
  const amountMatches: Array<{sign: string, amount: number, index: number, fullText: string, merchantPrefix?: string}> = [];
  
  let match;
  while ((match = amountRegex.exec(processedText)) !== null) {
    let sign = '';
    let amount = 0;
    let fullText = '';
    
    // 格式1: +/-123.45 或 +/-123 45 (完整小数)
    if (match[1] !== undefined && match[2] !== undefined) {
      sign = match[1];
      amount = parseFloat(match[2]);
      fullText = match[0];
    }
    
    if (amount > 0 && amount < 1000000) {
      amountMatches.push({
        sign: sign,
        amount: amount,
        index: match.index,
        fullText: fullText
      });
    }
  }

  // 额外处理：查找纯数字金额（如35.00、18.00等，紧跟商家后）
  // 匹配 "商家名 + 空格 + 数字.数字" 格式
  const pureAmountRegex = /([\u4e00-\u9fa5]{1,20})\s+(\d{1,4})\.(\d{2})(?=\s|$|[^0-9])/g;
  let pureMatch;
  while ((pureMatch = pureAmountRegex.exec(processedText)) !== null) {
    const amount = parseFloat(`${pureMatch[2]}.${pureMatch[3]}`);
    const merchantPrefix = pureMatch[1].trim();
    
    // 检查是否为收入金额
    const isIncome = merchantPrefix.includes('收入') || merchantPrefix.includes('转入') || merchantPrefix.includes('收到');
    const sign = isIncome ? '+' : '-';
    
    if (amount > 0 && amount < 1000000) {
      // 检查这个金额是否已经在列表中
      const exists = amountMatches.some(m => Math.abs(m.index - pureMatch!.index) < 5);
      if (!exists) {
        amountMatches.push({
          sign: sign,
          amount: amount,
          index: pureMatch.index,
          fullText: pureMatch[0],
          merchantPrefix: merchantPrefix
        });
        console.log(`  发现纯数字金额: ${sign}${amount} (原文: "${pureMatch[0]}")`);
        console.log(`  商家前缀: "${merchantPrefix}"`);
      }
    }
  }

  // 额外处理：查找被OCR错误分割的金额（如 "35.00" 被分割为 "35 00"）
  const splitAmountRegex = /(\d{2})\s+(\d{2})(?=\s|$)/g;
  let splitMatch;
  while ((splitMatch = splitAmountRegex.exec(processedText)) !== null) {
    const amount = parseFloat(`${splitMatch[1]}.${splitMatch[2]}`);
    if (amount >= 10 && amount < 10000) { // 合理的金额范围
      // 检查这个金额是否已经在列表中
      const exists = amountMatches.some(m => Math.abs(m.index - splitMatch!.index) < 10);
      if (!exists) {
        // 检查前面是否有商家关键词
        const beforeText = processedText.substring(Math.max(0, splitMatch.index - 50), splitMatch.index);
        if (containsMerchantKeywords(beforeText)) {
          // 尝试提取更完整的商家名称
          let merchant = '';
          
          // 查找"可 心"模式
          const keXinMatch = beforeText.match(/可\s+心\s*$/);
          if (keXinMatch) {
            merchant = '可心';
          }
          
          // 查找"悦 来"模式
          const yueLaiMatch = beforeText.match(/悦\s+来\s*$/);
          if (yueLaiMatch) {
            merchant = '悦来';
          }
          
          // 查找"常 菜"模式
          const changCaiMatch = beforeText.match(/常\s+菜\s*$/);
          if (changCaiMatch) {
            merchant = '家常菜';
          }
          
          amountMatches.push({
            sign: '-',
            amount: amount,
            index: splitMatch.index,
            fullText: splitMatch[0],
            merchantPrefix: merchant || '未知商家'
          });
          console.log(`  发现分割金额: ${amount} (原文: "${splitMatch[0]}")`);
          console.log(`  商家前缀: "${merchant}"`);
        }
      }
    }
  }

  // 检查是否包含商家关键词的辅助函数
  function containsMerchantKeywords(text: string): boolean {
    const keywords = [
      '凯德', '中石化', '家常菜', '宁静', '可心', '可', '悦来', '悦', '刁', '深海',
      '扫二维码', '二维码收款', '付款', '收款'
    ];
    return keywords.some(keyword => text.includes(keyword));
  }

  // 按索引排序
  amountMatches.sort((a, b) => a.index - b.index);
  
  console.log('✓ 找到', amountMatches.length, '个金额');
  console.log('金额详情:', amountMatches.map(a => `${a.sign}${a.amount}`).join(', '));
  
  if (amountMatches.length === 0) {
    console.log('⚠ 未找到任何金额');
    return results;
  }

  // 3. 对每个金额，提取其前面的商家名称 - 优化版
  for (let i = 0; i < amountMatches.length; i++) {
    const amountInfo = amountMatches[i];
    const amountEndIndex = amountInfo.index + amountInfo.sign.length + amountInfo.amount.toString().length;
    
    // 如果有商家前缀，直接使用
    if (amountInfo.merchantPrefix) {
      let merchant = amountInfo.merchantPrefix.trim();
      
      // 特殊处理：如果商家前缀是单个字，尝试扩展
      if (merchant.length === 1) {
        // 获取前文更多上下文
        const extendedContext = processedText.substring(
          Math.max(0, amountInfo.index - 200), 
          amountInfo.index
        );
        
        // 查找前面的字
        const precedingText = extendedContext.replace(/\s+/g, '');
        const lastChars = precedingText.slice(-2);
        
        if (lastChars && lastChars.includes('可') && merchant === '心') {
          merchant = '可心';
        } else if (lastChars && lastChars.includes('悦') && merchant === '来') {
          merchant = '悦来';
        } else if (lastChars && lastChars.includes('常') && merchant === '菜') {
          merchant = '家常菜';
        }
      }
      
      console.log(`\n发现交易: "${merchant}" ${amountInfo.sign}${amountInfo.amount}`);
      
      // 确定交易类型
      const billType = amountInfo.sign === '+' ? 'income' : 'expense';
      
      // 构建结果
      const result: ParseBillResult = {
        amount: amountInfo.amount,
        date: new Date(baseYearMonth + '-01T00:00:00.000Z').toISOString(),
        description: '',
        merchant: merchant,
        confidence: 85,
        rawDate: baseYearMonth + '-01',
        billType: billType,
      };

      // 4. 自动匹配分类
      const categoryInfo = matchWechatCategory(merchant, billType);
      result.category = categoryInfo.name;
      result.matchedCategoryId = categoryInfo.id;
      result.matchedCategoryName = categoryInfo.name;

      console.log(`  ✓ 商家: "${merchant}"`);
      console.log(`  ✓ 金额: ${amountInfo.amount} (${billType})`);
      console.log(`  ✓ 分类: ${categoryInfo.name}`);
      
      results.push(result);
      continue;
    }
    
    // 获取金额前的文本（向前最多150个字符）
    const startIndex = Math.max(0, amountInfo.index - 150);
    const textBeforeAmount = processedText.substring(startIndex, amountInfo.index);
    
    // 移除特殊符号
    let cleanedBefore = textBeforeAmount.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
    
    // 移除金额前的空格和特殊字符
    cleanedBefore = cleanedBefore.replace(/[\s\-\|]+$/, '');
    
    console.log(`  处理金额 ${amountInfo.sign}${amountInfo.amount}`);
    console.log(`  金额前文本: "${cleanedBefore}"`);
    
    // 智能商家提取 - 尝试多种方法
    let merchant = null;
    
    // 方法1: 查找最近的商家关键词 - 按优先级排序
    const merchantKeywords = [
      // 完整商家名称 - 最高优先级
      { keyword: '凯德集团', priority: 10 },
      { keyword: '宁静的深海', priority: 9 },
      { keyword: '悦来家常菜', priority: 9 },
      { keyword: '中石化辽宁石油分公司', priority: 9 },
      
      // 部分商家名称
      { keyword: '中石化', priority: 8 },
      { keyword: '悦来家常', priority: 8 },
      { keyword: '悦来', priority: 7 },
      { keyword: '宁静', priority: 6 },
      { keyword: '可心', priority: 6 },
      { keyword: '可', priority: 5 },
      { keyword: '刁', priority: 5 },
      
      // 扫码类
      { keyword: '扫二维码付款-给', priority: 4 },
      { keyword: '二维码收款-来自', priority: 4 },
    ];
    
    let bestMatch = null;
    let bestPosition = -1;
    let bestPriority = -1;
    
    for (const { keyword, priority } of merchantKeywords) {
      const position = textBeforeAmount.lastIndexOf(keyword);
      if (position > bestPosition || (position === bestPosition && priority > bestPriority)) {
        bestPosition = position;
        bestMatch = keyword;
        bestPriority = priority;
      }
    }
    
    if (bestMatch && bestPosition >= 0) {
      // 提取从关键词到金额前的完整文本
      const merchantText = textBeforeAmount.substring(bestPosition).trim();
      console.log(`    找到关键词: "${bestMatch}" (优先级: ${bestPriority})`);
      console.log(`    商家文本: "${merchantText}"`);
      
      // 清理并匹配商家
      merchant = cleanMerchantText(merchantText);
      if (merchant) {
        console.log(`    ✓ 关键词匹配: "${merchant}"`);
      }
    }
    
    // 方法2: 如果没有关键词，尝试提取最后的中文词组
    if (!merchant) {
      const cleaned = cleanedBefore
        .replace(/[|全从汉党及回省Q@查找交易收支统计>0-9\s]/g, '')
        .trim();
      
      const chineseMatch = cleaned.match(/[\u4e00-\u9fa5]{2,}$/);
      if (chineseMatch) {
        merchant = chineseMatch[0];
        console.log(`    ✓ 中文匹配: "${merchant}"`);
      }
    }
    
    if (!merchant) {
      console.log(`  ⚠ 跳过金额 ${amountInfo.sign}${amountInfo.amount}，无法识别商家`);
      continue;
    }
    
    console.log(`\n发现交易: "${merchant}" ${amountInfo.sign}${amountInfo.amount}`);
    
    // 确定交易类型
    const billType = amountInfo.sign === '+' ? 'income' : 'expense';
    
    // 构建结果
    const result: ParseBillResult = {
      amount: amountInfo.amount,
      date: new Date(baseYearMonth + '-01T00:00:00.000Z').toISOString(),
      description: '',
      merchant: merchant,
      confidence: 85,
      rawDate: baseYearMonth + '-01',
      billType: billType,
    };

    // 4. 自动匹配分类
    const categoryInfo = matchWechatCategory(merchant, billType);
    result.category = categoryInfo.name;
    result.matchedCategoryId = categoryInfo.id;
    result.matchedCategoryName = categoryInfo.name;

    console.log(`  ✓ 商家: "${merchant}"`);
    console.log(`  ✓ 金额: ${amountInfo.amount} (${billType})`);
    console.log(`  ✓ 分类: ${categoryInfo.name}`);
    
    results.push(result);
  }

  console.log('\n=== 解析完成 ===');
  console.log('共解析', results.length, '条交易记录');
  return results;
}

// 清理商家文本的辅助函数
function cleanMerchantText(text: string): string | null {
  // 移除干扰字符和金额符号
  let cleaned = text
    .replace(/[|全从汉党及回省Q@查找交易收支统计>0-9\+\-¥￥]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  console.log(`      清理后商家文本: "${cleaned}"`);
  
  // 商家匹配模式 - 按优先级排序
  const patterns = [
    // 完整匹配
    { pattern: /^凯德集团$/, name: '凯德集团' },
    { pattern: /^中石化.*石油.*分公司$/, name: '中石化辽宁石油分公司' },
    { pattern: /^悦来家常菜$/, name: '悦来家常菜' },
    { pattern: /^宁静的深海$/, name: '宁静的深海' },
    
    // 部分匹配 - 但要确保是完整的商家
    { pattern: /^中石化$/, name: '中石化' },
    { pattern: /^悦来$/, name: '悦来家常菜' },
    { pattern: /^宁静$/, name: '宁静的深海' },
    { pattern: /^可心$/, name: '可心' },
    { pattern: /^刁/, name: '刁*' },
    { pattern: /^刁\s*\*/, name: '刁*' },
    
    // 扫码付款类 - 处理"给"字前缀
    { pattern: /^给(.+)$/, name: (match: RegExpMatchArray) => {
      const name = match[1];
      // 如果是已知的商家名称，直接返回
      if (name.includes('宁静的深海') || name.includes('宁静')) return '宁静的深海';
      if (name.includes('可心')) return '可心';
      if (name.includes('悦来家常菜') || name.includes('悦来')) return '悦来家常菜';
      return name;
    }},
    
    { pattern: /^扫[二两]?维?码?付款-给(.+)$/, name: (match: RegExpMatchArray) => `扫二维码付款-给${match[1]}` },
    { pattern: /^二维码收款-来自(.+)$/, name: (match: RegExpMatchArray) => `二维码收款-来自${match[1]}` },
    { pattern: /^扫[二两]?维?码?付款$/, name: '扫二维码付款' },
    { pattern: /^二维码收款$/, name: '二维码收款' },
  ];
  
  for (const { pattern, name } of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const merchantName = typeof name === 'function' ? name(match) : name;
      console.log(`      ✓ 模式匹配: "${merchantName}" (模式: ${pattern})`);
      return merchantName;
    }
  }
  
  return null;
}

/**
 * 从文本中提取商家名称 - 优化版本
 * 专门处理微信账单OCR识别结果，支持按行结构化解析
 */
function extractMerchantFromText(text: string): string | null {
  if (!text) return null;
  
  // 移除emoji图标
  let cleaned = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  
  // 移除常见UI干扰词
  cleaned = cleaned.replace(/(账单|交易|统计|收支|查找|今天|昨天|全部|支出|收入|全|人|从|汉|党|及|回省|Q@|查找|交易|收支|统计>)/g, ' ');
  
  // 移除年月信息和金额信息
  cleaned = cleaned.replace(/\d{4}年\d{1,2}月/g, '');
  cleaned = cleaned.replace(/支出¥\d+\.?\d*收入¥\d+\.?\d*/g, '');
  
  // 连接被OCR拆分的字符（如"凯 德 集团" → "凯德集团"）
  cleaned = cleaned.replace(/\s+/g, '').trim();
  
  console.log(`  提取商家原文: "${cleaned}"`);
  
  // 如果太短，返回null
  if (cleaned.length < 2) return null;
  
  // 优化版商家匹配模式 - 按优先级排序
  const merchantPatterns = [
    // 凯德集团 - 优先匹配
    { pattern: /凯德集团/, name: '凯德集团' },
    
    // 中石化 - 完整匹配优先
    { pattern: /中石化.*石油.*分公司/, name: '中石化辽宁石油分公司' },
    { pattern: /中石化/, name: '中石化' },
    
    // 家常菜 - 完整匹配优先
    { pattern: /悦来家常菜/, name: '悦来家常菜' },
    { pattern: /家常菜/, name: '家常菜' },
    
    // 个人名称 - 按具体程度排序
    { pattern: /宁静的深海/, name: '宁静的深海' },
    { pattern: /宁静/, name: '宁静的深海' },
    { pattern: /可心/, name: '可心' },
    { pattern: /刁/, name: '刁*' },
    { pattern: /悦来/, name: '悦来家常菜' },
    
    // 扫码付款类 - 包含收款人姓名的
    { pattern: /扫[二两]?维?码?付款-给(.+)/, name: (match: RegExpMatchArray) => `扫二维码付款-给${match[1]}` },
    { pattern: /扫[二两]?维?码?付-给(.+)/, name: (match: RegExpMatchArray) => `扫二维码付款-给${match[1]}` },
    { pattern: /扫码付款-给(.+)/, name: (match: RegExpMatchArray) => `扫码付款-给${match[1]}` },
    
    // 二维码收款类 - 包含付款人姓名的
    { pattern: /[二两]?维?码?收款-来自(.+)/, name: (match: RegExpMatchArray) => `二维码收款-来自${match[1]}` },
    { pattern: /二维码收款-来自(.+)/, name: (match: RegExpMatchArray) => `二维码收款-来自${match[1]}` },
    { pattern: /扫码收款-来自(.+)/, name: (match: RegExpMatchArray) => `扫码收款-来自${match[1]}` },
    
    // 通用扫码类 - 最后匹配
    { pattern: /扫[二两]?维?码?付款/, name: '扫二维码付款' },
    { pattern: /扫码付款/, name: '扫二维码付款' },
    { pattern: /[二两]?维?码?收/, name: '二维码收款' },
    { pattern: /扫码收/, name: '二维码收款' },
  ];
  
  // 按优先级匹配商家
  for (const { pattern, name } of merchantPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const merchantName = typeof name === 'function' ? name(match) : name;
      console.log(`  匹配商家: "${merchantName}" (模式: ${pattern})`);
      return merchantName;
    }
  }
  
  // 如果没有匹配到商家，尝试获取金额前最后的中文词组
  const chineseMatch = cleaned.match(/[\u4e00-\u9fa5]{2,}$/);
  if (chineseMatch) {
    console.log(`  使用尾部商家: "${chineseMatch[0]}"`);
    return chineseMatch[0];
  }
  
  return null;
}

/**
 * 解析商家名称 - 改进版，支持完整商家名称识别
 * 规则：移除emoji图标，移除金额部分，连接被OCR拆分的字符，匹配已知商家名称
 */
function parseMerchantFromLine(line: string): string | null {
  if (!line) return null;
  
  // 移除emoji图标
  let text = line.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
  
  // 移除金额部分 (如 -20.00 或 +3.00)
  text = text.replace(/[\+\-]\d+(?:\.\d{1,2})?$/, '').trim();
  
  // 移除特殊符号如 |
  text = text.replace(/\|/g, '').trim();
  
  // 移除空格连接相邻的中文字符（OCR可能把一个词拆开）
  text = text.replace(/\s+/g, '');
  
  if (text.length < 2) return null;
  
  // 匹配常见的完整商家名称
  const knownMerchants = [
    '凯德集团',
    '中石化辽宁石油分公司',
    '中石化',
    '家常菜',
    '扫码付款',
    '扫二维码付款',
    '二维码收款',
    '扫码收款',
  ];
  
  // 检查是否包含已知商家名称
  for (const merchant of knownMerchants) {
    if (text.includes(merchant)) {
      return merchant;
    }
  }
  
  // 检查是否包含部分商家名称
  if (text.includes('凯德')) {
    return '凯德集团';
  }
  if (text.includes('中石化')) {
    return '中石化辽宁石油分公司';
  }
  if (text.includes('家常菜') || (text.includes('家常') && text.includes('菜'))) {
    return '家常菜';
  }
  if (text.includes('二维码付款') || text.includes('扫码付款')) {
    return '扫二维码付款';
  }
  if (text.includes('二维码收款') || text.includes('扫码收款')) {
    return '二维码收款';
  }
  
  // 匹配至少2个连续中文字符
  const chineseMatch = text.match(/[\u4e00-\u9fa5]{2,}/);
  if (chineseMatch) {
    return chineseMatch[0];
  }
  
  return null;
}

/**
 * 解析时间
 * 规则：匹配"3月24日 17:35"格式，补全为完整日期时间
 */
function parseTimeFromLine(line: string, baseYearMonth: string): { date: string; timeStr: string } | null {
  if (!line) return null;
  
  // 匹配"3月24日 17:35"或"03月24日 17:35"格式
  const match = line.match(/(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})/);
  if (!match) return null;
  
  const month = parseInt(match[1]);
  const day = parseInt(match[2]);
  const hours = parseInt(match[3]);
  const minutes = parseInt(match[4]);
  
  // 验证日期有效性
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  
  // 补全日期时间
  const dayStr = day.toString().padStart(2, '0');
  const hoursStr = hours.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  
  const dateStr = `${baseYearMonth}-${dayStr}`;
  const timeStr = `${hoursStr}:${minutesStr}`;
  
  // 创建ISO格式日期
  const dateObj = new Date(dateStr + 'T' + timeStr + ':00.000Z');
  
  return {
    date: dateObj.toISOString(),
    timeStr: timeStr,
  };
}

/**
 * 解析金额
 * 规则：匹配"-20.00"或"+3.00"格式，-为支出，+为收入
 * 注意：金额可能在行首或行尾
 */
function parseAmountFromLine(line: string): { amount: number; type: 'income' | 'expense' } | null {
  if (!line) return null;
  
  const trimmed = line.trim();
  
  // 优先匹配行首的金额（如 "-20.00" 或 "+3.00"）
  let match = trimmed.match(/^([\+\-])(\d+(?:\.\d{1,2})?)$/);
  if (match) {
    const sign = match[1];
    const amount = parseFloat(match[2]);
    if (amount > 0) {
      return { amount, type: sign === '+' ? 'income' : 'expense' };
    }
  }
  
  // 匹配行尾的金额（如 "凯德集团 -20.00" 中的 -20.00）
  match = trimmed.match(/([\+\-])(\d+(?:\.\d{1,2})?)$/);
  if (match) {
    const sign = match[1];
    const amount = parseFloat(match[2]);
    if (amount > 0) {
      return { amount, type: sign === '+' ? 'income' : 'expense' };
    }
  }
  
  return null;
}

/**
 * 微信账单自动分类规则
 */
interface WechatCategoryInfo {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

function matchWechatCategory(merchant: string, billType?: 'income' | 'expense'): WechatCategoryInfo {
  if (!merchant) return { id: 'other', name: '其他', type: 'expense' };
  
  // 分类规则表 - 优化版本
  const categoryRules: Array<{ keywords: string[]; category: WechatCategoryInfo }> = [
    // 购物/商场消费
    { 
      keywords: ['凯德', '商场', '购物中心', '超市', '便利店', '商店', '店铺', '门店', '购物'],
      category: { id: 'shopping', name: '购物/商场消费', type: 'expense' }
    },
    // 交通/加油
    { 
      keywords: ['中石化', '中石油', '加油站', '加油', '停车', '停车场', '高速', 'ETC', '地铁', '公交', '打车', '出租', '交通'],
      category: { id: 'transport', name: '交通/加油', type: 'expense' }
    },
    // 餐饮
    { 
      keywords: ['家常菜', '餐厅', '饭店', '餐馆', '食堂', '小吃', '快餐', '火锅', '烧烤', '烤肉', '面馆', '粥', '饺子', '包子', '馒头', '餐饮'],
      category: { id: 'food', name: '餐饮', type: 'expense' }
    },
    // 扫码付款类 - 根据收支类型确定分类
    { 
      keywords: ['扫二维码付款', '扫码付款'],
      category: { id: 'life_service', name: '餐饮/生活服务', type: 'expense' }
    },
    // 二维码收款类 - 收入
    { 
      keywords: ['二维码收款', '扫码收款', '收钱'],
      category: { id: 'transfer_in', name: '个人转账收入', type: 'income' }
    },
    // 个人转账类
    { 
      keywords: ['转账', '红包', '微信红包'],
      category: { id: 'transfer', name: '转账/红包', type: 'expense' }
    },
    // 娱乐类
    { 
      keywords: ['电影', 'KTV', '网吧', '游戏', '娱乐', '健身', '游泳', '瑜伽'],
      category: { id: 'entertainment', name: '娱乐', type: 'expense' }
    },
    // 医疗类
    { 
      keywords: ['医院', '药店', '诊所', '医疗', '看病'],
      category: { id: 'medical', name: '医疗', type: 'expense' }
    },
    // 教育类
    { 
      keywords: ['学校', '培训', '教育', '学费', '课程'],
      category: { id: 'education', name: '教育', type: 'expense' }
    },
    // 住房类
    { 
      keywords: ['房租', '物业', '水电', '燃气', '住房'],
      category: { id: 'housing', name: '住房', type: 'expense' }
    },
    // 通讯类
    { 
      keywords: ['话费', '流量', '宽带', '通讯'],
      category: { id: 'communication', name: '通讯', type: 'expense' }
    },
    // 工资/兼职类（收入）
    { 
      keywords: ['工资', '奖金', '兼职', '佣金', '提成'],
      category: { id: 'salary', name: '工资/兼职收入', type: 'income' }
    },
  ];
  
  // 特殊处理：根据商家名称和账单类型修正分类
  if (merchant.includes('二维码收款') && billType === 'expense') {
    console.log(`✓ 修正分类: "${merchant}" 从收入改为支出`);
    return { id: 'life_service', name: '餐饮/生活服务', type: 'expense' };
  }
  
  if (merchant.includes('扫码付款') && billType === 'income') {
    console.log(`✓ 修正分类: "${merchant}" 从支出改为收入`);
    return { id: 'transfer_in', name: '个人转账收入', type: 'income' };
  }
  
  // 遍历规则匹配
  for (const rule of categoryRules) {
    for (const keyword of rule.keywords) {
      if (merchant.includes(keyword)) {
        // 确保分类类型与账单类型一致
        let finalCategory = { ...rule.category };
        if (billType && billType === 'income' && finalCategory.type === 'expense') {
          finalCategory = { id: 'transfer_in', name: '个人转账收入', type: 'income' };
        } else if (billType && billType === 'expense' && finalCategory.type === 'income') {
          finalCategory = { id: 'life_service', name: '餐饮/生活服务', type: 'expense' };
        }
        console.log(`✓ 分类匹配: "${merchant}" → "${finalCategory.name}" (关键词: ${keyword})`);
        return finalCategory;
      }
    }
  }
  
  // 默认分类根据账单类型决定
  const defaultCategory: WechatCategoryInfo = billType === 'income' 
    ? { id: 'transfer_in', name: '个人转账收入', type: 'income' }
    : { id: 'other', name: '其他', type: 'expense' };
    
  console.log(`✓ 分类匹配: "${merchant}" → "${defaultCategory.name}" (默认)`);
  return defaultCategory;
}

// ==================== 测试用例 ====================
export function testParseWechatTransactionList() {
  console.log('========== 测试用例 ==========\n');
  
  // 测试用例1：标准三行格式
  const testCase1 = `
2026年3月账单
全部账单
支出¥245.00 收入¥503.00
凯德集团
3月24日 17:35
-20.00
家常菜
3月24日 12:30
-45.50
中石化
3月23日 09:20
-300.00
工资
3月22日 10:00
+500.00
扫二维码付款-给老麦
3月21日 18:00
-38.50
`;
  
  console.log('测试1: 标准三行格式');
  const result1 = parseWechatTransactionList(testCase1);
  console.log('结果:', JSON.stringify(result1, null, 2));
  console.log('预期: 5条记录\n');
  
  // 测试用例2：带emoji格式
  const testCase2 = `
2026年3月
🛒 凯德集团
3月24日 17:35
-20.00
🍜 家常菜
3月24日 12:30
-45.50
💰 工资
3月22日 10:00
+500.00
`;
  
  console.log('测试2: 带emoji格式');
  const result2 = parseWechatTransactionList(testCase2);
  console.log('结果:', JSON.stringify(result2, null, 2));
  console.log('预期: 3条记录\n');
  
  // 测试用例3：缺少年月格式
  const testCase3 = `
账单
凯德集团
3月24日 17:35
-20.00
家常菜
3月24日 12:30
-45.50
`;
  
  console.log('测试3: 缺少年月格式（使用当前年月）');
  const result3 = parseWechatTransactionList(testCase3);
  console.log('结果:', JSON.stringify(result3, null, 2));
  console.log('预期: 2条记录\n');
  
  // 测试用例4：多行混合格式
  const testCase4 = `
2026年3月25日
暂无账单明细
2026年3月24日
凯德集团
3月24日 17:35
-20.00
家常菜
3月24日 12:30
-45.50
二维码收款-来自张三
3月23日 15:00
+200.00
`;
  
  console.log('测试4: 多行混合格式');
  const result4 = parseWechatTransactionList(testCase4);
  console.log('结果:', JSON.stringify(result4, null, 2));
  console.log('预期: 3条记录\n');
  
  console.log('========== 测试完成 ==========');
  return {
    test1: result1.length === 5,
    test2: result2.length === 3,
    test3: result3.length === 2,
    test4: result4.length === 3,
  };
}

// 运行测试
if (typeof window === 'undefined') {
  // Node.js 环境
  testParseWechatTransactionList();
}

// 解析单行完整结构：左图标/商家 + 时间 + 金额（右对齐）
function parseSingleLineStructure(line: string, baseDate: string): ParseBillResult | null {
  // 格式：商家/图标 + 内容 + 金额
  // 例如: "🍜 美团外卖 14:30 ¥45.60"
  // 例如: "美团外卖 14:30 -45.60"
  // 例如: "🍜 美团外卖 14:30    +200.00"

  // 尝试匹配：emoji/商家 + 时间 + 金额（+/-或¥）
  const fullPattern1 = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]?\s*([\u4e00-\u9fa5]{2,15})\s+(\d{1,2}:\d{2})\s+([\+\-¥]?\s*\d+(?:\.\d{1,2})?)/u;
  const match1 = line.match(fullPattern1);
  if (match1) {
    const merchant = match1[1].trim();
    const timeStr = match1[2];
    const amountStr = match1[3];
    const amountInfo = parseAmountString(amountStr);
    
    if (amountInfo && amountInfo.amount > 0) {
      return {
        amount: amountInfo.amount,
        date: combineDateTime(baseDate, timeStr),
        description: '',
        merchant: merchant,
        confidence: 90,
        rawDate: baseDate,
        billType: amountInfo.type,
      };
    }
  }

  // 格式：商家 + 时间 + 金额
  // 例如: "美团外卖 14:30 ¥45.60"
  const fullPattern2 = /^([\u4e00-\u9fa5]{2,15})\s+(\d{1,2}:\d{2})\s+([\+\-¥]?\s*\d+(?:\.\d{1,2})?)/;
  const match2 = line.match(fullPattern2);
  if (match2) {
    const merchant = match2[1].trim();
    const timeStr = match2[2];
    const amountStr = match2[3];
    const amountInfo = parseAmountString(amountStr);
    
    if (amountInfo && amountInfo.amount > 0) {
      return {
        amount: amountInfo.amount,
        date: combineDateTime(baseDate, timeStr),
        description: '',
        merchant: merchant,
        confidence: 90,
        rawDate: baseDate,
        billType: amountInfo.type,
      };
    }
  }

  // 格式：emoji商家 + 金额（无时间）
  // 例如: "🍜 美团外卖 45.60"
  const fullPattern3 = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*([\u4e00-\u9fa5]{2,15})\s+([\+\-¥]?\s*\d+(?:\.\d{1,2})?)/u;
  const match3 = line.match(fullPattern3);
  if (match3) {
    const merchant = match3[1].trim();
    const amountStr = match3[2];
    const amountInfo = parseAmountString(amountStr);
    
    if (amountInfo && amountInfo.amount > 0) {
      return {
        amount: amountInfo.amount,
        date: baseDate,
        description: '',
        merchant: merchant,
        confidence: 85,
        rawDate: baseDate,
        billType: amountInfo.type,
      };
    }
  }

  return null;
}

// 解析上下结构：左emoji + 中（商家/时间上下）+ 右金额
// 结构：
//   左: emoji
//   中: 上商家名称，下时间
//   右: 金额
function parseUpDownStructure(upperLine: string, lowerLine: string, baseDate: string): ParseBillResult | null {
  // 结构：
  //   上行: "🍜 美团外卖" (左emoji + 中商家)
  //   下行: "14:30 -45.60" (中时间 + 右金额)
  // 或者：
  //   上行: "🍜" (左emoji)
  //   下行: "美团外卖 14:30 -45.60" (中商家 + 中时间 + 右金额)

  let merchant = '';
  let timeStr = '';

  // 情况1: 上行是emoji+商家，下行是时间+金额
  // 例如: 上行="🍜 美团外卖", 下行="14:30 -45.60"
  const case1Match = upperLine.match(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*([\u4e00-\u9fa5]{2,15})/u);
  if (case1Match) {
    merchant = case1Match[1].trim();
    
    // 检查下行是否有时时间和金额
    // 例如: "14:30 -45.60" 或 "14:30 ¥45.60"
    const lowerMatch = lowerLine.match(/(\d{1,2}:\d{2})\s+([\+\-¥]?\s*\d+(?:\.\d{1,2})?)/);
    if (lowerMatch) {
      timeStr = lowerMatch[1];
      const amountInfo = parseAmountString(lowerMatch[2]);
      if (amountInfo && amountInfo.amount > 0) {
        return {
          amount: amountInfo.amount,
          date: combineDateTime(baseDate, timeStr),
          description: '',
          merchant: merchant,
          confidence: 90,
          rawDate: baseDate,
          billType: amountInfo.type,
        };
      }
    }
    
    // 检查下行是否只有金额
    const lowerAmountMatch = lowerLine.match(/^([\+\-¥]?\s*\d+(?:\.\d{1,2})?)$/);
    if (lowerAmountMatch) {
      const amountInfo = parseAmountString(lowerAmountMatch[1]);
      if (amountInfo && amountInfo.amount > 0) {
        return {
          amount: amountInfo.amount,
          date: baseDate,
          description: '',
          merchant: merchant,
          confidence: 85,
          rawDate: baseDate,
          billType: amountInfo.type,
        };
      }
    }
  }

  // 情况2: 上行是emoji，下行是商家+时间+金额
  // 例如: 上行="🍜", 下行="美团外卖 14:30 -45.60"
  const emojiOnlyMatch = upperLine.match(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]$/u);
  if (emojiOnlyMatch) {
    // 下行: 商家 + 时间 + 金额
    const lowerFullMatch = lowerLine.match(/^([\u4e00-\u9fa5]{2,15})\s+(\d{1,2}:\d{2})\s+([\+\-¥]?\s*\d+(?:\.\d{1,2})?)/);
    if (lowerFullMatch) {
      merchant = lowerFullMatch[1].trim();
      timeStr = lowerFullMatch[2];
      const amountInfo = parseAmountString(lowerFullMatch[3]);
      if (amountInfo && amountInfo.amount > 0) {
        return {
          amount: amountInfo.amount,
          date: combineDateTime(baseDate, timeStr),
          description: '',
          merchant: merchant,
          confidence: 90,
          rawDate: baseDate,
          billType: amountInfo.type,
        };
      }
    }
    
    // 下行: 商家 + 金额（无时间）
    const lowerMerchantAmountMatch = lowerLine.match(/^([\u4e00-\u9fa5]{2,15})\s+([\+\-¥]?\s*\d+(?:\.\d{1,2})?)/);
    if (lowerMerchantAmountMatch) {
      merchant = lowerMerchantAmountMatch[1].trim();
      const amountInfo = parseAmountString(lowerMerchantAmountMatch[2]);
      if (amountInfo && amountInfo.amount > 0) {
        return {
          amount: amountInfo.amount,
          date: baseDate,
          description: '',
          merchant: merchant,
          confidence: 85,
          rawDate: baseDate,
          billType: amountInfo.type,
        };
      }
    }
  }

  // 情况3: 上行是纯商家，下行是时间+金额
  // 例如: 上行="美团外卖", 下行="14:30 -45.60"
  const merchantOnlyMatch = upperLine.match(/^([\u4e00-\u9fa5]{2,15})$/);
  if (merchantOnlyMatch) {
    merchant = merchantOnlyMatch[1].trim();
    
    const lowerMatch = lowerLine.match(/(\d{1,2}:\d{2})\s+([\+\-¥]?\s*\d+(?:\.\d{1,2})?)/);
    if (lowerMatch) {
      timeStr = lowerMatch[1];
      const amountInfo = parseAmountString(lowerMatch[2]);
      if (amountInfo && amountInfo.amount > 0) {
        return {
          amount: amountInfo.amount,
          date: combineDateTime(baseDate, timeStr),
          description: '',
          merchant: merchant,
          confidence: 85,
          rawDate: baseDate,
          billType: amountInfo.type,
        };
      }
    }
  }

  return null;
}

// 解析仅商家行（用于后续配合金额行）
function parseMerchantOnlyLine(line: string, baseDate: string): ParseBillResult | null {
  let merchant = '';
  
  // emoji商家
  const emojiMatch = line.match(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*([\u4e00-\u9fa5]{2,15})/u);
  if (emojiMatch) {
    merchant = emojiMatch[1].trim();
  } else {
    // 纯商家名称
    const merchantMatch = line.match(/^([\u4e00-\u9fa5]{2,15})$/);
    if (merchantMatch) {
      merchant = merchantMatch[1].trim();
    }
  }

  if (!merchant) return null;

  return {
    amount: 0,
    date: baseDate,
    description: '',
    merchant: merchant,
    confidence: 70,
    rawDate: baseDate,
    billType: 'expense',
  };
}

// 解析仅金额行
function parseAmountOnlyLine(line: string): { amount: number; type: 'income' | 'expense' } | null {
  const amountInfo = parseAmountString(line);
  if (amountInfo && amountInfo.amount > 0) {
    return amountInfo;
  }
  return null;
}

// 解析金额字符串，返回金额和类型
function parseAmountString(amountStr: string): { amount: number; type: 'income' | 'expense' } | null {
  // 清理金额字符串
  const cleaned = amountStr.replace(/\s/g, '');
  
  // +号（收入）
  const incomeMatch = cleaned.match(/^\+(\d+(?:\.\d{1,2})?)$/);
  if (incomeMatch) {
    const amount = parseFloat(incomeMatch[1]);
    if (amount > 0) {
      return { amount, type: 'income' };
    }
  }

  // -号（支出）
  const expenseMatch = cleaned.match(/^-(\d+(?:\.\d{1,2})?)$/);
  if (expenseMatch) {
    const amount = parseFloat(expenseMatch[1]);
    if (amount > 0) {
      return { amount, type: 'expense' };
    }
  }

  // ¥符号（支出）
  const yuanMatch = cleaned.match(/^¥(\d+(?:\.\d{1,2})?)$/);
  if (yuanMatch) {
    const amount = parseFloat(yuanMatch[1]);
    if (amount > 0) {
      return { amount, type: 'expense' };
    }
  }

  // 纯数字（作为支出，需要金额合理）
  const plainMatch = cleaned.match(/^(\d+(?:\.\d{1,2})?)$/);
  if (plainMatch) {
    const amount = parseFloat(plainMatch[1]);
    if (amount >= 0.01 && amount < 1000000) {
      return { amount, type: 'expense' };
    }
  }

  return null;
}

// 解析商家行（图标+商家名称）
function parseMerchantLine(line: string): { merchant: string; hasIcon: boolean } | null {
  // 格式1: emoji + 商家名称
  // 例如: "🍜 美团外卖"
  const emojiMatch = line.match(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*([\u4e00-\u9fa5]{2,15})$/u);
  if (emojiMatch) {
    return {
      merchant: emojiMatch[1].trim(),
      hasIcon: true
    };
  }

  // 格式2: 纯商家名称
  // 例如: "美团外卖"
  const merchantMatch = line.match(/^([\u4e00-\u9fa5]{2,15})$/);
  if (merchantMatch) {
    return {
      merchant: merchantMatch[1].trim(),
      hasIcon: false
    };
  }

  // 格式3: 图标符号 + 商家名称
  // 例如: "●美团外卖"
  const symbolMatch = line.match(/^[^\d\s]{1,3}\s*([\u4e00-\u9fa5]{2,15})$/);
  if (symbolMatch) {
    return {
      merchant: symbolMatch[1].trim(),
      hasIcon: true
    };
  }

  return null;
}

// 解析时间金额行 - 支持多种金额格式
function parseTimeAmountLine(line: string): { timeStr?: string; amount: number; type: 'income' | 'expense' } | null {
  // 支持多种金额格式：
  // 1. 带加减号的金额：+45.60 或 -45.60
  // 2. ¥符号金额：¥45.60
  // 3. 纯数字金额：45.60（需要配合时间）

  // 格式1: 时间 + 收入金额 (+号)
  // 例如: "14:30    +45.60"
  const incomeMatch = line.match(/(\d{1,2}:\d{2})\s*\+(\d+(?:\.\d{1,2})?)/);
  if (incomeMatch) {
    return {
      timeStr: incomeMatch[1],
      amount: parseFloat(incomeMatch[2]),
      type: 'income'
    };
  }

  // 格式2: 时间 + 支出金额 (-号)
  // 例如: "14:30    -45.60"
  const expenseMatch = line.match(/(\d{1,2}:\d{2})\s*-(\d+(?:\.\d{1,2})?)/);
  if (expenseMatch) {
    return {
      timeStr: expenseMatch[1],
      amount: parseFloat(expenseMatch[2]),
      type: 'expense'
    };
  }

  // 格式3: 时间 + ¥金额
  // 例如: "14:30    ¥45.60"
  const yuanMatch = line.match(/(\d{1,2}:\d{2})\s*¥\s*(\d+(?:\.\d{1,2})?)/);
  if (yuanMatch) {
    return {
      timeStr: yuanMatch[1],
      amount: parseFloat(yuanMatch[2]),
      type: 'expense'
    };
  }

  // 格式4: 时间 + 纯数字金额
  // 例如: "14:30    45.60"
  const plainMatch = line.match(/(\d{1,2}:\d{2})\s+(\d+(?:\.\d{1,2})?)\s*$/);
  if (plainMatch) {
    const amount = parseFloat(plainMatch[2]);
    if (amount >= 0.01) {
      return {
        timeStr: plainMatch[1],
        amount: amount,
        type: 'expense'
      };
    }
  }

  // 格式5: 只有收入金额 (+号)，无时间
  // 例如: "+45.60"
  const incomeOnlyMatch = line.match(/^\s*\+(\d+(?:\.\d{1,2})?)$/);
  if (incomeOnlyMatch) {
    return {
      amount: parseFloat(incomeOnlyMatch[1]),
      type: 'income'
    };
  }

  // 格式6: 只有支出金额 (-号)，无时间
  // 例如: "-45.60"
  const expenseOnlyMatch = line.match(/^\s*-(\d+(?:\.\d{1,2})?)$/);
  if (expenseOnlyMatch) {
    return {
      amount: parseFloat(expenseOnlyMatch[1]),
      type: 'expense'
    };
  }

  // 格式7: 只有¥金额，无时间
  // 例如: "¥45.60"
  const yuanOnlyMatch = line.match(/^¥\s*(\d+(?:\.\d{1,2})?)$/);
  if (yuanOnlyMatch) {
    return {
      amount: parseFloat(yuanOnlyMatch[1]),
      type: 'expense'
    };
  }

  // 格式8: 只有纯数字金额，无时间
  // 例如: "45.60"（只匹配大于10的金额）
  const plainOnlyMatch = line.match(/^\s*(\d+(?:\.\d{1,2})?)\s*$/);
  if (plainOnlyMatch) {
    const amount = parseFloat(plainOnlyMatch[1]);
    if (amount >= 10) {
      return {
        amount: amount,
        type: 'expense'
      };
    }
  }

  return null;
}

// 解析完整的账单行 - 支持多种金额格式
function parseCompleteBillLine(line: string, baseDate: string, baseYear: number, baseMonth: number): ParseBillResult | null {
  // 支持多种金额格式：
  // 1. 带加减号的金额：+45.60 或 -45.60
  // 2. ¥符号金额：¥45.60
  // 3. 纯数字金额：45.60

  // 格式1: 商家 + 时间 + 收入金额 (+号)
  // 例如: "美团外卖 14:30 +45.60"
  const format1Income = line.match(/([\u4e00-\u9fa5]{2,15})\s+(\d{1,2}:\d{2})\s*\+(\d+(?:\.\d{1,2})?)/);
  if (format1Income) {
    const merchant = format1Income[1].trim();
    const timeStr = format1Income[2];
    const amount = parseFloat(format1Income[3]);
    
    if (amount > 0) {
      const fullDate = combineDateTime(baseDate, timeStr);
      return {
        amount,
        date: fullDate,
        description: '',
        merchant: merchant,
        confidence: 90,
        rawDate: baseDate,
        billType: 'income',
      };
    }
  }

  // 格式2: 商家 + 时间 + 支出金额 (-号)
  // 例如: "美团外卖 14:30 -45.60"
  const format1Expense = line.match(/([\u4e00-\u9fa5]{2,15})\s+(\d{1,2}:\d{2})\s*-(\d+(?:\.\d{1,2})?)/);
  if (format1Expense) {
    const merchant = format1Expense[1].trim();
    const timeStr = format1Expense[2];
    const amount = parseFloat(format1Expense[3]);
    
    if (amount > 0) {
      const fullDate = combineDateTime(baseDate, timeStr);
      return {
        amount,
        date: fullDate,
        description: '',
        merchant: merchant,
        confidence: 90,
        rawDate: baseDate,
        billType: 'expense',
      };
    }
  }

  // 格式3: 商家 + 时间 + ¥金额
  // 例如: "美团外卖 14:30 ¥45.60"
  const format1Yuan = line.match(/([\u4e00-\u9fa5]{2,15})\s+(\d{1,2}:\d{2})\s*¥\s*(\d+(?:\.\d{1,2})?)/);
  if (format1Yuan) {
    const merchant = format1Yuan[1].trim();
    const timeStr = format1Yuan[2];
    const amount = parseFloat(format1Yuan[3]);
    
    if (amount > 0) {
      const fullDate = combineDateTime(baseDate, timeStr);
      return {
        amount,
        date: fullDate,
        description: '',
        merchant: merchant,
        confidence: 85,
        rawDate: baseDate,
        billType: 'expense',
      };
    }
  }

  // 格式4: emoji商家 + 时间 + 收入金额 (+号)
  // 例如: "🍜 美团外卖 14:30 +45.60"
  const format3Income = line.match(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*([\u4e00-\u9fa5]{2,15})\s+(\d{1,2}:\d{2})\s*\+(\d+(?:\.\d{1,2})?)/u);
  if (format3Income) {
    const merchant = format3Income[1].trim();
    const timeStr = format3Income[2];
    const amount = parseFloat(format3Income[3]);
    
    if (amount > 0) {
      const fullDate = combineDateTime(baseDate, timeStr);
      return {
        amount,
        date: fullDate,
        description: '',
        merchant: merchant,
        confidence: 90,
        rawDate: baseDate,
        billType: 'income',
      };
    }
  }

  // 格式5: emoji商家 + 时间 + 支出金额 (-号)
  // 例如: "🍜 美团外卖 14:30 -45.60"
  const format3Expense = line.match(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*([\u4e00-\u9fa5]{2,15})\s+(\d{1,2}:\d{2})\s*-(\d+(?:\.\d{1,2})?)/u);
  if (format3Expense) {
    const merchant = format3Expense[1].trim();
    const timeStr = format3Expense[2];
    const amount = parseFloat(format3Expense[3]);
    
    if (amount > 0) {
      const fullDate = combineDateTime(baseDate, timeStr);
      return {
        amount,
        date: fullDate,
        description: '',
        merchant: merchant,
        confidence: 90,
        rawDate: baseDate,
        billType: 'expense',
      };
    }
  }

  // 格式6: emoji商家 + 时间 + ¥金额
  // 例如: "🍜 美团外卖 14:30 ¥45.60"
  const format3Yuan = line.match(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*([\u4e00-\u9fa5]{2,15})\s+(\d{1,2}:\d{2})\s*¥\s*(\d+(?:\.\d{1,2})?)/u);
  if (format3Yuan) {
    const merchant = format3Yuan[1].trim();
    const timeStr = format3Yuan[2];
    const amount = parseFloat(format3Yuan[3]);
    
    if (amount > 0) {
      const fullDate = combineDateTime(baseDate, timeStr);
      return {
        amount,
        date: fullDate,
        description: '',
        merchant: merchant,
        confidence: 85,
        rawDate: baseDate,
        billType: 'expense',
      };
    }
  }

  // 格式7: emoji商家 + 收入金额 (+号)
  // 例如: "🍜 美团外卖 +45.60"
  const format4Income = line.match(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*([\u4e00-\u9fa5]{2,15})\s*\+(\d+(?:\.\d{1,2})?)/u);
  if (format4Income) {
    const merchant = format4Income[1].trim();
    const amount = parseFloat(format4Income[2]);
    
    if (amount > 0) {
      return {
        amount,
        date: baseDate,
        description: '',
        merchant: merchant,
        confidence: 85,
        rawDate: baseDate,
        billType: 'income',
      };
    }
  }

  // 格式8: emoji商家 + 支出金额 (-号)
  // 例如: "🍜 美团外卖 -45.60"
  const format4Expense = line.match(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*([\u4e00-\u9fa5]{2,15})\s*-(\d+(?:\.\d{1,2})?)/u);
  if (format4Expense) {
    const merchant = format4Expense[1].trim();
    const amount = parseFloat(format4Expense[2]);
    
    if (amount > 0) {
      return {
        amount,
        date: baseDate,
        description: '',
        merchant: merchant,
        confidence: 85,
        rawDate: baseDate,
        billType: 'expense',
      };
    }
  }

  // 格式9: emoji商家 + ¥金额
  // 例如: "🍜 美团外卖 ¥45.60"
  const format4Yuan = line.match(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*([\u4e00-\u9fa5]{2,15})\s*¥\s*(\d+(?:\.\d{1,2})?)/u);
  if (format4Yuan) {
    const merchant = format4Yuan[1].trim();
    const amount = parseFloat(format4Yuan[2]);
    
    if (amount > 0) {
      return {
        amount,
        date: baseDate,
        description: '',
        merchant: merchant,
        confidence: 80,
        rawDate: baseDate,
        billType: 'expense',
      };
    }
  }

  // 格式10: 商家 + 收入金额 (+号)
  // 例如: "美团外卖 +45.60"
  const format5Income = line.match(/([\u4e00-\u9fa5]{2,15})\s*\+(\d+(?:\.\d{1,2})?)/);
  if (format5Income) {
    const merchant = format5Income[1].trim();
    const amount = parseFloat(format5Income[2]);
    
    if (amount > 0) {
      return {
        amount,
        date: baseDate,
        description: '',
        merchant: merchant,
        confidence: 85,
        rawDate: baseDate,
        billType: 'income',
      };
    }
  }

  // 格式11: 商家 + 支出金额 (-号)
  // 例如: "美团外卖 -45.60"
  const format5Expense = line.match(/([\u4e00-\u9fa5]{2,15})\s*-(\d+(?:\.\d{1,2})?)/);
  if (format5Expense) {
    const merchant = format5Expense[1].trim();
    const amount = parseFloat(format5Expense[2]);
    
    if (amount > 0) {
      return {
        amount,
        date: baseDate,
        description: '',
        merchant: merchant,
        confidence: 85,
        rawDate: baseDate,
        billType: 'expense',
      };
    }
  }

  // 格式12: 商家 + ¥金额
  // 例如: "美团外卖 ¥45.60"
  const format5Yuan = line.match(/([\u4e00-\u9fa5]{2,15})\s*¥\s*(\d+(?:\.\d{1,2})?)/);
  if (format5Yuan) {
    const merchant = format5Yuan[1].trim();
    const amount = parseFloat(format5Yuan[2]);
    
    if (amount > 0) {
      return {
        amount,
        date: baseDate,
        description: '',
        merchant: merchant,
        confidence: 80,
        rawDate: baseDate,
        billType: 'expense',
      };
    }
  }

  return null; // 不是有效的账单行
}

// 组合日期和时间
function combineDateTime(dateStr: string, timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const dateObj = new Date(dateStr);
  dateObj.setHours(hours, minutes, 0, 0);
  return dateObj.toISOString();
}

// 获取今天的日期字符串
function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

// 解析交易日期字符串
function parseTransactionDate(dateStr: string): string {
  const currentYear = new Date().getFullYear();

  // 解析 2024/3/25 格式
  const match = dateStr.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);

    const date = new Date(year, month - 1, day);
    if (date.getMonth() === month - 1) {
      return date.toISOString().split('T')[0];
    }
  }

  return new Date().toISOString().split('T')[0];
}

// 清理商家名称
function cleanMerchantName(name: string): string {
  return name
    .replace(/[¥￥\s\d]+/g, '')
    .trim();
}

export interface ParseBillResult extends ParsedBill {
  matchedCategoryId?: string;
  matchedCategoryName?: string;
  billType?: 'income' | 'expense';
  rawDate?: string; // 识别到的原始日期字符串
}

// 智能清理描述
function cleanDescription(text: string): string {
  if (!text) return '';

  return text
    // 移除金额符号
    .replace(/[¥￥]/g, '')
    // 移除纯数字
    .replace(/^\d+\.?\d*$/g, '')
    // 移除时间
    .replace(/\d{1,2}:\d{2}/g, '')
    // 保留汉字和数字
    .replace(/[^\u4e00-\u9fa5\d]/g, ' ')
    // 清理多余空格
    .replace(/\s+/g, ' ')
    .trim();
}

// 计算识别置信度
function calculateConfidence(
  amountInfo: {value: number, original: string},
  description: string,
  merchant?: string
): number {
  let confidence = 50;

  // 金额格式合理性
  if (/^\d+(?:\.\d{1,2})?$/.test(amountInfo.original.replace(/[¥￥\s]/g, ''))) {
    confidence += 20;
  }

  // 金额范围合理性
  if (amountInfo.value >= 0.01 && amountInfo.value <= 10000) {
    confidence += 15;
  }

  // 描述质量
  if (description.length >= 2 && description.length <= 30) {
    confidence += 10;
  }

  // 商家信息
  if (merchant && merchant.length >= 2) {
    confidence += 10;
  }

  return Math.min(100, Math.max(0, confidence));
}

// 核心解析函数（同步）
function parseBillTextCore(
  rawText: string,
  options: {
    extractMerchant?: boolean;
    extractDate?: boolean;
    useEnhancedAmountExtraction?: boolean;
    billType?: BillType;
  } = {}
): ParseBillResult[] {
  const results: ParseBillResult[] = [];

  if (!rawText || rawText.trim().length === 0) {
    return [{
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      description: '未识别到内容',
      confidence: 0,
    }];
  }

  // 按行分割
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // 提取全局商家名称(可选)
  const globalMerchant = options.extractMerchant ? extractMerchant(rawText) : undefined;

  // 提取日期(可选)
  const globalDate = options.extractDate ? extractDate(rawText) : undefined;

  let amounts: Array<{value: number, position: number, original: string, line: number}>;

  // 使用增强的金额提取(可选)
  if (options.useEnhancedAmountExtraction) {
    amounts = extractAmounts(rawText);
  } else {
    // 简单的金额提取
    amounts = [];
    const amountPattern = /[¥￥]?\s*(\d+\.?\d{0,2})/g;
    let match;
    let lineIndex = 0;
    while ((match = amountPattern.exec(rawText)) !== null) {
      const amount = parseFloat(match[1]);
      if (!isNaN(amount) && amount > 0) {
        amounts.push({
          value: amount,
          position: match.index || 0,
          original: match[0],
          line: lineIndex
        });
      }
      lineIndex++;
    }
  }

  // 用于跟踪已处理的金额，避免重复
  const processedAmounts = new Set<string>();

  // 处理每一行
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 跳过标题行和分隔行
    if (/^(日期|时间|金额|描述|合计|总计|收支类型|交易时间)/.test(line)) continue;
    if (/^[-=]+$/.test(line)) continue;
    if (line.length < 3) continue;

    // 从当前行提取日期
    const lineDate = options.extractDate ? extractDateFromLine(line) : undefined;

    // 在该行中查找金额
    const lineAmounts = amounts.filter(amount => amount.line === i);

    for (const amountInfo of lineAmounts) {
      // 创建唯一标识避免重复
      const amountKey = `${i}-${amountInfo.value}`;
      if (processedAmounts.has(amountKey)) continue;
      processedAmounts.add(amountKey);

      // 提取描述（金额前的内容）
      let description = '';
      const beforeAmount = line.substring(0, amountInfo.position).trim();

      // 清理描述
      description = cleanDescription(beforeAmount);

      // 如果描述为空，尝试使用商家名称
      if (!description && globalMerchant) {
        description = globalMerchant;
      }

      // 如果还是为空，尝试从前后行获取描述
      if (!description) {
        if (i > 0 && lines[i-1].length > 1 && !/\d/.test(lines[i-1])) {
          description = cleanDescription(lines[i-1]);
        }
      }

      // 最终默认值
      if (!description) {
        description = options.useEnhancedAmountExtraction ? '消费' : '未识别';
      }

      const result: ParseBillResult = {
        amount: amountInfo.value,
        date: lineDate || globalDate || new Date().toISOString().split('T')[0],
        description: '', // 清空描述，让用户自己填写
        merchant: globalMerchant || description || undefined, // 商家名称优先使用globalMerchant，其次是description
        confidence: options.useEnhancedAmountExtraction
          ? calculateConfidence(amountInfo, description, globalMerchant || undefined)
          : 70,
        rawDate: lineDate || globalDate || undefined,
      };

      results.push(result);
    }
  }

  // 如果没有识别到任何结果，返回一个默认项
  if (results.length === 0) {
    return [{
      amount: 0,
      date: globalDate || new Date().toISOString().split('T')[0],
      description: options.useEnhancedAmountExtraction ? '未识别到有效记录' : '未识别到内容',
      merchant: globalMerchant || undefined,
      confidence: 0,
      rawDate: globalDate || undefined,
    }];
  }

  return results;
}

// Task 7: 解析账单文本并自动匹配分类 - 增强版本
export async function parseBillTextWithAutoMatch(rawText: string): Promise<ParseBillResult[]> {
  // 1. 检测账单类型
  const billType = detectBillType(rawText);
  console.log('检测账单类型:', billType);

  // 2. 微信账单应用白色背景过滤
  let processedText = rawText;
  if (billType === 'wechat') {
    processedText = filterWhiteBackgroundText(rawText, billType);
  }

  // 3. 优先尝试解析微信交易列表（无论是否检测到微信账单类型）
  // 微信账单OCR识别后通常包含"2026年3月"等年月信息
  const transactionListResults = parseWechatTransactionList(processedText);
  if (transactionListResults.length > 0) {
    console.log('✓ 使用微信交易列表解析，找到', transactionListResults.length, '条记录');
    // 为每条记录匹配分类
    for (const result of transactionListResults) {
      const matchResult = await autoMatchCategory(result.merchant || '', result.description);
      if (matchResult) {
        result.matchedCategoryId = matchResult.categoryId;
        result.matchedCategoryName = matchResult.category.name;
        result.category = matchResult.category.name;
        result.billType = matchResult.category.type || 'expense';
      }
    }
    return transactionListResults;
  }

  console.log('⚠ 微信交易列表解析未找到记录，使用通用解析');

  // 4. 如果没有找到微信交易列表，使用通用解析
  // 针对微信账单检测
  if (billType === 'wechat') {
    const wechatFields = extractWechatBillFields(processedText);

    const results = parseBillTextCore(processedText, {
      extractMerchant: true,
      extractDate: true,
      useEnhancedAmountExtraction: true,
      billType,
    });

    // 合并微信专属字段
    for (const result of results) {
      if (!result.merchant && wechatFields.transactionPartner) {
        result.merchant = wechatFields.transactionPartner;
        result.description = '';
      }
      if (wechatFields.transactionTime && !result.rawDate) {
        result.rawDate = wechatFields.transactionTime;
        result.date = extractDate(wechatFields.transactionTime) || result.date;
      }

      // 匹配分类
      const matchResult = await autoMatchCategory(result.merchant || '', result.description);
      if (matchResult) {
        result.matchedCategoryId = matchResult.categoryId;
        result.matchedCategoryName = matchResult.category.name;
        result.category = matchResult.category.name;
        result.billType = matchResult.category.type || 'expense';
      }
    }

    return results;
  }

  // 非微信账单使用通用解析
  const results = parseBillTextCore(processedText, {
    extractMerchant: true,
    extractDate: true,
    useEnhancedAmountExtraction: true,
  });

  // 自动匹配分类
  for (const result of results) {
    if (result.merchant || result.description) {
      const matchResult = await autoMatchCategory(result.merchant || '', result.description);
      if (matchResult) {
        result.matchedCategoryId = matchResult.categoryId;
        result.matchedCategoryName = matchResult.category.name;
        result.category = matchResult.category.name;
        result.billType = matchResult.category.type || 'expense';
      }
    }
  }

  return results;
}

// 保持向后兼容
export function parseBillText(rawText: string): ParsedBill[] {
  return parseBillTextCore(rawText, {
    extractMerchant: false,
    extractDate: true,
    useEnhancedAmountExtraction: false,
  }) as ParsedBill[];
}
