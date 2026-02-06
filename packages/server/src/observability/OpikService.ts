/**
 * Opik Observability Service
 *
 * Integration with Opik SDK for tracing, monitoring, and observability
 * of agent operations and LLM calls.
 *
 * @see spec §2.2.5 for interface definition
 */

import { Opik } from 'opik';

// ============================================================================
// Types
// ============================================================================

/**
 * Opik service configuration
 */
export interface OpikConfig {
  /** Opik API key */
  apiKey?: string;
  /** Opik API URL (defaults to cloud) */
  apiUrl?: string;
  /** Project name for traces */
  projectName: string;
  /** Workspace name */
  workspaceName?: string;
  /** Enable/disable tracing (useful for testing) */
  enabled?: boolean;
}

/**
 * Trace context for tracking operations
 */
export interface TraceContext {
  /** Unique trace ID */
  traceId: string;
  /** Operation name */
  operation: string;
  /** Start timestamp */
  startTime: number;
  /** User ID associated with trace */
  userId?: string;
  /** Session ID associated with trace */
  sessionId?: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Internal Opik trace reference */
  _opikTrace?: ReturnType<Opik['trace']>;
}

/**
 * Span context for tracking sub-operations within a trace
 */
export interface SpanContext {
  /** Unique span ID */
  spanId: string;
  /** Parent trace context */
  trace: TraceContext;
  /** Span name */
  name: string;
  /** Span type */
  type: 'general' | 'llm' | 'tool' | 'guardrail';
  /** Start timestamp */
  startTime: number;
  /** Input data */
  input?: Record<string, unknown>;
  /** Internal Opik span reference */
  _opikSpan?: ReturnType<ReturnType<Opik['trace']>['span']>;
}

/**
 * LLM call data for specialized tracing
 */
export interface LLMCallData {
  /** LLM provider (openai, anthropic, etc.) */
  provider: string;
  /** Model name */
  model: string;
  /** Input prompt or messages */
  input: unknown;
  /** Output response */
  output?: unknown;
  /** Token usage */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  /** Call duration in milliseconds */
  durationMs?: number;
  /** Error if call failed */
  error?: string;
}

/**
 * Observability error types
 */
export type ObservabilityErrorCode =
  | 'NOT_INITIALIZED'
  | 'INITIALIZATION_FAILED'
  | 'TRACE_FAILED'
  | 'FLUSH_FAILED';

/**
 * Observability error class
 */
export class ObservabilityError extends Error {
  constructor(
    public readonly code: ObservabilityErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ObservabilityError';
  }
}

// ============================================================================
// Opik Service
// ============================================================================

/**
 * Observability service using Opik SDK
 *
 * Provides tracing, span management, and LLM call logging for
 * comprehensive observability of agent operations.
 */
export class OpikService {
  private client: Opik | null = null;
  private _config: OpikConfig | null = null;
  private initialized = false;
  private enabled = true;

  /** Get current configuration (for testing) */
  get config(): OpikConfig | null {
    return this._config;
  }

