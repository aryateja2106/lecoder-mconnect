/**
 * Agent Manager - Agent Lifecycle Management
 *
 * Implements the AgentManager interface from spec §2.2.3:
 * - Container lifecycle via Docker API
 * - Agent creation, start, stop
 * - I/O streaming (writeToAgent, onAgentOutput)
 * - Status tracking and database persistence
 */

import { EventEmitter } from 'node:events';
import type {
  Agent,
  AgentConfig,
  AgentStatus,
  MCPMessage,
  MCPTool,
  MCPResponse as MCPResponseType,
} from '@lecoder/shared';
import {
  ContainerRuntime,
  createContainerOptions,
  type ContainerStreams,
} from './ContainerRuntime.js';
import { agentRepository, type CreateAgentInput } from '../db/repositories/agent.js';
import { getOpikService, type TraceContext } from '../observability/OpikService.js';
import { getTracingMiddleware } from '../observability/TracingMiddleware.js';
import { type MCPBridge, createMCPBridge, removeMCPBridge } from '../mcp/MCPBridge.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Agent output callback
 */
export type AgentOutputCallback = (data: string) => void;

/**
 * Agent status change callback
 */
export type AgentStatusCallback = (agentId: string, status: AgentStatus) => void;

/**
 * Agent manager events
 */
export interface AgentManagerEvents {
  /** Agent output received */
  output: (agentId: string, data: string) => void;
  /** Agent status changed */
  statusChange: (agentId: string, status: AgentStatus, previousStatus: AgentStatus) => void;
  /** Agent started */
  started: (agentId: string) => void;
  /** Agent stopped */
  stopped: (agentId: string, exitCode?: number) => void;
  /** Agent error */
  error: (agentId: string, error: Error) => void;
}

/**
 * MCP response type from shared
 */
export type MCPResponse = MCPResponseType;

/**
 * Runtime agent state (in-memory)
 */
interface AgentRuntime {
  /** Agent ID */
  id: string;
  /** Session ID */
  sessionId: string;
  /** Container ID (if running) */
  containerId?: string;
  /** Container streams (if attached) */
  streams?: ContainerStreams;
  /** MCP bridge (if MCP enabled) */
  mcpBridge?: MCPBridge;
  /** Output callbacks */
  outputCallbacks: Set<AgentOutputCallback>;
  /** Status callbacks */
  statusCallbacks: Set<AgentStatusCallback>;
  /** Current status */
  status: AgentStatus;
  /** MCP tools registered by this agent */
  mcpTools: Map<string, MCPTool>;
  /** Active trace context for observability */
  traceContext?: TraceContext;
}

// ============================================================================
// AgentManager Class
// ============================================================================

/**
 * Agent Manager
 *
 * Manages agent lifecycle including container provisioning, I/O streaming,
 * and status tracking. Integrates with:
 * - ContainerRuntime for Docker operations
 * - AgentRepository for database persistence
 * - OpikService for observability tracing
 */
export class AgentManager extends EventEmitter {
  private containerRuntime: ContainerRuntime;
  private agents: Map<string, AgentRuntime> = new Map();

