import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { WebSocketServer, WebSocket } from 'ws'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'websocket-server',
      configureServer(server) {
        const wss = new WebSocketServer({ noServer: true });
        
        const clients = new Map<string, WebSocket>();

        server.httpServer?.on('upgrade', (request, socket, head) => {
          if (request.url === '/ws') {
            wss.handleUpgrade(request, socket as any, head, (ws: WebSocket) => {
              wss.emit('connection', ws, request);
            });
          }
        });

        wss.on('connection', (ws: WebSocket) => {
          const clientId = Date.now().toString();
          clients.set(clientId, ws);

          ws.on('message', (data: any) => {
            try {
              const message = JSON.parse(data.toString());
              handleMessage(ws, message, clients);
            } catch (e) {
              console.error('Failed to parse message:', e);
            }
          });

          ws.on('close', () => {
            clients.delete(clientId);
          });
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
});

// 处理 WebSocket 消息
function handleMessage(ws: WebSocket, message: any, _clients: Map<string, WebSocket>) {
  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;
  }
}
