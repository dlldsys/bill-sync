import { BackupData, BillRecord, Category } from '../types';
import { billOps, categoryOps } from './database';
import { now, getDeviceId } from '../utils';

// TXT格式备份版本标识
const TXT_BACKUP_VERSION = '2.0';

// 导出TXT格式备份
export async function exportBackupTxt(): Promise<Blob> {
  const bills = await billOps.getAllWithDeleted();
  const categories = await categoryOps.getAllWithDeleted();

  const lines: string[] = [];

  // 文件头
  lines.push('========== 账单备份 ==========');
  lines.push(`导出时间: ${now()}`);
  lines.push(`设备ID: ${getDeviceId()}`);
  lines.push(`备份版本: ${TXT_BACKUP_VERSION}`);
  lines.push(`账单数量: ${bills.length}`);
  lines.push(`分类数量: ${categories.length}`);
  lines.push('');

  // 分类数据
  lines.push('--- 分类数据 ---');
  for (const cat of categories) {
    // 格式: #分类# id | icon | name | color | type | isDefault | createdAt
    const catLine = [
      '#分类#',
      cat.id,
      cat.icon,
      cat.name,
      cat.color,
      cat.type || 'expense',
      cat.isDefault ? '1' : '0',
      cat.createdAt,
      cat.updatedAt || '',
    ].join(' | ');
    lines.push(catLine);
  }
  lines.push('');

  // 账单数据
  lines.push('--- 账单数据 ---');
  for (const bill of bills) {
    // 格式: #账单# id | amount | category | description | date | source | createdAt | deletedAt
    const billLine = [
      '#账单#',
      bill.id,
      bill.amount.toString(),
      bill.category,
      bill.description.replace(/\|/g, '\\|').replace(/\n/g, '\\n'), // 转义特殊字符
      bill.date,
      bill.source || 'manual',
      bill.createdAt,
      bill.deletedAt || '',
    ].join(' | ');
    lines.push(billLine);
  }

  return new Blob([lines.join('\n')], {
    type: 'text/plain;charset=utf-8',
  });
}

// 导出JSON格式备份（保留兼容性）
export async function exportBackupJson(): Promise<Blob> {
  const bills = await billOps.getAllWithDeleted();
  const categories = await categoryOps.getAllWithDeleted();

  const backup: BackupData = {
    version: TXT_BACKUP_VERSION,
    createdAt: now(),
    deviceId: getDeviceId(),
    bills,
    categories,
  };

  return new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
}

// 兼容旧版本的导出备份函数
export async function exportBackup(): Promise<Blob> {
  return exportBackupTxt();
}

// 导出备份并下载（改为TXT格式）
export async function exportAndDownload(): Promise<void> {
  const blob = await exportBackupTxt();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `billsync-backup-${timestamp}.txt`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 解析TXT格式备份
function parseTxtBackup(text: string): BackupData | null {
  const lines = text.split('\n');
  let version = '';
  let createdAt = '';
  let deviceId = '';
  const categories: Category[] = [];
  const bills: BillRecord[] = [];

  let section = ''; // 'header' | 'categories' | 'bills'

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // 解析文件头
    if (line.startsWith('==========')) {
      section = 'header';
      continue;
    }

    if (line.startsWith('--- 分类数据 ---')) {
      section = 'categories';
      continue;
    }

    if (line.startsWith('--- 账单数据 ---')) {
      section = 'bills';
      continue;
    }

    // 解析头部信息
    if (section === 'header') {
      if (line.startsWith('导出时间:')) {
        createdAt = line.substring(5).trim();
      } else if (line.startsWith('设备ID:')) {
        deviceId = line.substring(5).trim();
      } else if (line.startsWith('备份版本:')) {
        version = line.substring(5).trim();
      }
      continue;
    }

    // 解析分类数据
    if (section === 'categories' && line.startsWith('#分类#')) {
      const parts = line.substring(5).trim().split(' | ');
      if (parts.length >= 8) {
        categories.push({
          id: parts[0],
          icon: parts[1],
          name: parts[2],
          color: parts[3],
          type: parts[4] as 'income' | 'expense',
          isDefault: parts[5] === '1',
          createdAt: parts[6],
          updatedAt: parts[7] || parts[6],
          deviceId: deviceId,
          syncVersion: 1,
        });
      }
      continue;
    }

    // 解析账单数据
    if (section === 'bills' && line.startsWith('#账单#')) {
      const parts = line.substring(5).trim().split(' | ');
      if (parts.length >= 8) {
        bills.push({
          id: parts[0],
          amount: parseFloat(parts[1]),
          category: parts[2],
          description: parts[3].replace(/\\\|/g, '|').replace(/\\n/g, '\n'),
          date: parts[4],
          source: parts[5] as 'ocr' | 'manual',
          createdAt: parts[6],
          updatedAt: parts[6],
          deletedAt: parts[7] || undefined,
          deviceId: deviceId,
          syncVersion: 1,
          syncState: 'pending',
        });
      }
      continue;
    }
  }

  if (bills.length === 0 && categories.length === 0) {
    return null;
  }

  return {
    version: version || TXT_BACKUP_VERSION,
    createdAt: createdAt || now(),
    deviceId: deviceId || getDeviceId(),
    bills,
    categories,
  };
}

