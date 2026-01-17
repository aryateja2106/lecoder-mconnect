/**
 * WebSocket Protocol v2 Message Types for MConnect v0.2.0
 *
 * Extends v1 protocol with session management, input arbitration,
 * scrollback, and presence messages
 */

import type { ClientType, Priority, SessionState } from '../session/types.js';

// ============================================
// Client -> Server Messages (v2)
// ============================================

/** Attach to a specific session */
export interface SessionAttachMessage {
  type: 'session_attach';
  sessionId: string;
}

/** Detach from current session (stay connected to daemon) */
export interface SessionDetachMessage {
  type: 'session_detach';
}

/** Request historical terminal output */
export interface ScrollbackRequestMessage {
  type: 'scrollback_request';
  sessionId: string;
  fromLine: number; // Starting line number (0-indexed)
  count: number; // Number of lines to fetch (max 1000)
}

/** Request or release input control */
export interface ControlRequestMessage {
  type: 'control_request';
  action: 'exclusive' | 'release';
}

/** Acknowledge server heartbeat */
export interface HeartbeatAckMessage {
  type: 'heartbeat_ack';
  timestamp: number; // Echo back server timestamp
}

/** Terminal input (v1 compatible with optional agentId) */
export interface TerminalInputMessage {
  type: 'terminal_input';
  data: string;
  agentId?: string; // Target agent (optional, defaults to active)
}

/** Resize terminal (v1 compatible) */
export interface ResizeMessage {
  type: 'resize';
  cols: number;
  rows: number;
}

/** Ping for keepalive (v1 compatible) */
export interface PingMessage {
  type: 'ping';
}

export type ClientMessageV2 =
  | SessionAttachMessage
  | SessionDetachMessage
  | ScrollbackRequestMessage
  | ControlRequestMessage
  | HeartbeatAckMessage
  | TerminalInputMessage
  | ResizeMessage
  | PingMessage;

// ============================================
// Server -> Client Messages (v2)
// ============================================

/** Authentication succeeded */
export interface AuthSuccessMessage {
  type: 'auth_success';
  clientId: string;
  protocolVersion: '2.0';
  clientType: ClientType;
}

/** List of available sessions */
export interface SessionListMessage {
  type: 'session_list';
  sessions: SessionInfo[];
}

export interface SessionInfo {
  id: string;
  state: SessionState;
  createdAt: number; // Unix timestamp
  lastActivity: number;
  agentConfig: {
    preset: string;
    agents: string[];
  };
  workingDirectory: string;
  connectedClients: number;
}

/** Session state update (broadcast on change) */
export interface SessionStateMessage {
  type: 'session_state';
  sessionId: string;
  state: SessionState;
  lastActivity: number;
}

/** Historical terminal output */
export interface ScrollbackResponseMessage {
  type: 'scrollback_response';
  sessionId: string;
  lines: string[];
  fromLine: number;
  totalLines: number;
}

/** Current input control state (broadcast on change) */
export interface ControlStatusMessage {
  type: 'control_status';
  sessionId: string;
  currentOwner?: {
    clientId: string;
    clientType: ClientType;
    priority: Priority;
  } | string | null; // Can be object, string clientId, or null
  pcStatus?: 'active' | 'idle' | 'disconnected';
  exclusiveExpires?: number; // Unix timestamp if exclusive
  // Extended fields for internal use
  state?: import('../session/types.js').ArbiterState;
  activeClient?: string;
  lastPcActivity?: number;
}

/** Response to control request */
export interface ControlResponseMessage {
  type: 'control_response';
  granted: boolean;
  reason?: string; // Error reason if not granted
  expiresAt?: number; // Unix timestamp when control expires (if granted)
}

/** Input was not forwarded to PTY */
export interface InputRejectedMessage {
  type: 'input_rejected';
  reason: 'pc_typing' | 'other_exclusive' | 'rate_limited' | 'read_only';
  input?: string; // Original input (for client retry) - optional
}

/** Another client connected to session */
export interface ClientJoinedMessage {
  type: 'client_joined';
  client: {
    id: string;
    clientType: ClientType;
    priority: Priority;
  };
}

/** Client disconnected from session */
export interface ClientLeftMessage {
  type: 'client_left';
  clientId: string;
}

/** Server heartbeat (every 30 seconds) */
export interface HeartbeatMessage {
  type: 'heartbeat';
  timestamp: number; // Server Unix timestamp
  serverTime: number; // Server local time (for sync)
}

/** Terminal output (v1 compatible) */
export interface TerminalOutputMessage {
  type: 'terminal_output';
  data: string;
  agentId: string;
}

/** Agent list (v1 compatible) */
export interface AgentListMessage {
  type: 'agent_list';
  agents: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
  }>;
}

/** Pong response (v1 compatible) */
export interface PongMessage {
  type: 'pong';
}

/** Error response */
export interface ErrorMessage {
  type: 'error';
  message: string;
  code?: ErrorCode;
}

export type ErrorCode =
  | 'AUTH_FAILED'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_COMPLETED'
  | 'NOT_ATTACHED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export type ServerMessageV2 =
  | AuthSuccessMessage
  | SessionListMessage
  | SessionStateMessage
  | ScrollbackResponseMessage
  | ControlStatusMessage
  | ControlResponseMessage
  | InputRejectedMessage
  | ClientJoinedMessage
  | ClientLeftMessage
  | HeartbeatMessage
  | TerminalOutputMessage
  | AgentListMessage
  | PongMessage
  | ErrorMessage;

// ============================================
// Rate Limits
// ============================================

export const RATE_LIMITS = {
  inputCharsPerSecond: 100,
  controlRequestsPerWindow: 1,
  controlRequestWindowMs: 10000, // 10 seconds
  scrollbackRequestsPerSecond: 10,
  reconnectionAttemptsPerMinute: 5,
} as const;

// ============================================
// Protocol Constants
// ============================================

export const PROTOCOL_VERSION = '2.0';
export const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
export const MAX_SCROLLBACK_REQUEST = 1000; // Max lines per request
