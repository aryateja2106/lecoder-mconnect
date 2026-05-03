/**
 * WorktreeManager
 *
 * Per-task isolated working directory. Mirrors Paseo's `--worktree` flag.
 *
 * Strategy:
 *   1. If the workspace is a Git repo, use `git worktree add` so the
 *      isolation is cheap (shared object database).
 *   2. Otherwise, fall back to a recursive directory copy so the agent still
 *      gets isolation (slower, used only for non-git directories).
 *
 * Worktrees live under `.lecoder/worktrees/<task-id>-<slug>/` so they stay
 * contained inside the workspace and are easy to .gitignore.
 *
 * The class is fully unit-testable: every shell call goes through the
 * injected `runner`, and filesystem operations go through `fs`. Tests use
 * fakes for both.
 */

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface RunOutcome {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  run(command: string, args: string[], opts?: { cwd?: string }): Promise<RunOutcome>;
}

export interface FsLayer {
  exists(path: string): boolean;
  mkdir(path: string, recursive: boolean): void;
  rm(path: string, recursive: boolean): void;
  copy(src: string, dest: string): void;
}

const realRunner: CommandRunner = {
  async run(command, args, opts) {
    try {
      const { stdout, stderr } = await execFileAsync(command, args, { cwd: opts?.cwd });
      return { exitCode: 0, stdout: String(stdout), stderr: String(stderr) };
    } catch (err) {
      const error = err as { code?: number; stdout?: string; stderr?: string };
      return {
        exitCode: typeof error.code === 'number' ? error.code : 1,
        stdout: String(error.stdout ?? ''),
        stderr: String(error.stderr ?? ''),
      };
    }
  },
};

const realFs: FsLayer = {
  exists: (path) => existsSync(path),
  mkdir: (path, recursive) => {
    if (existsSync(path)) return;
    mkdirSync(path, { recursive });
  },
  rm: (path, recursive) => {
    if (existsSync(path)) rmSync(path, { recursive, force: true });
  },
  copy: (src, dest) => {
    cpSync(src, dest, { recursive: true });
  },
};

export interface WorktreeOptions {
  /** Absolute path to the workspace root (a git repo, or any directory). */
  workspaceRoot: string;
  /** Override the runner — used by tests. */
  runner?: CommandRunner;
  /** Override the fs layer — used by tests. */
  fs?: FsLayer;
}

export interface AcquiredWorktree {
  /** Absolute path to the worktree. */
  path: string;
  /** True when backed by `git worktree`, false when backed by a copy. */
  isGitWorktree: boolean;
  /** Git branch used for the worktree (only set when isGitWorktree). */
  branch?: string;
  /** Function to release the worktree. Idempotent. */
  release(): Promise<void>;
}

/** Slugify a task title for use in a worktree path. */
export function slugifyTitle(title: string, max = 32): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (slug || 'task').slice(0, max);
}

export class WorktreeManager {
  private readonly workspaceRoot: string;
  private readonly runner: CommandRunner;
  private readonly fs: FsLayer;

  constructor(options: WorktreeOptions) {
    this.workspaceRoot = resolve(options.workspaceRoot);
    this.runner = options.runner ?? realRunner;
    this.fs = options.fs ?? realFs;
  }

  /**
   * Returns true if the workspace root is a git repo.
   */
  async isGitRepo(): Promise<boolean> {
    if (this.fs.exists(join(this.workspaceRoot, '.git'))) return true;
    const result = await this.runner.run('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: this.workspaceRoot,
    });
    return result.exitCode === 0 && result.stdout.trim() === 'true';
  }

  /**
   * Acquire a fresh worktree for the given task.
   *
   * Naming: `.lecoder/worktrees/<taskId>-<slug>/`
   * Branch: `lecoder/<taskId>-<slug>` (created off HEAD when in git mode).
   */
  async acquire(input: { taskId: string; title: string }): Promise<AcquiredWorktree> {
    const slug = slugifyTitle(input.title);
    const dirName = `${input.taskId}-${slug}`;
    const worktreesRoot = join(this.workspaceRoot, '.lecoder', 'worktrees');
    const worktreePath = join(worktreesRoot, dirName);

    this.fs.mkdir(worktreesRoot, true);

    // If the path already exists from a previous failed run, blow it away
    // so acquisition is idempotent.
    if (this.fs.exists(worktreePath)) {
      this.fs.rm(worktreePath, true);
    }

    if (await this.isGitRepo()) {
      const branch = `lecoder/${dirName}`;
      const result = await this.runner.run(
        'git',
        ['worktree', 'add', '-B', branch, worktreePath, 'HEAD'],
        { cwd: this.workspaceRoot }
      );
      if (result.exitCode !== 0) {
        throw new Error(
          `git worktree add failed: ${result.stderr.trim() || result.stdout.trim()}`
        );
      }
      return {
        path: worktreePath,
        isGitWorktree: true,
        branch,
        release: async () => {
          await this.releaseGitWorktree(worktreePath, branch);
        },
      };
    }

    // Plain directory copy fallback.
    this.fs.copy(this.workspaceRoot, worktreePath);
    return {
      path: worktreePath,
      isGitWorktree: false,
      release: async () => {
        this.fs.rm(worktreePath, true);
      },
    };
  }

  /**
   * Release a git worktree. Best-effort — if `git worktree remove` fails
   * we still try to nuke the directory so we don't leak disk on stale state.
   */
  private async releaseGitWorktree(worktreePath: string, branch: string): Promise<void> {
    if (this.fs.exists(worktreePath)) {
      const removeResult = await this.runner.run(
        'git',
        ['worktree', 'remove', '--force', worktreePath],
        { cwd: this.workspaceRoot }
      );
      if (removeResult.exitCode !== 0) {
        // Fall back to brute-force removal.
        this.fs.rm(worktreePath, true);
        await this.runner.run('git', ['worktree', 'prune'], { cwd: this.workspaceRoot });
      }
    }
    // Best-effort branch cleanup. Ignore failure — the worktree branch may
    // be useful to keep around if the user wants to inspect the work.
    await this.runner.run('git', ['branch', '-D', branch], { cwd: this.workspaceRoot });
  }
}
