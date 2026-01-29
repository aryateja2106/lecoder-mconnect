/**
 * CSP Configuration Tests
 * MConnect v1.1.0
 *
 * TDD tests for Content Security Policy configuration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CSP_PRESETS,
  buildCSPString,
  createCSPConfig,
  addSource,
  removeSource,
  allowWebSocket,
  generateSandboxCSP,
  CSPViolationMonitor,
} from '../csp';
import type { CSPConfig } from '../types';

describe('CSP Configuration', () => {
  describe('CSP_PRESETS', () => {
    it('should have all required presets', () => {
      expect(CSP_PRESETS).toHaveProperty('strict');
      expect(CSP_PRESETS).toHaveProperty('default');
      expect(CSP_PRESETS).toHaveProperty('permissive');
      expect(CSP_PRESETS).toHaveProperty('terminal-only');
    });

    it('should have all required directives in each preset', () => {
      const requiredDirectives = [
        'defaultSrc',
        'scriptSrc',
        'styleSrc',
        'connectSrc',
        'imgSrc',
        'fontSrc',
        'frameSrc',
        'workerSrc',
      ];

      for (const preset of Object.values(CSP_PRESETS)) {
        for (const directive of requiredDirectives) {
          expect(preset).toHaveProperty(directive);
          expect(Array.isArray(preset[directive as keyof CSPConfig])).toBe(true);
        }
      }
    });

    it('strict preset should block most sources', () => {
      const strict = CSP_PRESETS.strict;
      expect(strict.defaultSrc).toContain("'none'");
      expect(strict.frameSrc).toContain("'none'");
      expect(strict.workerSrc).toContain("'none'");
    });

    it('default preset should allow WebSocket connections', () => {
      const defaultPreset = CSP_PRESETS.default;
      expect(defaultPreset.connectSrc).toContain('wss:');
      expect(defaultPreset.connectSrc).toContain('ws:');
    });

    it('terminal-only preset should allow styles for xterm.js', () => {
      const terminalOnly = CSP_PRESETS['terminal-only'];
      expect(terminalOnly.styleSrc).toContain("'unsafe-inline'");
    });
  });

  describe('buildCSPString()', () => {
    it('should build valid CSP string from config', () => {
      const config: CSPConfig = {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", 'wss:'],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        frameSrc: ["'none'"],
        workerSrc: ["'self'"],
      };

      const cspString = buildCSPString(config);

      expect(cspString).toContain("default-src 'self'");
      expect(cspString).toContain("script-src 'self'");
      expect(cspString).toContain("style-src 'self' 'unsafe-inline'");
      expect(cspString).toContain("connect-src 'self' wss:");
    });

    it('should join multiple sources with spaces', () => {
      const config: CSPConfig = {
        defaultSrc: ["'self'", 'https://example.com'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'"],
        fontSrc: ["'self'"],
        frameSrc: ["'self'"],
        workerSrc: ["'self'"],
      };

      const cspString = buildCSPString(config);
      expect(cspString).toContain("default-src 'self' https://example.com");
    });

    it('should separate directives with semicolons', () => {
      const config = CSP_PRESETS.default;
      const cspString = buildCSPString(config);
      expect(cspString.split(';').length).toBeGreaterThan(1);
    });

    it('should skip empty directives', () => {
      const config: CSPConfig = {
        defaultSrc: ["'self'"],
        scriptSrc: [],
        styleSrc: ["'self'"],
        connectSrc: [],
        imgSrc: ["'self'"],
        fontSrc: [],
        frameSrc: [],
        workerSrc: [],
      };

      const cspString = buildCSPString(config);
      expect(cspString).not.toContain('script-src');
      expect(cspString).not.toContain('connect-src');
    });
  });

  describe('createCSPConfig()', () => {
    it('should create config from preset', () => {
      const config = createCSPConfig('default');
      expect(config).toEqual(CSP_PRESETS.default);
    });

    it('should apply overrides to preset', () => {
      const config = createCSPConfig('default', {
        connectSrc: ['https://custom.example.com'],
      });

      expect(config.connectSrc).toEqual(['https://custom.example.com']);
      // Other directives should remain from preset
      expect(config.defaultSrc).toEqual(CSP_PRESETS.default.defaultSrc);
    });

    it('should not mutate original preset', () => {
      const originalConnectSrc = [...CSP_PRESETS.default.connectSrc];
      createCSPConfig('default', {
        connectSrc: ['https://custom.example.com'],
      });

      expect(CSP_PRESETS.default.connectSrc).toEqual(originalConnectSrc);
    });
  });

  describe('addSource()', () => {
    it('should add source to directive', () => {
      const config = createCSPConfig('default');
      const updated = addSource(config, 'connectSrc', 'https://new.example.com');

      expect(updated.connectSrc).toContain('https://new.example.com');
    });

    it('should not duplicate existing source', () => {
      const config = createCSPConfig('default');
      const updated = addSource(config, 'connectSrc', "'self'");

      const selfCount = updated.connectSrc.filter((s) => s === "'self'").length;
      expect(selfCount).toBe(1);
    });

    it('should not mutate original config', () => {
      const config = createCSPConfig('default');
      const originalLength = config.connectSrc.length;

      addSource(config, 'connectSrc', 'https://new.example.com');

      expect(config.connectSrc.length).toBe(originalLength);
    });
  });

  describe('removeSource()', () => {
    it('should remove source from directive', () => {
      const config = createCSPConfig('default');
      const updated = removeSource(config, 'connectSrc', "'self'");

      expect(updated.connectSrc).not.toContain("'self'");
    });

    it('should handle non-existent source gracefully', () => {
      const config = createCSPConfig('default');
      const updated = removeSource(config, 'connectSrc', 'https://nonexistent.com');

      expect(updated.connectSrc).toEqual(config.connectSrc);
    });

    it('should not mutate original config', () => {
      const config = createCSPConfig('default');
      const originalLength = config.connectSrc.length;

      removeSource(config, 'connectSrc', "'self'");

      expect(config.connectSrc.length).toBe(originalLength);
    });
  });

  describe('allowWebSocket()', () => {
    it('should add ws: and wss: for WebSocket URL', () => {
      const config = createCSPConfig('strict');
      const updated = allowWebSocket(config, 'ws://localhost:8765');

      expect(updated.connectSrc).toContain('ws://localhost:8765');
      expect(updated.connectSrc).toContain('wss://localhost:8765');
    });

    it('should handle wss:// URLs', () => {
      const config = createCSPConfig('strict');
      const updated = allowWebSocket(config, 'wss://example.com:8765');

      expect(updated.connectSrc).toContain('ws://example.com:8765');
      expect(updated.connectSrc).toContain('wss://example.com:8765');
    });

    it('should handle invalid URLs gracefully', () => {
      const config = createCSPConfig('strict');
      const updated = allowWebSocket(config, 'not-a-url');

      expect(updated.connectSrc).toContain('not-a-url');
    });
  });

  describe('generateSandboxCSP()', () => {
    it('should generate CSP for terminal-only preset by default', () => {
      const csp = generateSandboxCSP();
      expect(csp).toContain("default-src 'none'");
    });

    it('should add allowed connections', () => {
      const csp = generateSandboxCSP(['ws://localhost:8765']);
      expect(csp).toContain('ws://localhost:8765');
    });

    it('should use specified preset', () => {
      const csp = generateSandboxCSP([], 'default');
      expect(csp).toContain("default-src 'self'");
    });
  });
});

describe('CSPViolationMonitor', () => {
  let monitor: CSPViolationMonitor;

  beforeEach(() => {
    monitor = new CSPViolationMonitor();
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('start()', () => {
    it('should start without error', () => {
      expect(() => monitor.start()).not.toThrow();
    });

    it('should be idempotent', () => {
      monitor.start();
      expect(() => monitor.start()).not.toThrow();
    });
  });

  describe('stop()', () => {
    it('should stop without error', () => {
      monitor.start();
      expect(() => monitor.stop()).not.toThrow();
    });

    it('should be safe to call without starting', () => {
      expect(() => monitor.stop()).not.toThrow();
    });

    it('should be safe to call multiple times', () => {
      monitor.start();
      expect(() => {
        monitor.stop();
        monitor.stop();
      }).not.toThrow();
    });
  });

  describe('getViolations()', () => {
    it('should return empty array initially', () => {
      expect(monitor.getViolations()).toEqual([]);
    });

    it('should return a copy of violations array', () => {
      const violations = monitor.getViolations();
      violations.push({
        directive: 'test',
        blockedUri: 'test',
      });

      expect(monitor.getViolations()).toEqual([]);
    });
  });

  describe('clearViolations()', () => {
    it('should clear all violations', () => {
      // Manually add a violation for testing
      (monitor as any).violations.push({
        directive: 'test',
        blockedUri: 'test',
      });

      monitor.clearViolations();
      expect(monitor.getViolations()).toEqual([]);
    });
  });

  describe('event listeners', () => {
    it('should add and remove event listeners', () => {
      const callback = vi.fn();

      monitor.addEventListener(callback);
      monitor.removeEventListener(callback);

      // Listener should be removed
      expect(() => monitor.start()).not.toThrow();
    });
  });
});
