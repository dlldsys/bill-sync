# 微信账单OCR识别算法文档

## 1. 整体流程

```
原始图片 
   ↓
Tesseract OCR识别 
   ↓
清理乱码文本 (postProcessOCRText)
   ↓
检测账单类型 (detectBillType: wechat/alipay/bank)
   ↓
过滤白色背景文本 (filterWhiteBackgroundText)
   ↓
解析交易列表 (parseWechatTransactionList) ← 新版算法
   ↓
自动匹配分类 (matchCategory)
   ↓
返回ParseBillResult[]
```

## 2. 新版算法规则

### 规则概述

```
1. 提取基准日期
   ├─ 扫描前10行
   ├─ 匹配格式: "2026年3月" → 生成 YYYY-MM 基准日期
   └─ 未找到则使用当前年月

2. 跳过无效行
   ├─ 空行
   ├─ 标题行（账单、全部账单、交易概况、账单明细）
   ├─ 统计行（支出¥、收入¥）
   ├─ 纯日期标题（如 2026年3月24日）
   ├─ 今天、昨天
   └─ 暂无账单明细

3. 三行一组匹配交易
   ├─ 第1行 = 商家
   ├─ 第2行 = 时间（格式：3月24日 17:35）
   └─ 第3行 = 金额（-20.00 / +3.00）

4. 字段解析
   ├─ merchant：商家文本（移除emoji）
   ├─ time：拼接基准日期 → YYYY-MM-DD HH:mm
   ├─ amount：纯数字金额
   ├─ type：- = expense（支出），+ = income（收入）
   └─ category：按关键词匹配

5. 分类规则
   ├─ 凯德集团 → 购物/商场消费
   ├─ 中石化 → 交通/加油
   ├─ 家常菜 → 餐饮
   ├─ 扫二维码付款-给 → 餐饮/生活服务
   ├─ 二维码收款-来自 → 个人转账收入
   └─ 其他 → 其他
```

## 3. 核心函数

### parseWechatTransactionList

```typescript
// 主解析函数 - 新版算法
export function parseWechatTransactionList(text: string): ParseBillResult[] {
  // 1. 提取基准日期
  let baseYearMonth = '';
  // 扫描前10行，匹配 "2026年3月" 格式
  
  // 2. 过滤无效行
  const validLines: string[] = [];
  // 跳过：空行、标题、统计行、日期标题、今天/昨天等
  
  // 3. 三行一组匹配
  for (let i = 0; i + 2 < validLines.length; i += 3) {
    const line1 = validLines[i]; // 商家
    const line2 = validLines[i + 1]; // 时间
    const line3 = validLines[i + 2]; // 金额
    
    const merchant = parseMerchantFromLine(line1);
    const timeResult = parseTimeFromLine(line2, baseYearMonth);
    const amountResult = parseAmountFromLine(line3);
    
    // 构建结果并匹配分类
  }
  
  return results;
}
```

### parseMerchantFromLine

```typescript
// 解析商家名称 - 移除emoji，保留中文
function parseMerchantFromLine(line: string): string | null {
  let merchant = line
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // 移除emoji
    .replace(/^[^\u4e00-\u9fa5]*/, '') // 移除开头的非汉字
    .trim();
  
  return merchant.length >= 2 ? merchant : null;
}
```

### parseTimeFromLine

```typescript
// 解析时间：格式 "3月24日 17:35" → YYYY-MM-DDTHH:mm:ss.000Z
function parseTimeFromLine(line: string, baseYearMonth: string): { date: string; timeStr: string } | null {
  const match = line.match(/(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})/);
  if (!match) return null;
  
  const month = parseInt(match[1]);
  const day = parseInt(match[2]);
  const hours = parseInt(match[3]);
  const minutes = parseInt(match[4]);
  
  // 验证有效性...
  // 拼接日期时间
  const dateStr = `${baseYearMonth}-${dayStr}`;
  const dateObj = new Date(dateStr + 'T' + timeStr + ':00.000Z');
  
  return { date: dateObj.toISOString(), timeStr };
}
```

### parseAmountFromLine

```typescript
// 解析金额：格式 "-20.00" 或 "+3.00"
function parseAmountFromLine(line: string): { amount: number; type: 'income' | 'expense' } | null {
  const match = line.match(/^([\+\-])(\d+(?:\.\d{1,2})?)$/);
  if (!match) return null;
  
  const sign = match[1];
  const amount = parseFloat(match[2]);
  
  return {
    amount: amount,
    type: sign === '+' ? 'income' : 'expense',
  };
}
```

### matchCategory

```typescript
// 分类匹配规则表
interface CategoryInfo {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

function matchCategory(merchant: string): CategoryInfo | null {
  const categoryRules = [
    // 餐饮类
    { keywords: ['家常菜', '餐厅', '饭店', '餐馆', ...], category: { id: 'food', name: '餐饮', type: 'expense' } },
    // 购物/商场消费类
    { keywords: ['凯德', '商场', '购物中心', '超市', ...], category: { id: 'shopping', name: '购物/商场消费', type: 'expense' } },
    // 交通/加油类
    { keywords: ['中石化', '中石油', '加油站', '加油', ...], category: { id: 'transport', name: '交通/加油', type: 'expense' } },
    // 扫码付款类
    { keywords: ['扫二维码付款', '扫码付款'], category: { id: 'life_service', name: '餐饮/生活服务', type: 'expense' } },
    // 扫码收款类（收入）
    { keywords: ['二维码收款', '扫码收款', '收钱'], category: { id: 'transfer_in', name: '个人转账收入', type: 'income' } },
    // ... 更多规则
  ];
  
  // 遍历规则匹配
  for (const rule of categoryRules) {
    for (const keyword of rule.keywords) {
      if (merchant.includes(keyword)) {
        return rule.category;
      }
    }
  }
  
  return { id: 'other', name: '其他', type: 'expense' };
}
```

