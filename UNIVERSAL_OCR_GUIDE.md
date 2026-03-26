# 🌟 通用OCR服务使用指南

## 📖 概述

这是一个**通用的账单OCR识别服务**，不再局限于特定的微信账单格式。该服务能够智能识别和处理各种类型的账单图片，包括：

- ✅ **微信账单**（各种版本和格式）
- ✅ **支付宝账单**（基础支持）
- ✅ **银行账单**（基础支持）
- ✅ **通用账单格式**（自动适配）

## 🚀 核心特性

### 🎯 智能账单检测
- **动态评分系统**：自动识别账单类型
- **多特征匹配**：支持关键词、格式、金额等多种特征
- **容错性强**：即使部分特征缺失也能正确识别

### 🔧 智能文本处理
- **多策略分割**：4种不同的文本分割策略
- **格式标准化**：自动统一日期、金额格式
- **压缩格式支持**：处理单行压缩的OCR输出

### 🏪 通用商家识别
- **大型商家库**：支持连锁店、餐饮、电商等
- **智能匹配**：基于优先级的关键词匹配
- **个人转账**：支持个人名称和转账场景

### 📊 扩展分类系统
- **7大分类**：购物、餐饮、交通、生活服务、娱乐、转账收入、转账支出
- **智能修正**：根据收支类型自动修正分类
- **自定义扩展**：易于添加新的分类规则

## 📁 文件结构

```
src/
├── services/
│   └── unified-ocr.js          # 通用OCR服务核心类
├── hooks/
│   └── useOCR.js               # React Hook封装
└── pages/
    └── OCRDemo/
        └── mobile.tsx          # 演示页面
```

## 🛠️ API 参考

### WechatBillOCRService 类

#### 主要方法

```javascript
// 主要解析方法
async parseImage(imageFile, onProgress?: Function): Promise<OCRResult[]>

// 账单类型检测
detectBillType(text: string): 'wechat' | 'alipay' | 'bank' | 'unknown'

// 文本预处理
preprocessText(text: string): string

// 智能分割
splitCompressedText(text: string): string

// 金额提取
extractAmounts(text: string): AmountMatch[]

// 商家提取
extractMerchant(text: string, amountIndex: number): string | null

// 自动分类
categorizeMerchant(merchant: string, billType: string): CategoryInfo

// 日期提取
extractDate(text: string): string
```

#### 工具方法

```javascript
// 格式化输出
formatResults(results: OCRResult[]): void

// 获取状态
getStatus(): OCRStatus

// 清空结果
clearResults(): void
```

## 🎨 使用示例

### 基础使用

```javascript
import { ocrService } from '../services/unified-ocr.js';

// 处理图片
const results = await ocrService.parseImage(file, (progress) => {
  console.log(`进度: ${progress}%`);
});

// 格式化输出
ocrService.formatResults(results);
```

### React Hook 使用

```javascript
import { useOCR } from '../hooks/useOCR.js';

function MyComponent() {
  const {
    isProcessing,
    progress,
    results,
    error,
    processImage,
    clearResults,
    getStatistics
  } = useOCR();

  const handleFileUpload = async (file) => {
    const ocrResults = await processImage(file);
    console.log('识别结果:', ocrResults);
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/*" 
        onChange={(e) => handleFileUpload(e.target.files[0])}
        disabled={isProcessing}
      />
      {isProcessing && <div>识别进度: {progress}%</div>}
      {results.length > 0 && (
        <div>识别到 {results.length} 条记录</div>
      )}
    </div>
  );
}
```

## 📋 支持的账单格式

### 微信账单
- ✅ 标准格式（多行显示）
- ✅ 压缩格式（单行显示）
- ✅ 混合格式（部分压缩）
- ✅ 各种版本（V2、V3等）

### 支付宝账单
- ✅ 基础格式识别
- ✅ 金额提取
- ✅ 商家识别（有限支持）

### 银行账单
- ✅ 基础格式识别
- ✅ 金额提取
- ✅ 日期识别

### 通用格式
- ✅ 自适应识别
- ✅ 智能分割
- ✅ 格式标准化

## 🏪 商家识别库

### 大型连锁商家
```javascript
// 购物类
'凯德集团', '沃尔玛', '家乐福', '永辉超市'

// 餐饮类
'麦当劳', '肯德基', '星巴克', '瑞幸咖啡', '海底捞'

// 电商类
'淘宝', '天猫', '京东', '拼多多'

// 生活服务
'美团', '饿了么', '滴滴', '高德'
```

