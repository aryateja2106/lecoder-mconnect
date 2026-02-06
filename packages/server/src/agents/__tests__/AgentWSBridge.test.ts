/**
 * AgentWSBridge Unit Tests
 *
 * Tests for bridging AgentManager with WebSocket Hub.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { EventEmitter } from 'node:events';
import type { AgentStatus } from '@lecoder/shared';
import type { TerminalOutputMessage, AgentStatusMessage, ServerMessage } from '@lecoder/shared/protocol';
import { AgentWSBridge, resetAgentWSBridge } from '../AgentWSBridge.js';
import type { WSHub, InputHandler, MCPHandler } from '../../ws/WSHub.js';

// ============================================================================
// Mocks
// ============================================================================

/**
 * Mock agent manager with test helpers
 */
interface MockAgentManager extends EventEmitter {
  onAgentOutput: ReturnType<typeof mock>;
  onAgentStatus: ReturnType<typeof mock>;
  writeToAgent: ReturnType<typeof mock>;
  getAgentStatus: ReturnType<typeof mock>;
  _simulateOutput: (agentId: string, data: string) => void;
  _simulateStatusChange: (agentId: string, status: AgentStatus) => void;
}

/**
 * Create a mock AgentManager
 */
function createMockAgentManager(): MockAgentManager {
  const emitter = new EventEmitter();

  const outputCallbacks = new Map<string, Set<(data: string) => void>>();
  const statusCallbacks = new Map<string, Set<(agentId: string, status: AgentStatus) => void>>();

  return Object.assign(emitter, {
    onAgentOutput: mock((agentId: string, callback: (data: string) => void) => {
      let callbacks = outputCallbacks.get(agentId);
      if (!callbacks) {
        callbacks = new Set();
        outputCallbacks.set(agentId, callbacks);
      }
      callbacks.add(callback);
      return () => callbacks!.delete(callback);
    }),
    onAgentStatus: mock((agentId: string, callback: (id: string, status: AgentStatus) => void) => {
      let callbacks = statusCallbacks.get(agentId);
      if (!callbacks) {
        callbacks = new Set();
        statusCallbacks.set(agentId, callbacks);
      }
      callbacks.add(callback);
      return () => callbacks!.delete(callback);
    }),
    writeToAgent: mock((_agentId: string, _data: string) => {}),
    getAgentStatus: mock((_agentId: string) => 'running' as AgentStatus),
    // Simulate output for testing
    _simulateOutput: (agentId: string, data: string) => {
      emitter.emit('output', agentId, data);
      const callbacks = outputCallbacks.get(agentId);
      if (callbacks) {
        for (const cb of callbacks) {
          cb(data);
        }
      }
    },
    _simulateStatusChange: (agentId: string, status: AgentStatus) => {
      emitter.emit('statusChange', agentId, status);
      const callbacks = statusCallbacks.get(agentId);
      if (callbacks) {
        for (const cb of callbacks) {
          cb(agentId, status);
        }
      }
    },
  }) as unknown as MockAgentManager;
}

/**
 * Create a mock WSHub
 */
function createMockWSHub(): WSHub {
  const inputHandlers = new Map<string, InputHandler>();
  const mcpHandlers = new Map<string, MCPHandler>();
  const sentMessages = new Map<string, ServerMessage[]>(); // sessionId -> messages

  return {
    registerInputHandler: mock((sessionId: string, handler: InputHandler) => {
      inputHandlers.set(sessionId, handler);
    }),
    unregisterInputHandler: mock((sessionId: string) => {
      inputHandlers.delete(sessionId);
    }),
    registerMCPHandler: mock((sessionId: string, handler: MCPHandler) => {
      mcpHandlers.set(sessionId, handler);
    }),
    unregisterMCPHandler: mock((sessionId: string) => {
      mcpHandlers.delete(sessionId);
    }),
    broadcastToSession: mock((sessionId: string, message: ServerMessage, _excludeClientId?: string) => {
      let messages = sentMessages.get(sessionId);
      if (!messages) {
        messages = [];
        sentMessages.set(sessionId, messages);
      }
      messages.push(message);
    }),
    getSessionClients: mock((_sessionId: string) => []),
    // Test helpers
    _getInputHandler: (sessionId: string) => inputHandlers.get(sessionId),
    _getMCPHandler: (sessionId: string) => mcpHandlers.get(sessionId),
    _getSentMessages: (sessionId: string) => sentMessages.get(sessionId) ?? [],
    _clearMessages: () => sentMessages.clear(),
  } as unknown as WSHub;
}