  /**
   * Initialize the Opik service
   *
   * @param config - Opik configuration
   * @throws ObservabilityError if initialization fails
   */
  async initialize(config: OpikConfig): Promise<void> {
    this._config = config;
    this.enabled = config.enabled !== false;

    if (!this.enabled) {
      console.log('[Opik] Observability disabled via config');
      this.initialized = true;
      return;
    }

    try {
      this.client = new Opik({
        apiKey: config.apiKey,
        apiUrl: config.apiUrl,
        projectName: config.projectName,
        workspaceName: config.workspaceName,
      });

      this.initialized = true;
      console.log(`[Opik] Initialized for project: ${config.projectName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ObservabilityError(
        'INITIALIZATION_FAILED',
        `Failed to initialize Opik: ${message}`
      );
    }
  }

  /**
   * Check if service is ready for tracing
   *
   * Returns true if:
   * - Service is initialized AND enabled (will send traces), OR
   * - Service is initialized AND disabled (noop mode, safe to call trace methods)
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Check if tracing is enabled
   */
  isEnabled(): boolean {
    return this.initialized && this.enabled;
  }

  /**
   * Start a new trace for an operation
   *
   * @param operation - Operation name (e.g., 'agent:create', 'session:start')
   * @param metadata - Additional metadata for the trace
   * @returns TraceContext for tracking the operation
   */
  startTrace(
    operation: string,
    metadata: Record<string, unknown> = {}
  ): TraceContext {
    const traceId = crypto.randomUUID();
    const startTime = Date.now();

    const ctx: TraceContext = {
      traceId,
      operation,
      startTime,
      userId: metadata.userId as string | undefined,
      sessionId: metadata.sessionId as string | undefined,
      metadata,
    };

    if (this.client && this.enabled) {
      try {
        ctx._opikTrace = this.client.trace({
          name: operation,
          input: metadata,
        });
      } catch (error) {
        console.error('[Opik] Failed to start trace:', error);
      }
    }

    return ctx;
  }

  /**
   * End a trace and record the result
   *
   * @param ctx - Trace context from startTrace
   * @param result - Operation result (success data)
   * @param error - Error if operation failed
   */
  endTrace(ctx: TraceContext, result?: unknown, error?: Error): void {
    const durationMs = Date.now() - ctx.startTime;

    if (ctx._opikTrace && this.enabled) {
      try {
        // Update trace with output and end it
        if (error) {
          ctx._opikTrace.update({
            output: {
              error: error.message,
              stack: error.stack,
            },
          });
        } else if (result !== undefined) {
          ctx._opikTrace.update({
            output: result as Record<string, unknown>,
          });
        }

        ctx._opikTrace.end();
      } catch (err) {
        console.error('[Opik] Failed to end trace:', err);
      }
    }

    // Log summary
    const status = error ? 'FAILED' : 'OK';
    console.log(
      `[Trace] ${ctx.operation} ${status} (${durationMs}ms) traceId=${ctx.traceId}`
    );
  }

  /**
   * Start a span within a trace
   *
   * @param ctx - Parent trace context
   * @param name - Span name
   * @param type - Span type (general, llm, tool, guardrail)
   * @param input - Input data for the span
   * @returns SpanContext for tracking the sub-operation
   */
  startSpan(
    ctx: TraceContext,
    name: string,
    type: SpanContext['type'] = 'general',
    input?: Record<string, unknown>
  ): SpanContext {
    const spanId = crypto.randomUUID();
    const startTime = Date.now();

    const span: SpanContext = {
      spanId,
      trace: ctx,
      name,
      type,
      startTime,
      input,
    };

    if (ctx._opikTrace && this.enabled) {
      try {
        span._opikSpan = ctx._opikTrace.span({
          name,
          type,
          input,
        });
      } catch (error) {
        console.error('[Opik] Failed to start span:', error);
      }
    }

    return span;
  }

  /**
   * End a span and record output
   *
   * @param span - Span context from startSpan
   * @param output - Span output data
   */
  endSpan(span: SpanContext, output?: Record<string, unknown>): void {
    const durationMs = Date.now() - span.startTime;

    if (span._opikSpan && this.enabled) {
      try {
        if (output) {
          span._opikSpan.update({ output });
        }
        span._opikSpan.end();
      } catch (error) {
        console.error('[Opik] Failed to end span:', error);
      }
    }

    console.log(
      `[Span] ${span.trace.operation}/${span.name} (${durationMs}ms) spanId=${span.spanId}`
    );
  }

  /**
   * Log an LLM call with detailed metrics
   *
   * Creates an LLM-typed span with token usage and timing.
   *
   * @param ctx - Parent trace context
   * @param call - LLM call data
   */
  logLLMCall(ctx: TraceContext, call: LLMCallData): void {
    if (!ctx._opikTrace || !this.enabled) {
      return;
    }

    try {
      const llmSpan = ctx._opikTrace.span({
        name: `${call.provider}/${call.model}`,
        type: 'llm',
        input: { prompt: call.input },
        output: { response: call.output },
      });

      // Add usage metadata if available
      if (call.usage) {
        llmSpan.update({
          output: {
            response: call.output,
            usage: {
              prompt_tokens: call.usage.promptTokens,
              completion_tokens: call.usage.completionTokens,
              total_tokens: call.usage.totalTokens,
            },
          },
        });
      }

      llmSpan.end();

      console.log(
        `[LLM] ${call.provider}/${call.model} tokens=${call.usage?.totalTokens ?? 'n/a'}`
      );
    } catch (error) {
      console.error('[Opik] Failed to log LLM call:', error);
    }
  }

  /**
   * Record a metric (counter or gauge)
   *
   * @param name - Metric name
   * @param value - Metric value
   * @param tags - Additional tags for filtering
   */
  recordMetric(
    name: string,
    value: number,
    tags: Record<string, string> = {}
  ): void {
    // Opik doesn't have direct metric support, log for now
    // Future: integrate with Prometheus or similar
    console.log(`[Metric] ${name}=${value}`, tags);
  }

  /**
   * Flush all pending traces to Opik
   *
   * Call this before shutdown to ensure all traces are sent.
   */
  async flush(): Promise<void> {
    if (!this.client || !this.enabled) {
      return;
    }

    try {
      await this.client.flush();
      console.log('[Opik] Traces flushed successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ObservabilityError('FLUSH_FAILED', `Failed to flush traces: ${message}`);
    }
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    if (this.client && this.enabled) {
      await this.flush();
    }
    this.client = null;
    this.initialized = false;
    console.log('[Opik] Service shutdown');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let opikServiceInstance: OpikService | null = null;

/**
 * Get the global Opik service instance
 *
 * @throws ObservabilityError if not initialized
 */
export function getOpikService(): OpikService {
  if (!opikServiceInstance) {
    opikServiceInstance = new OpikService();
  }
  return opikServiceInstance;
}

/**
 * Initialize the global Opik service
 *
 * Should be called once at server startup.
 */
export async function initializeOpikService(
  config?: Partial<OpikConfig>
): Promise<OpikService> {
  const service = getOpikService();

  // Build config from environment variables
  const fullConfig: OpikConfig = {
    apiKey: config?.apiKey ?? process.env.OPIK_API_KEY,
    apiUrl: config?.apiUrl ?? process.env.OPIK_URL_OVERRIDE,
    projectName: config?.projectName ?? process.env.OPIK_PROJECT_NAME ?? 'mconnect',
    workspaceName: config?.workspaceName ?? process.env.OPIK_WORKSPACE_NAME,
    enabled: config?.enabled ?? process.env.OPIK_ENABLED !== 'false',
  };

  await service.initialize(fullConfig);
  return service;
}

/**
 * Reset the Opik service (for testing)
 */
export function resetOpikService(): void {
  if (opikServiceInstance) {
    opikServiceInstance.shutdown();
  }
  opikServiceInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Trace a function execution
 *
 * Wraps a function with automatic tracing.
 *
 * @example
 * ```ts
 * const result = await traced('agent:create', { sessionId }, async (ctx) => {
 *   // ... operation ...
 *   return agent;
 * });
 * ```
 */
export async function traced<T>(
  operation: string,
  metadata: Record<string, unknown>,
  fn: (ctx: TraceContext) => Promise<T>
): Promise<T> {
  const service = getOpikService();
  const ctx = service.startTrace(operation, metadata);

  try {
    const result = await fn(ctx);
    service.endTrace(ctx, result);
    return result;
  } catch (error) {
    service.endTrace(ctx, undefined, error as Error);
    throw error;
  }
}

/**
 * Create a traced span within an existing trace
 *
 * @example
 * ```ts
 * await withSpan(ctx, 'validate', 'general', { input }, async (span) => {
 *   // ... sub-operation ...
 * });
 * ```
 */
export async function withSpan<T>(
  ctx: TraceContext,
  name: string,
  type: SpanContext['type'],
  input: Record<string, unknown>,
  fn: (span: SpanContext) => Promise<T>
): Promise<T> {
  const service = getOpikService();
  const span = service.startSpan(ctx, name, type, input);

  try {
    const result = await fn(span);
    service.endSpan(span, { result });
    return result;
  } catch (error) {
    service.endSpan(span, { error: (error as Error).message });
    throw error;
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  OpikService,
  ObservabilityError,
  getOpikService,
  initializeOpikService,
  resetOpikService,
  traced,
  withSpan,
};
