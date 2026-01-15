/**
 * Tests for tmux/tmux-manager.ts - MConnect v0.1.2
 *
 * Tests the Tmux Manager for server-side visualization:
 * - Session creation and management
 * - Pane operations
 * - Layout management
 *
 * Note: These tests mock execSync since tmux may not be available.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'fs';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(() => ({
    on: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
  })),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

import { TmuxManager, getTmuxManager } from '../tmux/tmux-manager.js';
import { execSync } from 'child_process';

describe('Tmux Manager Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TmuxManager construction', () => {
    it('should create with default config', () => {
      const manager = new TmuxManager();
      expect(manager).toBeDefined();
      expect(manager.getCurrentSession()).toBeNull();
    });

    it('should create with custom config', () => {
      const manager = new TmuxManager({
        sessionPrefix: 'custom',
        defaultShell: '/bin/fish',
        tmuxPath: '/custom/tmux',
      });
      expect(manager).toBeDefined();
    });
  });

  describe('isInstalled', () => {
    it('should return true when tmux is in PATH', async () => {
      (execSync as any).mockReturnValue('/usr/bin/tmux\n');
      const manager = new TmuxManager();
      const installed = await manager.isInstalled();
      expect(installed).toBe(true);
      expect(manager.getTmuxPath()).toBe('/usr/bin/tmux');
    });

    it('should return true when provided tmuxPath exists', async () => {
      (existsSync as any).mockReturnValue(true);
      const manager = new TmuxManager({ tmuxPath: '/opt/homebrew/bin/tmux' });
      const installed = await manager.isInstalled();
      expect(installed).toBe(true);
    });

    it('should check known paths when command -v fails', async () => {
      (execSync as any).mockImplementation(() => {
        throw new Error('command not found');
      });
      (existsSync as any).mockImplementation((path: string) => {
        return path === '/opt/homebrew/bin/tmux';
      });

      const manager = new TmuxManager();
      const installed = await manager.isInstalled();
      expect(installed).toBe(true);
      expect(manager.getTmuxPath()).toBe('/opt/homebrew/bin/tmux');
    });

    it('should return false when tmux not found anywhere', async () => {
      (execSync as any).mockImplementation(() => {
        throw new Error('command not found');
      });
      (existsSync as any).mockReturnValue(false);

      const manager = new TmuxManager();
      const installed = await manager.isInstalled();
      expect(installed).toBe(false);
    });
  });

  describe('createSession', () => {
    beforeEach(() => {
      (execSync as any).mockReturnValue('/usr/bin/tmux\n');
      (existsSync as any).mockReturnValue(true);
    });

    it('should create a new session', async () => {
      const manager = new TmuxManager();
      await manager.isInstalled();

      // Mock session check (not exists) and creation
      (execSync as any)
        .mockImplementationOnce(() => { throw new Error('session not found'); })
        .mockReturnValue('');

      const sessionName = await manager.createSession({
        name: 'test',
        cwd: '/tmp',
      });

      expect(sessionName).toBe('mconnect-test');
      expect(manager.getCurrentSession()).toBe('mconnect-test');
    });

    it('should kill existing session before creating new one', async () => {
      const manager = new TmuxManager();
      await manager.isInstalled();

      // Mock session exists, then kill, then create
      (execSync as any)
        .mockImplementationOnce(() => '') // has-session succeeds
        .mockImplementationOnce(() => '') // kill-session
        .mockImplementationOnce(() => ''); // new-session

      await manager.createSession({
        name: 'test',
        cwd: '/tmp',
        windowName: 'main',
      });

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('kill-session'),
        expect.any(Object)
      );
    });

    it('should throw when tmux not installed', async () => {
      (execSync as any).mockImplementation(() => {
        throw new Error('command not found');
      });
      (existsSync as any).mockReturnValue(false);

      const manager = new TmuxManager();
      await expect(manager.createSession({ name: 'test', cwd: '/tmp' }))
        .rejects.toThrow('not installed');
    });
  });

  describe('createPane', () => {
    it('should throw when no active session', async () => {
      const manager = new TmuxManager();
      await expect(
        manager.createPane({ command: 'echo test' })
      ).rejects.toThrow('No active session');
    });

    it('should create pane in current session', async () => {
      (execSync as any).mockReturnValue('/usr/bin/tmux\n');
      (existsSync as any).mockReturnValue(true);

      const manager = new TmuxManager();
      await manager.isInstalled();

      // Setup session
      (execSync as any)
        .mockImplementationOnce(() => { throw new Error('no session'); })
        .mockReturnValue('');

      await manager.createSession({ name: 'test', cwd: '/tmp' });

      // Create pane
      (execSync as any).mockReturnValue('%1');

      const paneId = await manager.createPane({
        command: 'echo hello',
        name: 'TestPane',
        split: 'horizontal',
        size: 50,
      });

      expect(paneId).toBe('%1');
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('split-window'),
        expect.any(Object)
      );
    });

    it('should handle vertical split', async () => {
      (execSync as any).mockReturnValue('/usr/bin/tmux\n');
      (existsSync as any).mockReturnValue(true);

      const manager = new TmuxManager();
      await manager.isInstalled();

      (execSync as any)
        .mockImplementationOnce(() => { throw new Error('no session'); })
        .mockReturnValue('');

      await manager.createSession({ name: 'test', cwd: '/tmp' });
      (execSync as any).mockReturnValue('%2');

      await manager.createPane({
        command: 'ls',
        split: 'vertical',
      });

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('-v'),
        expect.any(Object)
      );
    });
  });

  describe('sendKeys', () => {
    it('should throw when no active session', () => {
      const manager = new TmuxManager();
      expect(() => manager.sendKeys('0', 'echo test'))
        .toThrow('No active session');
    });

    it('should send keys to pane', async () => {
      (execSync as any).mockReturnValue('/usr/bin/tmux\n');
      (existsSync as any).mockReturnValue(true);

      const manager = new TmuxManager();
      await manager.isInstalled();

      (execSync as any)
        .mockImplementationOnce(() => { throw new Error('no session'); })
        .mockReturnValue('');

      await manager.createSession({ name: 'test', cwd: '/tmp' });

      manager.sendKeys('0', 'echo hello');

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('send-keys'),
        expect.any(Object)
      );
    });

    it('should handle enter flag', async () => {
      (execSync as any).mockReturnValue('/usr/bin/tmux\n');
      (existsSync as any).mockReturnValue(true);

      const manager = new TmuxManager();
      await manager.isInstalled();

      (execSync as any)
        .mockImplementationOnce(() => { throw new Error('no session'); })
        .mockReturnValue('');

      await manager.createSession({ name: 'test', cwd: '/tmp' });

      manager.sendKeys('0', 'ls', false);

      // Without enter, should not include Enter in command
      const calls = (execSync as any).mock.calls;
      const sendKeysCall = calls.find((c: any[]) => c[0].includes('send-keys'));
      expect(sendKeysCall[0]).not.toMatch(/Enter$/);
    });
  });

  describe('getSessionInfo', () => {
    it('should return null when no active session', () => {
      const manager = new TmuxManager();
      const info = manager.getSessionInfo();
      expect(info).toBeNull();
    });

    it('should return session info', async () => {
      (execSync as any).mockReturnValue('/usr/bin/tmux\n');
      (existsSync as any).mockReturnValue(true);

      const manager = new TmuxManager();
      await manager.isInstalled();

      // Setup session
      (execSync as any)
        .mockImplementationOnce(() => { throw new Error('no session'); })
        .mockImplementationOnce(() => '') // new-session
        .mockImplementationOnce(() => 'mconnect-test:$1:0:1704067200') // display-message
        .mockImplementationOnce(() => '0:agents:1') // list-windows
        .mockImplementationOnce(() => '0:%1:Shell:1:120:30:zsh'); // list-panes

      await manager.createSession({ name: 'test', cwd: '/tmp' });
      const info = manager.getSessionInfo();

      expect(info).toBeDefined();
      expect(info?.name).toBe('mconnect-test');
    });
  });

  describe('killSession', () => {
    it('should do nothing when no active session', () => {
      const manager = new TmuxManager();
      expect(() => manager.killSession()).not.toThrow();
    });

    it('should kill active session', async () => {
      (execSync as any).mockReturnValue('/usr/bin/tmux\n');
      (existsSync as any).mockReturnValue(true);

      const manager = new TmuxManager();
      await manager.isInstalled();

      (execSync as any)
        .mockImplementationOnce(() => { throw new Error('no session'); })
        .mockReturnValue('');

      await manager.createSession({ name: 'test', cwd: '/tmp' });
      expect(manager.getCurrentSession()).toBe('mconnect-test');

      manager.killSession();
      expect(manager.getCurrentSession()).toBeNull();
    });
  });

  describe('evenLayout', () => {
    it('should do nothing when no active session', () => {
      const manager = new TmuxManager();
      expect(() => manager.evenLayout()).not.toThrow();
    });

    it('should apply tiled layout by default', async () => {
      (execSync as any).mockReturnValue('/usr/bin/tmux\n');
      (existsSync as any).mockReturnValue(true);

      const manager = new TmuxManager();
      await manager.isInstalled();

      (execSync as any)
        .mockImplementationOnce(() => { throw new Error('no session'); })
        .mockReturnValue('');

      await manager.createSession({ name: 'test', cwd: '/tmp' });
      manager.evenLayout('tiled');

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('tiled'),
        expect.any(Object)
      );
    });

    it('should support horizontal layout', async () => {
      (execSync as any).mockReturnValue('/usr/bin/tmux\n');
      (existsSync as any).mockReturnValue(true);

      const manager = new TmuxManager();
      await manager.isInstalled();

      (execSync as any)
        .mockImplementationOnce(() => { throw new Error('no session'); })
        .mockReturnValue('');

      await manager.createSession({ name: 'test', cwd: '/tmp' });
      manager.evenLayout('horizontal');

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('even-horizontal'),
        expect.any(Object)
      );
    });

    it('should support vertical layout', async () => {
      (execSync as any).mockReturnValue('/usr/bin/tmux\n');
      (existsSync as any).mockReturnValue(true);

      const manager = new TmuxManager();
      await manager.isInstalled();

      (execSync as any)
        .mockImplementationOnce(() => { throw new Error('no session'); })
        .mockReturnValue('');

      await manager.createSession({ name: 'test', cwd: '/tmp' });
      manager.evenLayout('vertical');

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('even-vertical'),
        expect.any(Object)
      );
    });
  });

  describe('getTmuxManager singleton', () => {
    it('should return the same instance', () => {
      const manager1 = getTmuxManager();
      const manager2 = getTmuxManager();
      expect(manager2).toBe(manager1);
    });

    it('should accept initial config', () => {
      const manager = getTmuxManager({ sessionPrefix: 'custom' });
      expect(manager).toBeDefined();
    });
  });
});