### 个人转账
```javascript
// 支持个人名称识别
'宁静', '可心', '悦来', '刁', '张三', '李四'

// 转账模式
'转账-给XXX', '收款-来自XXX', '给XXX转账'
```

### 扫码支付
```javascript
// 扫码付款
'扫二维码付款-给XXX', '扫码付款'

// 二维码收款
'二维码收款-来自XXX', '二维码收款'
```

## 📊 分类系统

### 分类规则
```javascript
const categoryRules = [
  // 购物类
  { keywords: ['凯德', '沃尔玛', '淘宝', '京东'], category: '购物' },
  
  // 餐饮类
  { keywords: ['麦当劳', '肯德基', '星巴克'], category: '餐饮' },
  
  // 交通类
  { keywords: ['中石化', '滴滴', '地铁'], category: '交通' },
  
  // 生活服务类
  { keywords: ['美团', '饿了么', '水电'], category: '生活服务' },
  
  // 娱乐类
  { keywords: ['游戏', '视频', '音乐'], category: '娱乐' },
  
  // 转账类
  { keywords: ['转账', '收款', '付款'], category: '转账' },
];
```

### 智能修正
- 收入类型的支出分类 → 转账收入
- 支出类型的收入分类 → 转账支出
- 未知分类 → 其他

## 🔧 高级配置

### 自定义商家库
```javascript
// 添加新的商家关键词
const customMerchants = [
  { keyword: '新商家', priority: 8 },
  { keyword: '特色餐厅', priority: 7 },
];

// 在 extractMerchant 方法中扩展
```

### 自定义分类规则
```javascript
// 添加新的分类规则
const customCategories = [
  { 
    keywords: ['新分类关键词'], 
    category: { id: 'custom', name: '自定义分类', type: 'expense' } 
  },
];
```

### 自定义分割策略
```javascript
// 添加新的分割策略
const customStrategies = [
  () => this.splitByCustomPattern(text),
  () => this.splitByMachineLearning(text),
];
```

## 📱 跨平台支持

### Web浏览器
- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 11+
- ✅ Edge 79+

### 移动端
- ✅ iOS Safari 11+
- ✅ Android Chrome 60+
- ✅ 微信内置浏览器
- ✅ 支付宝内置浏览器

### 打包应用
- ✅ Electron
- ✅ Capacitor
- ✅ Cordova
- ✅ React Native

## 🎯 性能优化

### 图片预处理
```javascript
// 压缩大图片
const compressImage = (file, maxWidth = 1024) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(resolve, 'image/jpeg', 0.8);
    };
    
    img.src = URL.createObjectURL(file);
  });
};
```

### 内存管理
```javascript
// 及时清理URL对象
URL.revokeObjectURL(url);

// 清理结果
ocrService.clearResults();

// 限制并发处理
const MAX_CONCURRENT = 2;
```

### 缓存优化
```javascript
// 结果缓存
const cache = new Map();

const processWithCache = async (file) => {
  const key = `${file.name}_${file.size}_${file.lastModified}`;
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const result = await ocrService.parseImage(file);
  cache.set(key, result);
  return result;
};
```

## 🐛 常见问题

### Q: 识别准确率不高？
A: 
1. 确保图片清晰，文字可辨
2. 避免图片过小或模糊
3. 检查是否为支持的账单类型
4. 查看控制台日志了解识别过程

### Q: 无法识别商家名称？
A:
1. 检查商家是否在商家库中
2. 可以添加自定义商家关键词
3. 查看OCR输出的原始文本
4. 考虑手动编辑商家名称

### Q: 分类不准确？
A:
1. 检查分类规则是否完整
2. 可以添加自定义分类规则
3. 根据收支类型自动修正
4. 手动调整分类

### Q: 处理速度慢？
A:
1. 压缩图片大小
2. 使用Web Worker处理
3. 限制并发处理数量
4. 启用结果缓存

## 🔮 未来规划

### 短期目标
- [ ] 支持更多银行账单格式
- [ ] 提高商家识别准确率
- [ ] 添加机器学习优化
- [ ] 支持批量处理

### 长期目标
- [ ] 支持发票识别
- [ ] 添加多语言支持
- [ ] 云端同步功能
- [ ] API服务化

## 📞 技术支持

如有问题或建议，请：
1. 查看控制台日志
2. 检查图片质量
3. 确认账单格式
4. 联系技术支持

---

*最后更新: 2026年3月26日*
