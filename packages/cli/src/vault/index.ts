/**
 * MConnect Vault — public surface
 *
 * Top-level policy: `rewriteCommand` is the single entry point used by
 * the WebSocket hub between guardrail acceptance and PTY write. It
 * decides whether vault engagement is appropriate for a given command,
 * and if so returns the rewritten line.
 *
 * Engagement rules (all must hold):
 *   1. The session was started with `--vault lockshell` (or
 *      `MCONNECT_VAULT=lockshell`, or a preset that selected it).
 *   2. The command contains at least one `{{NAME}}` placeholder.
 *   3. The lockshell binary was discovered at MConnect startup
 *      (`vaultMode.binary` is non-null).
 *
 * If any rule fails, the original command flows through unchanged. We
 * never silently drop commands here — the caller decides whether to
 * forward, block, or warn the operator.
 */

export { detectPlaceholders, hasPlaceholders } from './detect.js';
export { wrapWithLockshell, shellSingleQuote } from './wrap.js';
export { inferReason } from './reason.js';

import { detectPlaceholders } from './detect.js';
import { wrapWithLockshell } from './wrap.js';
import { inferReason, type ReasonContext } from './reason.js';

export type VaultProvider = 'lockshell' | 'none';

export interface VaultMode {
  /** Provider selected at startup. `'none'` disables all vault behaviour. */
  provider: VaultProvider;
  /**
   * Resolved absolute path to the lockshell binary, or `null` if missing.
   * Resolved once at startup via `which lockshell`; pinned so an
   * agent-controlled `$PATH` mutation cannot redirect us to a fake.
   */
  binary: string | null;
}

export interface RewriteRequest {
  command: string;
  reasonContext: ReasonContext;
}

export type RewriteOutcome =
  | { kind: 'noop'; reason: 'disabled' | 'no_placeholders' }
  | { kind: 'block'; reason: 'binary_missing'; placeholders: string[] }
  | {
      kind: 'rewritten';
      command: string;
      placeholders: string[];
      auditReason: string;
      auditReasonSource: 'explicit' | 'user_message' | 'fallback';
    };

export function rewriteCommand(mode: VaultMode, req: RewriteRequest): RewriteOutcome {
  if (mode.provider === 'none') {
    return { kind: 'noop', reason: 'disabled' };
  }
  const detect = detectPlaceholders(req.command);
  if (detect.occurrenceCount === 0) {
    return { kind: 'noop', reason: 'no_placeholders' };
  }
  if (!mode.binary) {
    // Vault was requested AND the operator's command needs it, but the
    // binary is missing. Refuse — exec'ing the raw command would leak the
    // placeholder pattern (or, worse, an unexpanded literal) into the
    // agent's session.
    return { kind: 'block', reason: 'binary_missing', placeholders: detect.names };
  }
  const reason = inferReason(req.reasonContext);
  return {
    kind: 'rewritten',
    command: wrapWithLockshell(req.command, {
      binary: mode.binary,
      reason: reason.reason,
    }),
    placeholders: detect.names,
    auditReason: reason.reason,
    auditReasonSource: reason.source,
  };
}
