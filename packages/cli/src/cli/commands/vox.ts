/**
 * Vox CLI Command — Natural Language to Shell
 * MConnect vox integration
 *
 * Subcommand: mconnect vox [query]
 *   One-shot:  mconnect vox "find large files"
 *   REPL:      mconnect vox
 *   History:   mconnect vox history [--json]
 *
 * Follows the createDaemonCommand() factory pattern from daemon.ts.
 */

import { type ExecSyncOptions, execSync } from 'node:child_process';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import { isDangerous, looksLikeShell } from '../../vox/danger.js';
import { VoxFeedbackStore } from '../../vox/feedback-store.js';
import { DEFAULT_API_URL, DEFAULT_MODEL, OllamaClient } from '../../vox/ollama.js';

// ============================================================
// Helpers
// ============================================================

function printOllamaHelp(model: string, apiUrl: string): void {
  console.log(chalk.yellow('\n  Ollama is not running or the model is not available.\n'));
  console.log(chalk.dim('  To start Ollama:'));
  console.log(chalk.cyan('    ollama serve'));
  console.log('');
  console.log(chalk.dim(`  To pull the default model (${model}):`));
  console.log(chalk.cyan(`    ollama pull ${model}`));
  console.log('');
  console.log(chalk.dim('  Install Ollama from: https://ollama.ai'));
  console.log(chalk.dim(`  API URL configured: ${apiUrl}\n`));
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString();
}

/**
 * Execute a shell command and return the exit code.
 * Returns -1 if execution throws unexpectedly.
 */
function runCommand(cmd: string): number {
  const opts: ExecSyncOptions = { stdio: 'inherit', shell: '/bin/sh' };
  try {
    execSync(cmd, opts);
    return 0;
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'status' in err) {
      return (err as { status: number }).status ?? 1;
    }
    return 1;
  }
}

// ============================================================
// Core flow: translate → confirm → act
// ============================================================

interface HandleQueryOptions {
  client: OllamaClient;
  store: VoxFeedbackStore;
  model: string;
  autoExecute: boolean;
}

/**
 * Translate a query, display the suggestion, prompt the user, log feedback.
 * Returns false if we should exit the REPL (e.g. user cancelled).
 */
async function handleQuery(query: string, opts: HandleQueryOptions): Promise<boolean> {
  const { client, store, model, autoExecute } = opts;

  console.log('');
  const spinner = p.spinner();
  spinner.start('Translating...');

  const start = Date.now();
  const cmd = await client.translate(query);
  const latencyMs = Date.now() - start;

  if (!cmd) {
    spinner.stop(chalk.red('No command returned'));
    store.log({
      query,
      suggestedCommand: '',
      userAction: 'error',
      wasDangerous: false,
      model,
      latencyMs,
    });
    return true;
  }

  const dangerous = isDangerous(cmd);
  const shell = looksLikeShell(cmd);

  spinner.stop('');

  if (!shell) {
    console.log(chalk.yellow('  Warning: response does not look like a shell command.\n'));
  }

  // Display the suggested command
  console.log(chalk.dim('  Suggested command:'));
  console.log(`  ${chalk.cyan(cmd)}`);

  if (dangerous) {
    console.log(chalk.yellow('\n  Warning: this command looks destructive. Review carefully.'));
  }

  console.log('');

  // Auto-execute safe commands if --execute flag is set
  if (autoExecute && !dangerous) {
    console.log(chalk.dim('  Auto-executing (--execute flag set)...'));
    const exitCode = runCommand(cmd);
    store.log({
      query,
      suggestedCommand: cmd,
      userAction: 'run',
      wasDangerous: dangerous,
      model,
      latencyMs,
      exitCode,
    });
    return true;
  }

  // Interactive prompt
  const action = await p.select({
    message: 'What would you like to do?',
    options: [
      { value: 'run', label: 'Run it' },
      { value: 'edit', label: 'Edit then run' },
      { value: 'copy', label: 'Copy to clipboard' },
      { value: 'skip', label: 'Skip' },
    ],
  });

  if (p.isCancel(action)) {
    store.log({
      query,
      suggestedCommand: cmd,
      userAction: 'skip',
      wasDangerous: dangerous,
      model,
      latencyMs,
    });
    return false;
  }

  if (action === 'run') {
    console.log('');
    const exitCode = runCommand(cmd);
    store.log({
      query,
      suggestedCommand: cmd,
      userAction: 'run',
      wasDangerous: dangerous,
      model,
      latencyMs,
      exitCode,
    });
    console.log('');
    return true;
  }

  if (action === 'edit') {
    const edited = await p.text({
      message: 'Edit command:',
      initialValue: cmd,
    });

    if (p.isCancel(edited)) {
      store.log({
        query,
        suggestedCommand: cmd,
        userAction: 'skip',
        wasDangerous: dangerous,
        model,
        latencyMs,
      });
      return false;
    }

    const finalCmd = edited as string;
    console.log('');
    const exitCode = runCommand(finalCmd);
    store.log({
      query,
      suggestedCommand: cmd,
      userAction: 'run',
      editedCommand: finalCmd,
      wasDangerous: dangerous,
      model,
      latencyMs,
      exitCode,
    });
    console.log('');
    return true;
  }

  if (action === 'copy') {
    try {
      if (process.platform === 'darwin') {
        execSync(`echo ${JSON.stringify(cmd)} | pbcopy`, { stdio: 'pipe' });
      } else if (process.platform === 'linux') {
        execSync(`echo ${JSON.stringify(cmd)} | xclip -selection clipboard`, { stdio: 'pipe' });
      } else {
        console.log(chalk.dim('  Clipboard not supported on this platform.'));
      }
      console.log(chalk.green('  Copied to clipboard.'));
    } catch {
      console.log(chalk.dim('  Failed to copy to clipboard.'));
    }
    store.log({
      query,
      suggestedCommand: cmd,
      userAction: 'copy',
      wasDangerous: dangerous,
      model,
      latencyMs,
    });
    console.log('');
    return true;
  }

  // skip
  store.log({
    query,
    suggestedCommand: cmd,
    userAction: 'skip',
    wasDangerous: dangerous,
    model,
    latencyMs,
  });
  return true;
}

