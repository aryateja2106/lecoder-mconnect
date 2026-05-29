/**
 * Agent session store.
 *
 * Persists per-session metadata + a transcript of every prompt/response
 * to `~/.lecoder/agent/sessions/<id>.json`. Used by:
 *
 *   - `mconnect agent run --resume <id>` to continue a prior conversation.
 *   - `mconnect agent ls` to enumerate active and recent sessions.
 *   - The infinite-loop stop hook to find the agent it was driving and
 *     dispatch the next continuation prompt.
 *
 * The store is intentionally a plain JSON file (one per session) so:
 *
 *   - The agent can read it directly with `cat ~/.lecoder/agent/sessions/<id>.json`
 *     after a context compaction event.
 *   - Cleanup is `rm` of a single file.
 *   - No native dependency or DB engine required.
 *
 * Sessions older than `LECODER_AGENT_SESSION_TTL_DAYS` (default: 30) are
 * pruned on each list/write call.
 */

import { randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Lifecycle status of an agent session.
 *
 *   pending   — created, never run yet
 *   running   — a `send()` call is in flight (best effort; the CLI
 *               sets this and clears it on exit)
 *   idle      — last run finished, agent is reusable for resume
 *   finished  — explicitly closed by the user (cancel/rm/done)
 *   failed    — last run errored
 */
export type AgentSessionStatus = 'pending' | 'running' | 'idle' | 'finished' | 'failed';

/**
 * Execution mode passed to the SDK when creating the agent.
 */
export type AgentExecutionMode = 'local' | 'cloud';

/**
 * One transcript entry. Kept small — large outputs are summarised to
 * a single line so the JSON file stays under a few hundred KB even for
 * long sessions.
 */
export interface TranscriptEntry {
  /** ISO 8601 timestamp. */
  at: string;
  /** Role: prompt = user, response = agent summary, system = lifecycle event. */
  role: 'prompt' | 'response' | 'system';
  /** Body. Single line for system events; can be longer for prompts/responses. */
  text: string;
}

/**
 * Persistent agent session record.
 */
export interface AgentSessionRecord {
  /** Stable identifier (used as filename). */
  id: string;
  /** Human-readable name shown in `mconnect agent ls`. */
  name: string;
  /** Workspace the agent operates on. */
  cwd: string;
  /** Git worktree path, when isolation is enabled. */
  worktreePath: string | null;
  /** Branch the worktree is on. */
  worktreeBranch: string | null;
  /** Repository root, when running inside a git repo. */
  repoRoot: string | null;
  /** Execution mode (local | cloud). */
  executionMode: AgentExecutionMode;
  /** Selected model id (e.g. 'composer-2'). */
  modelId: string;
  /** Optional model parameters (JSON-serializable). */
  modelParams: Array<{ id: string; value: string }> | null;
  /** Lifecycle status. */
  status: AgentSessionStatus;
  /** ISO 8601 creation time. */
  createdAt: string;
  /** ISO 8601 timestamp of the last activity. */
  lastActivityAt: string;
  /** Total prompts the user has sent in this session. */
  promptCount: number;
  /** Last error message, if any. */
  lastError: string | null;
  /** Transcript tail (last `MAX_TRANSCRIPT_ENTRIES` entries). */
  transcript: TranscriptEntry[];
  /** Free-form tags for filtering (e.g. ['loop:loop_xxx']). */
  tags: string[];
}

const MAX_TRANSCRIPT_ENTRIES = 200;
const DEFAULT_TTL_DAYS = 30;

/**
 * Resolve filesystem paths used by the store. Tests can override the root
 * via `LECODER_AGENT_DIR`.
 */
export function getAgentPaths(): {
  rootDir: string;
  sessionsDir: string;
} {
  const rootDir = process.env.LECODER_AGENT_DIR
    ? process.env.LECODER_AGENT_DIR
    : join(homedir(), '.lecoder', 'agent');
  return { rootDir, sessionsDir: join(rootDir, 'sessions') };
}

/**
 * Generate a short, stable session id (8 hex chars, prefixed `sess_`).
 */
export function generateSessionId(): string {
  return `sess_${randomBytes(4).toString('hex')}`;
}

function ensureDirs(): void {
  const { sessionsDir } = getAgentPaths();
  if (!existsSync(sessionsDir)) mkdirSync(sessionsDir, { recursive: true });
}

function sessionFile(id: string): string {
  return join(getAgentPaths().sessionsDir, `${id}.json`);
}

/**
 * Read a session record by id, or null if it doesn't exist / is corrupt.
 */
export function readSession(id: string): AgentSessionRecord | null {
  const file = sessionFile(id);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as AgentSessionRecord;
  } catch {
    return null;
  }
}

/**
 * Atomically write a session record (write-then-rename).
 */
export function writeSession(record: AgentSessionRecord): void {
  ensureDirs();
  const file = sessionFile(record.id);
  const tmp = `${file}.tmp.${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, 'utf-8');
  renameSync(tmp, file);
}

/**
 * Update a session in place. Returns the new record, or null if the
 * session doesn't exist.
 */
export function updateSession(
  id: string,
  mutate: (record: AgentSessionRecord) => AgentSessionRecord
): AgentSessionRecord | null {
  const current = readSession(id);
  if (!current) return null;
  const next = mutate(current);
  writeSession(next);
  return next;
}

/**
 * Append a transcript entry (capped at MAX_TRANSCRIPT_ENTRIES).
 */
export function appendTranscript(
  record: AgentSessionRecord,
  entry: Omit<TranscriptEntry, 'at'> & { at?: string }
): AgentSessionRecord {
  const transcript = [
    ...record.transcript,
    { at: entry.at ?? new Date().toISOString(), role: entry.role, text: entry.text },
  ];
  while (transcript.length > MAX_TRANSCRIPT_ENTRIES) transcript.shift();
  return { ...record, transcript };
}

/**
 * List all sessions on disk, most-recent first.
 *
 * Side-effect: prunes sessions older than `LECODER_AGENT_SESSION_TTL_DAYS`.
 */
export function listSessions(options: { tag?: string } = {}): AgentSessionRecord[] {
  ensureDirs();
  const { sessionsDir } = getAgentPaths();
  const ttlDays = Number(process.env.LECODER_AGENT_SESSION_TTL_DAYS ?? DEFAULT_TTL_DAYS);
  const ttlMs = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays * 24 * 60 * 60 * 1000 : 0;
  const now = Date.now();

  const records: AgentSessionRecord[] = [];
  for (const entry of readdirSync(sessionsDir)) {
    if (!entry.endsWith('.json')) continue;
    const fp = join(sessionsDir, entry);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(fp);
    } catch {
      continue;
    }
    if (ttlMs > 0 && now - stat.mtimeMs > ttlMs) {
      try {
        unlinkSync(fp);
      } catch {
        /* ignore */
      }
      continue;
    }
    try {
      const rec = JSON.parse(readFileSync(fp, 'utf-8')) as AgentSessionRecord;
      if (options.tag && !rec.tags.includes(options.tag)) continue;
      records.push(rec);
    } catch {
      /* ignore corrupt files */
    }
  }
  records.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  return records;
}

/**
 * Remove a session record from disk. Idempotent.
 */
export function removeSession(id: string): boolean {
  const file = sessionFile(id);
  if (!existsSync(file)) return false;
  try {
    unlinkSync(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find the most recent session matching a tag, e.g. `loop:loop_xxxx`.
 */
export function findSessionByTag(tag: string): AgentSessionRecord | null {
  const sessions = listSessions({ tag });
  return sessions[0] ?? null;
}
