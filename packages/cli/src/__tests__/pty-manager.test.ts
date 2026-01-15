/**
 * Tests for pty/pty-manager.ts - MConnect v0.1.2
 *
 * Tests the PTY Manager for terminal emulation:
 * - PTY instance creation and management
 * - Event handling
 * - Process lifecycle
 *
 * Note: These tests mock node-pty since it's a native module
 * that may not be available in all environments.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create mock PTY process
const createMockPtyProcess = () => {
  const dataCallbacks: ((data: string) => void)[] = [];
  const exitCallbacks: ((info: { exitCode: number; signal?: number }) => void)[] = [];

  return {
    pid: 12345,
    onData: vi.fn((cb) => {
      dataCallbacks.push(cb);
    }),
    onExit: vi.fn((cb) => {
      exitCallbacks.push(cb);
    }),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    // Test helpers
    _simulateData: (data: string) => dataCallbacks.forEach((cb) => cb(data)),
    _simulateExit: (exitCode: number, signal?: number) =>
      exitCallbacks.forEach((cb) => cb({ exitCode, signal })),
  };
};

// Mock node-pty
vi.mock('node-pty', () => ({
  spawn: vi.fn(() => createMockPtyProcess()),
}));

import { getPTYManager, isPtyAvailable, PTYManager } from '../pty/pty-manager.js';

describe('PTY Manager Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isPtyAvailable', () => {
    it('should return boolean', async () => {
      const available = await isPtyAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('PTYManager', () => {
    describe('construction', () => {
      it('should create manager instance', () => {
        const manager = new PTYManager();
        expect(manager).toBeDefined();
        expect(manager.count).toBe(0);
      });
    });

    describe('initialize', () => {
      it('should initialize successfully when node-pty available', async () => {
        const manager = new PTYManager();
        const result = await manager.initialize();
        expect(result).toBe(true);
      });

      it('should return true on subsequent calls', async () => {
        const manager = new PTYManager();
        await manager.initialize();
        const result = await manager.initialize();
        expect(result).toBe(true);
      });
    });

    describe('create', () => {
      it('should create PTY instance', async () => {
        const manager = new PTYManager();
        await manager.initialize();

        const instance = await manager.create({
          command: '/bin/zsh',
          args: ['-l'],
          cwd: '/tmp',
        });

        expect(instance).toBeDefined();
        expect(instance.id).toMatch(/^pty_/);
        expect(instance.pid).toBeGreaterThan(0);
        expect(manager.count).toBe(1);
      });

      it('should auto-initialize if not initialized', async () => {
        const manager = new PTYManager();

        const instance = await manager.create({
          command: '/bin/bash',
          cwd: '/tmp',
        });

        expect(instance).toBeDefined();
      });

      it('should use default cols/rows', async () => {
        const manager = new PTYManager();
        await manager.initialize();

        const instance = await manager.create({
          command: '/bin/zsh',
          cwd: '/tmp',
        });

        expect(instance).toBeDefined();
      });

      it('should use custom cols/rows', async () => {
        const manager = new PTYManager();
        await manager.initialize();

        const instance = await manager.create({
          command: '/bin/zsh',
          cwd: '/tmp',
          cols: 120,
          rows: 40,
        });

        expect(instance).toBeDefined();
      });

      it('should pass environment variables', async () => {
        const manager = new PTYManager();
        await manager.initialize();

        const instance = await manager.create({
          command: '/bin/zsh',
          cwd: '/tmp',
          env: {
            CUSTOM_VAR: 'value',
          },
        });

        expect(instance).toBeDefined();
      });
    });

    describe('PTY instance operations', () => {
      it('should allow writing to PTY', async () => {
        const manager = new PTYManager();
        const instance = await manager.create({
          command: '/bin/zsh',
          cwd: '/tmp',
        });

        expect(() => instance.write('echo hello\n')).not.toThrow();
      });

      it('should allow resizing PTY', async () => {
        const manager = new PTYManager();
        const instance = await manager.create({
          command: '/bin/zsh',
          cwd: '/tmp',
        });

        expect(() => instance.resize({ cols: 100, rows: 30 })).not.toThrow();
      });

      it('should allow killing PTY', async () => {
        const manager = new PTYManager();
        const instance = await manager.create({
          command: '/bin/zsh',
          cwd: '/tmp',
        });

        expect(() => instance.kill()).not.toThrow();
      });

      it('should report running status', async () => {
        const manager = new PTYManager();
        const instance = await manager.create({
          command: '/bin/zsh',
          cwd: '/tmp',
        });

        expect(instance.isRunning()).toBe(true);
      });

      it('should allow registering data handler', async () => {
        const manager = new PTYManager();
        const instance = await manager.create({
          command: '/bin/zsh',
          cwd: '/tmp',
        });

        const handler = vi.fn();
        expect(() => instance.onData(handler)).not.toThrow();
      });

      it('should allow registering exit handler', async () => {
        const manager = new PTYManager();
        const instance = await manager.create({
          command: '/bin/zsh',
          cwd: '/tmp',
        });

        const handler = vi.fn();
        expect(() => instance.onExit(handler)).not.toThrow();
      });
    });

    describe('get', () => {
      it('should get PTY by ID', async () => {
        const manager = new PTYManager();
        const instance = await manager.create({
          command: '/bin/zsh',
          cwd: '/tmp',
        });

        const found = manager.get(instance.id);
        expect(found).toBe(instance);
      });

      it('should return undefined for unknown ID', () => {
        const manager = new PTYManager();
        const found = manager.get('nonexistent');
        expect(found).toBeUndefined();
      });
    });

    describe('getAll', () => {
      it('should return empty array initially', () => {
        const manager = new PTYManager();
        expect(manager.getAll()).toEqual([]);
      });

      it('should return all instances', async () => {
        const manager = new PTYManager();
        await manager.create({ command: '/bin/zsh', cwd: '/tmp' });
        await manager.create({ command: '/bin/bash', cwd: '/var' });

        const all = manager.getAll();
        expect(all).toHaveLength(2);
      });
    });

    describe('kill', () => {
      it('should kill PTY by ID', async () => {
        const manager = new PTYManager();
        const instance = await manager.create({
          command: '/bin/zsh',
          cwd: '/tmp',
        });

        const killed = manager.kill(instance.id);
        expect(killed).toBe(true);
        expect(manager.count).toBe(0);
      });

      it('should return false for unknown ID', () => {
        const manager = new PTYManager();
        const killed = manager.kill('nonexistent');
        expect(killed).toBe(false);
      });

      it('should accept optional signal', async () => {
        const manager = new PTYManager();
        const instance = await manager.create({
          command: '/bin/zsh',
          cwd: '/tmp',
        });

        const killed = manager.kill(instance.id, 'SIGKILL');
        expect(killed).toBe(true);
      });
    });

    describe('killAll', () => {
      it('should kill all PTY instances', async () => {
        const manager = new PTYManager();
        await manager.create({ command: '/bin/zsh', cwd: '/tmp' });
        await manager.create({ command: '/bin/bash', cwd: '/var' });

        expect(manager.count).toBe(2);
        manager.killAll();
        expect(manager.count).toBe(0);
      });

      it('should do nothing when no instances', () => {
        const manager = new PTYManager();
        expect(() => manager.killAll()).not.toThrow();
      });
    });

    describe('onEvent', () => {
      it('should register event handler', async () => {
        const manager = new PTYManager();
        const handler = vi.fn();

        expect(() => manager.onEvent(handler)).not.toThrow();
      });
    });

    describe('count', () => {
      it('should track instance count', async () => {
        const manager = new PTYManager();
        expect(manager.count).toBe(0);

        await manager.create({ command: '/bin/zsh', cwd: '/tmp' });
        expect(manager.count).toBe(1);

        await manager.create({ command: '/bin/bash', cwd: '/var' });
        expect(manager.count).toBe(2);
      });
    });
  });

  describe('getPTYManager singleton', () => {
    it('should return same instance', () => {
      const manager1 = getPTYManager();
      const manager2 = getPTYManager();
      expect(manager2).toBe(manager1);
    });
  });
});

describe('PTY Types', () => {
  describe('PTYOptions', () => {
    it('should accept minimal options', async () => {
      const manager = new PTYManager();
      await manager.create({
        command: '/bin/zsh',
        cwd: '/tmp',
      });
      expect(manager.count).toBe(1);
    });

    it('should accept full options', async () => {
      const manager = new PTYManager();
      await manager.create({
        command: '/bin/zsh',
        args: ['-l', '-i'],
        cwd: '/tmp',
        env: { TERM: 'xterm-256color' },
        cols: 120,
        rows: 40,
      });
      expect(manager.count).toBe(1);
    });
  });

  describe('PTYSize', () => {
    it('should resize with valid dimensions', async () => {
      const manager = new PTYManager();
      const instance = await manager.create({
        command: '/bin/zsh',
        cwd: '/tmp',
      });

      instance.resize({ cols: 80, rows: 24 });
      instance.resize({ cols: 120, rows: 40 });
      instance.resize({ cols: 200, rows: 50 });

      // No errors thrown
      expect(true).toBe(true);
    });
  });
});
