/**
 * SessionScrollback - Per-agent ring buffer for terminal output.
 *
 * Used to support tmux-style session persistence: when a client reattaches
 * to a session after WS disconnect, we replay the buffered output that was
 * produced while the client was offline. The buffer is byte-bounded; once
 * full, oldest bytes are evicted.
 *
 * Storage is a list of UTF-8 string chunks tagged with timestamp; eviction
 * drops or trims the oldest chunks until totalBytes <= maxBytes. Buffers are
 * keyed by agentId.
 */

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB per agent

/**
 * One buffered output chunk.
 */
export interface ScrollbackChunk {
  /** UTF-8 text payload */
  data: string;
  /** Approximate byte length (UTF-8). */
  bytes: number;
  /** Wall-clock timestamp when received */
  timestamp: number;
}

/**
 * Ring buffer holding the most recent ~maxBytes of output for one agent.
 */
class AgentBuffer {
  readonly chunks: ScrollbackChunk[] = [];
  totalBytes = 0;

  constructor(public readonly maxBytes: number) {}

  append(data: string, timestamp: number): void {
    if (data.length === 0) return;

    const bytes = Buffer.byteLength(data, 'utf8');
    this.chunks.push({ data, bytes, timestamp });
    this.totalBytes += bytes;

    this.evict();
  }

  /**
   * Drop oldest bytes until totalBytes <= maxBytes. May trim the head chunk.
   */
  private evict(): void {
    while (this.totalBytes > this.maxBytes && this.chunks.length > 0) {
      const head = this.chunks[0]!;
      const overflow = this.totalBytes - this.maxBytes;

      if (head.bytes <= overflow) {
        // Drop the entire head chunk.
        this.chunks.shift();
        this.totalBytes -= head.bytes;
      } else {
        // Trim the head chunk by `overflow` bytes. Slice in code units —
        // good enough for terminal output and avoids UTF-8 boundary work
        // in a hot path.
        const dropChars = Math.min(head.data.length, overflow);
        const newData = head.data.slice(dropChars);
        const newBytes = Buffer.byteLength(newData, 'utf8');
        this.totalBytes -= head.bytes - newBytes;
        head.data = newData;
        head.bytes = newBytes;
        break;
      }
    }
  }

  /**
   * Read all buffered data as a single concatenated string.
   */
  readAll(): string {
    if (this.chunks.length === 0) return '';
    return this.chunks.map((c) => c.data).join('');
  }

  /**
   * Read buffered data starting from a byte offset (clamped to [0, totalBytes]).
   * Offsets are measured from the current head of the ring buffer.
   */
  readFromOffset(offset: number): string {
    if (this.chunks.length === 0) return '';
    if (offset <= 0) return this.readAll();
    if (offset >= this.totalBytes) return '';

    let skipped = 0;
    const out: string[] = [];
    for (const chunk of this.chunks) {
      if (skipped + chunk.bytes <= offset) {
        skipped += chunk.bytes;
        continue;
      }
      if (skipped >= offset) {
        out.push(chunk.data);
      } else {
        const localOffset = offset - skipped;
        // Approximate by code-unit slice; terminal text is mostly ASCII.
        out.push(chunk.data.slice(localOffset));
        skipped = offset;
      }
    }
    return out.join('');
  }

  size(): number {
    return this.totalBytes;
  }

  clear(): void {
    this.chunks.length = 0;
    this.totalBytes = 0;
  }
}

/**
 * Configuration for the SessionScrollback container.
 */
export interface SessionScrollbackConfig {
  /** Max bytes to retain per agent (default 2 MB). */
  maxBytesPerAgent?: number;
}

/**
 * Per-agent scrollback store.
 *
 * Allocation is lazy: a buffer is created on the first `append()` for an
 * agent. Use `dropAgent()` to release memory when an agent is removed.
 */
export class SessionScrollback {
  private readonly maxBytesPerAgent: number;
  private readonly buffers: Map<string, AgentBuffer> = new Map();

  constructor(config: SessionScrollbackConfig = {}) {
    this.maxBytesPerAgent = config.maxBytesPerAgent ?? DEFAULT_MAX_BYTES;
  }

  /**
   * Append output for an agent. Creates the buffer if needed.
   */
  append(agentId: string, data: string, timestamp: number = Date.now()): void {
    let buf = this.buffers.get(agentId);
    if (!buf) {
      buf = new AgentBuffer(this.maxBytesPerAgent);
      this.buffers.set(agentId, buf);
    }
    buf.append(data, timestamp);
  }

  /**
   * Read all buffered output for an agent. Returns '' if none.
   */
  readAll(agentId: string): string {
    return this.buffers.get(agentId)?.readAll() ?? '';
  }

  /**
   * Read buffered output for an agent starting at a byte offset.
   */
  readFromOffset(agentId: string, offset: number): string {
    return this.buffers.get(agentId)?.readFromOffset(offset) ?? '';
  }

  /**
   * Current buffered byte count for an agent (0 if none).
   */
  size(agentId: string): number {
    return this.buffers.get(agentId)?.size() ?? 0;
  }

  /**
   * Whether an agent has any buffered output.
   */
  has(agentId: string): boolean {
    return (this.buffers.get(agentId)?.size() ?? 0) > 0;
  }

  /**
   * Drop all buffered output for an agent (e.g. when removed).
   */
  dropAgent(agentId: string): void {
    this.buffers.delete(agentId);
  }

  /**
   * Drop all buffers.
   */
  clear(): void {
    this.buffers.clear();
  }
}

// ============================================================================
// Singleton
// ============================================================================

let scrollbackInstance: SessionScrollback | null = null;

/**
 * Global scrollback store, lazy-initialized.
 */
export function getSessionScrollback(): SessionScrollback {
  if (!scrollbackInstance) {
    scrollbackInstance = new SessionScrollback();
  }
  return scrollbackInstance;
}

/**
 * Reset the global scrollback store (test hook).
 */
export function resetSessionScrollback(): void {
  scrollbackInstance = null;
}

export default SessionScrollback;
