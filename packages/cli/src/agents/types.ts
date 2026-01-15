/**
 * Agent Types for MConnect v0.1.2
 *
 * Shell-first architecture: All agents run inside a shell for proper
 * PATH resolution and environment handling.
 */

export type AgentType = 'claude' | 'gemini' | 'codex' | 'aider' | 'shell' | 'custom';

export type AgentStatus = 'starting' | 'running' | 'idle' | 'waiting' | 'exited' | 'error';

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
  cwd: string;
  /** Initial prompt to send after shell starts */
  initialPrompt?: string;
  /** Custom environment variables */
  env?: Record<string, string>;
  /** Run command immediately on shell start */
  autoRun?: boolean;
}

export interface AgentInfo {
  /** Unique agent ID */
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
  createdAt: number;
  /** Last activity timestamp */
  lastActivityAt: number;
  /** Exit code (if exited) */
  exitCode?: number;
}

export interface AgentPreset {
  /** Preset name */
  name: string;
  /** Description */
  description: string;
  /** Agents to create */
  agents: Omit<AgentConfig, 'cwd'>[];
}

/**
 * Get the user's default shell
 */
export function getDefaultShell(): string {
  return process.env.SHELL || '/bin/zsh';
}

/**
 * Common agent presets
 *
 * All presets use shell-first approach:
 * - Shell is always spawned first
 * - AI commands are run inside the shell
 * - This ensures PATH and environment are correct
 */
export const AGENT_PRESETS: AgentPreset[] = [
  {
    name: 'single',
    description: 'Single AI agent (Claude Code)',
    agents: [
      {
        type: 'claude',
        name: 'Claude',
        command: getDefaultShell(),
        // Don't auto-run, let user start claude manually or we'll detect and run
        autoRun: false,
      },
    ],
  },
  {
    name: 'research-spec-test',
    description: 'Research + Specification + Tests (3 shells)',
    agents: [
      {
        type: 'shell',
        name: 'Research',
        command: getDefaultShell(),
        initialPrompt: '# Research Agent - Run: claude\n',
      },
      {
        type: 'shell',
        name: 'Spec',
        command: getDefaultShell(),
        initialPrompt: '# Spec Agent - Run: claude\n',
      },
      {
        type: 'shell',
        name: 'Tests',
        command: getDefaultShell(),
        initialPrompt: '# Tests Agent - Run: claude\n',
      },
    ],
  },
  {
    name: 'dev-review',
    description: 'Development + Code Review (2 shells)',
    agents: [
      {
        type: 'shell',
        name: 'Dev',
        command: getDefaultShell(),
      },
      {
        type: 'shell',
        name: 'Reviewer',
        command: getDefaultShell(),
      },
    ],
  },
  {
    name: 'shell-only',
    description: 'Single interactive shell',
    agents: [
      {
        type: 'shell',
        name: 'Shell',
        command: getDefaultShell(),
      },
    ],
  },
];

/**
 * Agent command configurations
 *
 * These define what command to run INSIDE the shell for each agent type.
 * The shell itself is always spawned first.
 */
export const AGENT_COMMANDS: Record<AgentType, {
  shellCommand: string;  // Command to run inside shell (empty = just shell)
  description: string;
}> = {
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

/**
 * Check if a command is available in PATH
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  const { execSync } = await import('child_process');
  try {
    execSync(`command -v ${command}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
