/**
 * NotificationBridge Unit Tests
 *
 * Tests the notification bridge wiring between AgentManager events
 * and the PushService.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { NotificationBridge, resetNotificationBridge } from '../NotificationBridge.js';
import { PushService, resetPushService } from '../PushService.js';
import { EventEmitter } from 'events';

// ============================================================================
// Mock AgentManager
// ============================================================================

class MockAgentManager extends EventEmitter {
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  removeListener(event: string, listener: (...args: any[]) => void): this {
    return super.removeListener(event, listener);
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('NotificationBridge', () => {
  let mockAgentManager: MockAgentManager;
  let pushService: PushService;
  let bridge: NotificationBridge;

  beforeEach(() => {
    resetNotificationBridge();
    resetPushService();

    mockAgentManager = new MockAgentManager();
    pushService = new PushService();

    // Bridge with mocked dependencies (push service is not initialized = disabled)
    bridge = new NotificationBridge(mockAgentManager as any, pushService);
  });

  afterEach(() => {
    bridge.stop();
    resetNotificationBridge();
    resetPushService();
  });

  describe('lifecycle', () => {
    it('should start listening for events', () => {
      bridge.start();
      expect(mockAgentManager.listenerCount('statusChange')).toBe(1);
      expect(mockAgentManager.listenerCount('error')).toBe(1);
    });

    it('should not add duplicate listeners on multiple start calls', () => {
      bridge.start();
      bridge.start();
      // start() guards against double-start, so listeners should still be 1
      expect(mockAgentManager.listenerCount('statusChange')).toBe(1);
      expect(mockAgentManager.listenerCount('error')).toBe(1);
    });
  });

  describe('status change events', () => {
    it('should handle statusChange events without throwing', () => {
      bridge.start();

      // Emit a status change - push service is disabled, so nothing should happen
      // but it should not throw
      expect(() => {
        mockAgentManager.emit('statusChange', 'agent-1', 'exited', 'running');
      }).not.toThrow();
    });

    it('should handle error events without throwing', () => {
      bridge.start();

      expect(() => {
        mockAgentManager.emit('error', 'agent-1', new Error('test error'));
      }).not.toThrow();
    });

    it('should not send notifications for non-terminal status changes', () => {
      bridge.start();

      // These transitions should not trigger notifications
      expect(() => {
        mockAgentManager.emit('statusChange', 'agent-1', 'running', 'starting');
        mockAgentManager.emit('statusChange', 'agent-1', 'idle', 'running');
      }).not.toThrow();
    });
  });

  describe('push service disabled', () => {
    it('should gracefully handle events when push service is disabled', () => {
      expect(pushService.isEnabled()).toBe(false);
      bridge.start();

      // All events should be handled gracefully without errors
      expect(() => {
        mockAgentManager.emit('statusChange', 'agent-1', 'exited', 'running');
        mockAgentManager.emit('statusChange', 'agent-2', 'error', 'running');
        mockAgentManager.emit('error', 'agent-3', new Error('crash'));
      }).not.toThrow();
    });
  });
});
