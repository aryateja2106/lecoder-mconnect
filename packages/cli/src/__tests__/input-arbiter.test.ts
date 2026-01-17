/**
 * InputArbiter Unit Tests
 * MConnect v0.2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputArbiter, type AuditLogEntry } from '../input/InputArbiter.js';

describe('InputArbiter', () => {
  let arbiter: InputArbiter;

  beforeEach(() => {
    arbiter = new InputArbiter('test-session-1');
    arbiter.start();
  });

  afterEach(() => {
    arbiter.stop();
  });

  describe('client management', () => {
    it('should add clients', () => {
      arbiter.addClient('pc-1', 'pc');
      arbiter.addClient('mobile-1', 'mobile');

      const clients = arbiter.getClients();
      expect(clients.length).toBe(2);
    });

    it('should remove clients', () => {
      arbiter.addClient('pc-1', 'pc');
      arbiter.addClient('mobile-1', 'mobile');
      arbiter.removeClient('pc-1');

      const clients = arbiter.getClients();
      expect(clients.length).toBe(1);
      expect(clients[0].clientId).toBe('mobile-1');
    });

    it('should assign correct default priorities', () => {
      arbiter.addClient('pc-1', 'pc');
      arbiter.addClient('mobile-1', 'mobile');

      const pcClient = arbiter.getClient('pc-1');
      const mobileClient = arbiter.getClient('mobile-1');

      expect(pcClient?.priority).toBe('high');
      expect(mobileClient?.priority).toBe('normal');
    });
  });

  describe('state machine', () => {
    it('should start in pc_disconnected state', () => {
      expect(arbiter.getState()).toBe('pc_disconnected');
    });

    it('should transition to pc_active when PC client connects', () => {
      arbiter.addClient('pc-1', 'pc');
      // Simulate activity
      arbiter.processInput('pc-1', 'x');
      expect(arbiter.getState()).toBe('pc_active');
    });

    it('should stay pc_disconnected if only mobile connects', () => {
      arbiter.addClient('mobile-1', 'mobile');
      expect(arbiter.getState()).toBe('pc_disconnected');
    });
  });

  describe('processInput', () => {
    it('should accept input from PC client', () => {
      arbiter.addClient('pc-1', 'pc');
      const result = arbiter.processInput('pc-1', 'hello');

      expect(result.accepted).toBe(true);
    });

    it('should accept input from mobile when no PC connected', () => {
      arbiter.addClient('mobile-1', 'mobile');
      const result = arbiter.processInput('mobile-1', 'hello');

      expect(result.accepted).toBe(true);
    });

    it('should reject input from unknown client', () => {
      const result = arbiter.processInput('unknown-client', 'hello');

      expect(result.accepted).toBe(false);
      expect(result.rejectReason).toBe('read_only');
    });

    it('should reject input from observer clients', () => {
      arbiter.addClient('observer-1', 'mobile', 'observer');
      const result = arbiter.processInput('observer-1', 'hello');

      expect(result.accepted).toBe(false);
      expect(result.rejectReason).toBe('read_only');
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limit', () => {
      arbiter.addClient('pc-1', 'pc');

      // Send input that's under the limit (default is 100 chars/sec)
      const input1 = 'x'.repeat(50);
      const result1 = arbiter.processInput('pc-1', input1);
      expect(result1.accepted).toBe(true);

      // Send another input that's under the limit (cumulative: 90 chars)
      const input2 = 'y'.repeat(40);
      const result2 = arbiter.processInput('pc-1', input2);
      expect(result2.accepted).toBe(true);

      // Next input should be rate limited (cumulative: 90 + 20 = 110 > 100)
      const result = arbiter.processInput('pc-1', 'x'.repeat(20));
      expect(result.accepted).toBe(false);
      expect(result.rejectReason).toBe('rate_limited');
    });

    it('should reset rate limit after window expires', async () => {
      // Create arbiter with very short rate window
      const fastArbiter = new InputArbiter('test-fast', {
        inputRateLimitCps: 10,
      });
      fastArbiter.start();
      fastArbiter.addClient('pc-1', 'pc');

      // Exhaust rate limit
      fastArbiter.processInput('pc-1', 'x'.repeat(10));
      let result = fastArbiter.processInput('pc-1', 'y');
      expect(result.accepted).toBe(false);

      // Wait for rate limit to reset
      await new Promise((resolve) => setTimeout(resolve, 1100));

      result = fastArbiter.processInput('pc-1', 'z');
      expect(result.accepted).toBe(true);

      fastArbiter.stop();
    });
  });

  describe('exclusive control', () => {
    it('should grant exclusive control to mobile client', () => {
      arbiter.addClient('pc-1', 'pc');
      arbiter.addClient('mobile-1', 'mobile');

      const granted = arbiter.requestExclusiveControl('mobile-1');
      expect(granted).toBe(true);
      expect(arbiter.getState()).toBe('mobile_exclusive');
    });

    it('should reject exclusive control request from PC', () => {
      arbiter.addClient('pc-1', 'pc');

      const granted = arbiter.requestExclusiveControl('pc-1');
      expect(granted).toBe(false);
    });

    it('should reject second exclusive control request', () => {
      arbiter.addClient('mobile-1', 'mobile');
      arbiter.addClient('mobile-2', 'mobile');

      arbiter.requestExclusiveControl('mobile-1');
      const granted = arbiter.requestExclusiveControl('mobile-2');

      expect(granted).toBe(false);
    });

    it('should block PC input during mobile exclusive', () => {
      arbiter.addClient('pc-1', 'pc');
      arbiter.addClient('mobile-1', 'mobile');

      arbiter.requestExclusiveControl('mobile-1');

      const pcResult = arbiter.processInput('pc-1', 'test');
      expect(pcResult.accepted).toBe(false);
      expect(pcResult.rejectReason).toBe('other_exclusive');

      const mobileResult = arbiter.processInput('mobile-1', 'test');
      expect(mobileResult.accepted).toBe(true);
    });

    it('should release exclusive control', () => {
      arbiter.addClient('mobile-1', 'mobile');
      arbiter.requestExclusiveControl('mobile-1');

      const released = arbiter.releaseExclusiveControl();
      expect(released).toBe(true);
      expect(arbiter.getState()).toBe('pc_disconnected');
    });

    it('should auto-release exclusive control on timeout', async () => {
      // Create arbiter with short exclusive timeout
      const fastArbiter = new InputArbiter('test-fast', {
        exclusiveTimeoutMs: 100, // 100ms for testing
      });
      fastArbiter.start();
      fastArbiter.addClient('mobile-1', 'mobile');
      fastArbiter.requestExclusiveControl('mobile-1');

      expect(fastArbiter.getState()).toBe('mobile_exclusive');

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(fastArbiter.getState()).toBe('pc_disconnected');
      fastArbiter.stop();
    });
  });

  describe('events', () => {
    it('should emit stateChange event', () => {
      const handler = vi.fn();
      arbiter.on('stateChange', handler);

      arbiter.addClient('pc-1', 'pc');
      arbiter.processInput('pc-1', 'x');

      expect(handler).toHaveBeenCalled();
      const [newState, oldState] = handler.mock.calls[0];
      expect(newState).toBe('pc_active');
      expect(oldState).toBe('pc_disconnected');
    });

    it('should emit inputRejected event', () => {
      const handler = vi.fn();
      arbiter.on('inputRejected', handler);

      // Add PC to make state pc_active
      arbiter.addClient('pc-1', 'pc');
      arbiter.processInput('pc-1', 'x'); // Activate PC

      // Add mobile and test rejection (should be rejected because PC is active)
      arbiter.addClient('mobile-1', 'mobile');
      arbiter.processInput('mobile-1', 'test');

      expect(handler).toHaveBeenCalledWith('mobile-1', 'test', 'pc_typing');
    });

    it('should emit controlGranted event', () => {
      const handler = vi.fn();
      arbiter.on('controlGranted', handler);

      arbiter.addClient('mobile-1', 'mobile');
      arbiter.requestExclusiveControl('mobile-1');

      expect(handler).toHaveBeenCalledWith('mobile-1', 'exclusive');
    });

    it('should emit controlReleased event', () => {
      const handler = vi.fn();
      arbiter.on('controlReleased', handler);

      arbiter.addClient('mobile-1', 'mobile');
      arbiter.requestExclusiveControl('mobile-1');
      arbiter.releaseExclusiveControl();

      expect(handler).toHaveBeenCalledWith('mobile-1');
    });
  });

  describe('audit logging', () => {
    it('should call audit logger on control granted', () => {
      const auditHandler = vi.fn();
      arbiter.setAuditLogger(auditHandler);

      arbiter.addClient('mobile-1', 'mobile');
      arbiter.requestExclusiveControl('mobile-1');

      expect(auditHandler).toHaveBeenCalled();
      const entry: AuditLogEntry = auditHandler.mock.calls.find(
        (call: any[]) => call[0].eventType === 'control_granted'
      )?.[0];
      expect(entry).toBeDefined();
      expect(entry.clientId).toBe('mobile-1');
      expect(entry.details).toContain('Exclusive control granted');
    });

    it('should call audit logger on control released', () => {
      const auditHandler = vi.fn();
      arbiter.setAuditLogger(auditHandler);

      arbiter.addClient('mobile-1', 'mobile');
      arbiter.requestExclusiveControl('mobile-1');
      arbiter.releaseExclusiveControl();

      const entry: AuditLogEntry = auditHandler.mock.calls.find(
        (call: any[]) => call[0].eventType === 'control_released'
      )?.[0];
      expect(entry).toBeDefined();
      expect(entry.clientId).toBe('mobile-1');
    });

    it('should call audit logger on state change', () => {
      const auditHandler = vi.fn();
      arbiter.setAuditLogger(auditHandler);

      arbiter.addClient('pc-1', 'pc');
      arbiter.processInput('pc-1', 'x');

      const entry: AuditLogEntry = auditHandler.mock.calls.find(
        (call: any[]) => call[0].eventType === 'state_change'
      )?.[0];
      expect(entry).toBeDefined();
      expect(entry.details).toContain('pc_disconnected');
      expect(entry.details).toContain('pc_active');
    });
  });

  describe('getControlState', () => {
    it('should return current control state', () => {
      arbiter.addClient('pc-1', 'pc');
      arbiter.processInput('pc-1', 'x');

      const state = arbiter.getControlState();
      expect(state.state).toBe('pc_active');
      expect(state.currentOwner).toBe('pc-1');
    });

    it('should include exclusive expiry when in exclusive mode', () => {
      arbiter.addClient('mobile-1', 'mobile');
      arbiter.requestExclusiveControl('mobile-1');

      const state = arbiter.getControlState();
      expect(state.state).toBe('mobile_exclusive');
      expect(state.exclusiveExpires).toBeDefined();
    });
  });
});
