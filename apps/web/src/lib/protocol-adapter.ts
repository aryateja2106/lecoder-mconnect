export interface NormalizedSessionInfo {
  id: string;
  agent: string;
  isReadOnly: boolean;
  workDir: string;
}

export interface NormalizedAgentInfo {
  id: string;
  name: string;
  type: string;
  status: string;
}

export type NormalizedServerMessage =
  | { kind: "terminal_output"; data: string; agentId?: string }
  | { kind: "session_info"; session: NormalizedSessionInfo }
  | { kind: "mode_changed"; isReadOnly: boolean }
  | { kind: "approval_request"; command: string; reason: string }
  | { kind: "command_blocked"; command: string; reason: string }
  | { kind: "system_notice"; message: string; tone: "info" | "warning" | "danger" }
  | { kind: "error"; message: string }
  | { kind: "auth_success"; clientId: string }
  | { kind: "session_list"; sessions: unknown[] }
  | { kind: "session_state"; sessionId: string; state: string; lastActivity?: number }
  | { kind: "control_status"; message: Record<string, unknown> }
  | { kind: "control_response"; message: Record<string, unknown> }
  | { kind: "scrollback_response"; message: Record<string, unknown> }
  | { kind: "input_rejected"; reason: string }
  | { kind: "agent_list"; agents: NormalizedAgentInfo[] }
  | { kind: "heartbeat"; timestamp?: number }
  | { kind: "pong" }
  | { kind: "unknown"; type: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getPayload(message: Record<string, unknown>): Record<string, unknown> {
  return asRecord(message.payload);
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function getBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function terminalOutput(data: string, agentId: unknown): NormalizedServerMessage {
  const id = getString(agentId);
  return id
    ? { kind: "terminal_output", data, agentId: id }
    : { kind: "terminal_output", data };
}

export function normalizeServerMessage(raw: unknown): NormalizedServerMessage {
  const message = asRecord(raw);
  const type = getString(message.type, "unknown");
  const payload = getPayload(message);

  switch (type) {
    case "terminal_output":
      return terminalOutput(getString(payload.data ?? message.data), message.agentId);

    case "output":
      return terminalOutput(getString(message.data), message.agentId);

    case "session_info":
      return {
        kind: "session_info",
        session: {
          id: getString(message.sessionId ?? payload.sessionId),
          agent: getString(message.agent ?? payload.agent, "shell"),
          isReadOnly: getBoolean(message.isReadOnly ?? payload.isReadOnly, true),
          workDir: getString(message.workDir ?? payload.workDir, "~"),
        },
      };

    case "mode_changed":
      return {
        kind: "mode_changed",
        isReadOnly: getBoolean(message.isReadOnly ?? payload.isReadOnly),
      };

    case "approval_request":
      return {
        kind: "approval_request",
        command: getString(payload.command ?? message.command),
        reason: getString(payload.reason ?? message.reason),
      };

    case "command_blocked":
      return {
        kind: "command_blocked",
        command: getString(payload.command ?? message.command),
        reason: getString(payload.reason ?? message.reason),
      };

    case "process_exit":
      return {
        kind: "system_notice",
        message: `\nProcess exited with code ${String(payload.code ?? message.code ?? 0)}`,
        tone: "warning",
      };

    case "process_killed":
      return {
        kind: "system_notice",
        message: "\n^C Process killed",
        tone: "warning",
      };

    case "error":
      return {
        kind: "error",
        message: getString(payload.message ?? message.message, "Unknown error"),
      };

    case "auth_success":
      return { kind: "auth_success", clientId: getString(message.clientId) };

    case "session_list":
      return {
        kind: "session_list",
        sessions: Array.isArray(message.sessions) ? message.sessions : [],
      };

    case "session_state":
      return {
        kind: "session_state",
        sessionId: getString(message.sessionId),
        state: getString(message.state),
        lastActivity: typeof message.lastActivity === "number" ? message.lastActivity : undefined,
      };

    case "control_status":
      return { kind: "control_status", message };

    case "control_response":
      return { kind: "control_response", message };

    case "scrollback_response":
      return { kind: "scrollback_response", message };

    case "input_rejected":
      return {
        kind: "input_rejected",
        reason: getString(message.reason ?? payload.reason, "unknown"),
      };

    case "agent_list":
      return {
        kind: "agent_list",
        agents: Array.isArray(message.agents)
          ? (message.agents as NormalizedAgentInfo[])
          : [],
      };

    case "heartbeat":
      return {
        kind: "heartbeat",
        timestamp: typeof message.timestamp === "number" ? message.timestamp : undefined,
      };

    case "pong":
      return { kind: "pong" };

    default:
      return { kind: "unknown", type };
  }
}
