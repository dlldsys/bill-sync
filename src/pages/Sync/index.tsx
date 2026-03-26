import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Toast } from 'antd-mobile';
import BottomNav from '../../components/BottomNav';
import { useSyncStore } from '../../stores/syncStore';
import { useBillStore, useCategoryStore } from '../../stores';
import { requestSync, resolveConflict } from '../../services/sync';
import { formatDateTime, getDeviceId, getLocalIP } from '../../utils';

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
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manualIP, setManualIP] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  // 启动摄像头扫描
  const startScanner = async () => {
    try {
      // 检查是否支持 BarcodeDetector
      if (!('BarcodeDetector' in window)) {
        Toast.show('您的浏览器不支持二维码扫描，请使用手动输入');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setShowScanner(true);
        setScanning(true);
        
        // 开始检测二维码
        detectQRCode();
      }
    } catch (error) {
      console.error('Camera error:', error);
      Toast.show('无法访问摄像头，请检查权限设置');
    }
  };

  // 停止摄像头
  const stopScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowScanner(false);
    setScanning(false);
  };

  // 检测二维码
  const detectQRCode = async () => {
    if (!scanning || !videoRef.current) return;

    try {
      // @ts-ignore - BarcodeDetector 可能不在 TypeScript 类型定义中
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      
      const detect = async () => {
        if (!scanning || !videoRef.current) return;
        
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const data = barcodes[0].rawValue;
            handleQRCodeData(data);
            return;
          }
        } catch (e) {
          // 检测失败，继续尝试
        }
        
        // 继续检测
        requestAnimationFrame(detect);
      };
      
      detect();
    } catch (error) {
      console.error('Detection error:', error);
      Toast.show('二维码检测失败，请使用手动输入');
      stopScanner();
    }
  };

  // 处理二维码数据
  const handleQRCodeData = (data: string) => {
    stopScanner();
    
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'bill-sync' && parsed.host && parsed.port) {
        handleManualConnect(parsed.host, String(parsed.port));
      } else {
        Toast.show('无效的二维码');
      }
    } catch {
      // 如果不是 JSON，尝试直接作为 IP:端口
      const match = data.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
      if (match) {
        handleManualConnect(match[1], match[2]);
      } else {
        Toast.show('无效的二维码格式');
      }
    }
  };

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
        } catch {
          // 忽略错误
        }
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
            {/* 扫码界面 */}
            {showScanner ? (
              <div className="card" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '15px', fontWeight: '600' }}>
                    扫描二维码
                  </div>
                  <button
                    className="btn btn-outline"
                    style={{ padding: '4px 12px', fontSize: '12px' }}
                    onClick={stopScanner}
                  >
                    取消
                  </button>
                </div>
                <div style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '1',
                  background: '#000',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}>
                  <video
                    ref={videoRef}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    playsInline
                    muted
                  />
                  {/* 扫描框 */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '200px',
                    height: '200px',
                    border: '2px solid #667eea',
                    borderRadius: '12px',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '20px',
                      height: '20px',
                      borderTop: '4px solid #667eea',
                      borderLeft: '4px solid #667eea',
                      borderRadius: '4px 0 0 0',
                    }} />
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '20px',
                      height: '20px',
                      borderTop: '4px solid #667eea',
                      borderRight: '4px solid #667eea',
                      borderRadius: '0 4px 0 0',
                    }} />
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: '20px',
                      height: '20px',
                      borderBottom: '4px solid #667eea',
                      borderLeft: '4px solid #667eea',
                      borderRadius: '0 0 0 4px',
                    }} />
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: '20px',
                      height: '20px',
                      borderBottom: '4px solid #667eea',
                      borderRight: '4px solid #667eea',
                      borderRadius: '0 0 4px 0',
                    }} />
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', color: '#666' }}>
                  将二维码放入框内即可自动扫描
                </div>
              </div>
            ) : (
              <>
                {/* 扫码按钮 */}
                <div className="card">
                  <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>
                    扫码连接 Web 端
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '16px', fontSize: '16px' }}
                    onClick={startScanner}
                  >
                    <span style={{ marginRight: '8px' }}>📷</span>
                    扫描二维码
                  </button>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '8px', textAlign: 'center' }}>
                    在 Web 端「数据同步」页面显示二维码
                  </div>
                </div>

                {/* 手动输入 */}
                <div className="card" style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>
                    或手动输入 Web 地址
                  </div>
                  <div className="form-group">
                    <label className="form-label">Web 端 IP</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="例如: 192.168.1.100"
                      value={manualIP}
                      onChange={(e) => setManualIP(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn btn-primary btn-block"
                    onClick={() => handleManualConnect(manualIP, webServerPort)}
                  >
                    连接
                  </button>
                </div>
              </>
            )}
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
                  disabled={isSyncing || connectedDevices.length === 0}
                  onClick={handleSync}
                >
                  {isSyncing ? '同步中...' : '同步数据'}
                </button>
              </div>

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
