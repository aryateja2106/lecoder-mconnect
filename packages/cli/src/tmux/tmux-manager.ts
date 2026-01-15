/**
 * Tmux Manager for MConnect v0.1.2
 *
 * Manages tmux sessions for visual server-side view of multiple agents.
 * Each agent runs in its own tmux pane, allowing the user to see
 * all agents on their laptop terminal while controlling from mobile.
 */

import { execSync, spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import type {
  TmuxSessionConfig,
  TmuxPaneConfig,
  TmuxPaneInfo,
  TmuxWindowInfo,
  TmuxSessionInfo,
  TmuxManagerConfig,
} from './types.js';

/**
 * Known tmux installation paths
 */
const TMUX_PATHS = [
  '/opt/homebrew/bin/tmux',   // Homebrew Apple Silicon
  '/usr/local/bin/tmux',      // Homebrew Intel Mac
  '/usr/bin/tmux',            // Linux package manager
];

/**
 * Tmux Manager class
 */
export class TmuxManager {
  private tmuxPath: string | null = null;
  private sessionPrefix: string;
  private defaultShell: string;
  private currentSession: string | null = null;

  constructor(config: TmuxManagerConfig = {}) {
    this.sessionPrefix = config.sessionPrefix || 'mconnect';
    this.defaultShell = config.defaultShell || process.env.SHELL || '/bin/bash';
    this.tmuxPath = config.tmuxPath || null;
  }

  /**
   * Check if tmux is installed and find its path
   */
  async isInstalled(): Promise<boolean> {
    // Try provided path first
    if (this.tmuxPath && existsSync(this.tmuxPath)) {
      return true;
    }

    // Try command -v
    try {
      const result = execSync('command -v tmux', { encoding: 'utf8' }).trim();
      if (result) {
        this.tmuxPath = result;
        return true;
      }
    } catch {
      // Ignore
    }

    // Try known paths
    for (const path of TMUX_PATHS) {
      if (existsSync(path)) {
        this.tmuxPath = path;
        return true;
      }
    }

    return false;
  }

  /**
   * Get tmux binary path
   */
  getTmuxPath(): string | null {
    return this.tmuxPath;
  }

  /**
   * Execute a tmux command
   */
  private exec(args: string[]): string {
    if (!this.tmuxPath) {
      throw new Error('Tmux not found. Install with: brew install tmux');
    }

    try {
      return execSync(`${this.tmuxPath} ${args.join(' ')}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch (error: any) {
      // tmux commands often return non-zero but still work
      if (error.stdout) {
        return error.stdout.toString().trim();
      }
      throw error;
    }
  }

  /**
   * Create a new tmux session
   */
  async createSession(config: TmuxSessionConfig): Promise<string> {
    const installed = await this.isInstalled();
    if (!installed) {
      throw new Error('Tmux is not installed');
    }

    const sessionName = `${this.sessionPrefix}-${config.name}`;
    const windowName = config.windowName || 'agents';

    // Check if session already exists
    try {
      this.exec(['has-session', '-t', sessionName]);
      // Session exists, kill it
      this.exec(['kill-session', '-t', sessionName]);
    } catch {
      // Session doesn't exist, which is fine
    }

    // Create new session (detached)
    this.exec([
      'new-session',
      '-d',
      '-s', sessionName,
      '-n', windowName,
      '-c', config.cwd,
    ]);

    this.currentSession = sessionName;
    return sessionName;
  }

  /**
   * Create a new pane in the current window
   */
  async createPane(config: TmuxPaneConfig): Promise<string> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const direction = config.split === 'horizontal' ? '-h' : '-v';
    const sizeArg = config.size ? ['-p', config.size.toString()] : [];

    // Split the current pane
    this.exec([
      'split-window',
      direction,
      ...sizeArg,
      '-t', this.currentSession,
      config.command,
    ]);

    // Set pane title if provided
    if (config.name) {
      this.exec([
        'select-pane',
        '-t', this.currentSession,
        '-T', config.name,
      ]);
    }

    // Get the new pane ID
    const paneId = this.exec([
      'display-message',
      '-t', this.currentSession,
      '-p', '#{pane_id}',
    ]);

    return paneId;
  }

  /**
   * Send keys to a specific pane
   */
  sendKeys(paneTarget: string, keys: string, enter: boolean = true): void {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const target = paneTarget.includes(':') ? paneTarget : `${this.currentSession}:${paneTarget}`;

    this.exec([
      'send-keys',
      '-t', target,
      `"${keys.replace(/"/g, '\\"')}"`,
      ...(enter ? ['Enter'] : []),
    ]);
  }

  /**
   * Get session information
   */
  getSessionInfo(): TmuxSessionInfo | null {
    if (!this.currentSession) {
      return null;
    }

    try {
      // Get session details
      const sessionFormat = '#{session_name}:#{session_id}:#{session_attached}:#{session_created}';
      const sessionData = this.exec([
        'display-message',
        '-t', this.currentSession,
        '-p', sessionFormat,
      ]);

      const [name, id, attached, created] = sessionData.split(':');

      // Get windows
      const windowFormat = '#{window_index}:#{window_name}:#{window_active}';
      const windowsData = this.exec([
        'list-windows',
        '-t', this.currentSession,
        '-F', windowFormat,
      ]);

      const windows: TmuxWindowInfo[] = windowsData.split('\n').filter(Boolean).map((line) => {
        const [index, windowName, active] = line.split(':');
        return {
          index: parseInt(index, 10),
          name: windowName,
          active: active === '1',
          panes: this.getPanes(`${this.currentSession}:${index}`),
        };
      });

      return {
        name,
        id,
        attached: attached === '1',
        created: parseInt(created, 10) * 1000,
        windows,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get panes in a window
   */
  private getPanes(windowTarget: string): TmuxPaneInfo[] {
    try {
      const paneFormat = '#{pane_index}:#{pane_id}:#{pane_title}:#{pane_active}:#{pane_width}:#{pane_height}:#{pane_current_command}';
      const panesData = this.exec([
        'list-panes',
        '-t', windowTarget,
        '-F', paneFormat,
      ]);

      return panesData.split('\n').filter(Boolean).map((line) => {
        const [index, id, title, active, width, height, command] = line.split(':');
        return {
          index: parseInt(index, 10),
          id,
          title: title || undefined,
          active: active === '1',
          width: parseInt(width, 10),
          height: parseInt(height, 10),
          command: command || undefined,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Kill current session
   */
  killSession(): void {
    if (this.currentSession) {
      try {
        this.exec(['kill-session', '-t', this.currentSession]);
      } catch {
        // Ignore errors
      }
      this.currentSession = null;
    }
  }

  /**
   * Select even layout for panes
   */
  evenLayout(layout: 'horizontal' | 'vertical' | 'tiled' = 'tiled'): void {
    if (!this.currentSession) return;

    const layoutMap = {
      horizontal: 'even-horizontal',
      vertical: 'even-vertical',
      tiled: 'tiled',
    };

    try {
      this.exec(['select-layout', '-t', this.currentSession, layoutMap[layout]]);
    } catch {
      // Ignore errors
    }
  }

  /**
   * Attach to session (for local viewing)
   */
  attach(): ChildProcess | null {
    if (!this.currentSession || !this.tmuxPath) {
      return null;
    }

    return spawn(this.tmuxPath, ['attach-session', '-t', this.currentSession], {
      stdio: 'inherit',
    });
  }

  /**
   * Get current session name
   */
  getCurrentSession(): string | null {
    return this.currentSession;
  }
}

// Singleton instance
let tmuxManager: TmuxManager | null = null;

/**
 * Get the global Tmux manager instance
 */
export function getTmuxManager(config?: TmuxManagerConfig): TmuxManager {
  if (!tmuxManager) {
    tmuxManager = new TmuxManager(config);
  }
  return tmuxManager;
}
