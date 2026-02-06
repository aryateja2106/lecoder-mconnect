/**
 * Agent WebSocket Bridge
 *
 * Bridges the AgentManager with the WebSocket Hub:
 * - Routes agent output to WebSocket clients
 * - Routes WebSocket input to agents
 * - Broadcasts agent status changes
 * - Routes MCP messages between WebSocket clients and agents
 */

import type { AgentStatus, MCPMessage } from '@lecoder/shared';
import type {
  TerminalOutputMessage,
  AgentStatusMessage,
} from '@lecoder/shared/protocol';
import { type AgentManager, getAgentManager } from './AgentManager.js';
import { type WSHub, getWSHub } from '../ws/WSHub.js';

// ============================================================================
// AgentWSBridge Class
// ============================================================================

/**
 * Bridges AgentManager and WSHub
 *
 * Responsibilities:
 * - Register session input handlers with WSHub
 * - Forward agent output to WebSocket clients
 * - Broadcast agent status changes to session
 * - Route MCP messages to agent and back
 */
export class AgentWSBridge {
  private agentManager: AgentManager;
  private wsHub: WSHub;
  private sessionMappings: Map<string, Set<string>> = new Map(); // sessionId -> Set<agentId>
  private agentSessions: Map<string, string> = new Map(); // agentId -> sessionId
  private outputUnsubscribers: Map<string, () => void> = new Map();
  private statusUnsubscribers: Map<string, () => void> = new Map();

  constructor(agentManager?: AgentManager, wsHub?: WSHub) {
    this.agentManager = agentManager ?? getAgentManager();
    this.wsHub = wsHub ?? getWSHub();

    // Listen to global agent events
    this.setupAgentListeners();
  }

  /**
   * Register an agent with a session for output routing
   */
  registerAgent(agentId: string, sessionId: string): void {
    // Track session mapping
    let agents = this.sessionMappings.get(sessionId);
    if (!agents) {
      agents = new Set();
      this.sessionMappings.set(sessionId, agents);
    }
    agents.add(agentId);
    this.agentSessions.set(agentId, sessionId);

    // Subscribe to agent output
    const outputUnsub = this.agentManager.onAgentOutput(agentId, (data: string) => {
      this.handleAgentOutput(agentId, sessionId, data);
    });
    this.outputUnsubscribers.set(agentId, outputUnsub);

    // Subscribe to agent status changes
    const statusUnsub = this.agentManager.onAgentStatus(agentId, (_id: string, status: AgentStatus) => {
      this.handleAgentStatusChange(agentId, sessionId, status);
    });
    this.statusUnsubscribers.set(agentId, statusUnsub);

    // Register input handler for session if not already registered
    if (!this.wsHub.getSessionClients(sessionId).length) {
      // Will be registered when clients connect
    }
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    // Clean up subscriptions
    const outputUnsub = this.outputUnsubscribers.get(agentId);
    if (outputUnsub) {
      outputUnsub();
      this.outputUnsubscribers.delete(agentId);
    }

    const statusUnsub = this.statusUnsubscribers.get(agentId);
    if (statusUnsub) {
      statusUnsub();
      this.statusUnsubscribers.delete(agentId);
    }

    // Clean up mappings
    const sessionId = this.agentSessions.get(agentId);
    if (sessionId) {
      const agents = this.sessionMappings.get(sessionId);
      if (agents) {
        agents.delete(agentId);
        if (agents.size === 0) {
          this.sessionMappings.delete(sessionId);
          this.unregisterSessionHandlers(sessionId);
        }
      }
      this.agentSessions.delete(agentId);
    }
  }

  /**
   * Register input handler for a session
   *
   * Call this when a session becomes active to route WebSocket input to agents
   */
  registerSessionInputHandler(sessionId: string): void {
    this.wsHub.registerInputHandler(sessionId, (agentId: string, data: string) => {
      this.handleSessionInput(sessionId, agentId, data);
    });
  }

  /**
   * Unregister input handler for a session
   */
  unregisterSessionInputHandler(sessionId: string): void {
    this.wsHub.unregisterInputHandler(sessionId);
  }

  /**
   * Register MCP handler for a session
   *
   * Call this when a session becomes active to route MCP messages to agents
   */
  registerSessionMCPHandler(sessionId: string): void {
    this.wsHub.registerMCPHandler(sessionId, async (agentId: string, message: MCPMessage) => {
      return this.handleSessionMCP(sessionId, agentId, message);
    });
  }

  /**
   * Unregister MCP handler for a session
   */
  unregisterSessionMCPHandler(sessionId: string): void {
    this.wsHub.unregisterMCPHandler(sessionId);
  }

  /**
   * Register all handlers for a session (convenience method)
   */
  registerSessionHandlers(sessionId: string): void {
    this.registerSessionInputHandler(sessionId);
    this.registerSessionMCPHandler(sessionId);
  }

