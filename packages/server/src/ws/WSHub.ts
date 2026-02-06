/**
 * WebSocket Hub - Protocol v3 WebSocket Server
 * MConnect V2 Server
 *
 * Implements the WSHub interface from spec §2.2.4:
 * - Connection management with auth
 * - Message routing
 * - Input arbitration (PC priority)
 * - Heartbeat and reconnection
 */

import type { ServerWebSocket } from 'bun';
import type {
  ClientType,
  Priority,
  ClientInfo,
  AccessTokenClaims,
  GuardrailLevel,
  GuardrailConfig,
} from '@lecoder/shared';
import {
  loadGuardrails,
  checkCommand,
} from '@lecoder/shared';
import type {
  ClientMessage,
  ServerMessage,
  AuthMessage,
  AuthSuccessMessage,
  AuthFailedMessage,
  HeartbeatMessage,
  PongMessage,
  ErrorMessage,
  ControlStatusMessage,
  InputRejectedMessage,
  ClientJoinedMessage,
  ClientLeftMessage,
  TerminalInputMessage,
  ControlRequestMessage,
  MCPForwardMessage,
  MCPResponseMessage,
  DeviceTokenRegisterMessage,
} from '@lecoder/shared/protocol';
import { InputArbiter, type InputResult } from './InputArbiter.js';
import { getJWTService } from '../auth/jwt.js';
import type { MCPMessage } from '@lecoder/shared';
import { deviceTokenRepository } from '../db/repositories/device-token.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Connected client state
 */
interface ConnectedClient {
  /** Unique client ID */
  id: string;
  /** WebSocket connection */
  ws: ServerWebSocket<WebSocketData>;
  /** Authenticated user ID */
  userId: string;
  /** User email */
  email: string;
  /** User name */
  name: string;
  /** Client device type */
  clientType: ClientType;
  /** Input priority */
  priority: Priority;
  /** Current session ID (null if not attached) */
  sessionId: string | null;
  /** Connection timestamp */
  connectedAt: Date;
  /** Last heartbeat timestamp */
  lastHeartbeat: Date;
  /** Whether client is authenticated */
  authenticated: boolean;
}

/**
 * WebSocket data attached to each connection
 */
export interface WebSocketData {
  clientId: string;
  createdAt: number;
}

/**
 * WSHub configuration
 */
export interface WSHubConfig {
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatIntervalMs: number;
  /** Client timeout after missed heartbeats in ms (default: 90000) */
  clientTimeoutMs: number;
  /** Auth timeout in ms (default: 10000) */
  authTimeoutMs: number;
  /** Max message size in bytes (default: 1MB) */
  maxMessageSize: number;
}

const DEFAULT_CONFIG: WSHubConfig = {
  heartbeatIntervalMs: 30000,
  clientTimeoutMs: 90000,
  authTimeoutMs: 10000,
  maxMessageSize: 1024 * 1024, // 1MB
};

/**
 * Input handler callback
 */
export type InputHandler = (agentId: string, data: string) => void;

/**
 * MCP handler callback
 */
export type MCPHandler = (agentId: string, message: MCPMessage) => Promise<MCPMessage>;

// ============================================================================
// WSHub Class
// ============================================================================

/**
 * WebSocket Hub for managing client connections
 */
export class WSHub {
  private config: WSHubConfig;
  private clients: Map<string, ConnectedClient> = new Map();
  private sessionArbiters: Map<string, InputArbiter> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private authTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /** Event handlers */
  private inputHandlers: Map<string, InputHandler> = new Map(); // sessionId -> handler
  private mcpHandlers: Map<string, MCPHandler> = new Map(); // sessionId -> handler

  /** Guardrail configs per session */
  private sessionGuardrails: Map<string, GuardrailConfig> = new Map(); // sessionId -> config

