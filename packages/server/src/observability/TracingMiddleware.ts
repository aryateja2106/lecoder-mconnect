/**
 * Tracing Middleware - Automatic Span Creation
 *
 * Provides middleware-style tracing for agent and MCP operations.
 * Automatically creates spans for operations, tracks user attribution,
 * and handles LLM token counting.
 *
 * @see spec §2.2.5 for TracingMiddleware reference
 */

import {
  getOpikService,
  type TraceContext,
  type SpanContext,
  type LLMCallData,
} from './OpikService.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Token usage extracted from agent output
 */
export interface TokenUsage {
  /** Input/prompt tokens */
  promptTokens: number;
  /** Output/completion tokens */
  completionTokens: number;
  /** Total tokens */
  totalTokens: number;
  /** Model name if detected */
  model?: string;
  /** Provider if detected */
  provider?: string;
}

/**
 * Session-level trace context that carries user attribution
 */
export interface SessionTraceContext {
  /** User ID for attribution */
  userId: string;
  /** Session ID */
  sessionId: string;
  /** Additional session metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Token Counting
// ============================================================================

/**
 * Known token usage patterns from various LLM providers.
 *
 * These patterns match output from Claude Code, Gemini CLI, and other
 * AI coding agents that report token usage in their output.
 */
const TOKEN_PATTERNS = [
  // Claude Code style: "Tokens: 1234 input, 5678 output"
  /[Tt]okens?:\s*(\d[\d,]*)\s*input\s*,?\s*(\d[\d,]*)\s*output/,
  // Anthropic API style: "prompt_tokens": 1234, "completion_tokens": 5678
  /"prompt_tokens"\s*:\s*(\d+)\s*,\s*"completion_tokens"\s*:\s*(\d+)/,
  // OpenAI API style: same as anthropic
  // Generic: "Usage: 1234 in / 5678 out"
  /[Uu]sage:\s*(\d[\d,]*)\s*in\s*\/?\s*(\d[\d,]*)\s*out/,
  // Token count summary: "Total tokens: 6912 (1234+5678)"
  /[Tt]otal\s*tokens?\s*:\s*(\d[\d,]*)\s*\((\d[\d,]*)\s*\+\s*(\d[\d,]*)\)/,
  // Claude usage block: input_tokens: 1234 output_tokens: 5678
  /input_tokens\s*:\s*(\d[\d,]*)\s*.*?output_tokens\s*:\s*(\d[\d,]*)/,
];

/**
 * Model detection patterns for provider attribution
 */
const MODEL_PATTERNS: Array<{ pattern: RegExp; provider: string; model: string }> = [
  { pattern: /claude-[\w.-]+/i, provider: 'anthropic', model: '' },
  { pattern: /gpt-[\w.-]+/i, provider: 'openai', model: '' },
  { pattern: /gemini-[\w.-]+/i, provider: 'google', model: '' },
  { pattern: /o[134]-[\w.-]+/i, provider: 'openai', model: '' },
];

/**
 * Parse comma-separated number string to integer
 */
function parseTokenCount(value: string): number {
  return parseInt(value.replace(/,/g, ''), 10) || 0;
}

/**
 * Extract token usage from agent output text
 *
 * Scans output for known token usage patterns from LLM providers.
 * Returns null if no token usage is detected.
 */
export function extractTokenUsage(output: string): TokenUsage | null {
  for (const pattern of TOKEN_PATTERNS) {
    const match = output.match(pattern);
    if (!match) continue;

    // Pattern with total(prompt+completion) - 3 groups
    if (match.length >= 4 && pattern.source.includes('\\+')) {
      const totalTokens = parseTokenCount(match[1]);
      const promptTokens = parseTokenCount(match[2]);
      const completionTokens = parseTokenCount(match[3]);
      return { promptTokens, completionTokens, totalTokens };
    }

    // Standard 2-group pattern (prompt, completion)
    if (match.length >= 3) {
      const promptTokens = parseTokenCount(match[1]);
      const completionTokens = parseTokenCount(match[2]);
      const totalTokens = promptTokens + completionTokens;
      return { promptTokens, completionTokens, totalTokens };
    }
  }

  return null;
}

/**
 * Detect model and provider from agent output
 */
export function detectModel(output: string): { provider: string; model: string } | null {
  for (const { pattern, provider } of MODEL_PATTERNS) {
    const match = output.match(pattern);
    if (match) {
      return { provider, model: match[0] };
    }
  }
  return null;
}

// ============================================================================
// TracingMiddleware Class
// ============================================================================

/**
 * Tracing middleware for automatic span creation and management
 *
 * Provides:
 * - Automatic trace/span lifecycle for agent operations
 * - User attribution on all traces
 * - LLM token counting from agent output
 * - Guardrail check tracing
 */
export class TracingMiddleware {
  /** Active traces by agent ID */
  private agentTraces: Map<string, TraceContext> = new Map();

