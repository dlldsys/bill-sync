import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Tesseract from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 简化版的解析函数，基于src/services/ocr.ts中的逻辑
function detectBillType(text) {
  if (!text) return 'unknown';
  const lowerText = text.toLowerCase();
  const wechatPatterns = ['微信支付', '微信转账', '微信红包', 'wechat pay', 'wechat', '微信收款', '交易时间', '交易对方', '支付成功'];
  const wechatScore = wechatPatterns.filter(pattern => lowerText.includes(pattern.toLowerCase())).length;
  return wechatScore >= 2 ? 'wechat' : 'unknown';
}

function parseWechatTransactionList(text) {
  const results = [];
  console.log('=== 微信账单OCR解析 ===');
  console.log('原始文本:\n', text);

  // 0. 清理文本
  const cleanedText = text.replace(/\s+/g, ' ').trim();
  
  // 1. 提取基准日期
  let baseYearMonth = '';
  const yearMonthMatch = cleanedText.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
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

  // 2. 提取带 +/- 的金额
  const amountRegex = /([\+\-])(\d+)\.(\d{2})|([\+\-])(\d+)\s+(\d{2})|([\+\-])(\d+)\.(\d{1})|([\+\-])(\d+)\s+(\d{1})|([\+\-])(\d+)(?=\D|$)/g;
  const amountMatches = [];
  
  let match;
  while ((match = amountRegex.exec(cleanedText)) !== null) {
    let sign = '';
    let amount = 0;
    let fullText = '';
    
    if (match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
      sign = match[1];
      amount = parseFloat(`${match[2]}.${match[3]}`);
      fullText = match[0];
    }
    else if (match[4] !== undefined && match[5] !== undefined && match[6] !== undefined) {
      sign = match[4];
      amount = parseFloat(`${match[5]}.${match[6]}`);
      fullText = match[0];
    }
    else if (match[7] !== undefined && match[8] !== undefined) {
      sign = match[7];
      amount = parseFloat(match[8]);
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

  amountMatches.sort((a, b) => a.index - b.index);
  
  console.log('✓ 找到', amountMatches.length, '个金额');
  console.log('金额详情:', amountMatches.map(a => `${a.sign}${a.amount}`).join(', '));
  
  if (amountMatches.length === 0) {
    console.log('⚠ 未找到任何金额');
    return results;
  }

  // 3. 对每个金额，提取商家名称
  for (let i = 0; i < amountMatches.length; i++) {
    const amountInfo = amountMatches[i];
    const amountEndIndex = amountInfo.index + amountInfo.sign.length + amountInfo.amount.toString().length;
    
    // 获取金额前的文本
    const startIndex = Math.max(0, amountInfo.index - 100);
    const textBeforeAmount = cleanedText.substring(startIndex, amountInfo.index);
    
    // 清理文本
    let cleanedBefore = textBeforeAmount.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
    cleanedBefore = cleanedBefore.replace(/[\s\-\|]+$/, '');
    
    // 提取商家名称
    const merchant = extractMerchantFromText(cleanedBefore);
    
    if (!merchant) {
      console.log(`  跳过金额 ${amountInfo.sign}${amountInfo.amount}，无法识别商家`);
      continue;
    }
    
    console.log(`\n发现交易: "${merchant}" ${amountInfo.sign}${amountInfo.amount}`);
    
    const billType = amountInfo.sign === '+' ? 'income' : 'expense';
    
    const result = {
      amount: amountInfo.amount,
      date: new Date(baseYearMonth + '-01T00:00:00.000Z').toISOString(),
      description: '',
      merchant: merchant,
      confidence: 85,
      rawDate: baseYearMonth + '-01',
      billType: billType,
    };

    // 简单分类
    const categoryInfo = matchWechatCategory(merchant);
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

function extractMerchantFromText(text) {
  if (!text) return null;
  
  // 移除emoji
  let cleaned = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  
  // 移除UI干扰词
  cleaned = cleaned.replace(/(账单|交易|统计|收支|查找|今天|昨天|全部|支出|收入|全|人|从|汉)/g, ' ');
  
  // 连接被OCR拆分的字符
  cleaned = cleaned.replace(/\s+/g, '').trim();
  
  console.log(`  提取商家原文: "${cleaned}"`);
  
  if (cleaned.length < 2) return null;
  
  // 商家匹配模式
  const merchantPatterns = [
    { pattern: /扫[二两]?维?码?付.给/, name: '扫二维码付款-给' },
    { pattern: /扫码付.给/, name: '扫二维码付款-给' },
    { pattern: /扫[二两]?维?码?付/, name: '扫二维码付款' },
    { pattern: /扫码付/, name: '扫二维码付款' },
    { pattern: /[二两]?维?码?收.来.?自/, name: '二维码收款-来自' },
    { pattern: /二维码?收.自/, name: '二维码收款-来自' },
    { pattern: /扫码收.?自/, name: '二维码收款-来自' },
    { pattern: /[二两]?维?码?收/, name: '二维码收款' },
    { pattern: /凯德/, name: '凯德集团' },
    { pattern: /中石化.*石.*油.*分.*公.*司/, name: '中石化辽宁石油分公司' },
    { pattern: /中石化/, name: '中石化' },
    { pattern: /悦来.*家.*常.*菜/, name: '悦来家常菜' },
    { pattern: /家.*常.*菜/, name: '家常菜' },
  ];
  
  for (const { pattern, name } of merchantPatterns) {
    if (pattern.test(cleaned)) {
      console.log(`  匹配商家: "${name}" (模式: ${pattern})`);
      return name;
    }
  }
  
  const chineseMatch = cleaned.match(/[\u4e00-\u9fa5]{2,}$/);
  if (chineseMatch) {
    console.log(`  使用尾部商家: "${chineseMatch[0]}"`);
    return chineseMatch[0];
  }
  
  return null;
}

function matchWechatCategory(merchant) {
  if (!merchant) return { id: 'other', name: '其他', type: 'expense' };
  
  const categoryRules = [
    { keywords: ['凯德', '商场', '购物中心', '超市', '便利店', '商店', '店铺', '门店', '购物'], category: { id: 'shopping', name: '购物/商场消费', type: 'expense' } },
    { keywords: ['中石化', '中石油', '加油站', '加油', '停车', '停车场', '高速', 'ETC', '地铁', '公交', '打车', '出租', '交通'], category: { id: 'transport', name: '交通/加油', type: 'expense' } },
    { keywords: ['家常菜', '餐厅', '饭店', '餐馆', '食堂', '小吃', '快餐', '火锅', '烧烤', '烤肉', '面馆', '粥', '饺子', '包子', '馒头', '餐饮', '饭店'], category: { id: 'food', name: '餐饮', type: 'expense' } },
    { keywords: ['扫二维码付款', '扫码付款'], category: { id: 'life_service', name: '餐饮/生活服务', type: 'expense' } },
    { keywords: ['二维码收款', '扫码收款', '收钱'], category: { id: 'transfer_in', name: '个人转账收入', type: 'income' } },
    { keywords: ['转账', '红包', '微信红包'], category: { id: 'transfer', name: '转账/红包', type: 'expense' } },
  ];
  
  for (const rule of categoryRules) {
    for (const keyword of rule.keywords) {
      if (merchant.includes(keyword)) {
        console.log(`✓ 分类匹配: "${merchant}" → "${rule.category.name}" (关键词: ${keyword})`);
        return rule.category;
      }
    }
  }
  
  console.log(`✓ 分类匹配: "${merchant}" → "其他" (默认)`);
  return { id: 'other', name: '其他', type: 'expense' };
}

// 读取图片文件
const imagePath = path.join(__dirname, 'example', '微信图片_20260325104718_18_3.jpg');

async function testOCRAndParsing() {
  console.log('开始OCR识别和解析测试:', imagePath);
  
  try {
    // 1. OCR识别
    const result = await Tesseract.recognize(
      fs.readFileSync(imagePath),
      'chi_sim+eng',
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            process.stdout.write(`\r进度: ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );

    console.log('\n\n=== OCR识别结果 ===');
    console.log('置信度:', result.data.confidence);
    
    // 2. 检测账单类型
    const billType = detectBillType(result.data.text);
    console.log('账单类型:', billType);

    // 3. 测试微信交易列表解析
    console.log('\n=== 微信交易列表解析 ===');
    const wechatResults = parseWechatTransactionList(result.data.text);
    
    // 4. 统计分析
    console.log('\n=== 统计分析 ===');
    const expenseCount = wechatResults.filter(r => r.billType === 'expense').length;
    const incomeCount = wechatResults.filter(r => r.billType === 'income').length;
    const totalExpense = wechatResults.filter(r => r.billType === 'expense').reduce((sum, r) => sum + r.amount, 0);
    const totalIncome = wechatResults.filter(r => r.billType === 'income').reduce((sum, r) => sum + r.amount, 0);
    
    console.log(`支出记录: ${expenseCount} 条，总计: ¥${totalExpense.toFixed(2)}`);
    console.log(`收入记录: ${incomeCount} 条，总计: ¥${totalIncome.toFixed(2)}`);
    console.log(`净收支: ¥${(totalIncome - totalExpense).toFixed(2)}`);
    console.log(`识别成功率: ${wechatResults.length}/8 = ${(wechatResults.length/8*100).toFixed(1)}%`);

    // 5. 详细结果
    console.log('\n=== 详细解析结果 ===');
    wechatResults.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.merchant}`);
      console.log(`   金额: ${result.billType === 'expense' ? '-' : '+'}¥${result.amount}`);
      console.log(`   分类: ${result.category}`);
      console.log(`   日期: ${result.date.split('T')[0]}`);
    });

  } catch (error) {
    console.error('测试失败:', error);
  }
}

testOCRAndParsing();
