/**
 * Cursor SDK runner.
 *
 * Wraps `@cursor/sdk` so the rest of the CLI doesn't have to know about
 * the SDK shape. Responsibilities:
 *
 *   - Resolve the API key (env var or explicit override).
 *   - Create a local or cloud `Agent`, restricted to a workspace path.
 *   - Send a prompt and stream events back as a normalized AgentEvent
 *     stream that's easy to render in plain text or JSON.
 *   - Optionally feed events into a callback (e.g. transcript writer)
 *     so the session store stays consistent.
 *
 * The SDK is loaded via dynamic import so it can be marked as an
 * optional dependency — users who never run `mconnect agent run` don't
 * need it installed.
 *
 * Reference: github.com/cursor/cookbook/blob/main/sdk/coding-agent-cli/src/agent.ts
 */

import { execFileSync } from 'node:child_process';

/**
 * Normalized event the CLI emits to consumers (plain stdout, JSON, etc.).
 */
export type AgentEvent =
  | { type: 'assistant_delta'; text: string }
  | { type: 'thinking'; text: string }
  | {
      type: 'tool';
      callId?: string;
      name: string;
      params?: string;
      status: string;
    }
  | { type: 'status'; status: string; message?: string }
  | { type: 'task'; status?: string; text?: string }
  | {
      type: 'result';
      status: string;
      durationMs?: number;
      usage?: { inputTokens?: number; outputTokens?: number };
    };

export type ExecutionMode = 'local' | 'cloud';

export interface ModelSelectionLite {
  id: string;
  params?: Array<{ id: string; value: string }>;
}

export interface SDKRunnerOptions {
  apiKey: string;
  /** Workspace dir (local mode) — the agent is restricted to this path. */
  cwd: string;
  /** Local | cloud. Defaults to local. */
  executionMode?: ExecutionMode;
  /** Model selection. Defaults to env CURSOR_MODEL or 'composer-2'. */
  model?: ModelSelectionLite;
  /** Display name for the agent in Cursor's logs. */
  agentName?: string;
  /** Pass `local: { force: true }` on send to clear a stuck local run. */
  force?: boolean;
}

/**
 * Default base instructions prepended to every prompt.
 *
 * Adapted from Cursor's coding-agent-cli example.
 */
const AGENT_INSTRUCTIONS = [
  'You are a programmable Cursor SDK agent invoked from a terminal CLI.',
  'Work strictly inside the provided workspace.',
  'Make small, focused changes; preserve unrelated user work.',
  'Before changing files, read the surrounding code.',
  'Keep status messages short. Summarize the result clearly when finished.',
].join('\n');

/**
 * Build the final prompt sent to the agent: instructions + user task.
 */
export function buildPrompt(userPrompt: string, extraInstructions?: string): string {
  const instructions = extraInstructions
    ? `${AGENT_INSTRUCTIONS}\n\n${extraInstructions}`
    : AGENT_INSTRUCTIONS;
  return [instructions, '', 'User task:', userPrompt].join('\n');
}

/**
 * Detect a GitHub remote URL + branch so we can pass a sensible
 * `cloud: { repos: [...] }` config to the SDK in cloud mode.
 *
 * Mirrors github.com/cursor/cookbook coding-agent-cli logic.
 */
export function detectCloudRepository(cwd: string): { url: string; startingRef?: string } {
  const remote = runGit(cwd, ['config', '--get', 'remote.origin.url']);
  if (!remote) {
    throw new Error('Cloud mode requires a git repository with remote.origin.url set.');
  }
  const url = normalizeGitHubRemote(remote);
  if (!url) {
    throw new Error('Cloud mode currently expects remote.origin.url to point at GitHub.');
  }
  const branch = runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const startingRef = branch && branch !== 'HEAD' ? branch : undefined;
  return startingRef ? { url, startingRef } : { url };
}