  /** Session context for user attribution */
  private sessionContexts: Map<string, SessionTraceContext> = new Map();

  /** Accumulated token usage per agent */
  private agentTokenUsage: Map<string, TokenUsage> = new Map();

  // ==========================================================================
  // Session Context
  // ==========================================================================

  /**
   * Register session context for user attribution
   */
  setSessionContext(sessionId: string, context: SessionTraceContext): void {
    this.sessionContexts.set(sessionId, context);
  }

  /**
   * Remove session context
   */
  removeSessionContext(sessionId: string): void {
    this.sessionContexts.delete(sessionId);
  }

  /**
   * Get session context for a session ID
   */
  getSessionContext(sessionId: string): SessionTraceContext | undefined {
    return this.sessionContexts.get(sessionId);
  }

  // ==========================================================================
  // Agent Lifecycle Tracing
  // ==========================================================================

  /**
   * Start a traced agent lifecycle
   *
   * Creates a long-running trace that spans the agent's entire lifetime.
   * All agent operations (I/O, MCP, guardrails) are recorded as spans
   * within this trace.
   */
  startAgentTrace(
    agentId: string,
    sessionId: string,
    metadata: Record<string, unknown> = {}
  ): TraceContext {
    const opik = getOpikService();
    const sessionCtx = this.sessionContexts.get(sessionId);

    const traceMetadata: Record<string, unknown> = {
      agentId,
      sessionId,
      ...metadata,
    };

    // Add user attribution if available
    if (sessionCtx) {
      traceMetadata.userId = sessionCtx.userId;
    }

    const ctx = opik.startTrace('agent:lifecycle', traceMetadata);

    // Apply user attribution to trace context
    if (sessionCtx) {
      ctx.userId = sessionCtx.userId;
      ctx.sessionId = sessionCtx.sessionId;
    }

    this.agentTraces.set(agentId, ctx);
    return ctx;
  }

  /**
   * End an agent lifecycle trace
   */
  endAgentTrace(agentId: string, result?: unknown, error?: Error): void {
    const ctx = this.agentTraces.get(agentId);
    if (!ctx) return;

    const opik = getOpikService();
    const tokenUsage = this.agentTokenUsage.get(agentId);

    const output: Record<string, unknown> = {};
    if (result !== undefined) {
      output.result = result;
    }
    if (tokenUsage) {
      output.totalTokenUsage = tokenUsage;
    }

    opik.endTrace(ctx, Object.keys(output).length > 0 ? output : result, error);
    this.agentTraces.delete(agentId);
    this.agentTokenUsage.delete(agentId);
  }

  /**
   * Get the active trace for an agent
   */
  getAgentTrace(agentId: string): TraceContext | undefined {
    return this.agentTraces.get(agentId);
  }

  // ==========================================================================
  // Operation Spans
  // ==========================================================================

  /**
   * Trace an agent operation as a span within the agent's lifecycle trace
   *
   * If no agent lifecycle trace exists, creates a standalone trace.
   */
  traceAgentOperation<T>(
    agentId: string,
    operation: string,
    input: Record<string, unknown>,
    fn: (span: SpanContext) => T | Promise<T>
  ): T | Promise<T> {
    const opik = getOpikService();
    const agentTrace = this.agentTraces.get(agentId);

    if (agentTrace) {
      // Create span within existing agent trace
      const span = opik.startSpan(agentTrace, operation, 'general', input);
      try {
        const result = fn(span);
        if (result instanceof Promise) {
          return result.then(
            (r) => { opik.endSpan(span, { result: r }); return r; },
            (e) => { opik.endSpan(span, { error: (e as Error).message }); throw e; }
          );
        }
        opik.endSpan(span, { result });
        return result;
      } catch (e) {
        opik.endSpan(span, { error: (e as Error).message });
        throw e;
      }
    }

    // No agent trace - create standalone trace
    const ctx = opik.startTrace(`agent:${operation}`, { agentId, ...input });
    const span = opik.startSpan(ctx, operation, 'general', input);
    try {
      const result = fn(span);
      if (result instanceof Promise) {
        return result.then(
          (r) => { opik.endSpan(span, { result: r }); opik.endTrace(ctx, { result: r }); return r; },
          (e) => { opik.endSpan(span, { error: (e as Error).message }); opik.endTrace(ctx, undefined, e as Error); throw e; }
        );
      }
      opik.endSpan(span, { result });
      opik.endTrace(ctx, { result });
      return result;
    } catch (e) {
      opik.endSpan(span, { error: (e as Error).message });
      opik.endTrace(ctx, undefined, e as Error);
      throw e;
    }
  }

  // ==========================================================================
  // MCP Tracing
  // ==========================================================================

