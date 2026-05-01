/**
 * Unit tests for the worktree helpers.
 *
 * These tests exercise real `git worktree` calls inside a temporary
 * repository. They are skipped automatically if `git` is not available
 * (so the suite still passes on minimal CI images).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createWorktree,
  defaultWorktreePath,
  ensureSafeInPlaceRun,
  inspectGitContext,
  listWorktrees,
  removeWorktree,
} from '../agent-cli/worktree.js';

const HAS_GIT = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const describeIfGit = HAS_GIT ? describe : describe.skip;

function git(cwd: string, args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

describeIfGit('worktree helpers', () => {
  let repoRoot: string;

  beforeAll(() => {
    if (!HAS_GIT) return;
  });

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'lecoder-wt-'));
    git(repoRoot, ['init', '-q', '-b', 'main']);
    git(repoRoot, ['config', 'user.email', 'test@test']);
    git(repoRoot, ['config', 'user.name', 'Test']);
    writeFileSync(join(repoRoot, 'README.md'), 'hello\n');
    git(repoRoot, ['add', '.']);
    git(repoRoot, ['commit', '-qm', 'init']);
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('inspectGitContext detects a clean repo', () => {
    const ctx = inspectGitContext(repoRoot);
    expect(ctx.inRepo).toBe(true);
    expect(ctx.repoRoot).toBe(repoRoot);
    expect(ctx.branch).toBe('main');
    expect(ctx.clean).toBe(true);
  });

  it('inspectGitContext detects dirty trees', () => {
    writeFileSync(join(repoRoot, 'README.md'), 'changed\n');
    const ctx = inspectGitContext(repoRoot);
    expect(ctx.clean).toBe(false);
  });

  it('inspectGitContext returns inRepo=false for a non-git path', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lecoder-nogit-'));
    try {
      const ctx = inspectGitContext(tmp);
      expect(ctx.inRepo).toBe(false);
      expect(ctx.repoRoot).toBeNull();
      expect(ctx.clean).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('createWorktree (strategy=new) creates a fresh branch', () => {
    const wt = createWorktree({ repoRoot, sessionId: 'sess_a' });
    expect(wt.path).toBe(defaultWorktreePath(repoRoot, 'sess_a'));
    expect(existsSync(wt.path)).toBe(true);
    expect(wt.branch).toBe('agent/sess_a');
    expect(wt.strategy).toBe('new');
    // Branch should exist
    const branches = git(repoRoot, ['branch', '--list', 'agent/sess_a']);
    expect(branches).toContain('agent/sess_a');
  });

  it('createWorktree (strategy=new) honours --branch-name override', () => {
    const wt = createWorktree({
      repoRoot,
      sessionId: 'sess_b',
      strategy: 'new',
      branchName: 'feature/explore',
    });
    expect(wt.branch).toBe('feature/explore');
  });

  it('createWorktree (strategy=detach) creates a detached worktree', () => {
    const wt = createWorktree({ repoRoot, sessionId: 'sess_c', strategy: 'detach' });
    expect(wt.branch).toContain('detached');
    // Detached worktree shows up as such in `git worktree list --porcelain`.
    const list = listWorktrees(repoRoot);
    const entry = list.find((w) => w.path === wt.path);
    expect(entry?.detached).toBe(true);
    expect(entry?.branch).toBeNull();
  });

  it('createWorktree refuses to clobber an existing path', () => {
    createWorktree({ repoRoot, sessionId: 'sess_d' });
    expect(() => createWorktree({ repoRoot, sessionId: 'sess_d' })).toThrow(/already exists/);
  });

  it('removeWorktree cleans up the worktree directory', () => {
    const wt = createWorktree({ repoRoot, sessionId: 'sess_e' });
    expect(existsSync(wt.path)).toBe(true);
    removeWorktree(repoRoot, wt.path);
    expect(existsSync(wt.path)).toBe(false);
  });

  it('removeWorktree is idempotent for a missing worktree', () => {
    const path = defaultWorktreePath(repoRoot, 'sess_missing');
    expect(() => removeWorktree(repoRoot, path)).not.toThrow();
  });

  it('listWorktrees includes the parent + every created worktree', () => {
    createWorktree({ repoRoot, sessionId: 'sess_f' });
    createWorktree({ repoRoot, sessionId: 'sess_g', strategy: 'detach' });
    const wts = listWorktrees(repoRoot);
    const paths = wts.map((w) => w.path);
    expect(paths).toContain(repoRoot);
    expect(paths).toContain(defaultWorktreePath(repoRoot, 'sess_f'));
    expect(paths).toContain(defaultWorktreePath(repoRoot, 'sess_g'));
    const branchedEntry = wts.find((w) => w.path.endsWith('sess_f'));
    expect(branchedEntry?.branch).toBe('agent/sess_f');
    const detachedEntry = wts.find((w) => w.path.endsWith('sess_g'));
    expect(detachedEntry?.detached).toBe(true);
  });

  it('ensureSafeInPlaceRun throws on dirty tree without allowDirty', () => {
    writeFileSync(join(repoRoot, 'README.md'), 'dirty\n');
    expect(() => ensureSafeInPlaceRun(repoRoot, false)).toThrow(/uncommitted changes/);
  });

  it('ensureSafeInPlaceRun returns silently with allowDirty', () => {
    writeFileSync(join(repoRoot, 'README.md'), 'dirty\n');
    expect(() => ensureSafeInPlaceRun(repoRoot, true)).not.toThrow();
  });

  it('ensureSafeInPlaceRun is a no-op outside of git', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lecoder-nogit-'));
    try {
      const ctx = ensureSafeInPlaceRun(tmp, false);
      expect(ctx.inRepo).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('worktree helpers (no git)', () => {
  it('inspectGitContext does not throw on non-existent paths', () => {
    expect(() => inspectGitContext('/nonexistent/path')).not.toThrow();
  });
});
