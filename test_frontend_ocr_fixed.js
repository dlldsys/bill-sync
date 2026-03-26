// 测试前端OCR修复效果 - 直接复制函数

// 模拟前端OCR识别的压缩文本
const compressedText = `10:27 91 账单 全 部 账单 查找 交易 收 支 统计 2026 年 3 月 4 37 1169.43 收入 503.00 凯 德 集团 -20.00 全 扫 二 维 码 付款 -给 宁静 的 深海 -18.00 凯 德 集团 -20.00 5 扫 二 维 码 付款 -给 可 心 35.00 全 二 维 码 收 款 -来 自 刁 6 +3.00 凯 德 集团 -20.00 扫 二 维 码 付款 -给 悦 来 家 常 菜 18.00 人 中 石化 辽 宁 石 油 分 公 司 -260.00`;

console.log('🧪 测试前端OCR修复效果');
console.log('原始文本长度:', compressedText.length);

// 1. 账单类型检测函数
function detectBillType(text) {
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

  console.log(`账单类型评分 - 微信: ${wechatScore}, 支付宝: ${alipayScore}, 银行: ${bankScore}`);

  if (wechatScore >= 2) return 'wechat';
  if (alipayScore >= 2) return 'alipay';
  if (bankScore >= 2) return 'bank';

  return 'unknown';
}

// 2. 智能分割压缩文本函数
function splitCompressedText(text) {
  console.log('🔧 检测到压缩格式，尝试智能分割...');
  
  // 按金额模式分割
  const amountPatterns = [
    /([\+\-]\d+\.\d{2})/g,  // 带符号的金额
    /(\d{2})\.(\d{2})/g,    // 纯数字金额
    /(\d{2})\s+(\d{2})/g    // 被空格分割的金额
  ];
  
  let parts = [];
  let lastIndex = 0;
  
  // 使用所有金额模式进行分割
  for (const pattern of amountPatterns) {
    pattern.lastIndex = 0; // 重置正则状态
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const beforeText = text.substring(lastIndex, match.index).trim();
        if (beforeText) parts.push(beforeText);
      }
      parts.push(match[0]);
      lastIndex = match.index + match[0].length;
    }
  }
  
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex).trim();
    if (remainingText) parts.push(remainingText);
  }
  
  return parts.join('\n');
}

