/**
 * Terminal Bridge
 * MConnect v1.1.0 - Sidecar Mode
 *
 * Bridges the current terminal's I/O to WebSocket clients
 * without spawning a new PTY.
 *
 * Strategies:
 * 1. TTY Mode: Read from /dev/tty when available
 * 2. Pipe Mode: Use stdin/stdout when in pipe mode
 * 3. Fallback: Read-only output capture
 */

import { EventEmitter } from 'node:events';
import type { TerminalSize, TerminalBridgeEvents } from './types.js';

/**
 * TerminalBridge captures and bridges terminal I/O to WebSocket clients.
 *
 * @example
 * ```typescript
 * const bridge = new TerminalBridge();
 * await bridge.attach();
 *
 * bridge.on('data', (data) => {
 *   // Forward to WebSocket clients
 *   wsHub.broadcast(data);
 * });
 *
 * // Write input from remote clients
 * bridge.write(Buffer.from('ls -la\n'));
 * ```
 */
export class TerminalBridge extends EventEmitter {
  private _isAttached = false;
  private _size: TerminalSize = { rows: 24, cols: 80 };
  private _stdinHandler: ((data: Buffer) => void) | null = null;
  private _resizeHandler: (() => void) | null = null;
  private _mode: 'tty' | 'pipe' | 'none' = 'none';

  constructor() {
    super();
  }

  /**
   * Attach to the current terminal.
   * Returns true if successfully attached, false if already attached or unavailable.
   */
  async attach(): Promise<boolean> {
    if (this._isAttached) {
      return false;
    }

    try {
      // Determine terminal mode
      this._mode = this.detectMode();

      // Get initial terminal size
      this._size = this.getTerminalSize();

      // Set up handlers based on mode
      if (this._mode === 'tty' || this._mode === 'pipe') {
        this.setupInputHandlers();
        this.setupResizeHandler();
      }

      this._isAttached = true;
      return true;
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Detach from the terminal.
   */
  detach(): void {
    if (!this._isAttached) {
      return;
    }

    // Clean up handlers
    if (this._stdinHandler && process.stdin.readable) {
      process.stdin.off('data', this._stdinHandler);
      this._stdinHandler = null;
    }

    if (this._resizeHandler) {
      process.stdout.off('resize', this._resizeHandler);
      this._resizeHandler = null;
    }

    // Restore stdin mode if we changed it
    if (process.stdin.isTTY && process.stdin.isRaw) {
      try {
        process.stdin.setRawMode(false);
      } catch {
        // Ignore errors during cleanup
      }
    }

    this._isAttached = false;
    this._mode = 'none';
    this.emit('close');
  }

  /**
   * Write data to the terminal (forward input from remote clients).
   * Only works when attached and not in read-only mode.
   */
  write(data: Buffer): void {
    if (!this._isAttached) {
      return;
    }

    if (this._mode === 'tty') {
      // In TTY mode, we can write to stdout to display input
      // Note: This doesn't actually send to the shell - that requires PTY
      // For sidecar mode, we emit an event for the caller to handle
      this.emit('input_received', data);
    } else if (this._mode === 'pipe') {
      // In pipe mode, write to stdout
      process.stdout.write(data);
    }
  }

  /**
   * Check if terminal is attached.
   */
  get isAttached(): boolean {
    return this._isAttached;
  }

  /**
   * Get current terminal size.
   */
  get size(): TerminalSize {
    return { ...this._size };
  }

  /**
   * Get the current mode.
   */
  get mode(): 'tty' | 'pipe' | 'none' {
    return this._mode;
  }

  /**
   * Detect the terminal mode based on environment.
   */
  private detectMode(): 'tty' | 'pipe' | 'none' {
    // Check if we have a real TTY
    if (process.stdin.isTTY && process.stdout.isTTY) {
      return 'tty';
    }

    // Check if we have readable stdin (pipe mode)
    if (process.stdin.readable) {
      return 'pipe';
    }

    // No terminal access
    return 'none';
  }

  /**
   * Get current terminal size from environment or stdout.
   */
  private getTerminalSize(): TerminalSize {
    // Try to get size from stdout (works in TTY mode)
    if (process.stdout.isTTY && process.stdout.columns && process.stdout.rows) {
      return {
        rows: process.stdout.rows,
        cols: process.stdout.columns,
      };
    }

    // Try environment variables (common in various terminal contexts)
    const envCols = process.env.COLUMNS ? parseInt(process.env.COLUMNS, 10) : 0;
    const envRows = process.env.LINES ? parseInt(process.env.LINES, 10) : 0;

    if (envCols > 0 && envRows > 0) {
      return { rows: envRows, cols: envCols };
    }

    // Default fallback
    return { rows: 24, cols: 80 };
  }

  /**
   * Set up input handlers for capturing terminal output.
   */
  private setupInputHandlers(): void {
    // Note: In sidecar mode, we're primarily interested in capturing OUTPUT
    // from the current terminal session, not direct stdin.
    //
    // For true terminal sharing, we'd need to:
    // 1. Use `script` to capture session
    // 2. Use a PTY multiplexer
    // 3. Hook into the terminal at a lower level
    //
    // For now, we provide a basic implementation that works with pipes.

    if (this._mode === 'pipe' && process.stdin.readable) {
      this._stdinHandler = (data: Buffer) => {
        this.emit('data', data);
      };
      process.stdin.on('data', this._stdinHandler);
    }

    // Handle stdin end
    process.stdin.on('end', () => {
      this.detach();
    });

    // Handle stdin close
    process.stdin.on('close', () => {
      this.detach();
    });
  }

  /**
   * Set up handler for terminal resize events.
   */
  private setupResizeHandler(): void {
    if (!process.stdout.isTTY) {
      return;
    }

    this._resizeHandler = () => {
      const newSize = this.getTerminalSize();
      if (newSize.rows !== this._size.rows || newSize.cols !== this._size.cols) {
        this._size = newSize;
        this.emit('resize', newSize);
      }
    };

    process.stdout.on('resize', this._resizeHandler);
  }

  /**
   * Emit data event (used for testing and external data injection).
   */
  emitData(data: Buffer): void {
    if (this._isAttached) {
      this.emit('data', data);
    }
  }

  /**
   * Update terminal size (used for testing and external size updates).
   */
  updateSize(size: TerminalSize): void {
    if (this._isAttached) {
      this._size = { ...size };
      this.emit('resize', this._size);
    }
  }
}

// Type augmentation for EventEmitter
export interface TerminalBridge {
  on<K extends keyof TerminalBridgeEvents>(event: K, listener: TerminalBridgeEvents[K]): this;
  emit<K extends keyof TerminalBridgeEvents>(event: K, ...args: Parameters<TerminalBridgeEvents[K]>): boolean;
  off<K extends keyof TerminalBridgeEvents>(event: K, listener: TerminalBridgeEvents[K]): this;
}
