import { BillRecord } from '../types';

// 查找完全相同时间的重复记录
export function findDuplicatesByTime(bills: BillRecord[]): BillRecord[][] {
  const groups = new Map<string, BillRecord[]>();
  
  for (const bill of bills) {
    // 使用时间戳作为 key
    const timeKey = bill.date;
    
    if (!groups.has(timeKey)) {
      groups.set(timeKey, []);
    }
    groups.get(timeKey)!.push(bill);
  }
  
  // 返回有重复的组
  return Array.from(groups.values()).filter((group) => group.length > 1);
}

// 查找完全相同的记录（所有字段都相同）
export function findExactDuplicates(bills: BillRecord[]): BillRecord[][] {
  const groups = new Map<string, BillRecord[]>();
  
  for (const bill of bills) {
    // 使用关键字段作为 key
    const key = `${bill.date}|${bill.amount}|${bill.description}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(bill);
  }
  
  // 返回有重复的组
  return Array.from(groups.values()).filter((group) => group.length > 1);
}

// 查找相似记录（同一时间的类似金额）
export function findSimilarBills(
  bills: BillRecord[],
  threshold: number = 0.01
): BillRecord[][] {
  const groups: BillRecord[][] = [];
  
  for (const bill of bills) {
    // 跳过已分组的记录
    if (groups.flat().some((b) => b.id === bill.id)) continue;
    
    const similar: BillRecord[] = [bill];
    
    for (const other of bills) {
      if (bill.id === other.id) continue;
      if (groups.flat().some((b) => b.id === other.id)) continue;
      
      // 检查时间是否相同
      if (bill.date !== other.date) continue;
      
      // 检查金额是否接近（阈值范围内）
      const diff = Math.abs(bill.amount - other.amount);
      const ratio = diff / Math.max(bill.amount, other.amount);
      
      if (ratio <= threshold) {
        similar.push(other);
      }
    }
    
    if (similar.length > 1) {
      groups.push(similar);
    }
  }
  
  return groups;
}

// 从导入中移除重复记录
export function filterDuplicates(
  existingBills: BillRecord[],
  newBills: BillRecord[]
): BillRecord[] {
  const existingKeys = new Set(
    existingBills.map((b) => `${b.date}|${b.amount}|${b.description}`)
  );
  
  return newBills.filter(
    (bill) => !existingKeys.has(`${bill.date}|${bill.amount}|${bill.description}`)
  );
}

// 批量去重（保留最新创建的）
export function deduplicate(bills: BillRecord[]): BillRecord[] {
  const groups = findDuplicatesByTime(bills);
  
  if (groups.length === 0) return bills;
  
  const toRemove = new Set<string>();
  
  for (const group of groups) {
    // 按创建时间排序，保留最新的
    const sorted = group.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // 保留第一个，其余标记为删除
    for (let i = 1; i < sorted.length; i++) {
      toRemove.add(sorted[i].id);
    }
  }
  
  return bills.filter((bill) => !toRemove.has(bill.id));
}

// 计算去重统计
export function getDedupStats(bills: BillRecord[]): {
  totalBills: number;
  duplicateGroups: number;
  duplicateCount: number;
  afterDedup: number;
} {
  const groups = findDuplicatesByTime(bills);
  const duplicateCount = groups.reduce((sum, group) => sum + group.length - 1, 0);
  
  return {
    totalBills: bills.length,
    duplicateGroups: groups.length,
    duplicateCount,
    afterDedup: bills.length - duplicateCount,
  };
}
