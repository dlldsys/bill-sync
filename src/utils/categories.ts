import { Category } from '../types';
import { generateId, now, getDeviceId } from '../utils';

const deviceId = getDeviceId();
const defaultTime = now();

// 默认分类列表
export const defaultCategories: Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'deviceId' | 'syncVersion'>[] = [
  // 支出分类
  { name: '餐饮', icon: '🍜', color: '#FF6B6B', type: 'expense', isDefault: true },
  { name: '购物', icon: '🛒', color: '#4ECDC4', type: 'expense', isDefault: true },
  { name: '交通', icon: '🚗', color: '#45B7D1', type: 'expense', isDefault: true },
  { name: '娱乐', icon: '🎬', color: '#96CEB4', type: 'expense', isDefault: true },
  { name: '医疗', icon: '💊', color: '#DDA0DD', type: 'expense', isDefault: true },
  { name: '通讯', icon: '📱', color: '#98D8C8', type: 'expense', isDefault: true },
  { name: '住房', icon: '🏠', color: '#F7DC6F', type: 'expense', isDefault: true },
  { name: '教育', icon: '📚', color: '#BB8FCE', type: 'expense', isDefault: true },
  // 收入分类
  { name: '工资', icon: '💰', color: '#58D68D', type: 'income', isDefault: true },
  { name: '奖金', icon: '🎁', color: '#F39C12', type: 'income', isDefault: true },
  { name: '投资', icon: '📈', color: '#3498DB', type: 'income', isDefault: true },
  { name: '其他', icon: '📦', color: '#85929E', type: 'expense', isDefault: true },
];

// 创建完整分类对象
export function createDefaultCategories(): Category[] {
  return defaultCategories.map((cat) => ({
    ...cat,
    id: generateId(),
    createdAt: defaultTime,
    updatedAt: defaultTime,
    deviceId,
    syncVersion: 1,
  }));
}

// 获取分类颜色
export function getCategoryColor(categoryId: string, categories: Category[]): string {
  const category = categories.find((c) => c.id === categoryId);
  return category?.color || '#85929E';
}

// 获取分类图标
export function getCategoryIcon(categoryId: string, categories: Category[]): string {
  const category = categories.find((c) => c.id === categoryId);
  return category?.icon || '📦';
}

// 获取分类名称
export function getCategoryName(categoryId: string, categories: Category[]): string {
  const category = categories.find((c) => c.id === categoryId);
  return category?.name || '未分类';
}