  /**
   * Trace an MCP request as a tool-type span
   */
  traceMCPRequest(
    agentId: string,
    method: string,
    params?: unknown
  ): { span: SpanContext; trace: TraceContext } | null {
    const opik = getOpikService();
    const agentTrace = this.agentTraces.get(agentId);

    if (!agentTrace) {
      // Create standalone trace for MCP operation
      const trace = opik.startTrace('mcp:request', {
        agentId,
        method,
      });
      const span = opik.startSpan(trace, `mcp:${method}`, 'tool', {
        method,
        params: params as Record<string, unknown>,
      });
      return { span, trace };
    }

    const span = opik.startSpan(agentTrace, `mcp:${method}`, 'tool', {
      method,
      params: params as Record<string, unknown>,
    });
    return { span, trace: agentTrace };
  }

  /**
   * End an MCP request span
   */
  endMCPRequest(
    spanInfo: { span: SpanContext; trace: TraceContext } | null,
    result?: unknown,
    error?: Error
  ): void {
    if (!spanInfo) return;

    const opik = getOpikService();
    const { span, trace } = spanInfo;

    if (error) {
      opik.endSpan(span, { error: error.message });
    } else {
      opik.endSpan(span, { result });
    }

    // If this was a standalone trace (not part of agent lifecycle), end it
    if (!this.isAgentLifecycleTrace(trace)) {
      opik.endTrace(trace, error ? undefined : { result }, error);
    }
  }

  // ==========================================================================
  // Guardrail Tracing
  // ==========================================================================

  /**
   * Trace a guardrail check as a guardrail-type span
   */
  traceGuardrailCheck(
    agentId: string,
    command: string,
    level: string,
    result: { blocked: boolean; requiresApproval: boolean; reason?: string }
  ): void {
    const opik = getOpikService();
    const agentTrace = this.agentTraces.get(agentId);
    if (!agentTrace) return;

    const span = opik.startSpan(agentTrace, 'guardrail:check', 'guardrail', {
      command,
      level,
    });

    opik.endSpan(span, {
      blocked: result.blocked,
      requiresApproval: result.requiresApproval,
      reason: result.reason,
    });
  }

  // ==========================================================================
  // Token Counting
  // ==========================================================================

  /**
   * Process agent output for token usage detection
   *
   * Call this with agent output to automatically detect and log
   * LLM token usage patterns.
   */
  processAgentOutput(agentId: string, output: string): TokenUsage | null {
    const usage = extractTokenUsage(output);
    if (!usage) return null;

    // Detect model
    const modelInfo = detectModel(output);

    // Accumulate token usage for the agent
    const existing = this.agentTokenUsage.get(agentId);
    if (existing) {
      existing.promptTokens += usage.promptTokens;
      existing.completionTokens += usage.completionTokens;
      existing.totalTokens += usage.totalTokens;
    } else {
      this.agentTokenUsage.set(agentId, { ...usage });
    }

    // Log LLM call to Opik
    const agentTrace = this.agentTraces.get(agentId);
    if (agentTrace) {
      const opik = getOpikService();
      const llmCallData: LLMCallData = {
        provider: modelInfo?.provider ?? usage.provider ?? 'unknown',
        model: modelInfo?.model ?? usage.model ?? 'unknown',
        input: { type: 'agent_output_detected' },
        output: { type: 'agent_output_detected' },
        usage: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        },
      };

      opik.logLLMCall(agentTrace, llmCallData);
    }

    return usage;
  }

  /**
   * Get accumulated token usage for an agent
   */
  getAgentTokenUsage(agentId: string): TokenUsage | undefined {
    return this.agentTokenUsage.get(agentId);
  }

  // ==========================================================================
  // Utility
  // ==========================================================================

  /**
   * Check if a trace is an agent lifecycle trace (not standalone)
   */
  private isAgentLifecycleTrace(trace: TraceContext): boolean {
    for (const agentTrace of this.agentTraces.values()) {
      if (agentTrace.traceId === trace.traceId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Cleanup all state
   */
  cleanup(): void {
    // End all active traces
    const opik = getOpikService();
    for (const [agentId, ctx] of this.agentTraces.entries()) {
      const tokenUsage = this.agentTokenUsage.get(agentId);
      opik.endTrace(ctx, { cleanup: true, tokenUsage });
    }

    this.agentTraces.clear();
    this.sessionContexts.clear();
    this.agentTokenUsage.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let middlewareInstance: TracingMiddleware | null = null;

/**
 * Get the global TracingMiddleware instance
 */
export function getTracingMiddleware(): TracingMiddleware {
  if (!middlewareInstance) {
    middlewareInstance = new TracingMiddleware();
  }
  return middlewareInstance;
}

/**
 * Reset the TracingMiddleware (for testing)
 */
export function resetTracingMiddleware(): void {
  if (middlewareInstance) {
    middlewareInstance.cleanup();
  }
  middlewareInstance = null;
}
