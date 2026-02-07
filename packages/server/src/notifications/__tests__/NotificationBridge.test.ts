/**
 * NotificationBridge Unit Tests
 *
 * Tests the notification bridge wiring between AgentManager events
 * and the PushService.
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { NotificationBridge, resetNotificationBridge } from '../NotificationBridge.js';
import { PushService, resetPushService } from '../PushService.js';
import * as agentRepo from '../../db/repositories/agent.js';
import * as sessionRepo from '../../db/repositories/session.js';
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

    it('should remove listeners on stop', () => {
      bridge.start();
      expect(mockAgentManager.listenerCount('statusChange')).toBe(1);
      expect(mockAgentManager.listenerCount('error')).toBe(1);

      bridge.stop();
      expect(mockAgentManager.listenerCount('statusChange')).toBe(0);
      expect(mockAgentManager.listenerCount('error')).toBe(0);
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

  describe('notification dispatch (enabled)', () => {
    let notifyCompletedSpy: ReturnType<typeof spyOn>;
    let notifyErrorSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      // Mock push service as enabled and spy on notification methods
      spyOn(pushService, 'isEnabled').mockReturnValue(true);
      notifyCompletedSpy = spyOn(pushService, 'notifyAgentCompleted').mockResolvedValue(undefined as any);
      notifyErrorSpy = spyOn(pushService, 'notifyAgentError').mockResolvedValue(undefined as any);

      // Mock DB lookups for agent context resolution
      spyOn(agentRepo.agentRepository, 'findById').mockResolvedValue({
        id: 'agent-1',
        sessionId: 'session-1',
        name: 'Claude',
        status: 'exited',
        config: {} as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      spyOn(sessionRepo.sessionRepository, 'findById').mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        name: 'Test Session',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    });

    it('should call notifyAgentCompleted on exited from running', async () => {
      bridge.start();
      mockAgentManager.emit('statusChange', 'agent-1', 'exited', 'running');

      // Wait for async handler to complete
      await new Promise((r) => setTimeout(r, 50));

      expect(notifyCompletedSpy).toHaveBeenCalledWith('user-1', 'agent-1', 'Claude', 'session-1');
    });

    it('should call notifyAgentError on error from running', async () => {
      bridge.start();
      mockAgentManager.emit('statusChange', 'agent-1', 'error', 'running');

      await new Promise((r) => setTimeout(r, 50));

      expect(notifyErrorSpy).toHaveBeenCalledWith('user-1', 'agent-1', 'Claude', 'session-1');
    });

    it('should call notifyAgentError on error event', async () => {
      bridge.start();
      mockAgentManager.emit('error', 'agent-1', new Error('process crashed'));

      await new Promise((r) => setTimeout(r, 50));

      expect(notifyErrorSpy).toHaveBeenCalledWith('user-1', 'agent-1', 'Claude', 'session-1');
    });

    it('should not notify on non-terminal transitions', async () => {
      bridge.start();
      mockAgentManager.emit('statusChange', 'agent-1', 'running', 'starting');
      mockAgentManager.emit('statusChange', 'agent-1', 'idle', 'running');

      await new Promise((r) => setTimeout(r, 50));

      expect(notifyCompletedSpy).not.toHaveBeenCalled();
      expect(notifyErrorSpy).not.toHaveBeenCalled();
    });
  });
});
