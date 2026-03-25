import { v4 as uuidv4 } from 'uuid';

// 生成 UUID
export function generateId(): string {
  return uuidv4();
}

// 获取设备 ID
export function getDeviceId(): string {
  const key = 'bill-sync-device-id';
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

// 获取设备名称
export function getDeviceName(): string {
  const key = 'bill-sync-device-name';
  let deviceName = localStorage.getItem(key);
  if (!deviceName) {
    deviceName = navigator.userAgent.includes('Mobile') ? '手机' : '电脑';
    localStorage.setItem(key, deviceName);
  }
  return deviceName;
}

// 获取本机局域网 IP
export async function getLocalIP(): Promise<string> {
  return new Promise((resolve) => {
    // 尝试通过 WebRTC 获取本地 IP
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const candidate = e.candidate.candidate;
        const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (ipMatch && !ipMatch[1].startsWith('0.')) {
          resolve(ipMatch[1]);
          pc.close();
        }
      };
      pc.createOffer().then((offer) => pc.setLocalDescription(offer));
      
      // 5秒超时
      setTimeout(() => {
        pc.close();
        resolve('127.0.0.1');
      }, 5000);
    } catch {
      resolve('127.0.0.1');
    }
  });
}

// 格式化金额
export function formatAmount(amount: number): string {
  return `¥${amount.toFixed(2)}`;
}

// 格式化日期
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// 格式化时间
export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 获取当前 ISO 时间
export function now(): string {
  return new Date().toISOString();
}

// 获取今天日期（不含时间）
export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

// 判断是否是移动端
export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// 检测平台
export function detectPlatform(): 'mobile' | 'web' {
  // Capacitor 环境
  if (typeof window !== 'undefined' && window.location.protocol === 'capacitor:') {
    return 'mobile';
  }
  // 移动端 User Agent
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    return 'mobile';
  }
  return 'web';
}

// 文件转 Base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 复制到剪贴板
export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

// 下载文件
export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 防抖
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
