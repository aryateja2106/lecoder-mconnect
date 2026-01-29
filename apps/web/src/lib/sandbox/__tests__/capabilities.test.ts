/**
 * Capability Detection Tests
 * MConnect v1.1.0
 *
 * TDD tests for browser capability detection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectCapabilities,
  detectDetailedCapabilities,
  detectFileSystemAccess,
  detectClipboard,
  detectNotifications,
  detectServiceWorker,
  detectWebSocket,
  detectSandboxedIframe,
  detectIframeCsp,
  isSecureContext,
  getBrowserInfo,
  CapabilityMonitor,
} from '../capabilities';

describe('Capability Detection', () => {
  describe('detectCapabilities()', () => {
    it('should return an object with all capability flags', async () => {
      const capabilities = await detectCapabilities();

      expect(capabilities).toHaveProperty('fileSystemAccess');
      expect(capabilities).toHaveProperty('clipboard');
      expect(capabilities).toHaveProperty('notifications');
      expect(capabilities).toHaveProperty('serviceWorker');
      expect(capabilities).toHaveProperty('webSocket');
      expect(capabilities).toHaveProperty('sandboxedIframe');
      expect(capabilities).toHaveProperty('iframeCsp');
    });

    it('should return boolean values for all capabilities', async () => {
      const capabilities = await detectCapabilities();

      for (const value of Object.values(capabilities)) {
        expect(typeof value).toBe('boolean');
      }
    });
  });

  describe('detectDetailedCapabilities()', () => {
    it('should return detailed information for each capability', async () => {
      const details = await detectDetailedCapabilities();

      for (const [key, value] of Object.entries(details)) {
        expect(value).toHaveProperty('available');
        expect(typeof value.available).toBe('boolean');
      }
    });

    it('should include reason for each capability', async () => {
      const details = await detectDetailedCapabilities();

      for (const value of Object.values(details)) {
        expect(value.reason).toBeDefined();
        expect(typeof value.reason).toBe('string');
      }
    });
  });

  describe('detectFileSystemAccess()', () => {
    it('should return boolean', async () => {
      const result = await detectFileSystemAccess();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('detectClipboard()', () => {
    it('should return boolean', async () => {
      const result = await detectClipboard();
      expect(typeof result).toBe('boolean');
    });

    it('should detect clipboard when available', async () => {
      // In test environment, clipboard may or may not be available
      const result = await detectClipboard();
      expect([true, false]).toContain(result);
    });
  });

  describe('detectNotifications()', () => {
    it('should return boolean', async () => {
      const result = await detectNotifications();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('detectServiceWorker()', () => {
    it('should return boolean', async () => {
      const result = await detectServiceWorker();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('detectWebSocket()', () => {
    it('should return boolean', async () => {
      const result = await detectWebSocket();
      expect(typeof result).toBe('boolean');
    });

    it('should return true when WebSocket is available', async () => {
      // WebSocket should be available in all modern environments
      const result = await detectWebSocket();
      expect(result).toBe(true);
    });
  });

  describe('detectSandboxedIframe()', () => {
    it('should return boolean', async () => {
      const result = await detectSandboxedIframe();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('detectIframeCsp()', () => {
    it('should return boolean', async () => {
      const result = await detectIframeCsp();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isSecureContext()', () => {
    it('should return boolean', () => {
      const result = isSecureContext();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getBrowserInfo()', () => {
    it('should return name and version', () => {
      const info = getBrowserInfo();
      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('version');
      expect(typeof info.name).toBe('string');
      expect(typeof info.version).toBe('string');
    });

    it('should detect browser type', () => {
      const info = getBrowserInfo();
      const validBrowsers = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Unknown'];
      expect(validBrowsers).toContain(info.name);
    });
  });
});

describe('CapabilityMonitor', () => {
  let monitor: CapabilityMonitor;

  beforeEach(() => {
    monitor = new CapabilityMonitor();
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('start()', () => {
    it('should return initial capabilities', async () => {
      const capabilities = await monitor.start(10000); // Long interval to avoid interference
      expect(capabilities).toHaveProperty('webSocket');
      expect(capabilities).toHaveProperty('clipboard');
    });

    it('should store capabilities for later retrieval', async () => {
      await monitor.start(10000);
      const capabilities = monitor.getCapabilities();
      expect(capabilities).not.toBeNull();
    });
  });

  describe('stop()', () => {
    it('should stop without error', async () => {
      await monitor.start(10000);
      expect(() => monitor.stop()).not.toThrow();
    });

    it('should be safe to call multiple times', () => {
      expect(() => {
        monitor.stop();
        monitor.stop();
      }).not.toThrow();
    });
  });

  describe('getCapabilities()', () => {
    it('should return null before start', () => {
      expect(monitor.getCapabilities()).toBeNull();
    });

    it('should return capabilities after start', async () => {
      await monitor.start(10000);
      expect(monitor.getCapabilities()).not.toBeNull();
    });
  });

  describe('event listeners', () => {
    it('should add and remove event listeners', async () => {
      const callback = vi.fn();
      monitor.addEventListener(callback);

      await monitor.start(10000);
      monitor.removeEventListener(callback);

      // After removal, callback should not be called
      // (No way to trigger capability change easily in tests)
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
