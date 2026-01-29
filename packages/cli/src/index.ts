#!/usr/bin/env node

/**
 * MConnect CLI v0.2.1 - Multi-Agent Terminal Control
 *
 * Shell-first architecture: Spawn shells, then run commands inside them.
 * "Spin up multiple AI agents, go for a walk, and manage them from your phone"
 *
 * v0.2.0: Persistent sessions with daemon architecture and dual-input mode
 *
 * HEADLESS MODE (for non-TTY environments like Claude Code):
 * When running in a non-TTY environment or with --headless flag,
 * the CLI skips interactive prompts and uses command-line arguments.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { AGENT_PRESETS, getDefaultShell } from './agents/types.js';
import { createAttachCommand } from './cli/commands/attach.js';
import { createDaemonCommand } from './cli/commands/daemon.js';
import { createSessionCommand } from './cli/commands/session.js';
import { createSidecarCommand } from './cli/commands/sidecar.js';
import { getNodePtyError, isNodePtyAvailable, printDiagnostics, runDiagnostics } from './doctor.js';
import { startSession, startSessionHeadless } from './session.js';

/**
 * Detect if we're running in a TTY environment
 * Returns false in Claude Code's Bash tool, CI/CD pipelines, etc.
 */
function isTTY(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Safe console output that works in non-TTY environments
 */
function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info'): void {
  const prefix = {
    info: '[INFO]',
    success: '[OK]',
    error: '[ERROR]',
    warn: '[WARN]',
  };
  console.log(`${prefix[type]} ${message}`);
}

// Lazy-load @clack/prompts only when in TTY mode
// This prevents the TTY initialization error in non-TTY environments
let p: typeof import('@clack/prompts') | null = null;
let chalk: typeof import('chalk').default | null = null;

async function loadInteractiveModules(): Promise<void> {
  if (!p) {
    p = await import('@clack/prompts');
  }
  if (!chalk) {
    chalk = (await import('chalk')).default;
  }
}

const program = new Command();

program
  .name('mconnect')
  .description('Control AI coding agents from your mobile device')
  .version('0.2.0');

// Add subcommand groups
program.addCommand(createDaemonCommand());
program.addCommand(createSidecarCommand());

// Add session commands
const sessionCmd = createSessionCommand();
sessionCmd.addCommand(createAttachCommand());
program.addCommand(sessionCmd);

program
  .command('start', { isDefault: true })
  .description('Start a new MConnect session')
  .option('-d, --dir <directory>', 'Working directory')
  .option(
    '-p, --preset <name>',
    'Agent preset (single, research-spec-test, dev-review, shell-only)'
  )
  .option('-g, --guardrails <level>', 'Guardrails level (default, strict, permissive, none)')
  .option('--port <number>', 'Server port (default: 8765)')
  .option('--no-tmux', 'Disable tmux visualization')
  .option('-c, --code', 'Show pairing code (for dev/desktop use)')
  .option('--web-url <url>', 'Web app URL (e.g. http://localhost:3000)')
  .option('--headless', 'Run without interactive prompts (for non-TTY environments)')
  .option('--json', 'Output session info as JSON (implies --headless)')
  .option('--background', 'Run session in background and exit (implies --headless)')
  .action(async (options) => {
    // Determine if we should run in headless mode
    const forceHeadless = options.headless || options.json || options.background || !isTTY();

    // Quick check for node-pty before starting
    const ptyAvailable = await isNodePtyAvailable();
    if (!ptyAvailable) {
      const errorMsg = await getNodePtyError();

      if (forceHeadless) {
        // Headless mode: simple text output
        log('node-pty is not available', 'error');
        if (errorMsg) {
          log(errorMsg.substring(0, 100), 'info');
        }
        log('Run: npm install && npm rebuild node-pty', 'info');
        if (options.json) {
          console.log(
            JSON.stringify({ error: 'node-pty not available', details: errorMsg }, null, 2)
          );
        }
        process.exit(1);
      } else {
        // Interactive mode: use chalk
        await loadInteractiveModules();
        console.log(chalk!.red('\n  ✗ node-pty is not available\n'));

        if (errorMsg) {
          if (errorMsg.includes('Cannot find module')) {
            console.log(chalk!.dim('  The module is not installed.\n'));
          } else if (errorMsg.includes('was compiled against a different')) {
            console.log(chalk!.dim('  The module needs to be rebuilt for your Node.js version.\n'));
          } else {
            console.log(chalk!.dim(`  Error: ${errorMsg.substring(0, 80)}\n`));
          }
        }

        console.log(chalk!.bold('  To fix, run:\n'));
        console.log(chalk!.cyan('    npm install && npm rebuild node-pty'));
        console.log(chalk!.cyan('    npm run build\n'));
        console.log(chalk!.dim('  Run "mconnect doctor" for full diagnostics.\n'));
        process.exit(1);
      }
    }

    if (forceHeadless) {
      await runHeadless(options);
    } else {
      await runWizard(options);
    }
  });