## 4. 支持的输入格式

### 标准三行格式（推荐）

```
2026年3月
凯德集团
3月24日 17:35
-20.00
家常菜
3月24日 12:30
-45.50
中石化
3月23日 09:20
-300.00
工资
3月22日 10:00
+500.00
```

### 带emoji格式

```
2026年3月
🛒 凯德集团
3月24日 17:35
-20.00
🍜 家常菜
3月24日 12:30
-45.50
💰 工资
3月22日 10:00
+500.00
```

### 混合格式（自动过滤无效行）

```
2026年3月25日
暂无账单明细
2026年3月24日
凯德集团
3月24日 17:35
-20.00
家常菜
3月24日 12:30
-45.50
二维码收款-来自张三
3月23日 15:00
+200.00
```

## 5. 输出格式

```typescript
interface ParseBillResult {
  amount: number;              // 金额 (正值)
  date: string;               // ISO格式日期
  description: string;        // 描述（空，由用户填写）
  merchant: string;            // 商家名称
  confidence: number;          // 置信度 (固定90)
  rawDate?: string;           // 原始日期
  billType?: 'income' | 'expense';  // 账单类型
  category?: string;           // 分类名称
  matchedCategoryId?: string;  // 分类ID
  matchedCategoryName?: string; // 分类名称
}
```

## 6. 示例

**输入OCR文本:**
```
2026年3月
凯德集团
3月24日 17:35
-20.00
家常菜
3月24日 12:30
-45.50
中石化
3月23日 09:20
-300.00
工资
3月22日 10:00
+500.00
扫二维码付款-给老麦
3月21日 18:00
-38.50
```

**输出结果:**
```json
[
  {
    "amount": 20.00,
    "date": "2026-03-24T09:35:00.000Z",
    "description": "",
    "merchant": "凯德集团",
    "confidence": 90,
    "billType": "expense",
    "category": "购物/商场消费",
    "matchedCategoryId": "shopping",
    "matchedCategoryName": "购物/商场消费"
  },
  {
    "amount": 45.50,
    "date": "2026-03-24T04:30:00.000Z",
    "description": "",
    "merchant": "家常菜",
    "confidence": 90,
    "billType": "expense",
    "category": "餐饮",
    "matchedCategoryId": "food",
    "matchedCategoryName": "餐饮"
  },
  {
    "amount": 300.00,
    "date": "2026-03-23T01:20:00.000Z",
    "description": "",
    "merchant": "中石化",
    "confidence": 90,
    "billType": "expense",
    "category": "交通/加油",
    "matchedCategoryId": "transport",
    "matchedCategoryName": "交通/加油"
  },
  {
    "amount": 500.00,
    "date": "2026-03-22T02:00:00.000Z",
    "description": "",
    "merchant": "工资",
    "confidence": 90,
    "billType": "income",
    "category": "工资/兼职收入",
    "matchedCategoryId": "salary",
    "matchedCategoryName": "工资/兼职收入"
  },
  {
    "amount": 38.50,
    "date": "2026-03-21T10:00:00.000Z",
    "description": "",
    "merchant": "扫二维码付款-给老麦",
    "confidence": 90,
    "billType": "expense",
    "category": "餐饮/生活服务",
    "matchedCategoryId": "life_service",
    "matchedCategoryName": "餐饮/生活服务"
  }
]
```

## 7. 测试用例

```typescript
// 运行测试: testParseWechatTransactionList()
//
// 测试1: 标准三行格式 → 预期5条记录
// 测试2: 带emoji格式 → 预期3条记录
// 测试3: 缺少年月格式（使用当前年月） → 预期2条记录
// 测试4: 多行混合格式 → 预期3条记录
```

## 8. 修改指南

如需修改解析逻辑，重点关注以下函数：

1. **parseWechatTransactionList** - 主解析函数，控制流程
2. **parseMerchantFromLine** - 商家名称解析
3. **parseTimeFromLine** - 时间解析
4. **parseAmountFromLine** - 金额解析
5. **matchCategory** - 分类匹配规则

**修改示例 - 添加新的分类规则:**

```typescript
// 在 matchCategory 函数中添加新的规则
const categoryRules = [
  // ... 现有规则 ...
  
  // 新增：水果类
  { 
    keywords: ['水果', '水果店', '鲜果', '果园'],
    category: { id: 'fruit', name: '水果', type: 'expense' }
  },
];
```

**修改示例 - 调整无效行过滤:**

```typescript
// 在 parseWechatTransactionList 中修改无效行判断
// 跳过 "暂无账单"
if (/暂无账单/.test(line)) continue;
```
