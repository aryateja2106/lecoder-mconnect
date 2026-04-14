/**
 * MConnect Chat Protocol — Structured Message Layer for Mobile PWA
 *
 * This module defines the structured message schema that sits on top of the
 * raw WebSocket protocol (see protocol.ts). It enables mobile clients to render
 * agent output as semantic chat bubbles instead of raw ANSI terminal streams.
 *
 * Design philosophy:
 *   - Every message carries enough context to render without additional state
 *   - Raw terminal output is preserved as a fallback via `raw_terminal`
 *   - Content type hints (text | markdown | code) allow the client to pick
 *     the right renderer without parsing heuristics
 *   - Agent identity (agentId + agentType) is always present so multi-agent
 *     sessions can assign distinct bubble styles per agent
 *
 * Protocol version: 3.0 (chat layer)
 * Builds on: MConnect WebSocket Protocol v2.0 (protocol.ts)
 *
 * Relationship to existing protocol:
 *   - v1 messages (output, ping/pong, etc.) remain unchanged in types.ts
 *   - v2 messages (session management, control arbitration) remain in protocol.ts
 *   - v3 chat messages are a NEW envelope layer — CLI emits them alongside v2
 *     messages for clients that negotiate protocol version 3.0
 *
 * To negotiate: connect with query param `v=3.0`
 * Fallback: any client that does not send `v=3.0` receives raw v1/v2 output
 */

// ============================================================================
// Shared Identifiers & Enums
// ============================================================================

/** Agent types supported by MConnect presets */
export type AgentType = 'claude' | 'gemini' | 'codex' | 'aider' | 'shell' | 'custom';

/**
 * Content format hint.
 *
 * - `text`     Plain prose, no special rendering needed
 * - `markdown` Markdown-formatted content; render with a markdown parser
 * - `code`     Fenced code block or file diff; use a code highlighter
 * - `ansi`     ANSI-escaped terminal output; render with an ANSI parser
 */
export type ContentFormat = 'text' | 'markdown' | 'code' | 'ansi';

/**
 * Risk classification for approval requests.
 *
 * - `low`    Read-only or reversible operations (e.g. `cat`, `ls`, `git status`)
 * - `medium` Potentially impactful but recoverable (e.g. `npm install`, `git push`)
 * - `high`   Destructive or irreversible (e.g. `rm -rf`, `DROP TABLE`, force-push)
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Agent operational state for UI status indicators.
 *
 * - `thinking` Agent is processing / waiting for LLM response
 * - `writing`  Agent is actively writing output (streaming tokens)
 * - `executing` Agent has issued a shell command and is waiting for result
 * - `waiting`  Agent is waiting for user input or an approval
 * - `idle`     Agent is running but not actively doing anything
 * - `error`    Agent encountered an error; output may follow
 */
export type AgentState = 'thinking' | 'writing' | 'executing' | 'waiting' | 'idle' | 'error';

/** File system actions for change notifications */
export type FileAction = 'created' | 'modified' | 'deleted' | 'renamed';

// ============================================================================
// Server → Client Messages (CLI to Mobile PWA)
// ============================================================================

/**
 * Structured agent output suitable for rendering as a chat bubble.
 *
 * The CLI parser should emit one of these whenever it identifies a logical
 * chunk of agent output — a complete sentence, a code block, a tool call
 * result. Avoid splitting mid-sentence; partial chunks accumulate into noise.
 *
 * `messageId` enables idempotent rendering: if the same messageId arrives
 * twice (e.g. after a reconnect), the client should deduplicate.
 *
 * `sequenceNumber` allows the client to re-order messages that arrive out of
 * order due to network jitter (monotonically increasing per session).
 */
