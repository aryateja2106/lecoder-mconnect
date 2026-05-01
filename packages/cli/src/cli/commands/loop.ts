/**
 * `mconnect loop` command group.
 *
 * Disler-style infinite agentic loop for Cursor:
 *
 *   mconnect loop install [-d <dir>]
 *   mconnect loop start <spec> <output_dir> <count> [--mode spec|task]
 *   mconnect loop status
 *   mconnect loop stop [--pause]
 *   mconnect loop list
 *   mconnect loop tail [-n <lines>]
 *
 * The `start` subcommand prints a kickoff prompt to stdout. The user
 * pastes that prompt into Cursor's agent chat to begin the loop. After
 * each turn, Cursor's `stop` hook (registered by `loop install`) calls
 * `mconnect hook cursor stop`, which decides whether to continue and
 * emits a `followup_message` for Cursor to auto-continue with.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import { buildKickoffPrompt } from '../../loop/orchestrator.js';
import { resolveSpecPath } from '../../loop/spec.js';
import {
  archiveActiveLoop,
  generateLoopId,
  getLoopPaths,
  type LoopMode,
  type LoopState,
  listArchivedLoops,
  readActiveLoop,
  updateActiveLoop,
  writeActiveLoop,
} from '../../loop/state.js';
import { EXAMPLE_SPEC_MD, LOOP_RULES_MDC } from '../../loop/templates/inline-templates.js';

/**
 * The single bin name used in `.cursor/hooks.json` entries we write.
 *
 * Both `lecoder-mconnect` and `mconnect` are registered as bins, but
 * `lecoder-mconnect` is the namespaced one less likely to collide with
 * a user's own `mconnect` script.
 */
const HOOK_BIN = 'lecoder-mconnect';

/**
 * `.cursor/hooks.json` schema we read and (carefully) merge into.
 */
interface CursorHooksFile {
  version?: number;
  hooks?: {
    preToolUse?: Array<{ command: string; matcher?: string }>;
    postToolUse?: Array<{ command: string; matcher?: string }>;
    stop?: Array<{ command: string; matcher?: string }>;
    afterAgentResponse?: Array<{ command: string; matcher?: string }>;
    [key: string]: Array<{ command: string; matcher?: string }> | undefined;
  };
}

/**
 * Parse `--target` argument: a positive integer or the literal "infinite".
 */
function parseTarget(raw: string): number | 'infinite' {
  if (raw === 'infinite' || raw === 'inf' || raw === '-1') return 'infinite';
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n <= 0) {
    throw new Error(`Invalid count "${raw}". Expected a positive integer or "infinite".`);
  }
  return n;
}

/**
 * Resolve a path argument against the CLI's working dir, allowing both
 * relative and absolute inputs.
 */
function resolvePath(p: string, base: string): string {
  return isAbsolute(p) ? p : resolve(base, p);
}

/**
 * Merge a single hook entry into a list, idempotently (no duplicates).
 */
function mergeHookEntry(
  list: Array<{ command: string; matcher?: string }> | undefined,
  command: string
): Array<{ command: string; matcher?: string }> {
  const arr = list ? [...list] : [];
  if (!arr.some((e) => e.command === command)) arr.push({ command });
  return arr;
}

/**
 * Write or merge `.cursor/hooks.json` adding our hook entries while
 * preserving any existing entries (e.g. context-mode's hooks).
 */
function installCursorHooksFile(projectDir: string): {
  path: string;
  added: string[];
  existing: string[];
} {
  const cursorDir = join(projectDir, '.cursor');
  if (!existsSync(cursorDir)) mkdirSync(cursorDir, { recursive: true });
  const hooksPath = join(cursorDir, 'hooks.json');

  let current: CursorHooksFile = { version: 1, hooks: {} };
  if (existsSync(hooksPath)) {
    try {
      const raw = readFileSync(hooksPath, 'utf-8');
      const parsed = JSON.parse(raw) as CursorHooksFile;
      if (parsed && typeof parsed === 'object') current = parsed;
    } catch {
      // Corrupt — back up and start fresh
      const backup = `${hooksPath}.bak.${Date.now()}`;
      writeFileSync(backup, readFileSync(hooksPath, 'utf-8'), 'utf-8');
      current = { version: 1, hooks: {} };
    }
  }

  current.version = current.version ?? 1;
  current.hooks = current.hooks ?? {};

  const stopCmd = `${HOOK_BIN} hook cursor stop`;
  const preCmd = `${HOOK_BIN} hook cursor pretooluse`;
  const postCmd = `${HOOK_BIN} hook cursor posttooluse`;

  const added: string[] = [];
  const existing: string[] = [];

  for (const [key, cmd] of [
    ['stop', stopCmd] as const,
    ['preToolUse', preCmd] as const,
    ['postToolUse', postCmd] as const,
  ]) {
    const before = current.hooks[key];
    const after = mergeHookEntry(before, cmd);
    current.hooks[key] = after;
    if (!before || !before.some((e) => e.command === cmd)) added.push(`${key}: ${cmd}`);
    else existing.push(`${key}: ${cmd}`);
  }

  writeFileSync(hooksPath, `${JSON.stringify(current, null, 2)}\n`, 'utf-8');
  return { path: hooksPath, added, existing };
}

