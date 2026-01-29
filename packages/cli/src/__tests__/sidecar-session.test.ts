/**
 * SidecarSession Unit Tests
 * MConnect v1.1.0 - Sidecar Mode
 *
 * Tests for the sidecar session manager that orchestrates
 * terminal bridging and WebSocket connections.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';

// Types for SidecarSession
interface SidecarConfig {
  port?: number;
  enableTunnel?: boolean;
  observeOnly?: boolean;
  background?: boolean;
}

interface ConnectionInfo {
  localUrl: string;
  tunnelUrl?: string;
  pairingCode: string;
  sessionId: string;
}

interface ClientInfo {
  id: string;
  type: 'pc' | 'mobile' | 'browser';
  connectedAt: Date;
}

interface SidecarInfo {
  attached: boolean;
  terminalSize: { rows: number; cols: number };
  clientCount: number;
}

// Mock SidecarSession for TDD
class MockSidecarSession extends EventEmitter {
  private _isRunning = false;
  private _clients: Map<string, ClientInfo> = new Map();
  private _config: SidecarConfig;
  private _connectionInfo: ConnectionInfo | null = null;

  constructor(config: SidecarConfig = {}) {
    super();
    this._config = {
      port: config.port ?? 8765,
      enableTunnel: config.enableTunnel ?? true,
      observeOnly: config.observeOnly ?? false,
      background: config.background ?? false,
    };
  }

  async start(): Promise<SidecarInfo> {
    if (this._isRunning) {
      throw new Error('Session already running');
    }

    this._isRunning = true;
    this._connectionInfo = {
      localUrl: `http://localhost:${this._config.port}`,
      tunnelUrl: this._config.enableTunnel ? 'https://test.trycloudflare.com' : undefined,
      pairingCode: 'ABC123',
      sessionId: 'test-session-id',
    };

    return {
      attached: true,
      terminalSize: { rows: 24, cols: 80 },
      clientCount: 0,
    };
  }

  async stop(): Promise<void> {
    if (!this._isRunning) return;

    // Disconnect all clients
    for (const clientId of this._clients.keys()) {
      this._clients.delete(clientId);
      this.emit('client_disconnected', { id: clientId });
    }

    this._isRunning = false;
    this._connectionInfo = null;
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  getClients(): ClientInfo[] {
    return Array.from(this._clients.values());
  }

  getConnectionInfo(): ConnectionInfo | null {
    return this._connectionInfo;
  }

  // Test helpers
  simulateClientConnect(id: string, type: 'pc' | 'mobile' | 'browser'): void {
    const client: ClientInfo = { id, type, connectedAt: new Date() };
    this._clients.set(id, client);
    this.emit('client_connected', client);
  }

  simulateClientDisconnect(id: string): void {
    const client = this._clients.get(id);
    if (client) {
      this._clients.delete(id);
      this.emit('client_disconnected', client);
    }
  }

  simulateInput(data: Buffer, clientId: string): void {
    if (this._config.observeOnly) {
      this.emit('input_rejected', { clientId, reason: 'observe_only' });
      return;
    }
    this.emit('input', data, { id: clientId });
  }
}

describe('SidecarSession', () => {
  let session: MockSidecarSession;

  beforeEach(() => {
    session = new MockSidecarSession();
  });

  afterEach(async () => {
    await session.stop();
    session.removeAllListeners();
  });

  describe('start()', () => {
    it('should start session and return info', async () => {
      const info = await session.start();

      expect(info.attached).toBe(true);
      expect(info.terminalSize.rows).toBeGreaterThan(0);
      expect(info.terminalSize.cols).toBeGreaterThan(0);
      expect(info.clientCount).toBe(0);
    });

    it('should set running state to true', async () => {
      expect(session.isRunning()).toBe(false);
      await session.start();
      expect(session.isRunning()).toBe(true);
    });

    it('should throw if already running', async () => {
      await session.start();
      await expect(session.start()).rejects.toThrow('Session already running');
    });

    it('should generate connection info', async () => {
      await session.start();
      const info = session.getConnectionInfo();

      expect(info).not.toBeNull();
      expect(info?.localUrl).toContain('localhost');
      expect(info?.pairingCode).toBeDefined();
      expect(info?.sessionId).toBeDefined();
    });
  });

  describe('stop()', () => {
    it('should stop session', async () => {
      await session.start();
      await session.stop();

      expect(session.isRunning()).toBe(false);
    });

    it('should be idempotent', async () => {
      await session.start();
      await session.stop();
      await session.stop(); // Should not throw

      expect(session.isRunning()).toBe(false);
    });

    it('should disconnect all clients', async () => {
      const disconnectHandler = vi.fn();
      session.on('client_disconnected', disconnectHandler);

      await session.start();
      session.simulateClientConnect('client-1', 'pc');
      session.simulateClientConnect('client-2', 'mobile');
      await session.stop();

      expect(disconnectHandler).toHaveBeenCalledTimes(2);
      expect(session.getClients()).toHaveLength(0);
    });

    it('should clear connection info', async () => {
      await session.start();
      expect(session.getConnectionInfo()).not.toBeNull();

      await session.stop();
      expect(session.getConnectionInfo()).toBeNull();
    });
  });

  describe('client management', () => {
    it('should track connected clients', async () => {
      await session.start();

      session.simulateClientConnect('client-1', 'pc');
      expect(session.getClients()).toHaveLength(1);

      session.simulateClientConnect('client-2', 'mobile');
      expect(session.getClients()).toHaveLength(2);
    });

    it('should emit client_connected event', async () => {
      const handler = vi.fn();
      session.on('client_connected', handler);

      await session.start();
      session.simulateClientConnect('client-1', 'browser');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'client-1',
          type: 'browser',
        })
      );
    });

    it('should emit client_disconnected event', async () => {
      const handler = vi.fn();
      session.on('client_disconnected', handler);

      await session.start();
      session.simulateClientConnect('client-1', 'pc');
      session.simulateClientDisconnect('client-1');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'client-1' })
      );
    });

    it('should store client connection time', async () => {
      await session.start();
      const before = new Date();
      session.simulateClientConnect('client-1', 'mobile');
      const after = new Date();

      const clients = session.getClients();
      expect(clients[0].connectedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(clients[0].connectedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('input handling', () => {
    it('should emit input event with client info', async () => {
      const handler = vi.fn();
      session.on('input', handler);

      await session.start();
      session.simulateClientConnect('client-1', 'mobile');
      session.simulateInput(Buffer.from('test'), 'client-1');

      expect(handler).toHaveBeenCalledWith(
        Buffer.from('test'),
        expect.objectContaining({ id: 'client-1' })
      );
    });

    it('should reject input in observe-only mode', async () => {
      session = new MockSidecarSession({ observeOnly: true });
      const rejectHandler = vi.fn();
      const inputHandler = vi.fn();
      session.on('input_rejected', rejectHandler);
      session.on('input', inputHandler);

      await session.start();
      session.simulateInput(Buffer.from('test'), 'client-1');

      expect(rejectHandler).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'observe_only' })
      );
      expect(inputHandler).not.toHaveBeenCalled();
    });
  });
});

describe('SidecarSession Configuration', () => {
  it('should use default port 8765', async () => {
    const session = new MockSidecarSession();
    await session.start();

    const info = session.getConnectionInfo();
    expect(info?.localUrl).toContain('8765');

    await session.stop();
  });

  it('should use custom port when specified', async () => {
    const session = new MockSidecarSession({ port: 9000 });
    await session.start();

    const info = session.getConnectionInfo();
    expect(info?.localUrl).toContain('9000');

    await session.stop();
  });

  it('should include tunnel URL when enabled', async () => {
    const session = new MockSidecarSession({ enableTunnel: true });
    await session.start();

    const info = session.getConnectionInfo();
    expect(info?.tunnelUrl).toBeDefined();

    await session.stop();
  });

  it('should not include tunnel URL when disabled', async () => {
    const session = new MockSidecarSession({ enableTunnel: false });
    await session.start();

    const info = session.getConnectionInfo();
    expect(info?.tunnelUrl).toBeUndefined();

    await session.stop();
  });
});

describe('SidecarSession Lifecycle', () => {
  it('should allow restart after stop', async () => {
    const session = new MockSidecarSession();

    await session.start();
    await session.stop();
    await session.start();

    expect(session.isRunning()).toBe(true);

    await session.stop();
  });

  it('should handle multiple clients connecting and disconnecting', async () => {
    const session = new MockSidecarSession();
    await session.start();

    // Connect 5 clients
    for (let i = 0; i < 5; i++) {
      session.simulateClientConnect(`client-${i}`, 'browser');
    }
    expect(session.getClients()).toHaveLength(5);

    // Disconnect 3 clients
    for (let i = 0; i < 3; i++) {
      session.simulateClientDisconnect(`client-${i}`);
    }
    expect(session.getClients()).toHaveLength(2);

    await session.stop();
  });

  it('should maintain separate connection info per session', async () => {
    const session1 = new MockSidecarSession({ port: 8001 });
    const session2 = new MockSidecarSession({ port: 8002 });

    await session1.start();
    await session2.start();

    expect(session1.getConnectionInfo()?.localUrl).toContain('8001');
    expect(session2.getConnectionInfo()?.localUrl).toContain('8002');

    await session1.stop();
    await session2.stop();
  });
});
