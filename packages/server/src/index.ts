/**
 * MConnect V2 Server
 *
 * Bun-based backend for AI agent orchestration.
 * This is the main entry point for the server.
 */

import type { ServerWebSocket } from 'bun';
import { initializeAuth, handleAuthRoutes } from './auth/index.js';
import { getWSHub, type WebSocketData } from './ws/WSHub.js';
import {
  handleSessionRoutes,
  handlePresetRoutes,
  handleDeviceRoutes,
  handleFleetRoutes,
  handleTaskRoutes,
  handleAutopilotRoutes,
} from './api/index.js';
import { applyCorsHeaders, handleCorsPreflight } from './http/cors.js';
import { getAutopilotScheduler } from './scheduler/Autopilot.js';
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

// Boot the autopilot scheduler so saved schedules fire on time.
getAutopilotScheduler().start();

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

// Get WebSocket hub instance
const wsHub = getWSHub();

type BunServer = Parameters<NonNullable<Parameters<typeof Bun.serve<WebSocketData>>[0]['fetch']>>[1];

async function routeRequest(
  request: Request,
  bunServer: BunServer,
  url: URL
): Promise<Response> {
  // WebSocket upgrade for /ws endpoint
  if (url.pathname === '/ws') {
    const clientId = crypto.randomUUID();
    const upgraded = bunServer.upgrade(request, {
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

  // Latency metrics endpoint
  if (url.pathname === '/metrics/latency') {
    return Response.json({
      websocket: wsHub.getLatencyMetrics(),
      timestamp: new Date().toISOString(),
    });
  }

  // API version info
  if (url.pathname === '/') {
    return Response.json({
      name: 'LeSearch Hub (MConnect V2 Server)',
      version: '0.1.0',
      endpoints: {
        health: '/health',
        ws: '/ws',
        auth: '/auth/*',
        sessions: '/sessions/*',
        presets: '/presets/*',
        agents: '/agents/*',
        devices: '/devices/*',
        fleet: '/fleet/*',
        tasks: '/tasks/*',
        autopilots: '/autopilots/*',
      },
    });
  }

  if (url.pathname.startsWith('/auth/')) {
    const authResponse = await handleAuthRoutes(request, url.pathname);
    if (authResponse) return authResponse;
  }

  if (url.pathname.startsWith('/sessions')) {
    const sessionResponse = await handleSessionRoutes(request, url.pathname);
    if (sessionResponse) return sessionResponse;
  }

  if (url.pathname.startsWith('/presets')) {
    const presetResponse = await handlePresetRoutes(request, url.pathname);
    if (presetResponse) return presetResponse;
  }

  if (url.pathname.startsWith('/devices')) {
    const deviceResponse = await handleDeviceRoutes(request, url.pathname);
    if (deviceResponse) return deviceResponse;
  }

  if (url.pathname.startsWith('/fleet')) {
    const fleetResponse = await handleFleetRoutes(request, url.pathname);
    if (fleetResponse) return fleetResponse;
  }

  if (url.pathname.startsWith('/tasks') || url.pathname.startsWith('/runtimes/')) {
    const taskResponse = await handleTaskRoutes(request, url.pathname);
    if (taskResponse) return taskResponse;
  }

  if (url.pathname.startsWith('/autopilots')) {
    const apResponse = await handleAutopilotRoutes(request, url.pathname);
    if (apResponse) return apResponse;
  }

  // 404 for unmatched routes
  return Response.json({ error: 'Not Found' }, { status: 404 });
}

const server = Bun.serve<WebSocketData>({
  port: PORT,
  hostname: HOST,

  async fetch(request: Request, bunServer): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight short-circuit so browser-origin clients (web UI hosted
    // on a different domain than the hub, embedded panels, etc.) can talk
    // to the hub. Allowed origins are configurable via LECODER_HUB_CORS_ORIGINS;
    // when unset the hub mirrors the request origin so localhost dev works.
    if (request.method === 'OPTIONS') {
      const preflight = handleCorsPreflight(request);
      if (preflight) return preflight;
    }

    const response = await routeRequest(request, bunServer, url);
    if (response === (undefined as unknown as Response)) {
      // WebSocket upgrade — Bun manages the response, no headers to add.
      return response;
    }
    return applyCorsHeaders(request, response);
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
