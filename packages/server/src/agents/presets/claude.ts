/**
 * Claude Code Agent Preset
 *
 * Configures a Claude Code CLI agent running inside a container.
 * Uses ubuntu:22.04 as base image with MCP stdio transport enabled
 * for tool discovery and invocation.
 */

import type { AgentPreset } from '@lecoder/shared';

/**
 * Claude Code container image
 *
 * Uses ubuntu:22.04 as the base. In production, a custom image
 * with Claude Code pre-installed would be used.
 */
export const CLAUDE_IMAGE = 'ubuntu:22.04';

/**
 * Claude Code agent preset
 *
 * Creates a single Claude Code agent in a container with:
 * - MCP stdio transport for tool communication
 * - 1GB memory limit (Claude Code needs more than shell)
 * - /workspace as the working directory
 */
export const claudePreset: AgentPreset = {
  name: 'claude',
  description: 'Claude Code AI assistant with container isolation',
  agents: [
    {
      type: 'claude',
      name: 'Claude Code',
      command: 'claude',
      autoRun: true,
      env: {
        TERM: 'xterm-256color',
      },
      container: {
        image: CLAUDE_IMAGE,
        workDir: '/workspace',
        removeOnExit: true,
        resourceLimits: {
          memoryMB: 1024,
          cpuShares: 1024,
        },
      },
      mcp: {
        transport: 'stdio',
      },
    },
  ],
};

/**
 * Dev Review preset
 *
 * Two Claude Code agents in separate containers:
 * one for development, one for code review.
 */
export const devReviewPreset: AgentPreset = {
  name: 'dev-review',
  description: 'Developer + Reviewer: two Claude Code agents for pair programming',
  agents: [
    {
      type: 'claude',
      name: 'Developer',
      command: 'claude',
      autoRun: true,
      env: {
        TERM: 'xterm-256color',
      },
      container: {
        image: CLAUDE_IMAGE,
        workDir: '/workspace',
        removeOnExit: true,
        resourceLimits: {
          memoryMB: 1024,
          cpuShares: 1024,
        },
      },
      mcp: {
        transport: 'stdio',
      },
    },
    {
      type: 'claude',
      name: 'Reviewer',
      command: 'claude',
      autoRun: true,
      env: {
        TERM: 'xterm-256color',
      },
      container: {
        image: CLAUDE_IMAGE,
        workDir: '/workspace',
        removeOnExit: true,
        resourceLimits: {
          memoryMB: 1024,
          cpuShares: 1024,
        },
      },
      mcp: {
        transport: 'stdio',
      },
    },
  ],
};
