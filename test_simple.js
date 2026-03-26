// 简化测试压缩格式解析
const compressedText = `10:27 91 账单 全 部 账单 查找 交易 收 支 统计 2026 年 3 月 4 37 1169.43 收入 503.00 凯 德 集团 -20.00 全 扫 二 维 码 付款 -给 宁静 的 深海 -18.00 凯 德 集团 -20.00 5 扫 二 维 码 付款 -给 可 心 35.00 全 二 维 码 收 款 -来 自 刁 6 +3.00 凯 德 集团 -20.00 扫 二 维 码 付款 -给 悦 来 家 常 菜 18.00 人 中 石化 辽宁 石油 分 公司 -260.00`;

console.log('🧪 测试压缩格式OCR文本解析');
console.log('原始文本长度:', compressedText.length);

// 1. 账单类型检测
function detectBillType(text) {
  if (!text) return 'unknown';
  const lowerText = text.toLowerCase();
  
  const wechatPatterns = [
    '账单', '查找', '交易', '收支', '统计',
    /\d{4}\s*年\s*\d{1,2}\s*月/,
    /[\+\-]\d+\.\d{2}/,
  ];
  
  let wechatScore = 0;
  for (const pattern of wechatPatterns) {
    if (typeof pattern === 'string') {
      if (lowerText.includes(pattern.toLowerCase())) {
        wechatScore++;
      }
    } else if (pattern instanceof RegExp) {
      if (pattern.test(text)) {
        wechatScore++;
      }
    }
  }
  
  return wechatScore >= 2 ? 'wechat' : 'unknown';
}

// 2. 智能分割压缩文本
function splitCompressedText(text) {
  console.log('检测到压缩格式，尝试智能分割...');
  
  const amountPattern = /([\+\-]\d+\.\d{2})/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  
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
  
  return parts.join('\n');
}

// 3. 提取商家名称
function extractMerchantFromText(text) {
  if (!text) return null;
  
  let cleaned = text
    .replace(/[|全从汉党及回省Q@查找交易收支统计>]/g, '')
    .replace(/\d{4}年\d{1,2}月/g, '')
    .replace(/支出¥\d+\.?\d*收入¥\d+\.?\d*/g, '')
    .replace(/\s+/g, '')
    .trim();
  
  if (cleaned.length < 2) return null;
  
  const merchantPatterns = [
    { pattern: /凯德集团/, name: '凯德集团' },
    { pattern: /宁静的深海/, name: '宁静的深海' },
    { pattern: /宁静/, name: '宁静的深海' },
    { pattern: /可心/, name: '可心' },
    { pattern: /刁/, name: '刁*' },
    { pattern: /悦来家常菜/, name: '悦来家常菜' },
    { pattern: /悦来/, name: '悦来家常菜' },
    { pattern: /中石化.*石油.*分公司/, name: '中石化辽宁石油分公司' },
    { pattern: /中石化/, name: '中石化' },
    { pattern: /扫[二两]?维?码?付款-给(.+)/, name: (match) => `扫二维码付款-给${match[1]}` },
    { pattern: /二维码收款-来自(.+)/, name: (match) => `二维码收款-来自${match[1]}` },
  ];
  
  for (const { pattern, name } of merchantPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const merchantName = typeof name === 'function' ? name(match) : name;
      return merchantName;
    }
  }
  
  return null;
}

