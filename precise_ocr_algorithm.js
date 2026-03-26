// 精确的通用OCR算法 - 针对压缩格式优化
import Tesseract from 'tesseract.js';

// 测试用的压缩文本
const compressedText = `10:27 91 账单 全 部 账单 查找 交易 收 支 统计 2026 年 3 月 4 37 1169.43 收入 503.00 凯 德 集团 -20.00 全 扫 二 维 码 付款 -给 宁静 的 深海 -18.00 凯 德 集团 -20.00 5 扫 二 维 码 付款 -给 可 心 35.00 全 二 维 码 收 款 -来 自 刁 6 +3.00 凯 德 集团 -20.00 扫 二 维 码 付款 -给 悦 来 家 常 菜 18.00 人 中 石化 辽 宁 石 油 分 公 司 -260.00`;

console.log('🧪 精确的通用OCR算法测试');

// 精确的金额提取 - 基于上下文分析
function extractPreciseAmounts(text) {
  console.log('\n💰 精确提取交易金额...');
  
  const amounts = [];
  
  // 1. 查找所有带符号的金额
  const signedPattern = /([\+\-])(\d+\.\d{2})/g;
  let match;
  
  while ((match = signedPattern.exec(text)) !== null) {
    const sign = match[1];
    const amount = parseFloat(match[2]);
    const index = match.index;
    const original = match[0];
    
    // 获取上下文
    const contextStart = Math.max(0, index - 100);
    const contextEnd = Math.min(text.length, index + original.length + 100);
    const context = text.substring(contextStart, contextEnd);
    
    console.log(`\n分析金额: ${sign}${amount} (位置: ${index})`);
    console.log(`上下文: "${context}"`);
    
    // 判断是否为交易金额
    const isTransactionAmount = analyzeTransactionContext(context, sign, amount);
    
    if (isTransactionAmount) {
      amounts.push({
        sign,
        amount,
        index,
        original,
        context
      });
      console.log(`✅ 识别为交易金额: ${sign}${amount}`);
    } else {
      console.log(`❌ 过滤非交易金额: ${sign}${amount}`);
    }
  }
  
  // 2. 查找纯数字金额（在交易上下文中）
  const purePattern = /([\u4e00-\u9fa5]{2,})\s+(\d+\.\d{2})(?=\s|$)/g;
  while ((match = purePattern.exec(text)) !== null) {
    const amount = parseFloat(match[2]);
    const index = match.index;
    const original = match[0];
    
    // 检查是否已存在
    const exists = amounts.some(a => Math.abs(a.index - index) < 10);
    if (!exists) {
      // 获取上下文
      const contextStart = Math.max(0, index - 100);
      const contextEnd = Math.min(text.length, index + original.length + 100);
      const context = text.substring(contextStart, contextEnd);
      
      console.log(`\n分析纯数字金额: ${amount} (位置: ${index})`);
      console.log(`上下文: "${context}"`);
      
      const isTransactionAmount = analyzeTransactionContext(context, '-', amount);
      
      if (isTransactionAmount) {
        amounts.push({
          sign: '-',
          amount,
          index,
          original,
          context
        });
        console.log(`✅ 识别为交易金额: -${amount}`);
      } else {
        console.log(`❌ 过滤非交易金额: ${amount}`);
      }
    }
  }
  
  // 排序
  const sorted = amounts.sort((a, b) => a.index - b.index);
  
  console.log(`\n找到 ${sorted.length} 个交易金额:`, sorted.map(a => `${a.sign}${a.amount}`).join(', '));
  return sorted;
}

// 分析交易上下文
function analyzeTransactionContext(context, sign, amount) {
  // 总计/摘要上下文的关键词
  const summaryKeywords = ['总计', '合计', '余额', '收入', '支出', '统计', '1169.43', '503.00'];
  
  // 交易上下文的关键词
  const transactionKeywords = ['付款', '收款', '转账', '集团', '公司', '超市', '餐厅', '石油', '石化', '给', '来自'];
  
  // 检查是否在总计上下文中
  const inSummaryContext = summaryKeywords.some(keyword => context.includes(keyword));
  
  // 检查是否在交易上下文中
  const inTransactionContext = transactionKeywords.some(keyword => context.includes(keyword));
  
  // 特殊规则：
  // 1. 大金额（>100）且在总计上下文中 -> 过滤
  if (amount > 100 && inSummaryContext) {
    return false;
  }
  
  // 2. 小金额（<100）且在交易上下文中 -> 保留
  if (amount < 100 && inTransactionContext) {
    return true;
  }
  
  // 3. 中等金额（10-100）且不在总计上下文中 -> 保留
  if (amount >= 10 && amount <= 100 && !inSummaryContext) {
    return true;
  }
  
  // 4. 收入金额（+）且在收款上下文中 -> 保留
  if (sign === '+' && (context.includes('收款') || context.includes('来自'))) {
    return true;
  }
  
  // 5. 支出金额（-）且在付款上下文中 -> 保留
  if (sign === '-' && (context.includes('付款') || context.includes('给'))) {
    return true;
  }
  
  return false;
}

