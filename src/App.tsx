import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd-mobile';
import zhCN from 'antd-mobile/es/locales/en-US';

// 页面组件
import HomePage from './pages/Home';
import ImportPage from './pages/Import';
import ManualEntryPage from './pages/ManualEntry';
import EditBillPage from './pages/EditBill';
import AnalysisPage from './pages/Analysis';
import CategoriesPage from './pages/Categories';
import SettingsPage from './pages/Settings';
import SyncPage from './pages/Sync';
import CategoryRulesPage from './pages/CategoryRules';

// 样式
import './App.css';
import { ToastProvider } from './components/CustomToast';

// 初始化数据库
import { initDatabase } from './services/database';
import { useBillStore, useCategoryStore } from './stores';

function App() {
  const loadBills = useBillStore((state) => state.loadBills);
  const loadCategories = useCategoryStore((state) => state.loadCategories);

  useEffect(() => {
    // 初始化数据库
    initDatabase().then(() => {
      loadBills();
      loadCategories();
    });
  }, [loadBills, loadCategories]);

  return (
    <ConfigProvider locale={zhCN}>
      <ToastProvider>
        <BrowserRouter>
          <div className="app">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/manual" element={<ManualEntryPage />} />
              <Route path="/edit/:id" element={<EditBillPage />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/sync" element={<SyncPage />} />
              <Route path="/category-rules" element={<CategoryRulesPage />} />
            </Routes>
          </div>
        </BrowserRouter>
      </ToastProvider>
    </ConfigProvider>
  );
}

export default App;
