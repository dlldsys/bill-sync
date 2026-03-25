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
}

// 解析后的账单
export interface ParsedBill {
  amount: number;
  date: string;
  description: string;
  confidence: number;
}

// 设备信息
export interface DeviceInfo {
  id: string;
  name: string;
  type: 'mobile' | 'web';
}