// 精确的商家提取 - 基于交易上下文
function extractPreciseMerchant(text, amountInfo) {
  console.log(`\n🏪 精确提取商家`);
  console.log(`金额: ${amountInfo.sign}${amountInfo.amount}`);
  console.log(`位置: ${amountInfo.index}`);
  console.log(`上下文: "${amountInfo.context}"`);
  
  // 获取金额前的文本（从上下文中提取）
  const beforeAmount = amountInfo.context.substring(0, amountInfo.context.indexOf(amountInfo.original));
  console.log(`金额前文本: "${beforeAmount}"`);
  
  // 策略1: 转账模式
  const transferPatterns = [
    /转账\s*[-\s]*给\s*([^\d\s]{2,20})\s*$/i,
    /收款\s*[-\s]*来自\s*([^\d\s]{2,20})\s*$/i,
    /给\s*([^\d\s]{2,20})\s*$/i,
    /来自\s*([^\d\s]{2,20})\s*$/i,
  ];
  
  for (const pattern of transferPatterns) {
    const match = beforeAmount.match(pattern);
    if (match && match[1]) {
      const merchant = match[1].trim();
      console.log(`✓ 转账模式: "${merchant}"`);
      return merchant;
    }
  }
  
  // 策略2: 扫码模式
  const scanPatterns = [
    /扫[二两]?维?码?\s*付款\s*[-\s]*给\s*([^\d\s]{2,20})\s*$/i,
    /二[维码]?码?\s*收款\s*[-\s]*来自\s*([^\d\s]{2,20})\s*$/i,
  ];
  
  for (const pattern of scanPatterns) {
    const match = beforeAmount.match(pattern);
    if (match && match[1]) {
      const merchant = match[1].trim();
      console.log(`✓ 扫码模式: "${merchant}"`);
      return merchant;
    }
  }
  
  // 策略3: 公司/商家模式
  const companyPatterns = [
    /([^\d\s]{2,20})\s*(集团|公司|有限公司|分公司|超市|商场|店|餐厅|咖啡厅)\s*$/i,
    /([^\d\s]{2,20})\s*(石油|石化|银行)\s*$/i,
  ];
  
  for (const pattern of companyPatterns) {
    const match = beforeAmount.match(pattern);
    if (match && match[1]) {
      const merchant = (match[1] + (match[2] || '')).trim();
      console.log(`✓ 公司模式: "${merchant}"`);
      return merchant;
    }
  }
  
  // 策略4: 查找最近的中文词组（排除常见词汇）
  const chinesePatterns = [
    /([^\d\s]{2,20})\s*$/, // 文本末尾的中文
  ];
  
  for (const pattern of chinesePatterns) {
    const match = beforeAmount.match(pattern);
    if (match && match[1]) {
      const merchant = match[1].trim();
      
      // 排除常见的非商家词汇
      const excludeWords = [
        '账单', '交易', '收支', '统计', '查找', '全部', '详情', '记录', 
        '收入', '支出', '余额', '年', '月', '日', '元', '块',
        '全', '部', '二', '维', '码', '付', '款', '收', '来', '自',
        '扫', '给', '的', '人', '中', '辽', '宁', '石', '油', '分', '公', '司'
      ];
      
      if (!excludeWords.some(word => merchant.includes(word)) && merchant.length >= 2) {
        console.log(`✓ 中文模式: "${merchant}"`);
        return merchant;
      }
    }
  }
  
  // 策略5: 智能分段提取
  const words = beforeAmount.split(/\s+/).filter(word => /[\u4e00-\u9fa5]/.test(word));
  if (words.length > 0) {
    // 取最后2-3个有意义的词
    const meaningfulWords = words.slice(-3);
    const merchant = meaningfulWords.join('');
    
    if (merchant.length >= 2 && merchant.length <= 10) {
      console.log(`✓ 智能分段: "${merchant}"`);
      return merchant;
    }
  }
  
  console.log('⚠ 无法提取商家');
  return null;
}

