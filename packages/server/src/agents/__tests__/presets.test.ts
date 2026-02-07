/**
 * Agent Presets Unit Tests
 *
 * Tests for preset registry, built-in presets, and custom preset management.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import type { AgentPreset } from '@lecoder/shared';
import {
  getPreset,
  resolvePreset,
  registerPreset,
  unregisterPreset,
  listPresets,
  hasPreset,
  createCustomAgentConfig,
  resetPresets,
  claudePreset,
  devReviewPreset,
  shellPreset,
  ubuntuShellPreset,
} from '../presets/index.js';

// ============================================================================
// Tests
// ============================================================================

describe('Agent Presets', () => {
  beforeEach(() => {
    resetPresets();
  });

  // ==========================================================================
  // Built-in Presets
  // ==========================================================================

  describe('Built-in Presets', () => {
    it('should have claude preset', () => {
      const preset = getPreset('claude');
      expect(preset).toBeDefined();
      expect(preset!.name).toBe('claude');
      expect(preset!.agents).toHaveLength(1);
      expect(preset!.agents[0].type).toBe('claude');
      expect(preset!.agents[0].command).toBe('claude');
    });

    it('should have dev-review preset with two agents', () => {
      const preset = getPreset('dev-review');
      expect(preset).toBeDefined();
      expect(preset!.name).toBe('dev-review');
      expect(preset!.agents).toHaveLength(2);
      expect(preset!.agents[0].name).toBe('Developer');
      expect(preset!.agents[1].name).toBe('Reviewer');
    });

    it('should have shell preset', () => {
      const preset = getPreset('shell');
      expect(preset).toBeDefined();
      expect(preset!.name).toBe('shell');
      expect(preset!.agents).toHaveLength(1);
      expect(preset!.agents[0].type).toBe('shell');
      expect(preset!.agents[0].command).toBe('/bin/sh');
    });

    it('should have ubuntu-shell preset', () => {
      const preset = getPreset('ubuntu-shell');
      expect(preset).toBeDefined();
      expect(preset!.name).toBe('ubuntu-shell');
      expect(preset!.agents).toHaveLength(1);
      expect(preset!.agents[0].command).toBe('/bin/bash');
    });

    it('should alias "single" to claude preset', () => {
      const single = getPreset('single');
      const claude = getPreset('claude');
      expect(single).toBe(claude);
    });

    it('should return undefined for unknown preset', () => {
      expect(getPreset('nonexistent')).toBeUndefined();
    });
  });

  // ==========================================================================
  // Preset Properties
  // ==========================================================================

  describe('Preset Properties', () => {
    it('claude preset should have container config', () => {
      const agent = claudePreset.agents[0];
      expect(agent.container).toBeDefined();
      expect(agent.container!.image).toBe('ubuntu:22.04');
      expect(agent.container!.workDir).toBe('/workspace');
      expect(agent.container!.removeOnExit).toBe(true);
    });

    it('claude preset should have MCP enabled', () => {
      const agent = claudePreset.agents[0];
      expect(agent.mcp).toBeDefined();
      expect(agent.mcp!.transport).toBe('stdio');
    });

    it('claude preset should have 1GB memory limit', () => {
      const agent = claudePreset.agents[0];
      expect(agent.container!.resourceLimits?.memoryMB).toBe(1024);
    });

    it('shell preset should have 256MB memory limit', () => {
      const agent = shellPreset.agents[0];
      expect(agent.container!.resourceLimits?.memoryMB).toBe(256);
    });

    it('shell preset should not have MCP', () => {
      const agent = shellPreset.agents[0];
      expect(agent.mcp).toBeUndefined();
    });

    it('all presets should set TERM environment variable', () => {
      const allPresets = [claudePreset, devReviewPreset, shellPreset, ubuntuShellPreset];
      for (const preset of allPresets) {
        for (const agent of preset.agents) {
          expect(agent.env?.TERM).toBe('xterm-256color');
        }
      }
    });

    it('all presets should have autoRun enabled', () => {
      const allPresets = [claudePreset, devReviewPreset, shellPreset, ubuntuShellPreset];
      for (const preset of allPresets) {
        for (const agent of preset.agents) {
          expect(agent.autoRun).toBe(true);
        }
      }
    });
  });

  // ==========================================================================
  // resolvePreset
  // ==========================================================================

  describe('resolvePreset', () => {
    it('should resolve claude preset to agent configs', () => {
      const agents = resolvePreset('claude');
      expect(agents).toBeDefined();
      expect(agents).toHaveLength(1);
      expect(agents![0].type).toBe('claude');
      expect(agents![0].name).toBe('Claude Code');
    });

    it('should resolve shell preset to agent configs', () => {
      const agents = resolvePreset('shell');
      expect(agents).toBeDefined();
      expect(agents).toHaveLength(1);
      expect(agents![0].type).toBe('shell');
    });

    it('should apply cwd override', () => {
      const agents = resolvePreset('claude', { cwd: '/home/user/project' });
      expect(agents).toBeDefined();
      expect(agents![0].cwd).toBe('/home/user/project');
    });

    it('should merge env overrides', () => {
      const agents = resolvePreset('claude', {
        env: { MY_VAR: 'test' },
      });
      expect(agents).toBeDefined();
      expect(agents![0].env?.TERM).toBe('xterm-256color');
      expect(agents![0].env?.MY_VAR).toBe('test');
    });

    it('should return undefined for unknown preset', () => {
      const agents = resolvePreset('nonexistent');
      expect(agents).toBeUndefined();
    });

    it('should resolve dev-review preset to two agents', () => {
      const agents = resolvePreset('dev-review');
      expect(agents).toBeDefined();
      expect(agents).toHaveLength(2);
      expect(agents![0].name).toBe('Developer');
      expect(agents![1].name).toBe('Reviewer');
    });
  });

  // ==========================================================================
  // hasPreset
  // ==========================================================================

  describe('hasPreset', () => {
    it('should return true for built-in presets', () => {
      expect(hasPreset('claude')).toBe(true);
      expect(hasPreset('shell')).toBe(true);
      expect(hasPreset('dev-review')).toBe(true);
      expect(hasPreset('ubuntu-shell')).toBe(true);
      expect(hasPreset('single')).toBe(true);
    });

    it('should return false for unknown presets', () => {
      expect(hasPreset('nonexistent')).toBe(false);
    });
  });

  // ==========================================================================
  // listPresets
  // ==========================================================================

  describe('listPresets', () => {
    it('should list all built-in presets without duplicates', () => {
      const presets = listPresets();
      // 4 unique presets (single is alias to claude, so deduplicated)
      expect(presets).toHaveLength(4);

      const names = presets.map((p) => p.name);
      expect(names).toContain('claude');
      expect(names).toContain('dev-review');
      expect(names).toContain('shell');
      expect(names).toContain('ubuntu-shell');
    });

    it('should include custom presets', () => {
      registerPreset({
        name: 'my-custom',
        description: 'Custom preset',
        agents: [{ type: 'shell', name: 'Custom', command: '/bin/bash' }],
      });

      const presets = listPresets();
      expect(presets).toHaveLength(5);
      const names = presets.map((p) => p.name);
      expect(names).toContain('my-custom');
    });
  });

  // ==========================================================================
  // Custom Presets
  // ==========================================================================

  describe('registerPreset', () => {
    it('should register a custom preset', () => {
      const custom: AgentPreset = {
        name: 'my-agent',
        description: 'My custom agent',
        agents: [
          {
            type: 'custom',
            name: 'My Agent',
            command: 'my-tool',
            container: {
              image: 'node:22',
              workDir: '/app',
            },
          },
        ],
      };

      registerPreset(custom);
      expect(getPreset('my-agent')).toBe(custom);
      expect(hasPreset('my-agent')).toBe(true);
    });

    it('should throw when overriding built-in preset', () => {
      expect(() =>
        registerPreset({
          name: 'claude',
          description: 'Override',
          agents: [],
        })
      ).toThrow("Cannot override built-in preset 'claude'");
    });

    it('should throw when overriding single alias', () => {
      expect(() =>
        registerPreset({
          name: 'single',
          description: 'Override',
          agents: [],
        })
      ).toThrow("Cannot override built-in preset 'single'");
    });
  });

  describe('unregisterPreset', () => {
    it('should remove a custom preset', () => {
      registerPreset({
        name: 'temp-preset',
        description: 'Temporary',
        agents: [{ type: 'shell', name: 'Temp', command: '/bin/sh' }],
      });

      expect(hasPreset('temp-preset')).toBe(true);
      const removed = unregisterPreset('temp-preset');
      expect(removed).toBe(true);
      expect(hasPreset('temp-preset')).toBe(false);
    });

    it('should return false for non-existent preset', () => {
      const removed = unregisterPreset('nonexistent');
      expect(removed).toBe(false);
    });

    it('should throw when removing built-in preset', () => {
      expect(() => unregisterPreset('claude')).toThrow(
        "Cannot remove built-in preset 'claude'"
      );
    });

    it('should throw when removing shell preset', () => {
      expect(() => unregisterPreset('shell')).toThrow(
        "Cannot remove built-in preset 'shell'"
      );
    });
  });

  // ==========================================================================
  // createCustomAgentConfig
  // ==========================================================================

  describe('createCustomAgentConfig', () => {
    it('should create a basic custom agent config', () => {
      const config = createCustomAgentConfig({
        name: 'My Tool',
        command: 'my-tool',
      });

      expect(config.type).toBe('custom');
      expect(config.name).toBe('My Tool');
      expect(config.command).toBe('my-tool');
      expect(config.autoRun).toBe(true);
      expect(config.env?.TERM).toBe('xterm-256color');
      expect(config.container).toBeUndefined();
      expect(config.mcp).toBeUndefined();
    });

    it('should include container config when image is provided', () => {
      const config = createCustomAgentConfig({
        name: 'Containerized',
        command: 'my-tool',
        image: 'node:22',
        memoryMB: 2048,
      });

      expect(config.container).toBeDefined();
      expect(config.container!.image).toBe('node:22');
      expect(config.container!.workDir).toBe('/workspace');
      expect(config.container!.removeOnExit).toBe(true);
      expect(config.container!.resourceLimits?.memoryMB).toBe(2048);
    });

    it('should default to 512MB memory when not specified', () => {
      const config = createCustomAgentConfig({
        name: 'Default Memory',
        command: 'my-tool',
        image: 'node:22',
      });

      expect(config.container!.resourceLimits?.memoryMB).toBe(512);
    });

    it('should include MCP config when enabled', () => {
      const config = createCustomAgentConfig({
        name: 'MCP Tool',
        command: 'my-tool',
        enableMCP: true,
      });

      expect(config.mcp).toBeDefined();
      expect(config.mcp!.transport).toBe('stdio');
    });

    it('should pass through args and cwd', () => {
      const config = createCustomAgentConfig({
        name: 'With Args',
        command: 'my-tool',
        args: ['--verbose', '--port', '3000'],
        cwd: '/home/user/project',
      });

      expect(config.args).toEqual(['--verbose', '--port', '3000']);
      expect(config.cwd).toBe('/home/user/project');
    });

    it('should merge custom env with defaults', () => {
      const config = createCustomAgentConfig({
        name: 'Custom Env',
        command: 'my-tool',
        env: { API_KEY: 'secret', NODE_ENV: 'production' },
      });

      expect(config.env?.TERM).toBe('xterm-256color');
      expect(config.env?.API_KEY).toBe('secret');
      expect(config.env?.NODE_ENV).toBe('production');
    });
  });

  // ==========================================================================
  // resetPresets
  // ==========================================================================

  describe('resetPresets', () => {
    it('should remove custom presets and keep built-ins', () => {
      registerPreset({
        name: 'custom-1',
        description: 'Custom 1',
        agents: [{ type: 'shell', name: 'C1', command: '/bin/sh' }],
      });
      registerPreset({
        name: 'custom-2',
        description: 'Custom 2',
        agents: [{ type: 'shell', name: 'C2', command: '/bin/sh' }],
      });

      expect(hasPreset('custom-1')).toBe(true);
      expect(hasPreset('custom-2')).toBe(true);

      resetPresets();

      expect(hasPreset('custom-1')).toBe(false);
      expect(hasPreset('custom-2')).toBe(false);
      expect(hasPreset('claude')).toBe(true);
      expect(hasPreset('shell')).toBe(true);
    });
  });

  // ==========================================================================
  // Integration: Preset creates valid AgentConfig
  // ==========================================================================

  describe('Integration', () => {
    it('claude preset produces config compatible with AgentManager.createAgent', () => {
      const agents = resolvePreset('claude', { cwd: '/workspace/myproject' });
      expect(agents).toBeDefined();

      const config = agents![0];

      // Must have required fields
      expect(config.type).toBe('claude');
      expect(config.name).toBeTruthy();
      expect(config.command).toBeTruthy();
      expect(config.cwd).toBe('/workspace/myproject');

      // Container must be valid
      expect(config.container).toBeDefined();
      expect(config.container!.image).toBeTruthy();
      expect(config.container!.workDir).toBeTruthy();
    });

    it('shell preset produces config compatible with AgentManager.createAgent', () => {
      const agents = resolvePreset('shell', { cwd: '/home/user' });
      expect(agents).toBeDefined();

      const config = agents![0];

      expect(config.type).toBe('shell');
      expect(config.command).toBe('/bin/sh');
      expect(config.cwd).toBe('/home/user');
      expect(config.container).toBeDefined();
    });
  });
});
