import React from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../../components/BottomNav';

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
  {
    icon: '💾',
    title: '备份与恢复',
    description: '导出或导入账单数据',
    path: '/settings',
  },
];

function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="page">
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

        {/* 版本信息 */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '40px',
            color: '#999',
            fontSize: '12px',
          }}
        >
          <div>BillSync v1.0.0</div>
          <div style={{ marginTop: '4px' }}>
            账单同步 - 数据不出外网
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

export default SettingsPage;
