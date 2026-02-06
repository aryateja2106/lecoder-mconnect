/**
 * Observability Module
 *
 * Opik SDK integration for tracing and monitoring.
 * - Trace spans
 * - Token counting
 * - User attribution
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
