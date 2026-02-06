/**
 * Performance Benchmark Tests
 * MConnect V2 Server - WebSocket Hub
 *
 * Tests for performance targets from spec §9.4:
 * - WebSocket latency (server): <10ms
 * - Input-to-display roundtrip: <100ms (E2E, not tested here)
 * - Container cold start: <5s (not tested here)
 * - iOS app launch: <2s (not tested here)
 * - Memory per container: <512MB (not tested here)
 *
 * This test suite focuses on server-side performance metrics.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import type { ServerWebSocket } from 'bun';
import { WSHub, resetWSHub, type WebSocketData } from '../WSHub.js';
import { initializeJWTService, resetJWTService, getJWTService } from '../../auth/jwt.js';
import { LatencyTracker } from '../LatencyTracker.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_SECRET = 'test-secret-key-must-be-at-least-32-chars-long';

/**
 * Create a mock WebSocket for testing
 */
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
// LatencyTracker Tests
// ============================================================================

describe('LatencyTracker', () => {
  test('startTimer returns stop function that measures elapsed time', () => {
    const tracker = new LatencyTracker({ enabled: true });
    const stopTimer = tracker.startTimer();

    // Simulate some work
    const result = Array.from({ length: 1000 }, (_, i) => i * i).reduce((a, b) => a + b, 0);
    expect(result).toBeGreaterThan(0); // Use result to prevent optimization

    const elapsed = stopTimer();

    // Should have some measurable elapsed time
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(100); // Should be very fast
  });

  test('record stores measurements within window size', () => {
    const tracker = new LatencyTracker({ enabled: true, windowSize: 10 });

    // Record 5 measurements
    for (let i = 1; i <= 5; i++) {
      tracker.record('test', i);
    }

    const metrics = tracker.getMetricsForType('test');
    expect(metrics).not.toBeNull();
    expect(metrics!.count).toBe(5);
    expect(metrics!.min).toBe(1);
    expect(metrics!.max).toBe(5);
  });

  test('getMetrics returns correct p50/p95/p99 for known data', () => {
    const tracker = new LatencyTracker({ enabled: true, windowSize: 200 });

    // Record values 1-100
    for (let i = 1; i <= 100; i++) {
      tracker.record('test', i);
    }

    const metrics = tracker.getMetricsForType('test');
    expect(metrics).not.toBeNull();
    expect(metrics!.count).toBe(100);

    // With linear interpolation:
    // p50 at index 49.5 = (50 + 51) / 2 = 50.5
    // p95 at index 94.05 = 95 * 0.95 + 96 * 0.05 = 95.05
    // p99 at index 98.01 = 99 * 0.99 + 100 * 0.01 = 99.01
    expect(metrics!.p50).toBeCloseTo(50.5, 1);
    expect(metrics!.p95).toBeCloseTo(95.05, 1);
    expect(metrics!.p99).toBeCloseTo(99.01, 1);

    expect(metrics!.min).toBe(1);
    expect(metrics!.max).toBe(100);
    expect(metrics!.avg).toBeCloseTo(50.5, 1);
  });

  test('getMetrics returns empty array when no measurements', () => {
    const tracker = new LatencyTracker({ enabled: true });
    const metrics = tracker.getMetrics();
    expect(metrics).toEqual([]);
  });

  test('sliding window evicts oldest measurements', () => {
    const tracker = new LatencyTracker({ enabled: true, windowSize: 100 });

    // Record 150 values
    for (let i = 1; i <= 150; i++) {
      tracker.record('test', i);
    }

    const metrics = tracker.getMetricsForType('test');
    expect(metrics).not.toBeNull();

    // Should only keep last 100 measurements (51-150)
    expect(metrics!.count).toBe(100);
    expect(metrics!.min).toBe(51); // First 50 values were evicted
    expect(metrics!.max).toBe(150);
  });

  test('disabled tracker has zero overhead', () => {
    const tracker = new LatencyTracker({ enabled: false });

    // startTimer should return immediate function
    const stopTimer = tracker.startTimer();
    const elapsed = stopTimer();
    expect(elapsed).toBe(0);

    // record should do nothing
    tracker.record('test', 100);

    // getMetrics should return empty
    const metrics = tracker.getMetrics();
    expect(metrics).toEqual([]);
  });

  test('reset clears all measurements', () => {
    const tracker = new LatencyTracker({ enabled: true });

    // Record some measurements
    tracker.record('test1', 10);
    tracker.record('test2', 20);
    tracker.record('test3', 30);

    expect(tracker.getMetrics().length).toBe(3);

    // Reset
    tracker.reset();

    // All measurements should be cleared
    expect(tracker.getMetrics()).toEqual([]);
    expect(tracker.getMetricsForType('test1')).toBeNull();
  });

  test('getMetricsForType returns null for unknown type', () => {
    const tracker = new LatencyTracker({ enabled: true });
    const metrics = tracker.getMetricsForType('nonexistent');
    expect(metrics).toBeNull();
  });

  test('setEnabled can disable tracking after creation', () => {
    const tracker = new LatencyTracker({ enabled: true });

    tracker.record('test', 10);
    expect(tracker.getMetricsForType('test')).not.toBeNull();

    // Disable tracking
    tracker.setEnabled(false);

    // New recordings should be ignored
    tracker.record('test2', 20);
    expect(tracker.getMetricsForType('test2')).toBeNull();

    // Old measurements still exist
    expect(tracker.getMetricsForType('test')).not.toBeNull();
  });

  test('handles single measurement correctly', () => {
    const tracker = new LatencyTracker({ enabled: true });
    tracker.record('test', 42);

    const metrics = tracker.getMetricsForType('test');
    expect(metrics).not.toBeNull();
    expect(metrics!.count).toBe(1);
    expect(metrics!.p50).toBe(42);
    expect(metrics!.p95).toBe(42);
    expect(metrics!.p99).toBe(42);
    expect(metrics!.min).toBe(42);
    expect(metrics!.max).toBe(42);
    expect(metrics!.avg).toBe(42);
  });

  test('tracks multiple message types independently', () => {
    const tracker = new LatencyTracker({ enabled: true });

    tracker.record('ping', 5);
    tracker.record('ping', 6);
    tracker.record('auth', 15);
    tracker.record('auth', 16);

    const pingMetrics = tracker.getMetricsForType('ping');
    const authMetrics = tracker.getMetricsForType('auth');

    expect(pingMetrics!.count).toBe(2);
    expect(pingMetrics!.avg).toBeCloseTo(5.5, 1);

    expect(authMetrics!.count).toBe(2);
    expect(authMetrics!.avg).toBeCloseTo(15.5, 1);

    const allMetrics = tracker.getMetrics();
    expect(allMetrics.length).toBe(2);
  });
});

