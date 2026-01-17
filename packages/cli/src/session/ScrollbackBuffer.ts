/**
 * Scrollback Buffer - Circular buffer with SQLite spillover
 * MConnect v0.2.0
 *
 * Hybrid memory + disk storage for terminal output history
 */

import type { SessionStore } from './SessionStore.js';
import type { ScrollbackLine } from './types.js';

export interface ScrollbackBufferConfig {
  /** Maximum lines to keep in memory (default: 1000) */
  memoryLines: number;
  /** Maximum total lines to persist (default: 10000) */
  maxTotalLines: number;
  /** Batch size for disk writes (default: 100) */
  spillBatchSize: number;
}

const DEFAULT_CONFIG: ScrollbackBufferConfig = {
  memoryLines: 1000,
  maxTotalLines: 10000,
  spillBatchSize: 100,
};

export class ScrollbackBuffer {
  private sessionId: string;
  private store: SessionStore;
  private config: ScrollbackBufferConfig;

  /** In-memory buffer for recent lines */
  private memoryBuffer: string[] = [];

  /** Total lines written (memory + disk) */
  private totalLines = 0;

  /** Current line being accumulated (partial line without newline) */
  private currentLine = '';

  constructor(
    sessionId: string,
    store: SessionStore,
    config: Partial<ScrollbackBufferConfig> = {}
  ) {
    this.sessionId = sessionId;
    this.store = store;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Load existing line count from database
    this.totalLines = this.store.getScrollbackLineCount(sessionId);
  }

  /**
   * Append terminal output to the buffer
   * Handles partial lines and newline splitting
   *
   * @param data - Raw terminal output (may contain newlines)
   */
  append(data: string): void {
    // Combine with any partial line from previous append
    const combined = this.currentLine + data;

    // Split by newlines
    const parts = combined.split('\n');

    // Last part might be incomplete (no trailing newline)
    this.currentLine = parts.pop() || '';

    // Process complete lines
    for (const line of parts) {
      this.appendLine(line);
    }
  }

  /**
   * Append a single complete line to the buffer
   */
  private appendLine(line: string): void {
    this.memoryBuffer.push(line);
    this.totalLines++;

    // Check if we need to spill to disk
    if (this.memoryBuffer.length > this.config.memoryLines + this.config.spillBatchSize) {
      this.spillToDisk();
    }

    // Trim if total exceeds max
    if (this.totalLines > this.config.maxTotalLines) {
      this.trimOldest();
    }
  }

  /**
   * Spill oldest lines from memory to disk
   */
  private spillToDisk(): void {
    const toSpill = this.memoryBuffer.splice(0, this.config.spillBatchSize);
    this.store.appendScrollbackBatch(this.sessionId, toSpill);
  }

  /**
   * Trim oldest lines when exceeding max capacity
   */
  private trimOldest(): void {
    const linesToTrim = this.totalLines - this.config.maxTotalLines;
    if (linesToTrim <= 0) {
      return;
    }

    // Trim from database first
    this.store.trimScrollback(this.sessionId, this.config.maxTotalLines);
    this.totalLines = this.config.maxTotalLines;
  }

  /**
   * Flush current partial line and any remaining memory to disk
   */
  flush(): void {
    // Flush any partial line
    if (this.currentLine) {
      this.appendLine(this.currentLine);
      this.currentLine = '';
    }

    // Spill all memory to disk
    if (this.memoryBuffer.length > 0) {
      this.store.appendScrollbackBatch(this.sessionId, this.memoryBuffer);
      this.memoryBuffer = [];
    }
  }

  /**
   * Get the most recent lines (fast, from memory if possible)
   *
   * @param count - Number of lines to retrieve
   * @returns Array of most recent lines
   */
  getRecent(count: number): string[] {
    const effectiveCount = Math.min(count, this.totalLines);

    // If we have enough in memory, use that
    if (effectiveCount <= this.memoryBuffer.length) {
      return this.memoryBuffer.slice(-effectiveCount);
    }

    // Need to fetch from disk as well
    const memoryLines = [...this.memoryBuffer];
    const diskLinesNeeded = effectiveCount - memoryLines.length;

    // Get from database (most recent that aren't in memory)
    const diskStartLine = Math.max(0, this.totalLines - effectiveCount);
    const diskLines = this.store
      .getScrollback(this.sessionId, diskStartLine, diskLinesNeeded)
      .map((line) => line.content);

    return [...diskLines, ...memoryLines];
  }

  /**
   * Get lines by range (may hit disk)
   *
   * @param fromLine - Starting line number (0-indexed)
   * @param count - Number of lines to retrieve
   * @returns Array of ScrollbackLine objects
   */
  getRange(fromLine: number, count: number): ScrollbackLine[] {
    // First, flush any memory buffer to ensure accurate line numbers
    // Only do this if we need lines that might be in memory
    const memoryStartLine = this.totalLines - this.memoryBuffer.length;

    if (fromLine >= memoryStartLine) {
      // All requested lines are in memory
      const memoryOffset = fromLine - memoryStartLine;
      const lines = this.memoryBuffer.slice(memoryOffset, memoryOffset + count);

      return lines.map((content, i) => ({
        sessionId: this.sessionId,
        lineNumber: fromLine + i,
        content,
        timestamp: new Date(), // Memory lines don't have stored timestamps
      }));
    }

    // Need to fetch from disk
    const diskLines = this.store.getScrollback(this.sessionId, fromLine, count);

    // If we need some lines from memory too
    const diskEndLine = fromLine + diskLines.length;
    if (diskEndLine < fromLine + count && diskEndLine >= memoryStartLine) {
      const memoryLinesNeeded = fromLine + count - diskEndLine;
      const memoryOffset = diskEndLine - memoryStartLine;
      const memoryLines = this.memoryBuffer
        .slice(memoryOffset, memoryOffset + memoryLinesNeeded)
        .map((content, i) => ({
          sessionId: this.sessionId,
          lineNumber: diskEndLine + i,
          content,
          timestamp: new Date(),
        }));

      return [...diskLines, ...memoryLines];
    }

    return diskLines;
  }

  /**
   * Get total number of lines
   */
  getTotalLines(): number {
    return this.totalLines;
  }

  /**
   * Get number of lines currently in memory
   */
  getMemoryLineCount(): number {
    return this.memoryBuffer.length;
  }

  /**
   * Check if there's a partial line waiting
   */
  hasPartialLine(): boolean {
    return this.currentLine.length > 0;
  }

  /**
   * Clear all scrollback data
   */
  clear(): void {
    this.memoryBuffer = [];
    this.currentLine = '';
    this.totalLines = 0;
    // Note: Database cleanup happens via ON DELETE CASCADE when session is deleted
  }

  /**
   * Restore buffer state from database (called after daemon restart)
   */
  restore(): void {
    // Load most recent lines into memory
    const lines = this.store.getLatestScrollback(this.sessionId, this.config.memoryLines);
    this.memoryBuffer = lines.map((line) => line.content);
    this.totalLines = this.store.getScrollbackLineCount(this.sessionId);
  }
}
