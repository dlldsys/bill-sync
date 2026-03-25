import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd-mobile';
import zhCN from 'antd-mobile/es/locales/en-US';

// 页面组件
import HomePage from './pages/Home';
import ImportPage from './pages/Import';
import ManualEntryPage from './pages/ManualEntry';
import AnalysisPage from './pages/Analysis';
import CategoriesPage from './pages/Categories';
import SettingsPage from './pages/Settings';
import SyncPage from './pages/Sync';

// 样式
import './App.css';

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
      <BrowserRouter>
        <div className="app">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/manual" element={<ManualEntryPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/sync" element={<SyncPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
