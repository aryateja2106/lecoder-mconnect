/**
 * Shared xterm/VT100 escape sequences for hardware-key bars and accessory
 * inputs. Keep in sync with packages/ios-app/.../HardwareKeyAccessory.swift.
 *
 * We default to bracket form for arrows (`ESC[A`), which is what cursor-key
 * mode emits when Application Cursor Keys is OFF. Most agents (Claude Code,
 * Gemini CLI, aider, plain bash) read this fine. Programs that want SS3
 * sequences (`ESC OA`) can map them server-side from the bracket form.
 */
export const ESC = "\x1b";

export type SpecialKey =
  | "Esc"
  | "Tab"
  | "Del"
  | "Enter"
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowDown"
  | "Home"
  | "End"
  | "PgUp"
  | "PgDn";

const SEQUENCES: Record<SpecialKey, string> = {
  Esc: ESC,
  Tab: "\t",
  Del: "\x7f",
  Enter: "\r",
  ArrowLeft: `${ESC}[D`,
  ArrowRight: `${ESC}[C`,
  ArrowUp: `${ESC}[A`,
  ArrowDown: `${ESC}[B`,
  Home: `${ESC}[H`,
  End: `${ESC}[F`,
  PgUp: `${ESC}[5~`,
  PgDn: `${ESC}[6~`,
};

export function sequenceFor(key: SpecialKey): string {
  return SEQUENCES[key];
}

/**
 * Apply a Ctrl modifier to an ASCII letter. Ctrl+C → 0x03, Ctrl+L → 0x0c, etc.
 * Returns the original char unchanged for non-letters.
 */
export function withCtrl(char: string): string {
  if (char.length !== 1) return char;
  const code = char.toUpperCase().charCodeAt(0);
  if (code >= 0x40 && code <= 0x5f) return String.fromCharCode(code - 0x40);
  return char;
}
