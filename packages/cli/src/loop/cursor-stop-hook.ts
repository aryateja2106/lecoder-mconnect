/**
 * Cursor stop hook entrypoint.
 *
 * Invoked by Cursor as `lecoder-mconnect hook cursor stop` on every agent
 * turn end. The hook:
 *
 *   1. Reads a JSON payload from stdin (Cursor sends conversation_id,
 *      status, loop_count, transcript_path).
 *   2. Loads ~/.lecoder/loops/active.json.
 *   3. Calls `decideNext` to figure out whether to continue.
 *   4. Updates the state file with the new iteration count.
 *   5. Optionally POSTs the event to a running MConnect session so the
 *      mobile UI sees progress.
 *   6. Prints a single JSON object to stdout — `{"followup_message": "..."}`
 *      (empty = stop, non-empty = continue) — followed by a newline.
 *
 * Cursor treats an empty stdout or non-JSON stdout as a hook failure, so
 * we always emit a structurally valid response, even on error. We also
 * never throw out of the entrypoint and never write to stderr (Cursor
 * treats stderr as failure). All warnings are suppressed silently.
 */

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { URL } from 'node:url';
import { decideNext, type LoopDecision } from './orchestrator.js';
import {
  appendHistory,
  archiveActiveLoop,
  type LoopState,
  readActiveLoop,
  updateActiveLoop,
  writePromptSnapshot,
} from './state.js';

/**
 * Cursor stop hook stdin payload shape.
 *
 * Source: github.com/mksglu/context-mode/blob/main/hooks/cursor/stop.mjs
 * and Cursor's third-party hooks docs.
 */
export interface CursorStopInput {
  conversation_id?: string;
  status?: string;
  loop_count?: number;
  transcript_path?: string;
  cwd?: string;
  workspace_roots?: string[];
}

/**
 * The hook always produces a JSON object with at minimum `followup_message`.
 */
export interface CursorStopOutput {
  followup_message: string;
}

/**
 * Read all of stdin and return the buffered string. Resolves to "" if
 * stdin is empty (Cursor still emits an event with no body in some cases).
 */
export function readStdin(stdin: NodeJS.ReadStream = process.stdin): Promise<string> {
  return new Promise((resolve) => {
    if (stdin.isTTY) {
      resolve('');
      return;
    }
    const chunks: Buffer[] = [];
    stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stdin.on('error', () => resolve(''));
    setTimeout(() => resolve(Buffer.concat(chunks).toString('utf-8')), 5000).unref();
  });
}

/**
 * Parse stdin JSON. Returns an empty object on any parse error.
 */
export function parseStopInput(raw: string): CursorStopInput {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as CursorStopInput;
  } catch {
    // ignore — Cursor sometimes sends partial payloads
  }
  return {};
}

/**
 * Best-effort POST of an iteration event to a running MConnect session.
 *
 * Fails silently — observability MUST NOT break the loop.
 */
function postToMConnect(
  endpoint: string,
  token: string,
  body: object,
  timeoutMs = 1500
): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;
    const done = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    try {
      const url = new URL(endpoint);
      const isHttps = url.protocol === 'https:';
      const transport = isHttps ? httpsRequest : httpRequest;
      const payload = Buffer.from(JSON.stringify(body));
      const req = transport(
        {
          method: 'POST',
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: `${url.pathname}${url.search}`,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': payload.length,
            Authorization: `Bearer ${token}`,
          },
          timeout: timeoutMs,
        },
        (res) => {
          res.on('data', () => {
            /* drain */
          });
          res.on('end', done);
          res.on('error', done);
        }
      );
      req.on('error', done);
      req.on('timeout', () => {
        try {
          req.destroy();
        } catch {
          /* ignore */
        }
        done();
      });
      req.write(payload);
      req.end();
    } catch {
      done();
    }
  });
}

