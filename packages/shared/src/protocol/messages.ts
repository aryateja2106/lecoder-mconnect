/**
 * WebSocket Protocol v3.0 Message Types
 *
 * Protocol v3.0 extends v2.0 with:
 * - MCP message routing
 * - OAuth token authentication (not query param)
 * - Structured error responses with retry hints
 * - Binary message support for large outputs
 */

import type { AgentStatus, AgentInfo } from '../types/agents.js';
import type { ClientType, SessionState, SessionInfo, ClientInfo } from '../types/models.js';
import type { MCPMessage } from '../types/mcp.js';

// ============================================================================
// Protocol Constants
// ============================================================================

/**
 * Current protocol version
 */
export const PROTOCOL_VERSION = '3.0';

/**
 * Rate limits for protocol operations
 */
export const RATE_LIMITS = {
  /** Max characters per second for input */
  inputCharsPerSecond: 100,
  /** Max control requests per window */
  controlRequestsPerWindow: 1,
  /** Control request window in milliseconds */
  controlRequestWindowMs: 10000,
  /** Max scrollback requests per second */
  scrollbackRequestsPerSecond: 10,
  /** Max MCP messages per second */
  mcpMessagesPerSecond: 20,
  /** Max reconnection attempts per minute */
  reconnectionAttemptsPerMinute: 5,
} as const;

// ============================================================================
// Base Types
// ============================================================================

/**
 * Base message structure for all WebSocket messages
 */
export interface BaseMessage {
  /** Message type discriminator */
  type: string;
  /** Optional message ID for request/response correlation */
  id?: string;
  /** Unix timestamp (server messages always include) */
  timestamp?: number;
}

// ============================================================================
// Client → Server Messages
// ============================================================================

/**
 * Authentication message (must be first message after connection)
 */
export interface AuthMessage extends BaseMessage {
  type: 'auth';
  /** JWT access token */
  token: string;
  /** Protocol version */
  protocolVersion: typeof PROTOCOL_VERSION;
  /** Client device type */
  clientType: ClientType;
}

/**
 * Attach to a session
 */
export interface SessionAttachMessage extends BaseMessage {
  type: 'session_attach';
  /** Session ID to attach to */
  sessionId: string;
}

/**
 * Detach from current session
 */
export interface SessionDetachMessage extends BaseMessage {
  type: 'session_detach';
}

/**
 * Send terminal input to an agent
 */
export interface TerminalInputMessage extends BaseMessage {
  type: 'terminal_input';
  /** Target agent ID */
  agentId: string;
  /** Input data */
  data: string;
}

/**
 * Resize terminal for an agent
 */
export interface ResizeMessage extends BaseMessage {
  type: 'resize';
  /** Target agent ID */
  agentId: string;
  /** New column count */
  cols: number;
  /** New row count */
  rows: number;
}

/**
 * Request input control
 */
export interface ControlRequestMessage extends BaseMessage {
  type: 'control_request';
  /** Action to take */
  action: 'exclusive' | 'release';
}

/**
 * Request scrollback history
 */
export interface ScrollbackRequestMessage extends BaseMessage {
  type: 'scrollback_request';
  /** Session ID */
  sessionId: string;
  /** Starting line number */
  fromLine: number;
  /** Number of lines to fetch */
  count: number;
}

/**
 * Forward MCP message to an agent
 */
export interface MCPForwardMessage extends BaseMessage {
  type: 'mcp_forward';
  /** Target agent ID */
  agentId: string;
  /** MCP message to forward */
  message: MCPMessage;
}

/**
 * Heartbeat acknowledgment
 */
export interface HeartbeatAckMessage extends BaseMessage {
  type: 'heartbeat_ack';
  /** Timestamp from the heartbeat */
  timestamp: number;
}

/**
 * Ping message
 */
export interface PingMessage extends BaseMessage {
  type: 'ping';
}

/**
 * Union type for all client messages
 */
