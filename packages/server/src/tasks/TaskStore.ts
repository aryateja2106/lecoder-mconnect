/**
 * TaskStore — in-memory store for tasks, runs, and comments.
 *
 * Why in-memory? The hub already supports Postgres for users/sessions, and
 * the migration in 003_tasks.sql defines the production schema. But the
 * platform must work without Postgres for self-host quickstarts (one-shot
 * `lecoder daemon start --hub`), and the hub server otherwise needs
 * something usable for tests and the bundled experience.
 *
 * The shape here matches the SQL schema 1:1 so swapping in a Postgres-backed
 * `PostgresTaskStore` is mechanical: it just becomes a different
 * implementation of the same TaskStore interface.
 */

import type {
  CreateCommentInput,
  CreateTaskInput,
  CreateTaskRunInput,
  Task,
  TaskComment,
  TaskListFilter,
  TaskRun,
  UpdateTaskInput,
  UpdateTaskRunInput,
} from './types.js';

export interface Clock {
  now(): number;
}

const realClock: Clock = { now: () => Date.now() };

function defaultId(prefix: string): () => string {
  return () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  };
}

export interface TaskStoreOptions {
  clock?: Clock;
  generateTaskId?: () => string;
  generateRunId?: () => string;
  generateCommentId?: () => string;
}

export class TaskStore {
  private readonly clock: Clock;
  private readonly newTaskId: () => string;
  private readonly newRunId: () => string;
  private readonly newCommentId: () => string;
  private readonly tasks = new Map<string, Task>();
  private readonly runs = new Map<string, TaskRun>();
  private readonly comments = new Map<string, TaskComment>();

  constructor(opts: TaskStoreOptions = {}) {
    this.clock = opts.clock ?? realClock;
    this.newTaskId = opts.generateTaskId ?? defaultId('task');
    this.newRunId = opts.generateRunId ?? defaultId('run');
    this.newCommentId = opts.generateCommentId ?? defaultId('cmt');
  }

  // ---- Tasks ---------------------------------------------------------

  createTask(input: CreateTaskInput): Task {
    const now = this.clock.now();
    const task: Task = {
      id: this.newTaskId(),
      ownerUserId: input.ownerUserId,
      title: input.title,
      body: input.body,
      status: 'queued',
      provider: input.provider,
      assigneeRuntimeId: input.assigneeRuntimeId,
      workingDirectory: input.workingDirectory,
      worktreePath: undefined,
      loopMaxIterations: input.loopMaxIterations,
      parentTaskId: input.parentTaskId,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.id, task);
    return { ...task };
  }

  getTask(id: string): Task | null {
    const t = this.tasks.get(id);
    return t ? { ...t } : null;
  }

  updateTask(id: string, patch: UpdateTaskInput): Task | null {
    const existing = this.tasks.get(id);
    if (!existing) return null;
    const merged: Task = {
      ...existing,
      status: patch.status ?? existing.status,
      assigneeRuntimeId: patch.assigneeRuntimeId ?? existing.assigneeRuntimeId,
      worktreePath: patch.worktreePath ?? existing.worktreePath,
      metadata: patch.metadata ? { ...existing.metadata, ...patch.metadata } : existing.metadata,
      updatedAt: this.clock.now(),
      completedAt: this.computeCompletedAt(existing, patch.status, this.clock.now()),
    };
    this.tasks.set(id, merged);
    return { ...merged };
  }

  listTasks(filter: TaskListFilter = {}): Task[] {
    const results: Task[] = [];
    for (const t of this.tasks.values()) {
      if (filter.ownerUserId && t.ownerUserId !== filter.ownerUserId) continue;
      if (filter.assigneeRuntimeId && t.assigneeRuntimeId !== filter.assigneeRuntimeId) continue;
      if (filter.status && t.status !== filter.status) continue;
      results.push({ ...t });
    }
    results.sort((a, b) => b.createdAt - a.createdAt);
    if (filter.limit && filter.limit > 0) return results.slice(0, filter.limit);
    return results;
  }

  /**
   * Atomically claim the oldest queued task for a runtime (used by daemons
   * polling the hub). Returns null when nothing is available.
   */
  claimNextQueuedTask(runtimeId: string): Task | null {
    let oldest: Task | null = null;
    for (const t of this.tasks.values()) {
      if (t.status !== 'queued') continue;
      if (t.assigneeRuntimeId && t.assigneeRuntimeId !== runtimeId) continue;
      if (!oldest || t.createdAt < oldest.createdAt) oldest = t;
    }
    if (!oldest) return null;
    return this.updateTask(oldest.id, {
      status: 'dispatched',
      assigneeRuntimeId: runtimeId,
    });
  }

  // ---- Runs ----------------------------------------------------------

  createRun(input: CreateTaskRunInput): TaskRun {
    const run: TaskRun = {
      id: this.newRunId(),
      taskId: input.taskId,
      runtimeId: input.runtimeId,
      agentId: input.agentId,
      worktreePath: input.worktreePath,
      status: 'running',
      iteration: input.iteration ?? 1,
      startedAt: this.clock.now(),
    };
    this.runs.set(run.id, run);
    return { ...run };
  }

  updateRun(id: string, patch: UpdateTaskRunInput): TaskRun | null {
    const existing = this.runs.get(id);
    if (!existing) return null;
    const merged: TaskRun = {
      ...existing,
      status: patch.status ?? existing.status,
      exitCode: patch.exitCode ?? existing.exitCode,
      logUrl: patch.logUrl ?? existing.logUrl,
      endedAt: patch.endedAt ?? existing.endedAt,
    };
    this.runs.set(id, merged);
    return { ...merged };
  }

  listRunsForTask(taskId: string): TaskRun[] {
    const runs = [...this.runs.values()]
      .filter((r) => r.taskId === taskId)
      .sort((a, b) => a.startedAt - b.startedAt);
    return runs.map((r) => ({ ...r }));
  }

  // ---- Comments ------------------------------------------------------

  createComment(input: CreateCommentInput): TaskComment {
    const comment: TaskComment = {
      id: this.newCommentId(),
      taskId: input.taskId,
      authorUserId: input.authorUserId,
      authorRuntimeId: input.authorRuntimeId,
      authorKind: input.authorKind ?? 'human',
      body: input.body,
      createdAt: this.clock.now(),
    };
    this.comments.set(comment.id, comment);
    return { ...comment };
  }

  listCommentsForTask(taskId: string): TaskComment[] {
    const results = [...this.comments.values()]
      .filter((c) => c.taskId === taskId)
      .sort((a, b) => a.createdAt - b.createdAt);
    return results.map((c) => ({ ...c }));
  }

  // ---- Test helpers --------------------------------------------------

  reset(): void {
    this.tasks.clear();
    this.runs.clear();
    this.comments.clear();
  }

  size(): { tasks: number; runs: number; comments: number } {
    return { tasks: this.tasks.size, runs: this.runs.size, comments: this.comments.size };
  }

  private computeCompletedAt(prev: Task, status: Task['status'] | undefined, now: number): number | undefined {
    const newStatus = status ?? prev.status;
    const terminal = newStatus === 'completed' || newStatus === 'failed' || newStatus === 'cancelled';
    if (!terminal) return prev.completedAt;
    return prev.completedAt ?? now;
  }
}

let singleton: TaskStore | null = null;

export function getTaskStore(): TaskStore {
  if (!singleton) singleton = new TaskStore();
  return singleton;
}

export function resetTaskStoreForTests(): void {
  singleton = null;
}
