// 账单记录
export interface BillRecord {
  id: string;
  amount: number;
  category: string;
  categoryName?: string;
  description: string;
  date: string;
  source: 'ocr' | 'manual';
  rawText?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deviceId: string;
  syncVersion: number;
  syncState: 'synced' | 'pending' | 'conflict';
}

// 分类
export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';  // 收支类型
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deviceId: string;
  syncVersion: number;
}

// 同步信息
export interface SyncInfo {
  deviceId: string;
  deviceName: string;
  lastSyncTime: string;
  status: 'connected' | 'disconnected';
}

// 冲突记录
export interface ConflictRecord {
  id: string;
  entityType: 'bill' | 'category';
  entityId: string;
  localVersion: BillRecord | Category;
  remoteVersion: BillRecord | Category;
  conflictType: 'both_modified' | 'delete_conflict';
  createdAt: string;
}

// 同步消息
export interface SyncMessage {
  type: 'handshake' | 'sync' | 'conflict' | 'resolved' | 'ping' | 'pong';
  payload?: unknown;
  timestamp: string;
}

// 连接信息（用于二维码）
export interface ConnectionInfo {
  type: 'bill-sync';
  deviceId: string;
  deviceName: string;
  ip: string;
  port: number;
}

// 备份数据
export interface BackupData {
  version: string;
  createdAt: string;
  deviceId: string;
  bills: BillRecord[];
  categories: Category[];
}

// OCR 结果
export interface OCRResult {
  text: string;
  confidence: number;
  engine?: string;
  processTime?: number;
  words?: Array<{
    text: string;
    confidence: number;
    bbox?: number[];
  }>;
  error?: string;
}

// 账单类型
export type BillType = 'alipay' | 'wechat' | 'bank' | 'other';

// 解析后的账单
export interface ParsedBill {
  amount: number;
  date: string;
  description: string;
  merchant?: string;  // 商家名称
  category?: string;  // 识别的类目
  confidence: number;
}

// 设备信息
export interface DeviceInfo {
  id: string;
  name: string;
  type: 'mobile' | 'web';
}

// 分类规则配置
export interface CategoryRule {
  id: string;
  keyword: string;           // 匹配关键词
  matchField: 'merchant' | 'description';  // 匹配字段
  matchType: 'contains' | 'regex';  // 匹配方式
  categoryId: string;        // 匹配的分类ID
  priority: number;          // 优先级（数字越大优先级越高）
  enabled: boolean;           // 是否启用
  createdAt: string;
  updatedAt: string;
  deviceId: string;
  syncVersion: number;
}
