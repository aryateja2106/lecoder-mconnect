/**
 * `lecoder task` — task CLI
 *
 *   lecoder task new "fix flaky test" [--provider claude] [--runtime r-1]
 *   lecoder task ls                   [--status running] [--runtime r-1]
 *   lecoder task view <task-id>
 *   lecoder task cancel <task-id>
 *   lecoder task comment <task-id> "looks good"
 *
 * All commands hit the hub at LECODER_HUB_URL with LECODER_HUB_TOKEN.
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { VERSION } from '../../version.js';

interface TaskRow {
  id: string;
  title: string;
  body?: string;
  status: 'queued' | 'dispatched' | 'running' | 'completed' | 'failed' | 'cancelled';
  provider?: string;
  assigneeRuntimeId?: string;
  workingDirectory?: string;
  worktreePath?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

interface TaskRun {
  id: string;
  taskId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  exitCode?: number;
  worktreePath?: string;
  iteration: number;
  startedAt: number;
  endedAt?: number;
}

interface TaskComment {
  id: string;
  taskId: string;
  authorKind: 'human' | 'agent' | 'system';
  body: string;
  createdAt: number;
}

interface TaskListResponse {
  tasks: TaskRow[];
}

interface TaskDetailResponse {
  task: TaskRow;
  runs: TaskRun[];
  comments: TaskComment[];
}

interface TaskCreateResponse {
  task: TaskRow;
}

function getHubConfig(): { url: string; token?: string } {
  const url = process.env.LECODER_HUB_URL;
  if (!url) {
    console.error(chalk.red('  Hub URL not set. export LECODER_HUB_URL=https://hub.example.com'));
    process.exit(1);
  }
  return { url: url.replace(/\/$/, ''), token: process.env.LECODER_HUB_TOKEN };
}

async function hubFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, token } = getHubConfig();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': `lecoder-mconnect/${VERSION}`,
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${url}${path}`, { ...init, headers });
  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(`Hub ${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

function formatRel(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function statusBadge(status: TaskRow['status']): string {
  switch (status) {
    case 'queued':
      return chalk.gray('queued');
    case 'dispatched':
      return chalk.blue('dispatched');
    case 'running':
      return chalk.cyan('running');
    case 'completed':
      return chalk.green('completed');
    case 'failed':
      return chalk.red('failed');
    case 'cancelled':
      return chalk.dim('cancelled');
  }
}

async function newCmd(
  title: string,
  opts: { body?: string; provider?: string; runtime?: string; cwd?: string; loop?: string; json?: boolean }
): Promise<void> {
  const data = await hubFetch<TaskCreateResponse>('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title,
      body: opts.body,
      provider: opts.provider,
      assigneeRuntimeId: opts.runtime,
      workingDirectory: opts.cwd,
      loopMaxIterations: opts.loop ? Math.max(1, parseInt(opts.loop, 10) || 1) : undefined,
    }),
  });
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  console.log(`\n  ${chalk.green('✓')} task ${chalk.bold(data.task.id)} created`);
  console.log(`    ${chalk.dim(`status: ${data.task.status}`)}`);
  if (data.task.assigneeRuntimeId) {
    console.log(`    ${chalk.dim(`runtime: ${data.task.assigneeRuntimeId}`)}`);
  }
  console.log('');
}

async function lsCmd(opts: {
  status?: string;
  runtime?: string;
  limit?: string;
  json?: boolean;
}): Promise<void> {
  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  if (opts.runtime) params.set('runtime', opts.runtime);
  if (opts.limit) params.set('limit', opts.limit);
  const query = params.toString();
  const data = await hubFetch<TaskListResponse>(`/tasks${query ? `?${query}` : ''}`);

  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (data.tasks.length === 0) {
    console.log(chalk.yellow('\n  No tasks found.'));
    console.log(chalk.dim('  Create one with `lecoder task new "title"`.\n'));
    return;
  }

  console.log(`\n${chalk.bold('Tasks:')}\n`);
  for (const t of data.tasks) {
    const id = chalk.dim(t.id.slice(0, 8));
    const status = statusBadge(t.status).padEnd(20, ' ');
    const age = chalk.dim(formatRel(t.createdAt));
    console.log(`  ${id}  ${status} ${chalk.bold(t.title)}  ${age}`);
  }
  console.log('');
}

async function viewCmd(taskId: string, opts: { json?: boolean }): Promise<void> {
  const data = await hubFetch<TaskDetailResponse>(`/tasks/${taskId}`);
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const t = data.task;
  console.log('');
  console.log(`  ${chalk.bold(t.title)}`);
  console.log(`  ${chalk.dim(t.id)}`);
  console.log('');
  console.log(`  ${chalk.dim('status:')}    ${statusBadge(t.status)}`);
  if (t.provider) console.log(`  ${chalk.dim('provider:')} ${t.provider}`);
  if (t.assigneeRuntimeId) console.log(`  ${chalk.dim('runtime:')}  ${t.assigneeRuntimeId}`);
  if (t.workingDirectory) console.log(`  ${chalk.dim('cwd:')}      ${t.workingDirectory}`);
  if (t.worktreePath) console.log(`  ${chalk.dim('worktree:')} ${t.worktreePath}`);
  console.log(`  ${chalk.dim('created:')}  ${formatRel(t.createdAt)} ago`);
  if (t.completedAt) {
    console.log(`  ${chalk.dim('completed:')} ${formatRel(t.completedAt)} ago`);
  }
  if (t.body) {
    console.log('');
    console.log(`  ${chalk.dim(t.body.split('\n').join('\n  '))}`);
  }

  if (data.runs.length > 0) {
    console.log('');
    console.log(`  ${chalk.bold('Runs:')}`);
    for (const r of data.runs) {
      console.log(
        `    #${r.iteration}  ${statusBadge(r.status as TaskRow['status'])}` +
          (r.exitCode !== undefined ? ` exit=${r.exitCode}` : '') +
          chalk.dim(`  ${formatRel(r.startedAt)} ago`)
      );
    }
  }

  if (data.comments.length > 0) {
    console.log('');
    console.log(`  ${chalk.bold('Comments:')}`);
    for (const c of data.comments) {
      const tag = c.authorKind === 'agent' ? chalk.cyan('[agent]') : c.authorKind === 'system' ? chalk.dim('[system]') : chalk.green('[human]');
      console.log(`    ${tag} ${chalk.dim(formatRel(c.createdAt) + ' ago')}`);
      console.log(`      ${c.body.split('\n').join('\n      ')}`);
    }
  }
  console.log('');
}

async function cancelCmd(taskId: string): Promise<void> {
  await hubFetch<void>(`/tasks/${taskId}`, { method: 'DELETE' });
  console.log(`\n  ${chalk.green('✓')} task ${chalk.bold(taskId)} cancelled\n`);
}

async function commentCmd(taskId: string, body: string): Promise<void> {
  await hubFetch<{ comment: { id: string } }>(`/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  console.log(`\n  ${chalk.green('✓')} comment added to ${chalk.bold(taskId)}\n`);
}

export function createTaskCommand(): Command {
  const cmd = new Command('task').description('Create and inspect tasks').addHelpText(
    'after',
    `
Examples:
  $ lecoder task new "fix flaky test"
  $ lecoder task new "fix flaky test" --provider claude --runtime r-abc
  $ lecoder task ls --status running
  $ lecoder task view <task-id>
  $ lecoder task cancel <task-id>
  $ lecoder task comment <task-id> "looks good"

Required env: LECODER_HUB_URL (LECODER_HUB_TOKEN optional)`
  );

  cmd
    .command('new <title>')
    .description('Create a new task')
    .option('-b, --body <body>', 'Long-form description')
    .option('-p, --provider <provider>', 'Provider hint (claude, codex, gemini, ...)')
    .option('-r, --runtime <runtimeId>', 'Assign to a specific runtime')
    .option('-c, --cwd <path>', 'Working directory hint')
    .option('--loop <n>', 'Max retry/loop iterations')
    .option('--json', 'Output as JSON')
    .action(async (title, opts) => {
      try {
        await newCmd(title, opts);
      } catch (err) {
        console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  cmd
    .command('ls')
    .alias('list')
    .description('List tasks')
    .option('-s, --status <status>', 'Filter by status')
    .option('-r, --runtime <runtimeId>', 'Filter by assigned runtime')
    .option('-l, --limit <n>', 'Max rows to return')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        await lsCmd(opts);
      } catch (err) {
        console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  cmd
    .command('view <taskId>')
    .description('Show task details, runs, and comments')
    .option('--json', 'Output as JSON')
    .action(async (taskId, opts) => {
      try {
        await viewCmd(taskId, opts);
      } catch (err) {
        console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  cmd
    .command('cancel <taskId>')
    .description('Cancel a task')
    .action(async (taskId) => {
      try {
        await cancelCmd(taskId);
      } catch (err) {
        console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  cmd
    .command('comment <taskId> <body>')
    .description('Add a comment to a task')
    .action(async (taskId, body) => {
      try {
        await commentCmd(taskId, body);
      } catch (err) {
        console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  return cmd;
}

export default createTaskCommand;
