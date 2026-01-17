/**
 * WebSocket Message Types for MConnect v0.1.2
 *
 * Protocol for multiplexed multi-agent terminal control
 */

import type { AgentConfig, AgentInfo, AgentStatus } from '../agents/types.js';
import type { ServerMessageV2, ClientMessageV2 } from './protocol.js';

// ============================================
// Client -> Server Messages
// ============================================

export interface ClientInputMessage {
  type: 'input';
  agentId: string;
  data: string;
}

export interface ClientResizeMessage {
  type: 'resize';
  agentId: string;
  cols: number;
  rows: number;
}

export interface ClientCreateAgentMessage {
  type: 'create_agent';
  config: Omit<AgentConfig, 'cwd'>;
}

export interface ClientKillAgentMessage {
  type: 'kill_agent';
  agentId: string;
  signal?: string;
}

export interface ClientSwitchAgentMessage {
  type: 'switch_agent';
  agentId: string;
}

export interface ClientListAgentsMessage {
  type: 'list_agents';
}

export interface ClientPingMessage {
  type: 'ping';
}

export interface ClientModeChangeMessage {
  type: 'mode_change';
  readOnly: boolean;
}

export type ClientMessage =
  | ClientInputMessage
  | ClientResizeMessage
  | ClientCreateAgentMessage
  | ClientKillAgentMessage
  | ClientSwitchAgentMessage
  | ClientListAgentsMessage
  | ClientPingMessage
  | ClientModeChangeMessage
  | ClientMessageV2;

// ============================================
// Server -> Client Messages
// ============================================

export interface ServerOutputMessage {
  type: 'output';
  agentId: string;
  data: string;
  timestamp: number;
}

export interface ServerAgentCreatedMessage {
  type: 'agent_created';
  agent: AgentInfo;
  timestamp: number;
}

export interface ServerAgentExitedMessage {
  type: 'agent_exited';
  agentId: string;
  exitCode: number;
  signal?: number;
  timestamp: number;
}

export interface ServerAgentStatusMessage {
  type: 'agent_status';
  agentId: string;
  status: AgentStatus;
  timestamp: number;
}

export interface ServerAgentListMessage {
  type: 'agent_list';
  agents: AgentInfo[];
  timestamp: number;
}

export interface ServerSessionInfoMessage {
  type: 'session_info';
  sessionId: string;
  isReadOnly: boolean;
  agents: AgentInfo[];
  timestamp: number;
}

export interface ServerModeChangedMessage {
  type: 'mode_changed';
  isReadOnly: boolean;
  timestamp: number;
}

export interface ServerErrorMessage {
  type: 'error';
  message: string;
  agentId?: string;
  timestamp: number;
}

export interface ServerCommandBlockedMessage {
  type: 'command_blocked';
  agentId: string;
  command: string;
  reason: string;
  timestamp: number;
}

export interface ServerApprovalRequestMessage {
  type: 'approval_request';
  agentId: string;
  command: string;
  reason: string;
  timestamp: number;
}

export interface ServerPongMessage {
  type: 'pong';
  timestamp: number;
}

export type ServerMessage =
  | ServerOutputMessage
  | ServerAgentCreatedMessage
  | ServerAgentExitedMessage
  | ServerAgentStatusMessage
  | ServerAgentListMessage
  | ServerSessionInfoMessage
  | ServerModeChangedMessage
  | ServerErrorMessage
  | ServerCommandBlockedMessage
  | ServerApprovalRequestMessage
  | ServerPongMessage
  | ServerMessageV2;

// ============================================
// Connection Types
// ============================================

export interface ClientInfo {
  /** Client IP address */
  ip: string;
  /** Connection timestamp */
  connectedAt: number;
  /** Authentication status */
  authenticated: boolean;
  /** Currently focused agent */
  focusedAgentId?: string;
}

export interface WSHubConfig {
  /** Session token for authentication */
  token: string;
  /** Session ID */
  sessionId: string;
  /** Rate limit (connections per minute per IP) */
  rateLimit?: number;
  /** Rate limit window (ms) */
  rateLimitWindow?: number;
}

// ============================================
// Protocol v2 Message Types (MConnect v0.2.0)
// ============================================

// Re-export all v2 protocol types for convenience
export * from './protocol.js';
