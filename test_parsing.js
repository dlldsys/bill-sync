import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Tesseract from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 导入OCR解析函数
import { 
  parseWechatTransactionList,
  parseBillTextWithAutoMatch,
  detectBillType 
} from './src/services/ocr.ts.js';

// 读取图片文件
const imagePath = path.join(__dirname, 'example', '微信图片_20260325104718_18_3.jpg');

async function testOCRAndParsing() {
  console.log('开始OCR识别:', imagePath);
  
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
    console.log('原始文本行数:', result.data.text.split('\n').filter(line => line.trim()).length);
    
    // 2. 检测账单类型
    const billType = detectBillType(result.data.text);
    console.log('账单类型:', billType);

    // 3. 测试微信交易列表解析
    console.log('\n=== 微信交易列表解析 ===');
    const wechatResults = parseWechatTransactionList(result.data.text);
    console.log('解析结果数量:', wechatResults.length);
    
    wechatResults.forEach((result, index) => {
      console.log(`\n记录 ${index + 1}:`);
      console.log(`  商家: ${result.merchant}`);
      console.log(`  金额: ${result.amount}`);
      console.log(`  类型: ${result.billType}`);
      console.log(`  分类: ${result.category}`);
      console.log(`  日期: ${result.date}`);
      console.log(`  置信度: ${result.confidence}`);
    });

    // 4. 测试完整解析流程
    console.log('\n=== 完整解析流程 ===');
    const fullResults = await parseBillTextWithAutoMatch(result.data.text);
    console.log('完整解析结果数量:', fullResults.length);
    
    fullResults.forEach((result, index) => {
      console.log(`\n记录 ${index + 1}:`);
      console.log(`  商家: ${result.merchant}`);
      console.log(`  金额: ${result.amount}`);
      console.log(`  类型: ${result.billType}`);
      console.log(`  分类: ${result.category || result.matchedCategoryName}`);
      console.log(`  日期: ${result.date}`);
      console.log(`  置信度: ${result.confidence}`);
    });

    // 5. 统计分析
    console.log('\n=== 统计分析 ===');
    const expenseCount = fullResults.filter(r => r.billType === 'expense').length;
    const incomeCount = fullResults.filter(r => r.billType === 'income').length;
    const totalExpense = fullResults.filter(r => r.billType === 'expense').reduce((sum, r) => sum + r.amount, 0);
    const totalIncome = fullResults.filter(r => r.billType === 'income').reduce((sum, r) => sum + r.amount, 0);
    
    console.log(`支出记录: ${expenseCount} 条，总计: ¥${totalExpense.toFixed(2)}`);
    console.log(`收入记录: ${incomeCount} 条，总计: ¥${totalIncome.toFixed(2)}`);
    console.log(`净收支: ¥${(totalIncome - totalExpense).toFixed(2)}`);

    // 6. 与原始OCR结果对比
    console.log('\n=== 原始OCR金额行 ===');
    const lines = result.data.text.split('\n').filter(line => line.trim());
    const amountLines = lines.filter(line => /[\+\-\¥￥]\s*\d+\.?\d*/.test(line));
    console.log('原始识别到的金额行数:', amountLines.length);
    amountLines.forEach((line, index) => {
      console.log(`${index + 1}: "${line.trim()}"`);
    });

  } catch (error) {
    console.error('测试失败:', error);
  }
}

testOCRAndParsing();