function normalizeGitHubRemote(remote: string): string | null {
  const trimmed = remote.trim().replace(/\.git$/, '');
  const sshMatch = trimmed.match(/^git@github\.com:(.+\/.+)$/);
  const sshUrlMatch = trimmed.match(/^ssh:\/\/git@github\.com\/(.+\/.+)$/);
  const httpsMatch = trimmed.match(/^https:\/\/github\.com\/(.+\/.+)$/);
  const repoPath = sshMatch?.[1] ?? sshUrlMatch?.[1] ?? httpsMatch?.[1];
  return repoPath ? `https://github.com/${repoPath}` : null;
}

function runGit(cwd: string, args: string[]): string | null {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Format a duration as a short string ("123ms" / "4.2s").
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Lazy-load the @cursor/sdk module. Surfaces a friendly error if the
 * user hasn't installed it (it's an optional peer dependency).
 *
 * The module specifier is built at runtime so TypeScript / tsup don't
 * try to resolve it during build — keeping `@cursor/sdk` strictly
 * optional. Bundlers see a non-literal expression and skip resolution.
 *
 * biome-ignore lint/suspicious/noExplicitAny: SDK shape is dynamic
 */
async function loadSdk(): Promise<{ Agent: any; Cursor: any }> {
  // Build the specifier at runtime so static analysis doesn't try to
  // resolve `@cursor/sdk` at build time.
  const specifier = ['@cursor', 'sdk'].join('/');
  try {
    const mod = (await import(specifier)) as { Agent?: unknown; Cursor?: unknown };
    if (!mod || !('Agent' in mod)) {
      throw new Error('module loaded but Agent export missing');
    }
    return mod as { Agent: unknown; Cursor: unknown } as {
      // biome-ignore lint/suspicious/noExplicitAny: SDK shape is dynamic
      Agent: any;
      // biome-ignore lint/suspicious/noExplicitAny: SDK shape is dynamic
      Cursor: any;
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      [
        '@cursor/sdk is not installed.',
        '',
        'Install once on your machine:',
        '  npm install -g @cursor/sdk',
        '',
        'Or alongside lecoder-mconnect in a project:',
        '  npm install @cursor/sdk',
        '',
        `Underlying error: ${message}`,
      ].join('\n')
    );
  }
}

/**
 * Lazy SDK probe used by `mconnect agent doctor`. Returns the loaded
 * module on success or null on failure (with the error attached as
 * `lastError`). Never throws.
 */
export async function probeCursorSdk(): Promise<
  { ok: true; module: unknown } | { ok: false; error: string }
