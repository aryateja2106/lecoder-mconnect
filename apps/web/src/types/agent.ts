/**
 * Agent & session types for the MConnect web app
 */

export type AgentState = 'idle' | 'connecting' | 'thinking' | 'executing' | 'error';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error' | 'unauthorized';

export type GuardrailLevel = 'default' | 'strict' | 'permissive' | 'none';

export interface Machine {
  id: string;
  name: string;
  os: 'macos' | 'linux' | 'windows';
  online: boolean;
  agentCount: number;
  ip?: string;
  lastSeen: number;
}

export interface AgentSession {
  id: string;
  agentName: string;
  agentState: AgentState;
  machineId: string;
  machineName: string;
  lastOutput: string;
  createdAt: number;
  lastActivity: number;
  connectedClients: number;
  guardrails: GuardrailLevel;
  workingDirectory: string;
  preset: string;
}

export interface AgentPreset {
  id: string;
  name: string;
  description: string;
  agentCount: number;
  icon: string;
  tags: string[];
}

export interface VoxSuggestion {
  query: string;
  command: string;
  isDangerous: boolean;
  model: string;
  latencyMs: number;
}

export interface VoxInteraction {
  id: string;
  query: string;
  suggestedCommand: string;
  userAction: 'accept' | 'edit' | 'reject' | 'error';
  editedCommand?: string;
  isDangerous: boolean;
  model: string;
  latencyMs: number;
  exitCode?: number;
  timestamp: number;
}

export interface ApprovalRequest {
  command: string;
  reason: string;
  sessionId: string;
}

// Agent preset definitions (matches CLI presets)
export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: 'shell-only',
    name: 'Shell Only',
    description: 'Single interactive shell. Best for first-time setup.',
    agentCount: 1,
    icon: 'terminal',
    tags: ['simple', 'recommended'],
  },
  {
    id: 'single',
    name: 'Single Agent',
    description: 'One Claude Code agent with full terminal access.',
    agentCount: 1,
    icon: 'bot',
    tags: ['agent'],
  },
  {
    id: 'research-spec-test',
    name: 'Research + Spec + Test',
    description: '3 parallel shells for research, spec writing, and testing.',
    agentCount: 3,
    icon: 'layers',
    tags: ['parallel', 'advanced'],
  },
  {
    id: 'dev-review',
    name: 'Dev + Review',
    description: '2 shells: one for development, one for code review.',
    agentCount: 2,
    icon: 'git-branch',
    tags: ['workflow'],
  },
  {
    id: 'container-dev',
    name: 'Container Dev',
    description: 'Isolated shell in Docker container (Ubuntu 22.04).',
    agentCount: 1,
    icon: 'container',
    tags: ['isolated', 'docker'],
  },
];
