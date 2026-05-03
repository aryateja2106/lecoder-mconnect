/**
 * CommentInjector
 *
 * Polls the hub for new comments on an active task and writes any
 * `@agent`-mentioning comments into the agent's stdin (PTY write).
 *
 * Why a separate component? Multica's "@mention an agent" feature is a thin
 * layer over their existing terminal stream. We follow the same idea: there
 * is no special chat protocol — just comments + a write hook.
 *
 * Usage:
 *   const injector = new CommentInjector({
 *     taskId, hubApi: hubClient.asCommentClient(), writer: agent
 *   });
 *   injector.start();
 *
 * When the agent finishes, call `injector.stop()`.
 */

export interface CommentRecord {
  id: string;
  body: string;
  authorKind: 'human' | 'agent' | 'system';
  createdAt: number;
}

export interface CommentSource {
  /** Fetch all comments for a task, newest last. */
  listComments(taskId: string): Promise<CommentRecord[]>;
}

export interface AgentWriter {
  /** Write a string into the agent process. */
  write(data: string): void;
}

export interface CommentInjectorLogger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
}

const consoleLogger: CommentInjectorLogger = {
  debug: (msg, meta) => console.debug(`[chat] ${msg}`, meta ?? ''),
  info: (msg, meta) => console.log(`[chat] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[chat] ${msg}`, meta ?? ''),
};

export interface CommentInjectorOptions {
  taskId: string;
  source: CommentSource;
  writer: AgentWriter;
  /** Poll interval in ms. */
  pollMs?: number;
  /** Match these author kinds. Defaults to ['human']. */
  acceptKinds?: Array<CommentRecord['authorKind']>;
  /** Mention pattern; default `/(^|\s)@agent\b/i`. */
  mentionPattern?: RegExp;
  logger?: CommentInjectorLogger;
}

export class CommentInjector {
  private readonly taskId: string;
  private readonly source: CommentSource;
  private readonly writer: AgentWriter;
  private readonly pollMs: number;
  private readonly acceptKinds: Set<CommentRecord['authorKind']>;
  private readonly mentionPattern: RegExp;
  private readonly logger: CommentInjectorLogger;
  private timer: ReturnType<typeof setInterval> | null = null;
  private seen = new Set<string>();
  private booted = false;

  constructor(options: CommentInjectorOptions) {
    this.taskId = options.taskId;
    this.source = options.source;
    this.writer = options.writer;
    this.pollMs = options.pollMs ?? 4_000;
    this.acceptKinds = new Set(options.acceptKinds ?? ['human']);
    this.mentionPattern = options.mentionPattern ?? /(^|\s)@agent\b/i;
    this.logger = options.logger ?? consoleLogger;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.poll().catch((err) => {
        this.logger.warn(`Comment poll failed: ${err instanceof Error ? err.message : err}`);
      });
    }, this.pollMs);
    (this.timer as { unref?: () => void }).unref?.();
    // Run immediately so we don't wait for the first interval.
    this.poll().catch(() => {
      /* noop, logged inside */
    });
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Test hook. Returns the number of comments injected.
   */
  async poll(): Promise<number> {
    const comments = await this.source.listComments(this.taskId);
    let injected = 0;

    for (const comment of comments) {
      if (this.seen.has(comment.id)) continue;
      this.seen.add(comment.id);

      // On first poll we don't replay history — only future comments.
      if (!this.booted) continue;

      if (!this.acceptKinds.has(comment.authorKind)) continue;
      if (!this.mentionPattern.test(comment.body)) continue;

      const stripped = comment.body.replace(this.mentionPattern, '$1').trim();
      if (!stripped) continue;
      this.writer.write(`${stripped}\n`);
      injected++;
      this.logger.info(`Injected comment ${comment.id} into agent`);
    }

    this.booted = true;
    return injected;
  }
}
