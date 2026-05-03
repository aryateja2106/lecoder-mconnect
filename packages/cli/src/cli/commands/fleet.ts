/**
 * `lecoder fleet` — fleet view CLI
 *
 * Read-mostly client around the hub's /fleet endpoints. Auth uses the same
 * env vars as HubClient so users only configure things once:
 *   LECODER_HUB_URL    — base URL of the hub
 *   LECODER_HUB_TOKEN  — Bearer token (optional)
 *
 * Subcommands:
 *   lecoder fleet ls                 — list registered runtimes
 *   lecoder fleet info <runtime-id>  — show one runtime + queue depth
 *   lecoder fleet send <runtime-id> "title" [--body ...] [--provider claude]
 *   lecoder fleet attach <runtime-id> — opens the existing attach flow
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { VERSION } from '../../version.js';

interface FleetRuntime {
  id: string;
  name: string;
  hostname: string;
  platform: string;
  arch: string;
  user: string;
  version: string;
  status: 'online' | 'stale' | 'offline';
  registeredAt: number;
  lastHeartbeatAt: number;
}

interface FleetListResponse {
  runtimes: FleetRuntime[];
}

interface FleetGetResponse {
  runtime: FleetRuntime;
  queueDepth: number;
}

interface FleetTaskResponse {
  taskId: string;
  queueDepth: number;
}

function getHubConfig(): { url: string; token?: string } {
  const url = process.env.LECODER_HUB_URL;
  if (!url) {
    console.error(chalk.red('  Hub URL not set. export LECODER_HUB_URL=https://hub.example.com'));
    process.exit(1);
  }
  return {
    url: url.replace(/\/$/, ''),
    token: process.env.LECODER_HUB_TOKEN,
  };
}

async function hubFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, token } = getHubConfig();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': `lecoder-mconnect/${VERSION}`,
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${url}${path}`, { ...init, headers });
  if (!response.ok) {
    let body = '';
    try {
      body = await response.text();
    } catch {
      /* ignore */
    }
    throw new Error(`Hub ${response.status} ${response.statusText}: ${body}`);
  }
  if (response.status === 204) return undefined as unknown as T;
  return (await response.json()) as T;
}

function formatRelative(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusBadge(status: FleetRuntime['status']): string {
  switch (status) {
    case 'online':
      return chalk.green('●') + chalk.green(' online');
    case 'stale':
      return chalk.yellow('●') + chalk.yellow(' stale');
    case 'offline':
      return chalk.red('●') + chalk.red(' offline');
  }
}

function printRuntime(runtime: FleetRuntime, queueDepth?: number): void {
  console.log('');
  console.log(`  ${chalk.bold(runtime.name)} ${chalk.dim(`(${runtime.id.slice(0, 12)})`)}`);
  console.log(`    ${statusBadge(runtime.status)}    last heartbeat ${formatRelative(runtime.lastHeartbeatAt)}`);
  console.log(`    ${chalk.dim('host:')}    ${runtime.hostname} (${runtime.user}@${runtime.platform}/${runtime.arch})`);
  console.log(`    ${chalk.dim('version:')} lecoder-mconnect ${runtime.version}`);
  if (queueDepth !== undefined) {
    console.log(`    ${chalk.dim('tasks:')}   ${queueDepth} queued`);
  }
}

async function listCmd(opts: { json?: boolean }): Promise<void> {
  const data = await hubFetch<FleetListResponse>('/fleet');
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (data.runtimes.length === 0) {
    console.log(chalk.yellow('\n  No runtimes registered.'));
    console.log(chalk.dim('  Start a daemon with `LECODER_HUB_URL=... lecoder daemon start`.\n'));
    return;
  }
  console.log(`\n${chalk.bold('Registered runtimes:')}`);
  for (const r of data.runtimes) {
    printRuntime(r);
  }
  console.log('');
}

async function infoCmd(runtimeId: string, opts: { json?: boolean }): Promise<void> {
  const data = await hubFetch<FleetGetResponse>(`/fleet/${runtimeId}`);
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  printRuntime(data.runtime, data.queueDepth);
  console.log('');
}

async function sendCmd(
  runtimeId: string,
  title: string,
  opts: { body?: string; provider?: string; cwd?: string; json?: boolean }
): Promise<void> {
  const payload = {
    title,
    body: opts.body,
    provider: opts.provider,
    workingDirectory: opts.cwd,
  };
  const data = await hubFetch<FleetTaskResponse>(`/fleet/${runtimeId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  console.log('');
  console.log(`  ${chalk.green('✓')} task ${chalk.bold(data.taskId)} queued`);
  console.log(`    ${chalk.dim(`runtime ${runtimeId} now has ${data.queueDepth} task(s) queued`)}`);
  console.log('');
}

export function createFleetCommand(): Command {
  const fleet = new Command('fleet').description('View and dispatch tasks to LeSearch fleet runtimes').addHelpText(
    'after',
    `
Examples:
  $ lecoder fleet ls                          List registered runtimes
  $ lecoder fleet info abc-123                Show runtime details
  $ lecoder fleet send abc-123 "fix tests"    Queue a task for that runtime
  $ lecoder fleet send abc-123 "fix tests" --provider claude --cwd /repo

Required env: LECODER_HUB_URL  (LECODER_HUB_TOKEN optional)`
  );

  fleet
    .command('ls')
    .alias('list')
    .description('List all runtimes registered with the hub')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        await listCmd(opts);
      } catch (err) {
        console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  fleet
    .command('info <runtimeId>')
    .description('Show details for a single runtime')
    .option('--json', 'Output as JSON')
    .action(async (runtimeId, opts) => {
      try {
        await infoCmd(runtimeId, opts);
      } catch (err) {
        console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  fleet
    .command('send <runtimeId> <title>')
    .description('Queue a task for a runtime')
    .option('-b, --body <body>', 'Long-form task description')
    .option('-p, --provider <provider>', 'Provider hint (claude, codex, gemini, ...)')
    .option('-c, --cwd <path>', 'Working directory hint')
    .option('--json', 'Output as JSON')
    .action(async (runtimeId, title, opts) => {
      try {
        await sendCmd(runtimeId, title, opts);
      } catch (err) {
        console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  return fleet;
}

export default createFleetCommand;
