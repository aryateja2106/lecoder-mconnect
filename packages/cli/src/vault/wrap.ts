/**
 * MConnect Vault — command rewrite
 *
 * Given a command containing `{{PLACEHOLDER}}` patterns, produce the shell
 * line that, when executed, will invoke `lockshell run` to resolve the
 * placeholders locally before exec'ing the original command.
 *
 * Lockshell's `run` subcommand internally evaluates the resolved template
 * via `bash -c`. We pass the original command verbatim as a single-quoted
 * argument so that no outer shell touches `$VAR`, backticks, or globs in
 * the template — that interpretation happens inside lockshell, where the
 * resolved values are injected as env vars (never argv).
 *
 * The reason string is recorded in lockshell's audit log. Pick something
 * specific; an empty reason produces a useless audit row. See
 * `inferReason` in `./reason.ts` for the policy.
 */

/** Escape `s` so it's safe inside a POSIX single-quoted string. */
export function shellSingleQuote(s: string): string {
  // Close, escape literal single-quote, reopen.
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export interface WrapOptions {
  /**
   * Path to the lockshell binary. Defaults to `'lockshell'` and relies on
   * PATH resolution. Production callers should resolve the absolute path
   * once at startup (via `which lockshell`) and pass it here, both for
   * consistency and to avoid PATH-hijack from agent-controlled env.
   */
  binary?: string;
  /** Reason string passed via `--reason`. Required by lockshell. */
  reason: string;
}

/**
 * Build the wrapped command line. The returned string is a single shell
 * line suitable for passing into a PTY; it is NOT split into argv. The
 * caller's PTY shell will tokenise it.
 */
export function wrapWithLockshell(command: string, opts: WrapOptions): string {
  const binary = opts.binary ?? 'lockshell';
  const reason = opts.reason.trim() || 'mconnect agent run';
  return `${binary} run --reason ${shellSingleQuote(reason)} -- ${shellSingleQuote(command)}`;
}