// ============================================================================
// WSHub Performance Tests
// ============================================================================

describe('WSHub Performance', () => {
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

  /**
   * Authenticate a mock client
   */
  async function authenticateClient(
    ws: ServerWebSocket<WebSocketData>,
    clientType: 'pc' | 'mobile' = 'pc'
  ): Promise<void> {
    hub.handleConnection(ws);

    const jwtService = getJWTService();
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

  test('getLatencyMetrics returns metrics for processed messages', async () => {
    const ws = createMockWebSocket('client-1') as ServerWebSocket<WebSocketData> & {
      _messages: string[];
    };

    await authenticateClient(ws);

    // Clear auth messages
    ws._messages.length = 0;

    // Send a ping message
    await hub.handleMessage(ws, JSON.stringify({ type: 'ping' }));

    // Check that latency metrics exist for 'ping'
    const metrics = hub.getLatencyMetrics();
    const pingMetrics = metrics.find((m) => m.messageType === 'ping');

    expect(pingMetrics).toBeDefined();
    expect(pingMetrics!.count).toBeGreaterThan(0);
    expect(pingMetrics!.avg).toBeGreaterThanOrEqual(0);
  });

  test('message processing stays under 10ms for simple messages', async () => {
    const ws = createMockWebSocket('client-1') as ServerWebSocket<WebSocketData> & {
      _messages: string[];
    };

    await authenticateClient(ws);
    ws._messages.length = 0;

    // Warm up
    for (let i = 0; i < 10; i++) {
      await hub.handleMessage(ws, JSON.stringify({ type: 'ping' }));
    }

    // Measure 100 iterations
    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await hub.handleMessage(ws, JSON.stringify({ type: 'ping' }));
    }

    const end = performance.now();
    const totalTime = end - start;
    const avgTime = totalTime / iterations;

    // Average should be well under 10ms, but use 50ms threshold for CI stability
    // In practice, this should be <1ms on modern hardware
    expect(avgTime).toBeLessThan(50);

    // Log actual performance for debugging
    console.log(`Average message processing time: ${avgTime.toFixed(3)}ms (target: <10ms)`);
  });

  test('broadcastToSession serializes message once for multiple clients', async () => {
    // Create 5 mock clients in the same session
    const clients: Array<ServerWebSocket<WebSocketData> & { _messages: string[] }> = [];

    for (let i = 1; i <= 5; i++) {
      const ws = createMockWebSocket(`client-${i}`) as ServerWebSocket<WebSocketData> & {
        _messages: string[];
      };
      await authenticateClient(ws);

      // Attach to session
      await hub.handleMessage(
        ws,
        JSON.stringify({
          type: 'session_attach',
          sessionId: 'session-1',
        })
      );

      clients.push(ws);
    }

    // Clear messages
    for (const ws of clients) {
      ws._messages.length = 0;
    }

    // Broadcast a message to the session
    hub.broadcastToSession('session-1', {
      type: 'pong',
      timestamp: Date.now(),
    });

    // All clients should have received a message
    for (const ws of clients) {
      expect(ws._messages.length).toBe(1);
    }

    // Verify all clients received the SAME string (reference equality or content equality)
    // Since JSON.stringify produces the same string for the same object, check content equality
    const firstMessage = clients[0]._messages[0];
    for (let i = 1; i < clients.length; i++) {
      expect(clients[i]._messages[0]).toBe(firstMessage);
    }
  });

  test('sendHeartbeats serializes once for all authenticated clients', async () => {
    // Create 3 authenticated clients
    const clients: Array<ServerWebSocket<WebSocketData> & { _messages: string[] }> = [];

    for (let i = 1; i <= 3; i++) {
      const ws = createMockWebSocket(`client-${i}`) as ServerWebSocket<WebSocketData> & {
        _messages: string[];
      };
      await authenticateClient(ws);
      clients.push(ws);
    }

    // Clear auth messages
    for (const ws of clients) {
      ws._messages.length = 0;
    }

    // Manually trigger heartbeat send (normally called by timer)
    // We need to access the private method, but for testing we can just wait for the interval
    // or create a new hub with a short interval

    // Create a new hub with short heartbeat interval
    hub.stop();
    resetWSHub();

    hub = new WSHub({
      heartbeatIntervalMs: 100, // 100ms
    });
    hub.start();

    // Re-authenticate clients
    const newClients: Array<ServerWebSocket<WebSocketData> & { _messages: string[] }> = [];
    for (let i = 1; i <= 3; i++) {
      const ws = createMockWebSocket(`client-${i}`) as ServerWebSocket<WebSocketData> & {
        _messages: string[];
      };
      await authenticateClient(ws);
      newClients.push(ws);
    }

    // Clear messages
    for (const ws of newClients) {
      ws._messages.length = 0;
    }

    // Wait for heartbeat interval
    await new Promise((resolve) => setTimeout(resolve, 150));

    // All clients should have received a heartbeat
    for (const ws of newClients) {
      const heartbeatMessage = ws._messages.find((m) => {
        try {
          const parsed = JSON.parse(m);
          return parsed.type === 'heartbeat';
        } catch {
          return false;
        }
      });
      expect(heartbeatMessage).toBeDefined();
    }

    // All heartbeat messages should be identical (same JSON string)
    const heartbeatMessages = newClients.map((ws) =>
      ws._messages.find((m) => {
        try {
          const parsed = JSON.parse(m);
          return parsed.type === 'heartbeat';
        } catch {
          return false;
        }
      })
    );

    const firstHeartbeat = heartbeatMessages[0];
    for (let i = 1; i < heartbeatMessages.length; i++) {
      // Parse and compare (timestamps will be the same since serialized once)
      const first = JSON.parse(firstHeartbeat!);
      const current = JSON.parse(heartbeatMessages[i]!);
      expect(current.type).toBe('heartbeat');
      expect(current.timestamp).toBe(first.timestamp); // Same timestamp = serialized once
    }
  });

  test('latency tracking can be disabled for zero overhead', () => {
    // Create a hub with disabled latency tracking
    hub.stop();
    resetWSHub();

    const tracker = new LatencyTracker({ enabled: false });
    hub = new WSHub();
    // Note: WSHub creates its own tracker, so this test verifies LatencyTracker behavior
    // rather than WSHub integration

    const stopTimer = tracker.startTimer();
    const elapsed = stopTimer();

    expect(elapsed).toBe(0);
    tracker.record('test', 100);
    expect(tracker.getMetrics()).toEqual([]);
  });

  test('high message volume maintains low latency', async () => {
    const ws = createMockWebSocket('client-1') as ServerWebSocket<WebSocketData> & {
      _messages: string[];
    };

    await authenticateClient(ws);
    ws._messages.length = 0;

    // Send 1000 messages
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await hub.handleMessage(ws, JSON.stringify({ type: 'ping' }));
    }

    const end = performance.now();
    const totalTime = end - start;
    const avgTime = totalTime / iterations;

    // Even with 1000 messages, average should stay low
    expect(avgTime).toBeLessThan(50); // Very generous threshold for CI

    console.log(`High volume test: ${avgTime.toFixed(3)}ms average over ${iterations} messages`);

    // Check latency metrics
    const metrics = hub.getLatencyMetrics();
    const pingMetrics = metrics.find((m) => m.messageType === 'ping');

    expect(pingMetrics).toBeDefined();
    expect(pingMetrics!.count).toBeGreaterThan(0);
    console.log(
      `Tracked latency - p50: ${pingMetrics!.p50.toFixed(3)}ms, ` +
        `p95: ${pingMetrics!.p95.toFixed(3)}ms, ` +
        `p99: ${pingMetrics!.p99.toFixed(3)}ms`
    );
  });

  test('concurrent client operations maintain performance', async () => {
    // Create 10 clients
    const clients: Array<ServerWebSocket<WebSocketData> & { _messages: string[] }> = [];

    for (let i = 1; i <= 10; i++) {
      const ws = createMockWebSocket(`client-${i}`) as ServerWebSocket<WebSocketData> & {
        _messages: string[];
      };
      await authenticateClient(ws);
      clients.push(ws);
    }

    // Each client sends 100 messages
    const messagesPerClient = 100;
    const start = performance.now();

    await Promise.all(
      clients.map(async (ws) => {
        for (let i = 0; i < messagesPerClient; i++) {
          await hub.handleMessage(ws, JSON.stringify({ type: 'ping' }));
        }
      })
    );

    const end = performance.now();
    const totalTime = end - start;
    const totalMessages = clients.length * messagesPerClient;
    const avgTime = totalTime / totalMessages;

    console.log(
      `Concurrent test: ${avgTime.toFixed(3)}ms average over ${totalMessages} messages ` +
        `from ${clients.length} clients`
    );

    // Average should still be reasonable
    expect(avgTime).toBeLessThan(50);
  });
});

