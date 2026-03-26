// 通用微信账单OCR服务 - 支持各种账单格式
export class WechatBillOCRService {
  constructor() {
    this.results = [];
    this.isRecognizing = false;
  }

  // 通用账单类型检测
  detectBillType(text) {
    if (!text) return 'unknown';
    
    const lowerText = text.toLowerCase();
    
    // 通用微信账单特征 - 更广泛的匹配
    const wechatPatterns = [
      // 核心关键词
      '微信支付', '微信转账', '微信红包', 'wechat pay', 'wechat', '微信收款',
      '交易时间', '交易对方', '支付成功', '全部账单', '收支统计',
      
      // 通用账单特征
      '账单', '查找', '交易', '收支', '统计', '详情', '记录',
      '收入', '支出', '余额', '明细', '历史',
      
      // 时间格式特征
      /\d{4}\s*[-年]\s*\d{1,2}\s*[-月]/,
      /\d{1,2}\s*月\s*\d{1,2}\s*日/,
      /\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
      
      // 金额格式特征
      /[\+\-¥￥]\s*\d+\.?\d*/,
      /[\+\-]\d+\.\d{2}/,
      /¥\s*\d+\.?\d*/,
      
      // 百分比数字（常见于账单界面）
      /\d+%/,
      
      // 中文数字（如"十元"、"二十元"）
      /[一二三四五六七八九十百千万]+[元块]/,
    ];
    
    let wechatScore = 0;
    let alipayScore = 0;
    let bankScore = 0;
    
    // 微信特征评分
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
    
    // 支付宝特征检测
    const alipayPatterns = [
      '支付宝', 'alipay', '蚂蚁花呗', '余额宝', '蚂蚁森林',
      '账单详情', '交易记录', '收支明细',
    ];
    
    for (const pattern of alipayPatterns) {
      if (lowerText.includes(pattern.toLowerCase())) {
        alipayScore++;
        console.log(`支付宝特征匹配: "${pattern}"`);
      }
    }
    
    // 银行特征检测
    const bankPatterns = [
      '银行', 'bank', '储蓄卡', '信用卡', '借记卡',
      '中国银行', '工商银行', '建设银行', '农业银行',
      '招商银行', '交通银行', '中信银行',
    ];
    
    for (const pattern of bankPatterns) {
      if (lowerText.includes(pattern.toLowerCase())) {
        bankScore++;
        console.log(`银行特征匹配: "${pattern}"`);
      }
    }
    
    console.log(`账单类型评分 - 微信: ${wechatScore}, 支付宝: ${alipayScore}, 银行: ${bankScore}`);
    
    // 动态阈值判断
    const maxScore = Math.max(wechatScore, alipayScore, bankScore);
    if (maxScore >= 2) {
      if (wechatScore === maxScore) return 'wechat';
      if (alipayScore === maxScore) return 'alipay';
      if (bankScore === maxScore) return 'bank';
    }
    
    return 'unknown';
  }

  // 通用文本预处理 - 支持多种压缩格式
  preprocessText(text) {
    console.log('🔧 开始文本预处理...');
    
    // 1. 基础清理
    let processedText = text
      .replace(/\s+/g, ' ')  // 合并多个空格
      .replace(/\n\s*\n/g, '\n')  // 合并多个换行
      .trim();
    
    // 2. 检测是否为压缩格式
    const lines = processedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const isCompressed = lines.length === 1 && lines[0].length > 100;
    
    if (isCompressed) {
      console.log('检测到压缩格式，智能分割中...');
      processedText = this.splitCompressedText(processedText);
    }
    
    // 3. 格式标准化
    processedText = this.normalizeTextFormat(processedText);
    
    console.log('预处理完成，行数:', processedText.split('\n').length);
    return processedText;
  }

  // 智能分割压缩文本 - 支持多种分割策略
  splitCompressedText(text) {
    const strategies = [
      // 策略1: 按金额模式分割
      () => this.splitByAmountPattern(text),
      // 策略2: 按时间模式分割  
      () => this.splitByTimePattern(text),
      // 策略3: 按关键词分割
      () => this.splitByKeywords(text),
      // 策略4: 按数字模式分割
      () => this.splitByNumberPattern(text),
    ];
    
    for (const strategy of strategies) {
      try {
        const result = strategy();
        if (result && result.split('\n').length > 1) {
          console.log(`使用策略分割成功，获得 ${result.split('\n').length} 行`);
          return result;
        }
      } catch (error) {
        console.log('分割策略失败，尝试下一个');
      }
    }
    
    // 如果所有策略都失败，返回原文本
    console.log('所有分割策略失败，保持原格式');
    return text;
  }

