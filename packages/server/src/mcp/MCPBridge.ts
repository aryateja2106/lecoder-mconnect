/**
 * MCP Bridge - Model Context Protocol Stdio Transport
 *
 * Implements MCP message handling for agent containers:
 * - Stdio transport using container attach streams
 * - Request/response correlation with message IDs
 * - Tool registration from container
 * - Message routing through WebSocket
 *
 * Based on spec §2.2.3 and MCP protocol specification.
 */

import { EventEmitter } from 'node:events';
import type {
  MCPMessage,
  MCPRequest,
  MCPResponse,
  MCPNotification,
  MCPTool,
  MCPToolConfig,
  MCPToolCallParams,
  MCPToolCallResult,
} from '@lecoder/shared';
import type { ContainerStreams } from '../agents/ContainerRuntime.js';
import { getOpikService, type TraceContext } from '../observability/OpikService.js';
import { getTracingMiddleware } from '../observability/TracingMiddleware.js';

// ============================================================================
// Types
// ============================================================================

/**
 * MCP Bridge configuration
 */
export interface MCPBridgeConfig {
  /** Request timeout in milliseconds (default: 30000) */
  requestTimeoutMs: number;
  /** Buffer size for parsing (default: 65536) */
  bufferSize: number;
  /** Enable debug logging */
  debug: boolean;
}

const DEFAULT_CONFIG: MCPBridgeConfig = {
  requestTimeoutMs: 30000,
  bufferSize: 65536,
  debug: false,
};

/**
 * Pending request state
 */
interface PendingRequest {
  /** Request ID */
  id: string | number;
  /** Method name */
  method: string;
  /** Resolve callback */
  resolve: (response: MCPResponse) => void;
  /** Reject callback */
  reject: (error: Error) => void;
  /** Request timeout timer */
  timeout: ReturnType<typeof setTimeout>;
  /** Start timestamp for latency tracking */
  startTime: number;
  /** Trace context for observability */
  traceContext?: TraceContext;
}

/**
 * MCP Bridge events
 */
export interface MCPBridgeEvents {
  /** Tool registered */
  toolRegistered: (tool: MCPTool) => void;
  /** Tool unregistered */
  toolUnregistered: (toolName: string) => void;
  /** Notification received */
  notification: (notification: MCPNotification) => void;
  /** Connection ready */
  ready: () => void;
  /** Connection closed */
  closed: () => void;
  /** Error occurred */
  error: (error: Error) => void;
  /** Raw message received (for debugging) */
  rawMessage: (message: string) => void;
}

/**
 * MCP connection state
 */
export type MCPConnectionState = 'disconnected' | 'connecting' | 'ready' | 'error';

// ============================================================================
// MCPBridge Class
// ============================================================================

/**
 * MCP Bridge for stdio-based communication with containers
 *
 * Handles:
 * - JSON-RPC message framing over stdio
 * - Request/response correlation
 * - Tool discovery and registration
 * - Notification handling
 */
export class MCPBridge extends EventEmitter {
  private config: MCPBridgeConfig;
  private agentId: string;
  private state: MCPConnectionState = 'disconnected';
  private streams: ContainerStreams | null = null;
  private pendingRequests: Map<string | number, PendingRequest> = new Map();
  private registeredTools: Map<string, MCPTool> = new Map();
  private messageIdCounter = 0;
  private inputBuffer = '';
  private serverCapabilities: Record<string, unknown> = {};

