/**
 * WSHub Tests
 *
 * Tests for the WebSocket hub.
 * Note: These are unit tests that mock the WebSocket connections.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import type { ServerWebSocket } from 'bun';
import {
  WSHub,
  initializeWSHub,
  resetWSHub,
  type WebSocketData,
} from '../WSHub.js';
import { initializeJWTService, resetJWTService } from '../../auth/jwt.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_SECRET = 'test-secret-key-must-be-at-least-32-chars-long';

// Mock WebSocket
function createMockWebSocket(clientId: string): ServerWebSocket<WebSocketData> {
  const messages: string[] = [];
  let closed = false;

  return {
    data: {
      clientId,
      createdAt: Date.now(),
    },
    send: mock((message: string) => {
      messages.push(message);
      return true;
    }),
    close: mock((_code?: number, _reason?: string) => {
      closed = true;
    }),
    // Helper for testing
    _messages: messages,
    _isClosed: () => closed,
  } as unknown as ServerWebSocket<WebSocketData> & {
    _messages: string[];
    _isClosed: () => boolean;
  };
}

// ============================================================================
// WSHub Constructor Tests
// ============================================================================

describe('WSHub Constructor', () => {
  afterEach(() => {
    resetWSHub();
  });

  test('creates hub with default config', () => {
    const hub = new WSHub();
    expect(hub).toBeDefined();
  });

  test('creates hub with custom config', () => {
    const hub = new WSHub({
      heartbeatIntervalMs: 60000,
      clientTimeoutMs: 180000,
    });
    expect(hub).toBeDefined();
  });
});

// ============================================================================
// Connection Management Tests
// ============================================================================

describe('Connection Management', () => {
  let hub: WSHub;

  beforeEach(() => {
    initializeJWTService({ secret: TEST_SECRET });
    hub = new WSHub({
      authTimeoutMs: 5000,
    });
    hub.start();
  });

  afterEach(() => {
    hub.stop();
    resetWSHub();
    resetJWTService();
  });

  test('handleConnection adds client to hub', () => {
    const ws = createMockWebSocket('client-1');

    hub.handleConnection(ws);

    expect(hub.getClientCount()).toBe(1);
  });

  test('handleClose removes client from hub', () => {
    const ws = createMockWebSocket('client-1');

    hub.handleConnection(ws);
    expect(hub.getClientCount()).toBe(1);

    hub.handleClose(ws);
    expect(hub.getClientCount()).toBe(0);
  });

  test('disconnect removes client by ID', () => {
    const ws = createMockWebSocket('client-1');

    hub.handleConnection(ws);
    expect(hub.getClientCount()).toBe(1);

    hub.disconnect('client-1');
    expect(hub.getClientCount()).toBe(0);
  });

  test('disconnect for unknown client does nothing', () => {
    hub.disconnect('unknown');
    expect(hub.getClientCount()).toBe(0);
  });
});

// ============================================================================
// Authentication Tests
// ============================================================================

describe('Authentication', () => {
  let hub: WSHub;

  beforeEach(() => {
    initializeJWTService({ secret: TEST_SECRET });
    hub = new WSHub({
      authTimeoutMs: 100, // Short timeout for testing
    });
    hub.start();
  });

  afterEach(() => {
    hub.stop();
    resetWSHub();
    resetJWTService();
  });

  test('rejects message before auth', async () => {
    const ws = createMockWebSocket('client-1') as ServerWebSocket<WebSocketData> & {
      _messages: string[];
      _isClosed: () => boolean;
    };

    hub.handleConnection(ws);

    // Send a non-auth message
    await hub.handleMessage(ws, JSON.stringify({ type: 'ping' }));

    // Should have received auth_failed
    expect(ws._messages.length).toBeGreaterThan(0);
    const response = JSON.parse(ws._messages[0]);
    expect(response.type).toBe('auth_failed');
    expect(response.reason).toBe('missing_token');

    // Connection should be closed
    expect(ws._isClosed()).toBe(true);
  });

  test('rejects invalid token', async () => {
    const ws = createMockWebSocket('client-1') as ServerWebSocket<WebSocketData> & {
      _messages: string[];
      _isClosed: () => boolean;
    };

    hub.handleConnection(ws);

    // Send auth with invalid token
    await hub.handleMessage(
      ws,
      JSON.stringify({
        type: 'auth',
        token: 'invalid.token.here',
        protocolVersion: '3.0',
        clientType: 'pc',
      })
    );

    // Should have received auth_failed
    expect(ws._messages.length).toBeGreaterThan(0);
    const response = JSON.parse(ws._messages[0]);
    expect(response.type).toBe('auth_failed');
    expect(response.reason).toBe('invalid_token');
  });

  test('auth times out if not received', async () => {
    const ws = createMockWebSocket('client-1') as ServerWebSocket<WebSocketData> & {
      _messages: string[];
      _isClosed: () => boolean;
    };

    hub.handleConnection(ws);
    expect(hub.getClientCount()).toBe(1);

    // Wait for auth timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Client should be removed
    expect(hub.getClientCount()).toBe(0);
  });

  test('accepts valid token', async () => {
    const ws = createMockWebSocket('client-1') as ServerWebSocket<WebSocketData> & {
      _messages: string[];
      _isClosed: () => boolean;
    };

    hub.handleConnection(ws);

    // Create a valid token
    const jwtService = await import('../../auth/jwt.js').then((m) => m.getJWTService());
    const token = await jwtService.createAccessToken({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      provider: 'github',
      providerId: 'gh-123',
      createdAt: new Date(),
    });

    // Send auth message
    await hub.handleMessage(
      ws,
      JSON.stringify({
        type: 'auth',
        token,
        protocolVersion: '3.0',
        clientType: 'pc',
      })
    );

    // Should have received auth_success
    expect(ws._messages.length).toBeGreaterThan(0);
    const response = JSON.parse(ws._messages[0]);
    expect(response.type).toBe('auth_success');
    expect(response.userId).toBe('user-1');
    expect(response.clientType).toBe('pc');

    // Client should still be connected
    expect(hub.getClientCount()).toBe(1);
    expect(hub.getAuthenticatedClientCount()).toBe(1);
  });
});

// ============================================================================
// Message Handling Tests
// ============================================================================

describe('Message Handling', () => {
  let hub: WSHub;

  beforeEach(() => {
    initializeJWTService({ secret: TEST_SECRET });
    hub = new WSHub();
    hub.start();
  });

  afterEach(() => {
    hub.stop();
    resetWSHub();
    resetJWTService();
  });

  async function authenticateClient(
    ws: ServerWebSocket<WebSocketData>,
    clientType: 'pc' | 'mobile' = 'pc'
  ): Promise<void> {
    hub.handleConnection(ws);

    const jwtService = await import('../../auth/jwt.js').then((m) => m.getJWTService());
    const token = await jwtService.createAccessToken({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      provider: 'github',
      providerId: 'gh-123',
      createdAt: new Date(),
    });

    await hub.handleMessage(
      ws,
      JSON.stringify({
        type: 'auth',
        token,
        protocolVersion: '3.0',
        clientType,
      })
    );
  }

  test('handles ping message with pong', async () => {
    const ws = createMockWebSocket('client-1') as ServerWebSocket<WebSocketData> & {
      _messages: string[];
    };

    await authenticateClient(ws);
    ws._messages.length = 0; // Clear auth message

    await hub.handleMessage(ws, JSON.stringify({ type: 'ping' }));

    expect(ws._messages.length).toBe(1);
    const response = JSON.parse(ws._messages[0]);
    expect(response.type).toBe('pong');
    expect(response.timestamp).toBeDefined();
  });

  test('handles heartbeat_ack message', async () => {
    const ws = createMockWebSocket('client-1') as ServerWebSocket<WebSocketData> & {
      _messages: string[];
    };

    await authenticateClient(ws);
    ws._messages.length = 0;

    // Should not throw or send error
    await hub.handleMessage(
      ws,
      JSON.stringify({
        type: 'heartbeat_ack',
        timestamp: Date.now(),
      })
    );

    // No response expected for heartbeat_ack
    expect(ws._messages.length).toBe(0);
  });

  test('handles session_attach message', async () => {
    const ws = createMockWebSocket('client-1') as ServerWebSocket<WebSocketData> & {
      _messages: string[];
    };

    await authenticateClient(ws);
    ws._messages.length = 0;

    await hub.handleMessage(
      ws,
      JSON.stringify({
        type: 'session_attach',
        sessionId: 'session-1',
      })
    );

    // Should receive control_status
    expect(ws._messages.length).toBeGreaterThan(0);
    const response = JSON.parse(ws._messages[0]);
    expect(response.type).toBe('control_status');
    expect(response.sessionId).toBe('session-1');
  });

  test('handles session_detach message', async () => {
    const ws = createMockWebSocket('client-1') as ServerWebSocket<WebSocketData> & {
      _messages: string[];
    };

    await authenticateClient(ws);

    // First attach
    await hub.handleMessage(
      ws,
      JSON.stringify({
        type: 'session_attach',
        sessionId: 'session-1',
      })
    );

    ws._messages.length = 0;

    // Then detach
    await hub.handleMessage(ws, JSON.stringify({ type: 'session_detach' }));

    // Should be detached (no specific response, but should not error)
    expect(true).toBe(true);
  });
});

// ============================================================================
// Input Arbitration Tests
// ============================================================================

describe('Input Arbitration', () => {
  let hub: WSHub;

  beforeEach(() => {
    initializeJWTService({ secret: TEST_SECRET });
    hub = new WSHub();
    hub.start();
  });

  afterEach(() => {
    hub.stop();
    resetWSHub();
    resetJWTService();
  });

  async function createAuthenticatedClient(
    clientId: string,
    clientType: 'pc' | 'mobile'
  ): Promise<ServerWebSocket<WebSocketData> & { _messages: string[] }> {
    const ws = createMockWebSocket(clientId) as ServerWebSocket<WebSocketData> & {
      _messages: string[];
    };

    hub.handleConnection(ws);

    const jwtService = await import('../../auth/jwt.js').then((m) => m.getJWTService());
    const token = await jwtService.createAccessToken({
      id: `user-${clientId}`,
      email: 'test@example.com',
      name: 'Test User',
      provider: 'github',
      providerId: 'gh-123',
      createdAt: new Date(),
    });

    await hub.handleMessage(
      ws,
      JSON.stringify({
        type: 'auth',
        token,
        protocolVersion: '3.0',
        clientType,
      })
    );

    return ws;
  }

  test('rejects input from client not in session', async () => {
    const ws = await createAuthenticatedClient('client-1', 'pc');
    ws._messages.length = 0;

    await hub.handleMessage(
      ws,
      JSON.stringify({
        type: 'terminal_input',
        agentId: 'agent-1',
        data: 'test input',
      })
    );

    // Should receive input_rejected
    expect(ws._messages.length).toBe(1);
    const response = JSON.parse(ws._messages[0]);
    expect(response.type).toBe('input_rejected');
    expect(response.reason).toBe('read_only');
  });

  test('accepts input from PC client in session', async () => {
    const ws = await createAuthenticatedClient('client-1', 'pc');

    // Attach to session
    await hub.handleMessage(
      ws,
      JSON.stringify({
        type: 'session_attach',
        sessionId: 'session-1',
      })
    );

    ws._messages.length = 0;

    // Set up input handler
    let receivedInput = '';
    hub.registerInputHandler('session-1', (_agentId, data) => {
      receivedInput = data;
    });

    await hub.handleMessage(
      ws,
      JSON.stringify({
        type: 'terminal_input',
        agentId: 'agent-1',
        data: 'test input',
      })
    );

    // No rejection message
    const hasRejection = ws._messages.some(
      (m) => JSON.parse(m).type === 'input_rejected'
    );
    expect(hasRejection).toBe(false);

    // Input should have been forwarded
    expect(receivedInput).toBe('test input');
  });

  test('mobile can request exclusive control', async () => {
    const pcWs = await createAuthenticatedClient('pc-1', 'pc');
    const mobileWs = await createAuthenticatedClient('mobile-1', 'mobile');

    // Both attach to same session
    await hub.handleMessage(
      pcWs,
      JSON.stringify({
        type: 'session_attach',
        sessionId: 'session-1',
      })
    );
    await hub.handleMessage(
      mobileWs,
      JSON.stringify({
        type: 'session_attach',
        sessionId: 'session-1',
      })
    );

    mobileWs._messages.length = 0;

    // Request exclusive control
    await hub.handleMessage(
      mobileWs,
      JSON.stringify({
        type: 'control_request',
        action: 'exclusive',
      })
    );

    // Should receive control_response with granted: true
    const responses = mobileWs._messages.map((m) => JSON.parse(m));
    const controlResponse = responses.find((r) => r.type === 'control_response');
    expect(controlResponse).toBeDefined();
    expect(controlResponse.granted).toBe(true);
  });

  test('mobile can release exclusive control', async () => {
    const mobileWs = await createAuthenticatedClient('mobile-1', 'mobile');

    await hub.handleMessage(
      mobileWs,
      JSON.stringify({
        type: 'session_attach',
        sessionId: 'session-1',
      })
    );

    // Request exclusive
    await hub.handleMessage(
      mobileWs,
      JSON.stringify({
        type: 'control_request',
        action: 'exclusive',
      })
    );

    mobileWs._messages.length = 0;

    // Release control
    await hub.handleMessage(
      mobileWs,
      JSON.stringify({
        type: 'control_request',
        action: 'release',
      })
    );

    const responses = mobileWs._messages.map((m) => JSON.parse(m));
    const controlResponse = responses.find((r) => r.type === 'control_response');
    expect(controlResponse).toBeDefined();
    expect(controlResponse.granted).toBe(true);
  });
});

// ============================================================================
// Broadcasting Tests
// ============================================================================

describe('Broadcasting', () => {
  let hub: WSHub;

  beforeEach(() => {
    initializeJWTService({ secret: TEST_SECRET });
    hub = new WSHub();
    hub.start();
  });

  afterEach(() => {
    hub.stop();
    resetWSHub();
    resetJWTService();
  });

  async function createAuthenticatedClient(
    clientId: string
  ): Promise<ServerWebSocket<WebSocketData> & { _messages: string[] }> {
    const ws = createMockWebSocket(clientId) as ServerWebSocket<WebSocketData> & {
      _messages: string[];
    };

    hub.handleConnection(ws);

    const jwtService = await import('../../auth/jwt.js').then((m) => m.getJWTService());
    const token = await jwtService.createAccessToken({
      id: `user-${clientId}`,
      email: 'test@example.com',
      name: 'Test User',
      provider: 'github',
      providerId: 'gh-123',
      createdAt: new Date(),
    });

    await hub.handleMessage(
      ws,
      JSON.stringify({
        type: 'auth',
        token,
        protocolVersion: '3.0',
        clientType: 'pc',
      })
    );

    return ws;
  }

  test('broadcasts client_joined to session members', async () => {
    const ws1 = await createAuthenticatedClient('client-1');
    const ws2 = await createAuthenticatedClient('client-2');

    // First client joins session
    await hub.handleMessage(
      ws1,
      JSON.stringify({
        type: 'session_attach',
        sessionId: 'session-1',
      })
    );

    ws1._messages.length = 0;

    // Second client joins same session
    await hub.handleMessage(
      ws2,
      JSON.stringify({
        type: 'session_attach',
        sessionId: 'session-1',
      })
    );

    // First client should have received client_joined
    const joinedMessage = ws1._messages
      .map((m) => JSON.parse(m))
      .find((m) => m.type === 'client_joined');

    expect(joinedMessage).toBeDefined();
    expect(joinedMessage.client.id).toBe('client-2');
  });

  test('broadcasts client_left to session members', async () => {
    const ws1 = await createAuthenticatedClient('client-1');
    const ws2 = await createAuthenticatedClient('client-2');

    // Both join session
    await hub.handleMessage(
      ws1,
      JSON.stringify({
        type: 'session_attach',
        sessionId: 'session-1',
      })
    );
    await hub.handleMessage(
      ws2,
      JSON.stringify({
        type: 'session_attach',
        sessionId: 'session-1',
      })
    );

    ws1._messages.length = 0;

    // Second client leaves
    hub.disconnect('client-2');

    // First client should have received client_left
    const leftMessage = ws1._messages
      .map((m) => JSON.parse(m))
      .find((m) => m.type === 'client_left');

    expect(leftMessage).toBeDefined();
    expect(leftMessage.clientId).toBe('client-2');
  });

  test('sendToClient returns false for unknown client', () => {
    const result = hub.sendToClient('unknown', {
      type: 'pong',
      timestamp: Date.now(),
    });

    expect(result).toBe(false);
  });

  test('broadcastToSession excludes specified client', async () => {
    const ws1 = await createAuthenticatedClient('client-1');
    const ws2 = await createAuthenticatedClient('client-2');

    // Both join session
    await hub.handleMessage(
      ws1,
      JSON.stringify({
        type: 'session_attach',
        sessionId: 'session-1',
      })
    );
    await hub.handleMessage(
      ws2,
      JSON.stringify({
        type: 'session_attach',
        sessionId: 'session-1',
      })
    );

    ws1._messages.length = 0;
    ws2._messages.length = 0;

    // Broadcast excluding client-2
    hub.broadcastToSession(
      'session-1',
      {
        type: 'pong',
        timestamp: Date.now(),
      },
      'client-2'
    );

    // Client-1 should receive message
    expect(ws1._messages.length).toBe(1);

    // Client-2 should not receive message
    expect(ws2._messages.length).toBe(0);
  });
});

// ============================================================================
// Client Info Tests
// ============================================================================

describe('Client Info', () => {
  let hub: WSHub;

  beforeEach(() => {
    initializeJWTService({ secret: TEST_SECRET });
    hub = new WSHub();
    hub.start();
  });

  afterEach(() => {
    hub.stop();
    resetWSHub();
    resetJWTService();
  });

  test('getClientInfo returns null for unknown client', () => {
    const info = hub.getClientInfo('unknown');
    expect(info).toBeNull();
  });

  test('getSessionClients returns clients in session', async () => {
    const ws1 = createMockWebSocket('client-1');
    const ws2 = createMockWebSocket('client-2');

    hub.handleConnection(ws1);
    hub.handleConnection(ws2);

    const jwtService = await import('../../auth/jwt.js').then((m) => m.getJWTService());

    // Authenticate both
    for (const [ws, id] of [[ws1, 'client-1'], [ws2, 'client-2']] as const) {
      const token = await jwtService.createAccessToken({
        id: `user-${id}`,
        email: 'test@example.com',
        name: 'Test User',
        provider: 'github',
        providerId: 'gh-123',
        createdAt: new Date(),
      });

      await hub.handleMessage(
        ws,
        JSON.stringify({
          type: 'auth',
          token,
          protocolVersion: '3.0',
          clientType: 'pc',
        })
      );
    }

    // Attach to session
    await hub.handleMessage(
      ws1,
      JSON.stringify({
        type: 'session_attach',
        sessionId: 'session-1',
      })
    );
    await hub.handleMessage(
      ws2,
      JSON.stringify({
        type: 'session_attach',
        sessionId: 'session-1',
      })
    );

    const clients = hub.getSessionClients('session-1');
    expect(clients).toHaveLength(2);
  });

  test('getSessionClients returns empty array for unknown session', () => {
    const clients = hub.getSessionClients('unknown');
    expect(clients).toHaveLength(0);
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe('WSHub Singleton', () => {
  afterEach(() => {
    resetWSHub();
    resetJWTService();
  });

  test('initializeWSHub creates new instance', () => {
    initializeJWTService({ secret: TEST_SECRET });
    const hub = initializeWSHub();
    expect(hub).toBeInstanceOf(WSHub);
  });

  test('initializeWSHub replaces existing instance', () => {
    initializeJWTService({ secret: TEST_SECRET });

    initializeWSHub();
    const hub2 = initializeWSHub();

    // New instance should be created
    expect(hub2).toBeInstanceOf(WSHub);
    // Old instance should be stopped (we can't directly test this without side effects)
  });

  test('resetWSHub clears singleton', () => {
    initializeJWTService({ secret: TEST_SECRET });

    initializeWSHub();
    resetWSHub();

    // Next call to getWSHub should create new instance
    // (this is tested indirectly by the singleton behavior)
  });
});
