/**
 * Session Attach Command for MConnect v0.2.0
 *
 * Attaches to an existing session with PTY passthrough
 * Use Ctrl+D to detach without killing the session
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createConnection, type Socket } from 'node:net';
import { existsSync } from 'node:fs';
import * as readline from 'node:readline';

function getDataDir(): string {
  return process.env.MCONNECT_DATA_DIR || join(homedir(), '.mconnect');
}

function getSocketPath(): string {
  return join(getDataDir(), 'daemon.sock');
}

interface AttachMessage {
  type: 'output' | 'session_state' | 'error' | 'attached' | 'detached';
  data?: string;
  state?: string;
  message?: string;
  sessionId?: string;
}

async function attachToSession(sessionId: string): Promise<void> {
  const socketPath = getSocketPath();

  if (!existsSync(socketPath)) {
    console.error(chalk.red('Error: Daemon not running. Start with: mconnect daemon start'));
    process.exit(1);
  }

  return new Promise((resolve, reject) => {
    const client: Socket = createConnection(socketPath);
    let attached = false;

    // Setup raw mode for input passthrough
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    // Handle Ctrl+D (EOF) for detach
    let ctrlDPressed = false;

    console.log(chalk.dim(`Attaching to session ${sessionId}...`));
    console.log(chalk.dim('Press Ctrl+D to detach\n'));

    client.on('connect', () => {
      // Send attach request
      client.write(
        JSON.stringify({
          type: 'session_attach',
          sessionId,
          clientId: `cli-${process.pid}`,
          clientType: 'pc',
        }) + '\n'
      );
    });

    client.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const message: AttachMessage = JSON.parse(line);

          switch (message.type) {
            case 'attached':
              attached = true;
              break;

            case 'output':
              if (message.data) {
                process.stdout.write(message.data);
              }
              break;

            case 'session_state':
              if (message.state === 'completed') {
                console.log(chalk.yellow('\nSession completed.'));
                cleanup();
                resolve();
              }
              break;

            case 'error':
              console.error(chalk.red(`\nError: ${message.message}`));
              cleanup();
              reject(new Error(message.message));
              break;

            case 'detached':
              console.log(chalk.dim('\nDetached from session.'));
              cleanup();
              resolve();
              break;
          }
        } catch {
          // Not JSON, might be raw output
          process.stdout.write(line);
        }
      }
    });

    // Forward input to session
    process.stdin.on('data', (data) => {
      if (!attached) return;

      const buf = Buffer.from(data);

      // Check for Ctrl+D (ASCII 4)
      if (buf.length === 1 && buf[0] === 4) {
        if (ctrlDPressed) {
          // Second Ctrl+D - detach
          console.log(chalk.dim('\nDetaching...'));
          client.write(
            JSON.stringify({
              type: 'session_detach',
            }) + '\n'
          );
        } else {
          // First Ctrl+D - show hint
          ctrlDPressed = true;
          process.stdout.write('\r\n[Press Ctrl+D again to detach]\r\n');
          setTimeout(() => {
            ctrlDPressed = false;
          }, 2000);
        }
        return;
      }

      // Reset Ctrl+D state on other input
      ctrlDPressed = false;

      // Forward input to session
      client.write(
        JSON.stringify({
          type: 'terminal_input',
          data: data.toString(),
        }) + '\n'
      );
    });

    client.on('error', (err) => {
      console.error(chalk.red(`\nConnection error: ${err.message}`));
      cleanup();
      reject(err);
    });

    client.on('close', () => {
      cleanup();
      resolve();
    });

    // Handle terminal resize
    process.stdout.on('resize', () => {
      if (!attached) return;

      const { columns, rows } = process.stdout;
      client.write(
        JSON.stringify({
          type: 'resize',
          cols: columns,
          rows: rows,
        }) + '\n'
      );
    });

    // Cleanup function
    function cleanup() {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      client.end();
    }

    // Handle process signals
    process.on('SIGINT', () => {
      // Forward Ctrl+C to session instead of exiting
      if (attached) {
        client.write(
          JSON.stringify({
            type: 'terminal_input',
            data: '\x03', // Ctrl+C
          }) + '\n'
        );
      }
    });

    process.on('SIGTERM', () => {
      cleanup();
      resolve();
    });
  });
}

export function createAttachCommand(): Command {
  return new Command('attach')
    .description('Attach to an existing session')
    .argument('<sessionId>', 'Session ID to attach to')
    .addHelpText('after', `
Examples:
  $ mconnect session attach abc123     Attach to session abc123

Controls:
  Ctrl+D    Detach from session (press twice)
  Ctrl+C    Send interrupt to session (doesn't detach)`)
    .action(async (sessionId: string) => {
      try {
        await attachToSession(sessionId);
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}

export default createAttachCommand;
