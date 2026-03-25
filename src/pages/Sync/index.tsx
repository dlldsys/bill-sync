import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Toast } from 'antd-mobile';
import BottomNav from '../../components/BottomNav';
import { useSyncStore } from '../../stores/syncStore';
import { useBillStore, useCategoryStore } from '../../stores';
import { requestSync, resolveConflict } from '../../services/sync';
import { formatDateTime, getDeviceId, getLocalIP } from '../../utils';
import type { ConflictRecord } from '../../types';

function SyncPage() {
  const navigate = useNavigate();
  const {
    connectedDevices,
    lastSyncTime,
    isSyncing,
    conflicts,
    setConnectedDevices,
  } = useSyncStore();
  
  const loadBills = useBillStore((state) => state.loadBills);
  const loadCategories = useCategoryStore((state) => state.loadCategories);
  const bills = useBillStore((state) => state.bills);
  const categories = useCategoryStore((state) => state.categories);

  const [showConflicts, setShowConflicts] = useState(false);
  const [syncMode, setSyncMode] = useState<'auto' | 'web' | 'mobile'>('auto');
  const [webServerPort] = useState('3847');
  const [localIP, setLocalIP] = useState('');

  // 检测是否为手机端
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // 获取本机 IP
  useEffect(() => {
    const getIP = async () => {
      const ip = await getLocalIP();
      setLocalIP(ip);
    };
    getIP();
  }, []);

  // 生成连接信息（供手机扫码）
  const getConnectionInfo = () => {
    // 获取当前页面所在设备的局域网地址
    // 在开发环境是 localhost:5173
    // 实际使用时需要用户输入本机 IP
    return {
      type: 'bill-sync',
      // 如果是本机服务，用 localhost；如果是远程，用实际 IP
      host: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? localIP || window.location.hostname 
        : window.location.hostname,
      port: webServerPort,
      url: `ws://${localIP || window.location.hostname}:${webServerPort}`,
    };
  };

  // 生成二维码数据
  const getQRData = () => {
    const info = getConnectionInfo();
    return JSON.stringify({
      type: 'bill-sync',
      host: info.host,
      port: parseInt(webServerPort),
    });
  };

  // 处理手动输入连接
  const handleManualConnect = async (ip: string, port: string) => {
    if (!ip) {
      Toast.show('请输入 IP 地址');
      return;
    }

    const wsUrl = `ws://${ip}:${port || '3847'}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        // 发送握手
        ws.send(JSON.stringify({
          type: 'handshake',
          payload: {
            deviceId: getDeviceId(),
            deviceName: '手机',
            deviceType: 'mobile',
          },
          timestamp: new Date().toISOString(),
        }));
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'handshake') {
            // 添加到已连接设备
            setConnectedDevices([...connectedDevices, {
              id: msg.payload?.deviceId || 'unknown',
              name: msg.payload?.deviceName || 'Web端',
              type: 'web',
            }]);
            Toast.show('连接成功');
          }
        } catch {}
      };

      ws.onerror = () => {
        Toast.show('连接失败');
      };

      ws.onclose = () => {
        // 从已连接设备中移除
        setConnectedDevices(connectedDevices.filter(d => d.type !== 'web'));
      };
    } catch {
      Toast.show('连接失败');
    }
  };

  // 同步
  const handleSync = async () => {
    try {
      await requestSync();
      await loadBills();
      await loadCategories();
      Toast.show('同步完成');
    } catch {
      Toast.show('同步失败');
    }
  };

  // 冲突解决
  const handleResolve = async (conflictId: string, strategy: 'local' | 'remote' | 'merge') => {
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    try {
      await resolveConflict(conflictId, strategy, conflict);
      await loadBills();
      Toast.show('冲突已解决');
    } catch {
      Toast.show('解决失败');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            ←
          </button>
          <h1>数据同步</h1>
        </div>
      </div>

      <div className="page-content">
        {/* 连接状态 */}
        <div className="stats-card">
          <div className="stats-title">
            {connectedDevices.length > 0 ? '已连接' : '未连接'}
          </div>
          <div className="stats-value">{connectedDevices.length} 台设备</div>
          {lastSyncTime && (
            <div className="stats-sub">最后同步: {formatDateTime(lastSyncTime)}</div>
          )}
        </div>

        {/* 冲突提示 */}
        {conflicts.length > 0 && (
          <div className="card" style={{ borderLeft: '4px solid #F4333C', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <span style={{ fontWeight: '600' }}>
                有 {conflicts.length} 条冲突待解决
              </span>
            </div>
            <button
              className="btn btn-outline"
              onClick={() => setShowConflicts(!showConflicts)}
            >
              {showConflicts ? '收起' : '查看并解决'}
            </button>
          </div>
        )}

        {/* 冲突列表 */}
        {showConflicts && conflicts.length > 0 && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px' }}>
              冲突列表
            </div>
            {conflicts.map((conflict) => (
              <div
                key={conflict.id}
                style={{
                  padding: '12px',
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  marginBottom: '8px',
                }}
              >
                <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                  类型: {conflict.entityType === 'bill' ? '账单' : '分类'}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-outline"
                    style={{ flex: 1, padding: '8px' }}
                    onClick={() => handleResolve(conflict.id, 'local')}
                  >
                    保留本地
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{ flex: 1, padding: '8px' }}
                    onClick={() => handleResolve(conflict.id, 'remote')}
                  >
                    保留远程
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '8px' }}
                    onClick={() => handleResolve(conflict.id, 'merge')}
                  >
                    合并
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {isMobile ? (
          /* 手机端：扫码连接 Web */
          <>
            {/* 二维码扫描区域 */}
            <div className="card">
              <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>
                扫码连接 Web 端
              </div>
              <div style={{ 
                background: '#f5f5f5', 
                borderRadius: '12px', 
                padding: '24px',
                textAlign: 'center',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📱</div>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  在 Web 端打开「数据同步」页面<br/>
                  扫描显示的二维码
                </div>
              </div>
            </div>

            {/* 手动输入 */}
            <div className="card">
              <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>
                或手动输入 Web 地址
              </div>
              <div className="form-group">
                <label className="form-label">Web 端 IP</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="例如: 192.168.1.100"
                  id="web-ip"
                />
              </div>
              <button
                className="btn btn-primary btn-block"
                onClick={() => {
                  const ipInput = document.getElementById('web-ip') as HTMLInputElement;
                  handleManualConnect(ipInput.value, webServerPort);
                }}
              >
                连接
              </button>
            </div>
          </>
        ) : (
          /* Web 端：启动服务，显示二维码 */
          <>
            {/* 服务状态 */}
            <div className="card">
              <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>
                Web 端服务
              </div>
              
              {/* 连接信息 */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                  手机扫码连接
                </div>
                <div style={{ 
                  background: 'white', 
                  borderRadius: '12px', 
                  padding: '20px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <QRCodeSVG 
                    value={getQRData()} 
                    size={180}
                    level="M"
                    includeMargin={true}
                  />
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {localIP}:{webServerPort}
                  </div>
                </div>
              </div>

              {/* 服务说明 */}
              <div style={{ 
                background: '#f5f5f5', 
                borderRadius: '8px', 
                padding: '12px',
                fontSize: '13px',
                color: '#666'
              }}>
                <div style={{ fontWeight: '500', marginBottom: '4px' }}>使用说明：</div>
                <ol style={{ margin: 0, paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '4px' }}>在手机上打开此 App</li>
                  <li style={{ marginBottom: '4px' }}>进入「数据同步」页面</li>
                  <li>使用相机扫描左侧二维码</li>
                </ol>
              </div>
            </div>

            {/* 已连接设备 */}
            {connectedDevices.length > 0 && (
              <div className="card">
                <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px' }}>
                  已连接设备
                </div>
                {connectedDevices.map((device, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px',
                      background: '#f5f5f5',
                      borderRadius: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <span style={{ fontSize: '24px', marginRight: '12px' }}>
                      {device.type === 'mobile' ? '📱' : '💻'}
                    </span>
                    <div>
                      <div style={{ fontWeight: '500' }}>{device.name}</div>
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        {device.type === 'mobile' ? '手机' : '电脑'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 同步操作 */}
            <div className="card">
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                  同步模式
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={`btn ${syncMode === 'auto' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1 }}
                    onClick={() => setSyncMode('auto')}
                  >
                    自动同步
                  </button>
                  <button
                    className={`btn ${syncMode === 'web' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1 }}
                    onClick={() => setSyncMode('web')}
                  >
                    以 Web 为主
                  </button>
                  <button
                    className={`btn ${syncMode === 'mobile' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1 }}
                    onClick={() => setSyncMode('mobile')}
                  >
                    以手机为主
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleSync}
                  disabled={isSyncing || connectedDevices.length === 0}
                >
                  {isSyncing ? '同步中...' : '同步数据'}
                </button>
              </div>

              {/* 统计 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
                <div style={{ textAlign: 'center', padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{bills.length}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>本地账单</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{categories.length}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>本地分类</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

export default SyncPage;