// ============================================================================
// Tests
// ============================================================================

describe('AgentWSBridge', () => {
  let bridge: AgentWSBridge;
  let mockAgentManager: ReturnType<typeof createMockAgentManager>;
  let mockWSHub: ReturnType<typeof createMockWSHub>;

  beforeEach(() => {
    resetAgentWSBridge();

    mockAgentManager = createMockAgentManager();
    mockWSHub = createMockWSHub();

    bridge = new AgentWSBridge(mockAgentManager as any, mockWSHub as any);
  });

  afterEach(() => {
    bridge.cleanup();
    resetAgentWSBridge();
  });

  // ==========================================================================
  // Registration Tests
  // ==========================================================================

  describe('registerAgent', () => {
    it('should register an agent for a session', () => {
      bridge.registerAgent('agent-1', 'session-1');

      const agents = bridge.getSessionAgents('session-1');
      expect(agents).toContain('agent-1');
    });

    it('should subscribe to agent output', () => {
      bridge.registerAgent('agent-1', 'session-1');

      expect(mockAgentManager.onAgentOutput).toHaveBeenCalledWith('agent-1', expect.any(Function));
    });

    it('should subscribe to agent status', () => {
      bridge.registerAgent('agent-1', 'session-1');

      expect(mockAgentManager.onAgentStatus).toHaveBeenCalledWith('agent-1', expect.any(Function));
    });

    it('should register multiple agents for same session', () => {
      bridge.registerAgent('agent-1', 'session-1');
      bridge.registerAgent('agent-2', 'session-1');

      const agents = bridge.getSessionAgents('session-1');
      expect(agents).toContain('agent-1');
      expect(agents).toContain('agent-2');
      expect(agents).toHaveLength(2);
    });
  });

  describe('unregisterAgent', () => {
    it('should unregister an agent', () => {
      bridge.registerAgent('agent-1', 'session-1');
      bridge.unregisterAgent('agent-1');

      const agents = bridge.getSessionAgents('session-1');
      expect(agents).not.toContain('agent-1');
    });

    it('should handle unregistering unknown agent gracefully', () => {
      // Should not throw
      bridge.unregisterAgent('unknown-agent');
    });
  });

  // ==========================================================================
  // Session Input Handler Tests
  // ==========================================================================

  describe('registerSessionInputHandler', () => {
    it('should register input handler with WSHub', () => {
      bridge.registerSessionInputHandler('session-1');

      expect(mockWSHub.registerInputHandler).toHaveBeenCalledWith(
        'session-1',
        expect.any(Function)
      );
    });

    it('should forward input to agent', () => {
      bridge.registerAgent('agent-1', 'session-1');
      bridge.registerSessionInputHandler('session-1');

      // Get the input handler
      const handler = (mockWSHub as any)._getInputHandler('session-1');
      expect(handler).toBeDefined();

      // Simulate input
      handler('agent-1', 'test input');

      // Should forward to agent
      expect(mockAgentManager.writeToAgent).toHaveBeenCalledWith('agent-1', 'test input');
    });

    it('should not forward input for unregistered agent', () => {
      bridge.registerSessionInputHandler('session-1');
      // Don't register agent-1

      // Get the input handler
      const handler = (mockWSHub as any)._getInputHandler('session-1');

      // Simulate input for unregistered agent
      handler('agent-1', 'test input');

      // Should NOT forward to agent
      expect(mockAgentManager.writeToAgent).not.toHaveBeenCalled();
    });
  });

  describe('unregisterSessionInputHandler', () => {
    it('should unregister input handler with WSHub', () => {
      bridge.registerSessionInputHandler('session-1');
      bridge.unregisterSessionInputHandler('session-1');

      expect(mockWSHub.unregisterInputHandler).toHaveBeenCalledWith('session-1');
    });
  });

  // ==========================================================================
  // Output Routing Tests
  // ==========================================================================

  describe('Agent Output Routing', () => {
    it('should broadcast terminal output to session', () => {
      bridge.registerAgent('agent-1', 'session-1');

      // Simulate agent output via callback
      mockAgentManager._simulateOutput('agent-1', 'hello world');

      // Give it a moment
      const messages = (mockWSHub as any)._getSentMessages('session-1') as ServerMessage[];

      // Should have broadcast output message
      expect(messages.length).toBeGreaterThan(0);

      const outputMsg = messages.find((m): m is TerminalOutputMessage => m.type === 'terminal_output');
      expect(outputMsg).toBeDefined();
      expect(outputMsg?.agentId).toBe('agent-1');
      expect(outputMsg?.data).toBe('hello world');
    });

    it('should broadcast agent status to session', () => {
      bridge.registerAgent('agent-1', 'session-1');

      // Simulate status change via callback
      mockAgentManager._simulateStatusChange('agent-1', 'running');

      const messages = (mockWSHub as any)._getSentMessages('session-1') as ServerMessage[];

      // Should have broadcast status message
      expect(messages.length).toBeGreaterThan(0);

      const statusMsg = messages.find((m): m is AgentStatusMessage => m.type === 'agent_status');
      expect(statusMsg).toBeDefined();
      expect(statusMsg?.agentId).toBe('agent-1');
      expect(statusMsg?.status).toBe('running');
    });
  });

  // ==========================================================================
  // Mapping Tests
  // ==========================================================================

  describe('getSessionAgents', () => {
    it('should return empty array for unknown session', () => {
      const agents = bridge.getSessionAgents('unknown-session');
      expect(agents).toEqual([]);
    });

    it('should return all agents for a session', () => {
      bridge.registerAgent('agent-1', 'session-1');
      bridge.registerAgent('agent-2', 'session-1');
      bridge.registerAgent('agent-3', 'session-2');

      const session1Agents = bridge.getSessionAgents('session-1');
      expect(session1Agents).toHaveLength(2);
      expect(session1Agents).toContain('agent-1');
      expect(session1Agents).toContain('agent-2');

      const session2Agents = bridge.getSessionAgents('session-2');
      expect(session2Agents).toHaveLength(1);
      expect(session2Agents).toContain('agent-3');
    });
  });

  describe('getAgentSession', () => {
    it('should return session ID for registered agent', () => {
      bridge.registerAgent('agent-1', 'session-1');

      const sessionId = bridge.getAgentSession('agent-1');
      expect(sessionId).toBe('session-1');
    });

    it('should return undefined for unknown agent', () => {
      const sessionId = bridge.getAgentSession('unknown-agent');
      expect(sessionId).toBeUndefined();
    });
  });

  // ==========================================================================
  // Cleanup Tests
  // ==========================================================================

  describe('cleanupSession', () => {
    it('should remove all agents for a session', () => {
      bridge.registerAgent('agent-1', 'session-1');
      bridge.registerAgent('agent-2', 'session-1');
      bridge.registerSessionInputHandler('session-1');

      bridge.cleanupSession('session-1');

      const agents = bridge.getSessionAgents('session-1');
      expect(agents).toHaveLength(0);

      expect(mockWSHub.unregisterInputHandler).toHaveBeenCalledWith('session-1');
    });

    it('should not affect other sessions', () => {
      bridge.registerAgent('agent-1', 'session-1');
      bridge.registerAgent('agent-2', 'session-2');

      bridge.cleanupSession('session-1');

      const session1Agents = bridge.getSessionAgents('session-1');
      expect(session1Agents).toHaveLength(0);

      const session2Agents = bridge.getSessionAgents('session-2');
      expect(session2Agents).toHaveLength(1);
    });
  });

  describe('cleanup', () => {
    it('should remove all registrations', () => {
      bridge.registerAgent('agent-1', 'session-1');
      bridge.registerAgent('agent-2', 'session-2');
      bridge.registerSessionInputHandler('session-1');
      bridge.registerSessionInputHandler('session-2');

      bridge.cleanup();

      expect(bridge.getSessionAgents('session-1')).toHaveLength(0);
      expect(bridge.getSessionAgents('session-2')).toHaveLength(0);
      expect(bridge.getAgentSession('agent-1')).toBeUndefined();
      expect(bridge.getAgentSession('agent-2')).toBeUndefined();
    });
  });
});