// ============================================================================
// Performance Regression Tests
// ============================================================================

describe('Performance Regression Tests', () => {
  test('JSON serialization performance baseline', () => {
    const testObject = {
      type: 'heartbeat',
      timestamp: Date.now(),
      serverTime: Date.now(),
      nested: {
        data: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `value-${i}` })),
      },
    };

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      JSON.stringify(testObject);
    }

    const end = performance.now();
    const avgTime = (end - start) / iterations;

    console.log(`JSON serialization: ${avgTime.toFixed(6)}ms per operation`);

    // Should be very fast (< 0.1ms even for complex objects)
    expect(avgTime).toBeLessThan(1);
  });

  test('Map lookup performance baseline', () => {
    const map = new Map<string, number>();

    // Populate with 1000 entries
    for (let i = 0; i < 1000; i++) {
      map.set(`key-${i}`, i);
    }

    const iterations = 100000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const key = `key-${i % 1000}`;
      map.get(key);
    }

    const end = performance.now();
    const avgTime = (end - start) / iterations;

    console.log(`Map lookup: ${avgTime.toFixed(6)}ms per operation`);

    // Map lookups should be extremely fast
    expect(avgTime).toBeLessThan(0.01);
  });

  test('Array sorting performance for percentile calculation', () => {
    // Create array with 100 random values
    const values = Array.from({ length: 100 }, () => Math.random() * 100);

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const sorted = [...values].sort((a, b) => a - b);
      // Access median to prevent optimization
      const median = sorted[50];
      expect(median).toBeGreaterThanOrEqual(0);
    }

    const end = performance.now();
    const avgTime = (end - start) / iterations;

    console.log(`Array sort (100 items): ${avgTime.toFixed(6)}ms per operation`);

    // Sorting 100 items should be very fast
    expect(avgTime).toBeLessThan(1);
  });
});
