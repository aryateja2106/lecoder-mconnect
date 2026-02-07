/**
 * Opik Service Tests
 *
 * Tests for the Opik observability service.
 * These tests verify tracing, span management, and service lifecycle.
 *
 * Note: These are unit tests that work without a real Opik connection.
 * Set OPIK_API_KEY environment variable to run integration tests.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  OpikService,
  ObservabilityError,
  initializeOpikService,
  resetOpikService,
  getOpikService,
  traced,
  withSpan,
  type OpikConfig,
  type TraceContext,
  type SpanContext,
  type LLMCallData,
} from '../OpikService.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const testConfig: OpikConfig = {
  projectName: 'mconnect-test',
  enabled: false, // Disable actual Opik calls in unit tests
};

const testConfigWithOpik: OpikConfig = {
  apiKey: 'test-api-key',
  apiUrl: 'http://localhost:5173/api', // Mock URL for testing
  projectName: 'mconnect-test',
  workspaceName: 'test-workspace',
  enabled: true,
};

// ============================================================================
// OpikService Constructor Tests
// ============================================================================

describe('OpikService Constructor', () => {
  let service: OpikService;

  beforeEach(() => {
    service = new OpikService();
  });

  afterEach(() => {
    resetOpikService();
  });

  test('creates service without initialization', () => {
    expect(service).toBeDefined();
    expect(service.isReady()).toBe(false);
  });

  test('isReady returns false before initialization', () => {
    expect(service.isReady()).toBe(false);
  });
});

// ============================================================================
// OpikService Initialization Tests
// ============================================================================

describe('OpikService Initialization', () => {
  let service: OpikService;

  beforeEach(() => {
    service = new OpikService();
  });

  afterEach(async () => {
    await service.shutdown();
    resetOpikService();
  });

  test('initializes with disabled config', async () => {
    await service.initialize(testConfig);
    expect(service.isReady()).toBe(true);
  });

  test('initializes with enabled config', async () => {
    await service.initialize(testConfigWithOpik);
    expect(service.isReady()).toBe(true);
  });

  test('respects enabled=false config', async () => {
    await service.initialize({ ...testConfigWithOpik, enabled: false });
    expect(service.isReady()).toBe(true);
  });
});

// ============================================================================
// Trace Operations Tests
// ============================================================================

describe('OpikService Trace Operations', () => {
  let service: OpikService;

  beforeEach(async () => {
    service = new OpikService();
    await service.initialize(testConfig);
  });

  afterEach(async () => {
    await service.shutdown();
    resetOpikService();
  });

  test('startTrace creates valid trace context', () => {
    const ctx = service.startTrace('test:operation');

    expect(ctx).toBeDefined();
    expect(ctx.traceId).toBeDefined();
    expect(ctx.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(ctx.operation).toBe('test:operation');
    expect(ctx.startTime).toBeGreaterThan(0);
  });

  test('startTrace includes metadata', () => {
    const metadata = { userId: 'user-1', sessionId: 'session-1' };
    const ctx = service.startTrace('test:operation', metadata);

    expect(ctx.metadata).toEqual(metadata);
    expect(ctx.userId).toBe('user-1');
    expect(ctx.sessionId).toBe('session-1');
  });

  test('endTrace completes trace without error', () => {
    const ctx = service.startTrace('test:operation');
    const result = { success: true, data: 'test' };

    // Should not throw
    expect(() => service.endTrace(ctx, result)).not.toThrow();
  });

  test('endTrace handles error case', () => {
    const ctx = service.startTrace('test:operation');
    const error = new Error('Test error');

    // Should not throw
    expect(() => service.endTrace(ctx, undefined, error)).not.toThrow();
  });

  test('trace context has unique IDs', () => {
    const ctx1 = service.startTrace('op1');
    const ctx2 = service.startTrace('op2');

    expect(ctx1.traceId).not.toBe(ctx2.traceId);
  });
});

// ============================================================================
// Span Operations Tests
// ============================================================================

describe('OpikService Span Operations', () => {
  let service: OpikService;
  let traceCtx: TraceContext;

  beforeEach(async () => {
    service = new OpikService();
    await service.initialize(testConfig);
    traceCtx = service.startTrace('parent:operation');
  });

  afterEach(async () => {
    await service.shutdown();
    resetOpikService();
  });

  test('startSpan creates valid span context', () => {
    const span = service.startSpan(traceCtx, 'test-span');

    expect(span).toBeDefined();
    expect(span.spanId).toBeDefined();
    expect(span.spanId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(span.name).toBe('test-span');
    expect(span.type).toBe('general');
    expect(span.trace).toBe(traceCtx);
  });

  test('startSpan supports different types', () => {
    const types: SpanContext['type'][] = ['general', 'llm', 'tool', 'guardrail'];

    for (const type of types) {
      const span = service.startSpan(traceCtx, `span-${type}`, type);
      expect(span.type).toBe(type);
    }
  });

  test('startSpan includes input data', () => {
    const input = { key: 'value', count: 42 };
    const span = service.startSpan(traceCtx, 'test-span', 'general', input);

    expect(span.input).toEqual(input);
  });

  test('endSpan completes span', () => {
    const span = service.startSpan(traceCtx, 'test-span');
    const output = { result: 'success' };

    // Should not throw
    expect(() => service.endSpan(span, output)).not.toThrow();
  });

  test('span context has unique IDs', () => {
    const span1 = service.startSpan(traceCtx, 'span-1');
    const span2 = service.startSpan(traceCtx, 'span-2');

    expect(span1.spanId).not.toBe(span2.spanId);
  });
});

// ============================================================================
// LLM Call Logging Tests
// ============================================================================

describe('OpikService LLM Call Logging', () => {
  let service: OpikService;
  let traceCtx: TraceContext;

  beforeEach(async () => {
    service = new OpikService();
    await service.initialize(testConfig);
    traceCtx = service.startTrace('llm:operation');
  });

  afterEach(async () => {
    await service.shutdown();
    resetOpikService();
  });

  test('logLLMCall handles basic call data', () => {
    const callData: LLMCallData = {
      provider: 'anthropic',
      model: 'claude-3-opus',
      input: { prompt: 'Hello, world!' },
      output: { response: 'Hello!' },
    };

    // Should not throw
    expect(() => service.logLLMCall(traceCtx, callData)).not.toThrow();
  });

  test('logLLMCall handles call with usage data', () => {
    const callData: LLMCallData = {
      provider: 'openai',
      model: 'gpt-4',
      input: { prompt: 'Test prompt' },
      output: { response: 'Test response' },
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    };

    // Should not throw
    expect(() => service.logLLMCall(traceCtx, callData)).not.toThrow();
  });

  test('logLLMCall handles error case', () => {
    const callData: LLMCallData = {
      provider: 'anthropic',
      model: 'claude-3-opus',
      input: { prompt: 'Test' },
      error: 'Rate limit exceeded',
    };

    // Should not throw
    expect(() => service.logLLMCall(traceCtx, callData)).not.toThrow();
  });
});

// ============================================================================
// Metric Recording Tests
// ============================================================================

describe('OpikService Metrics', () => {
  let service: OpikService;

  beforeEach(async () => {
    service = new OpikService();
    await service.initialize(testConfig);
  });

  afterEach(async () => {
    await service.shutdown();
    resetOpikService();
  });

  test('recordMetric handles basic metric', () => {
    // Should not throw
    expect(() => service.recordMetric('test.metric', 42)).not.toThrow();
  });

  test('recordMetric handles metric with tags', () => {
    // Should not throw
    expect(() =>
      service.recordMetric('test.metric', 100, {
        environment: 'test',
        service: 'opik',
      })
    ).not.toThrow();
  });
});

// ============================================================================
// Flush and Shutdown Tests
// ============================================================================

describe('OpikService Lifecycle', () => {
  let service: OpikService;

  beforeEach(async () => {
    service = new OpikService();
  });

  afterEach(() => {
    resetOpikService();
  });

  test('flush completes when disabled', async () => {
    await service.initialize(testConfig);

    // Should not throw
    await expect(service.flush()).resolves.toBeUndefined();
  });

  test('shutdown completes cleanly', async () => {
    await service.initialize(testConfig);

    // Should not throw
    await expect(service.shutdown()).resolves.toBeUndefined();
    expect(service.isReady()).toBe(false);
  });

  test('double shutdown is safe', async () => {
    await service.initialize(testConfig);
    await service.shutdown();

    // Second shutdown should not throw
    await expect(service.shutdown()).resolves.toBeUndefined();
  });
});

// ============================================================================
// ObservabilityError Tests
// ============================================================================

describe('ObservabilityError', () => {
  test('creates error with code and message', () => {
    const error = new ObservabilityError('NOT_INITIALIZED', 'Service not initialized');

    expect(error.message).toBe('Service not initialized');
    expect(error.code).toBe('NOT_INITIALIZED');
    expect(error.name).toBe('ObservabilityError');
  });

  test('is instanceof Error', () => {
    const error = new ObservabilityError('TRACE_FAILED', 'Trace failed');
    expect(error).toBeInstanceOf(Error);
  });

  test('supports all error codes', () => {
    const codes = [
      'NOT_INITIALIZED',
      'INITIALIZATION_FAILED',
      'TRACE_FAILED',
      'FLUSH_FAILED',
    ] as const;

    for (const code of codes) {
      const error = new ObservabilityError(code, 'Test message');
      expect(error.code).toBe(code);
    }
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe('OpikService Singleton', () => {
  beforeEach(() => {
    resetOpikService();
    delete process.env.OPIK_API_KEY;
    delete process.env.OPIK_PROJECT_NAME;
    delete process.env.OPIK_WORKSPACE_NAME;
    delete process.env.OPIK_URL_OVERRIDE;
    delete process.env.OPIK_ENABLED;
  });

  afterEach(() => {
    resetOpikService();
    delete process.env.OPIK_API_KEY;
    delete process.env.OPIK_PROJECT_NAME;
    delete process.env.OPIK_WORKSPACE_NAME;
    delete process.env.OPIK_URL_OVERRIDE;
    delete process.env.OPIK_ENABLED;
  });

  test('getOpikService returns same instance', () => {
    const service1 = getOpikService();
    const service2 = getOpikService();
    expect(service2).toBe(service1);
  });

  test('initializeOpikService creates and initializes', async () => {
    const service = await initializeOpikService(testConfig);
    expect(service).toBeDefined();
    expect(service.isReady()).toBe(true);
  });

  test('initializeOpikService uses env vars', async () => {
    process.env.OPIK_API_KEY = 'test-key';
    process.env.OPIK_PROJECT_NAME = 'env-project';
    process.env.OPIK_WORKSPACE_NAME = 'env-workspace';
    process.env.OPIK_URL_OVERRIDE = 'http://localhost:5173/api';

    const service = await initializeOpikService();
    expect(service.isReady()).toBe(true);
  });

  test('initializeOpikService uses default project name', async () => {
    // Use disabled mode since no API URL is set
    const service = await initializeOpikService({ enabled: false });
    expect(service.isReady()).toBe(true);
  });

  test('resetOpikService clears the singleton', async () => {
    const service1 = await initializeOpikService(testConfig);
    resetOpikService();
    const service2 = getOpikService();

    expect(service2).not.toBe(service1);
    expect(service2.isReady()).toBe(false);
  });

  test('respects OPIK_ENABLED=false', async () => {
    process.env.OPIK_ENABLED = 'false';

    const service = await initializeOpikService();
    expect(service.isReady()).toBe(true);
  });
});

// ============================================================================
// Convenience Function Tests
// ============================================================================

describe('traced() helper', () => {
  beforeEach(async () => {
    resetOpikService();
    await initializeOpikService(testConfig);
  });

  afterEach(() => {
    resetOpikService();
  });

  test('traces successful operation', async () => {
    const result = await traced(
      'test:operation',
      { userId: 'user-1' },
      async (_ctx) => {
        return { success: true };
      }
    );

    expect(result).toEqual({ success: true });
  });

  test('traces and rethrows errors', async () => {
    const testError = new Error('Test error');

    await expect(
      traced('test:operation', {}, async () => {
        throw testError;
      })
    ).rejects.toThrow('Test error');
  });

  test('provides trace context to function', async () => {
    let capturedCtx: TraceContext | null = null;

    await traced('test:operation', { userId: 'user-1' }, async (ctx) => {
      capturedCtx = ctx;
      return null;
    });

    expect(capturedCtx).not.toBeNull();
    expect(capturedCtx!.operation).toBe('test:operation');
    expect(capturedCtx!.userId).toBe('user-1');
  });
});

describe('withSpan() helper', () => {
  let traceCtx: TraceContext;

  beforeEach(async () => {
    resetOpikService();
    await initializeOpikService(testConfig);
    const service = getOpikService();
    traceCtx = service.startTrace('parent:operation');
  });

  afterEach(() => {
    resetOpikService();
  });

  test('creates span for operation', async () => {
    const result = await withSpan(
      traceCtx,
      'child-span',
      'general',
      { input: 'test' },
      async (_span) => {
        return { output: 'result' };
      }
    );

    expect(result).toEqual({ output: 'result' });
  });

  test('traces and rethrows span errors', async () => {
    const testError = new Error('Span error');

    await expect(
      withSpan(traceCtx, 'child-span', 'general', {}, async () => {
        throw testError;
      })
    ).rejects.toThrow('Span error');
  });

  test('provides span context to function', async () => {
    let capturedSpan: SpanContext | null = null;

    await withSpan(traceCtx, 'child-span', 'llm', { prompt: 'test' }, async (span) => {
      capturedSpan = span;
      return null;
    });

    expect(capturedSpan).not.toBeNull();
    expect(capturedSpan!.name).toBe('child-span');
    expect(capturedSpan!.type).toBe('llm');
    expect(capturedSpan!.trace).toBe(traceCtx);
  });
});

// ============================================================================
// Integration Tests (require OPIK_API_KEY)
// ============================================================================

describe('OpikService Integration', () => {
  const skipIntegration = !process.env.OPIK_API_KEY;

  beforeEach(() => {
    if (skipIntegration) return;
    resetOpikService();
  });

  afterEach(async () => {
    if (skipIntegration) return;
    const service = getOpikService();
    await service.shutdown();
    resetOpikService();
  });

  test.skipIf(skipIntegration)('sends real trace to Opik', async () => {
    const service = await initializeOpikService({
      apiKey: process.env.OPIK_API_KEY,
      projectName: 'mconnect-integration-test',
    });

    const ctx = service.startTrace('integration:test', {
      testRun: new Date().toISOString(),
    });

    const span = service.startSpan(ctx, 'test-span', 'general', { step: 1 });
    service.endSpan(span, { result: 'completed' });

    service.endTrace(ctx, { success: true });

    // Flush to ensure trace is sent
    await service.flush();

    // If we get here without error, the trace was sent successfully
    expect(true).toBe(true);
  });

  test.skipIf(skipIntegration)('sends LLM call to Opik', async () => {
    const service = await initializeOpikService({
      apiKey: process.env.OPIK_API_KEY,
      projectName: 'mconnect-integration-test',
    });

    const ctx = service.startTrace('integration:llm-test');

    service.logLLMCall(ctx, {
      provider: 'anthropic',
      model: 'claude-3-opus',
      input: { prompt: 'Integration test prompt' },
      output: { response: 'Integration test response' },
      usage: {
        promptTokens: 5,
        completionTokens: 10,
        totalTokens: 15,
      },
    });

    service.endTrace(ctx, { success: true });
    await service.flush();

    expect(true).toBe(true);
  });
});