export interface AgentOutputMessage {
  type: 'agent_output';
  /** Unique ID for this message, used for deduplication */
  messageId: string;
  /** Monotonically increasing sequence number within the session */
  sequenceNumber: number;
  /** Agent that produced this output */
  agentId: string;
  /** Human-readable agent name (e.g. "Claude", "Gemini") */
  agentName: string;
  /** Agent type for styling (e.g. claude gets purple, gemini gets blue) */
  agentType: AgentType;
  /** The output content */
  content: string;
  /** How to render the content */
  format: ContentFormat;
  /**
   * Optional: programming language hint when format is "code".
   * Matches highlight.js language identifiers (e.g. "typescript", "bash").
   */
  language?: string;
  /** Unix timestamp (ms) when this chunk was produced */
  timestamp: number;
  /**
   * True if more output is coming for this logical message.
   * Use to show a streaming cursor in the bubble.
   */
  streaming?: boolean;
}

/**
 * Approval request from guardrails — requires user confirmation before
 * the agent executes the command.
 *
 * The client should render this as an interactive card with Approve / Deny
 * buttons. No further agent output will be produced for this session until
 * the client sends back an `approval_response` message.
 *
 * `expiresAt` is optional. If present and the user does not respond before
 * the deadline, the CLI will auto-deny.
 */
export interface ApprovalRequestMessage {
  type: 'approval_request';
  /** Unique approval ID — echo this back in approval_response */
  approvalId: string;
  /** Agent requesting the approval */
  agentId: string;
  agentName: string;
  /** The exact command string the agent wants to execute */
  command: string;
  /**
   * Human-readable explanation of why approval is needed.
   * Derived from guardrail rule that triggered.
   */
  reason: string;
  /** Risk classification for visual severity indicator */
  risk: RiskLevel;
  /** Optional: working directory context for the command */
  cwd?: string;
  /** Optional: Unix timestamp (ms) when the approval request expires */
  expiresAt?: number;
  timestamp: number;
}

/**
 * Agent state transition notification.
 *
 * Emit these at every meaningful state change so the mobile UI can show
 * real-time status indicators (thinking spinner, writing animation, etc.).
 *
 * `detail` is optional human-readable context, e.g. "Reading 3 files" or
 * "Executing: npm test".
 */
export interface AgentStatusMessage {
  type: 'agent_status';
  agentId: string;
  agentName: string;
  agentType: AgentType;
  /** New state the agent has transitioned into */
  state: AgentState;
  /** Optional: short description of what the agent is doing */
  detail?: string;
  timestamp: number;
}

/**
 * File system change notification.
 *
 * Emitted when the agent creates, modifies, or deletes a file. Mobile UI can
 * surface these as activity feed items or inline change badges in the chat.
 *
 * `oldPath` is only present for `renamed` actions.
 * `linesAdded` / `linesRemoved` are optional diff stats.
 */
export interface FileChangeMessage {
  type: 'file_change';
  agentId: string;
  /** Absolute or workspace-relative path of the file */
  path: string;
  /** Action performed */
  action: FileAction;
  /** Previous path (only for `renamed`) */
  oldPath?: string;
  /** Lines added (for created/modified) */
  linesAdded?: number;
  /** Lines removed (for modified/deleted) */
  linesRemoved?: number;
  timestamp: number;
}

/**
 * Session initialization message sent once per connection when protocol v3
 * is negotiated. Gives the mobile client enough context to render the session
 * header, agent list, and initial empty state.
 *
 * This complements — but does not replace — the v2 `session_list` and
 * `session_state` messages. Think of it as the mobile-friendly summary.
 */
export interface SessionInfoMessage {
  type: 'session_info';
  sessionId: string;
  /** Preset name used to start this session (e.g. "single", "research-spec-test") */
  preset: string;
  /** Working directory for this session (displayed in session header) */
  project: string;
  /** ISO 8601 timestamp when the session started */
  startedAt: string;
  /** All agents in this session */
  agents: Array<{
    id: string;
    name: string;
    type: AgentType;
    status: AgentState;
  }>;
  /** Protocol version negotiated */
  protocolVersion: '3.0';
}

/**
 * Raw terminal output fallback.
 *
 * Used when the CLI cannot classify output into a structured message — e.g.
 * interactive prompts, progress bars, raw shell output. The mobile client
 * should render this in a monospace/terminal-style block rather than a chat
 * bubble.
 *
 * Clients that do not support chat rendering can treat ALL output as
 * `raw_terminal` and fall back to the v1 terminal-strip experience.
 */
