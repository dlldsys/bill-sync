import { BackupData } from '../types';
import { billOps, categoryOps } from './database';
import { now, getDeviceId } from '../utils';

// 导出备份
export async function exportBackup(): Promise<Blob> {
  const bills = await billOps.getAllWithDeleted();
  const categories = await categoryOps.getAllWithDeleted();
  
  const backup: BackupData = {
    version: '1.0',
    createdAt: now(),
    deviceId: getDeviceId(),
    bills,
    categories,
  };
  
  return new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
}

// 导出备份并下载
export async function exportAndDownload(): Promise<void> {
  const blob = await exportBackup();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `billsync-backup-${timestamp}.json`;
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 导入备份
export async function importBackup(
  file: File,
  mode: 'merge' | 'replace'
): Promise<{ bills: number; categories: number }> {
  const text = await file.text();
  const backup: BackupData = JSON.parse(text);
  
  // 验证格式
  if (!backup.version || !backup.bills || !backup.categories) {
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
  };
}

// 从备份文件读取元数据
export async function readBackupMetadata(file: File): Promise<{
  createdAt: string;
  deviceId: string;
  billCount: number;
  categoryCount: number;
  dateRange?: { start: string; end: string };
}> {
  const text = await file.text();
  const backup: BackupData = JSON.parse(text);
  
  // 计算日期范围
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
  };
}

// 保存到本地存储
export async function saveToLocalStorage(): Promise<void> {
  const blob = await exportBackup();
  const reader = new FileReader();
  
  return new Promise((resolve, reject) => {
    reader.onload = () => {
      const backupStr = reader.result as string;
      const backups = JSON.parse(localStorage.getItem('billsync-backups') || '[]');
      backups.push({
        timestamp: now(),
        data: backupStr,
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
export function getLocalBackups(): { timestamp: string; size: number }[] {
  const backups = JSON.parse(localStorage.getItem('billsync-backups') || '[]');
  return backups.map((b: { timestamp: string; data: string }) => ({
    timestamp: b.timestamp,
    size: b.data.length,
  }));
}

// 从本地存储恢复
export async function restoreFromLocalStorage(index: number): Promise<void> {
  const backups = JSON.parse(localStorage.getItem('billsync-backups') || '[]');
  const backup = backups[index];
  
  if (!backup) {
    throw new Error('Backup not found');
  }
  
  const blob = new Blob([backup.data], { type: 'application/json' });
  const file = new File([blob], 'backup.json');
  
  await importBackup(file, 'replace');
}

// 删除本地备份
export function deleteLocalBackup(index: number): void {
  const backups = JSON.parse(localStorage.getItem('billsync-backups') || '[]');
  backups.splice(index, 1);
  localStorage.setItem('billsync-backups', JSON.stringify(backups));
}