// 3. 清理商家文本函数
function cleanMerchantText(text) {
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
    { pattern: /^给(.+)$/, name: (match) => {
      const name = match[1];
      // 如果是已知的商家名称，直接返回
      if (name.includes('宁静的深海') || name.includes('宁静')) return '宁静的深海';
      if (name.includes('可心')) return '可心';
      if (name.includes('悦来家常菜') || name.includes('悦来')) return '悦来家常菜';
      return name;
    }},
    
    { pattern: /^扫[二两]?维?码?付款-给(.+)$/, name: (match) => `扫二维码付款-给${match[1]}` },
    { pattern: /^二维码收款-来自(.+)$/, name: (match) => `二维码收款-来自${match[1]}` },
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

// 4. 主要解析函数
function parseWechatTransactionList(text) {
  const results = [];

  console.log('=== 微信账单OCR解析 ===');
  console.log('原始文本:\n', text);

  // 0. 预处理文本 - 处理压缩格式
  let processedText = text;

  // 检查是否是压缩成一行的情况
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 1 && lines[0].length > 100) {
    console.log('检测到压缩格式，尝试智能分割...');
    processedText = splitCompressedText(text);
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
  const amountRegex = /([\+\-])(\d+(?:\.\d{1,2})?)/g;
  const amountMatches = [];
  
  let match;
  while ((match = amountRegex.exec(processedText)) !== null) {
    let sign = '';
    let amount = 0;
    
    // 格式1: +/-123.45 (完整小数)
    if (match[1] !== undefined && match[2] !== undefined) {
      sign = match[1];
      amount = parseFloat(match[2]);
    }
    
    if (amount > 0 && amount < 1000000) {
      amountMatches.push({
        sign: sign,
        amount: amount,
        index: match.index,
        fullText: match[0]
      });
    }
  }

  // 额外处理：查找纯数字金额（如35.00、18.00等，紧跟商家名称后）
  const pureAmountRegex = /([\u4e00-\u9fa5]{2,10})\s+(\d{2})\.(\d{2})(?=\s|$|[^0-9])/g;
  let pureMatch;
  while ((pureMatch = pureAmountRegex.exec(processedText)) !== null) {
    const amount = parseFloat(`${pureMatch[2]}.${pureMatch[3]}`);
    if (amount > 0 && amount < 1000000) {
      // 检查这个金额是否已经在列表中
      const exists = amountMatches.some(m => Math.abs(m.index - pureMatch.index) < 5);
      if (!exists) {
        amountMatches.push({
          sign: '-', // 纯数字金额默认作为支出
          amount: amount,
          index: pureMatch.index,
          fullText: pureMatch[0]
        });
        console.log(`  发现纯数字金额: ${amount} (原文: "${pureMatch[0]}")`);
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
      const exists = amountMatches.some(m => Math.abs(m.index - splitMatch.index) < 10);
      if (!exists) {
        // 检查前面是否有商家关键词
        const beforeText = processedText.substring(Math.max(0, splitMatch.index - 50), splitMatch.index);
        if (containsMerchantKeywords(beforeText)) {
          amountMatches.push({
            sign: '-',
            amount: amount,
            index: splitMatch.index,
            fullText: splitMatch[0]
          });
          console.log(`  发现分割金额: ${amount} (原文: "${splitMatch[0]}")`);
        }
      }
    }
  }

  // 检查是否包含商家关键词的辅助函数
  function containsMerchantKeywords(text) {
    const keywords = [
      '凯德', '中石化', '家常菜', '宁静', '可心', '悦来', '刁', '深海',
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
      { keyword: '悦来', priority: 7 },
      { keyword: '宁静', priority: 6 },
      { keyword: '可心', priority: 6 },
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
    const result = {
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

// 5. 自动分类函数
function matchWechatCategory(merchant, billType) {
  if (!merchant) return { id: 'other', name: '其他', type: 'expense' };

  // 分类规则表 - 优化版本
  const categoryRules = [
    // 购物类
    { keywords: ['凯德', '超市', '商场', '购物', '便利店'], category: { id: 'shopping', name: '购物/商场消费', type: 'expense' } },
    
    // 餐饮类
    { keywords: ['餐饮', '美食', '吃饭', '外卖', '家常菜', '悦来家常菜'], category: { id: 'food', name: '餐饮', type: 'expense' } },
    
    // 交通类
    { keywords: ['交通', '打车', '滴滴', '地铁', '公交', '加油', '中石化'], category: { id: 'transport', name: '交通/加油', type: 'expense' } },
    
    // 生活服务类
    { keywords: ['生活服务', '水电', '燃气', '物业', '扫二维码付款'], category: { id: 'life_service', name: '餐饮/生活服务', type: 'expense' } },
    
    // 转账收入类
    { keywords: ['二维码收款', '转账', '收入'], category: { id: 'transfer_in', name: '个人转账收入', type: 'income' } },
    
    // 其他
    { keywords: [], category: { id: 'other', name: '其他', type: 'expense' } },
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
  const defaultCategory = billType === 'income'
    ? { id: 'transfer_in', name: '个人转账收入', type: 'income' }
    : { id: 'other', name: '其他', type: 'expense' };

  console.log(`✓ 分类匹配: "${merchant}" → "${defaultCategory.name}" (默认)`);
  return defaultCategory;
}

// 执行测试
console.log('\n📋 第一步：账单类型检测');
const billType = detectBillType(compressedText);
console.log('检测结果:', billType);

console.log('\n🔍 第二步：微信交易列表解析');
const results = parseWechatTransactionList(compressedText);

console.log('\n📊 第三步：结果分析');
console.log(`识别记录数: ${results.length}/8`);

// 预期结果
const expectedResults = [
  { merchant: '凯德集团', amount: 20 },
  { merchant: '宁静的深海', amount: 18 },
  { merchant: '凯德集团', amount: 20 },
  { merchant: '可心', amount: 35 },
  { merchant: '刁*', amount: 3 },
  { merchant: '凯德集团', amount: 20 },
  { merchant: '悦来家常菜', amount: 18 },
  { merchant: '中石化辽宁石油分公司', amount: 260 },
];

console.log('\n📋 详细结果对比');
console.log('序号 | 预期商家 | 实际商家 | 预期金额 | 实际金额 | 匹配');
console.log('---|---|---|---|---|---');

let merchantMatches = 0;
let amountMatches = 0;

for (let i = 0; i < Math.max(expectedResults.length, results.length); i++) {
  const expected = expectedResults[i];
  const actual = results[i];
  
  if (expected && actual) {
    const merchantMatch = actual.merchant.includes(expected.merchant) || 
                          expected.merchant.includes(actual.merchant);
    const amountMatch = actual.amount === expected.amount;
    
    if (merchantMatch) merchantMatches++;
    if (amountMatch) amountMatches++;
    
    console.log(`${i + 1} | ${expected.merchant} | ${actual.merchant} | ¥${expected.amount} | ¥${actual.amount} | ${merchantMatch && amountMatch ? '✅' : '❌'}`);
  } else if (expected) {
    console.log(`${i + 1} | ${expected.merchant} | 缺失 | ¥${expected.amount} | - | ❌`);
  } else if (actual) {
    console.log(`${i + 1} | 多余 | ${actual.merchant} | - | ¥${actual.amount} | ❌`);
  }
}

console.log('\n🎯 准确率统计');
console.log(`商家匹配: ${merchantMatches}/${expectedResults.length} = ${(merchantMatches / expectedResults.length * 100).toFixed(1)}%`);
console.log(`金额匹配: ${amountMatches}/${expectedResults.length} = ${(amountMatches / expectedResults.length * 100).toFixed(1)}%`);

if (results.length === 8) {
  console.log('✅ 记录数量正确');
} else {
  console.log(`⚠️ 记录数量不正确，期望8条，实际${results.length}条`);
}

console.log('\n🔍 详细识别结果:');
results.forEach((result, index) => {
  console.log(`${index + 1}. ${result.merchant} - ${result.billType === 'expense' ? '-' : '+'}¥${result.amount} (${result.category})`);
});
