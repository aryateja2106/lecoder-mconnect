/**
 * Tests for tasks/WorktreeManager
 *
 * We use injected fakes for both the shell runner and the filesystem layer
 * so the tests run without touching disk.
 */

import { describe, expect, it } from 'vitest';
import {
  type CommandRunner,
  type FsLayer,
  WorktreeManager,
  slugifyTitle,
} from '../tasks/WorktreeManager.js';

interface RecordedCall {
  command: string;
  args: string[];
  cwd?: string;
}

function makeRunner(handlers: Array<(call: RecordedCall) => Awaited<ReturnType<CommandRunner['run']>>>) {
  const calls: RecordedCall[] = [];
  let i = 0;
  const runner: CommandRunner = {
    async run(command, args, opts) {
      const call = { command, args, cwd: opts?.cwd };
      calls.push(call);
      const handler = handlers[i++] ?? (() => ({ exitCode: 0, stdout: '', stderr: '' }));
      return handler(call);
    },
  };
  return { runner, calls };
}

function makeFs(): FsLayer & { state: Set<string>; copies: Array<{ src: string; dest: string }> } {
  const state = new Set<string>();
  const copies: Array<{ src: string; dest: string }> = [];
  return {
    state,
    copies,
    exists: (p) => state.has(p),
    mkdir: (p) => {
      state.add(p);
    },
    rm: (p) => {
      for (const item of [...state]) {
        if (item === p || item.startsWith(`${p}/`)) state.delete(item);
      }
    },
    copy: (src, dest) => {
      copies.push({ src, dest });
      state.add(dest);
    },
  };
}

describe('slugifyTitle', () => {
  it('lowercases and replaces non-alphanumerics', () => {
    expect(slugifyTitle('Fix Flaky Test')).toBe('fix-flaky-test');
    expect(slugifyTitle('A/B test 123')).toBe('a-b-test-123');
  });

  it('truncates to max length', () => {
    expect(slugifyTitle('a'.repeat(100), 5)).toBe('aaaaa');
  });

  it('falls back to "task" when slug is empty', () => {
    expect(slugifyTitle('!!!')).toBe('task');
  });
});

