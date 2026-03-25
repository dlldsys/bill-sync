import { Capacitor } from '@capacitor/core';

// 平台检测
export const isMobile = Capacitor.isNativePlatform();

// 获取本机局域网 IP
export async function getLocalIP(): Promise<string> {
  if (!isMobile) {
    return '127.0.0.1';
  }

  // 在 Capacitor 环境中，通过原生接口获取 IP
  try {
    // 在 Capacitor 环境中，通过原生接口获取 IP
    const result = await (window as any).Capacitor?.Plugins?.Network?.getIP?.();
    return result?.ip || '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

// 启动本地服务器（移动端）
export async function startLocalServer(port: number = 3847): Promise<{
  success: boolean;
  ip?: string;
  port?: number;
  error?: string;
}> {
  if (!isMobile) {
    // Web 端不需要启动服务器
    return { success: true };
  }

  try {
    // 在实际实现中，这里会调用原生插件
    const result = await (window as any).Capacitor?.Plugins?.Server?.start?.({
      port,
    });
    return {
      success: true,
      ip: result?.ip,
      port: result?.port,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '启动服务器失败',
    };
  }
}

// 停止本地服务器
export async function stopLocalServer(): Promise<void> {
  if (!isMobile) return;

  try {
    await (window as any).Capacitor?.Plugins?.Server?.stop?.();
  } catch (e) {
    console.error('Stop server error:', e);
  }
}

// 获取服务器状态
export async function getServerStatus(): Promise<{
  running: boolean;
  ip?: string;
  port?: number;
  connections?: number;
}> {
  if (!isMobile) {
    return { running: false };
  }

  try {
    const result = await (window as any).Capacitor?.Plugins?.Server?.status?.();
    return result || { running: false };
  } catch {
    return { running: false };
  }
}
