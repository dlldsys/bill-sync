# 统一OCR服务使用指南

## 🎯 概述

统一OCR服务是一个纯前端的微信账单识别解决方案，支持Web浏览器端和打包App（Electron/Capacitor）使用。该服务基于Tesseract.js实现，无需后端服务器，可以直接在客户端运行。

## 📦 文件结构

```
src/
├── services/
│   └── unified-ocr.js          # 统一OCR服务核心类
├── hooks/
│   └── useOCR.js               # React Hook封装
└── pages/
    └── OCRDemo/
        └── mobile.tsx          # 演示页面
```

## 🚀 快速开始

### 1. 基本使用

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
      {error && <div>错误: {error}</div>}
    </div>
  );
}
```

### 2. 直接使用服务类

```javascript
import { WechatBillOCRService } from '../services/unified-ocr.js';

const ocrService = new WechatBillOCRService();

// 处理图片
const results = await ocrService.parseImage(file, (progress) => {
  console.log('进度:', progress);
});

// 格式化结果
ocrService.formatResults(results);

// 获取状态
const status = ocrService.getStatus();
```

## 🔧 API 参考

### useOCR Hook

#### 状态
- `isProcessing: boolean` - 是否正在处理
- `progress: number` - 处理进度 (0-100)
- `results: OCRResult[]` - 识别结果
- `error: string | null` - 错误信息

#### 方法
- `processImage(file: File): Promise<OCRResult[]>` - 处理图片
- `clearResults(): void` - 清空结果
- `getStatistics(): OCRStats | null` - 获取统计信息
- `getStatus(): OCRStatus` - 获取服务状态
- `formatResults(results: OCRResult[]): void` - 格式化输出结果

### WechatBillOCRService 类

#### 主要方法
- `parseImage(imageFile: File, onProgress?: Function): Promise<OCRResult[]>`
- `detectBillType(text: string): 'wechat' | 'unknown'`
- `extractAmounts(text: string): AmountMatch[]`
- `extractMerchant(text: string, amountIndex: number): string | null`
- `categorizeMerchant(merchant: string, billType: string): CategoryInfo`

## 📊 数据结构

### OCRResult
```typescript
interface OCRResult {
  merchant: string;        // 商家名称
  amount: number;          // 金额
  type: 'income' | 'expense';  // 收支类型
  category: string;        // 分类
  categoryId: string;       // 分类ID
  date: string;            // 日期
  confidence: number;      // 置信度
  original: string;        // 原始金额文本
}
```

### OCRStats
```typescript
interface OCRStats {
  totalRecords: number;   // 总记录数
  incomeCount: number;     // 收入记录数
  expenseCount: number;    // 支出记录数
  totalIncome: number;     // 总收入
  totalExpense: number;    // 总支出
  netAmount: number;       // 净收支
}
```

## 🌐 跨平台支持

### Web浏览器端
- 支持Chrome、Firefox、Safari、Edge
- 需要现代浏览器支持ES6+和WebAssembly
- 自动加载Tesseract.js语言包

### 打包App
- **Electron**: 直接使用，无需额外配置
- **Capacitor**: 需要配置文件访问权限
- **Cordova**: 需要文件插件支持

## 📱 移动端优化

### 文件选择
```javascript
// 移动端文件选择优化
const handleFileSelect = (event) => {
  const file = event.target.files?.[0];
  if (file && file.type.startsWith('image/')) {
    processImage(file);
  }
};
```

### 内存管理
```javascript
// 大图片处理优化
const processLargeImage = async (file) => {
  // 压缩图片
  const compressedFile = await compressImage(file, { maxWidth: 1024 });
  return await processImage(compressedFile);
};
```

## 🎨 UI组件集成

### Ant Design Mobile
```javascript
import { Button, Toast, Progress } from 'antd-mobile';

// 使用示例
<Button 
  loading={isProcessing}
  onClick={() => fileInputRef.current?.click()}
>
  {isProcessing ? '识别中...' : '选择图片'}
</Button>

<Progress percent={progress} />

{results.length > 0 && (
  <Button onClick={clearResults}>
    清空结果
  </Button>
)}
```

### 原生HTML
```html
<input 
  type="file" 
  accept="image/*" 
  id="ocr-upload"
  capture="environment"
>

<div class="progress-bar">
  <div class="progress-fill" style="width: {progress}%"></div>
</div>
```

## ⚡ 性能优化

### 1. 图片预处理
```javascript
// 图片压缩
const compressImage = (file, options) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      const { maxWidth, maxHeight, quality } = options;
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(resolve, 'image/jpeg', quality);
    };
    
    img.src = URL.createObjectURL(file);
  });
};
```

### 2. 缓存优化
```javascript
// 结果缓存
const cache = new Map();

const processWithCache = async (file) => {
  const key = `${file.name}_${file.size}_${file.lastModified}`;
  
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const result = await processImage(file);
  cache.set(key, result);
  
  return result;
};
```

## 🐛 常见问题

### 1. Tesseract语言包加载失败
```javascript
// 解决方案：预加载语言包
import Tesseract from 'tesseract.js';

// 预加载中文语言包
await Tesseract.createWorker('chi_sim+eng');
```

### 2. 内存不足
```javascript
// 解决方案：限制并发处理
const MAX_CONCURRENT = 2;
const processingQueue = [];

const queueProcess = async (file) => {
  if (processingQueue.length >= MAX_CONCURRENT) {
    await new Promise(resolve => {
      processingQueue.push(resolve);
    });
  }
  
  try {
    return await processImage(file);
  } finally {
    if (processingQueue.length > 0) {
      processingQueue.shift()();
    }
  }
};
```

### 3. 移动端性能问题
```javascript
// 解决方案：Web Worker处理
const workerCode = `
  importScripts('https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js');
  
  self.onmessage = async (e) => {
    const { imageData } = e.data;
    const result = await Tesseract.recognize(imageData, 'chi_sim+eng');
    self.postMessage(result);
  };
`;

const worker = new Worker(URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' })));
```

## 📈 准确率统计

基于测试图片的识别准确率：
- **记录数量**: 100% (8/8)
- **金额识别**: 100% (8/8)
- **商家匹配**: 62.5% (5/8)
- **自动分类**: 50% (4/8)

## 🔮 未来规划

1. **多账单类型支持**: 支付宝、银行账单
2. **机器学习优化**: 提高商家识别准确率
3. **批量处理**: 支持多图片同时处理
4. **云端同步**: 结果云端存储和同步
5. **模板自定义**: 用户自定义商家和分类规则

## 📞 技术支持

如有问题，请查看：
1. 浏览器控制台日志
2. Tesseract.js官方文档
3. 项目GitHub Issues

---

*最后更新: 2026年3月26日*
