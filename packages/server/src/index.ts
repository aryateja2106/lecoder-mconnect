/**
 * MConnect V2 Server
 *
 * Bun-based backend for AI agent orchestration.
 * This is the main entry point for the server.
 */

import type { ServerWebSocket } from 'bun';
import { initializeAuth, handleAuthRoutes } from './auth/index.js';
import { getWSHub, type WebSocketData } from './ws/WSHub.js';
import { handleSessionRoutes, handlePresetRoutes, handleDeviceRoutes } from './api/index.js';
import { initializePushService } from './notifications/PushService.js';
import { initializeNotificationBridge } from './notifications/NotificationBridge.js';

// Initialize modules
initializeAuth();

// Initialize push notifications (non-blocking, gracefully disabled if APNs not configured)
initializePushService().then(() => {
  initializeNotificationBridge();
}).catch((error) => {
  console.warn('Push notification initialization failed:', error);
});

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

// Get WebSocket hub instance
const wsHub = getWSHub();

const server = Bun.serve<WebSocketData>({
  port: PORT,
  hostname: HOST,

  async fetch(request: Request, server): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade for /ws endpoint
    if (url.pathname === '/ws') {
      const clientId = crypto.randomUUID();
      const upgraded = server.upgrade(request, {
        data: {
          clientId,
          createdAt: Date.now(),
        },
      });

      if (!upgraded) {
        return new Response('WebSocket upgrade failed', { status: 400 });
      }

      // Return undefined for successful upgrade (Bun handles the response)
      return undefined as unknown as Response;
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        connections: wsHub.getClientCount(),
        authenticated: wsHub.getAuthenticatedClientCount(),
      });
    }

    // API version info
    if (url.pathname === '/') {
      return Response.json({
        name: 'MConnect V2 Server',
        version: '0.1.0',
        endpoints: {
          health: '/health',
          ws: '/ws',
          auth: '/auth/*',
          sessions: '/sessions/*',
          presets: '/presets/*',
          agents: '/agents/*',
          devices: '/devices/*',
        },
      });
    }

    // Auth routes
    if (url.pathname.startsWith('/auth/')) {
      const authResponse = await handleAuthRoutes(request, url.pathname);
      if (authResponse) {
        return authResponse;
      }
    }

    // Session routes
    if (url.pathname.startsWith('/sessions')) {
      const sessionResponse = await handleSessionRoutes(request, url.pathname);
      if (sessionResponse) {
        return sessionResponse;
      }
    }

    // Preset routes
    if (url.pathname.startsWith('/presets')) {
      const presetResponse = await handlePresetRoutes(request, url.pathname);
      if (presetResponse) {
        return presetResponse;
      }
    }

    // Device routes (push notification tokens)
    if (url.pathname.startsWith('/devices')) {
      const deviceResponse = await handleDeviceRoutes(request, url.pathname);
      if (deviceResponse) {
        return deviceResponse;
      }
    }

    // 404 for unmatched routes
    return Response.json({ error: 'Not Found' }, { status: 404 });
  },

  websocket: {
    // Maximum message size (1MB)
    maxPayloadLength: 1024 * 1024,
    // Idle timeout (2 minutes)
    idleTimeout: 120,

    open(ws: ServerWebSocket<WebSocketData>) {
      wsHub.handleConnection(ws);
    },

    async message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
      await wsHub.handleMessage(ws, message);
    },

    close(ws: ServerWebSocket<WebSocketData>) {
      wsHub.handleClose(ws);
    },

    drain(_ws: ServerWebSocket<WebSocketData>) {
      // Handle backpressure - called when socket is ready for more data
      // Currently no special handling needed
    },
  },
});

console.log(`🚀 MConnect V2 Server running at http://${HOST}:${PORT}`);
console.log(`📡 WebSocket endpoint: ws://${HOST}:${PORT}/ws`);

export { server, wsHub };
