/**
 * `mconnect agent` command group.
 *
 * Programmable Cursor SDK agent for use from terminals, scripts, and
 * other coding agents. Agent-friendly by design:
 *
 *   - Every input expressible as a flag (no interactive prompts).
 *   - Layered `--help`: `mconnect agent --help`, then per-subcommand.
 *   - Every `--help` includes copy-pasteable Examples.
 *   - Reads stdin: `cat brief.md | mconnect agent run --task -`.
 *   - Idempotent IDs: re-running `mconnect agent run --resume <id>` is safe.
 *   - `--dry-run` previews the worktree plan without invoking the SDK.
 *   - Structured success output: ids, paths, durations.
 *
 *   subcommands
 *     run        Send a one-shot prompt to a SDK agent (with worktree isolation).
 *     ls         List active and recent sessions.
 *     show       Show transcript / metadata of a session.
 *     cancel     Mark a session as cancelled (no-op on next stop hook).
 *     rm         Remove a session and (optionally) its worktree.
 *     worktree   Manage per-session git worktrees (create/list/remove).
 *     context    Print a paste-ready context block summarising a session.
 *     doctor     Sanity check: API key, git, SDK reachability.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import {
  type AgentEvent,
  type AgentSessionRecord,
  appendTranscript,
  createWorktree,
  type ExecutionMode,
  ensureSafeInPlaceRun,
  formatDuration,
  generateSessionId,
  inspectGitContext,
  listSessions,
  listWorktrees,
  probeCursorSdk,
  readSession,
  removeSession,
  removeWorktree,
  SDKRunner,
  type WorktreeBranchStrategy,
  writeSession,
} from '../../agent-cli/index.js';

/**
 * Resolve a CLI path argument: support both absolute paths and paths
 * relative to the user's cwd.
 */
function resolvePath(p: string, base: string): string {
  return isAbsolute(p) ? p : resolve(base, p);
}

/**
 * Read prompt text from `--task` / positional arg / stdin.
 *
 *   --task "do thing"     → the literal string
 *   --task path/to/brief  → file contents
 *   --task -              → stdin
 *   no flag, positional   → the positional arg
 *   no positional, stdin  → stdin (when piped)
 */
async function resolveTaskBody(
  arg: string | undefined,
  positional: string | undefined,
  workDir: string
): Promise<string> {
  // Highest priority: explicit --task.
  if (arg) {
    if (arg === '-') {
      const fromStdin = await readStdin();
      if (!fromStdin.trim()) {
        throw new Error('No prompt provided on stdin (--task -).');
      }
      return fromStdin.trim();
    }
    // Allow file paths as a convenience.
    const maybePath = resolvePath(arg, workDir);
    if (existsSync(maybePath)) {
      const stat = readFileSync(maybePath, 'utf-8').trim();
      if (stat) return stat;
    }
    return arg.trim();
  }
  if (positional) return positional.trim();
  if (!process.stdin.isTTY) {
    const fromStdin = await readStdin();
    if (fromStdin.trim()) return fromStdin.trim();
  }
  throw new Error(
    [
      'No task provided.',
      'Pass one of:',
      '  mconnect agent run --task "your task"',
      '  mconnect agent run --task path/to/brief.md',
      '  mconnect agent run --task -      # read from stdin',
      '  echo "your task" | mconnect agent run',
    ].join('\n')
  );
}