> {
  const specifier = ['@cursor', 'sdk'].join('/');
  try {
    const mod = (await import(specifier)) as { Agent?: unknown };
    if (!mod || !('Agent' in mod)) {
      return { ok: false, error: 'module loaded but Agent export missing' };
    }
    return { ok: true, module: mod };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * SDKRunner — wraps a long-lived `Agent` and exposes `sendPrompt` /
 * `dispose`. Reuses the same agent across multiple `sendPrompt` calls
 * so the SDK keeps the conversation context server-side.
 *
 * For one-shot prompts, `sendPrompt` + `dispose` is enough. For loop
 * mode, hold an instance across the loop and call `sendPrompt` for
 * each iteration.
 */
export class SDKRunner {
  private readonly options: SDKRunnerOptions;
  private model: ModelSelectionLite;
  // biome-ignore lint/suspicious/noExplicitAny: SDK shape is dynamic
  private agent: any | null = null;

  constructor(options: SDKRunnerOptions) {
    this.options = options;
    this.model = options.model ?? {
      id: process.env.CURSOR_MODEL ?? 'composer-2',
    };
  }

  /**
   * Send `prompt` and stream events to `onEvent` until the run finishes.
   *
   * On the first call we lazily create the underlying SDK agent; later
   * calls reuse it so the conversation history (and the SDK's own
   * context-management features) carry over.
   *
   * Returns the run result so callers can record duration/tokens.
   */
  async sendPrompt(
    prompt: string,
    onEvent: (event: AgentEvent) => void
  ): Promise<{ status: string; durationMs?: number }> {
    const agent = await this.ensureAgent();
    const mode: ExecutionMode = this.options.executionMode ?? 'local';

    const sendOpts: Record<string, unknown> = {};
    if (mode === 'local') {
      sendOpts.model = this.model;
      if (this.options.force) sendOpts.local = { force: true };
    }

    const run = await agent.send(buildPrompt(prompt), sendOpts);
    // biome-ignore lint/suspicious/noExplicitAny: SDK shape is dynamic
    for await (const event of run.stream() as AsyncIterable<any>) {
      for (const normalized of normalizeSDKMessage(event)) {
        onEvent(normalized);
      }
    }
    const result = await run.wait();
    const usage = (result as { usage?: { inputTokens?: number; outputTokens?: number } }).usage;
    onEvent({
      type: 'result',
      status: result.status,
      durationMs: result.durationMs,
      usage,
    });
    return { status: result.status, durationMs: result.durationMs };
  }

  /**
   * Release the underlying SDK agent. Idempotent.
   */
  async dispose(): Promise<void> {
    if (!this.agent) return;
    const dispose = (this.agent as { [Symbol.asyncDispose]?: () => Promise<void> })[
      Symbol.asyncDispose
    ];
    this.agent = null;
    if (typeof dispose === 'function') {
      try {
        await dispose.call(this.agent);
      } catch {
        /* ignore — cleanup best effort */
      }
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: SDK shape is dynamic
  private async ensureAgent(): Promise<any> {
    if (this.agent) return this.agent;
    const { Agent } = await loadSdk();
    const mode: ExecutionMode = this.options.executionMode ?? 'local';
    const agentName = this.options.agentName ?? 'lecoder-mconnect agent';
    if (mode === 'cloud') {
      this.agent = await Agent.create({
        apiKey: this.options.apiKey,
        name: agentName,
        model: this.model,
        cloud: { repos: [detectCloudRepository(this.options.cwd)] },
      });
    } else {
      this.agent = await Agent.create({
        apiKey: this.options.apiKey,
        name: agentName,
        model: this.model,
        local: { cwd: this.options.cwd },
      });
    }
    return this.agent;
  }
}

/**
 * Translate SDK message events into our normalized AgentEvent stream.
 *
 * Mirrors the cookbook implementation but is exported so it's testable
 * in isolation against captured fixtures.
 */
// biome-ignore lint/suspicious/noExplicitAny: input is SDK-shaped dynamic event
export function normalizeSDKMessage(event: any): AgentEvent[] {
  if (!event || typeof event !== 'object' || typeof event.type !== 'string') return [];
  const events: AgentEvent[] = [];
  switch (event.type) {
    case 'assistant':
      for (const block of event.message?.content ?? []) {
        if (block.type === 'text') {
          events.push({ type: 'assistant_delta', text: String(block.text ?? '') });
        } else {
          events.push({
            type: 'tool',
            callId: block.id,
            name: String(block.name ?? 'tool'),
            params: summarizeToolArgs(block.name, block.input),
            status: 'requested',
          });
        }
      }
      break;
    case 'thinking':
      events.push({ type: 'thinking', text: String(event.text ?? '') });
      break;
    case 'tool_call':
      events.push({
        type: 'tool',
        callId: event.call_id,
        name: String(event.name ?? 'tool'),
        params: summarizeToolArgs(event.name, event.args),
        status: String(event.status ?? 'pending'),
      });
      break;
    case 'status':
      events.push({
        type: 'status',
        status: String(event.status ?? ''),
        message: event.message ? String(event.message) : undefined,
      });
      break;
    case 'task':
      events.push({
        type: 'task',
        status: event.status ? String(event.status) : undefined,
        text: event.text ? String(event.text) : undefined,
      });
      break;
    default:
      break;
  }
  return events;
}

/**
 * Best-effort one-line summary of a tool call's arguments. Keeps the
 * transcript and stdout output compact so we don't dump huge JSON blobs.
 */
function summarizeToolArgs(_name: string | undefined, input: unknown): string | undefined {
  if (input == null) return undefined;
  try {
    const text = typeof input === 'string' ? input : JSON.stringify(input);
    if (text.length <= 80) return text;
    return `${text.slice(0, 77)}...`;
  } catch {
    return undefined;
  }
}
