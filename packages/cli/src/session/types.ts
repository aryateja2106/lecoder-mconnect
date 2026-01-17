/**
 * Session Types for MConnect v0.2.0
 *
 * Data models for persistent sessions, clients, and input arbitration
 */

// ============================================
// Session Types
// ============================================

export type SessionState = 'running' | 'paused' | 'completed';

export interface AgentConfig {
  preset: string;
  agents: string[];
  guardrails?: string;
}

export interface Session {
  id: string;
  createdAt: Date;
  lastActivity: Date;
  state: SessionState;
  agentConfig: AgentConfig;
  workingDirectory: string;
}

export interface SessionRow {
  id: string;
  created_at: number;
  last_activity: number;
  state: SessionState;
  agent_config: string; // JSON
  working_directory: string;
}

// ============================================
// Client Types
// ============================================

export type ClientType = 'pc' | 'mobile';
export type Priority = 'exclusive' | 'high' | 'normal' | 'low' | 'observer';

export interface Client {
  id: string;
  sessionId: string;
  clientType: ClientType;
  connectedAt: Date;
  lastHeartbeat: Date;
  priority: Priority;
  userAgent?: string;
}

export interface ClientRow {
  id: string;
  session_id: string;
  client_type: ClientType;
  connected_at: number;
  last_heartbeat: number;
  priority: Priority;
  user_agent: string | null;
}

// ============================================
// Scrollback Types
// ============================================

export interface ScrollbackLine {
  sessionId: string;
  lineNumber: number;
  content: string;
  timestamp: Date;
}

export interface ScrollbackRow {
  session_id: string;
  line_number: number;
  content: string;
  timestamp: number;
}

// ============================================
// Input Log Types
// ============================================

export type RejectReason = 'pc_typing' | 'other_exclusive' | 'rate_limited' | 'read_only';

export interface InputLogEntry {
  id: number;
  sessionId: string;
  clientId: string;
  input: string;
  timestamp: Date;
  accepted: boolean;
  rejectReason?: RejectReason;
}

export interface InputLogRow {
  id: number;
  session_id: string;
  client_id: string;
  input: string;
  timestamp: number;
  accepted: number; // 0 or 1
  reject_reason: RejectReason | null;
}

// ============================================
// Input Arbiter Types
// ============================================

export type ArbiterState = 'pc_active' | 'pc_idle' | 'pc_disconnected' | 'mobile_exclusive';

export interface ControlState {
  state: ArbiterState;
  currentOwner?: string; // Client ID with highest priority
  exclusiveExpires?: Date; // When MOBILE_EXCLUSIVE times out
  lastPcInput?: Date;
}

// ============================================
// Configuration Types
// ============================================

export interface SessionConfig {
  maxConcurrent: number;
  scrollbackLines: number;
  idleTimeoutMinutes: number;
  cleanupAfterHours: number;
}

export interface InputConfig {
  pcIdleThresholdMs: number;
  mobileGracePeriodMs: number;
  exclusiveTimeoutMs: number;
  conflictWindowMs: number;
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  maxConcurrent: 5,
  scrollbackLines: 10000,
  idleTimeoutMinutes: 1440, // 24 hours
  cleanupAfterHours: 24,
};

export const DEFAULT_INPUT_CONFIG: InputConfig = {
  pcIdleThresholdMs: 30000, // 30 seconds
  mobileGracePeriodMs: 5000, // 5 seconds
  exclusiveTimeoutMs: 300000, // 5 minutes
  conflictWindowMs: 100, // 100ms
};