function readStdin(): Promise<string> {
  return new Promise((resolveP) => {
    if (process.stdin.isTTY) {
      resolveP('');
      return;
    }
    const chunks: Buffer[] = [];
    process.stdin.on('data', (c: Buffer) => chunks.push(c));
    process.stdin.on('end', () => resolveP(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', () => resolveP(''));
    setTimeout(() => resolveP(Buffer.concat(chunks).toString('utf-8')), 5000).unref();
  });
}

function getApiKeyOrFail(explicit?: string): string {
  const key = explicit || process.env.CURSOR_API_KEY;
  if (!key) {
    throw new Error(
      [
        'CURSOR_API_KEY is not set.',
        '  export CURSOR_API_KEY="crsr_..."',
        'Get a key at https://cursor.com/settings/integrations.',
        'Or pass --api-key <key>.',
      ].join('\n')
    );
  }
  return key;
}

function shortDate(iso: string): string {
  return iso.replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

/**
 * Parse a --model-param flag value like `thinking=high` or `temperature=0.2`.
 */
function parseModelParam(raw: string): { id: string; value: string } {
  const idx = raw.indexOf('=');
  if (idx === -1) {
    throw new Error(`--model-param expects key=value, got "${raw}"`);
  }
  return { id: raw.slice(0, idx).trim(), value: raw.slice(idx + 1).trim() };
}

export function createAgentCommand(): Command {
  const agent = new Command('agent').description(
    'Programmable Cursor SDK agent (run, ls, cancel, worktree)'
  );

  agent.addHelpText(
    'after',
    `
Examples:
  mconnect agent run --task "fix the failing test in src/foo.ts"
  mconnect agent run --task brief.md --branch new
  cat plan.md | mconnect agent run --no-worktree
  mconnect agent run --resume sess_abc123 --task "now write the tests"
  mconnect agent ls
  mconnect agent show sess_abc123
  mconnect agent cancel sess_abc123
  mconnect agent doctor

Environment:
  CURSOR_API_KEY     Required. Cursor SDK key (https://cursor.com/settings/integrations).
  CURSOR_MODEL       Default model id. Defaults to "composer-2".
  LECODER_AGENT_DIR  Override session storage location (default: ~/.lecoder/agent).

Files:
  ~/.lecoder/agent/sessions/<id>.json   Per-session metadata + transcript tail.
  <repo>/.lecoder/worktrees/<id>/       Per-session git worktree (when in a repo).
`
  );

  // ──────────────────────────────────────────────────────────────────
  // mconnect agent run
  // ──────────────────────────────────────────────────────────────────
  const runCmd = agent
    .command('run')
    .description('Send a prompt to a Cursor SDK agent in an isolated workspace')
    .argument('[prompt]', 'Inline prompt (alternative to --task)')
    .option('-t, --task <task>', 'Task. String, "@file" path, or "-" for stdin.')
    .option('-d, --dir <path>', 'Workspace directory', process.cwd())
    .option('-n, --name <name>', 'Friendly session name (defaults to first 40 chars of task)')
    .option('-m, --model <id>', 'Model id (defaults to CURSOR_MODEL or composer-2)')
    .option(
      '--model-param <key=value>',
      'Repeatable. Pass model parameter, e.g. --model-param thinking=high',
      (val: string, prev: Array<{ id: string; value: string }> = []) => [
        ...prev,
        parseModelParam(val),
      ],
      [] as Array<{ id: string; value: string }>
    )
    .option('-x, --execution <mode>', 'local | cloud (defaults to local)', 'local')
    .option('--api-key <key>', 'Cursor API key (overrides CURSOR_API_KEY)')
    .option('--branch <strategy>', 'Worktree branch: new (default) | reuse | detach', 'new')
    .option('--branch-name <name>', 'Override branch name (only with --branch new)')
    .option('--base-ref <ref>', 'Base ref for the new branch (default: HEAD)')
    .option('--no-worktree', 'Run in --dir directly without creating a worktree')
    .option(
      '--allow-dirty',
      'Allow --no-worktree even when the working tree has uncommitted changes'
    )
    .option('--resume <id>', 'Resume an existing session (reuses its worktree + tags)')
    .option('--tag <tag>', 'Repeatable. Attach a tag to the session.', collectTags, [] as string[])
    .option('--force', 'Pass local: { force: true } to clear a stuck local run')
    .option('--json', 'Emit machine-readable JSON to stdout (events + final result)')
    .option('--dry-run', 'Show the plan (worktree, session id, prompt) without invoking the SDK')
    .action(async (positionalPrompt, options) => {
      const workDir = resolve(options.dir as string);
      if (!existsSync(workDir)) {
        console.error(chalk.red(`Error: directory does not exist: ${workDir}`));
        process.exit(1);
      }

      // ── Resolve prompt ────────────────────────────────────────────
      let promptBody: string;
      try {
        promptBody = await resolveTaskBody(
          options.task as string | undefined,
          positionalPrompt as string | undefined,
          workDir
        );
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
        return;
      }

      // ── Resume or create session ──────────────────────────────────
      let session: AgentSessionRecord;
      if (options.resume) {
        const existing = readSession(options.resume as string);
        if (!existing) {
          console.error(
            chalk.red(`Error: no session with id ${options.resume}.`),
            chalk.dim('\n  Run `mconnect agent ls` to see available sessions.')
          );
          process.exit(1);
          return;
        }
        session = existing;
      } else {
        const id = generateSessionId();
        const now = new Date().toISOString();
        session = {
          id,
          name:
            (options.name as string) || promptBody.slice(0, 40).replace(/\s+/g, ' ').trim() || id,
          cwd: workDir,
          worktreePath: null,
          worktreeBranch: null,
          repoRoot: null,
          executionMode: (options.execution as ExecutionMode) ?? 'local',
          modelId: (options.model as string) || process.env.CURSOR_MODEL || 'composer-2',
          modelParams:
            (options.modelParam as Array<{ id: string; value: string }>)?.length > 0
              ? (options.modelParam as Array<{ id: string; value: string }>)
              : null,
          status: 'pending',
          createdAt: now,
          lastActivityAt: now,
          promptCount: 0,
          lastError: null,
          transcript: [],
          tags: [...((options.tag as string[]) ?? [])],
        };

        // ── Worktree planning ───────────────────────────────────────
        if (options.worktree !== false) {
          const ctx = inspectGitContext(workDir);
          if (ctx.inRepo && ctx.repoRoot) {
            session.repoRoot = ctx.repoRoot;
            const strategy = options.branch as WorktreeBranchStrategy;
            if (!options.dryRun) {
              try {
                const wt = createWorktree({
                  repoRoot: ctx.repoRoot,
                  sessionId: id,
                  strategy,
                  branchName: options.branchName as string | undefined,
                  baseRef: options.baseRef as string | undefined,
                });
                session.worktreePath = wt.path;
                session.worktreeBranch = wt.branch;
              } catch (err) {
                console.error(
                  chalk.red(`Error creating worktree: ${err instanceof Error ? err.message : err}`)
                );
                process.exit(1);
                return;
              }
            } else {
              session.worktreePath = join(ctx.repoRoot, '.lecoder', 'worktrees', id);
              session.worktreeBranch =
                strategy === 'new'
                  ? (options.branchName as string) || `agent/${id}`
                  : strategy === 'reuse'
                    ? ctx.branch || 'HEAD'
                    : `(detached at ${(options.baseRef as string) || 'HEAD'})`;
            }
          } else {
            console.error(
              chalk.yellow(
                `[warn] ${workDir} is not a git repository — running without worktree isolation.`
              )
            );
          }
        } else {
          // --no-worktree path: bail out if dirty unless --allow-dirty
          try {
            ensureSafeInPlaceRun(workDir, Boolean(options.allowDirty));
          } catch (err) {
            console.error(chalk.red(err instanceof Error ? err.message : String(err)));
            process.exit(1);
            return;
          }
        }
      }

      // ── Resolve final working dir for the SDK ─────────────────────
      const sdkCwd = session.worktreePath ?? session.cwd;

      if (options.dryRun) {
        const plan = {
          dryRun: true,
          sessionId: session.id,
          name: session.name,
          executionMode: session.executionMode,
          modelId: session.modelId,
          modelParams: session.modelParams,
          cwd: session.cwd,
          repoRoot: session.repoRoot,
          worktreePath: session.worktreePath,
          worktreeBranch: session.worktreeBranch,
          sdkCwd,
          tags: session.tags,
          promptPreview:
            promptBody.length > 200 ? `${promptBody.slice(0, 200)}…[truncated]` : promptBody,
        };
        if (options.json) {
          console.log(JSON.stringify(plan, null, 2));
        } else {
          console.log(chalk.bgCyan(chalk.black(' dry-run ')), chalk.bold(session.id));
          console.log(`  ${chalk.bold('Workspace:')}   ${sdkCwd}`);
          console.log(`  ${chalk.bold('Branch:')}      ${session.worktreeBranch || '(none)'}`);
          console.log(`  ${chalk.bold('Model:')}       ${session.modelId}`);
          console.log(`  ${chalk.bold('Execution:')}   ${session.executionMode}`);
          if (session.tags.length)
            console.log(`  ${chalk.bold('Tags:')}        ${session.tags.join(', ')}`);
          console.log(`  ${chalk.bold('Prompt:')}      ${plan.promptPreview}`);
          console.log('');
          console.log(chalk.dim('Re-run without --dry-run to execute.'));
        }
        return;
      }

      // ── Persist initial state ─────────────────────────────────────
      session = appendTranscript(session, { role: 'prompt', text: promptBody });
      session = { ...session, status: 'running', promptCount: session.promptCount + 1 };
      writeSession(session);

      // ── Run the SDK ───────────────────────────────────────────────
      let apiKey: string;
      try {
        apiKey = getApiKeyOrFail(options.apiKey as string | undefined);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        // Mark failed
        writeSession({ ...session, status: 'failed', lastError: 'CURSOR_API_KEY not set' });
        process.exit(1);
        return;
      }

      const runner = new SDKRunner({
        apiKey,
        cwd: sdkCwd,
        executionMode: session.executionMode,
        model: { id: session.modelId, params: session.modelParams ?? undefined },
        force: Boolean(options.force),
        agentName: `mconnect agent ${session.id}`,
      });

      // ── Render events ─────────────────────────────────────────────
      const responseLines: string[] = [];
      const onEvent = (event: AgentEvent) => {
        if (options.json) {
          process.stdout.write(`${JSON.stringify(event)}\n`);
        } else {
          renderHumanEvent(event, (text) => responseLines.push(text));
        }
      };

      try {
        const result = await runner.sendPrompt(promptBody, onEvent);
        const responseText = responseLines
          .join('')
          .trim()
          .slice(0, 8 * 1024);
        session = appendTranscript(session, { role: 'response', text: responseText });
        session = appendTranscript(session, {
          role: 'system',
          text: `result status=${result.status}${
            result.durationMs ? ` duration=${formatDuration(result.durationMs)}` : ''
          }`,
        });
        session = {
          ...session,
          status: result.status === 'FINISHED' ? 'idle' : 'failed',
          lastActivityAt: new Date().toISOString(),
          lastError: result.status === 'FINISHED' ? null : `Run ended with status=${result.status}`,
        };
        writeSession(session);
        // Final structured success line for agents to parse.
        if (!options.json) {
          console.log('');
          console.log(
            chalk.green('✓'),
            chalk.bold(session.id),
            chalk.dim(
              `(status=${result.status}${
                result.durationMs ? ` duration=${formatDuration(result.durationMs)}` : ''
              }${session.worktreePath ? ` worktree=${session.worktreePath}` : ''})`
            )
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        session = appendTranscript(session, { role: 'system', text: `error: ${message}` });
        session = {
          ...session,
          status: 'failed',
          lastError: message,
          lastActivityAt: new Date().toISOString(),
        };
        writeSession(session);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      } finally {
        await runner.dispose();
      }
    });

  runCmd.addHelpText(
    'after',
    `
Examples:
  # 1. One-shot prompt in a fresh worktree on branch agent/<id>:
  mconnect agent run --task "fix the failing test in src/foo.ts"

  # 2. Read brief from a markdown file:
  mconnect agent run --task brief.md --branch new --branch-name agent/refactor-auth

  # 3. Pipe prompt from stdin:
  echo "Add JSDoc to every public function in src/utils/" | mconnect agent run

  # 4. Continue a previous session:
  mconnect agent run --resume sess_abc123 --task "now write tests for the new function"

  # 5. Run in current directory without worktree (dirty trees rejected unless --allow-dirty):
  mconnect agent run --no-worktree --task "explain this codebase"

  # 6. Cloud execution (requires GitHub remote):
  mconnect agent run --execution cloud --task "open a PR adding a /health endpoint"

  # 7. Choose a different model + thinking depth:
  mconnect agent run --model composer-2 --model-param thinking=high --task "refactor X"

  # 8. Preview the plan without invoking the SDK:
  mconnect agent run --dry-run --task "do thing"

  # 9. JSON event stream (for chaining into other agents):
  mconnect agent run --task "do thing" --json | jq 'select(.type=="result")'

Notes:
  --branch new (default) creates a fresh branch off HEAD; the agent only ever
  touches files in the worktree directory. Inspect with:
    cd .lecoder/worktrees/<id> && git diff main
  Then merge or discard from your normal repo. Use \`mconnect agent worktree remove <id>\`
  to clean up.
`
  );

  // ──────────────────────────────────────────────────────────────────
  // mconnect agent ls
  // ──────────────────────────────────────────────────────────────────
  const lsCmd = agent
    .command('ls')
    .description('List agent sessions (most recent first)')
    .option('--json', 'Print as JSON')
    .option('--tag <tag>', 'Filter by tag')
    .option('--all', 'Include finished/failed sessions')
    .action((options) => {
      const sessions = listSessions({ tag: options.tag as string | undefined });
      const filtered = options.all
        ? sessions
        : sessions.filter(
            (s) => s.status === 'pending' || s.status === 'running' || s.status === 'idle'
          );

      if (options.json) {
        console.log(JSON.stringify(filtered, null, 2));
        return;
      }
      if (filtered.length === 0) {
        console.log(chalk.dim('\n  No sessions found.\n'));
        return;
      }
      console.log('');
      console.log(
        chalk.bold(
          '  ID              STATUS    PROMPTS  LAST ACTIVITY              MODEL              NAME'
        )
      );
      for (const s of filtered) {
        const idCol = s.id.padEnd(15);
        const statusCol = s.status.padEnd(9);
        const promptsCol = String(s.promptCount).padStart(7);
        const dateCol = shortDate(s.lastActivityAt).padEnd(26);
        const modelCol = s.modelId.padEnd(18);
        const nameCol = s.name.length > 40 ? `${s.name.slice(0, 37)}…` : s.name;
        console.log(`  ${idCol} ${statusCol} ${promptsCol}  ${dateCol} ${modelCol} ${nameCol}`);
      }
      console.log('');
    });

  lsCmd.addHelpText(
    'after',
    `
Examples:
  mconnect agent ls                          # active sessions only
  mconnect agent ls --all                     # include finished/failed
  mconnect agent ls --tag loop:loop_abc123    # find sessions tagged for a loop
  mconnect agent ls --json | jq '.[].id'      # extract ids for scripting
`
  );

  // ──────────────────────────────────────────────────────────────────
  // mconnect agent show
  // ──────────────────────────────────────────────────────────────────
  const showCmd = agent
    .command('show <id>')
    .description('Show transcript and metadata for a session')
    .option('--json', 'Print as JSON')
    .option('-n, --tail <n>', 'Show only the last N transcript entries', '10')
    .action((id, options) => {
      const session = readSession(id as string);
      if (!session) {
        console.error(chalk.red(`No session with id ${id}.`));
        process.exit(1);
        return;
      }
      if (options.json) {
        console.log(JSON.stringify(session, null, 2));
        return;
      }
      const tail = Math.max(1, Number.parseInt(options.tail as string, 10) || 10);
      console.log('');
      console.log(chalk.bgCyan(chalk.black(` ${session.id} `)), chalk.bold(session.name));
      console.log(`  ${chalk.bold('Status:')}      ${session.status}`);
      console.log(`  ${chalk.bold('Model:')}       ${session.modelId}`);
      console.log(`  ${chalk.bold('Execution:')}   ${session.executionMode}`);
      console.log(`  ${chalk.bold('Workspace:')}   ${session.cwd}`);
      if (session.worktreePath) {
        console.log(
          `  ${chalk.bold('Worktree:')}    ${session.worktreePath} (${session.worktreeBranch || 'unknown branch'})`
        );
      }
      if (session.tags.length)
        console.log(`  ${chalk.bold('Tags:')}        ${session.tags.join(', ')}`);
      console.log(`  ${chalk.bold('Created:')}     ${shortDate(session.createdAt)}`);
      console.log(`  ${chalk.bold('Last act:')}    ${shortDate(session.lastActivityAt)}`);
      console.log(`  ${chalk.bold('Prompts:')}     ${session.promptCount}`);
      if (session.lastError) {
        console.log(`  ${chalk.bold('Error:')}       ${chalk.red(session.lastError)}`);
      }
      console.log('');
      console.log(chalk.bold(`  Transcript (last ${Math.min(tail, session.transcript.length)}):`));
      const slice = session.transcript.slice(-tail);
      for (const entry of slice) {
        const tag =
          entry.role === 'prompt'
            ? chalk.cyan('[prompt]')
            : entry.role === 'response'
              ? chalk.green('[response]')
              : chalk.dim('[system]');
        const firstLine = entry.text.split('\n')[0];
        const trimmed = firstLine.length > 200 ? `${firstLine.slice(0, 197)}…` : firstLine;
        console.log(`  ${chalk.dim(shortDate(entry.at))} ${tag} ${trimmed}`);
      }
      console.log('');
    });

  showCmd.addHelpText(
    'after',
    `
Examples:
  mconnect agent show sess_abc123
  mconnect agent show sess_abc123 --tail 50
  mconnect agent show sess_abc123 --json
`
  );

  // ──────────────────────────────────────────────────────────────────
  // mconnect agent cancel
  // ──────────────────────────────────────────────────────────────────
  const cancelCmd = agent
    .command('cancel <id>')
    .description('Mark a session as finished (no-op going forward)')
    .action((id) => {
      const session = readSession(id as string);
      if (!session) {
        console.error(chalk.red(`No session with id ${id}.`));
        process.exit(1);
        return;
      }
      const updated: AgentSessionRecord = {
        ...session,
        status: 'finished',
        lastActivityAt: new Date().toISOString(),
      };
      writeSession(updated);
      console.log(chalk.green('✓'), `Session ${id} marked finished.`);
    });

  cancelCmd.addHelpText(
    'after',
    `
Examples:
  mconnect agent cancel sess_abc123

Notes:
  This does not abort an in-flight run (the SDK handles that). It just
  prevents loop-driven follow-ups and tells \`agent ls\` to hide the
  session by default.
`
  );

  // ──────────────────────────────────────────────────────────────────
  // mconnect agent rm
  // ──────────────────────────────────────────────────────────────────
  const rmCmd = agent
    .command('rm <id>')
    .description('Remove a session (and optionally its worktree)')
    .option('--keep-worktree', 'Do not remove the per-session git worktree')
    .option('--force', 'Force-remove a worktree with uncommitted changes')
    .action((id, options) => {
      const session = readSession(id as string);
      if (!session) {
        console.error(chalk.yellow(`No session with id ${id}; nothing to remove.`));
        return;
      }
      if (session.worktreePath && session.repoRoot && !options.keepWorktree) {
        try {
          removeWorktree(session.repoRoot, session.worktreePath, Boolean(options.force));
          console.log(chalk.green('✓'), `Removed worktree ${session.worktreePath}`);
        } catch (err) {
          console.error(
            chalk.yellow(
              `[warn] Could not remove worktree: ${err instanceof Error ? err.message : err}`
            ),
            chalk.dim('\n  Try `--force` if it has uncommitted changes.')
          );
        }
      }
      const removed = removeSession(session.id);
      if (removed) {
        console.log(chalk.green('✓'), `Removed session ${id}.`);
      }
    });

  rmCmd.addHelpText(
    'after',
    `
Examples:
  mconnect agent rm sess_abc123                      # remove session + worktree
  mconnect agent rm sess_abc123 --keep-worktree       # keep worktree for review
  mconnect agent rm sess_abc123 --force               # force-remove dirty worktree
`
  );

  // ──────────────────────────────────────────────────────────────────
  // mconnect agent worktree
  // ──────────────────────────────────────────────────────────────────
  const wtCmd = new Command('worktree').description('Inspect and manage per-session git worktrees');

  wtCmd
    .command('ls')
    .description('List git worktrees in the current repository')
    .option('-d, --dir <path>', 'Repository directory', process.cwd())
    .option('--json', 'Print as JSON')
    .action((options) => {
      const ctx = inspectGitContext(resolve(options.dir as string));
      if (!ctx.inRepo || !ctx.repoRoot) {
        console.error(chalk.red(`${options.dir} is not a git repository.`));
        process.exit(1);
        return;
      }
      const wts = listWorktrees(ctx.repoRoot);
      if (options.json) {
        console.log(JSON.stringify(wts, null, 2));
        return;
      }
      if (wts.length === 0) {
        console.log(chalk.dim('\n  No worktrees.\n'));
        return;
      }
      console.log('');
      for (const wt of wts) {
        const tag = wt.bare ? chalk.dim('(bare)') : wt.detached ? chalk.dim('(detached)') : '';
        console.log(`  ${chalk.bold(wt.path)}  ${wt.branch || ''} ${tag}`);
      }
      console.log('');
    });

  wtCmd
    .command('remove <id>')
    .description('Remove a per-session worktree by session id')
    .option('--force', 'Force removal even with uncommitted changes')
    .action((id, options) => {
      const session = readSession(id as string);
      if (!session) {
        console.error(chalk.red(`No session with id ${id}.`));
        process.exit(1);
        return;
      }
      if (!session.worktreePath || !session.repoRoot) {
        console.error(chalk.yellow('Session has no associated worktree.'));
        return;
      }
      try {
        removeWorktree(session.repoRoot, session.worktreePath, Boolean(options.force));
        console.log(chalk.green('✓'), `Removed worktree ${session.worktreePath}`);
      } catch (err) {
        console.error(
          chalk.red(`Error: ${err instanceof Error ? err.message : err}`),
          chalk.dim('\n  Try `--force` if it has uncommitted changes.')
        );
        process.exit(1);
      }
    });

  wtCmd.addHelpText(
    'after',
    `
Examples:
  mconnect agent worktree ls
  mconnect agent worktree remove sess_abc123
  mconnect agent worktree remove sess_abc123 --force
`
  );

  agent.addCommand(wtCmd);

  // ──────────────────────────────────────────────────────────────────
  // mconnect agent context
  // ──────────────────────────────────────────────────────────────────
  const ctxCmd = agent
    .command('context <id>')
    .description('Print a paste-ready context block summarising a session')
    .action((id) => {
      const session = readSession(id as string);
      if (!session) {
        console.error(chalk.red(`No session with id ${id}.`));
        process.exit(1);
        return;
      }
      const lines = [
        `## Session ${session.id}: ${session.name}`,
        '',
        `- Workspace: \`${session.cwd}\``,
        session.worktreePath
          ? `- Worktree: \`${session.worktreePath}\` (branch \`${session.worktreeBranch}\`)`
          : '- Worktree: (none, ran in-place)',
        `- Model: \`${session.modelId}\` (${session.executionMode})`,
        `- Status: ${session.status}, ${session.promptCount} prompts`,
        ...(session.lastError ? [`- Last error: ${session.lastError}`] : []),
        ...(session.tags.length ? [`- Tags: ${session.tags.join(', ')}`] : []),
        '',
        '### Recent transcript',
        ...session.transcript.slice(-10).map((entry) => {
          const role =
            entry.role === 'prompt'
              ? '**You**'
              : entry.role === 'response'
                ? '**Agent**'
                : '_system_';
          const firstLine = entry.text.split('\n')[0];
          return `- ${role} (${shortDate(entry.at)}): ${firstLine.slice(0, 240)}`;
        }),
      ];
      console.log(lines.join('\n'));
    });

  ctxCmd.addHelpText(
    'after',
    `
Examples:
  mconnect agent context sess_abc123 | pbcopy
  mconnect agent context sess_abc123 > brief.md
`
  );

  // ──────────────────────────────────────────────────────────────────
  // mconnect agent loop
  // ──────────────────────────────────────────────────────────────────
  const loopCmd = agent
    .command('loop')
    .description(
      'Run a long task as N iterations with optional stop/post hooks (no Cursor IDE required)'
    )
    .option('-t, --task <task>', 'Initial task. String, file path, or "-" for stdin.')
    .option(
      '--continue-prompt <text>',
      'Prompt sent on each iteration after the first. Defaults to a "make next chunk of progress" instruction.'
    )
    .option('-d, --dir <path>', 'Workspace directory', process.cwd())
    .option('-n, --name <name>', 'Friendly session name')
    .option('-m, --model <id>', 'Model id', undefined)
    .option('-x, --execution <mode>', 'local | cloud', 'local')
    .option('--api-key <key>', 'Cursor API key (overrides CURSOR_API_KEY)')
    .option('--branch <strategy>', 'Worktree branch strategy: new | reuse | detach', 'new')
    .option('--branch-name <name>', 'Override branch name')
    .option('--no-worktree', 'Run in --dir directly without creating a worktree')
    .option('--allow-dirty', 'Allow --no-worktree even with uncommitted changes')
    .option('--max-iterations <n>', 'Maximum iterations (default: 20)', '20')
    .option(
      '--done-sentinel <token>',
      'When this token appears in the agent response, stop early',
      'LECODER_LOOP_DONE'
    )
    .option(
      '--post-hook <cmd>',
      'Shell command run after every iteration. Receives session JSON on stdin. Non-zero exit pauses the loop.'
    )
    .option('--stop-hook <cmd>', 'Shell command run when the loop ends (success or failure).')
    .option('--tag <tag>', 'Repeatable. Attach a tag.', collectTags, [] as string[])
    .option('--json', 'Emit machine-readable JSON to stdout')
    .option('--dry-run', 'Show the plan without invoking the SDK')
    .action(async (options) => {
      const workDir = resolve(options.dir as string);
      if (!existsSync(workDir)) {
        console.error(chalk.red(`Error: directory does not exist: ${workDir}`));
        process.exit(1);
      }

      const maxIterations = Math.max(1, Number.parseInt(options.maxIterations as string, 10) || 20);
      const doneSentinel = String(options.doneSentinel || 'LECODER_LOOP_DONE');

      let initialPrompt: string;
      try {
        initialPrompt = await resolveTaskBody(
          options.task as string | undefined,
          undefined,
          workDir
        );
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
        return;
      }

      const continuePrompt =
        (options.continuePrompt as string | undefined) ||
        [
          'Continue the task. Make the next concrete chunk of progress and stop.',
          `Write \`${doneSentinel}\` on its own line when the entire task is complete.`,
        ].join('\n');

      // ── Set up session + worktree (same flow as `run`) ────────────
      const id = generateSessionId();
      const now = new Date().toISOString();
      let session: AgentSessionRecord = {
        id,
        name:
          (options.name as string) || initialPrompt.slice(0, 40).replace(/\s+/g, ' ').trim() || id,
        cwd: workDir,
        worktreePath: null,
        worktreeBranch: null,
        repoRoot: null,
        executionMode: (options.execution as ExecutionMode) ?? 'local',
        modelId: (options.model as string) || process.env.CURSOR_MODEL || 'composer-2',
        modelParams: null,
        status: 'pending',
        createdAt: now,
        lastActivityAt: now,
        promptCount: 0,
        lastError: null,
        transcript: [],
        tags: [...((options.tag as string[]) ?? []), 'loop'],
      };

      if (options.worktree !== false) {
        const ctx = inspectGitContext(workDir);
        if (ctx.inRepo && ctx.repoRoot) {
          session.repoRoot = ctx.repoRoot;
          if (!options.dryRun) {
            try {
              const wt = createWorktree({
                repoRoot: ctx.repoRoot,
                sessionId: id,
                strategy: options.branch as WorktreeBranchStrategy,
                branchName: options.branchName as string | undefined,
              });
              session.worktreePath = wt.path;
              session.worktreeBranch = wt.branch;
            } catch (err) {
              console.error(
                chalk.red(`Error creating worktree: ${err instanceof Error ? err.message : err}`)
              );
              process.exit(1);
              return;
            }
          }
        } else {
          console.error(
            chalk.yellow(`[warn] ${workDir} is not a git repository — running without worktree.`)
          );
        }
      } else {
        try {
          ensureSafeInPlaceRun(workDir, Boolean(options.allowDirty));
        } catch (err) {
          console.error(chalk.red(err instanceof Error ? err.message : String(err)));
          process.exit(1);
          return;
        }
      }

      const sdkCwd = session.worktreePath ?? session.cwd;

      if (options.dryRun) {
        const plan = {
          dryRun: true,
          sessionId: session.id,
          maxIterations,
          doneSentinel,
          continuePromptPreview:
            continuePrompt.length > 200
              ? `${continuePrompt.slice(0, 200)}…[truncated]`
              : continuePrompt,
          sdkCwd,
          worktreeBranch: session.worktreeBranch,
          postHook: options.postHook ?? null,
          stopHook: options.stopHook ?? null,
        };
        if (options.json) console.log(JSON.stringify(plan, null, 2));
        else {
          console.log(chalk.bgCyan(chalk.black(' loop dry-run ')), chalk.bold(session.id));
          console.log(`  max iterations: ${maxIterations}`);
          console.log(`  done sentinel:  ${doneSentinel}`);
          console.log(`  workspace:      ${sdkCwd}`);
          console.log(`  branch:         ${session.worktreeBranch || '(none)'}`);
          if (options.postHook) console.log(`  post-hook:      ${options.postHook}`);
          if (options.stopHook) console.log(`  stop-hook:      ${options.stopHook}`);
        }
        return;
      }

      let apiKey: string;
      try {
        apiKey = getApiKeyOrFail(options.apiKey as string | undefined);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
        return;
      }

      session.status = 'running';
      writeSession(session);

      const runner = new SDKRunner({
        apiKey,
        cwd: sdkCwd,
        executionMode: session.executionMode,
        model: { id: session.modelId },
        agentName: `mconnect agent-loop ${session.id}`,
      });

      let iteration = 0;
      let stopReason = '';
      try {
        for (let i = 0; i < maxIterations; i++) {
          iteration = i + 1;
          const prompt = i === 0 ? initialPrompt : continuePrompt;
          if (!options.json) {
            console.error(
              chalk.dim(`\n[loop ${session.id}] iteration ${iteration}/${maxIterations}`)
            );
          }

          session = appendTranscript(session, { role: 'prompt', text: prompt });
          session = { ...session, promptCount: session.promptCount + 1 };
          writeSession(session);

          const responseLines: string[] = [];
          const onEvent = (event: AgentEvent) => {
            if (options.json) {
              process.stdout.write(`${JSON.stringify({ iteration, ...event })}\n`);
            } else {
              renderHumanEvent(event, (text) => responseLines.push(text));
            }
          };

          const result = await runner.sendPrompt(prompt, onEvent);
          const responseText = responseLines
            .join('')
            .trim()
            .slice(0, 8 * 1024);
          session = appendTranscript(session, { role: 'response', text: responseText });
          session = {
            ...session,
            lastActivityAt: new Date().toISOString(),
            lastError: result.status === 'FINISHED' ? null : `Run ${i} ended ${result.status}`,
          };
          writeSession(session);

          // Run post-hook if configured.
          if (options.postHook) {
            const ok = runShellHook(options.postHook as string, session);
            if (!ok) {
              stopReason = 'post-hook returned non-zero — pausing loop';
              break;
            }
          }

          // Done-sentinel check.
          if (responseText.includes(doneSentinel)) {
            stopReason = `done-sentinel "${doneSentinel}" detected`;
            break;
          }

          if (result.status !== 'FINISHED') {
            stopReason = `iteration ${iteration} ended with status=${result.status}`;
            break;
          }
        }
        if (!stopReason) stopReason = `reached max iterations (${maxIterations})`;
        session = {
          ...session,
          status: 'idle',
          lastError: null,
          lastActivityAt: new Date().toISOString(),
        };
        session = appendTranscript(session, {
          role: 'system',
          text: `loop ended: ${stopReason}`,
        });
        writeSession(session);

        if (options.stopHook) {
          runShellHook(options.stopHook as string, session);
        }

        if (!options.json) {
          console.log('');
          console.log(
            chalk.green('✓'),
            chalk.bold(session.id),
            chalk.dim(
              `(iterations=${iteration}/${maxIterations}, ${stopReason}${
                session.worktreePath ? `, worktree=${session.worktreePath}` : ''
              })`
            )
          );
        } else {
          process.stdout.write(
            `${JSON.stringify({
              type: 'loop_complete',
              iteration,
              maxIterations,
              stopReason,
              sessionId: session.id,
              worktreePath: session.worktreePath,
            })}\n`
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        session = appendTranscript(session, { role: 'system', text: `error: ${message}` });
        session = {
          ...session,
          status: 'failed',
          lastError: message,
          lastActivityAt: new Date().toISOString(),
        };
        writeSession(session);
        if (options.stopHook) runShellHook(options.stopHook as string, session);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      } finally {
        await runner.dispose();
      }
    });

  loopCmd.addHelpText(
    'after',
    `
Examples:
  # Run a long task across up to 20 iterations, isolated in a worktree:
  mconnect agent loop --task TASK.md --max-iterations 20

  # Continue forever until the agent writes LECODER_LOOP_DONE:
  mconnect agent loop --task brief.md --max-iterations 1000

  # Custom continuation prompt:
  mconnect agent loop --task brief.md --continue-prompt "Run tests, then fix one failure."

  # Post-hook fired after each iteration (receives session JSON on stdin):
  mconnect agent loop --task brief.md --post-hook 'jq .status > /tmp/loop-status'

  # Stop-hook fired once when the loop ends:
  mconnect agent loop --task brief.md --stop-hook 'echo loop done >> ~/agent.log'

  # Pipe brief from stdin and emit JSON events for another agent to consume:
  cat brief.md | mconnect agent loop --json | jq 'select(.type=="loop_complete")'

Notes:
  - Each iteration reuses the same SDK agent so context carries across turns.
  - --post-hook receives the *current session JSON* on stdin and pauses the
    loop on a non-zero exit. Use it to gate progress on tests, lint, etc.
  - --stop-hook is fired once at the end (success OR failure).
  - When the response contains --done-sentinel (default LECODER_LOOP_DONE)
    the loop stops early.
`
  );

  // ──────────────────────────────────────────────────────────────────
  // mconnect agent doctor
  // ──────────────────────────────────────────────────────────────────
  const docCmd = agent
    .command('doctor')
    .description('Diagnose the agent CLI: API key, git, SDK installation')
    .option('--json', 'Print results as JSON')
    .action(async (options) => {
      const results: Array<{ name: string; ok: boolean; detail: string }> = [];

      results.push({
        name: 'CURSOR_API_KEY',
        ok: Boolean(process.env.CURSOR_API_KEY),
        detail: process.env.CURSOR_API_KEY
          ? `set (${process.env.CURSOR_API_KEY.slice(0, 6)}…)`
          : 'not set; export CURSOR_API_KEY="crsr_..."',
      });

      const gitVersion = (() => {
        try {
          return execFileSync('git', ['--version'], { encoding: 'utf-8' }).trim();
        } catch {
          return null;
        }
      })();
      results.push({ name: 'git', ok: Boolean(gitVersion), detail: gitVersion || 'not found' });

      // Probe SDK availability without forcing static resolution.
      const probe = await probeCursorSdk();
      results.push({
        name: '@cursor/sdk',
        ok: probe.ok,
        detail: probe.ok ? 'installed' : `not installed (${probe.error})`,
      });

      const sessions = (() => {
        try {
          return listSessions().length;
        } catch {
          return 0;
        }
      })();
      results.push({
        name: 'session-store',
        ok: true,
        detail: `${sessions} session(s) on disk`,
      });

      if (options.json) {
        console.log(JSON.stringify({ ok: results.every((r) => r.ok), results }, null, 2));
        return;
      }
      console.log('');
      for (const r of results) {
        const icon = r.ok ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${icon} ${chalk.bold(r.name.padEnd(16))} ${chalk.dim(r.detail)}`);
      }
      const allOk = results.every((r) => r.ok);
      console.log('');
      console.log(
        allOk
          ? chalk.green('  All checks passed — `mconnect agent run` is ready to use.')
          : chalk.yellow('  Some checks failed — fix the issues above before running an agent.')
      );
      console.log('');
    });

  docCmd.addHelpText(
    'after',
    `
Examples:
  mconnect agent doctor
  mconnect agent doctor --json
`
  );

  return agent;
}

function collectTags(value: string, prev: string[] = []): string[] {
  return [...prev, value];
}

/**
 * Run a user-configured shell hook. Pipes the current session JSON on
 * stdin so hooks can inspect status, transcript, etc. Returns true on
 * exit code 0, false otherwise. Never throws.
 */
function runShellHook(command: string, session: AgentSessionRecord): boolean {
  try {
    execFileSync('sh', ['-c', command], {
      input: `${JSON.stringify(session)}\n`,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: {
        ...process.env,
        LECODER_AGENT_SESSION_ID: session.id,
        LECODER_AGENT_STATUS: session.status,
        LECODER_AGENT_WORKTREE: session.worktreePath ?? '',
        LECODER_AGENT_PROMPT_COUNT: String(session.promptCount),
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Render an event in human-friendly form to stderr (annotations) and
 * stdout (assistant output).
 */
function renderHumanEvent(event: AgentEvent, captureAssistant: (text: string) => void): void {
  switch (event.type) {
    case 'assistant_delta':
      process.stdout.write(event.text);
      captureAssistant(event.text);
      break;
    case 'thinking': {
      const text = event.text.replace(/\s+/g, ' ').trim();
      if (text) process.stderr.write(`${chalk.dim(`[thinking] ${text}`)}\n`);
      break;
    }
    case 'tool':
      process.stderr.write(
        `${chalk.dim(`[tool] ${event.status} ${event.name}${event.params ? ` ${event.params}` : ''}`)}\n`
      );
      break;
    case 'status':
      if (event.status !== 'FINISHED') {
        process.stderr.write(
          `${chalk.dim(`[status] ${event.status}${event.message ? ` ${event.message}` : ''}`)}\n`
        );
      }
      break;
    case 'task':
      if (event.text || event.status) {
        process.stderr.write(
          `${chalk.dim(`[task] ${[event.status, event.text].filter(Boolean).join(' ')}`)}\n`
        );
      }
      break;
    case 'result': {
      const details = [
        `status=${event.status}`,
        event.durationMs ? `duration=${formatDuration(event.durationMs)}` : undefined,
        event.usage?.inputTokens ? `input=${event.usage.inputTokens}` : undefined,
        event.usage?.outputTokens ? `output=${event.usage.outputTokens}` : undefined,
      ].filter(Boolean);
      process.stderr.write(`${chalk.dim(`[done] ${details.join(' ')}`)}\n`);
      break;
    }
    default:
      break;
  }
}

if (process.env.LECODER_AGENT_RUN_INTERNAL_DEBUG === '1') {
  // Re-export private helper for unit tests.
  // biome-ignore lint/suspicious/noExplicitAny: debug seam
  (globalThis as any).__lecoder_agent_render = renderHumanEvent;
}
