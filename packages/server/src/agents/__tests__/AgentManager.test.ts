/**
 * AgentManager Unit Tests
 *
 * Tests for agent lifecycle management.
 * Uses mocks for database and container runtime.
 */

import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { Agent, AgentConfig, AgentStatus } from '@lecoder/shared';
import {
  AgentManager,
  resetAgentManager,
  type AgentOutputCallback,
} from '../AgentManager.js';
import type {
  ContainerRuntime,
  ContainerStreams,
} from '../ContainerRuntime.js';
import * as agentRepo from '../../db/repositories/agent.js';
import * as opikService from '../../observability/OpikService.js';
import * as tracingMiddleware from '../../observability/TracingMiddleware.js';

// ============================================================================
// Mocks
// ============================================================================

/**
 * A deferred promise that can be resolved/rejected from outside
 */
interface DeferredPromise<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

function createDeferredPromise<T>(): DeferredPromise<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Create a mock ContainerRuntime
 */
function createMockContainerRuntime(): ContainerRuntime & {
  _waitDeferred: DeferredPromise<{ exitCode: number }>;
  _resolveWait: (exitCode: number) => void;
} {
  const emitter = new EventEmitter();

  const mockStreams: ContainerStreams = {
    stream: new PassThrough() as unknown as NodeJS.ReadWriteStream,
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  };

  // Create a deferred promise for waitForContainer that never resolves by default
  const waitDeferred = createDeferredPromise<{ exitCode: number }>();

  const runtime = Object.assign(emitter, {
    createContainer: mock(async () => 'mock-container-id'),
    startContainer: mock(async () => {}),
    stopContainer: mock(async () => {}),
    removeContainer: mock(async () => {}),
    killContainer: mock(async () => {}),
    attachToContainer: mock(async () => mockStreams),
    writeToContainer: mock(async () => {}),
    ensureImage: mock(async () => {}),
    // This promise never resolves by default, keeping the agent "running"
    waitForContainer: mock(() => waitDeferred.promise),
    getContainerStatus: mock(async () => ({
      id: 'mock-container-id',
      name: 'mock-container',
      image: 'alpine:latest',
      state: 'running' as const,
      createdAt: new Date(),
    })),
    isRunning: mock(async () => true),
    cleanup: mock(async () => {}),
    // Pass through EventEmitter methods
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    once: emitter.once.bind(emitter),
    emit: emitter.emit.bind(emitter),
    removeAllListeners: emitter.removeAllListeners.bind(emitter),
    // Test helpers
    _waitDeferred: waitDeferred,
    _resolveWait: (exitCode: number) => waitDeferred.resolve({ exitCode }),
  }) as unknown as ContainerRuntime & {
    _waitDeferred: DeferredPromise<{ exitCode: number }>;
    _resolveWait: (exitCode: number) => void;
  };

  return runtime;
}

/**
 * Create a mock Agent for testing
 */
function createMockAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'test-agent-id',
    sessionId: 'test-session-id',
    type: 'shell',
    name: 'Test Agent',
    status: 'starting',
    config: {
      type: 'shell',
      name: 'Test Agent',
      command: '/bin/bash',
    },
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock AgentConfig
 */
function createMockConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    type: 'shell',
    name: 'Test Agent',
    command: '/bin/bash',
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('AgentManager', () => {
  let manager: AgentManager;
  let mockRuntime: ContainerRuntime;
  let createSpy: ReturnType<typeof spyOn>;
  let updateSpy: ReturnType<typeof spyOn>;
  let updateStatusSpy: ReturnType<typeof spyOn>;
  let markStartedSpy: ReturnType<typeof spyOn>;
  let markStoppedSpy: ReturnType<typeof spyOn>;
  let getBySessionSpy: ReturnType<typeof spyOn>;
  const spies: Array<ReturnType<typeof spyOn>> = [];

  beforeEach(() => {
    // Reset singleton
    resetAgentManager();

    // Create mock runtime
    mockRuntime = createMockContainerRuntime();

    // Create manager with mock runtime
    manager = new AgentManager(mockRuntime);

    // Clear spies from previous run
    spies.length = 0;

    // Setup repository spies
    createSpy = spyOn(agentRepo.agentRepository, 'create').mockImplementation(
      async (input) => createMockAgent({
        id: 'new-agent-id',
        sessionId: input.sessionId,
        type: input.type,
        name: input.name,
        config: input.config,
        status: input.status ?? 'starting',
      })
    );
    spies.push(createSpy);

    updateSpy = spyOn(agentRepo.agentRepository, 'update').mockImplementation(
      async (id, input) => createMockAgent({ id, ...input })
    );
    spies.push(updateSpy);

    updateStatusSpy = spyOn(agentRepo.agentRepository, 'updateStatus').mockImplementation(
      async () => true
    );
    spies.push(updateStatusSpy);

    markStartedSpy = spyOn(agentRepo.agentRepository, 'markStarted').mockImplementation(
      async () => true
    );
    spies.push(markStartedSpy);

    markStoppedSpy = spyOn(agentRepo.agentRepository, 'markStopped').mockImplementation(
      async () => true
    );
    spies.push(markStoppedSpy);

    getBySessionSpy = spyOn(agentRepo.agentRepository, 'getBySession').mockImplementation(
      async () => [createMockAgent()]
    );
    spies.push(getBySessionSpy);

    const findByIdSpy = spyOn(agentRepo.agentRepository, 'findById').mockImplementation(
      async (id) => createMockAgent({ id })
    );
    spies.push(findByIdSpy);

    // Mock stopAllForSession
    const stopAllSpy = spyOn(agentRepo.agentRepository, 'stopAllForSession').mockImplementation(
      async () => 0
    );
    spies.push(stopAllSpy);

    // Mock Opik service
    const mockOpik = {
      startTrace: () => ({
        traceId: 'mock-trace-id',
        operation: 'test',
        startTime: Date.now(),
        metadata: {},
      }),
      endTrace: () => {},
      startSpan: () => ({
        spanId: 'mock-span-id',
        trace: {} as any,
        name: 'test',
        type: 'general' as const,
        startTime: Date.now(),
      }),
      endSpan: () => {},
    };

    const opikSpy = spyOn(opikService, 'getOpikService').mockReturnValue(mockOpik as any);
    spies.push(opikSpy);

    // Mock TracingMiddleware
    const mockTracingMiddleware = {
      getSessionContext: () => undefined,
      setSessionContext: () => {},
      removeSessionContext: () => {},
      startAgentTrace: () => ({
        traceId: 'mock-lifecycle-trace-id',
        operation: 'agent:lifecycle',
        startTime: Date.now(),
        metadata: {},
      }),
      endAgentTrace: () => {},
      getAgentTrace: () => undefined,
      traceMCPRequest: () => null,
      endMCPRequest: () => {},
      traceGuardrailCheck: () => {},
      processAgentOutput: () => null,
      getAgentTokenUsage: () => undefined,
      traceAgentOperation: (
        _agentId: string,
        _operation: string,
        _input: Record<string, unknown>,
        fn: (span: unknown) => unknown
      ) => fn({}),
      cleanup: () => {},
    };

    const tracingSpy = spyOn(tracingMiddleware, 'getTracingMiddleware').mockReturnValue(
      mockTracingMiddleware as any
    );
    spies.push(tracingSpy);
  });

  afterEach(async () => {
    // Cleanup
    await manager.cleanup();
    resetAgentManager();

    // Restore all spies to prevent leaking into other test files
    for (const spy of spies) {
      spy.mockRestore();
    }
    spies.length = 0;
  });

  // ==========================================================================
  // createAgent Tests
  // ==========================================================================

  describe('createAgent', () => {
    it('should create an agent without container', async () => {
      const config = createMockConfig();

      const agent = await manager.createAgent('session-1', config);

      expect(agent).toBeDefined();
      expect(agent.id).toBe('new-agent-id');
      expect(agent.sessionId).toBe('session-1');
      expect(agent.type).toBe('shell');
      expect(agent.name).toBe('Test Agent');
      expect(agent.status).toBe('starting');

      // Should call repository create
      expect(createSpy).toHaveBeenCalled();

      // Should NOT create container
      expect(mockRuntime.createContainer).not.toHaveBeenCalled();
    });

    it('should create an agent with container', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
          workDir: '/app',
        },
      });

      const agent = await manager.createAgent('session-1', config);

      expect(agent).toBeDefined();
      expect(agent.containerId).toBe('mock-container-id');

      // Should create container
      expect(mockRuntime.ensureImage).toHaveBeenCalledWith('node:22-alpine');
      expect(mockRuntime.createContainer).toHaveBeenCalled();

      // Should update agent with container ID
      expect(updateSpy).toHaveBeenCalled();
    });

    it('should track agent in internal state', async () => {
      const config = createMockConfig();

      const agent = await manager.createAgent('session-1', config);

      // Should be able to get status
      const status = manager.getAgentStatus(agent.id);
      expect(status).toBe('starting');
    });
  });

  // ==========================================================================
  // startAgent Tests
  // ==========================================================================

  describe('startAgent', () => {
    it('should start a containerized agent', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      const agent = await manager.createAgent('session-1', config);
      await manager.startAgent(agent.id);

      // Should attach then start
      expect(mockRuntime.attachToContainer).toHaveBeenCalledWith('mock-container-id');
      expect(mockRuntime.startContainer).toHaveBeenCalledWith('mock-container-id');

      // Should update status
      expect(updateStatusSpy).toHaveBeenCalled();
      expect(markStartedSpy).toHaveBeenCalled();

      // Status should be running
      const status = manager.getAgentStatus(agent.id);
      expect(status).toBe('running');
    });

    it('should emit started event', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      const agent = await manager.createAgent('session-1', config);

      const startedPromise = new Promise<string>((resolve) => {
        manager.once('started', (agentId) => resolve(agentId));
      });

      await manager.startAgent(agent.id);

      const startedAgentId = await startedPromise;
      expect(startedAgentId).toBe(agent.id);
    });

    it('should throw for non-containerized agent', async () => {
      const config = createMockConfig(); // No container

      const agent = await manager.createAgent('session-1', config);

      await expect(manager.startAgent(agent.id)).rejects.toThrow(
        'Non-containerized agents not yet implemented'
      );
    });

    it('should throw for unknown agent', async () => {
      await expect(manager.startAgent('unknown-agent-id')).rejects.toThrow(
        'Agent unknown-agent-id not found'
      );
    });
  });

  // ==========================================================================
  // stopAgent Tests
  // ==========================================================================

  describe('stopAgent', () => {
    it('should stop a running agent', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      const agent = await manager.createAgent('session-1', config);
      await manager.startAgent(agent.id);
      await manager.stopAgent(agent.id);

      // Should stop container
      expect(mockRuntime.stopContainer).toHaveBeenCalledWith('mock-container-id');

      // Should update status
      expect(markStoppedSpy).toHaveBeenCalled();

      // Status should be exited
      const status = manager.getAgentStatus(agent.id);
      expect(status).toBe('exited');
    });

    it('should emit stopped event', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      const agent = await manager.createAgent('session-1', config);
      await manager.startAgent(agent.id);

      const stoppedPromise = new Promise<{ agentId: string; exitCode?: number }>((resolve) => {
        manager.once('stopped', (agentId, exitCode) => resolve({ agentId, exitCode }));
      });

      await manager.stopAgent(agent.id);

      const { agentId, exitCode } = await stoppedPromise;
      expect(agentId).toBe(agent.id);
      expect(exitCode).toBe(0);
    });

    it('should use custom signal when specified', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      const agent = await manager.createAgent('session-1', config);
      await manager.startAgent(agent.id);
      await manager.stopAgent(agent.id, 'SIGKILL');

      // Should kill with signal
      expect(mockRuntime.killContainer).toHaveBeenCalledWith('mock-container-id', 'SIGKILL');
    });
  });

  // ==========================================================================
  // I/O Tests
  // ==========================================================================

  describe('writeToAgent', () => {
    it('should write to agent stdin', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      const agent = await manager.createAgent('session-1', config);
      await manager.startAgent(agent.id);

      // Write to agent - should not throw
      manager.writeToAgent(agent.id, 'test input\n');

      // Verify that the mock's attachToContainer was called
      expect(mockRuntime.attachToContainer).toHaveBeenCalledWith('mock-container-id');
    });

    it('should throw if agent is not running', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      const agent = await manager.createAgent('session-1', config);
      // Don't start the agent

      expect(() => manager.writeToAgent(agent.id, 'test')).toThrow(
        'Agent new-agent-id is not running'
      );
    });
  });

  describe('onAgentOutput', () => {
    it('should register output callback', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      const agent = await manager.createAgent('session-1', config);

      const outputs: string[] = [];
      const callback: AgentOutputCallback = (data) => outputs.push(data);

      const unsub = manager.onAgentOutput(agent.id, callback);

      // Verify unsub is a function
      expect(typeof unsub).toBe('function');

      // Call unsub to clean up
      unsub();
    });

    it('should unsubscribe when unsub is called', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      const agent = await manager.createAgent('session-1', config);

      const callback = mock(() => {});
      const unsub = manager.onAgentOutput(agent.id, callback);

      // Unsubscribe
      unsub();

      // Callback should not be in the set anymore
      // (Internal implementation detail, but we can verify through behavior)
    });
  });

  // ==========================================================================
  // Status Tests
  // ==========================================================================

  describe('getAgentStatus', () => {
    it('should return agent status', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      const agent = await manager.createAgent('session-1', config);

      expect(manager.getAgentStatus(agent.id)).toBe('starting');

      await manager.startAgent(agent.id);

      expect(manager.getAgentStatus(agent.id)).toBe('running');
    });

    it('should throw for unknown agent', () => {
      expect(() => manager.getAgentStatus('unknown')).toThrow('Agent unknown not found');
    });
  });

  describe('getAllAgents', () => {
    it('should return all agents for a session', async () => {
      const agents = await manager.getAllAgents('session-1');

      expect(getBySessionSpy).toHaveBeenCalledWith('session-1');
      expect(agents).toHaveLength(1);
    });
  });

  describe('isRunning', () => {
    it('should return true for running agent', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      const agent = await manager.createAgent('session-1', config);
      await manager.startAgent(agent.id);

      expect(manager.isRunning(agent.id)).toBe(true);
    });

    it('should return false for stopped agent', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      const agent = await manager.createAgent('session-1', config);
      await manager.startAgent(agent.id);
      await manager.stopAgent(agent.id);

      expect(manager.isRunning(agent.id)).toBe(false);
    });

    it('should return false for unknown agent', () => {
      expect(manager.isRunning('unknown')).toBe(false);
    });
  });

  // ==========================================================================
  // Session Management Tests
  // ==========================================================================

  describe('stopSessionAgents', () => {
    it('should stop all agents in a session', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      // Create and start multiple agents in same session
      const agent1 = await manager.createAgent('session-1', config);
      const agent2 = await manager.createAgent('session-1', { ...config, name: 'Agent 2' });

      await manager.startAgent(agent1.id);
      await manager.startAgent(agent2.id);

      await manager.stopSessionAgents('session-1');

      // Both should be stopped
      expect(manager.getAgentStatus(agent1.id)).toBe('exited');
      expect(manager.getAgentStatus(agent2.id)).toBe('exited');
    });
  });

  describe('removeSessionAgents', () => {
    it('should remove all agents in a session', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      const agent1 = await manager.createAgent('session-1', config);
      const agent2 = await manager.createAgent('session-1', { ...config, name: 'Agent 2' });

      await manager.removeSessionAgents('session-1');

      // Both should be gone
      expect(() => manager.getAgentStatus(agent1.id)).toThrow();
      expect(() => manager.getAgentStatus(agent2.id)).toThrow();
    });
  });

  // ==========================================================================
  // MCP Tests
  // ==========================================================================

  describe('MCP Methods', () => {
    it('sendMCPMessage should throw when MCP not enabled', async () => {
      const config = createMockConfig();
      const agent = await manager.createAgent('session-1', config);

      await expect(
        manager.sendMCPMessage(agent.id, {
          jsonrpc: '2.0',
          id: 1,
          method: 'test',
        })
      ).rejects.toThrow('does not have MCP enabled');
    });

    it('hasMCP should return false for agent without MCP', async () => {
      const config = createMockConfig();
      const agent = await manager.createAgent('session-1', config);

      expect(manager.hasMCP(agent.id)).toBe(false);
    });

    it('getMCPBridge should return undefined for agent without MCP', async () => {
      const config = createMockConfig();
      const agent = await manager.createAgent('session-1', config);

      expect(manager.getMCPBridge(agent.id)).toBeUndefined();
    });

    it('registerTool should register a tool', async () => {
      const config = createMockConfig();
      const agent = await manager.createAgent('session-1', config);

      manager.registerTool(agent.id, {
        name: 'test-tool',
        description: 'A test tool',
      });

      const tools = manager.getTools(agent.id);
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test-tool');
    });
  });

  // ==========================================================================
  // Cleanup Tests
  // ==========================================================================

  describe('cleanup', () => {
    it('should cleanup all agents', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      const agent1 = await manager.createAgent('session-1', config);
      const agent2 = await manager.createAgent('session-2', config);

      await manager.startAgent(agent1.id);
      await manager.startAgent(agent2.id);

      await manager.cleanup();

      // All agents should be gone
      expect(() => manager.getAgentStatus(agent1.id)).toThrow();
      expect(() => manager.getAgentStatus(agent2.id)).toThrow();

      // Container runtime cleanup should be called
      expect(mockRuntime.cleanup).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Event Emitter Tests
  // ==========================================================================

  describe('Events', () => {
    it('should emit statusChange event', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      const agent = await manager.createAgent('session-1', config);

      const statusChanges: Array<{ agentId: string; status: AgentStatus; previous: AgentStatus }> = [];
      manager.on('statusChange', (agentId, status, previous) => {
        statusChanges.push({ agentId, status, previous });
      });

      await manager.startAgent(agent.id);

      // Should have recorded status changes
      expect(statusChanges.length).toBeGreaterThan(0);
    });

    it('should emit output event when container produces output', async () => {
      const config = createMockConfig({
        container: {
          image: 'node:22-alpine',
        },
      });

      const agent = await manager.createAgent('session-1', config);

      const outputs: Array<{ agentId: string; data: string }> = [];
      manager.on('output', (agentId, data) => {
        outputs.push({ agentId, data });
      });

      await manager.startAgent(agent.id);

      // Simulate output from container
      const streams = await mockRuntime.attachToContainer('mock-container-id') as ContainerStreams;
      streams.stdout.emit('data', Buffer.from('test output'));

      // Give it a moment to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have received output
      expect(outputs.length).toBeGreaterThan(0);
      expect(outputs[0].data).toBe('test output');
    });
  });
});