/**
 * Write `.cursor/rules/lecoder-loop.mdc` so the agent has the loop
 * protocol available. We never overwrite a user-edited rules file.
 */
function installRulesFile(projectDir: string): { path: string; status: 'created' | 'exists' } {
  const rulesDir = join(projectDir, '.cursor', 'rules');
  if (!existsSync(rulesDir)) mkdirSync(rulesDir, { recursive: true });
  const rulesPath = join(rulesDir, 'lecoder-loop.mdc');
  if (existsSync(rulesPath)) {
    return { path: rulesPath, status: 'exists' };
  }
  writeFileSync(rulesPath, LOOP_RULES_MDC, 'utf-8');
  return { path: rulesPath, status: 'created' };
}

/**
 * Write a starter spec file alongside the rules so users have a
 * working example to invoke the loop against.
 */
function installExampleSpec(projectDir: string): { path: string; status: 'created' | 'exists' } {
  const specDir = join(projectDir, 'specs');
  if (!existsSync(specDir)) mkdirSync(specDir, { recursive: true });
  const specPath = join(specDir, 'lecoder-loop-example.md');
  if (existsSync(specPath)) {
    return { path: specPath, status: 'exists' };
  }
  writeFileSync(specPath, EXAMPLE_SPEC_MD, 'utf-8');
  return { path: specPath, status: 'created' };
}

/**
 * Try to read the most recent MConnect session for the cwd, so loops
 * started from inside an active session can POST progress back.
 */
function readMConnectInfo(workDir: string): { url: string; token: string } | null {
  try {
    const sessionFile = join(workDir, '.mconnect.json');
    if (!existsSync(sessionFile)) return null;
    const data = JSON.parse(readFileSync(sessionFile, 'utf-8')) as {
      url?: string;
      token?: string;
    };
    if (data.url && data.token) return { url: data.url, token: data.token };
  } catch {
    // ignore
  }
  return null;
}

