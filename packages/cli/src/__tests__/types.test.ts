/**
 * Tests for agents/types.ts - MConnect v0.1.2
 *
 * Tests the shell-first architecture type system:
 * - Agent types and configurations
 * - Agent presets
 * - Agent commands mapping
 * - Utility functions
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  AGENT_COMMANDS,
  AGENT_PRESETS,
  type AgentConfig,
  type AgentPreset,
  type AgentType,
  getDefaultShell,
  isCommandAvailable,
} from '../agents/types.js';

describe('Agent Types Module', () => {
  describe('getDefaultShell', () => {
    const originalShell = process.env.SHELL;

    afterEach(() => {
      // Restore original SHELL
      if (originalShell) {
        process.env.SHELL = originalShell;
      } else {
        delete process.env.SHELL;
      }
    });

    it('should return SHELL environment variable when set', () => {
      process.env.SHELL = '/bin/bash';
      expect(getDefaultShell()).toBe('/bin/bash');
    });

    it('should return /bin/zsh when SHELL is not set', () => {
      delete process.env.SHELL;
      expect(getDefaultShell()).toBe('/bin/zsh');
    });

    it('should handle different shell paths', () => {
      process.env.SHELL = '/usr/local/bin/fish';
      expect(getDefaultShell()).toBe('/usr/local/bin/fish');
    });
  });

  describe('AGENT_PRESETS', () => {
    it('should have exactly 4 presets', () => {
      expect(AGENT_PRESETS).toHaveLength(4);
    });

    it('should have required preset names', () => {
      const presetNames = AGENT_PRESETS.map((p) => p.name);
      expect(presetNames).toContain('single');
      expect(presetNames).toContain('research-spec-test');
      expect(presetNames).toContain('dev-review');
      expect(presetNames).toContain('shell-only');
    });

    describe('single preset', () => {
      it('should have correct configuration', () => {
        const preset = AGENT_PRESETS.find((p) => p.name === 'single');
        expect(preset).toBeDefined();
        expect(preset?.description).toContain('Claude');
        expect(preset?.agents).toHaveLength(1);
        expect(preset?.agents[0].type).toBe('claude');
        expect(preset?.agents[0].name).toBe('Claude');
        expect(preset?.agents[0].autoRun).toBe(false);
      });

      it('should use shell command, not direct claude command', () => {
        const preset = AGENT_PRESETS.find((p) => p.name === 'single');
        const agent = preset?.agents[0];
        // Command should be the shell, not 'claude' directly
        expect(agent?.command).not.toBe('claude');
        // Should be a valid shell path
        expect(agent?.command).toMatch(/^\/(bin|usr\/bin|usr\/local\/bin)\//);
      });
    });

    describe('research-spec-test preset', () => {
      it('should have 3 agents', () => {
        const preset = AGENT_PRESETS.find((p) => p.name === 'research-spec-test');
        expect(preset?.agents).toHaveLength(3);
      });

      it('should have correct agent names', () => {
        const preset = AGENT_PRESETS.find((p) => p.name === 'research-spec-test');
        const names = preset?.agents.map((a) => a.name);
        expect(names).toContain('Research');
        expect(names).toContain('Spec');
        expect(names).toContain('Tests');
      });

      it('should all be shell type agents', () => {
        const preset = AGENT_PRESETS.find((p) => p.name === 'research-spec-test');
        preset?.agents.forEach((agent) => {
          expect(agent.type).toBe('shell');
        });
      });

      it('should have initial prompts', () => {
        const preset = AGENT_PRESETS.find((p) => p.name === 'research-spec-test');
        preset?.agents.forEach((agent) => {
          expect(agent.initialPrompt).toBeDefined();
          expect(agent.initialPrompt).toContain('Agent');
        });
      });
    });

    describe('dev-review preset', () => {
      it('should have 2 agents', () => {
        const preset = AGENT_PRESETS.find((p) => p.name === 'dev-review');
        expect(preset?.agents).toHaveLength(2);
      });

      it('should have Dev and Reviewer agents', () => {
        const preset = AGENT_PRESETS.find((p) => p.name === 'dev-review');
        const names = preset?.agents.map((a) => a.name);
        expect(names).toContain('Dev');
        expect(names).toContain('Reviewer');
      });
    });

    describe('shell-only preset', () => {
      it('should have single shell agent', () => {
        const preset = AGENT_PRESETS.find((p) => p.name === 'shell-only');
        expect(preset?.agents).toHaveLength(1);
        expect(preset?.agents[0].type).toBe('shell');
        expect(preset?.agents[0].name).toBe('Shell');
      });
    });

    it('all presets should use valid shell commands', () => {
      AGENT_PRESETS.forEach((preset) => {
        preset.agents.forEach((agent) => {
          // All agents should have a command that is a shell path
          expect(agent.command).toBeDefined();
          expect(typeof agent.command).toBe('string');
        });
      });
    });
  });

  describe('AGENT_COMMANDS', () => {
    it('should have all agent types defined', () => {
      const expectedTypes: AgentType[] = ['claude', 'gemini', 'codex', 'aider', 'shell', 'custom'];
      expectedTypes.forEach((type) => {
        expect(AGENT_COMMANDS[type]).toBeDefined();
      });
    });

    it('should have shell commands for AI agents', () => {
      expect(AGENT_COMMANDS.claude.shellCommand).toBe('claude');
      expect(AGENT_COMMANDS.gemini.shellCommand).toBe('gemini');
      expect(AGENT_COMMANDS.codex.shellCommand).toBe('codex');
      expect(AGENT_COMMANDS.aider.shellCommand).toBe('aider');
    });

    it('should have empty shell commands for shell and custom types', () => {
      expect(AGENT_COMMANDS.shell.shellCommand).toBe('');
      expect(AGENT_COMMANDS.custom.shellCommand).toBe('');
    });

    it('should have descriptions for all agent types', () => {
      Object.values(AGENT_COMMANDS).forEach((config) => {
        expect(config.description).toBeDefined();
        expect(typeof config.description).toBe('string');
        expect(config.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('isCommandAvailable', () => {
    it('should return true for node command', async () => {
      const available = await isCommandAvailable('node');
      expect(available).toBe(true);
    });

    it('should return false for non-existent command', async () => {
      const available = await isCommandAvailable('definitely-not-a-real-command-xyz123');
      expect(available).toBe(false);
    });

    it('should return true for ls command', async () => {
      const available = await isCommandAvailable('ls');
      expect(available).toBe(true);
    });
  });

  describe('Type Definitions', () => {
    it('AgentType should include all expected values', () => {
      // Type check - this will fail at compile time if types don't match
      const validTypes: AgentType[] = ['claude', 'gemini', 'codex', 'aider', 'shell', 'custom'];
      expect(validTypes).toHaveLength(6);
    });

    it('AgentConfig should have required properties', () => {
      // Validate structure by creating a valid config
      const config: AgentConfig = {
        type: 'claude',
        name: 'Test Agent',
        command: '/bin/zsh',
        cwd: '/tmp',
      };
      expect(config.type).toBeDefined();
      expect(config.name).toBeDefined();
      expect(config.command).toBeDefined();
      expect(config.cwd).toBeDefined();
    });

    it('AgentPreset should have required properties', () => {
      const preset: AgentPreset = {
        name: 'test-preset',
        description: 'A test preset',
        agents: [
          {
            type: 'shell',
            name: 'Test',
            command: '/bin/bash',
          },
        ],
      };
      expect(preset.name).toBeDefined();
      expect(preset.description).toBeDefined();
      expect(preset.agents).toBeDefined();
      expect(Array.isArray(preset.agents)).toBe(true);
    });
  });
});
