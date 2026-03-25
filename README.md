# BillSync - 账单同步管理

一款支持局域网同步的账单管理应用，支持手机 App 和 Web 端数据同步，数据不出外网。

**在线体验**: https://dlldsys.github.io/bill-sync

## 功能特性

- 📱 **多端支持**: 支持 Android App 和 Web 端访问
- 🔒 **隐私安全**: 数据存储在本地局域网，不上传外网
- 📊 **智能分析**: 自动统计各类消费占比
- 🖼️ **截图识别**: 支持 OCR 识别截图中的账单信息
- 🔄 **双向同步**: 支持 Web 端与手机端数据同步
- 📁 **导入导出**: 支持备份和恢复数据

## 使用教程

### 方式一：Web 端使用（推荐快速体验）

1. 直接访问: **https://dlldsys.github.io/bill-sync**
2. 手机扫码连接：
   - 在 Web 端点击"同步"页面
   - 启动服务后会自动生成二维码
   - 手机 App 扫码即可连接

### 方式二：本地 Web 开发

```bash
# 克隆项目
git clone https://github.com/dlldsys/bill-sync.git
cd bill-sync

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 `http://localhost:5173` 即可使用。

### Android App 使用

#### 构建 APK

```bash
# 安装依赖
npm install

# 构建 Web
npm run build

# 同步到 Android
npx cap sync android

# 打开 Android Studio 构建
# 或使用 Gradle:
cd android && ./gradlew assembleDebug
```

APK 文件位于: `android/app/build/outputs/apk/debug/app-debug.apk`

#### 安装到手机

1. 将 APK 文件传输到手机
2. 开启手机"安装未知来源应用"权限
3. 点击 APK 文件安装

### 数据同步

#### Web 端作为服务端

1. 打开 Web 端 → 同步页面
2. 点击"启动服务"
3. 手机 App 扫码或输入显示的 IP 地址
4. 选择同步方向（推/拉）完成同步

#### 手机端作为服务端

1. 打开 App → 同步页面
2. 点击"启动服务"
3. 在 Web 端输入显示的 IP 地址
4. 完成数据同步

#### 同步选项

- **推送**: 将当前端数据覆盖到对方
- **拉取**: 将对方数据覆盖到当前端
- **合并**: 智能合并两方数据（保留最新修改的记录）

## 项目结构

```
bill-sync/
├── src/
│   ├── pages/          # 页面组件
│   │   ├── Home/        # 首页
│   │   ├── Import/      # 导入
│   │   ├── ManualEntry/ # 手动录入
│   │   ├── Analysis/    # 分析
│   │   ├── Categories/  # 分类管理
│   │   ├── Settings/    # 设置
│   │   └── Sync/        # 同步
│   ├── services/        # 服务层
│   ├── stores/          # 状态管理
│   └── types/           # 类型定义
├── android/             # Android 原生项目
└── public/              # 静态资源
```

## 技术栈

- **前端框架**: React + TypeScript
- **构建工具**: Vite
- **UI 框架**: TailwindCSS
- **移动端**: Capacitor
- **数据库**: SQLite (移动端)
- **状态管理**: Zustand

## 开发说明

### 环境要求

- Node.js >= 22.0.0
- Android Studio (构建 APK)
- Java 21

### 相关命令

```bash
npm run dev          # 开发模式
npm run build        # 构建生产版本
npx cap sync android # 同步到 Android
npx cap open android # 打开 Android Studio
```

## GitHub Actions

项目配置了自动构建：

- **Android APK**: push 到 main 分支自动构建，APK 下载位于 Actions 页面的 artifact
- **GitHub Pages**: push 到 main 分支自动部署到 https://dlldsys.github.io/bill-sync

## License

MIT
