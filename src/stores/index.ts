import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BillRecord, Category } from '../types';
import { billOps, categoryOps } from '../services/database';
import { generateId, now, getDeviceId } from '../utils';

interface BillStore {
  bills: BillRecord[];
  loading: boolean;
  
  // Actions
  loadBills: () => Promise<void>;
  addBill: (bill: Omit<BillRecord, 'id' | 'createdAt' | 'updatedAt' | 'deviceId' | 'syncVersion' | 'syncState'>) => Promise<string>;
  updateBill: (id: string, changes: Partial<BillRecord>) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  getBillsByDate: (date: string) => BillRecord[];
  getBillsByCategory: (categoryId: string) => BillRecord[];
  importBills: (bills: BillRecord[]) => Promise<void>;
}

export const useBillStore = create<BillStore>()(
  persist(
    (set, get) => ({
      bills: [],
      loading: false,

      loadBills: async () => {
        set({ loading: true });
        try {
          const bills = await billOps.getAll();
          set({ bills: bills.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
        } finally {
          set({ loading: false });
        }
      },

      addBill: async (billData) => {
        const deviceId = getDeviceId();
        const newBill: BillRecord = {
          ...billData,
          id: generateId(),
          deviceId,
          syncVersion: 1,
          syncState: 'pending',
          createdAt: now(),
          updatedAt: now(),
        };
        
        await billOps.add(newBill);
        set((state) => ({
          bills: [newBill, ...state.bills].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          ),
        }));
        
        return newBill.id;
      },

      updateBill: async (id, changes) => {
        const bill = get().bills.find((b) => b.id === id);
        if (!bill) return;
        
        const updatedBill = {
          ...changes,
          updatedAt: now(),
          syncVersion: bill.syncVersion + 1,
          syncState: 'pending' as const,
        };
        
        await billOps.update(id, updatedBill);
        set((state) => ({
          bills: state.bills.map((b) =>
            b.id === id ? { ...b, ...updatedBill } : b
          ),
        }));
      },

      deleteBill: async (id) => {
        await billOps.delete(id);
        set((state) => ({
          bills: state.bills.filter((b) => b.id !== id),
        }));
      },

      getBillsByDate: (date) => {
        return get().bills.filter((b) => b.date.startsWith(date));
      },

      getBillsByCategory: (categoryId) => {
        return get().bills.filter((b) => b.category === categoryId);
      },

      importBills: async (newBills) => {
        await billOps.bulkAdd(newBills);
        await get().loadBills();
      },
    }),
    {
      name: 'bill-storage',
      partialize: (state) => ({ bills: state.bills }),
    }
  )
);

// 分类 Store
interface CategoryStore {
  categories: Category[];
  loading: boolean;
  
  loadCategories: () => Promise<void>;
  addCategory: (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'deviceId' | 'syncVersion' | 'isDefault'>) => Promise<string>;
  updateCategory: (id: string, changes: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useCategoryStore = create<CategoryStore>()(
  persist(
    (set, get) => ({
      categories: [],
      loading: false,

      loadCategories: async () => {
        set({ loading: true });
        try {
          const categories = await categoryOps.getAll();
          set({ categories });
        } finally {
          set({ loading: false });
        }
      },

      addCategory: async (categoryData) => {
        const deviceId = getDeviceId();
        const newCategory: Category = {
          ...categoryData,
          id: generateId(),
          deviceId,
          isDefault: false,
          syncVersion: 1,
          createdAt: now(),
          updatedAt: now(),
        };
        
        await categoryOps.add(newCategory);
        set((state) => ({
          categories: [...state.categories, newCategory],
        }));
        
        return newCategory.id;
      },

      updateCategory: async (id, changes) => {
        const category = get().categories.find((c) => c.id === id);
        if (!category) return;
        
        const updatedCategory = {
          ...changes,
          updatedAt: now(),
          syncVersion: category.syncVersion + 1,
        };
        
        await categoryOps.update(id, updatedCategory);
        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id ? { ...c, ...updatedCategory } : c
          ),
        }));
      },

      deleteCategory: async (id) => {
        const category = get().categories.find((c) => c.id === id);
        if (category?.isDefault) {
          throw new Error('Cannot delete default category');
        }
        
        await categoryOps.delete(id);
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
        }));
      },
    }),
    {
      name: 'category-storage',
      partialize: (state) => ({ categories: state.categories }),
    }
  )
);