program
  .command('doctor')
  .description('Run system diagnostics')
  .action(async () => {
    const results = await runDiagnostics();
    printDiagnostics(results);
  });

program
  .command('presets')
  .description('List available agent presets')
  .action(async () => {
    await loadInteractiveModules();
    console.log(`\n${chalk!.bold('Available Agent Presets:')}\n`);
    for (const preset of AGENT_PRESETS) {
      console.log(chalk!.cyan(`  ${preset.name}`));
      console.log(chalk!.dim(`    ${preset.description}`));
      console.log(chalk!.dim(`    Agents: ${preset.agents.map((a) => a.name).join(', ')}`));
      console.log('');
    }
  });

/**
 * Run MConnect in headless mode (no interactive prompts)
 * This mode works in non-TTY environments like Claude Code's Bash tool
 */
async function runHeadless(options: any): Promise<void> {
  log('MConnect v0.2.0 - Headless Mode', 'info');

  // Validate required options for headless mode
  const preset = options.preset || 'shell-only';
  const guardrails = options.guardrails || 'default';
  const workDir = resolve(options.dir || process.cwd());

  // Validate preset
  const validPresets = ['single', 'research-spec-test', 'dev-review', 'shell-only'];
  if (!validPresets.includes(preset)) {
    log(`Invalid preset: ${preset}. Valid: ${validPresets.join(', ')}`, 'error');
    if (options.json) {
      console.log(JSON.stringify({ error: 'Invalid preset', valid: validPresets }, null, 2));
    }
    process.exit(1);
  }

  // Validate directory
  if (!existsSync(workDir)) {
    log(`Directory does not exist: ${workDir}`, 'error');
    if (options.json) {
      console.log(JSON.stringify({ error: 'Directory not found', path: workDir }, null, 2));
    }
    process.exit(1);
  }

  // Get agents from preset
  const presetConfig = AGENT_PRESETS.find((p) => p.name === preset);
  const agents = presetConfig
    ? [...presetConfig.agents]
    : [{ type: 'shell' as const, name: 'Shell', command: getDefaultShell() }];

  log(`Preset: ${preset}`, 'info');
  log(`Guardrails: ${guardrails}`, 'info');
  log(`Directory: ${workDir}`, 'info');
  log(`Agents: ${agents.map((a) => a.name).join(', ')}`, 'info');

  // Start the session in headless mode
  try {
    await startSessionHeadless({
      workDir,
      guardrails,
      agents,
      enableTmux: options.tmux !== false,
      port: options.port ? parseInt(options.port, 10) : undefined,
      showPairingCode: true, // Always show in headless mode for connection
      webUrl: options.webUrl,
      jsonOutput: options.json === true,
      background: options.background === true,
    });
  } catch (error) {
    log(error instanceof Error ? error.message : 'Unknown error', 'error');
    if (options.json) {
      console.log(JSON.stringify({ error: 'Session failed', message: String(error) }, null, 2));
    }
    process.exit(1);
  }
}

