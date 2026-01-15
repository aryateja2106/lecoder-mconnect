import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TunnelManager } from '../tunnel.js';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

describe('Tunnel Module', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('TunnelManager', () => {
    describe('isCloudflaredInstalled', () => {
      it('should find cloudflared via command -v', async () => {
        vi.mocked(execSync).mockReturnValue('/opt/homebrew/bin/cloudflared\n');

        const manager = new TunnelManager();
        const installed = await manager.isCloudflaredInstalled();

        expect(installed).toBe(true);
        expect(manager.getCloudflaredPath()).toBe('/opt/homebrew/bin/cloudflared');
      });

      it('should find cloudflared via known paths when command -v fails', async () => {
        vi.mocked(execSync).mockImplementation(() => {
          throw new Error('command not found');
        });
        vi.mocked(existsSync).mockImplementation((path) => {
          return path === '/opt/homebrew/bin/cloudflared';
        });

        const manager = new TunnelManager();
        const installed = await manager.isCloudflaredInstalled();

        expect(installed).toBe(true);
        expect(manager.getCloudflaredPath()).toBe('/opt/homebrew/bin/cloudflared');
      });

      it('should return false when cloudflared is not found', async () => {
        vi.mocked(execSync).mockImplementation(() => {
          throw new Error('command not found');
        });
        vi.mocked(existsSync).mockReturnValue(false);

        const manager = new TunnelManager();
        const installed = await manager.isCloudflaredInstalled();

        expect(installed).toBe(false);
        expect(manager.getCloudflaredPath()).toBeNull();
      });

      it('should check Intel Mac path', async () => {
        vi.mocked(execSync).mockImplementation(() => {
          throw new Error('command not found');
        });
        vi.mocked(existsSync).mockImplementation((path) => {
          return path === '/usr/local/bin/cloudflared';
        });

        const manager = new TunnelManager();
        const installed = await manager.isCloudflaredInstalled();

        expect(installed).toBe(true);
        expect(manager.getCloudflaredPath()).toBe('/usr/local/bin/cloudflared');
      });

      it('should check Linux path', async () => {
        vi.mocked(execSync).mockImplementation(() => {
          throw new Error('command not found');
        });
        vi.mocked(existsSync).mockImplementation((path) => {
          return path === '/usr/bin/cloudflared';
        });

        const manager = new TunnelManager();
        const installed = await manager.isCloudflaredInstalled();

        expect(installed).toBe(true);
        expect(manager.getCloudflaredPath()).toBe('/usr/bin/cloudflared');
      });
    });

    describe('getUrl', () => {
      it('should return null initially', () => {
        const manager = new TunnelManager();
        expect(manager.getUrl()).toBeNull();
      });
    });

    describe('stop', () => {
      it('should not throw when no process is running', () => {
        const manager = new TunnelManager();
        expect(() => manager.stop()).not.toThrow();
      });
    });
  });
});
