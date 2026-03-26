// 测试压缩格式的OCR文本解析
import { 
  detectBillType, 
  parseWechatTransactionList 
} from './src/services/ocr.ts.js';

// 模拟Web应用中实际的OCR文本（压缩成一行）
const compressedText = `10:27 91 账单 全 部 账单 查找 交易 收 支 统计 2026 年 3 月 4 37 1169.43 收入 503.00 凯 德 集团 -20.00 全 扫 二 维 码 付款 -给 宁静 的 深海 -18.00 凯 德 集团 -20.00 5 扫 二 维 码 付款 -给 可 心 35.00 全 二 维 码 收 款 -来 自 刁 6 +3.00 凯 德 集团 -20.00 扫 二 维 码 付款 -给 悦 来 家 常 菜 18.00 人 中 石化 辽宁 石油 分 公司 -260.00`;

console.log('🧪 测试压缩格式OCR文本解析');
console.log('原始文本长度:', compressedText.length);
console.log('原始文本行数:', compressedText.split('\n').length);

// 1. 测试账单类型检测
console.log('\n📋 第一步：账单类型检测');
const billType = detectBillType(compressedText);
console.log('检测结果:', billType);

// 2. 测试微信交易列表解析
console.log('\n🔍 第二步：微信交易列表解析');
const results = parseWechatTransactionList(compressedText);

// 3. 结果分析
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
