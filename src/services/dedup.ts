import { BillRecord } from '../types';
import type { ParseBillResult } from './ocr';

// 匹配结果类型
export interface MatchResult {
  newBill: ParseBillResult;
  existingBill?: BillRecord;
  matchType: 'exact' | 'fuzzy' | 'none';
  matchScore: number;
}

// 将新识别的账单与已有归档数据进行匹配
export function matchWithExistingBills(
  existingBills: BillRecord[],
  newBills: ParseBillResult[],
  mode: 'exact' | 'fuzzy' = 'exact',
  threshold: number = 0.05
): { matched: MatchResult[]; newOnly: MatchResult[] } {
  const matched: MatchResult[] = [];
  const newOnly: MatchResult[] = [];

  // 提取已有账单的关键信息用于快速比较
  const existingByDate = new Map<string, BillRecord[]>();
  for (const bill of existingBills) {
    const dateKey = bill.date.split('T')[0];
    if (!existingByDate.has(dateKey)) {
      existingByDate.set(dateKey, []);
    }
    existingByDate.get(dateKey)!.push(bill);
  }

  for (const newBill of newBills) {
    const newDateKey = newBill.date?.split('T')[0] || '';
    const existingOnDate = existingByDate.get(newDateKey) || [];

    let bestMatch: { bill: BillRecord; score: number; type: 'exact' | 'fuzzy' } | null = null;

    for (const existing of existingOnDate) {
      const score = calculateMatchScore(newBill, existing, mode, threshold);
      if (score >= 1.0) {
        // 精确匹配
        bestMatch = { bill: existing, score: 1.0, type: 'exact' };
        break; // 精确匹配直接结束
      } else if (mode === 'fuzzy' && score > threshold && (!bestMatch || score > bestMatch.score)) {
        // 模糊匹配
        bestMatch = { bill: existing, score, type: 'fuzzy' };
      }
    }

    if (bestMatch) {
      matched.push({
        newBill,
        existingBill: bestMatch.bill,
        matchType: bestMatch.type,
        matchScore: bestMatch.score,
      });
    } else {
      newOnly.push({
        newBill,
        existingBill: undefined,
        matchType: 'none',
        matchScore: 0,
      });
    }
  }

  return { matched, newOnly };
}

// 计算两条账单的匹配分数
function calculateMatchScore(
  newBill: ParseBillResult,
  existing: BillRecord,
  mode: 'exact' | 'fuzzy',
  threshold: number
): number {
  // 日期必须相同
  const newDateKey = newBill.date?.split('T')[0] || '';
  const existingDateKey = existing.date.split('T')[0];
  if (newDateKey !== existingDateKey) {
    return 0;
  }

  // 金额比较
  const amountDiff = Math.abs(newBill.amount - existing.amount);
  const amountRatio = amountDiff / Math.max(newBill.amount, existing.amount);

  if (mode === 'exact') {
    // 精确模式：金额必须完全相同
    if (amountRatio === 0) {
      return 1.0;
    }
    return 0;
  }

  // 模糊模式：金额差异在阈值范围内
  if (amountRatio <= threshold) {
    return 1.0 - amountRatio;
  }

  return 0;
}

// 根据匹配结果过滤账单（只保留新的）
export function filterMatchedBills(
  existingBills: BillRecord[],
  newBills: ParseBillResult[],
  mode: 'exact' | 'fuzzy' = 'exact',
  threshold: number = 0.05,
  keepMode: 'new_only' | 'all' = 'new_only'
): { filtered: ParseBillResult[]; matchStats: { total: number; duplicates: number; newCount: number } } {
  const { matched, newOnly } = matchWithExistingBills(existingBills, newBills, mode, threshold);

  const filtered = keepMode === 'new_only' ? newOnly.map(m => m.newBill) : newBills;

  return {
    filtered,
    matchStats: {
      total: newBills.length,
      duplicates: matched.length,
      newCount: newOnly.length,
    },
  };
}

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
