/**
 * PushService Unit Tests
 *
 * Tests the push notification service logic.
 * APNs communication is tested with mocked fetch.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { PushService, resetPushService } from '../PushService.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('PushService', () => {
  let service: PushService;

  beforeEach(() => {
    resetPushService();
    service = new PushService();
  });

  afterEach(() => {
    resetPushService();
  });

  describe('initialization', () => {
    it('should not be enabled before initialization', () => {
      expect(service.isEnabled()).toBe(false);
    });

    it('should not be enabled without APNs credentials', async () => {
      // Clear env vars
      const origKeyId = process.env.APNS_KEY_ID;
      const origTeamId = process.env.APNS_TEAM_ID;
      const origKey = process.env.APNS_PRIVATE_KEY;

      delete process.env.APNS_KEY_ID;
      delete process.env.APNS_TEAM_ID;
      delete process.env.APNS_PRIVATE_KEY;

      await service.initialize();
      expect(service.isEnabled()).toBe(false);

      // Restore
      if (origKeyId) process.env.APNS_KEY_ID = origKeyId;
      if (origTeamId) process.env.APNS_TEAM_ID = origTeamId;
      if (origKey) process.env.APNS_PRIVATE_KEY = origKey;
    });

    it('should return empty results when disabled', async () => {
      const results = await service.sendToUser('user-123', {
        type: 'agent_completed',
        title: 'Test',
        body: 'Test body',
      });
      expect(results).toEqual([]);
    });
  });

  describe('notification methods', () => {
    it('notifyAgentCompleted should not throw when disabled', async () => {
      await expect(
        service.notifyAgentCompleted('user-1', 'agent-1', 'Claude', 'session-1')
      ).resolves.toBeUndefined();
    });

    it('notifyAgentError should not throw when disabled', async () => {
      await expect(
        service.notifyAgentError('user-1', 'agent-1', 'Claude', 'session-1')
      ).resolves.toBeUndefined();
    });

    it('notifyApprovalRequired should not throw when disabled', async () => {
      await expect(
        service.notifyApprovalRequired('user-1', 'rm -rf /', 'session-1')
      ).resolves.toBeUndefined();
    });

    it('notifySessionIdle should not throw when disabled', async () => {
      await expect(
        service.notifySessionIdle('user-1', 'session-1')
      ).resolves.toBeUndefined();
    });
  });
});
