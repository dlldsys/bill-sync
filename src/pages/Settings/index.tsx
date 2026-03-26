import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Toast, Dialog } from 'antd-mobile';
import BottomNav from '../../components/BottomNav';
import { exportAndDownload, importBackup, readBackupMetadata } from '../../services/backup';
import { useBillStore } from '../../stores';

const settingsItems = [
  {
    icon: '📱',
    title: '手机端操作',
    description: '打开手机 App 查看同步二维码',
    path: '/sync',
  },
  {
    icon: '📂',
    title: '分类管理',
    description: '编辑和管理消费分类',
    path: '/categories',
  },
  {
    icon: '🔧',
    title: '分类规则',
    description: '配置自动匹配规则，支持模糊匹配商家/描述',
    path: '/category-rules',
  },
];

function SettingsPage() {
  const navigate = useNavigate();
  const loadBills = useBillStore((state) => state.loadBills);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [showImportInfo, setShowImportInfo] = useState(false);
  const [importMeta, setImportMeta] = useState<{
    billCount: number;
    categoryCount: number;
    format: string;
  } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleExportBackup = async () => {
    try {
      await exportAndDownload();
      Toast.show('备份已导出为TXT文件');
    } catch (error) {
      console.error('Export failed:', error);
      Toast.show('导出失败');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const meta = await readBackupMetadata(file);
      setImportMeta({
        billCount: meta.billCount,
        categoryCount: meta.categoryCount,
        format: meta.format,
      });
      setPendingFile(file);
      setShowImportInfo(true);
    } catch (error) {
      console.error('Failed to read file:', error);
      Toast.show('读取文件失败');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async (mode: 'merge' | 'replace') => {
    if (!pendingFile) return;

    setImporting(true);
    try {
      const result = await importBackup(pendingFile, mode);
      Toast.show(`导入成功：${result.bills} 条账单，${result.categories} 个分类`);
      await loadBills();
      setShowImportInfo(false);
      setPendingFile(null);
    } catch (error) {
      console.error('Import failed:', error);
      Toast.show('导入失败');
    } finally {
      setImporting(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="page">
      {/* 隐藏的文件输入 */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".txt,.json"
        onChange={handleFileSelect}
      />
      {/* 头部 */}
      <div className="page-header">
        <h1>设置</h1>
      </div>

      {/* 内容 */}
      <div className="page-content">
        {settingsItems.map((item) => (
          <div
            key={item.path}
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() => navigate(item.path)}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '10px',
                background: 'rgba(10, 191, 202, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                marginRight: '14px',
              }}
            >
              {item.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: '500',
                  marginBottom: '2px',
                }}
              >
                {item.title}
              </div>
              <div style={{ fontSize: '13px', color: '#999' }}>
                {item.description}
              </div>
            </div>
            <div style={{ color: '#ccc', fontSize: '18px' }}>›</div>
          </div>
        ))}

        {/* 备份功能卡片 */}
        <div className="card" style={{ marginTop: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '16px',
          }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '10px',
                background: 'rgba(82, 196, 26, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                marginRight: '14px',
              }}
            >
              💾
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: '500',
                  marginBottom: '2px',
                }}
              >
                备份与恢复
              </div>
              <div style={{ fontSize: '13px', color: '#999' }}>
                导出/导入账单数据（TXT格式）
              </div>
            </div>
          </div>

          {/* 备份说明 */}
          <div style={{
            padding: '12px',
            background: '#f5f5f5',
            borderRadius: '8px',
            marginBottom: '12px',
            fontSize: '13px',
            color: '#666',
          }}>
            <div style={{ fontWeight: '500', marginBottom: '6px' }}>
              备份格式说明：
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: '1.8' }}>
              <li>导出为 TXT 文本文件，方便查看和编辑</li>
              <li>支持导入 TXT 格式备份</li>
              <li>兼容旧版 JSON 格式备份</li>
            </ul>
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              block
              color="primary"
              size="large"
              onClick={handleExportBackup}
            >
              导出TXT备份
            </Button>
            <Button
              block
              color="default"
              size="large"
              onClick={triggerFileInput}
              style={{ border: '1px solid #ddd' }}
            >
              导入备份
            </Button>
          </div>
        </div>

        {/* 版本信息 */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '40px',
            color: '#999',
            fontSize: '12px',
          }}
        >
          <div>BillSync v2.0.0</div>
          <div style={{ marginTop: '4px' }}>
            账单同步 - 数据不出外网
          </div>
        </div>
      </div>

      <BottomNav />

      {/* 导入确认弹窗 */}
      {showImportInfo && importMeta && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            width: '90%',
            maxWidth: '360px',
          }}>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              导入备份确认
            </div>

            <div style={{
              padding: '12px',
              background: '#f5f5f5',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>文件格式：</strong>{importMeta.format.toUpperCase()}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>账单数量：</strong>{importMeta.billCount} 条
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>分类数量：</strong>{importMeta.categoryCount} 个
              </div>
            </div>

            <div style={{
              padding: '12px',
              background: '#fff7e6',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#ad6800',
            }}>
              <strong>导入模式：</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={() => handleImport('merge')}
                disabled={importing}
                style={{
                  padding: '12px',
                  background: importing ? '#f5f5f5' : '#52c41a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: importing ? 'not-allowed' : 'pointer',
                }}
              >
                {importing ? '导入中...' : '合并导入（追加现有数据）'}
              </button>
              <button
                onClick={() => handleImport('replace')}
                disabled={importing}
                style={{
                  padding: '12px',
                  background: importing ? '#f5f5f5' : '#ff4d4f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: importing ? 'not-allowed' : 'pointer',
                }}
              >
                覆盖导入（清空现有数据）
              </button>
            </div>

            <button
              onClick={() => {
                setShowImportInfo(false);
                setPendingFile(null);
                setImportMeta(null);
              }}
              disabled={importing}
              style={{
                width: '100%',
                padding: '12px',
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
