/**
 * Universal Hook Event Types for MConnect
 *
 * Defines a normalized event format that can represent hook events
 * from multiple AI coding agents (Claude Code, Gemini CLI, etc.)
 */

/**
 * Supported AI coding agent sources
 */
export type HookSource = 'claude' | 'gemini' | 'copilot' | 'aider' | 'custom';

/**
 * Normalized event types
 */
export type HookEventType =
  | 'needs_approval' // Agent is waiting for user approval
  | 'stopped' // Agent has stopped (finished or error)
  | 'error' // An error occurred
  | 'notification'; // General notification

/**
 * Action that the user can take in response to an event
 */
export interface HookAction {
  /** Unique identifier for this action */
  id: string;
  /** Display label for the action button */
  label: string;
  /** Optional: action type for styling (approve, deny, dismiss) */
  variant?: 'approve' | 'deny' | 'dismiss' | 'default';
}

/**
 * Universal hook event format
 *
 * All agent-specific events are normalized to this format
 * for consistent display and handling in the UI.
 */
export interface UniversalHookEvent {
  /** Unique identifier for this event */
  id: string;
  /** ISO 8601 timestamp when the event occurred */
  timestamp: string;
  /** Source agent that generated this event */
  source: HookSource;
  /** Normalized event type */
  eventType: HookEventType;
  /** Human-readable title/summary */
  title: string;
  /** Optional detailed description */
  details?: string;
  /** Whether the user can respond to this event */
  actionable: boolean;
  /** Available actions the user can take */
  actions?: HookAction[];
  /** Original raw event data from the source agent */
  raw: Record<string, unknown>;
}

/**
 * Incoming hook request from agent scripts
 */
export interface IncomingHookRequest {
  /** Source agent identifier */
  source: HookSource;
  /** Event type as reported by the agent */
  event_type: string;
  /** Raw event data from the agent */
  data: Record<string, unknown>;
}

/**
 * Response sent back to hook scripts
 */
export interface HookResponse {
  /** Whether the event was received successfully */
  received: boolean;
  /** Optional error message */
  error?: string;
  /** ID of the created event (for tracking) */
  eventId?: string;
}

/**
 * Claude Code specific hook event names
 * Based on Claude Code hooks documentation
 */
export type ClaudeHookEventName =
  | 'Notification' // User-facing notification
  | 'Stop' // Agent stopped
  | 'PreToolUse' // Before tool execution (can be used for approval)
  | 'PostToolUse' // After tool execution
  | 'SubagentStop'; // Subagent finished

/**
 * Claude Code hook event data structure
 */
export interface ClaudeHookEventData {
  hook_event_name: ClaudeHookEventName;
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  message?: string;
  transcript_path?: string;
}

/**
 * Gemini CLI specific hook event names
 */
export type GeminiHookEventName =
  | 'Notification' // User notification
  | 'AfterAgent' // Agent finished
  | 'BeforeModel' // Before model call
  | 'AfterModel'; // After model call

/**
 * Gemini CLI hook event data structure
 */
export interface GeminiHookEventData {
  event_type: GeminiHookEventName;
  message?: string;
  session_id?: string;
  model?: string;
  exit_code?: number;
}
