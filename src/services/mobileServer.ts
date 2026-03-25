import { BillRecord, Category, SyncMessage, DeviceInfo, ConflictRecord } from '../types';
import { billOps, categoryOps } from './database';
import { now, getDeviceId, getDeviceName } from '../utils';

// 手机端 WebSocket 服务器管理
interface ConnectedClient {
  id: string;
  deviceInfo: DeviceInfo;
  onMessage: (message: SyncMessage) => void;
}

const connectedClients: Map<string, ConnectedClient> = new Map();
let serverPort: number = 3847;

// 启动服务器（手机端使用原生插件实现，这里仅用于类型提示）
export async function startServer(port: number = 3847): Promise<{
  success: boolean;
  port: number;
  error?: string;
}> {
  serverPort = port;
  // 实际实现需要通过 Capacitor 原生插件
  return { success: true, port };
}

// 停止服务器
export function stopServer(): void {
  connectedClients.clear();
}

// 获取连接状态
export function getServerStatus(): {
  running: boolean;
  clients: number;
  port: number;
} {
  return {
    running: connectedClients.size > 0,
    clients: connectedClients.size,
    port: serverPort,
  };
}

// 注册客户端（手机端调用）
export function registerClient(
  clientId: string,
  deviceInfo: DeviceInfo,
  onMessage: (message: SyncMessage) => void
): void {
  connectedClients.set(clientId, {
    id: clientId,
    deviceInfo,
    onMessage,
  });
}

// 注销客户端
export function unregisterClient(clientId: string): void {
  connectedClients.delete(clientId);
}

// 发送消息给指定客户端
export function sendToClient(clientId: string, message: SyncMessage): void {
  const client = connectedClients.get(clientId);
  if (client) {
    client.onMessage(message);
  }
}

// 广播消息给所有客户端
export function broadcastToClients(message: SyncMessage): void {
  connectedClients.forEach((client) => {
    client.onMessage(message);
  });
}

// 处理握手请求
export function handleHandshake(clientId: string, payload: { deviceId: string; deviceName: string; deviceType: 'mobile' | 'web' }): SyncMessage {
  const deviceInfo: DeviceInfo = {
    id: payload.deviceId,
    name: payload.deviceName,
    type: payload.deviceType,
  };

  registerClient(clientId, deviceInfo, () => {});

  return {
    type: 'handshake',
    payload: {
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
      deviceType: 'mobile',
    },
    timestamp: now(),
  };
}

// 处理同步请求
export async function handleSyncRequest(clientId: string, payload: { bills?: BillRecord[]; categories?: Category[] }): Promise<void> {
  const client = connectedClients.get(clientId);
  if (!client) return;

  // 处理来自客户端的数据
  await handleIncomingSync(payload);

  // 发送本地数据给客户端
  const localBills = await billOps.getAllWithDeleted();
  const localCategories = await categoryOps.getAllWithDeleted();

  sendToClient(clientId, {
    type: 'sync',
    payload: {
      bills: localBills,
      categories: localCategories,
    },
    timestamp: now(),
  });
}

// 处理来自客户端的数据
async function handleIncomingSync(payload: { bills?: BillRecord[]; categories?: Category[] }): Promise<void> {
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

// 处理冲突解决
export async function handleConflictResolution(clientId: string, conflict: ConflictRecord): Promise<void> {
  if (conflict.entityType === 'bill') {
    await billOps.update(conflict.entityId, conflict.localVersion as BillRecord);
  } else {
    await categoryOps.update(conflict.entityId, conflict.localVersion as Category);
  }

  // 广播给所有客户端
  broadcastToClients({
    type: 'resolved',
    payload: { conflictId: conflict.id, resolved: conflict.localVersion },
    timestamp: now(),
  });
}

// 导出连接列表
export function getConnectedClients(): DeviceInfo[] {
  return Array.from(connectedClients.values()).map((c) => c.deviceInfo);
}

// 主动推送数据给客户端
export async function pushToClients(): Promise<void> {
  const bills = await billOps.getAllWithDeleted();
  const categories = await categoryOps.getAllWithDeleted();

  broadcastToClients({
    type: 'sync',
    payload: { bills, categories },
    timestamp: now(),
  });
}