export type ClientMessage =
  | AuthMessage
  | SessionAttachMessage
  | SessionDetachMessage
  | TerminalInputMessage
  | ResizeMessage
  | ControlRequestMessage
  | ScrollbackRequestMessage
  | MCPForwardMessage
  | HeartbeatAckMessage
  | PingMessage;

// ============================================================================
// Server → Client Messages
// ============================================================================

/**
 * Authentication success response
 */
export interface AuthSuccessMessage extends BaseMessage {
  type: 'auth_success';
  /** Assigned client ID */
  clientId: string;
  /** Protocol version confirmed */
  protocolVersion: typeof PROTOCOL_VERSION;
  /** Client type confirmed */
  clientType: ClientType;
  /** Authenticated user ID */
  userId: string;
  /** Server timestamp */
  timestamp: number;
}

/**
 * Authentication failure response
 */
export interface AuthFailedMessage extends BaseMessage {
  type: 'auth_failed';
  /** Failure reason */
  reason: 'invalid_token' | 'expired_token' | 'missing_token';
  /** Whether the client can retry */
  retryable: boolean;
  /** Server timestamp */
  timestamp: number;
}

/**
 * List of available sessions
 */
export interface SessionListMessage extends BaseMessage {
  type: 'session_list';
  /** Available sessions */
  sessions: SessionInfo[];
  /** Server timestamp */
  timestamp: number;
}

/**
 * Session state update
 */
export interface SessionStateMessage extends BaseMessage {
  type: 'session_state';
  /** Session ID */
  sessionId: string;
  /** Current state */
  state: SessionState;
  /** Last activity timestamp (Unix) */
  lastActivity: number;
  /** Server timestamp */
  timestamp: number;
}

/**
 * Terminal output from an agent
 */
export interface TerminalOutputMessage extends BaseMessage {
  type: 'terminal_output';
  /** Source agent ID */
  agentId: string;
  /** Output data */
  data: string;
  /** Server timestamp */
  timestamp: number;
}

/**
 * Agent status update
 */
export interface AgentStatusMessage extends BaseMessage {
  type: 'agent_status';
  /** Agent ID */
  agentId: string;
  /** New status */
  status: AgentStatus;
  /** Server timestamp */
  timestamp: number;
}

/**
 * List of agents in session
 */
export interface AgentListMessage extends BaseMessage {
  type: 'agent_list';
  /** Agents in the session */
  agents: AgentInfo[];
  /** Server timestamp */
  timestamp: number;
}

/**
 * Control state for input arbitration
 */
export type ControlState = 'pc_active' | 'pc_idle' | 'pc_disconnected' | 'mobile_exclusive';

/**
 * Control status update
 */
export interface ControlStatusMessage extends BaseMessage {
  type: 'control_status';
  /** Session ID */
  sessionId: string;
  /** Current control state */
  state: ControlState;
  /** Active client ID (if any) */
  activeClient?: string;
  /** Exclusive control expiration (Unix timestamp) */
  exclusiveExpires?: number;
  /** Last PC activity (Unix timestamp) */
  lastPcActivity?: number;
  /** Server timestamp */
  timestamp: number;
}

/**
 * Control request response
 */
export interface ControlResponseMessage extends BaseMessage {
  type: 'control_response';
  /** Whether control was granted */
  granted: boolean;
  /** Reason if denied */
  reason?: string;
  /** Expiration time if granted (Unix timestamp) */
  expiresAt?: number;
  /** Server timestamp */
  timestamp: number;
}

/**
 * Input rejection reasons
 */
export type InputRejectionReason =
  | 'pc_typing'
  | 'other_exclusive'
  | 'rate_limited'
  | 'read_only'
  | 'guardrail_blocked';

/**
 * Input rejection notification
 */
export interface InputRejectedMessage extends BaseMessage {
  type: 'input_rejected';
  /** Rejection reason */
  reason: InputRejectionReason;
  /** Rejected command (if guardrail blocked) */
  command?: string;
  /** Server timestamp */
  timestamp: number;
}

