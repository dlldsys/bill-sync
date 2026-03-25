import { categoryRuleOps, categoryOps } from './database';
import { Category, CategoryRule } from '../types';
import { generateId, now, getDeviceId } from '../utils';

// 模糊匹配函数
function fuzzyMatch(text: string, keyword: string, matchType: 'contains' | 'regex'): boolean {
  if (!text || !keyword) return false;
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();

  if (matchType === 'contains') {
    return lowerText.includes(lowerKeyword);
  }
  // regex 模式
  try {
    const regex = new RegExp(keyword, 'i');
    return regex.test(text);
  } catch {
    return false;
  }
}

// 根据商家/描述自动匹配分类
export async function autoMatchCategory(
  merchant: string,
  description: string
): Promise<{ categoryId: string; category: Category } | null> {
  const rules = await categoryRuleOps.getEnabled();
  if (rules.length === 0) return null;

  // 按优先级降序排列
  rules.sort((a, b) => b.priority - a.priority);

  for (const rule of rules) {
    const fieldValue = rule.matchField === 'merchant' ? merchant : description;
    if (fuzzyMatch(fieldValue, rule.keyword, rule.matchType)) {
      const category = await categoryOps.getById(rule.categoryId);
      if (category) {
        return {
          categoryId: rule.categoryId,
          category,
        };
      }
    }
  }
  return null;
}

// 添加规则
export async function addRule(
  rule: Omit<CategoryRule, 'id' | 'createdAt' | 'updatedAt' | 'deviceId' | 'syncVersion'>
): Promise<string> {
  const newRule: CategoryRule = {
    ...rule,
    id: generateId(),
    createdAt: now(),
    updatedAt: now(),
    deviceId: getDeviceId(),
    syncVersion: 1,
  };
  return categoryRuleOps.add(newRule);
}

// 更新规则
export async function updateRule(id: string, updates: Partial<CategoryRule>): Promise<void> {
  await categoryRuleOps.update(id, updates);
}

// 删除规则
export async function deleteRule(id: string): Promise<void> {
  await categoryRuleOps.delete(id);
}

// 获取所有规则
export async function getAllRules(): Promise<CategoryRule[]> {
  return categoryRuleOps.getAll();
}

// 获取启用的规则
export async function getEnabledRules(): Promise<CategoryRule[]> {
  return categoryRuleOps.getEnabled();
}

// 切换规则启用状态
export async function toggleRule(id: string): Promise<void> {
  await categoryRuleOps.toggleEnabled(id);
}