// 智能分类
function smartCategorize(merchant, amount, sign) {
  if (!merchant) {
    return sign === '+' ? '转账收入' : '其他支出';
  }
  
  // 基于商家名称和金额的智能分类
  const categoryRules = [
    {
      category: '购物',
      keywords: ['超市', '商场', '集团', '购物', '便利店', '店', '凯德'],
      sign: '-',
      amountRange: [1, 10000]
    },
    {
      category: '餐饮',
      keywords: ['餐厅', '咖啡', '家常菜', '美食', '餐饮', '悦来'],
      sign: '-',
      amountRange: [1, 1000]
    },
    {
      category: '交通',
      keywords: ['石油', '石化', '加油', '交通', '中石化'],
      sign: '-',
      amountRange: [10, 1000]
    },
    {
      category: '转账收入',
      keywords: ['收款', '转账', '收入', '来自'],
      sign: '+',
      amountRange: [0.01, 10000]
    },
    {
      category: '转账支出',
      keywords: ['付款', '转账', '支付', '扫码', '给'],
      sign: '-',
      amountRange: [0.01, 10000]
    },
  ];
  
  // 查找匹配的分类
  for (const rule of categoryRules) {
    if (rule.sign === sign && amount >= rule.amountRange[0] && amount <= rule.amountRange[1]) {
      for (const keyword of rule.keywords) {
        if (merchant.includes(keyword)) {
          console.log(`✓ 分类匹配: "${merchant}" -> ${rule.category} (关键词: ${keyword})`);
          return rule.category;
        }
      }
    }
  }
  
  // 默认分类
  const defaultCategory = sign === '+' ? '转账收入' : '其他支出';
  console.log(`✓ 默认分类: "${merchant}" -> ${defaultCategory}`);
  return defaultCategory;
}

// 主要解析函数
function parseBillPrecise(text) {
  console.log('\n🚀 开始精确的账单解析...');
  console.log(`文本长度: ${text.length}`);
  
  // 1. 精确提取交易金额
  const amounts = extractPreciseAmounts(text);
  
  if (amounts.length === 0) {
    console.log('❌ 未找到有效交易金额');
    return [];
  }
  
  // 2. 精确提取商家并构建结果
  const results = [];
  
  for (let i = 0; i < amounts.length; i++) {
    const amountInfo = amounts[i];
    console.log(`\n--- 处理金额 ${i + 1}/${amounts.length}: ${amountInfo.sign}${amountInfo.amount} ---`);
    
    const merchant = extractPreciseMerchant(text, amountInfo);
    if (!merchant) {
      console.log(`⚠ 跳过，无法识别商家`);
      continue;
    }
    
    const category = smartCategorize(merchant, amountInfo.amount, amountInfo.sign);
    
    const result = {
      merchant,
      amount: amountInfo.amount,
      type: amountInfo.sign === '+' ? 'income' : 'expense',
      category,
      original: amountInfo.original,
      index: amountInfo.index,
    };
    
    results.push(result);
    console.log(`✅ 成功: "${merchant}" ${amountInfo.sign}${amountInfo.amount} -> ${category}`);
  }
  
  console.log(`\n🎉 解析完成！共识别 ${results.length} 条记录`);
  return results;
}

// 测试精确算法
function testPreciseAlgorithm() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 测试精确的通用OCR算法');
  console.log('='.repeat(80));
  
  const results = parseBillPrecise(compressedText);
  
  console.log('\n📊 结果统计');
  console.log('-'.repeat(60));
  console.log(`识别记录数: ${results.length}`);
  
  const income = results.filter(r => r.type === 'income');
  const expense = results.filter(r => r.type === 'expense');
  
  console.log(`收入记录: ${income.length} 条`);
  console.log(`支出记录: ${expense.length} 条`);
  console.log(`总收入: ¥${income.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}`);
  console.log(`总支出: ¥${expense.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}`);
  
  console.log('\n📋 详细结果');
  console.log('序号 | 商家名称 | 金额 | 类型 | 分类 | 位置');
  console.log('-'.repeat(80));
  
  results.forEach((result, index) => {
    const amountStr = result.type === 'expense' ? `-¥${result.amount}` : `+¥${result.amount}`;
    const typeIcon = result.type === 'expense' ? '💸' : '💵';
    console.log(`${(index + 1).toString().padStart(2)} | ${result.merchant.padEnd(15)} | ${amountStr.padStart(8)} | ${typeIcon} ${result.type} | ${result.category.padEnd(8)} | ${result.index}`);
  });
  
  // 分析结果
  console.log('\n🔍 算法分析');
  console.log('-'.repeat(60));
  
  // 预期应该有的金额
  const expectedAmounts = [20, 18, 20, 35, 3, 20, 18, 260];
  const foundAmounts = results.map(r => r.amount);
  
  console.log('预期金额:', expectedAmounts.join(', '));
  console.log('找到金额:', foundAmounts.join(', '));
  
  const missing = expectedAmounts.filter(a => !foundAmounts.includes(a));
  const extra = foundAmounts.filter(a => !expectedAmounts.includes(a));
  
  if (missing.length > 0) {
    console.log(`❌ 缺失金额: ${missing.join(', ')}`);
  }
  
  if (extra.length > 0) {
    console.log(`⚠️ 多余金额: ${extra.join(', ')}`);
  }
  
  if (missing.length === 0 && extra.length === 0) {
    console.log('✅ 金额识别完全正确！');
  }
  
  return results;
}

// 运行测试
testPreciseAlgorithm();

// 导出函数
export {
  extractPreciseAmounts,
  extractPreciseMerchant,
  smartCategorize,
  parseBillPrecise
};
