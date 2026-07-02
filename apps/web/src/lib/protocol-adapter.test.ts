import { describe, expect, it } from "vitest";
import { normalizeServerMessage } from "./protocol-adapter";

describe("normalizeServerMessage", () => {
  it("normalizes v1 and v2 terminal output messages", () => {
    expect(
      normalizeServerMessage({
        type: "terminal_output",
        payload: { data: "hello" },
      }),
    ).toEqual({ kind: "terminal_output", data: "hello" });

    expect(
      normalizeServerMessage({
        type: "terminal_output",
        data: "world",
        agentId: "agent-1",
      }),
    ).toEqual({ kind: "terminal_output", data: "world", agentId: "agent-1" });

    expect(normalizeServerMessage({ type: "output", data: "v2" })).toEqual({
      kind: "terminal_output",
      data: "v2",
    });
  });

  it("normalizes session info and agent lists", () => {
    expect(
      normalizeServerMessage({
        type: "session_info",
        sessionId: "session-1",
        isReadOnly: true,
      }),
    ).toEqual({
      kind: "session_info",
      session: {
        id: "session-1",
        agent: "shell",
        isReadOnly: true,
        workDir: "~",
      },
    });

    expect(
      normalizeServerMessage({
        type: "agent_list",
        agents: [{ id: "a", name: "Shell", type: "shell", status: "running" }],
      }),
    ).toEqual({
      kind: "agent_list",
      agents: [{ id: "a", name: "Shell", type: "shell", status: "running" }],
    });
  });

  it("normalizes errors, process events, and input rejections without leaking input text", () => {
    expect(
      normalizeServerMessage({
        type: "error",
        payload: { message: "Nope" },
      }),
    ).toEqual({ kind: "error", message: "Nope" });

    expect(normalizeServerMessage({ type: "process_killed" })).toEqual({
      kind: "system_notice",
      message: "\n^C Process killed",
      tone: "warning",
    });

    expect(
      normalizeServerMessage({
        type: "input_rejected",
        reason: "pc_typing",
        input: "secret command",
      }),
    ).toEqual({ kind: "input_rejected", reason: "pc_typing" });
  });

  it("returns unknown for unhandled messages", () => {
    expect(normalizeServerMessage({ type: "future_message", value: 1 })).toEqual({
      kind: "unknown",
      type: "future_message",
    });
  });
});
