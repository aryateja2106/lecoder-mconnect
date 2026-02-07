/**
 * TracingMiddleware Tests
 *
 * Tests for the tracing middleware, including:
 * - Session context and user attribution
 * - Agent lifecycle tracing
 * - MCP request tracing
 * - Guardrail check tracing
 * - Token counting from agent output
 * - Model detection
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  TracingMiddleware,
  getTracingMiddleware,
  resetTracingMiddleware,
  extractTokenUsage,
  detectModel,
  type SessionTraceContext,
} from '../TracingMiddleware.js';
import {
  initializeOpikService,
  resetOpikService,
  type OpikConfig,
} from '../OpikService.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const testConfig: OpikConfig = {
  projectName: 'mconnect-test',
  enabled: false,
};

const testSessionContext: SessionTraceContext = {
  userId: 'user-123',
  sessionId: 'session-456',
};

// ============================================================================
// extractTokenUsage Tests
// ============================================================================

describe('extractTokenUsage', () => {
  test('extracts Claude Code style token usage', () => {
    const output = 'Tokens: 1,234 input, 5,678 output';
    const usage = extractTokenUsage(output);

    expect(usage).not.toBeNull();
    expect(usage!.promptTokens).toBe(1234);
    expect(usage!.completionTokens).toBe(5678);
    expect(usage!.totalTokens).toBe(6912);
  });

  test('extracts token usage without commas', () => {
    const output = 'Tokens: 100 input, 200 output';
    const usage = extractTokenUsage(output);

    expect(usage).not.toBeNull();
    expect(usage!.promptTokens).toBe(100);
    expect(usage!.completionTokens).toBe(200);
    expect(usage!.totalTokens).toBe(300);
  });

  test('extracts JSON-style token usage', () => {
    const output = '{"prompt_tokens": 500, "completion_tokens": 300}';
    const usage = extractTokenUsage(output);

    expect(usage).not.toBeNull();
    expect(usage!.promptTokens).toBe(500);
    expect(usage!.completionTokens).toBe(300);
    expect(usage!.totalTokens).toBe(800);
  });

  test('extracts Usage: X in / Y out format', () => {
    const output = 'Usage: 1000 in / 2000 out';
    const usage = extractTokenUsage(output);

    expect(usage).not.toBeNull();
    expect(usage!.promptTokens).toBe(1000);
    expect(usage!.completionTokens).toBe(2000);
    expect(usage!.totalTokens).toBe(3000);
  });

  test('extracts total tokens with breakdown', () => {
    const output = 'Total tokens: 6912 (1234+5678)';
    const usage = extractTokenUsage(output);

    expect(usage).not.toBeNull();
    expect(usage!.totalTokens).toBe(6912);
    expect(usage!.promptTokens).toBe(1234);
    expect(usage!.completionTokens).toBe(5678);
  });

  test('extracts input_tokens/output_tokens format', () => {
    const output = 'input_tokens: 400 output_tokens: 600';
    const usage = extractTokenUsage(output);

    expect(usage).not.toBeNull();
    expect(usage!.promptTokens).toBe(400);
    expect(usage!.completionTokens).toBe(600);
    expect(usage!.totalTokens).toBe(1000);
  });

  test('returns null for non-token output', () => {
    const output = 'Hello, world! This is just regular text.';
    const usage = extractTokenUsage(output);

    expect(usage).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(extractTokenUsage('')).toBeNull();
  });
});

// ============================================================================
// detectModel Tests
// ============================================================================

describe('detectModel', () => {
  test('detects Claude model', () => {
    const output = 'Using model: claude-3-opus-20240229';
    const model = detectModel(output);

    expect(model).not.toBeNull();
    expect(model!.provider).toBe('anthropic');
    expect(model!.model).toBe('claude-3-opus-20240229');
  });

  test('detects GPT model', () => {
    const output = 'Model: gpt-4-turbo-preview';
    const model = detectModel(output);

    expect(model).not.toBeNull();
    expect(model!.provider).toBe('openai');
    expect(model!.model).toBe('gpt-4-turbo-preview');
  });

  test('detects Gemini model', () => {
    const output = 'Using gemini-1.5-pro for analysis';
    const model = detectModel(output);

    expect(model).not.toBeNull();
    expect(model!.provider).toBe('google');
    expect(model!.model).toBe('gemini-1.5-pro');
  });

  test('returns null for no model', () => {
    const output = 'No model specified in this text';
    const model = detectModel(output);

    expect(model).toBeNull();
  });
});

// ============================================================================
// TracingMiddleware - Session Context Tests
// ============================================================================

describe('TracingMiddleware - Session Context', () => {
  let middleware: TracingMiddleware;

  beforeEach(async () => {
    resetOpikService();
    resetTracingMiddleware();
    await initializeOpikService(testConfig);
    middleware = new TracingMiddleware();
  });

  afterEach(() => {
    middleware.cleanup();
    resetOpikService();
    resetTracingMiddleware();
  });

  test('sets and gets session context', () => {
    middleware.setSessionContext('session-1', testSessionContext);

    const ctx = middleware.getSessionContext('session-1');
    expect(ctx).toBeDefined();
    expect(ctx!.userId).toBe('user-123');
    expect(ctx!.sessionId).toBe('session-456');
  });

  test('returns undefined for unknown session', () => {
    expect(middleware.getSessionContext('unknown')).toBeUndefined();
  });

  test('removes session context', () => {
    middleware.setSessionContext('session-1', testSessionContext);
    middleware.removeSessionContext('session-1');

    expect(middleware.getSessionContext('session-1')).toBeUndefined();
  });

  test('overwrites existing session context', () => {
    middleware.setSessionContext('session-1', testSessionContext);
    middleware.setSessionContext('session-1', {
      userId: 'user-999',
      sessionId: 'session-999',
    });

    const ctx = middleware.getSessionContext('session-1');
    expect(ctx!.userId).toBe('user-999');
  });
});

// ============================================================================
// TracingMiddleware - Agent Lifecycle Tests
// ============================================================================

describe('TracingMiddleware - Agent Lifecycle', () => {
  let middleware: TracingMiddleware;

  beforeEach(async () => {
    resetOpikService();
    resetTracingMiddleware();
    await initializeOpikService(testConfig);
    middleware = new TracingMiddleware();
  });

  afterEach(() => {
    middleware.cleanup();
    resetOpikService();
    resetTracingMiddleware();
  });

  test('starts agent trace', () => {
    const ctx = middleware.startAgentTrace('agent-1', 'session-1', {
      agentType: 'claude',
    });

    expect(ctx).toBeDefined();
    expect(ctx.traceId).toBeDefined();
    expect(ctx.operation).toBe('agent:lifecycle');
  });

  test('agent trace includes user attribution from session context', () => {
    middleware.setSessionContext('session-1', testSessionContext);

    const ctx = middleware.startAgentTrace('agent-1', 'session-1');

    expect(ctx.userId).toBe('user-123');
    expect(ctx.sessionId).toBe('session-456');
  });

  test('gets active agent trace', () => {
    middleware.startAgentTrace('agent-1', 'session-1');

    const trace = middleware.getAgentTrace('agent-1');
    expect(trace).toBeDefined();
    expect(trace!.operation).toBe('agent:lifecycle');
  });

  test('returns undefined for unknown agent trace', () => {
    expect(middleware.getAgentTrace('unknown')).toBeUndefined();
  });

  test('ends agent trace', () => {
    middleware.startAgentTrace('agent-1', 'session-1');

    middleware.endAgentTrace('agent-1', { status: 'exited' });

    expect(middleware.getAgentTrace('agent-1')).toBeUndefined();
  });

  test('end is safe for unknown agent', () => {
    // Should not throw
    middleware.endAgentTrace('unknown');
  });

  test('end includes accumulated token usage', () => {
    middleware.startAgentTrace('agent-1', 'session-1');

    // Simulate token usage accumulation
    middleware.processAgentOutput('agent-1', 'Tokens: 100 input, 200 output');

    const usage = middleware.getAgentTokenUsage('agent-1');
    expect(usage).toBeDefined();
    expect(usage!.totalTokens).toBe(300);

    middleware.endAgentTrace('agent-1', { status: 'exited' });

    // Token usage should be cleared after end
    expect(middleware.getAgentTokenUsage('agent-1')).toBeUndefined();
  });
});

// ============================================================================
// TracingMiddleware - Operation Span Tests
// ============================================================================

describe('TracingMiddleware - Operation Spans', () => {
  let middleware: TracingMiddleware;

  beforeEach(async () => {
    resetOpikService();
    resetTracingMiddleware();
    await initializeOpikService(testConfig);
    middleware = new TracingMiddleware();
  });

  afterEach(() => {
    middleware.cleanup();
    resetOpikService();
    resetTracingMiddleware();
  });

  test('traces operation within agent lifecycle', async () => {
    middleware.startAgentTrace('agent-1', 'session-1');

    const result = await middleware.traceAgentOperation(
      'agent-1',
      'write',
      { data: 'test' },
      async (_span) => {
        return { success: true };
      }
    );

    expect(result).toEqual({ success: true });
  });

  test('traces operation without agent lifecycle (standalone)', async () => {
    // No agent trace exists - should still work
    const result = await middleware.traceAgentOperation(
      'agent-1',
      'write',
      { data: 'test' },
      async (_span) => {
        return { standalone: true };
      }
    );

    expect(result).toEqual({ standalone: true });
  });

  test('handles sync operations', () => {
    middleware.startAgentTrace('agent-1', 'session-1');

    const result = middleware.traceAgentOperation(
      'agent-1',
      'status-check',
      {},
      (_span) => {
        return 'running';
      }
    );

    expect(result).toBe('running');
  });

  test('traces and rethrows errors', async () => {
    middleware.startAgentTrace('agent-1', 'session-1');

    await expect(
      middleware.traceAgentOperation(
        'agent-1',
        'failing-op',
        {},
        async () => {
          throw new Error('Operation failed');
        }
      )
    ).rejects.toThrow('Operation failed');
  });
});

// ============================================================================
// TracingMiddleware - MCP Request Tracing Tests
// ============================================================================

describe('TracingMiddleware - MCP Tracing', () => {
  let middleware: TracingMiddleware;

  beforeEach(async () => {
    resetOpikService();
    resetTracingMiddleware();
    await initializeOpikService(testConfig);
    middleware = new TracingMiddleware();
  });

  afterEach(() => {
    middleware.cleanup();
    resetOpikService();
    resetTracingMiddleware();
  });

  test('creates MCP request span within agent trace', () => {
    middleware.startAgentTrace('agent-1', 'session-1');

    const spanInfo = middleware.traceMCPRequest('agent-1', 'tools/list');

    expect(spanInfo).not.toBeNull();
    expect(spanInfo!.span).toBeDefined();
    expect(spanInfo!.span.name).toBe('mcp:tools/list');
    expect(spanInfo!.span.type).toBe('tool');
  });

  test('creates standalone MCP trace without agent lifecycle', () => {
    const spanInfo = middleware.traceMCPRequest('agent-1', 'tools/call', { name: 'test' });

    expect(spanInfo).not.toBeNull();
    expect(spanInfo!.span).toBeDefined();
    expect(spanInfo!.trace).toBeDefined();
  });

  test('ends MCP request span on success', () => {
    middleware.startAgentTrace('agent-1', 'session-1');
    const spanInfo = middleware.traceMCPRequest('agent-1', 'tools/list');

    // Should not throw
    middleware.endMCPRequest(spanInfo, { tools: [] });
  });

  test('ends MCP request span on error', () => {
    middleware.startAgentTrace('agent-1', 'session-1');
    const spanInfo = middleware.traceMCPRequest('agent-1', 'tools/call');

    // Should not throw
    middleware.endMCPRequest(spanInfo, undefined, new Error('Tool error'));
  });

  test('handles null spanInfo gracefully', () => {
    // Should not throw
    middleware.endMCPRequest(null);
  });
});

// ============================================================================
// TracingMiddleware - Guardrail Tracing Tests
// ============================================================================

describe('TracingMiddleware - Guardrail Tracing', () => {
  let middleware: TracingMiddleware;

  beforeEach(async () => {
    resetOpikService();
    resetTracingMiddleware();
    await initializeOpikService(testConfig);
    middleware = new TracingMiddleware();
  });

  afterEach(() => {
    middleware.cleanup();
    resetOpikService();
    resetTracingMiddleware();
  });

  test('traces guardrail check for blocked command', () => {
    middleware.startAgentTrace('agent-1', 'session-1');

    // Should not throw
    middleware.traceGuardrailCheck('agent-1', 'rm -rf /', 'default', {
      blocked: true,
      requiresApproval: false,
      reason: 'Dangerous command blocked',
    });
  });

  test('traces guardrail check for approved command', () => {
    middleware.startAgentTrace('agent-1', 'session-1');

    // Should not throw
    middleware.traceGuardrailCheck('agent-1', 'ls -la', 'default', {
      blocked: false,
      requiresApproval: false,
    });
  });

  test('traces guardrail check requiring approval', () => {
    middleware.startAgentTrace('agent-1', 'session-1');

    // Should not throw
    middleware.traceGuardrailCheck('agent-1', 'npm publish', 'default', {
      blocked: false,
      requiresApproval: true,
      reason: 'Publishing to npm registry',
    });
  });

  test('is safe without agent trace', () => {
    // No agent trace - should not throw
    middleware.traceGuardrailCheck('agent-1', 'ls', 'default', {
      blocked: false,
      requiresApproval: false,
    });
  });
});

// ============================================================================
// TracingMiddleware - Token Counting Tests
// ============================================================================

describe('TracingMiddleware - Token Counting', () => {
  let middleware: TracingMiddleware;

  beforeEach(async () => {
    resetOpikService();
    resetTracingMiddleware();
    await initializeOpikService(testConfig);
    middleware = new TracingMiddleware();
  });

  afterEach(() => {
    middleware.cleanup();
    resetOpikService();
    resetTracingMiddleware();
  });

  test('processes output with token usage', () => {
    middleware.startAgentTrace('agent-1', 'session-1');

    const usage = middleware.processAgentOutput(
      'agent-1',
      'Tokens: 100 input, 200 output'
    );

    expect(usage).not.toBeNull();
    expect(usage!.promptTokens).toBe(100);
    expect(usage!.completionTokens).toBe(200);
  });

  test('accumulates token usage across outputs', () => {
    middleware.startAgentTrace('agent-1', 'session-1');

    middleware.processAgentOutput('agent-1', 'Tokens: 100 input, 200 output');
    middleware.processAgentOutput('agent-1', 'Tokens: 50 input, 100 output');

    const total = middleware.getAgentTokenUsage('agent-1');
    expect(total).toBeDefined();
    expect(total!.promptTokens).toBe(150);
    expect(total!.completionTokens).toBe(300);
    expect(total!.totalTokens).toBe(450);
  });

  test('returns null for non-token output', () => {
    middleware.startAgentTrace('agent-1', 'session-1');

    const usage = middleware.processAgentOutput('agent-1', 'Hello world');
    expect(usage).toBeNull();
  });

  test('processes output without agent trace', () => {
    // Should not throw even without trace
    const usage = middleware.processAgentOutput(
      'agent-1',
      'Tokens: 100 input, 200 output'
    );

    expect(usage).not.toBeNull();
    expect(usage!.totalTokens).toBe(300);
  });

  test('detects model in output and logs LLM call', () => {
    middleware.startAgentTrace('agent-1', 'session-1');

    const usage = middleware.processAgentOutput(
      'agent-1',
      'Using claude-3-opus - Tokens: 500 input, 1000 output'
    );

    expect(usage).not.toBeNull();
    expect(usage!.totalTokens).toBe(1500);
  });
});

// ============================================================================
// TracingMiddleware - Singleton Tests
// ============================================================================

describe('TracingMiddleware Singleton', () => {
  beforeEach(async () => {
    resetTracingMiddleware();
    resetOpikService();
    await initializeOpikService(testConfig);
  });

  afterEach(() => {
    resetTracingMiddleware();
    resetOpikService();
  });

  test('getTracingMiddleware returns same instance', () => {
    const m1 = getTracingMiddleware();
    const m2 = getTracingMiddleware();
    expect(m1).toBe(m2);
  });

  test('resetTracingMiddleware clears singleton', () => {
    const m1 = getTracingMiddleware();
    m1.setSessionContext('session-1', testSessionContext);

    resetTracingMiddleware();

    const m2 = getTracingMiddleware();
    expect(m2).not.toBe(m1);
    expect(m2.getSessionContext('session-1')).toBeUndefined();
  });
});

// ============================================================================
// TracingMiddleware - Cleanup Tests
// ============================================================================

describe('TracingMiddleware - Cleanup', () => {
  let middleware: TracingMiddleware;

  beforeEach(async () => {
    resetOpikService();
    resetTracingMiddleware();
    await initializeOpikService(testConfig);
    middleware = new TracingMiddleware();
  });

  afterEach(() => {
    resetOpikService();
    resetTracingMiddleware();
  });

  test('cleanup ends all active traces', () => {
    middleware.startAgentTrace('agent-1', 'session-1');
    middleware.startAgentTrace('agent-2', 'session-1');
    middleware.setSessionContext('session-1', testSessionContext);

    middleware.cleanup();

    expect(middleware.getAgentTrace('agent-1')).toBeUndefined();
    expect(middleware.getAgentTrace('agent-2')).toBeUndefined();
    expect(middleware.getSessionContext('session-1')).toBeUndefined();
  });

  test('double cleanup is safe', () => {
    middleware.startAgentTrace('agent-1', 'session-1');
    middleware.cleanup();

    // Should not throw
    middleware.cleanup();
  });
});