  constructor(config: Partial<WSHubConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the hub (begins heartbeat timer)
   */
  start(): void {
    if (this.heartbeatInterval) {
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeats();
      this.cleanupStaleClients();
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Stop the hub
   */
  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Clear all auth timeouts
    for (const timeout of this.authTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.authTimeouts.clear();

    // Stop all arbiters
    for (const arbiter of this.sessionArbiters.values()) {
      arbiter.stop();
    }
    this.sessionArbiters.clear();

    // Clear guardrail configs
    this.sessionGuardrails.clear();

    // Close all connections
    for (const client of this.clients.values()) {
      client.ws.close(1000, 'Hub shutting down');
    }
    this.clients.clear();
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws: ServerWebSocket<WebSocketData>): void {
    const clientId = ws.data.clientId;

    // Create unauthenticated client entry
    const client: ConnectedClient = {
      id: clientId,
      ws,
      userId: '',
      email: '',
      name: '',
      clientType: 'pc', // Will be set on auth
      priority: 'normal',
      sessionId: null,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      authenticated: false,
    };

    this.clients.set(clientId, client);

    // Set auth timeout - client must authenticate within authTimeoutMs
    const authTimeout = setTimeout(() => {
      this.handleAuthTimeout(clientId);
    }, this.config.authTimeoutMs);
    this.authTimeouts.set(clientId, authTimeout);
  }

  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(ws: ServerWebSocket<WebSocketData>, data: string | Buffer): Promise<void> {
    const clientId = ws.data.clientId;
    const client = this.clients.get(clientId);

    if (!client) {
      // Unknown client, close connection
      ws.close(1008, 'Unknown client');
      return;
    }

    // Update last activity
    client.lastHeartbeat = new Date();

    // Parse message
    let message: ClientMessage;
    try {
      const text = typeof data === 'string' ? data : data.toString('utf-8');
      message = JSON.parse(text) as ClientMessage;
    } catch {
      this.sendError(clientId, 'Invalid JSON message', 'INTERNAL_ERROR', false);
      return;
    }

    // Handle unauthenticated state - must be auth message
    if (!client.authenticated) {
      if (message.type !== 'auth') {
        this.sendAuthFailed(clientId, 'missing_token');
        ws.close(1008, 'Authentication required');
        return;
      }
      await this.handleAuthMessage(clientId, message as AuthMessage);
      return;
    }

    // Handle authenticated messages
    await this.handleClientMessage(clientId, message);
  }

  /**
   * Handle WebSocket close
   */
  handleClose(ws: ServerWebSocket<WebSocketData>): void {
    const clientId = ws.data.clientId;
    this.disconnect(clientId);
  }

  /**
   * Disconnect a client
   */
  disconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    // Clear auth timeout if pending
    const authTimeout = this.authTimeouts.get(clientId);
    if (authTimeout) {
      clearTimeout(authTimeout);
      this.authTimeouts.delete(clientId);
    }

    // Remove from session arbiter
    if (client.sessionId) {
      const arbiter = this.sessionArbiters.get(client.sessionId);
      if (arbiter) {
        arbiter.removeClient(clientId);
      }

      // Broadcast client left
      this.broadcastToSession(
        client.sessionId,
        {
          type: 'client_left',
          clientId,
          timestamp: Date.now(),
        },
        clientId
      );
    }

    // Remove from clients
    this.clients.delete(clientId);

    // Close WebSocket if still open
    try {
      client.ws.close(1000, 'Disconnected');
    } catch {
      // Ignore close errors
    }
  }

  /**
   * Send a message to a specific client
   */
  sendToClient(clientId: string, message: ServerMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    try {
      const json = JSON.stringify(message);
      client.ws.send(json);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Broadcast a message to all clients in a session
   */
  broadcastToSession(sessionId: string, message: ServerMessage, excludeClientId?: string): void {
    for (const client of this.clients.values()) {
      if (client.sessionId === sessionId && client.id !== excludeClientId) {
        this.sendToClient(client.id, message);
      }
    }
  }

  /**
   * Process input from a client
   */
  processInput(clientId: string, input: string): InputResult {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) {
      return { accepted: false, rejectReason: 'read_only' };
    }

    const arbiter = this.sessionArbiters.get(client.sessionId);
    if (!arbiter) {
      return { accepted: false, rejectReason: 'read_only' };
    }

    return arbiter.processInput(clientId, input);
  }

  /**
   * Request exclusive control for a client
   */
  requestExclusiveControl(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) {
      return false;
    }

    const arbiter = this.sessionArbiters.get(client.sessionId);
    if (!arbiter) {
      return false;
    }

    return arbiter.requestExclusiveControl(clientId);
  }

  /**
   * Release control for a client
   */
  releaseControl(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) {
      return;
    }

    const arbiter = this.sessionArbiters.get(client.sessionId);
    if (arbiter && arbiter.hasExclusiveControl(clientId)) {
      arbiter.releaseExclusiveControl();
    }
  }

  /**
   * Get client info
   */
  getClientInfo(clientId: string): ClientInfo | null {
    const client = this.clients.get(clientId);
    if (!client) {
      return null;
    }

    return {
      id: client.id,
      clientType: client.clientType,
      priority: client.priority,
    };
  }

  /**
   * Get all clients in a session
   */
  getSessionClients(sessionId: string): ClientInfo[] {
    const clients: ClientInfo[] = [];

    for (const client of this.clients.values()) {
      if (client.sessionId === sessionId) {
        clients.push({
          id: client.id,
          clientType: client.clientType,
          priority: client.priority,
        });
      }
    }

    return clients;
  }

  /**
   * Register input handler for a session
   */
  registerInputHandler(sessionId: string, handler: InputHandler): void {
    this.inputHandlers.set(sessionId, handler);
  }

  /**
   * Unregister input handler for a session
   */
  unregisterInputHandler(sessionId: string): void {
    this.inputHandlers.delete(sessionId);
  }

  /**
   * Register MCP handler for a session
   */
  registerMCPHandler(sessionId: string, handler: MCPHandler): void {
    this.mcpHandlers.set(sessionId, handler);
  }

  /**
   * Unregister MCP handler for a session
   */
  unregisterMCPHandler(sessionId: string): void {
    this.mcpHandlers.delete(sessionId);
  }

  /**
   * Set the guardrail level for a session
   */
  setSessionGuardrails(sessionId: string, level: GuardrailLevel): void {
    this.sessionGuardrails.set(sessionId, loadGuardrails(level));
  }

  /**
   * Get the guardrail config for a session
   */
  getSessionGuardrails(sessionId: string): GuardrailConfig | undefined {
    return this.sessionGuardrails.get(sessionId);
  }

  /**
   * Remove guardrail config for a session
   */
  removeSessionGuardrails(sessionId: string): void {
    this.sessionGuardrails.delete(sessionId);
  }

  /**
   * Attach a client to a session
   */
  attachToSession(clientId: string, sessionId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    // Detach from current session if attached
    if (client.sessionId) {
      this.detachFromSession(clientId);
    }

    // Get or create arbiter for session
    let arbiter = this.sessionArbiters.get(sessionId);
    if (!arbiter) {
      arbiter = new InputArbiter(sessionId);
      arbiter.start();
      this.setupArbiterListeners(arbiter);
      this.sessionArbiters.set(sessionId, arbiter);
    }

    // Add client to arbiter
    arbiter.addClient(clientId, client.clientType, client.priority);

    // Update client state
    client.sessionId = sessionId;

    // Broadcast client joined
    this.broadcastToSession(
      sessionId,
      {
        type: 'client_joined',
        client: {
          id: client.id,
          clientType: client.clientType,
          priority: client.priority,
        },
        timestamp: Date.now(),
      } as ClientJoinedMessage,
      clientId
    );

    // Send control status to client
    this.sendControlStatus(clientId, arbiter);

    return true;
  }

  /**
   * Detach a client from its session
   */
  detachFromSession(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) {
      return;
    }

    const sessionId = client.sessionId;
    const arbiter = this.sessionArbiters.get(sessionId);

    if (arbiter) {
      arbiter.removeClient(clientId);

      // If no more clients in session, stop arbiter and clean up
      if (arbiter.getClients().length === 0) {
        arbiter.stop();
        this.sessionArbiters.delete(sessionId);
        this.sessionGuardrails.delete(sessionId);
      }
    }

    // Broadcast client left
    this.broadcastToSession(
      sessionId,
      {
        type: 'client_left',
        clientId,
        timestamp: Date.now(),
      } as ClientLeftMessage,
      clientId
    );

    client.sessionId = null;
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get authenticated client count
   */
  getAuthenticatedClientCount(): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.authenticated) {
        count++;
      }
    }
    return count;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Handle auth message
   */
  private async handleAuthMessage(clientId: string, message: AuthMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    // Clear auth timeout
    const authTimeout = this.authTimeouts.get(clientId);
    if (authTimeout) {
      clearTimeout(authTimeout);
      this.authTimeouts.delete(clientId);
    }

    // Validate token
    let claims: AccessTokenClaims | null = null;
    try {
      const jwtService = getJWTService();
      claims = await jwtService.validateAccessToken(message.token);
    } catch {
      // Token validation failed
    }

    if (!claims) {
      this.sendAuthFailed(clientId, 'invalid_token');
      client.ws.close(1008, 'Authentication failed');
      return;
    }

    // Update client with auth info
    client.userId = claims.sub;
    client.email = claims.email;
    client.name = claims.name;
    client.clientType = message.clientType;
    client.priority = message.clientType === 'pc' ? 'high' : 'normal';
    client.authenticated = true;

    // Send success response
    const successMessage: AuthSuccessMessage = {
      type: 'auth_success',
      clientId,
      protocolVersion: '3.0',
      clientType: client.clientType,
      userId: client.userId,
      timestamp: Date.now(),
    };

    this.sendToClient(clientId, successMessage);
  }

  /**
   * Handle authenticated client message
   */
  private async handleClientMessage(clientId: string, message: ClientMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    switch (message.type) {
      case 'session_attach':
        this.attachToSession(clientId, message.sessionId);
        break;

      case 'session_detach':
        this.detachFromSession(clientId);
        break;

      case 'terminal_input':
        await this.handleTerminalInput(clientId, message as TerminalInputMessage);
        break;

      case 'control_request':
        this.handleControlRequest(clientId, message as ControlRequestMessage);
        break;

      case 'heartbeat_ack':
        client.lastHeartbeat = new Date();
        break;

      case 'ping':
        this.sendToClient(clientId, {
          type: 'pong',
          timestamp: Date.now(),
        } as PongMessage);
        break;

      case 'resize':
        // Forward to agent manager (not implemented in this step)
        break;

      case 'scrollback_request':
        // Forward to session manager (not implemented in this step)
        break;

      case 'mcp_forward':
        await this.handleMCPForward(clientId, message as MCPForwardMessage);
        break;

      case 'device_token_register':
        await this.handleDeviceTokenRegister(clientId, message as DeviceTokenRegisterMessage);
        break;

      default:
        // Unknown message type
        break;
    }
  }

  /**
   * Handle terminal input message
   */
  private async handleTerminalInput(
    clientId: string,
    message: TerminalInputMessage
  ): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) {
      this.sendInputRejected(clientId, 'read_only');
      return;
    }

    // Process input through arbiter (PC priority, rate limiting, etc.)
    const result = this.processInput(clientId, message.data);

    if (!result.accepted) {
      this.sendInputRejected(clientId, result.rejectReason!);
      return;
    }

    // Check guardrails for the session
    const guardrailConfig = this.sessionGuardrails.get(client.sessionId);
    if (guardrailConfig) {
      const check = checkCommand(message.data, guardrailConfig);

      if (check.blocked) {
        this.sendInputRejected(clientId, 'guardrail_blocked', message.data);
        return;
      }

      if (check.requiresApproval) {
        // Approval not yet implemented - block with guardrail reason
        this.sendInputRejected(clientId, 'guardrail_blocked', message.data);
        return;
      }
    }

    // Forward to input handler
    const handler = this.inputHandlers.get(client.sessionId);
    if (handler) {
      handler(message.agentId, message.data);
    }
  }

  /**
   * Handle control request message
   */
  private handleControlRequest(clientId: string, message: ControlRequestMessage): void {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) {
      return;
    }

    if (message.action === 'exclusive') {
      const granted = this.requestExclusiveControl(clientId);
      this.sendToClient(clientId, {
        type: 'control_response',
        granted,
        reason: granted ? undefined : 'Control not available',
        expiresAt: granted ? Date.now() + 300000 : undefined, // 5 min
        timestamp: Date.now(),
      });
    } else if (message.action === 'release') {
      this.releaseControl(clientId);
      this.sendToClient(clientId, {
        type: 'control_response',
        granted: true,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle MCP forward message
   */
  private async handleMCPForward(clientId: string, message: MCPForwardMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) {
      this.sendError(clientId, 'Not attached to session', 'NOT_ATTACHED', false);
      return;
    }

    const handler = this.mcpHandlers.get(client.sessionId);
    if (!handler) {
      this.sendError(clientId, 'No MCP handler registered', 'INTERNAL_ERROR', false);
      return;
    }

    try {
      const response = await handler(message.agentId, message.message);

      // Send MCP response back to client
      const responseMessage: MCPResponseMessage = {
        type: 'mcp_response',
        agentId: message.agentId,
        message: response,
        timestamp: Date.now(),
      };

      this.sendToClient(clientId, responseMessage);
    } catch (error) {
      // Send error response
      const errorResponse: MCPResponseMessage = {
        type: 'mcp_response',
        agentId: message.agentId,
        message: {
          jsonrpc: '2.0',
          id: message.message.id,
          error: {
            code: -32000,
            message: (error as Error).message,
          },
        },
        timestamp: Date.now(),
      };

      this.sendToClient(clientId, errorResponse);
    }
  }

  /**
   * Handle device token registration message
   */
  private async handleDeviceTokenRegister(
    clientId: string,
    message: DeviceTokenRegisterMessage
  ): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      await deviceTokenRepository.registerToken({
        userId: client.userId,
        token: message.deviceToken,
        platform: message.platform,
      });
    } catch (error) {
      console.error(`[WSHub] Failed to register device token for client ${clientId}:`, error);
    }
  }

  /**
   * Handle auth timeout
   */
  private handleAuthTimeout(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    if (!client.authenticated) {
      this.sendAuthFailed(clientId, 'expired_token');
      client.ws.close(1008, 'Authentication timeout');
      this.clients.delete(clientId);
    }

    this.authTimeouts.delete(clientId);
  }

  /**
   * Send heartbeats to all authenticated clients
   */
  private sendHeartbeats(): void {
    const heartbeatMessage: HeartbeatMessage = {
      type: 'heartbeat',
      timestamp: Date.now(),
      serverTime: Date.now(),
    };

    for (const client of this.clients.values()) {
      if (client.authenticated) {
        this.sendToClient(client.id, heartbeatMessage);
      }
    }
  }

  /**
   * Cleanup stale clients
   */
  private cleanupStaleClients(): void {
    const now = Date.now();
    const timeout = this.config.clientTimeoutMs;

    for (const client of this.clients.values()) {
      const elapsed = now - client.lastHeartbeat.getTime();
      if (elapsed > timeout) {
        this.disconnect(client.id);
      }
    }
  }

  /**
   * Setup arbiter event listeners
   */
  private setupArbiterListeners(arbiter: InputArbiter): void {
    arbiter.on('stateChange', (_newState, _oldState, controlState) => {
      const sessionId = arbiter.getSessionId();
      this.broadcastControlStatus(sessionId, controlState);
    });

    arbiter.on('inputRejected', (clientId: string, _input: string, reason: string) => {
      this.sendInputRejected(clientId, reason as any);
    });

    arbiter.on('controlGranted', (clientId: string, _priority: Priority) => {
      const sessionId = arbiter.getSessionId();
      this.sendControlStatus(clientId, arbiter);
      this.broadcastControlStatus(sessionId, arbiter.getControlState(), clientId);
    });

    arbiter.on('controlReleased', (_clientId: string) => {
      const sessionId = arbiter.getSessionId();
      this.broadcastControlStatus(sessionId, arbiter.getControlState());
    });
  }

  /**
   * Send control status to a client
   */
  private sendControlStatus(clientId: string, arbiter: InputArbiter): void {
    const controlState = arbiter.getControlState();
    const message: ControlStatusMessage = {
      type: 'control_status',
      sessionId: arbiter.getSessionId(),
      state: controlState.state,
      activeClient: controlState.currentOwner,
      exclusiveExpires: controlState.exclusiveExpires?.getTime(),
      lastPcActivity: controlState.lastPcInput?.getTime(),
      timestamp: Date.now(),
    };

    this.sendToClient(clientId, message);
  }

  /**
   * Broadcast control status to session
   */
  private broadcastControlStatus(
    sessionId: string,
    controlState: ReturnType<InputArbiter['getControlState']>,
    excludeClientId?: string
  ): void {
    const message: ControlStatusMessage = {
      type: 'control_status',
      sessionId,
      state: controlState.state,
      activeClient: controlState.currentOwner,
      exclusiveExpires: controlState.exclusiveExpires?.getTime(),
      lastPcActivity: controlState.lastPcInput?.getTime(),
      timestamp: Date.now(),
    };

    this.broadcastToSession(sessionId, message, excludeClientId);
  }

  /**
   * Send auth failed message
   */
  private sendAuthFailed(
    clientId: string,
    reason: 'invalid_token' | 'expired_token' | 'missing_token'
  ): void {
    const message: AuthFailedMessage = {
      type: 'auth_failed',
      reason,
      retryable: reason !== 'missing_token',
      timestamp: Date.now(),
    };

    this.sendToClient(clientId, message);
  }

  /**
   * Send input rejected message
   */
  private sendInputRejected(
    clientId: string,
    reason: 'pc_typing' | 'other_exclusive' | 'rate_limited' | 'read_only' | 'guardrail_blocked',
    command?: string
  ): void {
    const message: InputRejectedMessage = {
      type: 'input_rejected',
      reason,
      ...(reason === 'guardrail_blocked' && command ? { command } : {}),
      timestamp: Date.now(),
    };

    this.sendToClient(clientId, message);
  }

  /**
   * Send error message
   */
  private sendError(
    clientId: string,
    errorMessage: string,
    code: ErrorMessage['code'],
    retryable: boolean,
    retryAfterMs?: number
  ): void {
    const message: ErrorMessage = {
      type: 'error',
      message: errorMessage,
      code,
      retryable,
      retryAfterMs,
      timestamp: Date.now(),
    };

    this.sendToClient(clientId, message);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let hubInstance: WSHub | null = null;

/**
 * Get the global WSHub instance
 */
export function getWSHub(): WSHub {
  if (!hubInstance) {
    hubInstance = new WSHub();
    hubInstance.start();
  }
  return hubInstance;
}

/**
 * Initialize the WSHub with custom configuration
 */
export function initializeWSHub(config: Partial<WSHubConfig> = {}): WSHub {
  if (hubInstance) {
    hubInstance.stop();
  }
  hubInstance = new WSHub(config);
  hubInstance.start();
  return hubInstance;
}

/**
 * Reset the WSHub (for testing)
 */
export function resetWSHub(): void {
  if (hubInstance) {
    hubInstance.stop();
    hubInstance = null;
  }
}

// ============================================================================
// Export
// ============================================================================

export default WSHub;
