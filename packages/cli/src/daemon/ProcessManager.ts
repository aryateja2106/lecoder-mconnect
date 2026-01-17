/**
 * Process Manager - PTY lifecycle management
 * MConnect v0.2.0
 *
 * Spawns, monitors, and manages PTY processes for sessions
 */

import type { IPty } from 'node-pty';
import { EventEmitter } from 'node:events';

export interface ProcessInfo {
  sessionId: string;
  pty: IPty;
  pid: number;
  shell: string;
  cwd: string;
  startedAt: Date;
  exitCode?: number;
  exitSignal?: number;
}

export interface ProcessManagerConfig {
  defaultShell?: string;
  defaultCols?: number;
  defaultRows?: number;
  env?: Record<string, string>;
}

const DEFAULT_CONFIG: ProcessManagerConfig = {
  defaultShell: process.env.SHELL || '/bin/bash',
  defaultCols: 80,
  defaultRows: 24,
  env: {},
};

export class ProcessManager extends EventEmitter {
  private processes: Map<string, ProcessInfo> = new Map();
  private config: ProcessManagerConfig;
  private nodePty: typeof import('node-pty') | null = null;

  constructor(config: ProcessManagerConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize node-pty (lazy load for optional dependency)
   */
  private async loadNodePty(): Promise<typeof import('node-pty')> {
    if (!this.nodePty) {
      try {
        this.nodePty = await import('node-pty');
      } catch {
        throw new Error(
          'node-pty is not installed. Install it with: npm install node-pty'
        );
      }
    }
    return this.nodePty;
  }

  /**
   * Spawn a new PTY process for a session
   */
  async spawn(
    sessionId: string,
    options: {
      shell?: string;
      cwd?: string;
      cols?: number;
      rows?: number;
      env?: Record<string, string>;
    } = {}
  ): Promise<ProcessInfo> {
    // Check if session already has a process
    if (this.processes.has(sessionId)) {
      throw new Error(`Session ${sessionId} already has a running process`);
    }

    const pty = await this.loadNodePty();

    const shell = options.shell || this.config.defaultShell!;
    const cwd = options.cwd || process.cwd();
    const cols = options.cols || this.config.defaultCols!;
    const rows = options.rows || this.config.defaultRows!;

    // Merge environment variables
    const env = {
      ...process.env,
      ...this.config.env,
      ...options.env,
      TERM: 'xterm-256color',
      MCONNECT_SESSION: sessionId,
    };

    // Spawn PTY
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: env as Record<string, string>,
    });

    const processInfo: ProcessInfo = {
      sessionId,
      pty: ptyProcess,
      pid: ptyProcess.pid,
      shell,
      cwd,
      startedAt: new Date(),
    };

    this.processes.set(sessionId, processInfo);

    // Setup event handlers
    ptyProcess.onData((data) => {
      this.emit('output', sessionId, data);
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      processInfo.exitCode = exitCode;
      processInfo.exitSignal = signal;
      this.emit('exit', sessionId, exitCode, signal);
      this.processes.delete(sessionId);
    });

    this.emit('spawn', sessionId, processInfo);

    return processInfo;
  }

  /**
   * Write input to a session's PTY
   */
  write(sessionId: string, data: string): boolean {
    const process = this.processes.get(sessionId);
    if (!process) {
      return false;
    }

    process.pty.write(data);
    return true;
  }

  /**
   * Resize a session's PTY
   */
  resize(sessionId: string, cols: number, rows: number): boolean {
    const process = this.processes.get(sessionId);
    if (!process) {
      return false;
    }

    process.pty.resize(cols, rows);
    return true;
  }

  /**
   * Kill a session's PTY process
   */
  kill(sessionId: string, signal?: string): boolean {
    const process = this.processes.get(sessionId);
    if (!process) {
      return false;
    }

    try {
      process.pty.kill(signal);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get process info for a session
   */
  getProcess(sessionId: string): ProcessInfo | undefined {
    return this.processes.get(sessionId);
  }

  /**
   * Check if a session has a running process
   */
  hasProcess(sessionId: string): boolean {
    return this.processes.has(sessionId);
  }

  /**
   * Get all running processes
   */
  getAllProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get process count
   */
  getProcessCount(): number {
    return this.processes.size;
  }

  /**
   * Kill all processes
   */
  killAll(signal?: string): void {
    for (const sessionId of this.processes.keys()) {
      this.kill(sessionId, signal);
    }
  }

  /**
   * Shutdown process manager
   */
  shutdown(): void {
    this.killAll('SIGTERM');
    this.processes.clear();
    this.removeAllListeners();
  }
}

// Export event types for type safety
export interface ProcessManagerEvents {
  spawn: (sessionId: string, info: ProcessInfo) => void;
  output: (sessionId: string, data: string) => void;
  exit: (sessionId: string, exitCode: number, signal?: number) => void;
}

export declare interface ProcessManager {
  on<K extends keyof ProcessManagerEvents>(event: K, listener: ProcessManagerEvents[K]): this;
  emit<K extends keyof ProcessManagerEvents>(event: K, ...args: Parameters<ProcessManagerEvents[K]>): boolean;
}