export interface RawTerminalMessage {
  type: 'raw_terminal';
  agentId: string;
  /** Raw bytes as UTF-8 string, may contain ANSI escape sequences */
  data: string;
  timestamp: number;
}

/**
 * Notification that a pending approval was resolved (approved or denied).
 *
 * Sent to all clients in the session so they can dismiss the approval card
 * and optionally show an outcome indicator.
 */
export interface ApprovalResolvedMessage {
  type: 'approval_resolved';
  approvalId: string;
  agentId: string;
  command: string;
  /** Whether the command was approved and executed */
  approved: boolean;
  /** Which client resolved it: 'mobile', 'pc', or 'auto-denied' */
  resolvedBy: string;
  timestamp: number;
}

/** Union of all server → client chat protocol messages */
export type ChatServerMessage =
  | AgentOutputMessage
  | ApprovalRequestMessage
  | AgentStatusMessage
  | FileChangeMessage
  | SessionInfoMessage
  | RawTerminalMessage
  | ApprovalResolvedMessage;

// ============================================================================
// Client → Server Messages (Mobile PWA to CLI)
// ============================================================================

/**
 * User text input sent to the active (or specified) agent.
 *
 * For single-agent sessions, `agentId` is optional — defaults to the only
 * active agent. For multi-agent sessions, `agentId` MUST be specified.
 */
export interface ChatInputMessage {
  type: 'chat_input';
  /** Target agent. Optional for single-agent sessions. */
  agentId?: string;
  /** The text to send to the agent */
  content: string;
}

/**
 * Response to an approval request.
 *
 * Must echo back the `approvalId` from the corresponding `approval_request`.
 * The CLI will reject responses with unknown or expired `approvalId` values.
 */
export interface ChatApprovalResponseMessage {
  type: 'chat_approval_response';
  /** Must match the approvalId from the approval_request */
  approvalId: string;
  /** True = execute the command, false = deny and inform the agent */
  approved: boolean;
}

/**
 * Terminal resize notification.
 *
 * Mobile clients should send this whenever the viewport changes so the agent's
 * PTY renders at the correct width. This affects line wrapping in all output,
 * including `raw_terminal` messages.
 *
 * Recommended: send on connection and on every orientation change.
 * For mobile, `cols: 80, rows: 24` is a safe default if viewport is unknown.
 */
export interface ChatResizeMessage {
  type: 'chat_resize';
  /** Target agent. Omit to resize all agents in the session. */
  agentId?: string;
  cols: number;
  rows: number;
}

/** Union of all client → server chat protocol messages */
export type ChatClientMessage =
  | ChatInputMessage
  | ChatApprovalResponseMessage
  | ChatResizeMessage;

// ============================================================================
// Protocol Constants
// ============================================================================

export const CHAT_PROTOCOL_VERSION = '3.0' as const;

/**
 * WebSocket query param to negotiate the chat protocol.
 * Connect with: `ws://host:port?token=TOKEN&v=3.0`
 */
export const CHAT_PROTOCOL_VERSION_PARAM = 'v';

/**
 * Maximum content length for a single AgentOutputMessage in characters.
 * Chunks exceeding this should be split across multiple messages with
 * `streaming: true` on all but the last.
 */
export const MAX_CHAT_CONTENT_LENGTH = 8000;

/**
 * Risk level thresholds mapped to display labels.
 * Used by mobile UI for color coding approval request cards.
 */
export const RISK_DISPLAY: Record<RiskLevel, { label: string; color: string }> = {
  low: { label: 'Low Risk', color: '#22c55e' },    // green-500
  medium: { label: 'Medium Risk', color: '#f59e0b' }, // amber-500
  high: { label: 'High Risk', color: '#ef4444' },   // red-500
};

/**
 * Default terminal dimensions for mobile clients.
 * Matches a typical narrow mobile viewport in landscape.
 */
export const MOBILE_DEFAULT_TERMINAL_COLS = 80;
export const MOBILE_DEFAULT_TERMINAL_ROWS = 24;
