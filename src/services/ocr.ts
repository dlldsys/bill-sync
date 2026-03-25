import Tesseract from 'tesseract.js';
import { OCRResult, ParsedBill } from '../types';

// 常用商家关键词
const MERCHANT_KEYWORDS = [
  '超市', '便利店', '商店', '商场', '百货', '广场',
  '餐厅', '饭店', '酒楼', '火锅', '烧烤', '小吃', '快餐', '咖啡', '奶茶',
  '银行', 'ATM', '转账', '红包',
  '医院', '药店', '诊所', '药房',
  '加油站', '油站', '中石化', '中石油',
  '打车', '滴滴', '出租车', '公交', '地铁',
  '话费', '流量', '宽带', '电费', '水费', '燃气',
  '天猫', '京东', '淘宝', '拼多多', '美团', '饿了么',
  '微信支付', '支付宝', '云闪付',
];

// 常用类目关键词
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '餐饮': ['餐饮', '美食', '吃饭', '外卖', '餐厅', '快餐', '小吃', '火锅', '烧烤', '咖啡', '奶茶'],
  '购物': ['超市', '商场', '购物', '天猫', '京东', '淘宝', '拼多多', '便利店', '商店'],
  '交通': ['打车', '滴滴', '公交', '地铁', '火车', '飞机', '加油', '停车', '出租车'],
  '医疗': ['医院', '药店', '诊所', '医疗', '药品', '挂号'],
  '通讯': ['话费', '流量', '宽带', '手机'],
  '生活': ['水电费', '燃气', '物业', '房租'],
  '娱乐': ['电影', 'KTV', '游戏', '旅游', '健身'],
  '收入': ['收入', '工资', '转账收入', '退款', '红包收入'],
};

// 图片预处理 - 转为灰度并增强对比度
async function preprocessImage(imageFile: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      const maxSize = 2000;
      let { width, height } = img;
      
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height / width) * maxSize;
          width = maxSize;
        } else {
          width = (width / height) * maxSize;
          height = maxSize;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const contrast = 1.5;
        const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
        const newGray = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
        data[i] = data[i + 1] = data[i + 2] = newGray;
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = URL.createObjectURL(imageFile);
  });
}

