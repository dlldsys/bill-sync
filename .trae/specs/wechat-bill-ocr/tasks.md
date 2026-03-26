# Tasks

- [x] Task 1: 创建微信账单检测函数
  - [x] SubTask 1.1: 在 ocr.ts 中新增 detectBillType 函数
  - [x] SubTask 1.2: 检测微信账单特征（微信支付、绿色标题、白色卡片）
  - [x] SubTask 1.3: 返回账单类型枚举（wechat/Alipay/Bank/Unknown）

- [x] Task 2: 实现白色背景区域过滤逻辑
  - [x] SubTask 2.1: 新增 filterWhiteBackgroundText 函数
  - [x] SubTask 2.2: 过滤非账单主体的文字区域
  - [x] SubTask 2.3: 保留白色背景卡片内的账单明细

- [x] Task 3: 新增微信账单专属解析函数
  - [x] SubTask 3.1: 新增 extractWechatBillFields 函数
  - [x] SubTask 3.2: 解析微信专属字段格式
  - [x] SubTask 3.3: 支持微信红包、转账等特殊交易类型

- [x] Task 4: 优化日期提取逻辑
  - [x] SubTask 4.1: 支持微信格式：交易时间: 2024-03-25 14:30
  - [x] SubTask 4.2: 支持微信格式：03月25日 14:30
  - [x] SubTask 4.3: 支持微信格式：2024/3/25 14:30
  - [x] SubTask 4.4: 每条记录使用各自的交易时间

- [x] Task 5: 优化金额提取逻辑
  - [x] SubTask 5.1: 支持微信格式：¥88.88
  - [x] SubTask 5.2: 过滤订单号、流水号等非金额数字
  - [x] SubTask 5.3: 区分收入和支出金额

- [x] Task 6: 优化交易概况列表解析（商家时间上下排列）
  - [x] SubTask 6.1: 重写 parseWechatTransactionList 函数
  - [x] SubTask 6.2: 识别图标（emoji）开头的行作为交易记录开始
  - [x] SubTask 6.3: 解析格式：图标+商家在上一行，时间+金额在下一行
  - [x] SubTask 6.4: 第一行作为基准日期行，记录当天的日期
  - [x] SubTask 6.5: 后续行使用基准日期
  - [x] SubTask 6.6: 商家名称和时间上下排列，金额在右侧

- [x] Task 7: 更新 parseBillTextWithAutoMatch 函数
  - [x] SubTask 7.1: 在解析前先检测账单类型
  - [x] SubTask 7.2: 根据账单类型选择对应的解析策略
  - [x] SubTask 7.3: 保持向后兼容

# Task Dependencies
- Task 6 依赖 Task 1-5（需要基础 OCR 解析逻辑）