  constructor(containerRuntime?: ContainerRuntime) {
    super();
    this.containerRuntime = containerRuntime ?? new ContainerRuntime();
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Create a new agent with optional container
   *
   * @param sessionId - Session to associate the agent with
   * @param config - Agent configuration
   * @returns Created agent
   */
  async createAgent(sessionId: string, config: AgentConfig): Promise<Agent> {
    const opik = getOpikService();
    const tracing = getTracingMiddleware();
    const traceCtx = opik.startTrace('agent:create', {
      sessionId,
      agentType: config.type,
      agentName: config.name,
      hasContainer: !!config.container,
    });

    // Apply user attribution from session context
    const sessionCtx = tracing.getSessionContext(sessionId);
    if (sessionCtx) {
      traceCtx.userId = sessionCtx.userId;
      traceCtx.sessionId = sessionCtx.sessionId;
    }

    try {
      // Create agent in database
      const createInput: CreateAgentInput = {
        sessionId,
        type: config.type,
        name: config.name,
        config,
        status: 'starting',
      };

      const agent = await agentRepository.create(createInput);

      // Start agent lifecycle trace via middleware
      tracing.startAgentTrace(agent.id, sessionId, {
        agentType: config.type,
        agentName: config.name,
      });

      // Initialize runtime state
      const runtime: AgentRuntime = {
        id: agent.id,
        sessionId,
        status: 'starting',
        outputCallbacks: new Set(),
        statusCallbacks: new Set(),
        mcpTools: new Map(),
        traceContext: traceCtx,
      };

      this.agents.set(agent.id, runtime);

      // If container config is provided, create container
      if (config.container) {
        const containerSpan = opik.startSpan(traceCtx, 'container:create', 'general', {
          image: config.container.image,
        });

        try {
          // Build command for the agent
          const command = this.buildAgentCommand(config);

          // Create container options
          const containerOptions = createContainerOptions(
            config.container,
            `mconnect-agent-${agent.id.substring(0, 8)}`,
            command
          );

          // Ensure image is available
          await this.containerRuntime.ensureImage(config.container.image);

          // Create container
          const containerId = await this.containerRuntime.createContainer(containerOptions);
          runtime.containerId = containerId;

          // Update agent with container ID
          await agentRepository.update(agent.id, { containerId });
          agent.containerId = containerId;

          opik.endSpan(containerSpan, { containerId });
        } catch (error) {
          opik.endSpan(containerSpan, { error: (error as Error).message });
          throw error;
        }
      }

      opik.endTrace(traceCtx, { agentId: agent.id });
      return agent;
    } catch (error) {
      // Update status to error
      opik.endTrace(traceCtx, undefined, error as Error);
      throw error;
    }
  }

  /**
   * Start an agent
   *
   * For containerized agents: starts container and attaches streams
   * For non-containerized: not yet implemented
   */
  async startAgent(agentId: string): Promise<void> {
    const runtime = this.getRuntime(agentId);
    const opik = getOpikService();
    const tracing = getTracingMiddleware();
    const traceCtx = opik.startTrace('agent:start', {
      agentId,
      sessionId: runtime.sessionId,
    });

    // Apply user attribution
    const sessionCtx = tracing.getSessionContext(runtime.sessionId);
    if (sessionCtx) {
      traceCtx.userId = sessionCtx.userId;
      traceCtx.sessionId = sessionCtx.sessionId;
    }

    try {
      // Update status
      await this.updateStatus(agentId, 'starting');

      if (runtime.containerId) {
        // Container-based agent
        const startSpan = opik.startSpan(traceCtx, 'container:start', 'general', {
          containerId: runtime.containerId,
        });

        try {
          // Attach to container before starting to capture all output
          const streams = await this.containerRuntime.attachToContainer(runtime.containerId);
          runtime.streams = streams;

          // Setup output handling
          this.setupOutputHandling(agentId, streams);

          // Start container
          await this.containerRuntime.startContainer(runtime.containerId);

          // Update status to running
          await this.updateStatus(agentId, 'running');
          await agentRepository.markStarted(agentId, runtime.containerId);

          // Emit started event
          this.emit('started', agentId);

          opik.endSpan(startSpan, { status: 'running' });
        } catch (error) {
          opik.endSpan(startSpan, { error: (error as Error).message });
          throw error;
        }

        // Wait for container in background and update status when it exits
        this.monitorContainerExit(agentId, runtime.containerId);
      } else {
        // Non-containerized agent - not implemented yet
        throw new Error('Non-containerized agents not yet implemented');
      }

      opik.endTrace(traceCtx, { status: 'started' });
    } catch (error) {
      await this.updateStatus(agentId, 'error');
      opik.endTrace(traceCtx, undefined, error as Error);
      throw error;
    }
  }

  /**
   * Stop an agent
   *
   * @param agentId - Agent to stop
   * @param signal - Signal to send (default: SIGTERM)
   */
  async stopAgent(agentId: string, signal?: string): Promise<void> {
    const runtime = this.getRuntime(agentId);
    const opik = getOpikService();
    const tracing = getTracingMiddleware();
    const traceCtx = opik.startTrace('agent:stop', {
      agentId,
      signal: signal ?? 'SIGTERM',
    });

    // Apply user attribution
    const sessionCtx = tracing.getSessionContext(runtime.sessionId);
    if (sessionCtx) {
      traceCtx.userId = sessionCtx.userId;
      traceCtx.sessionId = sessionCtx.sessionId;
    }

    try {
      if (runtime.containerId) {
        // Stop container
        if (signal && signal !== 'SIGTERM') {
          await this.containerRuntime.killContainer(runtime.containerId, signal);
        } else {
          await this.containerRuntime.stopContainer(runtime.containerId);
        }
      }

      // Update status
      await this.updateStatus(agentId, 'exited');
      await agentRepository.markStopped(agentId, 0, 'exited');

      // Emit stopped event
      this.emit('stopped', agentId, 0);

      opik.endTrace(traceCtx, { status: 'stopped' });
    } catch (error) {
      await this.updateStatus(agentId, 'error');
      opik.endTrace(traceCtx, undefined, error as Error);
      throw error;
    }
  }

  /**
   * Remove an agent and cleanup resources
   */
  async removeAgent(agentId: string): Promise<void> {
    const runtime = this.agents.get(agentId);
    if (!runtime) {
      return;
    }

    const opik = getOpikService();
    const traceCtx = opik.startTrace('agent:remove', {
      agentId,
      sessionId: runtime.sessionId,
      status: runtime.status,
    });

    try {
      // Stop if running
      if (runtime.status === 'running' || runtime.status === 'starting') {
        try {
          await this.stopAgent(agentId);
        } catch {
          // Continue cleanup even if stop fails
        }
      }

      // Cleanup MCP bridge if exists
      this.cleanupMCPBridge(agentId);

      // Remove container if exists
      if (runtime.containerId) {
        try {
          await this.containerRuntime.removeContainer(runtime.containerId, true);
        } catch {
          // Container may already be removed
        }
      }

      // End agent lifecycle trace
      const tracing = getTracingMiddleware();
      tracing.endAgentTrace(agentId, { removed: true });

      // Clear callbacks
      runtime.outputCallbacks.clear();
      runtime.statusCallbacks.clear();
      runtime.mcpTools.clear();

      // Remove from map
      this.agents.delete(agentId);

      opik.endTrace(traceCtx, { removed: true });
    } catch (error) {
      opik.endTrace(traceCtx, undefined, error as Error);
      throw error;
    }
  }

  // ==========================================================================
  // I/O Methods
  // ==========================================================================

  /**
   * Write input to an agent
   */
  writeToAgent(agentId: string, data: string): void {
    const runtime = this.getRuntime(agentId);

    if (runtime.status !== 'running' && runtime.status !== 'idle') {
      throw new Error(`Agent ${agentId} is not running (status: ${runtime.status})`);
    }

    const tracing = getTracingMiddleware();
    const agentTrace = tracing.getAgentTrace(agentId);
    if (agentTrace) {
      const opik = getOpikService();
      const span = opik.startSpan(agentTrace, 'agent:write', 'general', {
        agentId,
        dataLength: data.length,
      });
      opik.endSpan(span, { written: true });
    }

    if (runtime.streams) {
      runtime.streams.stdin.write(data);
    } else if (runtime.containerId) {
      // Fallback to writeToContainer
      this.containerRuntime.writeToContainer(runtime.containerId, data).catch((error) => {
        this.emit('error', agentId, error);
      });
    } else {
      throw new Error(`Agent ${agentId} has no input channel`);
    }
  }

  /**
   * Register a callback for agent output
   *
   * @returns Unsubscribe function
   */
  onAgentOutput(agentId: string, callback: AgentOutputCallback): () => void {
    const runtime = this.getRuntime(agentId);
    runtime.outputCallbacks.add(callback);

    return () => {
      runtime.outputCallbacks.delete(callback);
    };
  }

  /**
   * Register a callback for agent status changes
   *
   * @returns Unsubscribe function
   */
  onAgentStatus(agentId: string, callback: AgentStatusCallback): () => void {
    const runtime = this.getRuntime(agentId);
    runtime.statusCallbacks.add(callback);

    return () => {
      runtime.statusCallbacks.delete(callback);
    };
  }

  // ==========================================================================
  // MCP Methods
  // ==========================================================================

  /**
   * Initialize MCP for an agent
   *
   * Creates an MCP bridge and connects it to the agent's container streams.
   * Should be called after the agent is started and streams are available.
   */
  async initializeMCP(agentId: string): Promise<void> {
    const runtime = this.getRuntime(agentId);

    if (!runtime.streams) {
      throw new Error(`Agent ${agentId} has no streams - cannot initialize MCP`);
    }

    if (runtime.mcpBridge) {
      throw new Error(`Agent ${agentId} already has an MCP bridge`);
    }

    const opik = getOpikService();
    const tracing = getTracingMiddleware();
    const traceCtx = opik.startTrace('mcp:initialize', {
      agentId,
      sessionId: runtime.sessionId,
    });

    // Apply user attribution
    const sessionCtx = tracing.getSessionContext(runtime.sessionId);
    if (sessionCtx) {
      traceCtx.userId = sessionCtx.userId;
      traceCtx.sessionId = sessionCtx.sessionId;
    }

    try {
      // Create and connect MCP bridge
      const bridge = createMCPBridge(agentId);

      // Setup event handlers
      bridge.on('toolRegistered', (tool: MCPTool) => {
        runtime.mcpTools.set(tool.name, tool);
      });

      bridge.on('toolUnregistered', (toolName: string) => {
        runtime.mcpTools.delete(toolName);
      });

      bridge.on('error', (error: Error) => {
        this.emit('error', agentId, error);
      });

      // Connect to container streams
      await bridge.connect(runtime.streams);

      runtime.mcpBridge = bridge;

      opik.endTrace(traceCtx, {
        toolCount: bridge.getTools().length,
        capabilities: bridge.getCapabilities(),
      });
    } catch (error) {
      opik.endTrace(traceCtx, undefined, error as Error);
      throw error;
    }
  }

  /**
   * Check if an agent has MCP enabled
   */
  hasMCP(agentId: string): boolean {
    const runtime = this.agents.get(agentId);
    return !!runtime?.mcpBridge;
  }

  /**
   * Get the MCP bridge for an agent
   */
  getMCPBridge(agentId: string): MCPBridge | undefined {
    const runtime = this.agents.get(agentId);
    return runtime?.mcpBridge;
  }

  /**
   * Send an MCP request to an agent and wait for response
   */
  async sendMCPMessage(agentId: string, message: MCPMessage): Promise<MCPResponse> {
    const runtime = this.getRuntime(agentId);

    if (!runtime.mcpBridge) {
      throw new Error(`Agent ${agentId} does not have MCP enabled`);
    }

    // MCP message should have a method - this is a request
    if (!message.method) {
      throw new Error('MCP message must have a method');
    }

    const tracing = getTracingMiddleware();
    const spanInfo = tracing.traceMCPRequest(agentId, message.method, message.params);

    try {
      const result = await runtime.mcpBridge.sendRequest(message.method, message.params);
      tracing.endMCPRequest(spanInfo, result);
      return {
        jsonrpc: '2.0',
        id: message.id ?? 0,
        result,
      };
    } catch (error) {
      tracing.endMCPRequest(spanInfo, undefined, error as Error);
      return {
        jsonrpc: '2.0',
        id: message.id ?? 0,
        error: {
          code: -32000,
          message: (error as Error).message,
        },
      };
    }
  }

  /**
   * Call an MCP tool on an agent
   */
  async callMCPTool(
    agentId: string,
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<unknown> {
    const runtime = this.getRuntime(agentId);

    if (!runtime.mcpBridge) {
      throw new Error(`Agent ${agentId} does not have MCP enabled`);
    }

    const tracing = getTracingMiddleware();
    const spanInfo = tracing.traceMCPRequest(agentId, `tools/call:${toolName}`, args);

    try {
      const result = await runtime.mcpBridge.callTool(toolName, args);
      tracing.endMCPRequest(spanInfo, result);
      return result;
    } catch (error) {
      tracing.endMCPRequest(spanInfo, undefined, error as Error);
      throw error;
    }
  }

  /**
   * List MCP tools available on an agent
   */
  async listMCPTools(agentId: string): Promise<MCPTool[]> {
    const runtime = this.getRuntime(agentId);

    if (!runtime.mcpBridge) {
      throw new Error(`Agent ${agentId} does not have MCP enabled`);
    }

    return runtime.mcpBridge.listTools();
  }

  /**
   * Register an MCP tool for an agent (manual registration)
   */
  registerTool(agentId: string, tool: MCPTool): void {
    const runtime = this.getRuntime(agentId);
    runtime.mcpTools.set(tool.name, tool);
  }

  /**
   * Get registered MCP tools for an agent
   */
  getTools(agentId: string): MCPTool[] {
    const runtime = this.getRuntime(agentId);
    return Array.from(runtime.mcpTools.values());
  }

  /**
   * Cleanup MCP bridge for an agent
   */
  private cleanupMCPBridge(agentId: string): void {
    const runtime = this.agents.get(agentId);
    if (runtime?.mcpBridge) {
      runtime.mcpBridge.disconnect();
      removeMCPBridge(agentId);
      runtime.mcpBridge = undefined;
    }
  }

  // ==========================================================================
  // Status Methods
  // ==========================================================================

  /**
   * Get agent status
   */
  getAgentStatus(agentId: string): AgentStatus {
    const runtime = this.agents.get(agentId);
    if (!runtime) {
      throw new Error(`Agent ${agentId} not found`);
    }
    return runtime.status;
  }

  /**
   * Get all agents for a session
   */
  async getAllAgents(sessionId: string): Promise<Agent[]> {
    return agentRepository.getBySession(sessionId);
  }

  /**
   * Get running agents for a session
   */
  async getRunningAgents(sessionId: string): Promise<Agent[]> {
    return agentRepository.getRunningBySession(sessionId);
  }

  /**
   * Check if an agent is running
   */
  isRunning(agentId: string): boolean {
    const runtime = this.agents.get(agentId);
    return runtime?.status === 'running' || runtime?.status === 'idle';
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  /**
   * Stop all agents for a session
   */
  async stopSessionAgents(sessionId: string): Promise<void> {
    const agentIds: string[] = [];

    for (const [id, runtime] of this.agents.entries()) {
      if (runtime.sessionId === sessionId) {
        agentIds.push(id);
      }
    }

    // Stop all agents in parallel
    await Promise.allSettled(
      agentIds.map((id) => this.stopAgent(id))
    );

    // Update database
    await agentRepository.stopAllForSession(sessionId);
  }

  /**
   * Remove all agents for a session
   */
  async removeSessionAgents(sessionId: string): Promise<void> {
    const agentIds: string[] = [];

    for (const [id, runtime] of this.agents.entries()) {
      if (runtime.sessionId === sessionId) {
        agentIds.push(id);
      }
    }

    // Remove all agents in parallel
    await Promise.allSettled(
      agentIds.map((id) => this.removeAgent(id))
    );
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Cleanup all agents and containers
   */
  async cleanup(): Promise<void> {
    // Stop all agents
    await Promise.allSettled(
      Array.from(this.agents.keys()).map((id) => this.removeAgent(id))
    );

    // Cleanup container runtime
    await this.containerRuntime.cleanup();

    // Cleanup tracing middleware state for this manager
    const tracing = getTracingMiddleware();
    for (const agentId of this.agents.keys()) {
      tracing.endAgentTrace(agentId, { cleanup: true });
    }

    this.agents.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Get runtime state for an agent, throw if not found
   */
  private getRuntime(agentId: string): AgentRuntime {
    const runtime = this.agents.get(agentId);
    if (!runtime) {
      throw new Error(`Agent ${agentId} not found`);
    }
    return runtime;
  }

  /**
   * Update agent status in memory and database
   */
  private async updateStatus(agentId: string, status: AgentStatus): Promise<void> {
    const runtime = this.agents.get(agentId);
    if (!runtime) {
      return;
    }

    const previousStatus = runtime.status;
    runtime.status = status;

    // Update database
    await agentRepository.updateStatus(agentId, status);

    // Notify callbacks
    for (const callback of runtime.statusCallbacks) {
      try {
        callback(agentId, status);
      } catch {
        // Ignore callback errors
      }
    }

    // Emit event
    this.emit('statusChange', agentId, status, previousStatus);
  }

  /**
   * Build command array for an agent
   */
  private buildAgentCommand(config: AgentConfig): string[] {
    // If command has args, build array
    const parts: string[] = [];

    if (config.command) {
      parts.push(config.command);
    }

    if (config.args) {
      parts.push(...config.args);
    }

    // If no command specified, default to shell
    if (parts.length === 0) {
      return ['/bin/bash'];
    }

    // Wrap in shell for proper execution
    return ['/bin/sh', '-c', parts.join(' ')];
  }

  /**
   * Setup output handling from container streams
   */
  private setupOutputHandling(agentId: string, streams: ContainerStreams): void {
    const runtime = this.agents.get(agentId);
    if (!runtime) {
      return;
    }

    // Handle stdout
    streams.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      this.handleAgentOutput(agentId, text);
    });

    // Handle stderr (also send to output)
    streams.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      this.handleAgentOutput(agentId, text);
    });

    // Handle stream errors
    streams.stdout.on('error', (error: Error) => {
      this.emit('error', agentId, error);
    });

    streams.stderr.on('error', (error: Error) => {
      this.emit('error', agentId, error);
    });
  }

  /**
   * Handle agent output data
   */
  private handleAgentOutput(agentId: string, data: string): void {
    const runtime = this.agents.get(agentId);
    if (!runtime) {
      return;
    }

    // Process output for token usage detection
    const tracing = getTracingMiddleware();
    tracing.processAgentOutput(agentId, data);

    // Notify callbacks
    for (const callback of runtime.outputCallbacks) {
      try {
        callback(data);
      } catch {
        // Ignore callback errors
      }
    }

    // Emit event
    this.emit('output', agentId, data);
  }

  /**
   * Monitor container exit in background
   */
  private monitorContainerExit(agentId: string, containerId: string): void {
    this.containerRuntime.waitForContainer(containerId)
      .then(async ({ exitCode }) => {
        const runtime = this.agents.get(agentId);
        if (!runtime) {
          return;
        }

        // Update status
        const status: AgentStatus = exitCode === 0 ? 'exited' : 'error';
        await this.updateStatus(agentId, status);
        await agentRepository.markStopped(agentId, exitCode, status);

        // Emit stopped event
        this.emit('stopped', agentId, exitCode);
      })
      .catch((error) => {
        this.emit('error', agentId, error);
      });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let managerInstance: AgentManager | null = null;

/**
 * Get the global AgentManager instance
 */
export function getAgentManager(): AgentManager {
  if (!managerInstance) {
    managerInstance = new AgentManager();
  }
  return managerInstance;
}

/**
 * Initialize the AgentManager with a custom container runtime
 */
export function initializeAgentManager(containerRuntime?: ContainerRuntime): AgentManager {
  if (managerInstance) {
    // Cleanup existing instance
    managerInstance.cleanup();
  }
  managerInstance = new AgentManager(containerRuntime);
  return managerInstance;
}

/**
 * Reset the AgentManager (for testing)
 */
export function resetAgentManager(): void {
  if (managerInstance) {
    managerInstance.cleanup();
    managerInstance = null;
  }
}

// ============================================================================
// Export
// ============================================================================

export default AgentManager;
