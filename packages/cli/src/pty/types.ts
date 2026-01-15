/**
 * PTY Types for MConnect v0.1.2
 */

export interface PTYOptions {
  /** Command to run (e.g., 'claude', 'bash') */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Working directory */
  cwd: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Initial terminal columns */
  cols?: number;
  /** Initial terminal rows */
  rows?: number;
}

export interface PTYSize {
  cols: number;
  rows: number;
}

export interface PTYInstance {
  /** Unique identifier */
  id: string;
  /** Process ID */
  pid: number;
  /** Write data to PTY stdin */
  write(data: string): void;
  /** Resize the PTY */
  resize(size: PTYSize): void;
  /** Kill the PTY process */
  kill(signal?: string): void;
  /** Register data handler */
  onData(callback: (data: string) => void): void;
  /** Register exit handler */
  onExit(callback: (exitCode: number, signal?: number) => void): void;
  /** Get current state */
  isRunning(): boolean;
}

export type PTYEventType = 'data' | 'exit' | 'error';

export interface PTYDataEvent {
  type: 'data';
  ptyId: string;
  data: string;
}

export interface PTYExitEvent {
  type: 'exit';
  ptyId: string;
  exitCode: number;
  signal?: number;
}

export interface PTYErrorEvent {
  type: 'error';
  ptyId: string;
  message: string;
}

export type PTYEvent = PTYDataEvent | PTYExitEvent | PTYErrorEvent;
