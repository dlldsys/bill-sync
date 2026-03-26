# 快速参考指南

## 🎨 主题变更

### 颜色系统
| 类型 | 旧色值 | 新色值 | 用途 |
|------|--------|--------|------|
| 主色 | #667eea | #0abfca | 按钮、强调 |
| 渐变 | #667eea → #764ba2 | #0abfca → #08a9b5 | 背景 |
| 背景 | #f5f5f5 | #f0f4f8 | 页面背景 |
| 卡片 | #ffffff | #ffffff | 卡片背景 |

## 📝 使用新样式类

### 卡片
```html
<div className="card">
  <!-- 白色背景 + 圆角 + 阴影 -->
</div>
```

### 按钮
```html
<button className="btn btn-primary">主按钮</button>
<button className="btn btn-outline">次要按钮</button>
```

### 统计卡片
```html
<div className="stats-card">
  <div className="stats-title">标题</div>
  <div className="stats-value">¥1,234.56</div>
  <div className="stats-sub">12笔</div>
</div>
```

### 账单卡片
```html
<div className="bill-card">
  <div className="bill-icon">🍜</div>
  <div className="bill-info">
    <div className="bill-description">午餐</div>
    <div className="bill-meta">餐饮</div>
  </div>
  <div className="bill-amount">-¥25.00</div>
</div>
```

### 表单
```html
<div className="form-group">
  <label className="form-label">标签</label>
  <input type="text" className="form-input" />
</div>
```

### 分类网格
```html
<div className="category-grid">
  <div className="category-item active">
    <div className="category-icon">🍜</div>
    <div className="category-name">餐饮</div>
  </div>
</div>
```

## 🎯 关键修改点

### 1. OCR识别 (`src/services/ocr.ts`)
- ✅ 多行金额识别
- ✅ 乱码过滤
- ✅ 智能描述提取

### 2. 分析页面 (`src/pages/Analysis/index.tsx`)
- ✅ 周/月快速选择下拉
- ✅ 跳转功能优化
- ✅ 左右切换同步

### 3. 导入页面 (`src/pages/Import/index.tsx`)
- ✅ 分类单选下拉
- ✅ 优化的识别结果展示

### 4. 首页 (`src/pages/Home/index.tsx`)
- ✅ 电脑端批量选择
- ✅ 手机端长按选择
- ✅ 自适应提示文字

### 5. 同步页面 (`src/pages/Sync/index.tsx`)
- ✅ 手机端二维码扫描
- ✅ 手动输入IP
- ✅ Web端二维码显示

### 6. 全局样式 (`src/styles/global.css`)
- ✅ 青色主题系统
- ✅ 统一的圆角系统
- ✅ 柔和阴影效果
- ✅ 优化的动画

## 🔧 CSS变量参考

```css
/* 颜色变量 */
--primary-color: #0abfca;
--primary-dark: #08a9b5;
--primary-light: #88dfe5;

--bg-primary: #f0f4f8;
--bg-secondary: #ecf0f3;
--bg-card: #ffffff;

--text-primary: #333333;
--text-secondary: #666666;
--text-muted: #999999;

/* 圆角变量 */
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 14px;

/* 间距变量 */
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 12px;
--spacing-lg: 16px;
--spacing-xl: 20px;

/* 阴影变量 */
--shadow-sm: 0 1px 4px rgba(0,0,0,0.04);
--shadow-md: 0 2px 8px rgba(0,0,0,0.06);
--shadow-lg: 0 4px 16px rgba(0,0,0,0.1);
```

## 📱 响应式断点

```css
/* 手机端 (<768px) */
@media (max-width: 768px) {
  /* 适配样式 */
}

/* 安全区域适配 */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .bottom-nav {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

## ⚡ 性能优化

- CSS变量实现主题切换
- 柔和的动画效果
- 优化的滚动条样式
- 响应式设计

## 🎬 动画效果

```css
/* 渐入动画 */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 缩放动画 */
@keyframes scaleIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.animate-fade-in { animation: fadeIn 0.3s ease; }
.animate-scale-in { animation: scaleIn 0.2s ease; }
```

## ✅ 检查清单

在提交代码前，请确保：

- [ ] 所有新组件使用CSS类而不是内联样式
- [ ] 颜色值使用CSS变量
- [ ] 圆角使用预定义变量
- [ ] 间距使用标准化系统
- [ ] 按钮有适当的hover/active效果
- [ ] 卡片有适当的阴影效果
- [ ] 动画流畅且不过度
- [ ] 移动端适配正常

## 📚 相关文档

- `UI_MODIFICATION_SUMMARY.md` - 完整修改总结
- `UI_STYLE_ANALYSIS.md` - 风格分析报告
- `UI_UPDATE_LOG.md` - 详细更新日志
