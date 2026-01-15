/**
 * Tests for agents/agent-manager.ts - MConnect v0.1.2
 *
 * Tests the Agent Manager that handles multi-agent lifecycle:
 * - Agent creation and configuration
 * - Event handling (data, status, exit, error)
 * - Agent lifecycle management
 *
 * Note: These tests focus on the AgentInstance class and basic manager
 * functionality that doesn't require PTY. Integration tests with PTY
 * should be run separately with node-pty installed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AgentInstance,
  AgentManager,
  getAgentManager,
  resetAgentManager,
} from '../agents/agent-manager.js';
import type { AgentConfig, AgentStatus } from '../agents/types.js';

describe('Agent Manager Module', () => {
  beforeEach(() => {
    resetAgentManager();
    vi.clearAllMocks();
  });

  describe('AgentInstance', () => {
    const createTestConfig = (overrides: Partial<AgentConfig> = {}): AgentConfig => ({
      type: 'shell',
      name: 'Test Shell',
      command: '/bin/zsh',
      cwd: '/tmp',
      ...overrides,
    });

    it('should create instance with config', () => {
      const config = createTestConfig();
      const agent = new AgentInstance('test-id', config);
      expect(agent.id).toBe('test-id');
      expect(agent.config).toEqual(config);
    });

    it('should start with "starting" status', () => {
      const agent = new AgentInstance('test-id', createTestConfig());
      const info = agent.getInfo();
      expect(info.status).toBe('starting');
    });

    it('should track creation timestamp', () => {
      const beforeCreate = Date.now();
      const agent = new AgentInstance('test-id', createTestConfig());
      const afterCreate = Date.now();

      const info = agent.getInfo();
      expect(info.createdAt).toBeGreaterThanOrEqual(beforeCreate);
      expect(info.createdAt).toBeLessThanOrEqual(afterCreate);
    });

    it('should track last activity timestamp', () => {
      const agent = new AgentInstance('test-id', createTestConfig());
      const info = agent.getInfo();
      expect(info.lastActivityAt).toBeDefined();
      expect(info.lastActivityAt).toBeLessThanOrEqual(Date.now());
    });

    it('should provide complete agent info', () => {
      const config = createTestConfig({
        type: 'claude',
        name: 'Claude Agent',
        cwd: '/home/user/project',
        env: { TEST: 'value' },
      });

      const agent = new AgentInstance('agent-123', config);
      const info = agent.getInfo();

      expect(info.id).toBe('agent-123');
      expect(info.config).toEqual(config);
      expect(info.status).toBeDefined();
      expect(info.createdAt).toBeDefined();
      expect(info.lastActivityAt).toBeDefined();
      expect(info.ptyId).toBeUndefined(); // Not started yet
      expect(info.pid).toBeUndefined(); // Not started yet
      expect(info.exitCode).toBeUndefined();
    });

    it('should return current status', () => {
      const agent = new AgentInstance('test-id', createTestConfig());
      expect(agent.getStatus()).toBe('starting');
    });

    it('should report not running before start', () => {
      const agent = new AgentInstance('test-id', createTestConfig());
      expect(agent.isRunning()).toBe(false);
    });

    describe('event handlers', () => {
      it('should allow registering data handlers', () => {
        const agent = new AgentInstance('test-id', createTestConfig());
        const handler = vi.fn();
        expect(() => agent.onData(handler)).not.toThrow();
      });

      it('should allow registering multiple data handlers', () => {
        const agent = new AgentInstance('test-id', createTestConfig());
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        agent.onData(handler1);
        agent.onData(handler2);
        // Handlers registered without error
        expect(true).toBe(true);
      });

      it('should allow registering status handlers', () => {
        const agent = new AgentInstance('test-id', createTestConfig());
        const handler = vi.fn();
        expect(() => agent.onStatusChange(handler)).not.toThrow();
      });

      it('should allow registering exit handlers', () => {
        const agent = new AgentInstance('test-id', createTestConfig());
        const handler = vi.fn();
        expect(() => agent.onExit(handler)).not.toThrow();
      });
    });

    describe('methods without PTY', () => {
      it('should silently ignore write when not running', () => {
        const agent = new AgentInstance('test-id', createTestConfig());
        // Should not throw even though PTY not started
        expect(() => agent.write('test')).not.toThrow();
      });

      it('should silently ignore resize when not started', () => {
        const agent = new AgentInstance('test-id', createTestConfig());
        expect(() => agent.resize(100, 40)).not.toThrow();
      });

      it('should handle kill when not started', () => {
        const agent = new AgentInstance('test-id', createTestConfig());
        expect(() => agent.kill()).not.toThrow();
      });
    });
  });

  describe('AgentManager (no PTY)', () => {
    it('should create with working directory', () => {
      const manager = new AgentManager('/tmp/workdir');
      expect(manager).toBeDefined();
      expect(manager.count).toBe(0);
    });

    it('should return undefined for unknown agent ID', () => {
      const manager = new AgentManager('/tmp/workdir');
      const agent = manager.getAgent('nonexistent-id');
      expect(agent).toBeUndefined();
    });

    it('should return empty array when no agents', () => {
      const manager = new AgentManager('/tmp/workdir');
      expect(manager.getAllAgents()).toEqual([]);
      expect(manager.getAllAgentInfos()).toEqual([]);
    });

    it('should return false when killing unknown agent', () => {
      const manager = new AgentManager('/tmp/workdir');
      const killed = manager.killAgent('nonexistent');
      expect(killed).toBe(false);
    });

    it('should handle killAllAgents with no agents', () => {
      const manager = new AgentManager('/tmp/workdir');
      expect(() => manager.killAllAgents()).not.toThrow();
    });

    it('should register event handlers', () => {
      const manager = new AgentManager('/tmp/workdir');
      const dataHandler = vi.fn();
      const statusHandler = vi.fn();
      const exitHandler = vi.fn();
      const errorHandler = vi.fn();

      expect(() => {
        manager.on('data', dataHandler);
        manager.on('status', statusHandler);
        manager.on('exit', exitHandler);
        manager.on('error', errorHandler);
      }).not.toThrow();
    });

    it('should track count as zero initially', () => {
      const manager = new AgentManager('/tmp/workdir');
      expect(manager.count).toBe(0);
      expect(manager.runningCount).toBe(0);
    });

    it('should return false when resizing unknown agent', () => {
      const manager = new AgentManager('/tmp/workdir');
      const resized = manager.resizeAgent('unknown', 100, 40);
      expect(resized).toBe(false);
    });

    it('should return false when writing to unknown agent', () => {
      const manager = new AgentManager('/tmp/workdir');
      const wrote = manager.writeToAgent('unknown', 'test');
      expect(wrote).toBe(false);
    });
  });

  describe('getAgentManager singleton', () => {
    beforeEach(() => {
      resetAgentManager();
    });

    it('should create manager with workDir on first call', () => {
      const manager = getAgentManager('/tmp/test');
      expect(manager).toBeDefined();
    });

    it('should return same instance on subsequent calls', () => {
      const manager1 = getAgentManager('/tmp/test');
      const manager2 = getAgentManager();
      expect(manager2).toBe(manager1);
    });

    it('should throw if first call has no workDir', () => {
      expect(() => getAgentManager()).toThrow('workDir required');
    });

    it('should accept workDir on subsequent calls without error', () => {
      const manager1 = getAgentManager('/tmp/test');
      const manager2 = getAgentManager('/different/path');
      expect(manager2).toBe(manager1); // Still same instance
    });
  });

  describe('resetAgentManager', () => {
    it('should clear the singleton', () => {
      getAgentManager('/tmp/test');
      resetAgentManager();
      expect(() => getAgentManager()).toThrow('workDir required');
    });

    it('should be safe to call multiple times', () => {
      getAgentManager('/tmp/test');
      expect(() => {
        resetAgentManager();
        resetAgentManager();
        resetAgentManager();
      }).not.toThrow();
    });

    it('should be safe to call without initialization', () => {
      expect(() => resetAgentManager()).not.toThrow();
    });
  });
});

describe('AgentConfig Type Validation', () => {
  it('should accept all valid agent types', () => {
    const types: Array<AgentConfig['type']> = ['claude', 'gemini', 'codex', 'aider', 'shell', 'custom'];
    types.forEach((type) => {
      const config: AgentConfig = {
        type,
        name: `${type} agent`,
        command: '/bin/zsh',
        cwd: '/tmp',
      };
      const agent = new AgentInstance(`${type}-id`, config);
      expect(agent.config.type).toBe(type);
    });
  });

  it('should accept optional properties', () => {
    const config: AgentConfig = {
      type: 'shell',
      name: 'Full Config Agent',
      command: '/bin/zsh',
      args: ['-l', '-i'],
      cwd: '/home/user',
      initialPrompt: 'Welcome!',
      env: { TERM: 'xterm-256color', CUSTOM: 'value' },
      autoRun: true,
    };
    const agent = new AgentInstance('full-config', config);
    expect(agent.config.args).toEqual(['-l', '-i']);
    expect(agent.config.initialPrompt).toBe('Welcome!');
    expect(agent.config.env?.CUSTOM).toBe('value');
    expect(agent.config.autoRun).toBe(true);
  });
});

describe('AgentStatus Type Validation', () => {
  it('should recognize all valid statuses', () => {
    const validStatuses: AgentStatus[] = ['starting', 'running', 'idle', 'waiting', 'exited', 'error'];
    expect(validStatuses).toHaveLength(6);
  });
});
