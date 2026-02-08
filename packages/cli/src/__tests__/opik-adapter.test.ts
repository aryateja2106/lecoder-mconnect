import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockObservability = {
  initialize: vi.fn(async () => true),
  isEnabled: vi.fn(() => true),
  startSessionTrace: vi.fn(),
  endSessionTrace: vi.fn(async () => {}),
  traceAgentSpawn: vi.fn(),
  traceAgentStatusChange: vi.fn(),
  traceCommand: vi.fn(),
  traceApprovalRequest: vi.fn(),
  traceApprovalResponse: vi.fn(),
  traceClientConnection: vi.fn(),
  flush: vi.fn(async () => {}),
};

vi.mock('../observability/index.js', () => ({
  getObservability: () => mockObservability,
}));

import { getOpikTracer, initializeOpikTracer, resetOpikTracer } from '../opik/index.js';

describe('Opik Adapter', () => {
  beforeEach(() => {
    resetOpikTracer();
    vi.clearAllMocks();
    mockObservability.initialize.mockResolvedValue(true);
    mockObservability.isEnabled.mockReturnValue(true);
    mockObservability.endSessionTrace.mockResolvedValue(undefined);
    mockObservability.flush.mockResolvedValue(undefined);
  });

  it('initializes through the canonical observability backend', async () => {
    process.env.OPIK_API_KEY = 'test-key';
    process.env.OPIK_PROJECT_NAME = 'lecoder-mconnect';

    const enabled = await initializeOpikTracer();

    expect(enabled).toBe(true);
    expect(mockObservability.initialize).toHaveBeenCalledTimes(1);
    expect(mockObservability.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-key',
        projectName: 'lecoder-mconnect',
      })
    );
  });

  it('tracks session lifecycle without duplicate root trace creation', async () => {
    const tracer = getOpikTracer();
    await tracer.initialize();

    tracer.startSession('session-1', {
      guardrailsPreset: 'default',
      workDir: '/tmp',
      startTime: Date.now(),
      tunnelEnabled: true,
      tmuxEnabled: true,
      ptyInitialized: true,
    });

    expect(tracer.hasActiveSession('session-1')).toBe(true);
    expect(mockObservability.startSessionTrace).not.toHaveBeenCalled();

    tracer.endSession('session-1');
    await tracer.flush();

    expect(mockObservability.endSessionTrace).toHaveBeenCalledTimes(1);
    expect(mockObservability.endSessionTrace).toHaveBeenCalledWith('user_exit');
    expect(mockObservability.flush).toHaveBeenCalledTimes(1);
    expect(tracer.hasActiveSession('session-1')).toBe(false);
  });

  it('maps command and approval events to observability APIs', async () => {
    const tracer = getOpikTracer();
    await tracer.initialize();

    tracer.startSession('session-2', {
      guardrailsPreset: 'default',
      workDir: '/tmp',
      startTime: Date.now(),
      tunnelEnabled: true,
      tmuxEnabled: false,
      ptyInitialized: true,
    });

    tracer.commandExecute('session-2', {
      agentId: 'agent-1',
      command: 'git push --force',
      source: 'mobile',
      blocked: false,
      requiresApproval: true,
      timestamp: Date.now(),
    });
    expect(mockObservability.traceCommand).toHaveBeenCalledWith(
      'agent-1',
      'git push --force',
      expect.objectContaining({
        blocked: false,
        requiresApproval: true,
      })
    );

    tracer.approvalRequest('session-2', {
      agentId: 'agent-1',
      command: 'git push --force',
      reason: 'Command requires approval',
      requestTime: Date.now(),
    });
    expect(mockObservability.traceApprovalRequest).toHaveBeenCalledTimes(1);

    tracer.approvalResponse('session-2', 'git push --force', {
      approved: true,
      responder: 'mobile',
      responseTime: 250,
    });
    expect(mockObservability.traceApprovalResponse).toHaveBeenCalledWith(
      'git push --force',
      true,
      'mobile',
      250
    );
  });

  it('maps client connection lifecycle with stored client type', async () => {
    const tracer = getOpikTracer();
    await tracer.initialize();

    tracer.startSession('session-3', {
      guardrailsPreset: 'default',
      workDir: '/tmp',
      startTime: Date.now(),
      tunnelEnabled: true,
      tmuxEnabled: false,
      ptyInitialized: true,
    });

    tracer.clientConnected('session-3', {
      clientId: 'mobile-1',
      clientType: 'mobile',
      ipHash: 'hash',
      connectedAt: Date.now(),
    });
    tracer.clientDisconnected('session-3', 'mobile-1', 1000);

    expect(mockObservability.traceClientConnection).toHaveBeenNthCalledWith(1, 'mobile', 'connect');
    expect(mockObservability.traceClientConnection).toHaveBeenNthCalledWith(2, 'mobile', 'disconnect');
  });
});