export function createLoopCommand(): Command {
  const loop = new Command('loop').description(
    'Cursor infinite agentic loop (Disler-style spec/output/count, stop-hook driven)'
  );

  loop
    .command('install')
    .description("Install Cursor hooks and rules into the project's .cursor/ directory")
    .option('-d, --dir <directory>', 'Project root', process.cwd())
    .option('--no-example', 'Do not write specs/lecoder-loop-example.md')
    .action((options) => {
      const projectDir = resolve(options.dir as string);
      if (!existsSync(projectDir)) {
        console.error(chalk.red(`\n  Project directory does not exist: ${projectDir}\n`));
        process.exit(1);
      }

      console.log('');
      console.log(chalk.bold('Installing lecoder-loop into:'), chalk.cyan(projectDir));
      console.log('');

      const hooks = installCursorHooksFile(projectDir);
      console.log(chalk.green('  ✓'), `Hooks file:`, chalk.dim(hooks.path));
      for (const a of hooks.added) console.log(chalk.green('     +'), a);
      for (const e of hooks.existing) console.log(chalk.dim('     ='), `${e} (already present)`);

      const rules = installRulesFile(projectDir);
      console.log(
        chalk.green(`  ${rules.status === 'created' ? '✓' : '='}`),
        `Rules file:`,
        chalk.dim(rules.path),
        rules.status === 'exists' ? chalk.dim('(unchanged — edit by hand to override)') : ''
      );

      if (options.example !== false) {
        const example = installExampleSpec(projectDir);
        console.log(
          chalk.green(`  ${example.status === 'created' ? '✓' : '='}`),
          `Example spec:`,
          chalk.dim(example.path)
        );
      }

      console.log('');
      console.log(chalk.bold('Next:'));
      console.log(
        '  1.',
        chalk.cyan(`mconnect loop start specs/lecoder-loop-example.md src 5`),
        chalk.dim('  # generate 5 iterations')
      );
      console.log('  2. Paste the printed kickoff prompt into Cursor.');
      console.log('  3. Cursor will auto-continue until the loop completes.');
      console.log('');
      console.log(
        chalk.dim('Notes:'),
        '\n  - The hooks file is merged additively. Existing entries (e.g. context-mode) are preserved.',
        '\n  - Restart Cursor after install so it picks up the new hooks.',
        '\n  - Run',
        chalk.cyan('mconnect loop status'),
        'in another terminal to watch progress.\n'
      );
    });

  loop
    .command('start <spec> <output_dir> <count>')
    .description('Start a Disler-style loop. Prints the kickoff prompt for Cursor.')
    .option('-m, --mode <mode>', 'spec (Disler-style files) or task (single long task)', 'spec')
    .option('-d, --dir <directory>', 'Working directory', process.cwd())
    .option('--mconnect-url <url>', 'POST iteration events to this MConnect /api/hooks URL')
    .option('--mconnect-token <token>', 'Bearer token for --mconnect-url')
    .action((spec, outputDir, count, options) => {
      const workDir = resolve(options.dir as string);
      if (!existsSync(workDir)) {
        console.error(chalk.red(`\n  Working dir does not exist: ${workDir}\n`));
        process.exit(1);
      }

      const mode = options.mode as LoopMode;
      if (mode !== 'spec' && mode !== 'task') {
        console.error(chalk.red(`\n  Invalid mode "${mode}". Expected "spec" or "task".\n`));
        process.exit(1);
      }

      let target: number | 'infinite';
      try {
        target = parseTarget(count as string);
      } catch (err) {
        console.error(chalk.red(`\n  ${err instanceof Error ? err.message : 'Invalid count'}\n`));
        process.exit(1);
        return;
      }

      const specPath = resolvePath(spec as string, workDir);
      const outputAbs = resolvePath(outputDir as string, workDir);

      // Spec mode: spec file must exist. Task mode: brief file optional but recommended.
      if (mode === 'spec' && !existsSync(specPath)) {
        console.error(
          chalk.red(`\n  Spec file not found: ${specPath}`),
          chalk.dim(`\n  (resolved from "${spec}")\n`)
        );
        process.exit(1);
      }

      // Output dir is created if missing so the agent can write into it.
      if (!existsSync(outputAbs)) mkdirSync(outputAbs, { recursive: true });

      // Refuse to start a second loop while one is active.
      const existing = readActiveLoop();
      if (existing && existing.status === 'active') {
        console.error(
          chalk.red(
            `\n  A loop is already active (${existing.id}, ${existing.completed}/${existing.target}).`
          ),
          chalk.dim(`\n  Run \`mconnect loop stop\` first.\n`)
        );
        process.exit(1);
      }

      const id = generateLoopId();
      const mconnectInfo =
        options.mconnectUrl && options.mconnectToken
          ? { url: options.mconnectUrl as string, token: options.mconnectToken as string }
          : readMConnectInfo(workDir);

      const state: LoopState = {
        id,
        mode,
        status: 'active',
        specPath,
        outputDir: outputAbs,
        target,
        completed: 0,
        lastIterationAt: null,
        createdAt: new Date().toISOString(),
        workDir,
        kickoffPrompt: '', // filled below
        historyTail: [],
        mconnect: mconnectInfo,
        lastError: null,
      };
      state.kickoffPrompt = buildKickoffPrompt(state);
      writeActiveLoop(state);

      const targetDisplay = target === 'infinite' ? 'infinite' : `${target}`;
      console.log('');
      console.log(chalk.bgCyan(chalk.black(' lecoder-loop ')), chalk.bold(`${id} started`));
      console.log(chalk.dim(`  mode=${mode}  target=${targetDisplay}  spec=${specPath}`));
      console.log(chalk.dim(`  output=${outputAbs}`));
      console.log('');
      console.log(chalk.bold('  → Paste this prompt into Cursor agent chat:'));
      console.log('');
      console.log(chalk.cyan('  --- 8< ---'));
      for (const line of state.kickoffPrompt.split('\n')) {
        console.log(`  ${line}`);
      }
      console.log(chalk.cyan('  --- >8 ---'));
      console.log('');
      console.log(
        chalk.dim('  After Cursor ends each turn, the stop hook will continue the loop.'),
        '\n ',
        chalk.dim('Run'),
        chalk.cyan('mconnect loop status'),
        chalk.dim('to watch.\n')
      );
    });

  loop
    .command('status')
    .description('Show the active loop and recent iterations')
    .option('--json', 'Print as JSON')
    .action((options) => {
      const state = readActiveLoop();
      if (!state) {
        if (options.json) {
          console.log(JSON.stringify({ active: false }));
          return;
        }
        console.log(chalk.dim('\n  No active loop.\n'));
        return;
      }

      if (options.json) {
        console.log(JSON.stringify({ active: true, ...state }, null, 2));
        return;
      }

      const targetDisplay = state.target === 'infinite' ? 'infinite' : `${state.target}`;
      console.log('');
      console.log(chalk.bgCyan(chalk.black(' lecoder-loop ')), chalk.bold(state.id));
      console.log(`  ${chalk.bold('Status:')}     ${state.status}`);
      console.log(`  ${chalk.bold('Mode:')}       ${state.mode}`);
      console.log(`  ${chalk.bold('Progress:')}   ${state.completed} / ${targetDisplay}`);
      console.log(`  ${chalk.bold('Spec:')}       ${state.specPath}`);
      console.log(`  ${chalk.bold('Output:')}     ${state.outputDir}`);
      console.log(
        `  ${chalk.bold('Last turn:')}  ${state.lastIterationAt || chalk.dim('(none yet)')}`
      );
      if (state.lastError) {
        console.log(`  ${chalk.bold('Error:')}      ${chalk.red(state.lastError)}`);
      }
      if (state.historyTail.length > 0) {
        console.log(`  ${chalk.bold('Recent:')}`);
        for (const entry of state.historyTail) {
          console.log(`    - ${entry}`);
        }
      }
      const { activeFile, promptFile } = getLoopPaths();
      console.log('');
      console.log(chalk.dim(`  state: ${activeFile}`));
      console.log(chalk.dim(`  current prompt: ${promptFile}`));
      console.log('');
    });

  loop
    .command('stop')
    .description('Stop or pause the active loop')
    .option('--pause', 'Mark as paused (keeps state file) rather than archiving')
    .action((options) => {
      const state = readActiveLoop();
      if (!state) {
        console.log(chalk.dim('\n  No active loop to stop.\n'));
        return;
      }
      if (options.pause) {
        const updated = updateActiveLoop((s) => ({ ...s, status: 'paused' }));
        console.log('');
        console.log(chalk.yellow('  Loop paused.'), chalk.dim(`(id=${updated?.id})`));
        console.log(
          chalk.dim('  The next stop hook will see status=paused and emit an empty followup.\n')
        );
        return;
      }
      const archived = archiveActiveLoop('done');
      console.log('');
      console.log(chalk.green('  Loop stopped.'), chalk.dim(`(id=${archived?.id})`));
      console.log(chalk.dim('  Future stop hooks will be no-ops until a new loop is started.\n'));
    });

  loop
    .command('list')
    .description('List archived loops')
    .option('--json', 'Print as JSON')
    .action((options) => {
      const loops = listArchivedLoops();
      if (options.json) {
        console.log(JSON.stringify(loops, null, 2));
        return;
      }
      if (loops.length === 0) {
        console.log(chalk.dim('\n  No archived loops.\n'));
        return;
      }
      console.log('');
      for (const l of loops) {
        const targetDisplay = l.target === 'infinite' ? 'infinite' : `${l.target}`;
        console.log(
          `  ${chalk.bold(l.id)}  ${chalk.dim(l.createdAt)}  ${l.status}  ${l.completed}/${targetDisplay}  ${chalk.dim(l.specPath)}`
        );
      }
      console.log('');
    });

  loop
    .command('tail')
    .description('Tail the most recent iteration prompt the agent received')
    .option('-n, --lines <n>', 'Last N lines', '40')
    .action((options) => {
      const { promptFile } = getLoopPaths();
      if (!existsSync(promptFile)) {
        console.log(chalk.dim('\n  No prompt snapshot yet.\n'));
        return;
      }
      const body = readFileSync(promptFile, 'utf-8');
      const lines = body.split('\n');
      const n = Math.max(1, Number.parseInt(options.lines as string, 10) || 40);
      const tail = lines.slice(-n);
      console.log(`\n${tail.join('\n')}\n`);
    });

  return loop;
}

/**
 * Helper used by `loop install --mconnect` flag (future): write a tiny
 * `.mconnect.json` pointer so other tools can find the active session URL.
 *
 * Currently unused but kept here so the surface area is in one file.
 */
export function writeMConnectPointer(
  projectDir: string,
  info: { url: string; token: string }
): void {
  const file = join(projectDir, '.mconnect.json');
  writeFileSync(file, `${JSON.stringify(info, null, 2)}\n`, 'utf-8');
}

/**
 * Resolve path relative to homedir for tests that override LECODER_LOOP_DIR.
 */
export function _testHomedir(): string {
  return homedir();
}

/**
 * Test seam: re-export helpers for unit tests.
 */
export const _testInternals = {
  parseTarget,
  installCursorHooksFile,
  installRulesFile,
  installExampleSpec,
  resolveSpecPath,
  dirname,
};