  constructor(agentId: string, config: Partial<MCPBridgeConfig> = {}) {
    super();
    this.agentId = agentId;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Get current connection state
   */
  getState(): MCPConnectionState {
    return this.state;
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Connect to container via stdio streams
   */
  async connect(streams: ContainerStreams): Promise<void> {
    if (this.state !== 'disconnected') {
      throw new Error(`Cannot connect: bridge is ${this.state}`);
    }

    this.state = 'connecting';
    this.streams = streams;
    this.inputBuffer = '';

    // Setup stream handlers
    this.setupStreamHandlers();

    // Perform MCP initialization
    try {
      await this.initialize();
      this.state = 'ready';
      this.emit('ready');
    } catch (error) {
      this.state = 'error';
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Send an MCP request during initialization
   * (bypasses ready state check)
   */
  private async sendInitRequest<T = unknown>(
    method: string,
    params?: unknown
  ): Promise<T> {
    if (this.state !== 'connecting' && this.state !== 'ready') {
      throw new Error(`Cannot send request: bridge is ${this.state}`);
    }

    const id = this.generateMessageId();

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      // Setup timeout
      const timeout = setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, this.config.requestTimeoutMs);

      // Store pending request
      this.pendingRequests.set(id, {
        id,
        method,
        resolve: (response) => {
          resolve(response.result as T);
        },
        reject,
        timeout,
        startTime: Date.now(),
      });

      // Send the request
      this.sendMessage(request);
    });
  }

  /**
   * Disconnect from container
   */
  disconnect(): void {
    if (this.state === 'disconnected') {
      return;
    }

    // Cancel all pending requests
    for (const request of this.pendingRequests.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Bridge disconnected'));
    }
    this.pendingRequests.clear();

    // Clear tools
    this.registeredTools.clear();

    // Clear streams
    this.streams = null;
    this.inputBuffer = '';

    this.state = 'disconnected';
    this.emit('closed');
  }

  /**
   * Send an MCP request and wait for response
   */
  async sendRequest<T = unknown>(
    method: string,
    params?: unknown
  ): Promise<T> {
    if (this.state !== 'ready') {
      throw new Error(`Cannot send request: bridge is ${this.state}`);
    }

    const id = this.generateMessageId();
    const opik = getOpikService();
    const traceCtx = opik.startTrace('mcp:request', {
      agentId: this.agentId,
      method,
    });

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      // Setup timeout
      const timeout = setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          opik.endTrace(traceCtx, undefined, new Error('Request timeout'));
          reject(new Error(`Request timeout: ${method}`));
        }
      }, this.config.requestTimeoutMs);

      const requestStartTime = Date.now();

      // Store pending request
      this.pendingRequests.set(id, {
        id,
        method,
        resolve: (response) => {
          const latencyMs = Date.now() - requestStartTime;
          opik.endTrace(traceCtx, { latencyMs, hasResult: !!response.result });
          resolve(response.result as T);
        },
        reject: (error) => {
          opik.endTrace(traceCtx, undefined, error);
          reject(error);
        },
        timeout,
        startTime: requestStartTime,
        traceContext: traceCtx,
      });

      // Send the request
      this.sendMessage(request);
    });
  }

  /**
   * Send an MCP notification (no response expected)
   */
  sendNotification(method: string, params?: unknown): void {
    if (this.state !== 'ready') {
      throw new Error(`Cannot send notification: bridge is ${this.state}`);
    }

    const notification: MCPNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.sendMessage(notification);
  }

  /**
   * Call a tool by name
   */
  async callTool(name: string, args?: Record<string, unknown>): Promise<MCPToolCallResult> {
    const tracing = getTracingMiddleware();
    const spanInfo = tracing.traceMCPRequest(this.agentId, `tools/call:${name}`, args);

    const params: MCPToolCallParams = {
      name,
      arguments: args,
    };

    try {
      const result = await this.sendRequest<MCPToolCallResult>('tools/call', params);
      tracing.endMCPRequest(spanInfo, result);
      return result;
    } catch (error) {
      tracing.endMCPRequest(spanInfo, undefined, error as Error);
      throw error;
    }
  }

  /**
   * List available tools from the container
   */
  async listTools(): Promise<MCPTool[]> {
    const result = await this.sendRequest<{ tools: MCPToolConfig[] }>('tools/list');

    // Update registered tools
    this.registeredTools.clear();
    for (const toolConfig of result.tools) {
      const tool: MCPTool = {
        ...toolConfig,
        server: this.agentId,
      };
      this.registeredTools.set(tool.name, tool);
      this.emit('toolRegistered', tool);
    }

    return Array.from(this.registeredTools.values());
  }

  /**
   * Get registered tools
   */
  getTools(): MCPTool[] {
    return Array.from(this.registeredTools.values());
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): MCPTool | undefined {
    return this.registeredTools.get(name);
  }

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean {
    return this.registeredTools.has(name);
  }

  /**
   * Get server capabilities
   */
  getCapabilities(): Record<string, unknown> {
    return { ...this.serverCapabilities };
  }

  // ==========================================================================
  // Private Methods - Message Handling
  // ==========================================================================

  /**
   * Setup stream handlers for reading MCP messages
   */
  private setupStreamHandlers(): void {
    if (!this.streams) {
      return;
    }

    const { stdout, stderr } = this.streams;

    // Handle stdout (MCP messages)
    stdout.on('data', (data: Buffer) => {
      this.handleStreamData(data);
    });

    // Handle stderr (log output, not MCP)
    stderr.on('data', (data: Buffer) => {
      if (this.config.debug) {
        console.error(`[MCPBridge:${this.agentId}] stderr:`, data.toString());
      }
    });

    // Handle stream errors
    stdout.on('error', (error: Error) => {
      this.handleStreamError(error);
    });

    stderr.on('error', (error: Error) => {
      if (this.config.debug) {
        console.error(`[MCPBridge:${this.agentId}] stderr error:`, error);
      }
    });

    // Handle stream close
    stdout.on('end', () => {
      this.handleStreamEnd();
    });
  }

  /**
   * Handle incoming stream data
   *
   * MCP uses newline-delimited JSON (NDJSON) for message framing
   */
  private handleStreamData(data: Buffer): void {
    this.inputBuffer += data.toString('utf-8');

    // Process complete messages (newline-delimited)
    let newlineIndex: number = this.inputBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = this.inputBuffer.substring(0, newlineIndex).trim();
      this.inputBuffer = this.inputBuffer.substring(newlineIndex + 1);

      if (line.length > 0) {
        this.emit('rawMessage', line);
        this.parseAndHandleMessage(line);
      }
      newlineIndex = this.inputBuffer.indexOf('\n');
    }

    // Check for buffer overflow
    if (this.inputBuffer.length > this.config.bufferSize) {
      const error = new Error('Input buffer overflow');
      this.emit('error', error);
      this.inputBuffer = '';
    }
  }

  /**
   * Parse and handle a complete message line
   */
  private parseAndHandleMessage(line: string): void {
    let message: MCPMessage;

    try {
      message = JSON.parse(line) as MCPMessage;
    } catch (error) {
      if (this.config.debug) {
        console.error(`[MCPBridge:${this.agentId}] Failed to parse message:`, line, error);
      }
      return;
    }

    // Validate JSON-RPC version
    if (message.jsonrpc !== '2.0') {
      if (this.config.debug) {
        console.warn(`[MCPBridge:${this.agentId}] Invalid JSON-RPC version:`, message);
      }
      return;
    }

    // Determine message type and handle
    if ('id' in message && message.id !== undefined) {
      // Response (has id, has result or error)
      if ('result' in message || 'error' in message) {
        this.handleResponse(message as MCPResponse);
      } else if ('method' in message && message.method) {
        // Request from server (has id and method)
        this.handleServerRequest(message as MCPRequest);
      }
    } else if ('method' in message && message.method) {
      // Notification (has method, no id)
      this.handleNotification(message as MCPNotification);
    }
  }

  /**
   * Handle a response message
   */
  private handleResponse(response: MCPResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      if (this.config.debug) {
        console.warn(`[MCPBridge:${this.agentId}] Received response for unknown request:`, response.id);
      }
      return;
    }

    // Clear timeout and remove from pending
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    // Resolve or reject based on response
    if (response.error) {
      const error = new MCPRequestError(
        response.error.message,
        response.error.code,
        response.error.data
      );
      pending.reject(error);
    } else {
      pending.resolve(response);
    }
  }

  /**
   * Handle a server-initiated request
   */
  private handleServerRequest(request: MCPRequest): void {
    // MCP server can send requests like sampling/createMessage
    // For now, we'll just log these
    if (this.config.debug) {
      console.log(`[MCPBridge:${this.agentId}] Server request:`, request.method);
    }

    // Send error response - we don't handle server requests yet
    const errorResponse: MCPResponse = {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32601,
        message: 'Method not found',
      },
    };

    this.sendMessage(errorResponse);
  }

  /**
   * Handle a notification message
   */
  private handleNotification(notification: MCPNotification): void {
    this.emit('notification', notification);

    // Handle specific notification types
    switch (notification.method) {
      case 'notifications/tools/list_changed':
        // Tools have changed, refresh the list
        this.listTools().catch((error) => {
          if (this.config.debug) {
            console.error(`[MCPBridge:${this.agentId}] Failed to refresh tools:`, error);
          }
        });
        break;

      case 'notifications/resources/list_changed':
        // Resources have changed
        break;

      case 'notifications/progress':
        // Progress update
        break;

      default:
        if (this.config.debug) {
          console.log(`[MCPBridge:${this.agentId}] Unhandled notification:`, notification.method);
        }
    }
  }

  /**
   * Handle stream error
   */
  private handleStreamError(error: Error): void {
    this.state = 'error';
    this.emit('error', error);

    // Reject all pending requests
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * Handle stream end
   */
  private handleStreamEnd(): void {
    this.disconnect();
  }

  // ==========================================================================
  // Private Methods - Message Sending
  // ==========================================================================

  /**
   * Send a message to the container
   */
  private sendMessage(message: MCPMessage): void {
    if (!this.streams) {
      throw new Error('Not connected');
    }

    const json = JSON.stringify(message);
    const data = json + '\n'; // NDJSON framing

    this.streams.stdin.write(data);
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    this.messageIdCounter++;
    return `${this.agentId}-${this.messageIdCounter}`;
  }

  /**
   * Send notification during initialization (bypasses ready state check)
   */
  private sendInitNotification(method: string, params?: unknown): void {
    if (this.state !== 'connecting' && this.state !== 'ready') {
      throw new Error(`Cannot send notification: bridge is ${this.state}`);
    }

    const notification: MCPNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.sendMessage(notification);
  }

  /**
   * List tools during initialization
   */
  private async listToolsInit(): Promise<MCPTool[]> {
    const result = await this.sendInitRequest<{ tools: MCPToolConfig[] }>('tools/list');

    // Update registered tools
    this.registeredTools.clear();
    for (const toolConfig of result.tools) {
      const tool: MCPTool = {
        ...toolConfig,
        server: this.agentId,
      };
      this.registeredTools.set(tool.name, tool);
      this.emit('toolRegistered', tool);
    }

    return Array.from(this.registeredTools.values());
  }

  // ==========================================================================
  // Private Methods - Initialization
  // ==========================================================================

  /**
   * Perform MCP initialization handshake
   */
  private async initialize(): Promise<void> {
    // Send initialize request (using init-specific method that allows connecting state)
    const initResult = await this.sendInitRequest<{
      protocolVersion: string;
      capabilities: Record<string, unknown>;
      serverInfo: {
        name: string;
        version: string;
      };
    }>('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {
          listChanged: true,
        },
      },
      clientInfo: {
        name: 'mconnect',
        version: '2.0.0',
      },
    });

    // Store server capabilities
    this.serverCapabilities = initResult.capabilities;

    // Send initialized notification (bypass state check during init)
    this.sendInitNotification('notifications/initialized');

    // List available tools
    if (this.serverCapabilities.tools) {
      await this.listToolsInit();
    }
  }
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error from MCP request
 */
