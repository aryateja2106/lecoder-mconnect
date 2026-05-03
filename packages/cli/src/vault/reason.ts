/**
 * MConnect Vault — audit reason inference
 *
 * Lockshell records `--reason "<short string>"` in its audit log. A
 * useless reason ("do stuff") makes audits ungrep-able next month. This
 * module owns the policy for what reason MConnect attaches to vault
 * invocations.
 *
 * Priority chain:
 *   1. Caller-supplied reason (e.g. agent provider passed it through a
 *      tool-use schema). Pass-through with length cap.
 *   2. Truncated last user message (typically the phone-typed prompt).
 *   3. Constant fallback prefixed with the agent provider for grep
 *      visibility ("claude-code: mconnect agent run").
 */

const MIN_LEN = 6;
const MAX_LEN = 120;

const DENYLIST = new Set([
  'as requested',
  'as you wish',
  'do stuff',
  'do this',
  'doing it',
  'go',
  'ok',
  'run it',
  '...',
]);

export interface ReasonContext {
  /** Agent provider tag (e.g. "claude-code", "gemini-cli"). */
  agentProvider?: string;
  /** Reason explicitly supplied by the agent or operator. Highest priority. */
  explicitReason?: string;
  /** Most recent operator-typed prompt. Used as a fallback. */
  lastUserMessage?: string;
}

export interface InferredReason {
  reason: string;
  source: 'explicit' | 'user_message' | 'fallback';
}

export function inferReason(ctx: ReasonContext): InferredReason {
  const tag = (ctx.agentProvider ?? 'mconnect').trim();

  if (ctx.explicitReason) {
    const cleaned = sanitiseReason(ctx.explicitReason);
    if (cleaned) {
      return { reason: prefix(tag, cleaned), source: 'explicit' };
    }
  }

  if (ctx.lastUserMessage) {
    const cleaned = sanitiseReason(ctx.lastUserMessage);
    if (cleaned) {
      return { reason: prefix(tag, `task: ${cleaned}`), source: 'user_message' };
    }
  }

  return { reason: prefix(tag, 'agent vault run'), source: 'fallback' };
}

function sanitiseReason(input: string): string | null {
  // Collapse whitespace, strip control chars, trim.
  const flat = input.replace(/\s+/g, ' ').replace(/[\x00-\x1f\x7f]/g, '').trim();
  if (flat.length < MIN_LEN) return null;
  const lower = flat.toLowerCase();
  if (DENYLIST.has(lower)) return null;
  return flat.slice(0, MAX_LEN);
}

function prefix(tag: string, reason: string): string {
  // Limit total length so audit grep on column width is predictable.
  return `${tag}: ${reason}`.slice(0, MAX_LEN);
}