// 导入备份（支持TXT和JSON格式）
export async function importBackup(
  file: File,
  mode: 'merge' | 'replace'
): Promise<{ bills: number; categories: number; format: 'txt' | 'json' }> {
  const text = await file.text();

  let backup: BackupData | null = null;
  let format: 'txt' | 'json' = 'json';

  // 检测文件格式
  if (text.includes('#分类#') || text.includes('#账单#')) {
    // TXT格式
    format = 'txt';
    backup = parseTxtBackup(text);
  } else {
    // JSON格式（兼容旧版本）
    try {
      backup = JSON.parse(text);
      format = 'json';
    } catch {
      throw new Error('无效的备份文件格式');
    }
  }

  // 验证格式
  if (!backup || !backup.bills || !backup.categories) {
    throw new Error('Invalid backup format');
  }

  if (mode === 'replace') {
    // 清除现有数据
    await billOps.getAllWithDeleted().then((bills) =>
      Promise.all(bills.map((b) => billOps.hardDelete(b.id)))
    );
    await categoryOps.getAllWithDeleted().then((cats) =>
      Promise.all(cats.filter((c) => !c.isDefault).map((c) => categoryOps.delete(c.id)))
    );
  }

  // 导入数据
  await billOps.bulkAdd(backup.bills);
  await categoryOps.bulkAdd(backup.categories.filter((c) => !c.isDefault));

  return {
    bills: backup.bills.length,
    categories: backup.categories.length,
    format,
  };
}

// 从备份文件读取元数据
export async function readBackupMetadata(file: File): Promise<{
  createdAt: string;
  deviceId: string;
  billCount: number;
  categoryCount: number;
  dateRange?: { start: string; end: string };
  format: 'txt' | 'json' | 'unknown';
}> {
  const text = await file.text();

  // 检测文件格式
  if (text.includes('#分类#') || text.includes('#账单#')) {
    // TXT格式
    const backup = parseTxtBackup(text);
    if (backup) {
      const dates = backup.bills
        .map((b) => b.date)
        .filter(Boolean)
        .sort();

      return {
        createdAt: backup.createdAt,
        deviceId: backup.deviceId,
        billCount: backup.bills.length,
        categoryCount: backup.categories.length,
        dateRange:
          dates.length > 0
            ? { start: dates[0], end: dates[dates.length - 1] }
            : undefined,
        format: 'txt',
      };
    }
  }

  // JSON格式
  try {
    const backup: BackupData = JSON.parse(text);
    const dates = backup.bills
      .map((b) => b.date)
      .filter(Boolean)
      .sort();

    return {
      createdAt: backup.createdAt,
      deviceId: backup.deviceId,
      billCount: backup.bills.length,
      categoryCount: backup.categories.length,
      dateRange:
        dates.length > 0
          ? { start: dates[0], end: dates[dates.length - 1] }
          : undefined,
      format: 'json',
    };
  } catch {
    return {
      createdAt: '',
      deviceId: '',
      billCount: 0,
      categoryCount: 0,
      format: 'unknown',
    };
  }
}

// 保存到本地存储（TXT格式）
export async function saveToLocalStorage(): Promise<void> {
  const blob = await exportBackupTxt();
  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onload = () => {
      const backupStr = reader.result as string;
      const backups = JSON.parse(localStorage.getItem('billsync-backups') || '[]');
      backups.push({
        timestamp: now(),
        data: backupStr,
        format: 'txt',
      });

      // 只保留最近 7 份
      if (backups.length > 7) {
        backups.shift();
      }

      localStorage.setItem('billsync-backups', JSON.stringify(backups));
      resolve();
    };
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

// 获取本地备份列表
export function getLocalBackups(): { timestamp: string; size: number; format: string }[] {
  const backups = JSON.parse(localStorage.getItem('billsync-backups') || '[]');
  return backups.map((b: { timestamp: string; data: string; format?: string }) => ({
    timestamp: b.timestamp,
    size: b.data.length,
    format: b.format || 'txt',
  }));
}

// 从本地存储恢复
export async function restoreFromLocalStorage(index: number): Promise<void> {
  const backups = JSON.parse(localStorage.getItem('billsync-backups') || '[]');
  const backup = backups[index];

  if (!backup) {
    throw new Error('Backup not found');
  }

  const blob = new Blob([backup.data], { type: 'text/plain;charset=utf-8' });
  const file = new File([blob], 'backup.txt');

  await importBackup(file, 'replace');
}

// 删除本地备份
export function deleteLocalBackup(index: number): void {
  const backups = JSON.parse(localStorage.getItem('billsync-backups') || '[]');
  backups.splice(index, 1);
  localStorage.setItem('billsync-backups', JSON.stringify(backups));
}
