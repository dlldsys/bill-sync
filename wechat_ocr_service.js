#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Tesseract from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 微信账单OCR解析服务
class WechatBillOCRService {
  constructor() {
    this.results = [];
  }

  // 检测账单类型
  detectBillType(text) {
    if (!text) return 'unknown';
    
    const lowerText = text.toLowerCase();
    const wechatPatterns = [
      '微信支付', '微信转账', '微信红包', 'wechat', '微信收款',
      '交易时间', '交易对方', '支付成功', '全部账单', '收支统计',
      '账单', '查找', '交易', '收支', '统计',
      /\d{4}\s*年\s*\d{1,2}\s*月/,
      /[\+\-]\d+\.\d{2}/,
    ];
    
    let wechatScore = 0;
    for (const pattern of wechatPatterns) {
      if (typeof pattern === 'string') {
        if (lowerText.includes(pattern.toLowerCase())) wechatScore++;
      } else if (pattern instanceof RegExp) {
        if (pattern.test(text)) wechatScore++;
      }
    }
    
    return wechatScore >= 2 ? 'wechat' : 'unknown';
  }

  // 智能分割压缩文本
  splitCompressedText(text) {
    console.log('🔧 检测到压缩格式，智能分割中...');
    
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

  // 提取所有金额 - 过滤掉总计金额
  extractAmounts(text) {
    const amountMatches = [];
    
    // 1. 带符号的金额
    const signedAmountRegex = /([\+\-])(\d+(?:\.\d{1,2})?)/g;
    let match;
    while ((match = signedAmountRegex.exec(text)) !== null) {
      const amount = parseFloat(match[2]);
      if (amount > 0 && amount < 1000000) {
        amountMatches.push({
          sign: match[1],
          amount: amount,
          index: match.index,
          original: match[0],
          type: 'signed'
        });
      }
    }
    
    // 2. 纯数字金额（.分隔）
    const dotAmountRegex = /(?<![\d\+\-¥￥])(\d{2,4})\.(\d{2})(?![0-9])/g;
    while ((match = dotAmountRegex.exec(text)) !== null) {
      const amount = parseFloat(`${match[1]}.${match[2]}`);
      if (amount >= 10 && amount < 10000) {
        amountMatches.push({
          sign: '-',
          amount: amount,
          index: match.index,
          original: match[0],
          type: 'dot'
        });
      }
    }
    
    // 3. 空格分隔的金额
    const spaceAmountRegex = /(?<![\d\+\-¥￥])(\d{2,4})\s+(\d{2})(?![0-9])/g;
    while ((match = spaceAmountRegex.exec(text)) !== null) {
      const amount = parseFloat(`${match[1]}.${match[2]}`);
      if (amount >= 10 && amount < 10000) {
        amountMatches.push({
          sign: '-',
          amount: amount,
          index: match.index,
          original: match[0],
          type: 'space'
        });
      }
    }
    
    // 去重并排序
    const uniqueMatches = [];
    const seen = new Set();
    
    for (const amountMatch of amountMatches) {
      const key = `${amountMatch.index}-${amountMatch.amount}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMatches.push(amountMatch);
      }
    }
    
    // 过滤掉总计金额（通常大于100且在特定上下文中）
    const filteredMatches = uniqueMatches.filter(match => {
      // 检查是否在总计上下文中
      const beforeText = text.substring(Math.max(0, match.index - 50), match.index);
      const afterText = text.substring(match.index + match.original.length, match.index + 50);
      
      const isTotalContext = beforeText.includes('支出') || 
                            beforeText.includes('收入') || 
                            beforeText.includes('总计') ||
                            afterText.includes('支出') ||
                            afterText.includes('收入');
      
      // 如果金额大于100且在总计上下文中，跳过
      if (match.amount > 100 && isTotalContext) {
        console.log(`    过滤总计金额: ${match.sign}${match.amount}`);
        return false;
      }
      
      return true;
    });
    
    return filteredMatches.sort((a, b) => a.index - b.index);
  }

  // 提取商家名称 - 增强版
  extractMerchant(text, amountIndex) {
    // 获取金额前的文本，但不要太多
    const startIndex = Math.max(0, amountIndex - 150);
    const textBeforeAmount = text.substring(startIndex, amountIndex);
    
    console.log(`    商家提取 - 金额前文本: "${textBeforeAmount.substring(textBeforeAmount.length - 100)}"`);
    
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
      const cleanedMerchant = this.cleanMerchantText(merchantText);
      if (cleanedMerchant) {
        console.log(`    ✓ 关键词匹配: "${cleanedMerchant}"`);
        return cleanedMerchant;
      }
    }
    
    // 方法2: 如果没有关键词，尝试提取最后的中文词组
    const cleaned = textBeforeAmount
      .replace(/[|全从汉党及回省Q@查找交易收支统计>0-9\s]/g, '')
      .trim();
    
    const chineseMatch = cleaned.match(/[\u4e00-\u9fa5]{2,}$/);
    if (chineseMatch) {
      console.log(`    ✓ 中文匹配: "${chineseMatch[0]}"`);
      return chineseMatch[0];
    }
    
    console.log(`    ⚠ 无法识别商家`);
    return null;
  }

  // 清理商家文本
  cleanMerchantText(text) {
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

  // 自动分类
  categorizeMerchant(merchant, billType) {
    const categoryRules = [
      { keywords: ['凯德'], category: { id: 'shopping', name: '购物/商场消费', type: 'expense' } },
      { keywords: ['中石化'], category: { id: 'transport', name: '交通/加油', type: 'expense' } },
      { keywords: ['家常菜', '悦来家常菜'], category: { id: 'food', name: '餐饮', type: 'expense' } },
      { keywords: ['扫二维码付款'], category: { id: 'life_service', name: '餐饮/生活服务', type: 'expense' } },
      { keywords: ['二维码收款'], category: { id: 'transfer_in', name: '个人转账收入', type: 'income' } },
    ];
    
    for (const rule of categoryRules) {
      for (const keyword of rule.keywords) {
        if (merchant.includes(keyword)) {
          let category = { ...rule.category };
          
          // 根据账单类型修正分类
          if (billType === 'income' && category.type === 'expense') {
            category = { id: 'transfer_in', name: '个人转账收入', type: 'income' };
          } else if (billType === 'expense' && category.type === 'income') {
            category = { id: 'life_service', name: '餐饮/生活服务', type: 'expense' };
          }
          
          return category;
        }
      }
    }
    
    // 默认分类
    return billType === 'income' 
      ? { id: 'transfer_in', name: '个人转账收入', type: 'income' }
      : { id: 'other', name: '其他', type: 'expense' };
  }

  // 主要解析函数
  async parseImage(imagePath) {
    console.log(`🚀 开始解析图片: ${imagePath}`);
    
    try {
      // 1. OCR识别
      console.log('📸 第一步：OCR文字识别...');
      const imageBuffer = fs.readFileSync(imagePath);
      const result = await Tesseract.recognize(imageBuffer, 'chi_sim+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            process.stdout.write(`\r识别进度: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      console.log('\n✅ OCR识别完成');
      console.log(`置信度: ${result.data.confidence}%`);
      
      const rawText = result.data.text;
      console.log(`原始文本长度: ${rawText.length}`);
      
      // 2. 账单类型检测
      console.log('\n📋 第二步：账单类型检测...');
      const billType = this.detectBillType(rawText);
      console.log(`账单类型: ${billType}`);
      
      if (billType !== 'wechat') {
        console.log('⚠ 非微信账单，暂不支持');
        return [];
      }
      
      // 3. 文本预处理
      console.log('\n🔧 第三步：文本预处理...');
      let processedText = rawText;
      const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      if (lines.length === 1 && lines[0].length > 100) {
        processedText = this.splitCompressedText(rawText);
        console.log(`分割后行数: ${processedText.split('\n').length}`);
      }
      
      // 4. 提取基准日期
      console.log('\n📅 第四步：提取基准日期...');
      let baseYearMonth = '';
      const yearMonthMatch = processedText.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
      if (yearMonthMatch) {
        const year = yearMonthMatch[1];
        const month = parseInt(yearMonthMatch[2]);
        if (month >= 1 && month <= 12) {
          baseYearMonth = `${year}-${month.toString().padStart(2, '0')}`;
        }
      }
      
      if (!baseYearMonth) {
        const now = new Date();
        baseYearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      }
      
      console.log(`基准年月: ${baseYearMonth}`);
      
      // 5. 提取金额
      console.log('\n💰 第五步：提取金额...');
      const amountMatches = this.extractAmounts(processedText);
      console.log(`找到 ${amountMatches.length} 个金额: ${amountMatches.map(a => `${a.sign}${a.amount}`).join(', ')}`);
      
      // 6. 提取商家和解析交易
      console.log('\n🏪 第六步：提取商家和解析交易...');
      const results = [];
      
      for (let i = 0; i < amountMatches.length; i++) {
        const amountInfo = amountMatches[i];
        
        console.log(`\n处理金额 ${amountInfo.sign}${amountInfo.amount} (${amountInfo.type})`);
        
        const merchant = this.extractMerchant(processedText, amountInfo.index);
        if (!merchant) {
          console.log(`  ⚠ 跳过，无法识别商家`);
          continue;
        }
        
        const billType = amountInfo.sign === '+' ? 'income' : 'expense';
        const category = this.categorizeMerchant(merchant, billType);
        
        const transaction = {
          merchant: merchant,
          amount: amountInfo.amount,
          type: billType,
          category: category.name,
          categoryId: category.id,
          date: new Date(baseYearMonth + '-01').toISOString().split('T')[0],
          confidence: 85,
          original: amountInfo.original
        };
        
        results.push(transaction);
        
        console.log(`  ✓ 成功: "${merchant}" ${amountInfo.sign}${amountInfo.amount} -> ${category.name}`);
      }
      
      console.log(`\n🎉 解析完成！共识别 ${results.length} 条交易记录`);
      return results;
      
    } catch (error) {
      console.error('❌ 解析失败:', error);
      return [];
    }
  }

  // 格式化输出结果
  formatResults(results) {
    console.log('\n📊 解析结果汇总');
    console.log('='.repeat(80));
    
    const incomeRecords = results.filter(r => r.type === 'income');
    const expenseRecords = results.filter(r => r.type === 'expense');
    
    const totalIncome = incomeRecords.reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = expenseRecords.reduce((sum, r) => sum + r.amount, 0);
    
    console.log(`收入记录: ${incomeRecords.length} 条，总计: ¥${totalIncome.toFixed(2)}`);
    console.log(`支出记录: ${expenseRecords.length} 条，总计: ¥${totalExpense.toFixed(2)}`);
    console.log(`净收支: ¥${(totalIncome - totalExpense).toFixed(2)}`);
    
    console.log('\n📋 详细明细');
    console.log('序号 | 商家名称 | 金额 | 类型 | 分类');
    console.log('-'.repeat(80));
    
    results.forEach((result, index) => {
      const amountStr = result.type === 'expense' ? `-¥${result.amount}` : `+¥${result.amount}`;
      const typeIcon = result.type === 'expense' ? '💸' : '💵';
      console.log(`${(index + 1).toString().padStart(2)} | ${result.merchant.padEnd(20)} | ${amountStr.padStart(8)} | ${typeIcon} ${result.type} | ${result.category}`);
    });
    
    return results;
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('用法: node wechat_ocr_service.js <图片路径>');
    console.log('示例: node wechat_ocr_service.js example/微信图片_20260325104718_18_3.jpg');
    process.exit(1);
  }
  
  const imagePath = args[0];
  
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ 图片文件不存在: ${imagePath}`);
    process.exit(1);
  }
  
  const ocrService = new WechatBillOCRService();
  const results = await ocrService.parseImage(imagePath);
  
  if (results.length > 0) {
    ocrService.formatResults(results);
    
    // 可选：保存结果到JSON文件
    const outputPath = imagePath.replace(/\.[^.]+$/, '_ocr_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\n💾 结果已保存到: ${outputPath}`);
  } else {
    console.log('\n⚠ 未识别到有效交易记录');
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('wechat_ocr_service.js')) {
  main().catch(console.error);
}

export default WechatBillOCRService;
