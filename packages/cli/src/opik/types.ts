/**
 * Opik Tracing Types for MConnect
 *
 * Type definitions for observability spans tracked by the OpikTracer.
 * These types define the structured data captured at each lifecycle event.
 */

/**
 * Opik SDK configuration
 */
export interface OpikConfig {
  /** Opik API key (optional - graceful fallback if not set) */
  apiKey?: string;
  /** Opik API URL (defaults to Comet cloud) */
  apiUrl?: string;
  /** Project name for organizing traces */
  projectName: string;
  /** Workspace name in Opik */
  workspaceName?: string;
  /** Environment identifier (e.g., 'development', 'production') */
  environment?: string;
}

/**
 * Session span attributes - root trace for MConnect session
 */
export interface SessionSpanAttributes {
  /** Unique session identifier */
  sessionId: string;
  /** Guardrails preset (e.g., 'default', 'strict', 'permissive') */
  guardrailsPreset: string;
  /** Working directory for the session */
  workDir: string;
  /** Session start timestamp */
  startTime: number;
  /** Whether tunnel is available */
  tunnelEnabled: boolean;
  /** Whether tmux is enabled */
  tmuxEnabled: boolean;
  /** Whether PTY manager initialized successfully */
  ptyInitialized: boolean;
}

/**
 * Agent span attributes - child span for agent lifecycle
 */
export interface AgentSpanAttributes {
  /** Parent session ID */
  sessionId: string;
  /** Unique agent identifier */
  agentId: string;
  /** Agent type (e.g., 'claude-code', 'gemini-cli', 'shell') */
  agentType: string;
  /** Agent display name */
  agentName: string;
  /** Working directory for the agent */
  workDir: string;
  /** Whether running in container */
  isContainerized: boolean;
  /** Container ID if applicable */
  containerId?: string;
  /** Agent spawn timestamp */
  startTime: number;
}

/**
 * Agent exit span data
 */
export interface AgentExitData {
  /** Exit code from the process */
  exitCode: number;
  /** Signal that terminated the process (if any) */
  signal?: number;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Command span attributes - for command execution tracking
 */
export interface CommandSpanAttributes {
  /** Parent session ID */
  sessionId: string;
  /** Agent that received the command */
  agentId: string;
  /** The command string (sanitized) */
  command: string;
  /** Source of the command ('mobile' | 'pc' | 'local') */
  source: 'mobile' | 'pc' | 'local';
  /** Whether the command was blocked by guardrails */
  blocked: boolean;
  /** Reason for blocking (if applicable) */
  blockReason?: string;
  /** Whether the command required approval */
  requiresApproval: boolean;
  /** Timestamp of command */
  timestamp: number;
}

/**
 * Approval span attributes - for approval request/response tracking
 */
export interface ApprovalSpanAttributes {
  /** Parent session ID */
  sessionId: string;
  /** Agent that triggered the approval */
  agentId: string;
  /** The command requiring approval */
  command: string;
  /** Reason approval is required */
  reason: string;
  /** Timestamp of approval request */
  requestTime: number;
}

/**
 * Approval response data
 */
export interface ApprovalResponseData {
  /** Whether the command was approved */
  approved: boolean;
  /** Who approved/denied ('mobile' | 'pc') */
  responder?: 'mobile' | 'pc';
  /** Response time in milliseconds */
  responseTime: number;
}

/**
 * Client connection span attributes
 */
export interface ClientConnectionAttributes {
  /** Parent session ID */
  sessionId: string;
  /** Unique client identifier */
  clientId: string;
  /** Client type ('mobile' | 'pc') */
  clientType: 'mobile' | 'pc';
  /** Client IP address (hashed for privacy) */
  ipHash: string;
  /** Connection timestamp */
  connectedAt: number;
}

/**
 * Span types used in MConnect tracing
 */
export type MConnectSpanType =
  | 'session'
  | 'agent'
  | 'command'
  | 'approval'
  | 'client_connection';

/**
 * Combined span attributes union type
 */
export type SpanAttributes =
  | SessionSpanAttributes
  | AgentSpanAttributes
  | CommandSpanAttributes
  | ApprovalSpanAttributes
  | ClientConnectionAttributes;
