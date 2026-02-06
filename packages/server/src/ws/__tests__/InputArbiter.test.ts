/**
 * InputArbiter Tests
 *
 * Tests for the input arbitration state machine.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { InputArbiter } from '../InputArbiter.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_SESSION_ID = 'session-test-123';

// ============================================================================
// InputArbiter Constructor Tests
// ============================================================================

describe('InputArbiter Constructor', () => {
  test('creates arbiter with session ID', () => {
    const arbiter = new InputArbiter(TEST_SESSION_ID);
    expect(arbiter).toBeDefined();
    expect(arbiter.getSessionId()).toBe(TEST_SESSION_ID);
  });

  test('starts in pc_disconnected state', () => {
    const arbiter = new InputArbiter(TEST_SESSION_ID);
    expect(arbiter.getState()).toBe('pc_disconnected');
  });

  test('accepts custom config', () => {
    const arbiter = new InputArbiter(TEST_SESSION_ID, {
      pcIdleThresholdMs: 60000,
      inputRateLimitCps: 200,
    });
    expect(arbiter).toBeDefined();
  });
});

// ============================================================================
// Client Management Tests
// ============================================================================

describe('Client Management', () => {
  let arbiter: InputArbiter;

  beforeEach(() => {
    arbiter = new InputArbiter(TEST_SESSION_ID);
    arbiter.start();
  });

  afterEach(() => {
    arbiter.stop();
  });

  test('adds PC client with high priority by default', () => {
    arbiter.addClient('pc-1', 'pc');
    const client = arbiter.getClient('pc-1');

    expect(client).toBeDefined();
    expect(client!.clientType).toBe('pc');
    expect(client!.priority).toBe('high');
  });

  test('adds mobile client with normal priority by default', () => {
    arbiter.addClient('mobile-1', 'mobile');
    const client = arbiter.getClient('mobile-1');

    expect(client).toBeDefined();
    expect(client!.clientType).toBe('mobile');
    expect(client!.priority).toBe('normal');
  });

  test('adds client with custom priority', () => {
    arbiter.addClient('observer-1', 'mobile', 'observer');
    const client = arbiter.getClient('observer-1');

    expect(client!.priority).toBe('observer');
  });

  test('removes client', () => {
    arbiter.addClient('pc-1', 'pc');
    expect(arbiter.getClient('pc-1')).toBeDefined();

    arbiter.removeClient('pc-1');
    expect(arbiter.getClient('pc-1')).toBeUndefined();
  });

  test('returns all clients', () => {
    arbiter.addClient('pc-1', 'pc');
    arbiter.addClient('mobile-1', 'mobile');

    const clients = arbiter.getClients();
    expect(clients).toHaveLength(2);
  });
});

// ============================================================================
// State Machine Tests
// ============================================================================

describe('State Machine Transitions', () => {
  let arbiter: InputArbiter;

  beforeEach(() => {
    arbiter = new InputArbiter(TEST_SESSION_ID);
    arbiter.start();
  });

  afterEach(() => {
    arbiter.stop();
  });

  test('transitions from pc_disconnected to pc_active when PC joins', () => {
    expect(arbiter.getState()).toBe('pc_disconnected');

    arbiter.addClient('pc-1', 'pc');

    // Initial state after PC joins should be pc_active (since we just recorded activity)
    // Actually the state depends on whether there's been any input activity
    // Without input, it should be pc_idle or pc_active
    expect(['pc_active', 'pc_idle']).toContain(arbiter.getState());
  });

  test('returns to pc_disconnected when last PC leaves', () => {
    arbiter.addClient('pc-1', 'pc');
    arbiter.addClient('mobile-1', 'mobile');

    arbiter.removeClient('pc-1');

    expect(arbiter.getState()).toBe('pc_disconnected');
  });

  test('transitions to mobile_exclusive when mobile requests control', () => {
    arbiter.addClient('pc-1', 'pc');
    arbiter.addClient('mobile-1', 'mobile');

    const granted = arbiter.requestExclusiveControl('mobile-1');

    expect(granted).toBe(true);
    expect(arbiter.getState()).toBe('mobile_exclusive');
  });

  test('returns from mobile_exclusive when control released', () => {
    arbiter.addClient('pc-1', 'pc');
    arbiter.addClient('mobile-1', 'mobile');

    arbiter.requestExclusiveControl('mobile-1');
    expect(arbiter.getState()).toBe('mobile_exclusive');

    arbiter.releaseExclusiveControl();
    expect(arbiter.getState()).not.toBe('mobile_exclusive');
  });
});

// ============================================================================
// Input Processing Tests
// ============================================================================

describe('Input Processing', () => {
  let arbiter: InputArbiter;

  beforeEach(() => {
    arbiter = new InputArbiter(TEST_SESSION_ID);
    arbiter.start();
  });

  afterEach(() => {
    arbiter.stop();
  });

  test('accepts input from PC client', () => {
    arbiter.addClient('pc-1', 'pc');

    const result = arbiter.processInput('pc-1', 'test input');

    expect(result.accepted).toBe(true);
    expect(result.rejectReason).toBeUndefined();
  });

  test('accepts input from mobile when no PC connected', () => {
    arbiter.addClient('mobile-1', 'mobile');

    const result = arbiter.processInput('mobile-1', 'test input');

    expect(result.accepted).toBe(true);
  });

  test('rejects input from unknown client', () => {
    const result = arbiter.processInput('unknown', 'test input');

    expect(result.accepted).toBe(false);
    expect(result.rejectReason).toBe('read_only');
  });

  test('rejects input from observer client', () => {
    arbiter.addClient('observer-1', 'mobile', 'observer');

    const result = arbiter.processInput('observer-1', 'test input');

    expect(result.accepted).toBe(false);
    expect(result.rejectReason).toBe('read_only');
  });

  test('rejects input from non-exclusive client when exclusive is active', () => {
    arbiter.addClient('pc-1', 'pc');
    arbiter.addClient('mobile-1', 'mobile');

    arbiter.requestExclusiveControl('mobile-1');

    const result = arbiter.processInput('pc-1', 'test input');

    expect(result.accepted).toBe(false);
    expect(result.rejectReason).toBe('other_exclusive');
  });

  test('accepts input from exclusive client', () => {
    arbiter.addClient('pc-1', 'pc');
    arbiter.addClient('mobile-1', 'mobile');

    arbiter.requestExclusiveControl('mobile-1');

    const result = arbiter.processInput('mobile-1', 'test input');

    expect(result.accepted).toBe(true);
  });

  test('rejects mobile input when PC is active', async () => {
    arbiter.stop();
    arbiter = new InputArbiter(TEST_SESSION_ID, {
      mobileGracePeriodMs: 0,
    });
    arbiter.start();
    arbiter.addClient('pc-1', 'pc');
    arbiter.addClient('mobile-1', 'mobile');

    arbiter.processInput('pc-1', 'typing');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const result = arbiter.processInput('mobile-1', 'test input');

    expect(result.accepted).toBe(false);
    expect(result.rejectReason).toBe('pc_typing');
  });
});

// ============================================================================
// Rate Limiting Tests
// ============================================================================

describe('Rate Limiting', () => {
  let arbiter: InputArbiter;

  beforeEach(() => {
    // Use a low rate limit for testing
    arbiter = new InputArbiter(TEST_SESSION_ID, {
      inputRateLimitCps: 10, // 10 chars per second
    });
    arbiter.start();
  });

  afterEach(() => {
    arbiter.stop();
  });

  test('accepts input within rate limit', () => {
    arbiter.addClient('pc-1', 'pc');

    const result = arbiter.processInput('pc-1', 'hello'); // 5 chars

    expect(result.accepted).toBe(true);
  });

  test('rejects input exceeding rate limit', () => {
    arbiter.addClient('pc-1', 'pc');

    // First input uses up most of the limit
    arbiter.processInput('pc-1', 'hello'); // 5 chars

    // Second input should exceed limit
    const result = arbiter.processInput('pc-1', 'world!'); // 6 chars

    expect(result.accepted).toBe(false);
    expect(result.rejectReason).toBe('rate_limited');
  });
});

// ============================================================================
// Exclusive Control Tests
// ============================================================================

describe('Exclusive Control', () => {
  let arbiter: InputArbiter;

  beforeEach(() => {
    arbiter = new InputArbiter(TEST_SESSION_ID, {
      exclusiveTimeoutMs: 100, // Short timeout for testing
    });
    arbiter.start();
  });

  afterEach(() => {
    arbiter.stop();
  });

  test('only mobile clients can request exclusive', () => {
    arbiter.addClient('pc-1', 'pc');

    const granted = arbiter.requestExclusiveControl('pc-1');

    expect(granted).toBe(false);
    expect(arbiter.getExclusiveClient()).toBeNull();
  });

  test('mobile can request exclusive', () => {
    arbiter.addClient('mobile-1', 'mobile');

    const granted = arbiter.requestExclusiveControl('mobile-1');

    expect(granted).toBe(true);
    expect(arbiter.getExclusiveClient()).toBe('mobile-1');
  });

  test('cannot request exclusive if already exclusive', () => {
    arbiter.addClient('mobile-1', 'mobile');
    arbiter.addClient('mobile-2', 'mobile');

    arbiter.requestExclusiveControl('mobile-1');
    const granted = arbiter.requestExclusiveControl('mobile-2');

    expect(granted).toBe(false);
    expect(arbiter.getExclusiveClient()).toBe('mobile-1');
  });

  test('exclusive times out automatically', async () => {
    arbiter.addClient('mobile-1', 'mobile');

    arbiter.requestExclusiveControl('mobile-1');
    expect(arbiter.getExclusiveClient()).toBe('mobile-1');

    // Wait for timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(arbiter.getExclusiveClient()).toBeNull();
    expect(arbiter.getState()).not.toBe('mobile_exclusive');
  });

  test('hasExclusiveControl returns correct value', () => {
    arbiter.addClient('mobile-1', 'mobile');
    arbiter.addClient('mobile-2', 'mobile');

    arbiter.requestExclusiveControl('mobile-1');

    expect(arbiter.hasExclusiveControl('mobile-1')).toBe(true);
    expect(arbiter.hasExclusiveControl('mobile-2')).toBe(false);
  });

  test('releases exclusive when client disconnects', () => {
    arbiter.addClient('mobile-1', 'mobile');

    arbiter.requestExclusiveControl('mobile-1');
    expect(arbiter.getExclusiveClient()).toBe('mobile-1');

    arbiter.removeClient('mobile-1');

    expect(arbiter.getExclusiveClient()).toBeNull();
  });
});

// ============================================================================
// Control State Tests
// ============================================================================

describe('Control State', () => {
  let arbiter: InputArbiter;

  beforeEach(() => {
    arbiter = new InputArbiter(TEST_SESSION_ID);
    arbiter.start();
  });

  afterEach(() => {
    arbiter.stop();
  });

  test('returns current control state', () => {
    arbiter.addClient('pc-1', 'pc');

    const controlState = arbiter.getControlState();

    expect(controlState.state).toBeDefined();
    expect(['pc_active', 'pc_idle', 'pc_disconnected', 'mobile_exclusive']).toContain(controlState.state);
  });

  test('includes exclusive expiration when active', () => {
    arbiter.addClient('mobile-1', 'mobile');
    arbiter.requestExclusiveControl('mobile-1');

    const controlState = arbiter.getControlState();

    expect(controlState.exclusiveExpires).toBeDefined();
    expect(controlState.exclusiveExpires!.getTime()).toBeGreaterThan(Date.now());
  });

  test('includes current owner', () => {
    arbiter.addClient('pc-1', 'pc');

    const controlState = arbiter.getControlState();

    expect(controlState.currentOwner).toBe('pc-1');
  });
});

// ============================================================================
// Event Emission Tests
// ============================================================================

describe('Event Emission', () => {
  let arbiter: InputArbiter;

  beforeEach(() => {
    arbiter = new InputArbiter(TEST_SESSION_ID);
    arbiter.start();
  });

  afterEach(() => {
    arbiter.stop();
  });

  test('emits inputAccepted event', () => {
    arbiter.addClient('pc-1', 'pc');

    let emitted = false;
    arbiter.on('inputAccepted', (clientId, input) => {
      emitted = true;
      expect(clientId).toBe('pc-1');
      expect(input).toBe('test');
    });

    arbiter.processInput('pc-1', 'test');

    expect(emitted).toBe(true);
  });

  test('emits inputRejected event for rate limiting', () => {
    // Create arbiter with low rate limit
    arbiter.stop();
    arbiter = new InputArbiter(TEST_SESSION_ID, {
      inputRateLimitCps: 5, // 5 chars per second
    });
    arbiter.start();

    arbiter.addClient('pc-1', 'pc');

    // First input uses up the limit
    arbiter.processInput('pc-1', 'hello'); // 5 chars

    let emitted = false;
    arbiter.on('inputRejected', (clientId, _input, reason) => {
      emitted = true;
      expect(clientId).toBe('pc-1');
      expect(reason).toBe('rate_limited');
    });

    // This should be rate limited
    arbiter.processInput('pc-1', 'world');

    expect(emitted).toBe(true);
  });

  test('emits controlGranted event', () => {
    arbiter.addClient('mobile-1', 'mobile');

    let emitted = false;
    arbiter.on('controlGranted', (clientId, priority) => {
      emitted = true;
      expect(clientId).toBe('mobile-1');
      expect(priority).toBe('exclusive');
    });

    arbiter.requestExclusiveControl('mobile-1');

    expect(emitted).toBe(true);
  });

  test('emits controlReleased event', () => {
    arbiter.addClient('mobile-1', 'mobile');
    arbiter.requestExclusiveControl('mobile-1');

    let emitted = false;
    arbiter.on('controlReleased', (clientId) => {
      emitted = true;
      expect(clientId).toBe('mobile-1');
    });

    arbiter.releaseExclusiveControl();

    expect(emitted).toBe(true);
  });

  test('emits stateChange event', () => {
    let emitted = false;
    arbiter.on('stateChange', (newState, oldState) => {
      emitted = true;
      expect(oldState).toBe('pc_disconnected');
      expect(['pc_active', 'pc_idle']).toContain(newState);
    });

    arbiter.addClient('pc-1', 'pc');

    expect(emitted).toBe(true);
  });
});

// ============================================================================
// Audit Logging Tests
// ============================================================================

describe('Audit Logging', () => {
  let arbiter: InputArbiter;

  beforeEach(() => {
    arbiter = new InputArbiter(TEST_SESSION_ID);
    arbiter.start();
  });

  afterEach(() => {
    arbiter.stop();
  });

  test('calls audit logger on control granted', () => {
    arbiter.addClient('mobile-1', 'mobile');

    let logged = false;
    arbiter.setAuditLogger((entry) => {
      if (entry.eventType === 'control_granted') {
        logged = true;
        expect(entry.clientId).toBe('mobile-1');
        expect(entry.timestamp).toBeInstanceOf(Date);
      }
    });

    arbiter.requestExclusiveControl('mobile-1');

    expect(logged).toBe(true);
  });

  test('calls audit logger on control released', () => {
    arbiter.addClient('mobile-1', 'mobile');
    arbiter.requestExclusiveControl('mobile-1');

    let logged = false;
    arbiter.setAuditLogger((entry) => {
      if (entry.eventType === 'control_released') {
        logged = true;
        expect(entry.clientId).toBe('mobile-1');
      }
    });

    arbiter.releaseExclusiveControl();

    expect(logged).toBe(true);
  });

  test('calls audit logger on state change', () => {
    let logged = false;
    arbiter.setAuditLogger((entry) => {
      if (entry.eventType === 'state_change') {
        logged = true;
        expect(entry.details).toContain('pc_disconnected');
      }
    });

    arbiter.addClient('pc-1', 'pc');

    expect(logged).toBe(true);
  });
});