// OCR 识别
export async function recognizeText(imageFile: File): Promise<OCRResult> {
  try {
    const preprocessedImage = await preprocessImage(imageFile);
    
    const result = await Tesseract.recognize(preprocessedImage, 'eng+chi_sim', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`识别进度: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    
    return {
      text: result.data.text,
      confidence: result.data.confidence,
    };
  } catch (error) {
    console.error('OCR识别失败:', error);
    return {
      text: '',
      confidence: 0,
    };
  }
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

// 识别商家名称
function extractMerchant(text: string): string | undefined {
  // 常见商家模式
  const patterns = [
    /([^\s\d]{2,12}(?:店|铺|馆|厅|行|公司|超市|便利店|餐厅|饭店))/,
    /(?:收款方|商户|商家)[：:]\s*([^\s\d]{2,15})/,
    /(?:向|给)([^\s\d]{2,10})(?:付款|转账|消费)/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // 从关键词检测
  for (const keyword of MERCHANT_KEYWORDS) {
    if (text.includes(keyword)) {
      // 尝试获取关键词附近的文字
      const index = text.indexOf(keyword);
      const start = Math.max(0, index - 5);
      const end = Math.min(text.length, index + keyword.length + 5);
      const snippet = text.substring(start, end);
      const match = snippet.match(/([^\s]{2,10})/);
      if (match) {
        return match[1];
      }
    }
  }
  
  return undefined;
}

// 识别类目
function extractCategory(text: string): string | undefined {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return category;
      }
    }
  }
  return undefined;
}

// 解析单行账单记录
function parseLineToBill(line: string, defaultDate?: string): Partial<ParsedBill> {
  const result: Partial<ParsedBill> = {
    confidence: 0,
  };
  
  // 清理行
  const cleanLine = line.replace(/\s+/g, ' ').trim();
  if (cleanLine.length < 3) return result;
  
  // 匹配金额 - 优先匹配带符号的
  const amountPatterns = [
    /[¥￥$]\s*(\d+\.?\d{0,2})/,
    /(?:金额|实付|付款|支付)[：:]\s*[¥￥$]?\s*(\d+\.?\d{0,2})/i,
    /(\d+\.\d{2})/,
  ];
  
  for (const pattern of amountPatterns) {
    const match = cleanLine.match(pattern);
    if (match) {
      const amount = parseFloat(match[1] || match[0]);
      if (!isNaN(amount) && amount > 0 && amount < 100000) {
        result.amount = amount;
        result.confidence! += 40;
        break;
      }
    }
  }
  
  // 匹配日期
  const datePatterns = [
    /(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/,
    /(\d{2})[-/](\d{1,2})[-/](\d{1,2})/,
    /(?:^|\s)(\d{1,2})[-/月](\d{1,2})/,
  ];
  
  for (const pattern of datePatterns) {
    const match = cleanLine.match(pattern);
    if (match) {
      try {
        let year: number, month: number, day: number;
        
        if (match[1].length === 4) {
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        } else if (match[1].length === 2) {
          year = 2000 + parseInt(match[1]);
          month = parseInt(match[2]);
          day = match[3] ? parseInt(match[3]) : 1;
        } else {
          year = defaultDate ? new Date(defaultDate).getFullYear() : new Date().getFullYear();
          month = parseInt(match[1]);
          day = parseInt(match[2]);
        }
        
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          result.date = new Date(year, month - 1, day).toISOString();
          result.confidence! += 30;
          break;
        }
      } catch {}
    }
  }
  
  // 提取描述（去除金额和日期）
  let description = cleanLine
    .replace(/[¥￥$]\s*\d+\.?\d{0,2}/g, '')
    .replace(/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/g, '')
    .replace(/\d{2}[-/]\d{1,2}[-/]\d{1,2}/g, '')
    .replace(/\d+\.\d{2}/g, '')
    .trim();
  
  // 移除常见无关词
  const ignoreWords = ['订单号', '交易号', '状态', '成功', '完成', '查看', '详情'];
  for (const word of ignoreWords) {
    description = description.replace(new RegExp(word, 'g'), ' ');
  }
  
  description = description.replace(/\s+/g, ' ').trim();
  if (description.length >= 2) {
    result.description = description;
    result.confidence! += 20;
  }
  
  // 识别商家
  result.merchant = extractMerchant(cleanLine);
  if (result.merchant) {
    result.confidence! += 10;
  }
  
  // 识别类目
  result.category = extractCategory(cleanLine);
  if (result.category) {
    result.confidence! += 10;
  }
  
  return result;
}

// 解析账单文本 - 支持多条记录
export function parseBillText(rawText: string): ParsedBill[] {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length === 0) {
    return [{
      amount: 0,
      date: new Date().toISOString(),
      description: '未识别到内容',
      confidence: 0,
    }];
  }
  
  const results: ParsedBill[] = [];
  
  // 检测是否有日期作为全局日期
  let globalDate: string | undefined;
  const dateMatch = rawText.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
  if (dateMatch) {
    const year = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]);
    const day = parseInt(dateMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      globalDate = new Date(year, month - 1, day).toISOString();
    }
  }
  
  // 尝试识别全局商家
  const globalMerchant = extractMerchant(rawText);
  
  // 尝试识别全局类目
  const globalCategory = extractCategory(rawText);
  
  // 判断是否为账单列表格式
  // 账单列表通常每行包含：日期 + 描述 + 金额
  const isListFormat = lines.some(line => {
    const hasAmount = /\d+\.?\d{0,2}/.test(line);
    const hasDate = /\d{1,4}[-/年]\d{1,2}[-/月]\d{1,2}/.test(line) || /\d{1,2}[-/]\d{1,2}/.test(line);
    return hasAmount && hasDate;
  });
  
  if (isListFormat) {
    // 逐行解析账单列表
    for (const line of lines) {
      // 跳过标题行
      if (/^(日期|时间|金额|描述|合计|总计)/.test(line)) continue;
      // 跳过分隔行
      if (/^[-=]+$/.test(line)) continue;
      
      const parsed = parseLineToBill(line, globalDate);
      
      if (parsed.amount && parsed.amount > 0) {
        results.push({
          amount: parsed.amount,
          date: parsed.date || globalDate || new Date().toISOString(),
          description: parsed.description || parsed.merchant || '未识别',
          merchant: parsed.merchant || globalMerchant,
          category: parsed.category || globalCategory,
          confidence: parsed.confidence,
        });
      }
    }
  } else {
    // 单条账单模式 - 尝试提取主要金额和商家
    let mainAmount = 0;
    let mainDescription = '';
    
    // 找最大金额作为主金额
    const allAmounts: number[] = [];
    const amountMatches = rawText.matchAll(/[¥￥$]?\s*(\d+\.\d{2})/g);
    for (const match of amountMatches) {
      const amount = parseFloat(match[1]);
      if (amount >= 1 && amount < 100000) {
        allAmounts.push(amount);
      }
    }
    if (allAmounts.length > 0) {
      mainAmount = Math.max(...allAmounts);
    }
    
    // 提取描述
    const descLines = lines.filter(line => {
      if (/^\d+\.\d/.test(line)) return false;
      if (/^\s*$/.test(line)) return false;
      const chineseCount = (line.match(/[\u4e00-\u9fa5]/g) || []).length;
      return chineseCount >= 2;
    });
    
    if (descLines.length > 0) {
      mainDescription = descLines[0].trim();
    }
    
    results.push({
      amount: mainAmount,
      date: globalDate || new Date().toISOString(),
      description: mainDescription || globalMerchant || '未识别',
      merchant: globalMerchant,
      category: globalCategory,
      confidence: mainAmount > 0 ? 60 : 30,
    });
  }
  
  // 如果没有解析出任何结果
  if (results.length === 0) {
    return [{
      amount: 0,
      date: globalDate || new Date().toISOString(),
      description: '未能解析账单',
      merchant: globalMerchant,
      category: globalCategory,
      confidence: 20,
    }];
  }
  
  return results;
}

// 从 OCR 结果批量解析账单
export function parseBillsFromOCR(ocrResults: OCRResult[]): ParsedBill[] {
  return ocrResults.flatMap(result => parseBillText(result.text));
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