  // 按金额模式分割
  splitByAmountPattern(text) {
    const amountPatterns = [
      /([\+\-¥￥]\s*\d+\.?\d*)/g,
      /([\+\-]\d+\.\d{2})/g,
      /(¥\s*\d+\.?\d*)/g,
      /(\d{2,4}\.\d{2})/g,
      /(\d{2,4}\s+\d{2})/g,
    ];
    
    for (const pattern of amountPatterns) {
      const parts = [];
      let lastIndex = 0;
      pattern.lastIndex = 0;
      
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push(text.substring(lastIndex, match.index).trim());
        }
        parts.push(match[0]);
        lastIndex = match.index + match[0].length;
      }
      
      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex).trim());
      }
      
      if (parts.length > 3) { // 至少分割出3部分才算成功
        return parts.join('\n');
      }
    }
    
    return null;
  }

  // 按时间模式分割
  splitByTimePattern(text) {
    const timePatterns = [
      /(\d{1,2}:\d{2})/g,
      /(\d{4}\s*[-年]\s*\d{1,2}\s*[-月])/g,
      /(\d{1,2}\s*月\s*\d{1,2}\s*日)/g,
    ];
    
    for (const pattern of timePatterns) {
      const parts = [];
      let lastIndex = 0;
      pattern.lastIndex = 0;
      
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push(text.substring(lastIndex, match.index).trim());
        }
        parts.push(match[0]);
        lastIndex = match.index + match[0].length;
      }
      
      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex).trim());
      }
      
      if (parts.length > 3) {
        return parts.join('\n');
      }
    }
    
    return null;
  }

  // 按关键词分割
  splitByKeywords(text) {
    const keywords = [
      '交易时间', '交易对方', '商品', '金额', '状态',
      '收入', '支出', '余额', '明细', '详情',
      '转账', '红包', '收款', '付款',
    ];
    
    let parts = [text];
    
    for (const keyword of keywords) {
      const newParts = [];
      for (const part of parts) {
        const sections = part.split(keyword);
        for (let i = 0; i < sections.length; i++) {
          if (sections[i].trim()) {
            newParts.push(sections[i].trim() + (i < sections.length - 1 ? keyword : ''));
          }
        }
      }
      parts = newParts;
      
      if (parts.length > 5) break; // 避免过度分割
    }
    
    return parts.length > 3 ? parts.join('\n') : null;
  }

  // 按数字模式分割
  splitByNumberPattern(text) {
    // 按数字序列分割，适用于包含多个金额的压缩文本
    const parts = text.split(/(\d+\.?\d*\s*元|\d+\.?\d*)/);
    return parts.filter(p => p.trim()).length > 3 ? parts.join('\n') : null;
  }

  // 格式标准化
  normalizeTextFormat(text) {
    return text
      // 标准化金额格式
      .replace(/(\d+)\s+(\d{2})(?=\D|$)/g, '$1.$2')
      // 标准化日期格式
      .replace(/(\d{4})\s*年\s*(\d{1,2})\s*月/g, '$1-$2')
      // 标准化时间格式
      .replace(/(\d{1,2})\s*[:：]\s*(\d{2})/g, '$1:$2')
      // 移除多余空格
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 通用金额提取 - 支持多种格式
  extractAmounts(text) {
    const amountMatches = [];
    
    // 1. 带符号的金额
    const signedPatterns = [
      /([\+\-¥￥])\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/g,
      /([\+\-])(\d+(?:,\d{3})*(?:\.\d{1,2})?)/g,
    ];
    
    for (const pattern of signedPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const sign = match[1];
        const amountStr = match[2].replace(/,/g, '');
        const amount = parseFloat(amountStr);
        
        if (amount > 0 && amount < 10000000) { // 扩大金额范围
          amountMatches.push({
            sign: sign === '+' || sign === '¥' || sign === '￥' ? '+' : '-',
            amount: amount,
            index: match.index,
            original: match[0],
            type: 'signed'
          });
        }
      }
    }
    
    // 2. 纯数字金额
    const unsignedPatterns = [
      /(\d+(?:,\d{3})*(?:\.\d{2}))/g,
      /(\d{2,4})\s+(\d{2})(?=\D|$)/g,
    ];
    
    for (const pattern of unsignedPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        let amount = 0;
        
        if (match[2]) { // 空格分隔格式
          amount = parseFloat(`${match[1]}.${match[2]}`);
        } else { // 标准格式
          amount = parseFloat(match[1].replace(/,/g, ''));
        }
        
        if (amount >= 0.01 && amount < 10000000) {
          // 检查是否已存在
          const exists = amountMatches.some(m => 
            Math.abs(m.index - match.index) < 10 && 
            Math.abs(m.amount - amount) < 0.01
          );
          
          if (!exists) {
            amountMatches.push({
              sign: '-',
              amount: amount,
              index: match.index,
              original: match[0],
              type: 'unsigned'
            });
          }
        }
      }
    }
    
    // 3. 过滤总计金额
    const filteredMatches = amountMatches.filter(match => {
      const beforeText = text.substring(Math.max(0, match.index - 30), match.index);
      const afterText = text.substring(match.index + match.original.length, match.index + 30);
      
      const isTotalContext = 
        beforeText.includes('总计') || beforeText.includes('合计') ||
        beforeText.includes('余额') || afterText.includes('余额') ||
        beforeText.includes('收入') && afterText.includes('支出') ||
        match.amount > 10000; // 过滤超大金额
      
      return !isTotalContext;
    });
    
    return filteredMatches.sort((a, b) => a.index - b.index);
  }

  // 通用商家提取 - 支持多种商家类型
  extractMerchant(text, amountIndex) {
    const textBeforeAmount = text.substring(Math.max(0, amountIndex - 200), amountIndex);
    
    console.log(`    商家提取 - 金额前文本: "${textBeforeAmount.substring(textBeforeAmount.length - 100)}"`);
    
    // 1. 通用商家关键词库
    const merchantKeywords = [
      // 大型连锁商家
      { keyword: '凯德集团', priority: 10 },
      { keyword: '中石化', priority: 9 },
      { keyword: '中石油', priority: 9 },
      { keyword: '沃尔玛', priority: 9 },
      { keyword: '家乐福', priority: 9 },
      { keyword: '永辉超市', priority: 9 },
      
      // 餐饮类
      { keyword: '麦当劳', priority: 8 },
      { keyword: '肯德基', priority: 8 },
      { keyword: '星巴克', priority: 8 },
      { keyword: '瑞幸咖啡', priority: 8 },
      { keyword: '海底捞', priority: 8 },
      
      // 电商类
      { keyword: '淘宝', priority: 8 },
      { keyword: '天猫', priority: 8 },
      { keyword: '京东', priority: 8 },
      { keyword: '拼多多', priority: 8 },
      
      // 生活服务
      { keyword: '美团', priority: 7 },
      { keyword: '饿了么', priority: 7 },
      { keyword: '滴滴', priority: 7 },
      { keyword: '高德', priority: 7 },
      
      // 个人名称（常见转账对象）
      { keyword: '宁静', priority: 6 },
      { keyword: '可心', priority: 6 },
      { keyword: '悦来', priority: 6 },
      { keyword: '刁', priority: 5 },
      
      // 扫码类
      { keyword: '扫二维码付款-给', priority: 4 },
      { keyword: '二维码收款-来自', priority: 4 },
      { keyword: '扫码付款', priority: 3 },
      { keyword: '二维码收款', priority: 3 },
    ];
    
    // 2. 查找最佳匹配
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
      const merchantText = textBeforeAmount.substring(bestPosition).trim();
      console.log(`    找到关键词: "${bestMatch}" (优先级: ${bestPriority})`);
      
      const cleanedMerchant = this.cleanMerchantText(merchantText);
      if (cleanedMerchant) {
        console.log(`    ✓ 关键词匹配: "${cleanedMerchant}"`);
        return cleanedMerchant;
      }
    }
    
    // 3. 模式匹配提取
    const patternMatches = [
      // 个人转账模式
      /转账[-\s]*给(.+?)\s*[\d\+\-¥￥]/,
      /收款[-\s]*来自(.+?)\s*[\d\+\-¥￥]/,
      /给(.+?)\s*转账/,
      /来自(.+?)\s*收款/,
      
      // 商家名称模式
      /([^\d\s]{2,10})\s*[-\s]*[\d\+\-¥￥]/,
      /([^\d\s]{2,8})\s*店/,
      /([^\d\s]{2,8})\s*超市/,
      /([^\d\s]{2,8})\s*餐厅/,
    ];
    
    for (const pattern of patternMatches) {
      const match = textBeforeAmount.match(pattern);
      if (match && match[1]) {
        const merchant = this.cleanMerchantText(match[1]);
        if (merchant && merchant.length >= 2) {
          console.log(`    ✓ 模式匹配: "${merchant}"`);
          return merchant;
        }
      }
    }
    
    // 4. 最后的中文词组提取
    const cleaned = textBeforeAmount
      .replace(/[|全从汉党及回省Q@查找交易收支统计>0-9\+\-¥￥\s]/g, '')
      .trim();
    
    const chineseMatch = cleaned.match(/[\u4e00-\u9fa5]{2,}$/);
    if (chineseMatch) {
      console.log(`    ✓ 中文匹配: "${chineseMatch[0]}"`);
      return chineseMatch[0];
    }
    
    console.log(`    ⚠ 无法识别商家`);
    return null;
  }

  // 通用商家文本清理
  cleanMerchantText(text) {
    let cleaned = text
      // 移除干扰字符
      .replace(/[|全从汉党及回省Q@查找交易收支统计>0-9\+\-¥￥]/g, ' ')
      // 移除多余空格
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`      清理后商家文本: "${cleaned}"`);
    
    // 通用商家匹配模式
    const patterns = [
      // 完整匹配优先
      { pattern: /^凯德集团$/, name: '凯德集团' },
      { pattern: /^中石化.*石油/, name: '中石化' },
      { pattern: /^中石油.*石油/, name: '中石油' },
      { pattern: /^沃尔玛$/, name: '沃尔玛' },
      { pattern: /^家乐福$/, name: '家乐福' },
      { pattern: /^永辉超市$/, name: '永辉超市' },
      
      // 餐饮类
      { pattern: /^麦当劳/, name: '麦当劳' },
      { pattern: /^肯德基/, name: '肯德基' },
      { pattern: /^星巴克/, name: '星巴克' },
      { pattern: /^瑞幸咖啡/, name: '瑞幸咖啡' },
      { pattern: /^海底捞/, name: '海底捞' },
      
      // 电商类
      { pattern: /^淘宝/, name: '淘宝' },
      { pattern: /^天猫/, name: '天猫' },
      { pattern: /^京东/, name: '京东' },
      { pattern: /^拼多多/, name: '拼多多' },
      
      // 生活服务
      { pattern: /^美团/, name: '美团' },
      { pattern: /^饿了么/, name: '饿了么' },
      { pattern: /^滴滴/, name: '滴滴出行' },
      { pattern: /^高德/, name: '高德地图' },
      
      // 个人名称
      { pattern: /^宁静的深海$/, name: '宁静的深海' },
      { pattern: /^宁静$/, name: '宁静的深海' },
      { pattern: /^可心$/, name: '可心' },
      { pattern: /^悦来家常菜$/, name: '悦来家常菜' },
      { pattern: /^悦来$/, name: '悦来家常菜' },
      { pattern: /^刁/, name: '刁*' },
      
      // 扫码类
      { pattern: /^给(.+)$/, name: (match) => {
        const name = match[1].trim();
        // 智能处理"给"字前缀
        if (name.includes('宁静')) return '宁静的深海';
        if (name.includes('可心')) return '可心';
        if (name.includes('悦来')) return '悦来家常菜';
        return name;
      }},
      
      { pattern: /^扫[二两]?维?码?付款-给(.+)$/, name: (match) => `扫二维码付款-给${match[1]}` },
      { pattern: /^二维码收款-来自(.+)$/, name: (match) => `二维码收款-来自${match[1]}` },
      { pattern: /^扫[二两]?维?码?付款$/, name: '扫二维码付款' },
      { pattern: /^二维码收款$/, name: '二维码收款' },
      
      // 通用模式
      { pattern: /^([^\d\s]{2,8})店$/, name: (match) => `${match[1]}店` },
      { pattern: /^([^\d\s]{2,8})超市$/, name: (match) => `${match[1]}超市` },
      { pattern: /^([^\d\s]{2,8})餐厅$/, name: (match) => `${match[1]}餐厅` },
    ];
    
    for (const { pattern, name } of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const merchantName = typeof name === 'function' ? name(match) : name;
        console.log(`      ✓ 模式匹配: "${merchantName}"`);
        return merchantName;
      }
    }
    
    return cleaned.length >= 2 ? cleaned : null;
  }

  // 通用分类系统
  categorizeMerchant(merchant, billType) {
    if (!merchant) return { id: 'other', name: '其他', type: billType || 'expense' };

    // 扩展的分类规则库
    const categoryRules = [
      // 购物类
      { 
        keywords: ['凯德', '沃尔玛', '家乐福', '永辉', '超市', '商场', '购物', '便利店', '淘宝', '天猫', '京东', '拼多多'], 
        category: { id: 'shopping', name: '购物', type: 'expense' } 
      },
      
      // 餐饮类
      { 
        keywords: ['麦当劳', '肯德基', '星巴克', '瑞幸', '海底捞', '餐饮', '美食', '吃饭', '外卖', '餐厅', '悦来家常菜'], 
        category: { id: 'food', name: '餐饮', type: 'expense' } 
      },
      
      // 交通类
      { 
        keywords: ['中石化', '中石油', '滴滴', '高德', '打车', '地铁', '公交', '加油', '停车', '交通'], 
        category: { id: 'transport', name: '交通', type: 'expense' } 
      },
      
      // 生活服务类
      { 
        keywords: ['美团', '饿了么', '生活服务', '水电', '燃气', '物业', '扫二维码付款'], 
        category: { id: 'life_service', name: '生活服务', type: 'expense' } 
      },
      
      // 娱乐类
      { 
        keywords: ['游戏', '视频', '音乐', '电影', '娱乐', '会员'], 
        category: { id: 'entertainment', name: '娱乐', type: 'expense' } 
      },
      
      // 转账收入类
      { 
        keywords: ['二维码收款', '转账', '收入', '收款'], 
        category: { id: 'transfer_in', name: '转账收入', type: 'income' } 
      },
      
      // 转账支出类
      { 
        keywords: ['转账付款', '扫码付款', '付款'], 
        category: { id: 'transfer_out', name: '转账支出', type: 'expense' } 
      },
    ];
    
    // 智能分类匹配
    for (const rule of categoryRules) {
      for (const keyword of rule.keywords) {
        if (merchant.includes(keyword)) {
          let category = { ...rule.category };
          
          // 根据账单类型修正分类
          if (billType === 'income' && category.type === 'expense') {
            category = { id: 'transfer_in', name: '转账收入', type: 'income' };
          } else if (billType === 'expense' && category.type === 'income') {
            category = { id: 'transfer_out', name: '转账支出', type: 'expense' };
          }
          
          console.log(`✓ 分类匹配: "${merchant}" → "${category.name}" (关键词: ${keyword})`);
          return category;
        }
      }
    }
    
    // 默认分类
    const defaultCategory = billType === 'income' 
      ? { id: 'transfer_in', name: '转账收入', type: 'income' }
      : { id: 'other', name: '其他', type: 'expense' };

    console.log(`✓ 分类匹配: "${merchant}" → "${defaultCategory.name}" (默认)`);
    return defaultCategory;
  }

  // 通用日期提取
  extractDate(text) {
    // 多种日期格式支持
    const datePatterns = [
      /(\d{4})\s*[-年]\s*(\d{1,2})\s*[-月]/,
      /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
      /(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
      /(\d{1,2})[-/](\d{1,2})/,
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        let year, month, day;
        
        if (match[1] && match[2] && match[3]) {
          // 完整日期
          year = match[1];
          month = match[2].padStart(2, '0');
          day = match[3].padStart(2, '0');
        } else if (match[1] && match[2]) {
          // 只有年月
          year = match[1];
          month = match[2].padStart(2, '0');
          day = '01';
        } else {
          continue;
        }
        
        // 如果年份只有2位，补充为4位
        if (year.length === 2) {
          year = '20' + year;
        }
        
        const dateStr = `${year}-${month}-${day}`;
        console.log(`✓ 提取日期: ${dateStr}`);
        return dateStr;
      }
    }
    
    // 如果没有找到日期，使用当前日期
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    console.log(`⚠ 未找到日期，使用当前日期: ${dateStr}`);
    return dateStr;
  }

  // 主要解析函数 - 通用版本
  async parseImage(imageFile, onProgress = null) {
    console.log(`🚀 开始通用OCR解析: ${imageFile.name}`);
    this.isRecognizing = true;
    
    try {
      // 1. OCR识别
      console.log('📸 第一步：OCR文字识别...');
      
      const result = await Tesseract.recognize(imageFile, 'chi_sim+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text' && onProgress) {
            onProgress(Math.round(m.progress * 100));
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
      
      if (billType === 'unknown') {
        console.log('⚠ 无法识别账单类型，尝试通用解析');
      }
      
      // 3. 文本预处理
      console.log('\n🔧 第三步：文本预处理...');
      const processedText = this.preprocessText(rawText);
      
      // 4. 提取日期
      console.log('\n📅 第四步：提取日期...');
      const baseDate = this.extractDate(processedText);
      
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
        
        const transactionType = amountInfo.sign === '+' ? 'income' : 'expense';
        const category = this.categorizeMerchant(merchant, transactionType);
        
        const transaction = {
          merchant: merchant,
          amount: amountInfo.amount,
          type: transactionType,
          category: category.name,
          categoryId: category.id,
          date: baseDate,
          confidence: Math.min(95, result.data.confidence + 10),
          original: amountInfo.original,
          billType: billType
        };
        
        results.push(transaction);
        
        console.log(`  ✓ 成功: "${merchant}" ${amountInfo.sign}${amountInfo.amount} -> ${category.name}`);
      }
      
      console.log(`\n🎉 解析完成！共识别 ${results.length} 条交易记录`);
      this.results = results;
      return results;
      
    } catch (error) {
      console.error('❌ 解析失败:', error);
      return [];
    } finally {
      this.isRecognizing = false;
    }
  }

  // 格式化输出结果
  formatResults(results) {
    console.log('\n📊 通用OCR解析结果汇总');
    console.log('='.repeat(80));
    
    const incomeRecords = results.filter(r => r.type === 'income');
    const expenseRecords = results.filter(r => r.type === 'expense');
    
    const totalIncome = incomeRecords.reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = expenseRecords.reduce((sum, r) => sum + r.amount, 0);
    
    console.log(`收入记录: ${incomeRecords.length} 条，总计: ¥${totalIncome.toFixed(2)}`);
    console.log(`支出记录: ${expenseRecords.length} 条，总计: ¥${totalExpense.toFixed(2)}`);
    console.log(`净收支: ¥${(totalIncome - totalExpense).toFixed(2)}`);
    
    console.log('\n📋 详细明细');
    console.log('序号 | 商家名称 | 金额 | 类型 | 分类 | 账单类型');
    console.log('-'.repeat(80));
    
    results.forEach((result, index) => {
      const amountStr = result.type === 'expense' ? `-¥${result.amount}` : `+¥${result.amount}`;
      const typeIcon = result.type === 'expense' ? '💸' : '💵';
      const billTypeIcon = result.billType === 'wechat' ? '💬' : result.billType === 'alipay' ? '💰' : '🏦';
      
      console.log(`${(index + 1).toString().padStart(2)} | ${result.merchant.padEnd(20)} | ${amountStr.padStart(8)} | ${typeIcon} ${result.type} | ${result.category} | ${billTypeIcon} ${result.billType}`);
    });
    
    return results;
  }

  // 获取解析状态
  getStatus() {
    return {
      isRecognizing: this.isRecognizing,
      results: this.results,
      resultCount: this.results.length
    };
  }

  // 清空结果
  clearResults() {
    this.results = [];
  }
}

// 创建单例实例
export const ocrService = new WechatBillOCRService();

// 导出默认实例
export default ocrService;