/**
 * Apply a loop-state mutation reflecting the decision, before emitting
 * the followup. We treat the decision moment as "iteration N has just
 * been completed by the agent that is now ending its turn" — so we
 * advance `completed` and append history, then plan iteration N+1.
 */
function recordCompletedIteration(state: LoopState, decision: LoopDecision): LoopState {
  const completed = state.completed + 1;
  const lastIterationAt = new Date().toISOString();
  let next: LoopState = {
    ...state,
    completed,
    lastIterationAt,
    lastError: null,
  };
  if (decision.action === 'continue') {
    const expectedTail =
      state.mode === 'spec'
        ? `iteration_${decision.iterationNumber - 1}_completed`
        : `turn_${state.completed + 1}_completed`;
    next = appendHistory(next, expectedTail);
  }
  return next;
}

/**
 * Core hook logic. Given the parsed input, produce a JSON-serializable
 * response and, as a side effect, update on-disk state and emit telemetry.
 */
export async function handleStop(input: CursorStopInput): Promise<CursorStopOutput> {
  const state = readActiveLoop();
  if (!state) {
    return { followup_message: '' };
  }

  if (state.status !== 'active') {
    return { followup_message: '' };
  }

  const decision = decideNext({
    state,
    cursorStatus: input.status,
    cursorLoopCount: input.loop_count,
  });

  const updated = recordCompletedIteration(state, decision);

  if (decision.action === 'stop') {
    // Persist the advanced state before archiving so the archive captures it.
    updateActiveLoop(() => updated);
    const archived = archiveActiveLoop('done') ?? updated;
    await fireTelemetry(archived, decision, input);
    return { followup_message: '' };
  }

  if (decision.action === 'error') {
    // Persist error context before archiving so the archived record carries it.
    const errored: LoopState = {
      ...updated,
      status: 'error',
      lastError: decision.reason,
    };
    updateActiveLoop(() => errored);
    const archived = archiveActiveLoop('error') ?? errored;
    await fireTelemetry(archived, decision, input);
    return { followup_message: decision.followupMessage };
  }

  // continue
  updateActiveLoop(() => updated);
  writePromptSnapshot({
    iteration: decision.iterationNumber,
    body: decision.followupMessage,
    updatedAt: new Date().toISOString(),
  });
  await fireTelemetry(updated, decision, input);

  return { followup_message: decision.followupMessage };
}

/**
 * Build the universal-hook event body and POST it to the configured
 * MConnect session, if any. Errors are swallowed.
 */
async function fireTelemetry(
  state: LoopState,
  decision: LoopDecision,
  input: CursorStopInput
): Promise<void> {
  if (!state.mconnect?.url || !state.mconnect?.token) return;
  const endpoint = `${state.mconnect.url.replace(/\/$/, '')}/api/hooks`;
  const eventType =
    decision.action === 'continue'
      ? 'loop_iteration_complete'
      : decision.action === 'error'
        ? 'loop_error'
        : 'loop_complete';
  const body = {
    source: 'cursor',
    event_type: eventType,
    data: {
      loop_id: state.id,
      status: state.status,
      mode: state.mode,
      completed: state.completed,
      target: state.target,
      next_iteration: decision.action === 'continue' ? decision.iterationNumber : null,
      cursor_conversation_id: input.conversation_id || null,
      cursor_status: input.status || null,
      cursor_loop_count: input.loop_count ?? null,
      reason: decision.action === 'continue' ? null : decision.reason,
    },
  };
  await postToMConnect(endpoint, state.mconnect.token, body);
}

/**
 * Top-level CLI entrypoint. Always exits 0 with valid JSON on stdout.
 */
export async function runCursorStopHook(): Promise<void> {
  let response: CursorStopOutput = { followup_message: '' };
  try {
    const raw = await readStdin();
    const input = parseStopInput(raw);
    response = await handleStop(input);
  } catch {
    // Last-resort safety: emit empty followup so Cursor doesn't loop.
    response = { followup_message: '' };
  }
  process.stdout.write(`${JSON.stringify(response)}\n`);
}
