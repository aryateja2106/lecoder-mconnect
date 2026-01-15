/**
 * Tmux Types for MConnect v0.1.2
 */

export interface TmuxSessionConfig {
  /** Session name */
  name: string;
  /** Working directory */
  cwd: string;
  /** Initial window name */
  windowName?: string;
}

export interface TmuxPaneConfig {
  /** Command to run in pane */
  command: string;
  /** Pane title/name */
  name?: string;
  /** Split direction */
  split?: 'horizontal' | 'vertical';
  /** Pane size percentage */
  size?: number;
}

export interface TmuxPaneInfo {
  /** Pane index */
  index: number;
  /** Pane ID */
  id: string;
  /** Pane title */
  title?: string;
  /** Is active pane */
  active: boolean;
  /** Pane width */
  width: number;
  /** Pane height */
  height: number;
  /** Process running in pane */
  command?: string;
}

export interface TmuxWindowInfo {
  /** Window index */
  index: number;
  /** Window name */
  name: string;
  /** Is active window */
  active: boolean;
  /** Panes in this window */
  panes: TmuxPaneInfo[];
}

export interface TmuxSessionInfo {
  /** Session name */
  name: string;
  /** Session ID */
  id: string;
  /** Is attached */
  attached: boolean;
  /** Creation timestamp */
  created: number;
  /** Windows in this session */
  windows: TmuxWindowInfo[];
}

export interface TmuxManagerConfig {
  /** Tmux binary path (auto-detected if not specified) */
  tmuxPath?: string;
  /** Session name prefix */
  sessionPrefix?: string;
  /** Default shell */
  defaultShell?: string;
}
