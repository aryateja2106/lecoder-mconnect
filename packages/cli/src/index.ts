#!/usr/bin/env node

/**
 * MConnect CLI v0.1.2 - Multi-Agent Terminal Control
 *
 * Shell-first architecture: Spawn shells, then run commands inside them.
 * "Spin up multiple AI agents, go for a walk, and manage them from your phone"
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import { AGENT_PRESETS, getDefaultShell } from './agents/types.js';
import { getNodePtyError, isNodePtyAvailable, printDiagnostics, runDiagnostics } from './doctor.js';
import { startSession } from './session.js';

const program = new Command();

program
  .name('mconnect')
  .description('Control AI coding agents from your mobile device')
  .version('0.1.2');

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

async function runWizard(options: any): Promise<void> {
  console.clear();

  p.intro(chalk.bgCyan(chalk.black(' MConnect v0.1.2 ')));
  console.log(chalk.dim('  Multi-Agent Terminal Control\n'));

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

  // Get agents configuration
  let agents: any[] = [];

  if (preset === 'custom') {
    agents = await configureCustomAgents();
  } else {
    const presetConfig = AGENT_PRESETS.find((p) => p.name === preset);
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
    });
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

async function configureCustomAgents(): Promise<any[]> {
  const agents: any[] = [];

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
