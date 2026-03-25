import Dexie, { Table } from 'dexie';
import { BillRecord, Category, SyncInfo } from '../types';
import { createDefaultCategories } from '../utils/categories';

// Web 端 IndexedDB 实现
class WebDatabase extends Dexie {
  bills!: Table<BillRecord, string>;
  categories!: Table<Category, string>;
  syncInfo!: Table<SyncInfo, string>;

  constructor() {
    super('BillSyncDB');
    this.version(1).stores({
      bills: 'id, category, date, syncState, createdAt',
      categories: 'id, name, isDefault',
      syncInfo: 'deviceId',
    });
  }

  async initDefaultData(): Promise<void> {
    const categoryCount = await this.categories.count();
    if (categoryCount === 0) {
      const defaultCats = createDefaultCategories();
      await this.categories.bulkAdd(defaultCats);
    }
  }
}

export const db = new WebDatabase();

// 初始化数据库
export async function initDatabase(): Promise<void> {
  await db.open();
  await db.initDefaultData();
}

// 账单操作
export const billOps = {
  async getAll(): Promise<BillRecord[]> {
    return db.bills.filter((b) => !b.deletedAt).toArray();
  },

  async getById(id: string): Promise<BillRecord | undefined> {
    return db.bills.get(id);
  },

  async add(bill: BillRecord): Promise<string> {
    return db.bills.add(bill);
  },

  async update(id: string, changes: Partial<BillRecord>): Promise<number> {
    return db.bills.update(id, { ...changes, updatedAt: new Date().toISOString() });
  },

  async delete(id: string): Promise<number> {
    // 软删除
    return db.bills.update(id, { deletedAt: new Date().toISOString() });
  },

  async hardDelete(id: string): Promise<void> {
    await db.bills.delete(id);
  },

  async getByDateRange(startDate: string, endDate: string): Promise<BillRecord[]> {
    return db.bills
      .filter((b) => !b.deletedAt && b.date >= startDate && b.date <= endDate)
      .toArray();
  },

  async getByCategory(categoryId: string): Promise<BillRecord[]> {
    return db.bills.filter((b) => !b.deletedAt && b.category === categoryId).toArray();
  },

  async getPending(): Promise<BillRecord[]> {
    return db.bills.filter((b) => b.syncState === 'pending').toArray();
  },

  async bulkAdd(bills: BillRecord[]): Promise<void> {
    await db.bills.bulkAdd(bills);
  },

  async bulkUpdate(bills: BillRecord[]): Promise<void> {
    await db.bills.bulkPut(bills);
  },

  async getAllWithDeleted(): Promise<BillRecord[]> {
    return db.bills.toArray();
  },
};

// 分类操作
export const categoryOps = {
  async getAll(): Promise<Category[]> {
    return db.categories.filter((c) => !c.deletedAt).toArray();
  },

  async getById(id: string): Promise<Category | undefined> {
    return db.categories.get(id);
  },

  async add(category: Category): Promise<string> {
    return db.categories.add(category);
  },

  async update(id: string, changes: Partial<Category>): Promise<number> {
    return db.categories.update(id, { ...changes, updatedAt: new Date().toISOString() });
  },

  async delete(id: string): Promise<number> {
    const category = await db.categories.get(id);
    if (category?.isDefault) {
      throw new Error('Cannot delete default category');
    }
    return db.categories.update(id, { deletedAt: new Date().toISOString() });
  },

  async bulkAdd(categories: Category[]): Promise<void> {
    await db.categories.bulkAdd(categories);
  },

  async bulkUpdate(categories: Category[]): Promise<void> {
    await db.categories.bulkPut(categories);
  },

  async getAllWithDeleted(): Promise<Category[]> {
    return db.categories.toArray();
  },
};

// 同步信息操作
export const syncOps = {
  async get(): Promise<SyncInfo | undefined> {
    return db.syncInfo.toCollection().first();
  },

  async save(info: SyncInfo): Promise<string> {
    const existing = await this.get();
    if (existing) {
      await db.syncInfo.update(existing.deviceId, info);
      return existing.deviceId;
    }
    return db.syncInfo.add(info);
  },

  async update(info: Partial<SyncInfo>): Promise<void> {
    const existing = await this.get();
    if (existing) {
      await db.syncInfo.update(existing.deviceId, info);
    }
  },

  async clear(): Promise<void> {
    await db.syncInfo.clear();
  },
};
