// 测试OCR解析逻辑
import { parseBillText } from './src/services/ocr.ts';

// 模拟微信账单文本
const wechatBill = `2024年03月25日
支出
星巴克咖啡 35.00元
2024年03月25日
支出
地铁 5.00元
2024年03月25日  
支出
午餐 25.00元`;

// 模拟支付宝账单文本
const alipayBill = `03-25 15:30:00
交易成功
[星巴克咖啡]
35.00元
03-25 14:20:00  
交易成功
[地铁]
5.00元`;

console.log('=== 微信账单解析结果 ===');
const wechatResult = parseBillText(wechatBill);
console.log('识别到', wechatResult.length, '条记录');
wechatResult.forEach((bill, index) => {
  console.log(`${index + 1}. 金额: ${bill.amount}, 商家: ${bill.merchant}, 类目: ${bill.category}, 描述: ${bill.description}`);
});

console.log('\n=== 支付宝账单解析结果 ===');
const alipayResult = parseBillText(alipayBill);
console.log('识别到', alipayResult.length, '条记录');
alipayResult.forEach((bill, index) => {
  console.log(`${index + 1}. 金额: ${bill.amount}, 商家: ${bill.merchant}, 类目: ${bill.category}, 描述: ${bill.description}`);
});
