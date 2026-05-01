/**
 * Loop State Management
 *
 * Persists loop state to disk so the Cursor `stop` hook can reload it
 * across turns. State lives at ~/.lecoder/loops/active.json plus a
 * timestamped history file when a loop completes.
 *
 * The stop hook is invoked by Cursor after every agent turn and is a
 * separate short-lived process, so all loop progress must round-trip
 * through this on-disk state.
 */

import { randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Loop status lifecycle:
 *   active  → currently running, stop hook should drive continuation
 *   paused  → user paused via `mconnect loop stop` or external signal
 *   done    → target reached or graceful infinite-mode exit
 *   error   → fatal error during a previous iteration
 */
export type LoopStatus = 'active' | 'paused' | 'done' | 'error';

/**
 * Loop mode:
 *   spec — Disler-style: one spec file, generate N iterations into output_dir
 *   task — Single long-running task; loop continues until agent emits sentinel
 */
export type LoopMode = 'spec' | 'task';

/**
 * Persistent loop state. Written by the CLI, read+updated by the stop hook.
 */
export interface LoopState {
  id: string;
  mode: LoopMode;
  status: LoopStatus;
  /** Absolute path to the spec file (spec mode) or task description file (task mode). */
  specPath: string;
  /** Absolute path to the output directory. */
  outputDir: string;
  /** Target iteration count, or 'infinite'. */
  target: number | 'infinite';
  /** Number of iterations completed so far (advanced by the stop hook). */
  completed: number;
  /** ISO 8601 timestamp of the most recent iteration completion. */
  lastIterationAt: string | null;
  /** ISO 8601 timestamp the loop was created. */
  createdAt: string;
  /** Working directory the loop was started from (used for relative path resolution). */
  workDir: string;
  /** The first message the user pastes into Cursor to kick off the loop. */
  kickoffPrompt: string;
  /** Most recent iteration artifact filenames (or summaries) — last 5. */
  historyTail: string[];
  /**
   * Optional MConnect session URL + token. When set, the stop hook will
   * POST iteration progress to /api/hooks so the mobile UI can display it.
   */
  mconnect?: {
    url: string;
    token: string;
  } | null;
  /** Last error message, if any. */
  lastError?: string | null;
}

/**
 * Lightweight pointer for the Cursor rules file to read.
 *
 * The rules file embedded in Cursor cannot run shell commands, so the
 * stop hook also writes a "kickoff" snapshot at `prompt.txt` so the
 * agent can `cat ~/.lecoder/loops/prompt.txt` if it loses the prompt.
 */
export interface LoopPromptSnapshot {
  /** Currently-pending iteration number to generate (1-based). */
  iteration: number;
  /** Body the agent should treat as its instructions for this iteration. */
  body: string;
  /** ISO 8601 timestamp this snapshot was written. */
  updatedAt: string;
}

/**
 * Compute on-disk paths for loop state. Tests can override via env var.
 */
export function getLoopPaths(): {
  rootDir: string;
  activeFile: string;
  historyDir: string;
  promptFile: string;
} {
  const rootDir = process.env.LECODER_LOOP_DIR
    ? process.env.LECODER_LOOP_DIR
    : join(homedir(), '.lecoder', 'loops');
  return {
    rootDir,
    activeFile: join(rootDir, 'active.json'),
    historyDir: join(rootDir, 'history'),
    promptFile: join(rootDir, 'prompt.txt'),
  };
}

/**
 * Generate a short stable loop id (8 hex chars).
 */
export function generateLoopId(): string {
  return `loop_${randomBytes(4).toString('hex')}`;
}

/**
 * Ensure the loop directory tree exists.
 */
function ensureDirs(): void {
  const { rootDir, historyDir } = getLoopPaths();
  if (!existsSync(rootDir)) mkdirSync(rootDir, { recursive: true });
  if (!existsSync(historyDir)) mkdirSync(historyDir, { recursive: true });
}

/**
 * Read the currently active loop state, or null if none is running.
 *
 * Resilient to corrupt or missing files: returns null rather than throwing,
 * because the Cursor stop hook must always emit a valid response.
 */
export function readActiveLoop(): LoopState | null {
  const { activeFile } = getLoopPaths();
  if (!existsSync(activeFile)) return null;
  try {
    const raw = readFileSync(activeFile, 'utf-8');
    return JSON.parse(raw) as LoopState;
  } catch {
    return null;
  }
}

/**
 * Atomically write the active loop state.
 *
 * Uses write-then-rename so a concurrent reader never sees a partial file.
 */
export function writeActiveLoop(state: LoopState): void {
  ensureDirs();
  const { activeFile } = getLoopPaths();
  const tmp = `${activeFile}.tmp.${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf-8');
  renameSync(tmp, activeFile);
}

/**
 * Update the active loop in place via a mutator function.
 * Returns the updated state, or null if there is no active loop.
 */
export function updateActiveLoop(mutate: (state: LoopState) => LoopState): LoopState | null {
  const current = readActiveLoop();
  if (!current) return null;
  const next = mutate(current);
  writeActiveLoop(next);
  return next;
}

/**
 * Move the active loop into history and clear `active.json`.
 *
 * Called when a loop reaches its target or is explicitly stopped.
 */
export function archiveActiveLoop(finalStatus: LoopStatus): LoopState | null {
  const current = readActiveLoop();
  if (!current) return null;
  const archived: LoopState = { ...current, status: finalStatus };
  ensureDirs();
  const { activeFile, historyDir } = getLoopPaths();
  const histFile = join(historyDir, `${archived.id}.json`);
  writeFileSync(histFile, `${JSON.stringify(archived, null, 2)}\n`, 'utf-8');
  try {
    unlinkSync(activeFile);
  } catch {
    // already gone — ignore
  }
  return archived;
}

/**
 * List archived loops (most-recent first).
 */
export function listArchivedLoops(): LoopState[] {
  const { historyDir } = getLoopPaths();
  if (!existsSync(historyDir)) return [];
  const files = readdirSync(historyDir).filter((f) => f.endsWith('.json'));
  const loops: LoopState[] = [];
  for (const file of files) {
    try {
      const raw = readFileSync(join(historyDir, file), 'utf-8');
      loops.push(JSON.parse(raw) as LoopState);
    } catch {
      // skip corrupt history files
    }
  }
  loops.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return loops;
}

/**
 * Append an iteration artifact name to historyTail, capped at 5 entries.
 */
export function appendHistory(state: LoopState, entry: string): LoopState {
  const tail = [...state.historyTail, entry];
  while (tail.length > 5) tail.shift();
  return { ...state, historyTail: tail };
}

/**
 * Write the "current iteration" prompt snapshot the agent can re-read.
 */
export function writePromptSnapshot(snapshot: LoopPromptSnapshot): void {
  ensureDirs();
  const { promptFile } = getLoopPaths();
  const body = [
    `# LeCoder Loop — iteration ${snapshot.iteration}`,
    `# updated: ${snapshot.updatedAt}`,
    '',
    snapshot.body,
    '',
  ].join('\n');
  writeFileSync(promptFile, body, 'utf-8');
}
