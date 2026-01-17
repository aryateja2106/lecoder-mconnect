/**
 * Daemon Logging Infrastructure
 * MConnect v0.2.0
 *
 * Log rotation and file-based logging for daemon operations
 */

import { appendFileSync, existsSync, mkdirSync, statSync, renameSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_LOG_DIR = 'logs';
const DEFAULT_LOG_FILE = 'daemon.log';
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_LOG_FILES = 5;

export class DaemonLogger {
  private dataDir: string;
  private logDir: string;
  private logFile: string;
  private minLevel: LogLevel;

  constructor(dataDir: string, minLevel: LogLevel = 'info') {
    this.dataDir = dataDir;
    this.logDir = join(dataDir, DEFAULT_LOG_DIR);
    this.logFile = join(this.logDir, DEFAULT_LOG_FILE);
    this.minLevel = minLevel;

    this.ensureLogDir();
  }

  /**
   * Log a debug message
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  /**
   * Log an info message
   */
  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  /**
   * Log a warning message
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  /**
   * Log an error message
   */
  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  /**
   * Get the path to the current log file
   */
  getLogPath(): string {
    return this.logFile;
  }

  /**
   * Get the path to the log directory
   */
  getLogDir(): string {
    return this.logDir;
  }

  /**
   * Read the last N lines from the log file
   */
  readLastLines(count: number = 50): string[] {
    if (!existsSync(this.logFile)) {
      return [];
    }

    try {
      const { readFileSync } = require('node:fs');
      const content = readFileSync(this.logFile, 'utf-8');
      const lines = content.split('\n').filter((line: string) => line.trim());
      return lines.slice(-count);
    } catch {
      return [];
    }
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    // Check if we should log at this level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) {
      return;
    }

    // Format the log entry
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    let entry = `${timestamp} [${levelStr}] ${message}`;

    if (meta) {
      entry += ` ${JSON.stringify(meta)}`;
    }

    // Also log to console
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](entry);

    // Write to file
    this.writeToFile(entry);
  }

  /**
   * Write entry to log file with rotation
   */
  private writeToFile(entry: string): void {
    try {
      // Check if rotation is needed
      this.rotateIfNeeded();

      // Append to log file
      appendFileSync(this.logFile, entry + '\n', 'utf-8');
    } catch (error) {
      // Can't log to file, just continue
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDir(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Rotate log files if current file exceeds size limit
   */
  private rotateIfNeeded(): void {
    if (!existsSync(this.logFile)) {
      return;
    }

    try {
      const stats = statSync(this.logFile);
      if (stats.size < MAX_LOG_SIZE) {
        return;
      }

      // Rotate existing logs
      for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
        const oldFile = `${this.logFile}.${i}`;
        const newFile = `${this.logFile}.${i + 1}`;

        if (existsSync(oldFile)) {
          if (i === MAX_LOG_FILES - 1) {
            // Delete oldest log
            unlinkSync(oldFile);
          } else {
            renameSync(oldFile, newFile);
          }
        }
      }

      // Rotate current log
      renameSync(this.logFile, `${this.logFile}.1`);
    } catch {
      // Ignore rotation errors
    }
  }

  /**
   * Clean up old log files
   */
  cleanupOldLogs(): void {
    try {
      const files = readdirSync(this.logDir);
      const logFiles = files
        .filter((f) => f.startsWith(DEFAULT_LOG_FILE))
        .map((f) => ({
          name: f,
          path: join(this.logDir, f),
          stat: statSync(join(this.logDir, f)),
        }))
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

      // Keep only MAX_LOG_FILES + 1 (current + rotated)
      const toDelete = logFiles.slice(MAX_LOG_FILES + 1);
      for (const file of toDelete) {
        unlinkSync(file.path);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
