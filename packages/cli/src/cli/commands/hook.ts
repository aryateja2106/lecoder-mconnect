/**
 * `mconnect hook` command group.
 *
 * Cursor invokes these as `lecoder-mconnect hook cursor <event>`. Each
 * subcommand reads a JSON payload from stdin and prints a single line
 * of JSON to stdout, matching Cursor's third-party hook contract.
 *
 *   stop          → drives the infinite loop (emits `followup_message`)
 *   pretooluse    → no-op `agent_message: ""` (parity with context-mode)
 *   posttooluse   → no-op `additional_context: ""` (parity with context-mode)
 *
 * The pre/post hooks exist primarily so the same binary can occupy
 * matching `.cursor/hooks.json` entries and emit zero-knowledge no-ops
 * if the user wants to extend them later. They never fail and never
 * write to stderr (Cursor treats stderr as hook failure).
 */

import { Command } from 'commander';
import { runCursorStopHook } from '../../loop/cursor-stop-hook.js';

/**
 * Drain stdin so Cursor doesn't block waiting for the hook to consume it.
 */
function drainStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    const chunks: Buffer[] = [];
    process.stdin.on('data', (c: Buffer) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', () => resolve(''));
    setTimeout(() => resolve(Buffer.concat(chunks).toString('utf-8')), 5000).unref();
  });
}

export function createHookCommand(): Command {
  const hook = new Command('hook').description(
    'Cursor hook entrypoints (invoked by Cursor via .cursor/hooks.json)'
  );

  const cursor = new Command('cursor').description('Cursor agent hook commands');

  cursor
    .command('stop')
    .description('Cursor stop hook — drives the lecoder infinite loop continuation')
    .action(async () => {
      await runCursorStopHook();
      // Always exit 0; runCursorStopHook handles all error paths.
      process.exit(0);
    });

  cursor
    .command('pretooluse')
    .description('Cursor preToolUse hook — no-op stub (extend if needed)')
    .action(async () => {
      try {
        await drainStdin();
      } catch {
        /* ignore */
      }
      // Cursor treats empty stdout as failure; emit a structurally valid passthrough.
      process.stdout.write(`${JSON.stringify({ agent_message: '' })}\n`);
      process.exit(0);
    });

  cursor
    .command('posttooluse')
    .description('Cursor postToolUse hook — no-op stub (extend if needed)')
    .action(async () => {
      try {
        await drainStdin();
      } catch {
        /* ignore */
      }
      process.stdout.write(`${JSON.stringify({ additional_context: '' })}\n`);
      process.exit(0);
    });

  cursor
    .command('afteragentresponse')
    .description('Cursor afterAgentResponse hook — fire-and-forget')
    .action(async () => {
      try {
        await drainStdin();
      } catch {
        /* ignore */
      }
      // afterAgentResponse is fire-and-forget; emit a no-op anyway.
      process.stdout.write(`${JSON.stringify({})}\n`);
      process.exit(0);
    });

  hook.addCommand(cursor);
  return hook;
}