export class MCPRequestError extends Error {
  public readonly code: number;
  public readonly data?: unknown;

  constructor(message: string, code: number, data?: unknown) {
    super(message);
    this.name = 'MCPRequestError';
    this.code = code;
    this.data = data;
  }
}

// ============================================================================
// Factory and Singleton Management
// ============================================================================

/**
 * Map of agent ID to MCP bridge instance
 */
const bridgeInstances: Map<string, MCPBridge> = new Map();

/**
 * Create an MCP bridge for an agent
 */
export function createMCPBridge(
  agentId: string,
  config?: Partial<MCPBridgeConfig>
): MCPBridge {
  const existing = bridgeInstances.get(agentId);
  if (existing) {
    existing.disconnect();
  }

  const bridge = new MCPBridge(agentId, config);
  bridgeInstances.set(agentId, bridge);

  return bridge;
}

/**
 * Get an existing MCP bridge for an agent
 */
export function getMCPBridge(agentId: string): MCPBridge | undefined {
  return bridgeInstances.get(agentId);
}

/**
 * Remove an MCP bridge for an agent
 */
export function removeMCPBridge(agentId: string): void {
  const bridge = bridgeInstances.get(agentId);
  if (bridge) {
    bridge.disconnect();
    bridgeInstances.delete(agentId);
  }
}

/**
 * Get all active MCP bridges
 */
export function getAllMCPBridges(): Map<string, MCPBridge> {
  return new Map(bridgeInstances);
}

/**
 * Cleanup all MCP bridges
 */
export function cleanupMCPBridges(): void {
  for (const bridge of bridgeInstances.values()) {
    bridge.disconnect();
  }
  bridgeInstances.clear();
}

// ============================================================================
// Export
// ============================================================================

export default MCPBridge;