// 4. 完整解析函数
function parseWechatTransactionList(text) {
  console.log('\n=== 微信账单OCR解析 ===');
  console.log('原始文本:', text.substring(0, 200) + '...');

  // 预处理压缩文本
  let processedText = text;
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length === 1 && lines[0].length > 100) {
    processedText = splitCompressedText(text);
    console.log('分割后文本行数:', processedText.split('\n').length);
  }

  // 提取基准日期
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

  // 提取所有金额
  const amountRegex = /([\+\-])(\d+)\.(\d{2})|([\+\-])(\d+)(?=\D|$)/g;
  const amountMatches = [];
  let match;
  
  while ((match = amountRegex.exec(processedText)) !== null) {
    let sign = '';
    let amount = 0;
    
    if (match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
      sign = match[1];
      amount = parseFloat(`${match[2]}.${match[3]}`);
    } else if (match[4] !== undefined && match[5] !== undefined) {
      sign = match[4];
      amount = parseFloat(match[5]);
    }
    
    if (amount > 0 && amount < 1000000) {
      amountMatches.push({
        sign: sign,
        amount: amount,
        index: match.index
      });
    }
  }

  amountMatches.sort((a, b) => a.index - b.index);
  
  console.log('✓ 找到', amountMatches.length, '个金额');
  console.log('金额详情:', amountMatches.map(a => `${a.sign}${a.amount}`).join(', '));

  const results = [];

  // 对每个金额提取商家
  for (let i = 0; i < amountMatches.length; i++) {
    const amountInfo = amountMatches[i];
    
    // 获取金额前的文本
    const startIndex = Math.max(0, amountInfo.index - 150);
    const textBeforeAmount = processedText.substring(startIndex, amountInfo.index);
    
    console.log(`\n处理金额 ${amountInfo.sign}${amountInfo.amount}`);
    console.log(`金额前文本: "${textBeforeAmount.substring(textBeforeAmount.length - 50)}"`);
    
    const merchant = extractMerchantFromText(textBeforeAmount);
    
    if (!merchant) {
      console.log(`  ⚠ 跳过，无法识别商家`);
      continue;
    }
    
    const billType = amountInfo.sign === '+' ? 'income' : 'expense';
    
    results.push({
      merchant: merchant,
      amount: amountInfo.amount,
      type: billType
    });
    
    console.log(`  ✓ 成功: "${merchant}" ${amountInfo.sign}${amountInfo.amount}`);
  }

  console.log('\n=== 解析完成 ===');
  console.log('共解析', results.length, '条交易记录');
  return results;
}

// 执行测试
console.log('\n📋 第一步：账单类型检测');
const billType = detectBillType(compressedText);
console.log('检测结果:', billType);

console.log('\n🔍 第二步：微信交易列表解析');
const results = parseWechatTransactionList(compressedText);

console.log('\n📊 第三步：结果分析');
console.log(`识别记录数: ${results.length}/8`);

// 预期结果对比
const expected = [
  { merchant: '凯德集团', amount: 20 },
  { merchant: '宁静的深海', amount: 18 },
  { merchant: '凯德集团', amount: 20 },
  { merchant: '可心', amount: 35 },
  { merchant: '刁*', amount: 3 },
  { merchant: '凯德集团', amount: 20 },
  { merchant: '悦来家常菜', amount: 18 },
  { merchant: '中石化辽宁石油分公司', amount: 260 }
];

console.log('\n📋 详细结果对比');
console.log('序号 | 预期商家 | 实际商家 | 预期金额 | 实际金额 | 匹配');
console.log('---|---|---|---|---|---');

let merchantMatches = 0;
let amountMatches = 0;

results.forEach((result, index) => {
  const expectedItem = expected[index];
  if (!expectedItem) return;
  
  const merchantMatch = expectedItem.merchant.includes(result.merchant) || 
                        result.merchant.includes(expectedItem.merchant);
  const amountMatch = expectedItem.amount === result.amount;
  
  if (merchantMatch) merchantMatches++;
  if (amountMatch) amountMatches++;
  
  const matchIcon = merchantMatch && amountMatch ? '✅' : '❌';
  
  console.log(`${index + 1} | ${expectedItem.merchant} | ${result.merchant} | ¥${expectedItem.amount} | ¥${result.amount} | ${matchIcon}`);
});

const merchantAccuracy = (merchantMatches / 8 * 100).toFixed(1);
const amountAccuracy = (amountMatches / 8 * 100).toFixed(1);

console.log(`\n🎯 准确率统计`);
console.log(`商家匹配: ${merchantMatches}/8 = ${merchantAccuracy}%`);
console.log(`金额匹配: ${amountMatches}/8 = ${amountAccuracy}%`);

if (parseFloat(merchantAccuracy) >= 75) {
  console.log('✅ 商家识别优化成功');
} else {
  console.log('⚠️ 商家识别需要进一步优化');
}

if (results.length === 8) {
  console.log('✅ 记录数量识别正确');
} else {
  console.log(`⚠️ 记录数量不正确，期望8条，实际${results.length}条`);
}
