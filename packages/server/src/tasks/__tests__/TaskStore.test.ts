import { describe, it, expect, beforeEach } from 'bun:test';
import { TaskStore } from '../TaskStore.js';

class FakeClock {
  current = 1000;
  now() {
    return this.current;
  }
  advance(ms: number) {
    this.current += ms;
  }
}

describe('TaskStore', () => {
  let clock: FakeClock;
  let store: TaskStore;
  let taskN = 0;
  let runN = 0;
  let cmtN = 0;

  beforeEach(() => {
    clock = new FakeClock();
    taskN = 0;
    runN = 0;
    cmtN = 0;
    store = new TaskStore({
      clock,
      generateTaskId: () => `task-${++taskN}`,
      generateRunId: () => `run-${++runN}`,
      generateCommentId: () => `cmt-${++cmtN}`,
    });
  });

  describe('createTask', () => {
    it('creates a queued task with metadata defaults', () => {
      const task = store.createTask({ title: 'fix flake' });
      expect(task.id).toBe('task-1');
      expect(task.status).toBe('queued');
      expect(task.metadata).toEqual({});
      expect(task.createdAt).toBe(1000);
      expect(task.updatedAt).toBe(1000);
    });

    it('honors all input fields', () => {
      const task = store.createTask({
        title: 'a',
        body: 'b',
        provider: 'claude',
        assigneeRuntimeId: 'r-1',
        ownerUserId: 'u-1',
        loopMaxIterations: 5,
        metadata: { skill: 'debug' },
      });
      expect(task.body).toBe('b');
      expect(task.provider).toBe('claude');
      expect(task.assigneeRuntimeId).toBe('r-1');
      expect(task.ownerUserId).toBe('u-1');
      expect(task.loopMaxIterations).toBe(5);
      expect(task.metadata).toEqual({ skill: 'debug' });
    });
  });

  describe('updateTask', () => {
    it('updates status and bumps updatedAt', () => {
      const task = store.createTask({ title: 'a' });
      clock.advance(500);
      const updated = store.updateTask(task.id, { status: 'running' });
      expect(updated?.status).toBe('running');
      expect(updated?.updatedAt).toBe(1500);
    });

    it('sets completedAt when transitioning to terminal status', () => {
      const task = store.createTask({ title: 'a' });
      clock.advance(2000);
      const updated = store.updateTask(task.id, { status: 'completed' });
      expect(updated?.completedAt).toBe(3000);
    });

    it('returns null for unknown id', () => {
      expect(store.updateTask('nope', { status: 'failed' })).toBeNull();
    });

    it('shallow-merges metadata', () => {
      const task = store.createTask({ title: 'a', metadata: { skill: 'x', priority: 1 } });
      const updated = store.updateTask(task.id, { metadata: { priority: 2 } });
      expect(updated?.metadata).toEqual({ skill: 'x', priority: 2 });
    });
  });

  describe('listTasks', () => {
    it('orders by createdAt descending', () => {
      store.createTask({ title: 'a' });
      clock.advance(10);
      store.createTask({ title: 'b' });
      const list = store.listTasks();
      expect(list.map((t) => t.title)).toEqual(['b', 'a']);
    });

    it('filters by status', () => {
      const t1 = store.createTask({ title: 'a' });
      store.createTask({ title: 'b' });
      store.updateTask(t1.id, { status: 'running' });

      const running = store.listTasks({ status: 'running' });
      expect(running.length).toBe(1);
      expect(running[0].id).toBe(t1.id);
    });

    it('filters by ownerUserId', () => {
      store.createTask({ title: 'mine', ownerUserId: 'u-1' });
      store.createTask({ title: 'theirs', ownerUserId: 'u-2' });
      expect(store.listTasks({ ownerUserId: 'u-1' }).length).toBe(1);
    });

    it('respects limit', () => {
      for (let i = 0; i < 5; i++) store.createTask({ title: String(i) });
      expect(store.listTasks({ limit: 2 }).length).toBe(2);
    });
  });

  describe('claimNextQueuedTask', () => {
    it('returns the oldest queued task and marks it dispatched', () => {
      const t1 = store.createTask({ title: 'a' });
      clock.advance(50);
      store.createTask({ title: 'b' });

      const claimed = store.claimNextQueuedTask('r-1');
      expect(claimed?.id).toBe(t1.id);
      expect(claimed?.status).toBe('dispatched');
      expect(claimed?.assigneeRuntimeId).toBe('r-1');
    });

    it('skips tasks pre-assigned to other runtimes', () => {
      store.createTask({ title: 'a', assigneeRuntimeId: 'r-other' });
      const t2 = store.createTask({ title: 'b' });
      const claimed = store.claimNextQueuedTask('r-1');
      expect(claimed?.id).toBe(t2.id);
    });

    it('returns null when nothing queued', () => {
      const t = store.createTask({ title: 'a' });
      store.updateTask(t.id, { status: 'running' });
      expect(store.claimNextQueuedTask('r-1')).toBeNull();
    });
  });

  describe('runs', () => {
    it('createRun starts in running and links to task', () => {
      const t = store.createTask({ title: 'a' });
      const run = store.createRun({ taskId: t.id, runtimeId: 'r-1', agentId: 'a-1' });
      expect(run.status).toBe('running');
      expect(run.taskId).toBe(t.id);
      expect(run.iteration).toBe(1);
    });

    it('updateRun sets endedAt and exit code', () => {
      const t = store.createTask({ title: 'a' });
      const run = store.createRun({ taskId: t.id });
      clock.advance(800);
      const updated = store.updateRun(run.id, { status: 'completed', exitCode: 0 });
      expect(updated?.status).toBe('completed');
    });

    it('listRunsForTask orders by startedAt', () => {
      const t = store.createTask({ title: 'a' });
      store.createRun({ taskId: t.id });
      clock.advance(50);
      store.createRun({ taskId: t.id, iteration: 2 });
      const runs = store.listRunsForTask(t.id);
      expect(runs.length).toBe(2);
      expect(runs[0].iteration).toBe(1);
      expect(runs[1].iteration).toBe(2);
    });
  });

  describe('comments', () => {
    it('createComment defaults to human kind', () => {
      const t = store.createTask({ title: 'a' });
      const c = store.createComment({ taskId: t.id, body: 'lgtm' });
      expect(c.authorKind).toBe('human');
    });

    it('listCommentsForTask filters by task', () => {
      const t1 = store.createTask({ title: 'a' });
      const t2 = store.createTask({ title: 'b' });
      store.createComment({ taskId: t1.id, body: '1' });
      store.createComment({ taskId: t2.id, body: '2' });
      expect(store.listCommentsForTask(t1.id).length).toBe(1);
    });
  });
});
