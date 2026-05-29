/**
 * Git worktree isolation for agent runs.
 *
 * When the user invokes `mconnect agent run` from inside a git repository,
 * we create a sibling git worktree under `<repo>/.lecoder/worktrees/<id>/`
 * and run the agent there. The user's working tree is never touched —
 * the agent sees a clean checkout of the same branch (or a new branch
 * with `--branch new`), can edit files freely, and the user can later
 * `git diff` / cherry-pick / merge the result.
 *
 * If the cwd is *not* a git repository, the agent runs in-place and we
 * print a one-line warning so the user knows there is no isolation.
 *
 * Design constraints:
 *
 *   - Pure shell out to `git` — no libgit2 / dugite dependency. Keeps
 *     the package small and matches what's already used elsewhere in
 *     this repo.
 *   - Worktree directory layout is predictable so the agent and the
 *     user can find it: `<repo>/.lecoder/worktrees/<session-id>/`.
 *   - We register the worktree in the session state file so cleanup is
 *     possible even if the CLI is killed mid-run.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Result of a `git` invocation in this module: stdout, or `null` when
 * the command failed (we never throw — callers decide how to react).
 */
function runGit(cwd: string, args: string[]): string | null {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Information about the git context for a directory.
 */
export interface GitContext {
  /** Whether `cwd` is inside a git working tree. */
  inRepo: boolean;
  /** Absolute path to the repository root (top-level), if known. */
  repoRoot: string | null;
  /** Current branch name, or null when detached HEAD / not a repo. */
  branch: string | null;
  /** Whether the working tree is clean (no staged or unstaged changes). */
  clean: boolean;
}

/**
 * Inspect the git context for a directory.
 *
 * Always succeeds — non-git directories return `inRepo: false`.
 */
export function inspectGitContext(cwd: string): GitContext {
  const repoRoot = runGit(cwd, ['rev-parse', '--show-toplevel']);
  if (!repoRoot) {
    return { inRepo: false, repoRoot: null, branch: null, clean: true };
  }
  const branch = runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const status = runGit(cwd, ['status', '--porcelain']);
  return {
    inRepo: true,
    repoRoot,
    branch: branch && branch !== 'HEAD' ? branch : null,
    clean: !status,
  };
}

/**
 * Branch strategy when creating a worktree.
 *
 *   reuse  — check out the same branch as the parent (default).
 *   new    — create `agent/<session-id>` branched off the current HEAD.
 *   detach — detach at the current HEAD (read-only-ish; commits go to
 *            an unnamed branch the agent can name later).
 */
export type WorktreeBranchStrategy = 'reuse' | 'new' | 'detach';

export interface CreateWorktreeOptions {
  /** Repository root (output of `git rev-parse --show-toplevel`). */
  repoRoot: string;
  /** Stable identifier — used as the directory name + (optionally) branch suffix. */
  sessionId: string;
  /** Branch strategy. Defaults to 'new' so the agent never disturbs the parent's branch. */
  strategy?: WorktreeBranchStrategy;
  /** Optional explicit branch name (overrides strategy-derived names). */
  branchName?: string;
  /** Base ref for new branches. Defaults to current HEAD. */
  baseRef?: string;
}

/**
 * Result of creating a worktree.
 */
export interface WorktreeInfo {
  /** Absolute path to the worktree directory. */
  path: string;
  /** Branch the worktree is checked out on. */
  branch: string;
  /** Strategy that was used. */
  strategy: WorktreeBranchStrategy;
}

/**
 * Default worktree directory: `<repoRoot>/.lecoder/worktrees/<sessionId>`.
 */
export function defaultWorktreePath(repoRoot: string, sessionId: string): string {
  return join(repoRoot, '.lecoder', 'worktrees', sessionId);
}

/**
 * Create a git worktree for an agent session.
 *
 * Throws on git errors so callers can surface a clean message.
 */
export function createWorktree(options: CreateWorktreeOptions): WorktreeInfo {
  const strategy = options.strategy ?? 'new';
  const target = defaultWorktreePath(options.repoRoot, options.sessionId);

  // Refuse to clobber an existing non-empty directory.
  if (existsSync(target)) {
    const stat = statSync(target);
    if (stat.isDirectory()) {
      throw new Error(
        `Worktree path already exists: ${target}. Run \`mconnect agent worktree remove ${options.sessionId}\` first.`
      );
    }
  }

  // Make sure parent exists (git worktree add requires the parent dir).
  mkdirSync(join(target, '..'), { recursive: true });

  if (strategy === 'detach') {
    runOrThrow(options.repoRoot, [
      'worktree',
      'add',
      '--detach',
      target,
      options.baseRef ?? 'HEAD',
    ]);
    const branch = `(detached at ${options.baseRef ?? 'HEAD'})`;
    return { path: target, branch, strategy };
  }

  if (strategy === 'reuse') {
    runOrThrow(options.repoRoot, ['worktree', 'add', target]);
    const branch = runGit(target, ['rev-parse', '--abbrev-ref', 'HEAD']) || 'HEAD';
    return { path: target, branch, strategy };
  }

  // 'new' — create a fresh branch on which the agent works.
  const branchName = options.branchName ?? `agent/${options.sessionId}`;
  runOrThrow(options.repoRoot, [
    'worktree',
    'add',
    '-b',
    branchName,
    target,
    options.baseRef ?? 'HEAD',
  ]);
  return { path: target, branch: branchName, strategy };
}

/**
 * Remove a worktree. Idempotent: succeeds when the worktree is already gone.
 *
 * Pass `force=true` to drop modifications and remove a worktree that
 * has uncommitted changes.
 */
export function removeWorktree(repoRoot: string, worktreePath: string, force = false): void {
  // If git doesn't know about the worktree, it has already been pruned —
  // best we can do is rm the directory directly.
  const list = runGit(repoRoot, ['worktree', 'list', '--porcelain']) ?? '';
  const known = list.includes(`worktree ${worktreePath}`);

  if (!known) {
    if (existsSync(worktreePath)) {
      // No git registration — safe to nuke the directory ourselves.
      try {
        execFileSync('rm', ['-rf', worktreePath], { stdio: 'ignore' });
      } catch {
        /* ignore */
      }
    }
    runGit(repoRoot, ['worktree', 'prune']);
    return;
  }

  const args = ['worktree', 'remove', worktreePath];
  if (force) args.splice(2, 0, '--force');
  runOrThrow(repoRoot, args);
}

/**
 * List all worktrees git knows about, parsed from `--porcelain`.
 */
export function listWorktrees(repoRoot: string): Array<{
  path: string;
  branch: string | null;
  bare: boolean;
  detached: boolean;
}> {
  const out = runGit(repoRoot, ['worktree', 'list', '--porcelain']);
  if (!out) return [];
  const records = out.split(/\n\n+/).filter(Boolean);
  return records.map((record) => {
    const lines = record.split('\n');
    let path = '';
    let branch: string | null = null;
    let bare = false;
    let detached = false;
    for (const line of lines) {
      if (line.startsWith('worktree ')) path = line.slice('worktree '.length);
      else if (line.startsWith('branch '))
        branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
      else if (line === 'bare') bare = true;
      else if (line === 'detached') detached = true;
    }
    return { path, branch, bare, detached };
  });
}

/**
 * Throw if the user passed `--no-worktree` but is in a dirty repo —
 * this signals "I really mean to run the agent in my working tree".
 */
export function ensureSafeInPlaceRun(cwd: string, allowDirty: boolean): GitContext {
  const ctx = inspectGitContext(resolve(cwd));
  if (!ctx.inRepo) return ctx;
  if (!ctx.clean && !allowDirty) {
    throw new Error(
      `Working tree at ${ctx.repoRoot} has uncommitted changes. Use --worktree (recommended) to isolate the agent, or pass --allow-dirty to override.`
    );
  }
  return ctx;
}

function runOrThrow(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    const message =
      err instanceof Error && 'stderr' in err
        ? String((err as { stderr?: Buffer | string }).stderr || err.message)
        : String(err);
    throw new Error(`git ${args.join(' ')} failed: ${message.trim()}`);
  }
}
