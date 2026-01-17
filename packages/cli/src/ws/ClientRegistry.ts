/**
 * Client Registry - Track connected WebSocket clients
 * MConnect v0.2.0
 *
 * Manages connected clients with heartbeat tracking
 */

import type { WebSocket } from 'ws';
import type { ClientType, Priority } from '../session/types.js';

export interface RegisteredClient {
  id: string;
  ws: WebSocket;
  clientType: ClientType;
  priority: Priority;
  sessionId: string | null;
  connectedAt: Date;
  lastHeartbeat: Date;
  userAgent?: string;
}

export interface ClientRegistryConfig {
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
}

const DEFAULT_CONFIG: Required<ClientRegistryConfig> = {
  heartbeatIntervalMs: 30000, // 30 seconds
  heartbeatTimeoutMs: 90000, // 90 seconds (3 missed heartbeats)
};

export class ClientRegistry {
  private clients: Map<string, RegisteredClient> = new Map();
  private config: Required<ClientRegistryConfig>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: ClientRegistryConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the heartbeat cleanup interval
   */
  startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleClients();
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Stop the heartbeat cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Register a new client
   */
  register(
    id: string,
    ws: WebSocket,
    clientType: ClientType,
    userAgent?: string
  ): RegisteredClient {
    const now = new Date();
    const client: RegisteredClient = {
      id,
      ws,
      clientType,
      priority: clientType === 'pc' ? 'high' : 'normal',
      sessionId: null,
      connectedAt: now,
      lastHeartbeat: now,
      userAgent,
    };

    this.clients.set(id, client);
    return client;
  }

  /**
   * Unregister a client
   */
  unregister(id: string): boolean {
    return this.clients.delete(id);
  }

  /**
   * Get a client by ID
   */
  get(id: string): RegisteredClient | undefined {
    return this.clients.get(id);
  }

  /**
   * Get all clients
   */
  getAll(): RegisteredClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get clients by session ID
   */
  getBySession(sessionId: string): RegisteredClient[] {
    return this.getAll().filter((client) => client.sessionId === sessionId);
  }

  /**
   * Get clients by type
   */
  getByType(clientType: ClientType): RegisteredClient[] {
    return this.getAll().filter((client) => client.clientType === clientType);
  }

  /**
   * Get PC clients for a session
   */
  getPcClients(sessionId: string): RegisteredClient[] {
    return this.getBySession(sessionId).filter((client) => client.clientType === 'pc');
  }

  /**
   * Get mobile clients for a session
   */
  getMobileClients(sessionId: string): RegisteredClient[] {
    return this.getBySession(sessionId).filter((client) => client.clientType === 'mobile');
  }

  /**
   * Update client heartbeat
   */
  heartbeat(id: string): boolean {
    const client = this.clients.get(id);
    if (!client) {
      return false;
    }

    client.lastHeartbeat = new Date();
    return true;
  }

  /**
   * Attach client to a session
   */
  attachToSession(clientId: string, sessionId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    client.sessionId = sessionId;
    return true;
  }

  /**
   * Detach client from session
   */
  detachFromSession(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    client.sessionId = null;
    return true;
  }

  /**
   * Update client priority
   */
  updatePriority(clientId: string, priority: Priority): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    client.priority = priority;
    return true;
  }

  /**
   * Get client count
   */
  count(): number {
    return this.clients.size;
  }

  /**
   * Get session client counts
   */
  getSessionCounts(sessionId: string): { pc: number; mobile: number } {
    const sessionClients = this.getBySession(sessionId);
    return {
      pc: sessionClients.filter((c) => c.clientType === 'pc').length,
      mobile: sessionClients.filter((c) => c.clientType === 'mobile').length,
    };
  }

  /**
   * Get total client counts by type
   */
  getTotalCounts(): { pc: number; mobile: number } {
    const all = this.getAll();
    return {
      pc: all.filter((c) => c.clientType === 'pc').length,
      mobile: all.filter((c) => c.clientType === 'mobile').length,
    };
  }

  /**
   * Broadcast message to all clients in a session
   */
  broadcastToSession(sessionId: string, message: unknown, excludeClientId?: string): void {
    const data = JSON.stringify(message);

    for (const client of this.getBySession(sessionId)) {
      if (excludeClientId && client.id === excludeClientId) {
        continue;
      }

      if (client.ws.readyState === client.ws.OPEN) {
        client.ws.send(data);
      }
    }
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: unknown): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== client.ws.OPEN) {
      return false;
    }

    client.ws.send(JSON.stringify(message));
    return true;
  }

  /**
   * Clean up stale clients (missed heartbeats)
   */
  private cleanupStaleClients(): void {
    const now = Date.now();
    const cutoff = now - this.config.heartbeatTimeoutMs;

    for (const [id, client] of this.clients) {
      if (client.lastHeartbeat.getTime() < cutoff) {
        // Close WebSocket connection
        try {
          client.ws.close(1000, 'Heartbeat timeout');
        } catch {
          // Ignore close errors
        }

        // Remove from registry
        this.clients.delete(id);
      }
    }
  }

  /**
   * Close all connections and clear registry
   */
  closeAll(): void {
    for (const client of this.clients.values()) {
      try {
        client.ws.close(1000, 'Server shutdown');
      } catch {
        // Ignore close errors
      }
    }

    this.clients.clear();
    this.stopCleanup();
  }
}
