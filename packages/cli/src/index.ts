#!/usr/bin/env node

/**
 * MConnect CLI - Multi-Agent Terminal Control
 *
 * Shell-first architecture: Spawn shells, then run commands inside them.
 * "Spin up multiple AI agents, go for a walk, and manage them from your phone"
 */

// Load .env file BEFORE any other imports that may read process.env
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Simple .env loader (no external dependency needed)
function loadEnvFile(): void {
  // Check multiple locations: CWD, then package root
  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), 'packages', 'cli', '.env'),
  ];

  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          // Skip comments and empty lines
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx === -1) continue;
          const key = trimmed.slice(0, eqIdx).trim();
          const value = trimmed.slice(eqIdx + 1).trim();
          // Only set if not already defined (system env takes priority)
          if (key && !process.env[key]) {
            process.env[key] = value;
          }
        }
        break; // Use first found .env
      } catch {
        // Ignore read errors
      }
    }
  }
}

loadEnvFile();
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import { AGENT_PRESETS, type AgentConfig, getDefaultShell } from './agents/types.js';
import { createAttachCommand } from './cli/commands/attach.js';
import { createDaemonCommand } from './cli/commands/daemon.js';
import { createSessionCommand } from './cli/commands/session.js';
import { getContainerManager } from './container/index.js';
import { getNodePtyError, isNodePtyAvailable, printDiagnostics, runDiagnostics } from './doctor.js';
import { startSession } from './session.js';
import { VERSION, VERSION_DISPLAY } from './version.js';

const program = new Command();

program
  .name('mconnect')
  .description('Control AI coding agents from your mobile device')
  .version(VERSION);