/**
 * Scrollback history response
 */
export interface ScrollbackResponseMessage extends BaseMessage {
  type: 'scrollback_response';
  /** Session ID */
  sessionId: string;
  /** Returned lines */
  lines: string[];
  /** Starting line number */
  fromLine: number;
  /** Total lines in buffer */
  totalLines: number;
  /** Server timestamp */
  timestamp: number;
}

/**
 * MCP response from agent
 */
export interface MCPResponseMessage extends BaseMessage {
  type: 'mcp_response';
  /** Source agent ID */
  agentId: string;
  /** MCP response message */
  message: MCPMessage;
  /** Server timestamp */
  timestamp: number;
}

/**
 * Client joined notification
 */
export interface ClientJoinedMessage extends BaseMessage {
  type: 'client_joined';
  /** Joined client info */
  client: ClientInfo;
  /** Server timestamp */
  timestamp: number;
}

/**
 * Client left notification
 */
export interface ClientLeftMessage extends BaseMessage {
  type: 'client_left';
  /** Client ID that left */
  clientId: string;
  /** Server timestamp */
  timestamp: number;
}

/**
 * Server heartbeat
 */
export interface HeartbeatMessage extends BaseMessage {
  type: 'heartbeat';
  /** Heartbeat timestamp */
  timestamp: number;
  /** Server time (Unix timestamp) */
  serverTime: number;
}

/**
 * Pong response
 */
export interface PongMessage extends BaseMessage {
  type: 'pong';
  /** Server timestamp */
  timestamp: number;
}

/**
 * Error codes for protocol errors
 */
export type ErrorCode =
  | 'AUTH_FAILED'
  | 'AUTH_EXPIRED'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_COMPLETED'
  | 'NOT_ATTACHED'
  | 'RATE_LIMITED'
  | 'GUARDRAIL_BLOCKED'
  | 'INTERNAL_ERROR';

/**
 * Error message
 */
export interface ErrorMessage extends BaseMessage {
  type: 'error';
  /** Error description */
  message: string;
  /** Error code */
  code: ErrorCode;
  /** Whether the client can retry */
  retryable: boolean;
  /** Suggested retry delay in milliseconds */
  retryAfterMs?: number;
  /** Server timestamp */
  timestamp: number;
}

/**
 * Union type for all server messages
 */
export type ServerMessage =
  | AuthSuccessMessage
  | AuthFailedMessage
  | SessionListMessage
  | SessionStateMessage
  | TerminalOutputMessage
  | AgentStatusMessage
  | AgentListMessage
  | ControlStatusMessage
  | ControlResponseMessage
  | InputRejectedMessage
  | ScrollbackResponseMessage
  | MCPResponseMessage
  | ClientJoinedMessage
  | ClientLeftMessage
  | HeartbeatMessage
  | PongMessage
  | ErrorMessage;

// ============================================================================
// Message Type Guards
// ============================================================================

/**
 * Check if a message is a client message
 */
export function isClientMessage(msg: BaseMessage): msg is ClientMessage {
  return [
    'auth',
    'session_attach',
    'session_detach',
    'terminal_input',
    'resize',
    'control_request',
    'scrollback_request',
    'mcp_forward',
    'heartbeat_ack',
    'ping',
  ].includes(msg.type);
}

/**
 * Check if a message is a server message
 */
export function isServerMessage(msg: BaseMessage): msg is ServerMessage {
  return [
    'auth_success',
    'auth_failed',
    'session_list',
    'session_state',
    'terminal_output',
    'agent_status',
    'agent_list',
    'control_status',
    'control_response',
    'input_rejected',
    'scrollback_response',
    'mcp_response',
    'client_joined',
    'client_left',
    'heartbeat',
    'pong',
    'error',
  ].includes(msg.type);
}
