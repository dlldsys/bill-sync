// 测试前端OCR修复效果
import { parseWechatTransactionList, detectBillType } from './src/services/ocr.js';

// 模拟前端OCR识别的压缩文本
const compressedText = `10:27 91 账单 全 部 账单 查找 交易 收 支 统计 2026 年 3 月 4 37 1169.43 收入 503.00 凯 德 集团 -20.00 全 扫 二 维 码 付款 -给 宁静 的 深海 -18.00 凯 德 集团 -20.00 5 扫 二 维 码 付款 -给 可 心 35.00 全 二 维 码 收 款 -来 自 刁 6 +3.00 凯 德 集团 -20.00 扫 二 维 码 付款 -给 悦 来 家 常 菜 18.00 人 中 石化 辽宁 石油 分 公司 -260.00`;

console.log('🧪 测试前端OCR修复效果');
console.log('原始文本长度:', compressedText.length);

// 1. 账单类型检测
console.log('\n📋 第一步：账单类型检测');
const billType = detectBillType(compressedText);
console.log('检测结果:', billType);

// 2. 微信交易列表解析
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
