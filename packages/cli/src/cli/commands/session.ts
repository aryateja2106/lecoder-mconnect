/**
 * Session Commands for MConnect v0.2.0
 *
 * CLI commands for session management
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createConnection } from 'node:net';
import { existsSync, writeFileSync } from 'node:fs';

function getDataDir(): string {
  return process.env.MCONNECT_DATA_DIR || join(homedir(), '.mconnect');
}

function getSocketPath(): string {
  return join(getDataDir(), 'daemon.sock');
}

interface IpcRequest {
  type: string;
  [key: string]: unknown;
}

interface IpcResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

async function sendIpcMessage(request: IpcRequest): Promise<IpcResponse> {
  const socketPath = getSocketPath();

  if (!existsSync(socketPath)) {
    throw new Error('Daemon not running. Start with: mconnect daemon start');
  }

  return new Promise((resolve, reject) => {
    const client = createConnection(socketPath);
    let data = '';

    client.on('connect', () => {
      client.write(JSON.stringify(request) + '\n');
    });

    client.on('data', (chunk) => {
      data += chunk.toString();
      if (data.includes('\n')) {
        try {
          const response = JSON.parse(data.trim());
          resolve(response);
        } catch {
          reject(new Error('Invalid response from daemon'));
        }
        client.end();
      }
    });

    client.on('error', (err) => {
      reject(new Error(`Failed to connect to daemon: ${err.message}`));
    });

    client.setTimeout(5000, () => {
      client.destroy();
      reject(new Error('Timeout connecting to daemon'));
    });
  });
}

async function listSessions(): Promise<void> {
  try {
    const response = await sendIpcMessage({ type: 'session_list' });

    if (!response.success) {
      console.error(chalk.red(`Error: ${response.error}`));
      process.exit(1);
    }

    const sessions = response.data as Array<{
      id: string;
      state: string;
      createdAt: number;
      lastActivity: number;
      workingDirectory: string;
      connectedClients: number;
    }>;

    if (sessions.length === 0) {
      console.log(chalk.yellow('No active sessions.'));
      console.log(chalk.dim('\nCreate a new session with: mconnect session create'));
      return;
    }

    console.log(chalk.bold('\nActive Sessions\n'));

    for (const session of sessions) {
      const created = new Date(session.createdAt).toLocaleString();
      const activity = new Date(session.lastActivity).toLocaleString();
      let stateColor = chalk.gray;
      if (session.state === 'running') {
        stateColor = chalk.green;
      } else if (session.state === 'paused') {
        stateColor = chalk.yellow;
      }

      const stateLabel = `[${session.state}]`;
      console.log(`${chalk.cyan(session.id)} ${stateColor(stateLabel)}`);
      console.log(chalk.dim(`  Directory: ${session.workingDirectory}`));
      console.log(chalk.dim(`  Created: ${created}`));
      console.log(chalk.dim(`  Last activity: ${activity}`));
      console.log(chalk.dim(`  Clients: ${session.connectedClients}`));
      console.log('');
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

async function createSession(options: { cwd?: string; preset?: string }): Promise<void> {
  try {
    const workingDirectory = options.cwd || process.cwd();

    const response = await sendIpcMessage({
      type: 'session_create',
      workingDirectory,
      agentConfig: {
        preset: options.preset || 'default',
        agents: ['shell'],
      },
    });

    if (!response.success) {
      console.error(chalk.red(`Error: ${response.error}`));
      process.exit(1);
    }

    const session = response.data as { id: string };
    console.log(chalk.green(`✓ Session created: ${session.id}`));
    console.log(chalk.dim(`\nAttach with: mconnect session attach ${session.id}`));
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

async function killSession(sessionId: string, options: { force?: boolean }): Promise<void> {
  try {
    const response = await sendIpcMessage({
      type: 'session_kill',
      sessionId,
      force: options.force,
    });

    if (!response.success) {
      console.error(chalk.red(`Error: ${response.error}`));
      process.exit(1);
    }

    console.log(chalk.green(`✓ Session ${sessionId} killed`));
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

async function exportSession(sessionId: string, options: { output?: string }): Promise<void> {
  try {
    let SessionStore: typeof import('../../session/SessionStore.js').SessionStore;
    try {
      ({ SessionStore } = await import('../../session/SessionStore.js'));
    } catch (error) {
      console.error(chalk.red('Error: Session export requires the optional database module.'));
      console.error(
        chalk.dim(
          'Install dependencies from the repo root with: npm install'
        )
      );
      console.error(chalk.dim(`Details: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }

    const dataDir = getDataDir();
    const store = new SessionStore({ dataDir });

    const session = store.getSession(sessionId);
    if (!session) {
      console.error(chalk.red(`Session not found: ${sessionId}`));
      process.exit(1);
    }

    // Get all scrollback
    const scrollbackCount = store.getScrollbackLineCount(sessionId);
    const scrollback = store.getLatestScrollback(sessionId, scrollbackCount);

    const exportData = {
      session: {
        id: session.id,
        createdAt: session.createdAt.toISOString(),
        lastActivity: session.lastActivity.toISOString(),
        state: session.state,
        workingDirectory: session.workingDirectory,
        agentConfig: session.agentConfig,
      },
      scrollback: scrollback.map((line) => ({
        lineNumber: line.lineNumber,
        content: line.content,
        timestamp: line.timestamp.toISOString(),
      })),
      exportedAt: new Date().toISOString(),
    };

    const output = options.output || `mconnect-session-${sessionId}.json`;

    if (output === '-') {
      console.log(JSON.stringify(exportData, null, 2));
    } else {
      writeFileSync(output, JSON.stringify(exportData, null, 2));
      console.log(chalk.green(`✓ Session exported to: ${output}`));
      console.log(chalk.dim(`  Lines: ${scrollback.length}`));
    }

    store.close();
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

export function createSessionCommand(): Command {
  const session = new Command('session')
    .description('Session management commands')
    .addHelpText('after', `
Examples:
  $ mconnect session list              List all sessions
  $ mconnect session create            Create a new session
  $ mconnect session attach abc123     Attach to session abc123
  $ mconnect session kill abc123       Kill session abc123
  $ mconnect session export abc123     Export session scrollback`);

  session
    .command('list')
    .alias('ls')
    .description('List all sessions')
    .action(listSessions);

  session
    .command('create')
    .description('Create a new session')
    .option('-c, --cwd <path>', 'Working directory for the session')
    .option('-p, --preset <name>', 'Agent preset to use', 'default')
    .action(createSession);

  session
    .command('kill <sessionId>')
    .description('Kill a session')
    .option('-f, --force', 'Force kill without graceful shutdown')
    .action(killSession);

  session
    .command('export <sessionId>')
    .description('Export session scrollback to file')
    .option('-o, --output <path>', 'Output file path (use - for stdout)')
    .action(exportSession);

  return session;
}

export default createSessionCommand;
