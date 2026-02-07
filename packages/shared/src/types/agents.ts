/**
 * Agent Types for MConnect V2
 *
 * Shell-first architecture: All agents run inside a shell for proper
 * PATH resolution and environment handling.
 *
 * Container support: Agents can optionally run inside Docker containers
 * for isolation, supporting both inline config and devcontainer.json.
 */

import type { ContainerConfig } from './container.js';
import type { MCPConfig } from './mcp.js';

/**
 * Supported agent types
 */
export type AgentType = 'claude' | 'gemini' | 'codex' | 'aider' | 'shell' | 'custom';

/**
 * Agent lifecycle status
 */
export type AgentStatus = 'starting' | 'running' | 'idle' | 'waiting' | 'exited' | 'error';

/**
 * Configuration for creating an agent
 */
export interface AgentConfig {
  /** Agent type */
  type: AgentType;
  /** Display name */
  name: string;
  /** Command to execute (runs inside shell) */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Working directory */
  cwd?: string;
  /** Initial prompt to send after shell starts */
  initialPrompt?: string;
  /** Custom environment variables */
  env?: Record<string, string>;
  /** Run command immediately on shell start */
  autoRun?: boolean;
  /** Container configuration for isolated execution */
  container?: ContainerConfig;
  /** MCP (Model Context Protocol) configuration */
  mcp?: MCPConfig;
}

/**
 * Agent instance with runtime information
 */
export interface AgentInfo {
  /** Unique agent ID (UUID) */
  id: string;
  /** Agent configuration */
  config: AgentConfig;
  /** Current status */
  status: AgentStatus;
  /** PTY ID (if running) */
  ptyId?: string;
  /** Process ID (if running) */
  pid?: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
  /** Exit code (if exited) */
  exitCode?: number;
  /** Container info (if running in container) */
  containerInfo?: {
    id: string;
    name: string;
    image: string;
  };
}

/**
 * Agent preset definition
 */
export interface AgentPreset {
  /** Preset name (identifier) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Agents to create (without cwd, will be set at runtime) */
  agents: Omit<AgentConfig, 'cwd'>[];
}

/**
 * Agent command configurations
 * Defines what command to run INSIDE the shell for each agent type.
 */
export interface AgentCommand {
  /** Command to run inside shell (empty = just shell) */
  shellCommand: string;
  /** Human-readable description */
  description: string;
}

/**
 * Agent commands by type
 */
export const AGENT_COMMANDS: Record<AgentType, AgentCommand> = {
  claude: {
    shellCommand: 'claude',
    description: 'Claude Code CLI',
  },
  gemini: {
    shellCommand: 'gemini',
    description: 'Google Gemini CLI',
  },
  codex: {
    shellCommand: 'codex',
    description: 'OpenAI Codex CLI',
  },
  aider: {
    shellCommand: 'aider',
    description: 'Aider AI pair programmer',
  },
  shell: {
    shellCommand: '',
    description: 'Interactive shell',
  },
  custom: {
    shellCommand: '',
    description: 'Custom command',
  },
};
