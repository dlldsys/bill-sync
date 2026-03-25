import { BillRecord, Category, SyncMessage, ConflictRecord, ConnectionInfo } from '../types';
import { billOps, categoryOps } from './database';
import { useSyncStore } from '../stores/syncStore';
import { now, getDeviceId, getDeviceName } from '../utils';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;

// 通用 WebSocket 连接（手机端和 Web 端共用）
export async function connect(url: string): Promise<void> {
  const syncStore = useSyncStore.getState();
  
  return new Promise((resolve, reject) => {
    try {
      ws = new WebSocket(url);
      
      ws.onopen = () => {
        // 发送握手消息
        const handshake: SyncMessage = {
          type: 'handshake',
          payload: {
            deviceId: getDeviceId(),
            deviceName: getDeviceName(),
            deviceType: isMobile() ? 'mobile' : 'web',
          },
          timestamp: now(),
        };
        ws?.send(JSON.stringify(handshake));
        
        syncStore.setConnected(true);
        startPing();
        resolve();
      };
      
      ws.onmessage = async (event) => {
        try {
          const message: SyncMessage = JSON.parse(event.data);
          await handleMessage(message);
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      ws.onclose = () => {
        syncStore.setConnected(false);
        stopPing();
        
        // 自动重连
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          const info = syncStore.connectionInfo;
          if (info) {
            connect(`ws://${info.ip}:${info.port}`);
          }
        }, 5000);
      };
    } catch (error) {
      reject(error);
    }
  });
}

// 连接远程服务器（Web 端作为客户端连接手机端）
export async function connectToServer(connectionInfo: ConnectionInfo): Promise<void> {
  const syncStore = useSyncStore.getState();
  syncStore.setConnectionInfo(connectionInfo);
  
  return connect(`ws://${connectionInfo.ip}:${connectionInfo.port}`);
}

// 断开连接
export function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  if (ws) {
    ws.close();
    ws = null;
  }
  
  const syncStore = useSyncStore.getState();
  syncStore.setConnected(false);
  syncStore.setRemoteDevice(null);
  syncStore.setConnectionInfo(null);
}

// 发送消息
function send(message: SyncMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// 处理接收到的消息
async function handleMessage(message: SyncMessage): Promise<void> {
  const syncStore = useSyncStore.getState();
  
  switch (message.type) {
    case 'handshake':
      if (message.payload) {
        const payload = message.payload as { deviceId: string; deviceName: string; deviceType: 'mobile' | 'web' };
        syncStore.setRemoteDevice({
          id: payload.deviceId,
          name: payload.deviceName,
          type: payload.deviceType,
        });
      }
      break;
      
    case 'sync':
      await handleSyncData(message.payload as { bills?: BillRecord[]; categories?: Category[] });
      syncStore.setLastSyncTime(now());
      break;
      
    case 'conflict':
      if (message.payload) {
        const conflicts = Array.isArray(message.payload) ? message.payload as ConflictRecord[] : [message.payload as ConflictRecord];
        conflicts.forEach((c: ConflictRecord) => syncStore.addConflict(c));
      }
      break;
      
    case 'resolved':
      if (message.payload) {
        const payload = message.payload as { conflictId: string };
        syncStore.removeConflict(payload.conflictId);
      }
      break;
      
    case 'ping':
      send({ type: 'pong', timestamp: now() });
      break;
      
    case 'pong':
      // 心跳响应，无需特殊处理
      break;
  }
}

// 处理同步数据
async function handleSyncData(payload: { bills?: BillRecord[]; categories?: Category[] }): Promise<void> {
  if (!payload) return;
  
  // 处理账单
  if (payload.bills) {
    for (const bill of payload.bills) {
      const localBill = await billOps.getById(bill.id);
      
      if (!localBill) {
        await billOps.add(bill);
      } else if (localBill.updatedAt !== bill.updatedAt) {
        const localTime = new Date(localBill.updatedAt).getTime();
        const remoteTime = new Date(bill.updatedAt).getTime();
        
        if (remoteTime > localTime) {
          await billOps.update(bill.id, bill);
        }
      }
    }
  }
  
  // 处理分类
  if (payload.categories) {
    await categoryOps.bulkUpdate(payload.categories);
  }
}

// 发送同步请求
export async function requestSync(): Promise<void> {
  const syncStore = useSyncStore.getState();
  syncStore.setIsSyncing(true);
  
  try {
    const localBills = await billOps.getAllWithDeleted();
    const localCategories = await categoryOps.getAllWithDeleted();
    
    send({
      type: 'sync',
      payload: {
        bills: localBills,
        categories: localCategories,
      },
      timestamp: now(),
    });
  } finally {
    syncStore.setIsSyncing(false);
  }
}

// 解决冲突
export async function resolveConflict(
  conflictId: string,
  strategy: 'local' | 'remote' | 'merge',
  conflict: ConflictRecord
): Promise<void> {
  const syncStore = useSyncStore.getState();
  
  let resolved: BillRecord | Category;
  
  switch (strategy) {
    case 'local':
      resolved = conflict.localVersion as BillRecord;
      break;
    case 'remote':
      resolved = conflict.remoteVersion as BillRecord;
      break;
    case 'merge':
      resolved = smartMerge(
        conflict.localVersion as BillRecord,
        conflict.remoteVersion as BillRecord
      );
      break;
  }
  
  // 更新本地数据
  if (conflict.entityType === 'bill') {
    await billOps.update(conflict.entityId, resolved as Partial<BillRecord>);
  } else {
    await categoryOps.update(conflict.entityId, resolved as Partial<Category>);
  }
  
  // 发送解决结果
  send({
    type: 'resolved',
    payload: { conflictId, resolved },
    timestamp: now(),
  });
  
  // 移除本地冲突记录
  syncStore.removeConflict(conflictId);
}

// 智能合并
function smartMerge(local: BillRecord, remote: BillRecord): BillRecord {
  const localTime = new Date(local.updatedAt).getTime();
  const remoteTime = new Date(remote.updatedAt).getTime();
  
  return {
    ...local,
    amount: remoteTime > localTime ? remote.amount : local.amount,
    description: remoteTime > localTime ? remote.description : local.description,
    category: remoteTime > localTime ? remote.category : local.category,
    date: remoteTime > localTime ? remote.date : local.date,
    updatedAt: now(),
    syncVersion: Math.max(local.syncVersion, remote.syncVersion) + 1,
  };
}

// 启动心跳
function startPing(): void {
  stopPing();
  pingTimer = setInterval(() => {
    send({ type: 'ping', timestamp: now() });
  }, 30000);
}

// 停止心跳
function stopPing(): void {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

// 获取连接状态
export function getConnectionState(): 'connected' | 'connecting' | 'disconnected' {
  if (!ws) return 'disconnected';
  switch (ws.readyState) {
    case WebSocket.CONNECTING:
      return 'connecting';
    case WebSocket.OPEN:
      return 'connected';
    default:
      return 'disconnected';
  }
}

// 判断是否是手机端
function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
