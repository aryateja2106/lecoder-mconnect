/**
 * Observability Module
 *
 * Opik SDK integration for tracing and monitoring.
 * - Trace spans
 * - Token counting
 * - User attribution
 * - Tracing middleware for automatic span creation
 */

export {
  // Core service
  OpikService,
  ObservabilityError,
  getOpikService,
  initializeOpikService,
  resetOpikService,
  // Convenience functions
  traced,
  withSpan,
  // Types
  type OpikConfig,
  type TraceContext,
  type SpanContext,
  type LLMCallData,
  type ObservabilityErrorCode,
} from './OpikService.js';

export {
  // Tracing middleware
  TracingMiddleware,
  getTracingMiddleware,
  resetTracingMiddleware,
  // Token counting utilities
  extractTokenUsage,
  detectModel,
  // Types
  type TokenUsage,
  type SessionTraceContext,
} from './TracingMiddleware.js';