describe('WorktreeManager', () => {
  describe('isGitRepo', () => {
    it('returns true when .git exists', async () => {
      const fs = makeFs();
      fs.state.add('/repo/.git');
      const { runner } = makeRunner([]);
      const wm = new WorktreeManager({ workspaceRoot: '/repo', runner, fs });
      expect(await wm.isGitRepo()).toBe(true);
    });

    it('falls back to git rev-parse', async () => {
      const fs = makeFs();
      const { runner } = makeRunner([
        () => ({ exitCode: 0, stdout: 'true\n', stderr: '' }),
      ]);
      const wm = new WorktreeManager({ workspaceRoot: '/repo', runner, fs });
      expect(await wm.isGitRepo()).toBe(true);
    });

    it('returns false when neither marker is present', async () => {
      const fs = makeFs();
      const { runner } = makeRunner([
        () => ({ exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' }),
      ]);
      const wm = new WorktreeManager({ workspaceRoot: '/x', runner, fs });
      expect(await wm.isGitRepo()).toBe(false);
    });
  });

  describe('acquire (git mode)', () => {
    it('runs git worktree add with the right arguments', async () => {
      const fs = makeFs();
      fs.state.add('/repo/.git');
      const { runner, calls } = makeRunner([
        () => ({ exitCode: 0, stdout: '', stderr: '' }), // git worktree add
      ]);
      const wm = new WorktreeManager({ workspaceRoot: '/repo', runner, fs });
      const wt = await wm.acquire({ taskId: 't-abc', title: 'Fix Flaky Test' });

      expect(wt.isGitWorktree).toBe(true);
      expect(wt.branch).toBe('lecoder/t-abc-fix-flaky-test');
      expect(wt.path).toBe('/repo/.lecoder/worktrees/t-abc-fix-flaky-test');

      expect(calls[0].command).toBe('git');
      expect(calls[0].args).toEqual([
        'worktree',
        'add',
        '-B',
        'lecoder/t-abc-fix-flaky-test',
        '/repo/.lecoder/worktrees/t-abc-fix-flaky-test',
        'HEAD',
      ]);
    });

    it('throws when git worktree add fails', async () => {
      const fs = makeFs();
      fs.state.add('/repo/.git');
      const { runner } = makeRunner([
        () => ({ exitCode: 1, stdout: '', stderr: 'fatal: branch already in use' }),
      ]);
      const wm = new WorktreeManager({ workspaceRoot: '/repo', runner, fs });
      await expect(wm.acquire({ taskId: 't-1', title: 'a' })).rejects.toThrow(/branch already/);
    });

    it('release calls git worktree remove + branch -D', async () => {
      const fs = makeFs();
      fs.state.add('/repo/.git');
      const { runner, calls } = makeRunner([
        () => ({ exitCode: 0, stdout: '', stderr: '' }), // worktree add
        () => ({ exitCode: 0, stdout: '', stderr: '' }), // worktree remove
        () => ({ exitCode: 0, stdout: '', stderr: '' }), // branch -D
      ]);
      const wm = new WorktreeManager({ workspaceRoot: '/repo', runner, fs });
      const wt = await wm.acquire({ taskId: 't-1', title: 'a' });
      // Mark fs as having the worktree path so release exercises remove.
      fs.state.add(wt.path);
      await wt.release();
      expect(calls[1].args.slice(0, 3)).toEqual(['worktree', 'remove', '--force']);
      expect(calls[2].args).toEqual(['branch', '-D', 'lecoder/t-1-a']);
    });

    it('release falls back to brute-force rm when git removal fails', async () => {
      const fs = makeFs();
      fs.state.add('/repo/.git');
      const { runner, calls } = makeRunner([
        () => ({ exitCode: 0, stdout: '', stderr: '' }), // worktree add
        () => ({ exitCode: 1, stdout: '', stderr: 'fatal' }), // worktree remove failed
        () => ({ exitCode: 0, stdout: '', stderr: '' }), // worktree prune
        () => ({ exitCode: 0, stdout: '', stderr: '' }), // branch -D
      ]);
      const wm = new WorktreeManager({ workspaceRoot: '/repo', runner, fs });
      const wt = await wm.acquire({ taskId: 't-1', title: 'a' });
      fs.state.add(wt.path);
      await wt.release();
      // brute-force rm removes the path from fs
      expect(fs.state.has(wt.path)).toBe(false);
      expect(calls.some((c) => c.args.includes('prune'))).toBe(true);
    });
  });

  describe('acquire (non-git fallback)', () => {
    it('copies the workspace directory recursively', async () => {
      const fs = makeFs();
      const { runner } = makeRunner([
        () => ({ exitCode: 128, stdout: '', stderr: 'not a repo' }),
      ]);
      const wm = new WorktreeManager({ workspaceRoot: '/dir', runner, fs });
      const wt = await wm.acquire({ taskId: 't-1', title: 'Hello' });
      expect(wt.isGitWorktree).toBe(false);
      expect(fs.copies.length).toBe(1);
      expect(fs.copies[0]).toEqual({
        src: '/dir',
        dest: '/dir/.lecoder/worktrees/t-1-hello',
      });
    });

    it('release rms the directory in non-git mode', async () => {
      const fs = makeFs();
      const { runner } = makeRunner([
        () => ({ exitCode: 128, stdout: '', stderr: 'not a repo' }),
      ]);
      const wm = new WorktreeManager({ workspaceRoot: '/dir', runner, fs });
      const wt = await wm.acquire({ taskId: 't-1', title: 'a' });
      fs.state.add(wt.path);
      await wt.release();
      expect(fs.state.has(wt.path)).toBe(false);
    });
  });

  it('blows away an existing worktree path before re-creating', async () => {
    const fs = makeFs();
    fs.state.add('/repo/.git');
    fs.state.add('/repo/.lecoder/worktrees/t-1-a');
    const { runner } = makeRunner([
      () => ({ exitCode: 0, stdout: '', stderr: '' }),
    ]);
    const wm = new WorktreeManager({ workspaceRoot: '/repo', runner, fs });
    await wm.acquire({ taskId: 't-1', title: 'a' });
    expect(fs.state.has('/repo/.lecoder/worktrees/t-1-a')).toBe(false);
  });
});
