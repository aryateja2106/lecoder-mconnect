/**
 * Tests for tasks/TaskRunner
 *
 * Drives the runner with fake hub + launcher + worktree manager so we can
 * assert lifecycle ordering precisely.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  type AgentLauncher,
  type HubTaskApi,
  type HubTaskClaim,
  TaskRunner,
} from '../tasks/TaskRunner.js';
import type { WorktreeManager } from '../tasks/WorktreeManager.js';

interface RecordedRelease {
  released: boolean;
}

function makeWorktreeManager() {
  const releases: RecordedRelease[] = [];
  const wm = {
    async acquire(input: { taskId: string; title: string }) {
      const release: RecordedRelease = { released: false };
      releases.push(release);
      return {
        path: `/wt/${input.taskId}`,
        isGitWorktree: true,
        branch: `lecoder/${input.taskId}`,
        async release() {
          release.released = true;
        },
      };
    },
  } as unknown as WorktreeManager;
  return { wm, releases };
}

function makeHubApi(claims: Array<HubTaskClaim | null>): {
  api: HubTaskApi;
  startCalls: Array<{ taskId: string; runtimeId: string; worktreePath: string }>;
  finishCalls: Array<{ taskId: string; runId: string; status: string; exitCode?: number }>;
} {
  const startCalls: Array<{ taskId: string; runtimeId: string; worktreePath: string }> = [];
  const finishCalls: Array<{ taskId: string; runId: string; status: string; exitCode?: number }> = [];
  let runIdCounter = 0;
  const api: HubTaskApi = {
    async claimNextTask() {
      return claims.shift() ?? null;
    },
    async startRun(input) {
      startCalls.push(input);
      return { runId: `run-${++runIdCounter}` };
    },
    async finishRun(input) {
      finishCalls.push(input);
    },
  };
  return { api, startCalls, finishCalls };
}

const silentLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('TaskRunner', () => {
  it('returns null when no task is queued', async () => {
    const { wm } = makeWorktreeManager();
    const { api } = makeHubApi([null]);
    const runner = new TaskRunner({
      runtimeId: 'r-1',
      hubApi: api,
      worktreeManager: wm,
      launcher: { async launch() { throw new Error('should not run'); } },
      logger: silentLogger,
    });
    expect(await runner.tick()).toBeNull();
  });

  it('runs the full lifecycle for a task and reports completion', async () => {
    const { wm, releases } = makeWorktreeManager();
    const { api, startCalls, finishCalls } = makeHubApi([
      { id: 't-1', title: 'fix flake' },
    ]);
    const launcher: AgentLauncher = {
      async launch(input) {
        expect(input.task.id).toBe('t-1');
        expect(input.worktreePath).toBe('/wt/t-1');
        return { exitCode: 0, status: 'completed' };
      },
    };

    const runner = new TaskRunner({
      runtimeId: 'r-1',
      hubApi: api,
      worktreeManager: wm,
      launcher,
      logger: silentLogger,
    });

    expect(await runner.tick()).toEqual({ id: 't-1', title: 'fix flake' });

    // Wait for the in-flight task to finish.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(startCalls).toHaveLength(1);
    expect(startCalls[0]).toMatchObject({
      taskId: 't-1',
      runtimeId: 'r-1',
      worktreePath: '/wt/t-1',
    });
    expect(finishCalls).toHaveLength(1);
    expect(finishCalls[0].status).toBe('completed');
    expect(finishCalls[0].exitCode).toBe(0);
    expect(releases[0].released).toBe(true);
  });

  it('marks run failed when launcher throws', async () => {
    const { wm, releases } = makeWorktreeManager();
    const { api, finishCalls } = makeHubApi([
      { id: 't-1', title: 'a' },
    ]);
    const launcher: AgentLauncher = {
      async launch() {
        throw new Error('launcher exploded');
      },
    };

    const runner = new TaskRunner({
      runtimeId: 'r-1',
      hubApi: api,
      worktreeManager: wm,
      launcher,
      logger: silentLogger,
    });

    await runner.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(finishCalls).toHaveLength(1);
    expect(finishCalls[0].status).toBe('failed');
    expect(releases[0].released).toBe(true);
  });

  it('still releases worktree if startRun fails', async () => {
    const { wm, releases } = makeWorktreeManager();
    const api: HubTaskApi = {
      async claimNextTask() {
        return { id: 't-1', title: 'a' };
      },
      async startRun() {
        throw new Error('hub down');
      },
      async finishRun() {
        throw new Error('should not be called');
      },
    };
    const runner = new TaskRunner({
      runtimeId: 'r-1',
      hubApi: api,
      worktreeManager: wm,
      launcher: { async launch() { return { exitCode: 0, status: 'completed' }; } },
      logger: silentLogger,
    });

    await runner.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(releases[0].released).toBe(true);
  });

  it('marks failed status with non-zero exit code', async () => {
    const { wm } = makeWorktreeManager();
    const { api, finishCalls } = makeHubApi([
      { id: 't-1', title: 'a' },
    ]);
    const launcher: AgentLauncher = {
      async launch() {
        return { exitCode: 5, status: 'failed' };
      },
    };
    const runner = new TaskRunner({
      runtimeId: 'r-1',
      hubApi: api,
      worktreeManager: wm,
      launcher,
      logger: silentLogger,
    });
    await runner.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(finishCalls[0]).toMatchObject({ status: 'failed', exitCode: 5 });
  });

  it('start()/stop() does not throw and is idempotent', () => {
    const { wm } = makeWorktreeManager();
    const { api } = makeHubApi([null]);
    const runner = new TaskRunner({
      runtimeId: 'r-1',
      hubApi: api,
      worktreeManager: wm,
      launcher: { async launch() { return { exitCode: 0, status: 'completed' }; } },
      pollMs: 100,
      logger: silentLogger,
    });
    runner.start();
    runner.start();
    runner.stop();
    runner.stop();
  });
});
