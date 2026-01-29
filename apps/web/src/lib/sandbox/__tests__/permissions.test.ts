/**
 * Permission Manager Tests
 * MConnect v1.1.0
 *
 * TDD tests for browser permission management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PermissionManager } from '../permissions';
import type { PermissionType, SandboxEvent } from '../types';

describe('PermissionManager', () => {
  let manager: PermissionManager;

  beforeEach(() => {
    manager = new PermissionManager();
  });

  describe('initialization', () => {
    it('should initialize with all permissions in prompt state', () => {
      const permissions: PermissionType[] = [
        'terminal_view',
        'terminal_input',
        'file_download',
        'clipboard_read',
        'clipboard_write',
        'notification',
      ];

      for (const type of permissions) {
        expect(manager.getState(type)).toBe('prompt');
      }
    });

    it('should return prompt for unknown permission types', () => {
      // @ts-expect-error - Testing invalid type
      expect(manager.getState('unknown_permission')).toBe('prompt');
    });
  });

  describe('getState()', () => {
    it('should return current permission state', () => {
      expect(manager.getState('terminal_view')).toBe('prompt');
    });

    it('should return prompt for expired permissions', () => {
      // Grant with immediate expiration
      manager.grant('terminal_view', -1);
      expect(manager.getState('terminal_view')).toBe('prompt');
    });

    it('should return granted for non-expired permissions', () => {
      manager.grant('terminal_view', 60000); // 1 minute
      expect(manager.getState('terminal_view')).toBe('granted');
    });
  });

  describe('getConfig()', () => {
    it('should return full permission configuration', () => {
      manager.grant('terminal_input');
      const config = manager.getConfig('terminal_input');

      expect(config).toBeDefined();
      expect(config?.type).toBe('terminal_input');
      expect(config?.state).toBe('granted');
      expect(config?.grantedAt).toBeInstanceOf(Date);
    });

    it('should return undefined for uninitialized permission', () => {
      // @ts-expect-error - Testing invalid type
      expect(manager.getConfig('fake_permission')).toBeUndefined();
    });
  });

  describe('getAllPermissions()', () => {
    it('should return all permissions as a Map', () => {
      const permissions = manager.getAllPermissions();
      expect(permissions).toBeInstanceOf(Map);
      expect(permissions.size).toBe(6);
    });

    it('should return a copy, not the original Map', () => {
      const permissions = manager.getAllPermissions();
      permissions.clear();
      expect(manager.getAllPermissions().size).toBe(6);
    });
  });

  describe('grant()', () => {
    it('should grant permission immediately', () => {
      manager.grant('terminal_view');
      expect(manager.getState('terminal_view')).toBe('granted');
    });

    it('should set grantedAt timestamp', () => {
      const before = new Date();
      manager.grant('terminal_view');
      const config = manager.getConfig('terminal_view');

      expect(config?.grantedAt).toBeDefined();
      expect(config!.grantedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should set expiration when expiresIn provided', () => {
      manager.grant('terminal_view', 60000);
      const config = manager.getConfig('terminal_view');

      expect(config?.expiresAt).toBeDefined();
      expect(config!.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('deny()', () => {
    it('should deny permission', () => {
      manager.deny('terminal_input');
      expect(manager.getState('terminal_input')).toBe('denied');
    });

    it('should clear grantedAt and expiresAt', () => {
      manager.grant('terminal_view', 60000);
      manager.deny('terminal_view');
      const config = manager.getConfig('terminal_view');

      expect(config?.grantedAt).toBeUndefined();
      expect(config?.expiresAt).toBeUndefined();
    });
  });

  describe('reset()', () => {
    it('should reset permission to prompt state', () => {
      manager.grant('terminal_view');
      manager.reset('terminal_view');
      expect(manager.getState('terminal_view')).toBe('prompt');
    });
  });

  describe('resetAll()', () => {
    it('should reset all permissions to prompt state', () => {
      manager.grant('terminal_view');
      manager.grant('terminal_input');
      manager.deny('clipboard_read');

      manager.resetAll();

      expect(manager.getState('terminal_view')).toBe('prompt');
      expect(manager.getState('terminal_input')).toBe('prompt');
      expect(manager.getState('clipboard_read')).toBe('prompt');
    });
  });

  describe('isGranted()', () => {
    it('should return true when permission is granted', () => {
      manager.grant('terminal_view');
      expect(manager.isGranted('terminal_view')).toBe(true);
    });

    it('should return false when permission is denied', () => {
      manager.deny('terminal_view');
      expect(manager.isGranted('terminal_view')).toBe(false);
    });

    it('should return false when permission is prompt', () => {
      expect(manager.isGranted('terminal_view')).toBe(false);
    });
  });

  describe('areAllGranted()', () => {
    it('should return true when all permissions are granted', () => {
      manager.grant('terminal_view');
      manager.grant('terminal_input');
      expect(manager.areAllGranted(['terminal_view', 'terminal_input'])).toBe(true);
    });

    it('should return false when any permission is not granted', () => {
      manager.grant('terminal_view');
      expect(manager.areAllGranted(['terminal_view', 'terminal_input'])).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(manager.areAllGranted([])).toBe(true);
    });
  });

  describe('event listeners', () => {
    it('should emit permission_changed event when permission changes', () => {
      const callback = vi.fn();
      manager.addEventListener(callback);

      manager.grant('terminal_view');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'permission_changed',
          data: expect.objectContaining({
            type: 'terminal_view',
            state: 'granted',
          }),
        })
      );
    });

    it('should remove event listener', () => {
      const callback = vi.fn();
      manager.addEventListener(callback);
      manager.removeEventListener(callback);

      manager.grant('terminal_view');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle errors in listeners gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });
      const goodCallback = vi.fn();

      manager.addEventListener(errorCallback);
      manager.addEventListener(goodCallback);

      // Should not throw
      expect(() => manager.grant('terminal_view')).not.toThrow();

      // Both callbacks should have been attempted
      expect(errorCallback).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalled();
    });
  });

  describe('request()', () => {
    beforeEach(() => {
      // Mock navigator.clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          readText: vi.fn().mockResolvedValue(''),
          writeText: vi.fn().mockResolvedValue(undefined),
        },
        writable: true,
        configurable: true,
      });
    });

    it('should return granted for already granted permissions without forcing prompt', async () => {
      manager.grant('terminal_view');
      const result = await manager.request('terminal_view');
      expect(result).toBe('granted');
    });

    it('should return denied for already denied permissions without forcing prompt', async () => {
      manager.deny('terminal_view');
      const result = await manager.request('terminal_view');
      expect(result).toBe('denied');
    });

    it('should grant app-level permissions automatically', async () => {
      const result = await manager.request('terminal_view');
      expect(result).toBe('granted');
    });

    it('should attempt clipboard read permission', async () => {
      const result = await manager.request('clipboard_read');
      expect(result).toBe('granted');
      expect(navigator.clipboard.readText).toHaveBeenCalled();
    });

    it('should handle clipboard permission failure', async () => {
      (navigator.clipboard.readText as any).mockRejectedValue(new Error('Denied'));
      const result = await manager.request('clipboard_read');
      expect(result).toBe('denied');
    });
  });
});