// Add subcommand groups
program.addCommand(createDaemonCommand());

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
    'Agent preset (single, research-spec-test, dev-review, shell-only, container-dev)'
  )
  .option('-g, --guardrails <level>', 'Guardrails level (default, strict, permissive, none)')
  .option('--port <number>', 'Server port (default: 8765)')
  .option('--no-tmux', 'Disable tmux visualization')
  .option('-c, --code', 'Show pairing code (for dev/desktop use)')
  .option('--web-url <url>', 'Web app URL (e.g. http://localhost:3000)')
  .action(async (options) => {
    // Quick check for node-pty before starting wizard
    const ptyAvailable = await isNodePtyAvailable();
    if (!ptyAvailable) {
      const errorMsg = await getNodePtyError();
      console.log(chalk.red('\n  ✗ node-pty is not available\n'));

      // Show specific error if available
      if (errorMsg) {
        if (errorMsg.includes('Cannot find module')) {
          console.log(chalk.dim('  The module is not installed.\n'));
        } else if (errorMsg.includes('was compiled against a different')) {
          console.log(chalk.dim('  The module needs to be rebuilt for your Node.js version.\n'));
        } else {
          console.log(chalk.dim(`  Error: ${errorMsg.substring(0, 80)}\n`));
        }
      }

      console.log(chalk.bold('  To fix, run:\n'));
      console.log(chalk.cyan('    npm install && npm rebuild node-pty'));
      console.log(chalk.cyan('    npm run build\n'));
      console.log(chalk.dim('  Run "mconnect doctor" for full diagnostics.\n'));
      process.exit(1);
    }
    await runWizard(options);
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
  .action(() => {
    console.log(`\n${chalk.bold('Available Agent Presets:')}\n`);
    for (const preset of AGENT_PRESETS) {
      console.log(chalk.cyan(`  ${preset.name}`));
      console.log(chalk.dim(`    ${preset.description}`));
      console.log(chalk.dim(`    Agents: ${preset.agents.map((a) => a.name).join(', ')}`));
      console.log('');
    }
  });

interface WizardOptions {
  preset?: string;
  guardrails?: string;
  dir?: string;
  tmux?: boolean;
  port?: string;
  code?: boolean;
  webUrl?: string;
}

async function runWizard(options: WizardOptions): Promise<void> {
  console.clear();

  p.intro(chalk.bgCyan(chalk.black(` MConnect ${VERSION_DISPLAY} `)));
  console.log(chalk.dim('  Multi-Agent Terminal Control with Persistent Sessions\n'));

  // Agent preset selection
  const preset =
    options.preset ||
    (await p.select({
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
          value: 'container-dev',
          label: 'Container Dev (Docker)',
          hint: 'Isolated shell in Docker container',
        },
        {
          value: 'custom',
          label: 'Custom Setup',
          hint: 'Configure multiple shells manually',
        },
      ],
    }));

  if (p.isCancel(preset)) {
    p.cancel('Session cancelled.');
    process.exit(0);
  }

  // Check Docker availability for container preset
  let finalPreset = preset;
  if (preset === 'container-dev') {
    const containerManager = getContainerManager();
    const dockerStatus = await containerManager.checkDockerStatus();

    if (!dockerStatus.installed) {
      p.log.warn(
        chalk.yellow(
          'Docker is not installed. Container isolation requires Docker.\n' +
            'Install from: https://docker.com/products/docker-desktop'
        )
      );
      const fallback = await p.confirm({
        message: 'Continue with shell-only preset instead?',
        initialValue: true,
      });
      if (p.isCancel(fallback) || !fallback) {
        p.cancel('Session cancelled.');
        process.exit(0);
      }
      finalPreset = 'shell-only';
    } else if (!dockerStatus.running) {
      p.log.warn(
        chalk.yellow(
          'Docker daemon is not running. Please start Docker first.\n' +
            (process.platform === 'darwin'
              ? 'Start Docker Desktop application.'
              : 'Run: sudo systemctl start docker')
        )
      );
      const fallback = await p.confirm({
        message: 'Continue with shell-only preset instead?',
        initialValue: true,
      });
      if (p.isCancel(fallback) || !fallback) {
        p.cancel('Session cancelled.');
        process.exit(0);
      }
      finalPreset = 'shell-only';
    } else {
      p.log.info(
        chalk.green(`Docker ${dockerStatus.version || ''} detected - container isolation available`)
      );
    }
  }

  // Get agents configuration
  let agents: Omit<AgentConfig, 'cwd'>[] = [];

  if (finalPreset === 'custom') {
    agents = await configureCustomAgents();
  } else {
    const presetConfig = AGENT_PRESETS.find((p) => p.name === finalPreset);
    if (presetConfig) {
      agents = [...presetConfig.agents]; // Clone the array
    } else {
      // Default to shell-only if preset not found
      agents = [
        {
          type: 'shell',
          name: 'Shell',
          command: getDefaultShell(),
        },
      ];
    }
  }

  // Guardrails selection
  const guardrails =
    options.guardrails ||
    (await p.select({
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

  if (p.isCancel(guardrails)) {
    p.cancel('Session cancelled.');
    process.exit(0);
  }

  // Working directory
  const defaultDir = options.dir || process.cwd();
  const workDir = await p.text({
    message: 'Working directory:',
    initialValue: defaultDir,
    validate: (value) => {
      if (!existsSync(value)) {
        return 'Directory does not exist';
      }
      return undefined;
    },
  });

  if (p.isCancel(workDir)) {
    p.cancel('Session cancelled.');
    process.exit(0);
  }

  const finalDir = resolve(workDir as string);

  // Summary
  p.note(
    [
      `${chalk.bold('Agents:')} ${agents.map((a) => a.name).join(', ')}`,
      `${chalk.bold('Guardrails:')} ${guardrails}`,
      `${chalk.bold('Directory:')} ${finalDir}`,
      `${chalk.bold('Tmux:')} ${options.tmux === false ? 'Disabled' : 'Enabled'}`,
    ].join('\n'),
    'Session Configuration'
  );

  // Confirm
  const proceed = await p.confirm({
    message: 'Start session?',
    initialValue: true,
  });

  if (p.isCancel(proceed) || !proceed) {
    p.cancel('Session cancelled.');
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
    p.log.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function configureCustomAgents(): Promise<Omit<AgentConfig, 'cwd'>[]> {
  const agents: Omit<AgentConfig, 'cwd'>[] = [];

  const count = await p.text({
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

  if (p.isCancel(count)) {
    process.exit(0);
  }

  const agentCount = parseInt(count as string, 10);

  for (let i = 0; i < agentCount; i++) {
    p.log.step(`Configure Shell ${i + 1}`);

    const name = await p.text({
      message: `Shell ${i + 1} name:`,
      initialValue: i === 0 ? 'Main' : `Shell ${i + 1}`,
    });

    if (p.isCancel(name)) {
      process.exit(0);
    }

    agents.push({
      type: 'shell',
      name: name as string,
      command: getDefaultShell(),
    });
  }

  return agents;
}

program.parse();
