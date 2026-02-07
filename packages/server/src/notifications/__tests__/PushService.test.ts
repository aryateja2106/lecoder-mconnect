/**
 * PushService Unit Tests
 *
 * Tests the push notification service logic.
 * APNs communication is tested with mocked fetch.
 */

import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { PushService, resetPushService } from '../PushService.js';
import * as deviceTokenRepo from '../../db/repositories/device-token.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Generate a valid ES256 PEM private key for testing.
 * This is a throwaway key used only in tests.
 */
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgHzLyd3rlBYms0eMI
uTkomAGzk2NHK4LLLC/IkrcdbQ6hRANCAARa3dzGb1Mq3tDRQiEs8GHxAWMoX7VQ
+yNlzvYk03EIC73B5XdcWDo8a51vRtd7vA7C2cToz8JKfh8TXf/gpoU1
-----END PRIVATE KEY-----`;

// ============================================================================
// Tests
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

    it('should be enabled with valid APNs credentials', async () => {
      await service.initialize({
        keyId: 'TESTKEY123',
        teamId: 'TESTTEAM',
        privateKey: TEST_PRIVATE_KEY,
        bundleId: 'com.test.app',
        production: false,
      });
      expect(service.isEnabled()).toBe(true);
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

  describe('notification methods (disabled)', () => {
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

  describe('notification sending (enabled)', () => {
    let originalFetch: typeof globalThis.fetch;
    let fetchSpy: ReturnType<typeof mock>;

    beforeEach(async () => {
      originalFetch = globalThis.fetch;

      // Mock fetch to simulate APNs success
      fetchSpy = mock(() =>
        Promise.resolve(new Response(null, { status: 200 }))
      );
      globalThis.fetch = fetchSpy as any;

      // Mock device token repository
      spyOn(deviceTokenRepo.deviceTokenRepository, 'getActiveTokensByUser').mockResolvedValue([
        {
          id: 'dt-1',
          userId: 'user-1',
          token: 'a'.repeat(64),
          platform: 'ios' as const,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await service.initialize({
        keyId: 'TESTKEY123',
        teamId: 'TESTTEAM',
        privateKey: TEST_PRIVATE_KEY,
        bundleId: 'com.test.app',
        production: false,
      });
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should send notification to APNs and return success', async () => {
      const results = await service.sendToUser('user-1', {
        type: 'agent_completed',
        title: 'Agent Done',
        body: 'Claude finished',
        sessionId: 'session-1',
        agentId: 'agent-1',
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.success).toBe(true);
      expect(results[0]!.deviceToken).toBe('a'.repeat(64));
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Verify fetch was called with sandbox URL
      const fetchCall = (fetchSpy as any).mock.calls[0];
      expect(fetchCall[0]).toContain('api.sandbox.push.apple.com');
      expect(fetchCall[0]).toContain('a'.repeat(64));
    });

    it('should deactivate tokens on BadDeviceToken error', async () => {
      const deactivateSpy = spyOn(
        deviceTokenRepo.deviceTokenRepository,
        'deactivateToken'
      ).mockResolvedValue(true);

      // Mock fetch to return APNs error
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ reason: 'BadDeviceToken' }), { status: 410 })
        )
      ) as any;

      const results = await service.sendToUser('user-1', {
        type: 'agent_error',
        title: 'Error',
        body: 'Agent failed',
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.success).toBe(false);
      expect(results[0]!.reason).toBe('BadDeviceToken');
      expect(deactivateSpy).toHaveBeenCalledWith('a'.repeat(64));
    });

    it('should return empty results when user has no device tokens', async () => {
      spyOn(deviceTokenRepo.deviceTokenRepository, 'getActiveTokensByUser').mockResolvedValue([]);

      const results = await service.sendToUser('user-no-devices', {
        type: 'agent_completed',
        title: 'Test',
        body: 'Test',
      });

      expect(results).toEqual([]);
    });

    it('notifyAgentCompleted should send via APNs', async () => {
      await service.notifyAgentCompleted('user-1', 'agent-1', 'Claude', 'session-1');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('notifyAgentError should send via APNs', async () => {
      await service.notifyAgentError('user-1', 'agent-1', 'Claude', 'session-1');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
