-- LeSearch Hub Task Layer
-- Version: 003
-- Description: Tasks, runs, and comments — the work units that daemons execute.

-- ============================================================================
-- Tasks
--
-- A task is a unit of work assigned to a runtime (or runtime+provider).
-- Lifecycle: queued -> dispatched -> running -> completed | failed | cancelled
-- Each lifecycle step happens on the daemon side and is reported back to the
-- hub via /tasks/:id/runs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(280) NOT NULL,
  body TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  provider VARCHAR(40),
  assignee_runtime_id UUID,
  working_directory TEXT,
  worktree_path TEXT,
  loop_max_iterations INTEGER,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT tasks_status_check CHECK (
    status IN ('queued', 'dispatched', 'running', 'completed', 'failed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_runtime_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

-- ============================================================================
-- Task runs
--
-- Each attempt at executing a task. A task can have multiple runs when
-- retries / loops are configured. Runs are owned by daemons; the hub records
-- start/end timestamps reported via the API.
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  runtime_id UUID,
  agent_id VARCHAR(64),
  worktree_path TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  exit_code INTEGER,
  log_url TEXT,
  iteration INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  CONSTRAINT task_runs_status_check CHECK (
    status IN ('running', 'completed', 'failed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_task_runs_task ON task_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_runs_runtime ON task_runs(runtime_id);
CREATE INDEX IF NOT EXISTS idx_task_runs_status ON task_runs(status);
CREATE INDEX IF NOT EXISTS idx_task_runs_started_at ON task_runs(started_at DESC);

-- ============================================================================
-- Task comments
--
-- Lightweight comment thread per task — used by both human collaborators
-- and agent @mentions. Mirrors Multica's per-issue comment thread.
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_runtime_id UUID,
  author_kind VARCHAR(10) NOT NULL DEFAULT 'human',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT task_comments_kind_check CHECK (author_kind IN ('human', 'agent', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id, created_at);