async function runWizard(options: any): Promise<void> {
  // Load interactive modules (this would fail in non-TTY, but we've already checked)
  await loadInteractiveModules();

  console.clear();

  p!.intro(chalk!.bgCyan(chalk!.black(' MConnect v0.2.0 ')));
  console.log(chalk!.dim('  Multi-Agent Terminal Control with Persistent Sessions\n'));

  // Agent preset selection
  const preset =
    options.preset ||
    (await p!.select({
      message: 'Select agent configuration',
      options: [
        {
          value: 'shell-only',
          label: 'Shell Session',
          hint: 'Single interactive shell (recommended to start)',
        },
        {
          value: 'single',
          label: 'Single Agent (Claude)',
          hint: 'Shell that runs Claude Code',
        },
        {
          value: 'research-spec-test',
          label: 'Research + Spec + Tests',
          hint: '3 shells for parallel ideation',
        },
        {
          value: 'dev-review',
          label: 'Dev + Reviewer',
          hint: '2 shells for development workflow',
        },
        {
          value: 'custom',
          label: 'Custom Setup',
          hint: 'Configure multiple shells manually',
        },
      ],
    }));

  if (p!.isCancel(preset)) {
    p!.cancel('Session cancelled.');
    process.exit(0);
  }

  // Get agents configuration
  let agents: any[] = [];

  if (preset === 'custom') {
    agents = await configureCustomAgents();
  } else {
    const presetConfig = AGENT_PRESETS.find((pr) => pr.name === preset);
    if (presetConfig) {
      agents = [...presetConfig.agents]; // Clone the array
    } else {
      // Default to shell-only if preset not found
      agents = [
        {
          type: 'shell' as const,
          name: 'Shell',
          command: getDefaultShell(),
        },
      ];
    }
  }

  // Guardrails selection
  const guardrails =
    options.guardrails ||
    (await p!.select({
      message: 'Configure guardrails',
      options: [
        {
          value: 'default',
          label: 'Default',
          hint: 'Block dangerous commands, approve risky ones',
        },
        {
          value: 'strict',
          label: 'Strict',
          hint: 'Require approval for most operations',
        },
        {
          value: 'permissive',
          label: 'Permissive',
          hint: 'Only block critical operations',
        },
        {
          value: 'none',
          label: 'None',
          hint: 'No restrictions (use with caution)',
        },
      ],
    }));

  if (p!.isCancel(guardrails)) {
    p!.cancel('Session cancelled.');
    process.exit(0);
  }

  // Working directory
  const defaultDir = options.dir || process.cwd();
  const workDir = await p!.text({
    message: 'Working directory:',
    initialValue: defaultDir,
    validate: (value) => {
      if (!existsSync(value)) {
        return 'Directory does not exist';
      }
      return undefined;
    },
  });

  if (p!.isCancel(workDir)) {
    p!.cancel('Session cancelled.');
    process.exit(0);
  }

  const finalDir = resolve(workDir as string);

  // Summary
  p!.note(
    [
      `${chalk!.bold('Agents:')} ${agents.map((a) => a.name).join(', ')}`,
      `${chalk!.bold('Guardrails:')} ${guardrails}`,
      `${chalk!.bold('Directory:')} ${finalDir}`,
      `${chalk!.bold('Tmux:')} ${options.tmux === false ? 'Disabled' : 'Enabled'}`,
    ].join('\n'),
    'Session Configuration'
  );

  // Confirm
  const proceed = await p!.confirm({
    message: 'Start session?',
    initialValue: true,
  });

  if (p!.isCancel(proceed) || !proceed) {
    p!.cancel('Session cancelled.');
    process.exit(0);
  }

  // Start session
  try {
    await startSession({
      workDir: finalDir,
      guardrails: guardrails as string,
      agents,
      enableTmux: options.tmux !== false,
      port: options.port ? parseInt(options.port, 10) : undefined,
      showPairingCode: options.code === true,
      webUrl: options.webUrl,
    });
  } catch (error) {
    p!.log.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function configureCustomAgents(): Promise<any[]> {
  const agents: any[] = [];

  const count = await p!.text({
    message: 'How many shells/agents?',
    initialValue: '2',
    validate: (value) => {
      const num = parseInt(value, 10);
      if (Number.isNaN(num) || num < 1 || num > 5) {
        return 'Enter a number between 1 and 5';
      }
      return undefined;
    },
  });

  if (p!.isCancel(count)) {
    process.exit(0);
  }

  const agentCount = parseInt(count as string, 10);

  for (let i = 0; i < agentCount; i++) {
    p!.log.step(`Configure Shell ${i + 1}`);

    const name = await p!.text({
      message: `Shell ${i + 1} name:`,
      initialValue: i === 0 ? 'Main' : `Shell ${i + 1}`,
    });

    if (p!.isCancel(name)) {
      process.exit(0);
    }

    agents.push({
      type: 'shell' as const,
      name: name as string,
      command: getDefaultShell(),
    });
  }

  return agents;
}

program.parse();
