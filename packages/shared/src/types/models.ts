/**
 * Core data models for MConnect V2
 *
 * These types map to the PostgreSQL schema and are used throughout
 * the server and client applications.
 */

import type { AgentConfig, AgentStatus, AgentType } from './agents.js';
import type { GuardrailLevel } from '../guardrails/index.js';

// ============================================================================
// User
// ============================================================================

/**
 * OAuth provider types
 */
export type OAuthProvider = 'github' | 'google';

/**
 * User profile from OAuth
 */
export interface User {
  /** User UUID */
  id: string;
  /** Email address (from OAuth) */
  email: string;
  /** Display name */
  name: string;
  /** Profile picture URL */
  avatarUrl?: string;
  /** OAuth provider used for authentication */
  provider: OAuthProvider;
  /** User ID from the OAuth provider */
  providerId: string;
  /** Account creation timestamp */
  createdAt: Date;
  /** Last login timestamp */
  lastLoginAt?: Date;
}

// ============================================================================
// Session
// ============================================================================

/**
 * Session lifecycle state
 */
export type SessionState = 'running' | 'paused' | 'completed';

/**
 * Agent configuration for a session
 */
export interface AgentSessionConfig {
  /** Preset name used to create the session */
  preset: string;
  /** Agent configurations */
  agents: AgentConfig[];
  /** Guardrail level for command filtering */
  guardrails?: GuardrailLevel;
}

/**
 * Session instance
 */
export interface Session {
  /** Session UUID */
  id: string;
  /** Owner user ID */
  userId: string;
  /** Current session state */
  state: SessionState;
  /** Agent configuration for this session */
  agentConfig: AgentSessionConfig;
  /** Working directory on the host */
  workingDirectory: string;
  /** Session creation timestamp */
  createdAt: Date;
  /** Last activity timestamp (updated on any action) */
  lastActivityAt: Date;
  /** Completion timestamp (when state becomes 'completed') */
  completedAt?: Date;
}

/**
 * Session summary for list views
 */
export interface SessionInfo {
  /** Session UUID */
  id: string;
  /** Current session state */
  state: SessionState;
  /** Working directory */
  workingDirectory: string;
  /** Number of agents in session */
  agentCount: number;
  /** Session creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
}

// ============================================================================
// Agent
// ============================================================================

/**
 * Agent instance in database
 */
export interface Agent {
  /** Agent UUID */
  id: string;
  /** Parent session ID */
  sessionId: string;
  /** Agent type */
  type: AgentType;
  /** Display name */
  name: string;
  /** Current status */
  status: AgentStatus;
  /** Docker container ID (if containerized) */
  containerId?: string;
  /** Full agent configuration */
  config: AgentConfig;
  /** Agent creation timestamp */
  createdAt: Date;
  /** Agent start timestamp */
  startedAt?: Date;
  /** Agent stop timestamp */
  stoppedAt?: Date;
  /** Exit code (if exited) */
  exitCode?: number;
}

// ============================================================================
// Client
// ============================================================================

/**
 * Client device type
 */
export type ClientType = 'pc' | 'mobile';

/**
 * Client input priority levels
 *
 * - exclusive: Has sole input rights (temporary, times out)
 * - high: Gets priority over normal (PC default when active)
 * - normal: Standard priority (mobile default)
 * - low: Lower than normal
 * - observer: Read-only, cannot send input
 */
export type Priority = 'exclusive' | 'high' | 'normal' | 'low' | 'observer';

/**
 * Connected client instance
 */
export interface Client {
  /** Client ID (assigned by server) */
  id: string;
  /** Session the client is attached to */
  sessionId: string;
  /** User ID (from auth) */
  userId?: string;
  /** Device type */
  clientType: ClientType;
  /** Current input priority */
  priority: Priority;
  /** User agent string */
  userAgent?: string;
  /** Client IP address */
  ipAddress?: string;
  /** Connection timestamp */
  connectedAt: Date;
  /** Last heartbeat received */
  lastHeartbeatAt: Date;
}

/**
 * Client info for presence notifications
 */
export interface ClientInfo {
  /** Client ID */
  id: string;
  /** Device type */
  clientType: ClientType;
  /** Current priority */
  priority: Priority;
}

// ============================================================================
// Authentication
// ============================================================================

/**
 * JWT access token claims
 */
export interface AccessTokenClaims {
  /** Issuer (always 'mconnect') */
  iss: 'mconnect';
  /** Subject (user UUID) */
  sub: string;
  /** User email */
  email: string;
  /** User display name */
  name: string;
  /** OAuth provider */
  provider: OAuthProvider;
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Expiration (Unix timestamp) */
  exp: number;
  /** JWT ID (unique token identifier) */
  jti: string;
}

/**
 * JWT refresh token claims
 */
export interface RefreshTokenClaims {
  /** Issuer (always 'mconnect') */
  iss: 'mconnect';
  /** Subject (user UUID) */
  sub: string;
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Expiration (Unix timestamp) */
  exp: number;
  /** JWT ID (unique token identifier) */
  jti: string;
}

/**
 * Token pair returned after authentication
 */
export interface TokenPair {
  /** JWT access token */
  accessToken: string;
  /** JWT refresh token */
  refreshToken: string;
  /** Access token expiration in seconds */
  expiresIn: number;
}

/**
 * Token response for API
 */
export interface TokenResponse {
  /** JWT access token */
  access_token: string;
  /** JWT refresh token */
  refresh_token: string;
  /** Expiration in seconds */
  expires_in: number;
  /** Token type (always 'Bearer') */
  token_type: 'Bearer';
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request to create a new session
 */
export interface CreateSessionRequest {
  /** Preset name (e.g., 'single', 'dev-review') */
  preset: string;
  /** Working directory path */
  workingDirectory: string;
  /** Guardrail level */
  guardrails?: GuardrailLevel;
}

/**
 * Request to create a new agent
 */
export interface CreateAgentRequest {
  /** Agent type */
  type: AgentType;
  /** Display name */
  name: string;
  /** Command to run */
  command: string;
  /** Container configuration (optional) */
  container?: {
    image: string;
    workDir?: string;
    volumes?: string[];
    env?: Record<string, string>;
  };
}

/**
 * WebSocket connection info
 */
export interface ConnectionInfo {
  /** WebSocket URL to connect to */
  wsUrl: string;
  /** One-time connection token */
  token: string;
  /** Protocol version supported */
  protocolVersion: string;
}