// ============================================================
// Command factory
// ============================================================

export function createVoxCommand(): Command {
  const vox = new Command('vox').description(
    'Translate natural language into shell commands via Ollama'
  );

  // --------------------------------------------------------
  // vox history
  // --------------------------------------------------------
  vox
    .command('history')
    .description('Show recent vox interactions')
    .option('-n, --limit <count>', 'Number of entries to show', '20')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const store = new VoxFeedbackStore();
      try {
        const limit = parseInt(options.limit, 10);
        const rows = store.getHistory(Number.isNaN(limit) ? 20 : limit);

        if (options.json) {
          console.log(JSON.stringify(rows, null, 2));
          return;
        }

        if (rows.length === 0) {
          console.log(chalk.dim('\n  No vox history yet.\n'));
          return;
        }

        console.log(`\n${chalk.bold('Vox History')}\n`);
        for (const row of rows) {
          const actionColor =
            row.user_action === 'run'
              ? chalk.green
              : row.user_action === 'skip'
                ? chalk.dim
                : row.user_action === 'error'
                  ? chalk.red
                  : chalk.blue;

          console.log(
            `  ${chalk.dim(formatTimestamp(row.created_at))}  ${actionColor(row.user_action.padEnd(4))}`
          );
          console.log(`    ${chalk.dim('Query:')} ${row.query}`);
          console.log(`    ${chalk.dim('Cmd:')}   ${chalk.cyan(row.suggested_command)}`);
          if (row.edited_command) {
            console.log(`    ${chalk.dim('Edited:')} ${chalk.cyan(row.edited_command)}`);
          }
          if (row.was_dangerous) {
            console.log(`    ${chalk.yellow('! Dangerous')}`);
          }
          console.log('');
        }

        const stats = store.getStats();
        console.log(
          chalk.dim(
            `  Total: ${stats.total}  Run rate: ${(stats.runRate * 100).toFixed(0)}%  Dangerous: ${stats.dangerousCount}\n`
          )
        );
      } finally {
        store.close();
      }
    });

  // --------------------------------------------------------
  // Default action: one-shot or REPL
  // --------------------------------------------------------
  vox
    .argument('[query]', 'Natural language query (omit for REPL mode)')
    .option('--model <name>', 'Ollama model to use', DEFAULT_MODEL)
    .option('--api <url>', 'Ollama API base URL', DEFAULT_API_URL)
    .option(
      '--execute',
      'Auto-run safe commands without confirmation'
    )
    .action(async (query: string | undefined, options) => {
      const model: string = options.model as string;
      const apiUrl: string = options.api as string;
      const autoExecute: boolean = !!options.execute;

      const client = new OllamaClient({ model, apiUrl });
      const store = new VoxFeedbackStore();

      try {
        // Check Ollama availability first
        const status = await client.check();

        if (status === 'no_ollama') {
          printOllamaHelp(model, apiUrl);
          process.exit(1);
        }

        if (status === 'no_model') {
          console.log(
            chalk.yellow(`\n  Model '${model}' not found in Ollama.\n`)
          );
          console.log(chalk.dim('  Pull it with:'));
          console.log(chalk.cyan(`    ollama pull ${model}\n`));
          process.exit(1);
        }

        const handleOpts: HandleQueryOptions = {
          client,
          store,
          model,
          autoExecute,
        };

        // ---- One-shot mode ----
        if (query) {
          await handleQuery(query, handleOpts);
          return;
        }

        // ---- REPL mode ----
        console.log('');
        p.intro(chalk.bgCyan(chalk.black(' Vox — NL to Shell ')));
        console.log(chalk.dim(`  Model: ${model}  |  Type your request, or Ctrl+C to exit.\n`));

        while (true) {
          const input = await p.text({
            message: 'What do you want to do?',
            placeholder: 'e.g. find all .ts files modified today',
          });

          if (p.isCancel(input)) {
            p.outro(chalk.dim('Goodbye.'));
            break;
          }

          const trimmed = (input as string).trim();
          if (!trimmed) continue;

          const shouldContinue = await handleQuery(trimmed, handleOpts);
          if (!shouldContinue) {
            p.outro(chalk.dim('Goodbye.'));
            break;
          }
        }
      } finally {
        store.close();
      }
    });

  return vox;
}
