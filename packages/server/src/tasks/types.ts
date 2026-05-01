/**
 * Task layer types
 *
 * Mirrors the SQL schema in 003_tasks.sql but kept in TypeScript so daemons,
 * the hub, and the UI can share a vocabulary.
 */

export type TaskStatus =
  | 'queued'
  | 'dispatched'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TaskRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export type CommentAuthorKind = 'human' | 'agent' | 'system';

export interface Task {
  id: string;
  ownerUserId?: string;
  title: string;
  body?: string;
  status: TaskStatus;
  provider?: string;
  assigneeRuntimeId?: string;
  workingDirectory?: string;
  worktreePath?: string;
  loopMaxIterations?: number;
  parentTaskId?: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface CreateTaskInput {
  ownerUserId?: string;
  title: string;
  body?: string;
  provider?: string;
  assigneeRuntimeId?: string;
  workingDirectory?: string;
  loopMaxIterations?: number;
  parentTaskId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateTaskInput {
  status?: TaskStatus;
  assigneeRuntimeId?: string;
  worktreePath?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskRun {
  id: string;
  taskId: string;
  runtimeId?: string;
  agentId?: string;
  worktreePath?: string;
  status: TaskRunStatus;
  exitCode?: number;
  logUrl?: string;
  iteration: number;
  startedAt: number;
  endedAt?: number;
}

export interface CreateTaskRunInput {
  taskId: string;
  runtimeId?: string;
  agentId?: string;
  worktreePath?: string;
  iteration?: number;
}

export interface UpdateTaskRunInput {
  status?: TaskRunStatus;
  exitCode?: number;
  logUrl?: string;
  endedAt?: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorUserId?: string;
  authorRuntimeId?: string;
  authorKind: CommentAuthorKind;
  body: string;
  createdAt: number;
}

export interface CreateCommentInput {
  taskId: string;
  body: string;
  authorUserId?: string;
  authorRuntimeId?: string;
  authorKind?: CommentAuthorKind;
}

export interface TaskListFilter {
  ownerUserId?: string;
  assigneeRuntimeId?: string;
  status?: TaskStatus;
  limit?: number;
}