  /**
   * Unregister all handlers for a session
   */
  unregisterSessionHandlers(sessionId: string): void {
    this.unregisterSessionInputHandler(sessionId);
    this.unregisterSessionMCPHandler(sessionId);
  }

  /**
   * Get all agent IDs for a session
   */
  getSessionAgents(sessionId: string): string[] {
    const agents = this.sessionMappings.get(sessionId);
    return agents ? Array.from(agents) : [];
  }

  /**
   * Get session ID for an agent
   */
  getAgentSession(agentId: string): string | undefined {
    return this.agentSessions.get(agentId);
  }

  /**
   * Clean up all registrations for a session
   */
  cleanupSession(sessionId: string): void {
    const agents = this.sessionMappings.get(sessionId);
    if (agents) {
      for (const agentId of agents) {
        this.unregisterAgent(agentId);
      }
    }
    this.sessionMappings.delete(sessionId);
    this.unregisterSessionHandlers(sessionId);
  }

  /**
   * Clean up all registrations
   */
  cleanup(): void {
    // Unregister all agents
    for (const agentId of this.agentSessions.keys()) {
      this.unregisterAgent(agentId);
    }

    // Clear all mappings
    this.sessionMappings.clear();
    this.agentSessions.clear();
    this.outputUnsubscribers.clear();
    this.statusUnsubscribers.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Setup global agent manager event listeners
   */
  private setupAgentListeners(): void {
    // Listen for agent output events
    this.agentManager.on('output', (agentId: string, data: string) => {
      const sessionId = this.agentSessions.get(agentId);
      if (sessionId) {
        this.handleAgentOutput(agentId, sessionId, data);
      }
    });

    // Listen for agent status change events
    this.agentManager.on('statusChange', (agentId: string, status: AgentStatus) => {
      const sessionId = this.agentSessions.get(agentId);
      if (sessionId) {
        this.handleAgentStatusChange(agentId, sessionId, status);
      }
    });
  }

  /**
   * Handle agent output - broadcast to session clients
   */
  private handleAgentOutput(agentId: string, sessionId: string, data: string): void {
    const message: TerminalOutputMessage = {
      type: 'terminal_output',
      agentId,
      data,
      timestamp: Date.now(),
    };

    this.wsHub.broadcastToSession(sessionId, message);
  }

  /**
   * Handle agent status change - broadcast to session clients
   */
  private handleAgentStatusChange(agentId: string, sessionId: string, status: AgentStatus): void {
    const message: AgentStatusMessage = {
      type: 'agent_status',
      agentId,
      status,
      timestamp: Date.now(),
    };

    this.wsHub.broadcastToSession(sessionId, message);
  }

  /**
   * Handle input from WebSocket - forward to agent
   */
  private handleSessionInput(sessionId: string, agentId: string, data: string): void {
    // Verify agent belongs to session
    const agents = this.sessionMappings.get(sessionId);
    if (!agents || !agents.has(agentId)) {
      console.warn(`[AgentWSBridge] Agent ${agentId} not registered for session ${sessionId}`);
      return;
    }

    // Forward to agent
    try {
      this.agentManager.writeToAgent(agentId, data);
    } catch (error) {
      console.error(`[AgentWSBridge] Failed to write to agent ${agentId}:`, error);
    }
  }

  /**
   * Handle MCP message from WebSocket - forward to agent and return response
   */
  private async handleSessionMCP(sessionId: string, agentId: string, message: MCPMessage): Promise<MCPMessage> {
    // Verify agent belongs to session
    const agents = this.sessionMappings.get(sessionId);
    if (!agents || !agents.has(agentId)) {
      throw new Error(`Agent ${agentId} not registered for session ${sessionId}`);
    }

    // Check if agent has MCP enabled
    if (!this.agentManager.hasMCP(agentId)) {
      throw new Error(`Agent ${agentId} does not have MCP enabled`);
    }

    // Forward to agent and wait for response
    return this.agentManager.sendMCPMessage(agentId, message);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let bridgeInstance: AgentWSBridge | null = null;

/**
 * Get the global AgentWSBridge instance
 */
export function getAgentWSBridge(): AgentWSBridge {
  if (!bridgeInstance) {
    bridgeInstance = new AgentWSBridge();
  }
  return bridgeInstance;
}

/**
 * Initialize the AgentWSBridge with custom dependencies
 */
export function initializeAgentWSBridge(
  agentManager?: AgentManager,
  wsHub?: WSHub
): AgentWSBridge {
  if (bridgeInstance) {
    bridgeInstance.cleanup();
  }
  bridgeInstance = new AgentWSBridge(agentManager, wsHub);
  return bridgeInstance;
}

/**
 * Reset the AgentWSBridge (for testing)
 */
export function resetAgentWSBridge(): void {
  if (bridgeInstance) {
    bridgeInstance.cleanup();
    bridgeInstance = null;
  }
}

// ============================================================================
// Export
// ============================================================================

export default AgentWSBridge;
