import { create } from 'zustand';
import { ConflictRecord, ConnectionInfo, DeviceInfo } from '../types';

interface SyncStore {
  // 连接状态
  isConnected: boolean;
  isServerRunning: boolean;
  connectionInfo: ConnectionInfo | null;
  remoteDevice: DeviceInfo | null;
  connectedDevices: DeviceInfo[];
  
  // 同步状态
  lastSyncTime: string | null;
  isSyncing: boolean;
  pendingCount: number;
  
  // 冲突
  conflicts: ConflictRecord[];
  
  // 服务器信息
  serverIP: string;
  serverPort: number;
  
  // Actions
  setConnected: (connected: boolean) => void;
  setServerRunning: (running: boolean, ip?: string, port?: number) => void;
  setConnectionInfo: (info: ConnectionInfo | null) => void;
  setRemoteDevice: (device: DeviceInfo | null) => void;
  setConnectedDevices: (devices: DeviceInfo[]) => void;
  setLastSyncTime: (time: string | null) => void;
  setIsSyncing: (syncing: boolean) => void;
  setPendingCount: (count: number) => void;
  setConflicts: (conflicts: ConflictRecord[]) => void;
  addConflict: (conflict: ConflictRecord) => void;
  removeConflict: (id: string) => void;
  clearConflicts: () => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  isConnected: false,
  isServerRunning: false,
  connectionInfo: null,
  remoteDevice: null,
  connectedDevices: [],
  lastSyncTime: null,
  isSyncing: false,
  pendingCount: 0,
  conflicts: [],
  serverIP: '',
  serverPort: 3847,

  setConnected: (connected) => set({ isConnected: connected }),
  setServerRunning: (running, ip, port) => set((state) => ({
    isServerRunning: running,
    serverIP: ip ?? state.serverIP,
    serverPort: port ?? state.serverPort,
  })),
  setConnectionInfo: (info) => set({ connectionInfo: info }),
  setRemoteDevice: (device) => set({ remoteDevice: device }),
  setConnectedDevices: (devices) => set({ connectedDevices: devices }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),
  setIsSyncing: (syncing) => set({ isSyncing: syncing }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setConflicts: (conflicts) => set({ conflicts }),
  addConflict: (conflict) => set((state) => ({
    conflicts: [...state.conflicts, conflict],
  })),
  removeConflict: (id) => set((state) => ({
    conflicts: state.conflicts.filter((c) => c.id !== id),
  })),
  clearConflicts: () => set({ conflicts: [] }),
}));
