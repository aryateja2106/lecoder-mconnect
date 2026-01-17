/**
 * WebSocket Hub for MConnect v0.2.0
 *
 * Multiplexes multiple agent streams over WebSocket connections.
 * Handles authentication, message routing, broadcast, and protocol v2 session management.
 */

import type { Server as HTTPServer, IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { AgentManager } from '../agents/agent-manager.js';
import type { AgentConfig } from '../agents/types.js';
import { checkCommand, type GuardrailConfig } from '../guardrails.js';
import { detectInjection, RateLimiter, sanitizeInput } from '../security.js';
import type { ClientInfo, ClientMessage, ServerMessage, WSHubConfig } from './types.js';
import type {
  SessionAttachMessage,
  ScrollbackRequestMessage,
  ControlRequestMessage,
  HeartbeatAckMessage,
  SessionListMessage,
  SessionStateMessage,
  ControlStatusMessage,
  ScrollbackResponseMessage,
  ClientJoinedMessage,
  ClientLeftMessage,
  HeartbeatMessage,
  AuthSuccessMessage,
  ClientMessageV2,
  PROTOCOL_VERSION,
  HEARTBEAT_INTERVAL_MS,
  MAX_SCROLLBACK_REQUEST,
} from './protocol.js';
import type { SessionManager } from '../session/SessionManager.js';
import type { ClientType, Priority, RejectReason, ControlState } from '../session/types.js';
import { InputArbiter } from '../input/InputArbiter.js';
import type { InputRejectedMessage, ControlResponseMessage } from './protocol.js';

/**
 * Extract client IP from request
 */
function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Detect client type from User-Agent header with header override support
 * Priority: X-MConnect-Client-Type header > User-Agent detection
 */
function detectClientType(req: IncomingMessage): ClientType {
  // Check for explicit header override first
  const explicitType = req.headers['x-mconnect-client-type'];
  if (explicitType) {
    const type = Array.isArray(explicitType) ? explicitType[0] : explicitType;
    if (type === 'mobile' || type === 'pc') {
      return type;
    }
  }

  // Fall back to User-Agent detection
  const userAgent = req.headers['user-agent'] || '';
  const ua = userAgent.toLowerCase();

  // Mobile device patterns
  const mobilePatterns = [
    /android/i,
    /webos/i,
    /iphone/i,
    /ipad/i,
    /ipod/i,
    /blackberry/i,
    /windows phone/i,
    /opera mini/i,
    /mobile/i,
    /tablet/i,
  ];

  for (const pattern of mobilePatterns) {
    if (pattern.test(ua)) {
      return 'mobile';
    }
  }

  // Default to PC
  return 'pc';
}

/** Extended client info for v2 protocol */
interface ClientInfoV2 extends ClientInfo {
  clientId: string;
  clientType: ClientType;
  sessionId: string | null;
  priority: Priority;
  protocolVersion: string;
  lastHeartbeat: number;
}

/**
 * WebSocket Hub - manages all WebSocket connections and message routing
 */
export class WSHub {
  private wss: WebSocketServer;
  private config: WSHubConfig;
  private clients: Map<WebSocket, ClientInfoV2> = new Map();
  private rateLimiter: RateLimiter;
  private agentManager: AgentManager | null = null;
  private sessionManager: SessionManager | null = null;
  private isReadOnly: boolean = false;
  private guardrailConfig: GuardrailConfig | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private sessionArbiters: Map<string, InputArbiter> = new Map();
  private controlRequestRateLimiter: Map<string, number> = new Map(); // clientId -> last request time
  private scrollbackRateLimiter: Map<string, { count: number; windowStart: number }> = new Map();

  constructor(httpServer: HTTPServer, config: WSHubConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimit || 10, config.rateLimitWindow || 60000);

    this.wss = new WebSocketServer({
      server: httpServer,
      verifyClient: (info, callback) => {
        const ip = getClientIp(info.req);
        if (!this.rateLimiter.isAllowed(ip)) {
          callback(false, 429, 'Too many connections');
          return;
        }
        callback(true);
      },
    });

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.wss.on('error', (error) => {
      console.error('[WSHub] Error:', error.message);
    });
  }

  /**
   * Set the agent manager
   */
  setAgentManager(manager: AgentManager): void {
    this.agentManager = manager;

    // Wire up agent events to broadcast
    manager.on('data', (agentId, data) => {
      this.broadcast({
        type: 'output',
        agentId,
        data,
        timestamp: Date.now(),
      });
    });

    manager.on('status', (agentId, status) => {
      this.broadcast({
        type: 'agent_status',
        agentId,
        status,
        timestamp: Date.now(),
      });
    });

    manager.on('exit', (agentId, code, signal) => {
      this.broadcast({
        type: 'agent_exited',
        agentId,
        exitCode: code,
        signal,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Set guardrail configuration
   */
  setGuardrails(config: GuardrailConfig): void {
    this.guardrailConfig = config;
  }

  /**
   * Set the session manager (v2 protocol)
   */
  setSessionManager(manager: SessionManager): void {
    this.sessionManager = manager;
  }

  /**
   * Start heartbeat interval for v2 clients
   */
  startHeartbeat(): void {
    if (this.heartbeatInterval) {
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const heartbeat: HeartbeatMessage = {
        type: 'heartbeat',
        timestamp: now,
        serverTime: now,
      };

      for (const [ws, client] of this.clients) {
        if (ws.readyState === WebSocket.OPEN && client.protocolVersion === '2.0') {
          ws.send(JSON.stringify(heartbeat));
        }
      }
    }, 30000); // 30 second interval
  }

  /**
   * Stop heartbeat interval
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Set read-only mode
   */
  setReadOnly(readOnly: boolean): void {
    this.isReadOnly = readOnly;
    this.broadcast({
      type: 'mode_changed',
      isReadOnly: readOnly,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const ip = getClientIp(req);
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const providedToken = url.searchParams.get('token');
    const protocolVersion = url.searchParams.get('v') || '1.0';

    // Detect client type: query param overrides header/User-Agent detection
    const clientTypeParam = url.searchParams.get('clientType') as ClientType | null;
    const clientType: ClientType = clientTypeParam || detectClientType(req);

    // Authenticate
    if (providedToken !== this.config.token) {
      console.log(`[WSHub] Unauthorized connection from ${ip}`);
      ws.close(4001, 'Unauthorized');
      return;
    }

    const clientId = `${clientType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    const clientInfo: ClientInfoV2 = {
      ip,
      connectedAt: now,
      authenticated: true,
      clientId,
      clientType,
      sessionId: null,
      priority: clientType === 'pc' ? 'high' : 'normal',
      protocolVersion,
      lastHeartbeat: now,
    };

    this.clients.set(ws, clientInfo);
    console.log(`[WSHub] Client ${clientId} connected from ${ip} (${this.clients.size} total)`);

    // For v2 protocol, send auth_success and session_list
    if (protocolVersion === '2.0') {
      const authSuccess: AuthSuccessMessage = {
        type: 'auth_success',
        clientId,
        protocolVersion: '2.0',
        clientType,
      };
      this.sendToClient(ws, authSuccess);

      // Send session list if session manager available
      if (this.sessionManager) {
        const sessions = this.sessionManager.getAllSessions();
        const sessionList: SessionListMessage = {
          type: 'session_list',
          sessions: sessions.map((s) => ({
            id: s.id,
            state: s.state,
            createdAt: s.createdAt.getTime(),
            lastActivity: s.lastActivity.getTime(),
            agentConfig: s.agentConfig,
            workingDirectory: s.workingDirectory,
            connectedClients: this.sessionManager!.getSessionClients(s.id).length,
          })),
        };
        this.sendToClient(ws, sessionList);
      }
    } else {
      // v1 protocol - send initial session info
      const agents = this.agentManager?.getAllAgentInfos() || [];

      // Auto-set focusedAgentId to first agent for v1 clients
      if (agents.length > 0 && clientInfo) {
        clientInfo.focusedAgentId = agents[0].id;
      }

      this.sendToClient(ws, {
        type: 'session_info',
        sessionId: this.config.sessionId,
        isReadOnly: this.isReadOnly,
        agents,
        timestamp: Date.now(),
      });
    }

    // Handle messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('[WSHub] Parse error:', error);
        this.sendToClient(ws, {
          type: 'error',
          message: 'Invalid message format',
          timestamp: Date.now(),
        });
      }
    });

    ws.on('close', () => {
      const client = this.clients.get(ws);
      if (client?.sessionId) {
        // Remove from arbiter
        const arbiter = this.sessionArbiters.get(client.sessionId);
        if (arbiter) {
          arbiter.removeClient(client.clientId);
        }

        // Notify other clients in session
        this.broadcastToSession(client.sessionId, {
          type: 'client_left',
          clientId: client.clientId,
        } as ClientLeftMessage, client.clientId);

        // Detach from session
        this.sessionManager?.detachClient(client.clientId);
      }
      this.clients.delete(ws);
      this.controlRequestRateLimiter.delete(client?.clientId || '');
      console.log(`[WSHub] Client disconnected (${this.clients.size} remaining)`);
    });

    ws.on('error', (error) => {
      console.error(`[WSHub] Client error:`, error.message);
    });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(ws: WebSocket, message: ClientMessage): void {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo?.authenticated) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Not authenticated',
        timestamp: Date.now(),
      });
      return;
    }

    switch (message.type) {
      case 'input':
        // Validate input data is present
        if (typeof message.data !== 'string') {
          console.warn('[WSHub] input message missing data field');
          break;
        }
        this.handleInput(ws, message.agentId, message.data);
        break;

      case 'resize':
        if (this.agentManager) {
          // Support both v1 (with agentId) and v2 (without agentId) resize messages
          const resizeAgentId = 'agentId' in message ? message.agentId : (clientInfo.focusedAgentId || '');
          this.agentManager.resizeAgent(resizeAgentId, message.cols, message.rows);
        }
        break;

      case 'create_agent':
        this.handleCreateAgent(ws, message.config);
        break;

      case 'kill_agent':
        this.handleKillAgent(ws, message.agentId, message.signal);
        break;

      case 'switch_agent':
        // Update client's focused agent
        clientInfo.focusedAgentId = message.agentId;
        break;

      case 'list_agents':
        this.sendToClient(ws, {
          type: 'agent_list',
          agents: this.agentManager?.getAllAgentInfos() || [],
          timestamp: Date.now(),
        });
        break;

      case 'mode_change':
        this.setReadOnly(message.readOnly);
        break;

      case 'ping':
        this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
        break;

      // v2 Protocol Messages
      case 'session_attach':
        this.handleSessionAttach(ws, message as SessionAttachMessage);
        break;

      case 'session_detach':
        this.handleSessionDetach(ws);
        break;

      case 'scrollback_request':
        this.handleScrollbackRequest(ws, message as ScrollbackRequestMessage);
        break;

      case 'heartbeat_ack':
        this.handleHeartbeatAck(ws, message as HeartbeatAckMessage);
        break;

      case 'control_request':
        this.handleControlRequest(ws, message as ControlRequestMessage);
        break;

      case 'terminal_input':
        // v2 terminal input with arbiter check
        // Support both v1 (input) and v2 (data) field names for backwards compatibility
        const terminalMsg = message as { data?: string; input?: string; agentId?: string };
        const inputData = terminalMsg.data ?? terminalMsg.input;
        const agentId = terminalMsg.agentId || clientInfo.focusedAgentId || '';

        // Validate input data is present
        if (typeof inputData !== 'string') {
          console.warn('[WSHub] terminal_input missing data field');
          break;
        }

        // Check arbiter if client is attached to a session
        if (clientInfo.sessionId) {
          const arbiter = this.sessionArbiters.get(clientInfo.sessionId);
          if (arbiter) {
            const result = arbiter.processInput(clientInfo.clientId, inputData);
            if (!result.accepted) {
              // Input rejected by arbiter - message already sent via event
              break;
            }
          }
        }

        this.handleInput(ws, agentId, inputData);
        break;

      default:
        console.warn('[WSHub] Unknown message type:', (message as any).type);
    }
  }

  /**
   * Handle session_attach message (v2)
   */
  private handleSessionAttach(ws: WebSocket, message: SessionAttachMessage): void {
    const client = this.clients.get(ws);
    if (!client || !this.sessionManager) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Session manager not available',
        code: 'INTERNAL_ERROR',
      });
      return;
    }

    const session = this.sessionManager.getSession(message.sessionId);
    if (!session) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
      return;
    }

    if (session.state === 'completed') {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Session has completed',
        code: 'SESSION_COMPLETED',
      });
      return;
    }

    // Attach client to session
    const attachedClient = this.sessionManager.attachClient(
      message.sessionId,
      client.clientId,
      client.clientType,
      client.ip
    );

    if (!attachedClient) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Failed to attach to session',
        code: 'INTERNAL_ERROR',
      });
      return;
    }

    client.sessionId = message.sessionId;

    // Add client to arbiter
    const arbiter = this.getOrCreateArbiter(message.sessionId);
    arbiter.addClient(client.clientId, client.clientType, client.priority);

    // Send session state
    const sessionState: SessionStateMessage = {
      type: 'session_state',
      sessionId: session.id,
      state: session.state,
      lastActivity: session.lastActivity.getTime(),
    };
    this.sendToClient(ws, sessionState);

    // Send initial scrollback (most recent 1000 lines)
    const lines = this.sessionManager.getRecentScrollback(message.sessionId, 1000);
    const totalLines = this.sessionManager.getScrollbackLineCount(message.sessionId);
    const scrollbackResponse: ScrollbackResponseMessage = {
      type: 'scrollback_response',
      sessionId: message.sessionId,
      lines,
      fromLine: Math.max(0, totalLines - lines.length),
      totalLines,
    };
    this.sendToClient(ws, scrollbackResponse);

    // Send current control status
    const controlStatus: ControlStatusMessage = {
      type: 'control_status',
      sessionId: message.sessionId,
      state: arbiter.getState(),
      activeClient: arbiter.getControlState().currentOwner,
      exclusiveExpires: arbiter.getControlState().exclusiveExpires?.getTime(),
      lastPcActivity: arbiter.getControlState().lastPcInput?.getTime(),
    };
    this.sendToClient(ws, controlStatus);

    // Notify other clients
    this.broadcastToSession(message.sessionId, {
      type: 'client_joined',
      client: {
        id: client.clientId,
        clientType: client.clientType,
        priority: client.priority,
      },
    } as ClientJoinedMessage, client.clientId);

    console.log(`[WSHub] Client ${client.clientId} attached to session ${message.sessionId}`);
  }

  /**
   * Handle session_detach message (v2)
   */
  private handleSessionDetach(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (!client || !client.sessionId) {
      return;
    }

    const sessionId = client.sessionId;

    // Remove from arbiter
    const arbiter = this.sessionArbiters.get(sessionId);
    if (arbiter) {
      arbiter.removeClient(client.clientId);
    }

    // Notify other clients
    this.broadcastToSession(sessionId, {
      type: 'client_left',
      clientId: client.clientId,
    } as ClientLeftMessage, client.clientId);

    // Detach from session
    this.sessionManager?.detachClient(client.clientId);
    client.sessionId = null;

    // Send updated session list
    if (this.sessionManager) {
      const sessions = this.sessionManager.getAllSessions();
      const sessionList: SessionListMessage = {
        type: 'session_list',
        sessions: sessions.map((s) => ({
          id: s.id,
          state: s.state,
          createdAt: s.createdAt.getTime(),
          lastActivity: s.lastActivity.getTime(),
          agentConfig: s.agentConfig,
          workingDirectory: s.workingDirectory,
          connectedClients: this.sessionManager!.getSessionClients(s.id).length,
        })),
      };
      this.sendToClient(ws, sessionList);
    }
  }

  /**
   * Handle scrollback_request message (v2)
   * Rate limited to 10 requests per second per client
   */
  private handleScrollbackRequest(ws: WebSocket, message: ScrollbackRequestMessage): void {
    const client = this.clients.get(ws);
    if (!client || !this.sessionManager) {
      return;
    }

    // Rate limit: 10 requests per second per client
    const now = Date.now();
    const windowMs = 1000;
    const maxRequests = 10;

    let rateInfo = this.scrollbackRateLimiter.get(client.clientId);
    if (!rateInfo || now - rateInfo.windowStart >= windowMs) {
      rateInfo = { count: 0, windowStart: now };
      this.scrollbackRateLimiter.set(client.clientId, rateInfo);
    }

    if (rateInfo.count >= maxRequests) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Scrollback rate limit exceeded (10 requests/second)',
        code: 'RATE_LIMITED',
      });
      return;
    }
    rateInfo.count++;

    // Validate request
    const count = Math.min(message.count, 1000); // Max 1000 lines per request

    const lines = this.sessionManager.getScrollback(message.sessionId, message.fromLine, count);
    const totalLines = this.sessionManager.getScrollbackLineCount(message.sessionId);

    const response: ScrollbackResponseMessage = {
      type: 'scrollback_response',
      sessionId: message.sessionId,
      lines,
      fromLine: message.fromLine,
      totalLines,
    };
    this.sendToClient(ws, response);
  }

  /**
   * Handle heartbeat_ack message (v2)
   */
  private handleHeartbeatAck(ws: WebSocket, message: HeartbeatAckMessage): void {
    const client = this.clients.get(ws);
    if (client) {
      client.lastHeartbeat = Date.now();
    }
  }

  /**
   * Handle control_request message (v2)
   */
  private handleControlRequest(ws: WebSocket, message: ControlRequestMessage): void {
    const client = this.clients.get(ws);
    if (!client || !client.sessionId) {
      const response: ControlResponseMessage = {
        type: 'control_response',
        granted: false,
        reason: 'Not attached to session',
      };
      this.sendToClient(ws, response);
      return;
    }

    // Rate limit: 1 request per 10 seconds per client
    const now = Date.now();
    const lastRequest = this.controlRequestRateLimiter.get(client.clientId) || 0;
    if (now - lastRequest < 10000) {
      const response: ControlResponseMessage = {
        type: 'control_response',
        granted: false,
        reason: 'Rate limited - wait 10 seconds between requests',
      };
      this.sendToClient(ws, response);
      return;
    }
    this.controlRequestRateLimiter.set(client.clientId, now);

    const arbiter = this.sessionArbiters.get(client.sessionId);
    if (!arbiter) {
      const response: ControlResponseMessage = {
        type: 'control_response',
        granted: false,
        reason: 'Session arbiter not available',
      };
      this.sendToClient(ws, response);
      return;
    }

    if (message.action === 'exclusive') {
      const granted = arbiter.requestExclusiveControl(client.clientId);
      const response: ControlResponseMessage = {
        type: 'control_response',
        granted,
        reason: granted ? undefined : 'Exclusive control not available',
        expiresAt: granted ? Date.now() + 300000 : undefined, // 5 minutes
      };
      this.sendToClient(ws, response);

      if (granted) {
        // Broadcast control status to all clients in session
        this.broadcastControlStatus(client.sessionId, arbiter.getControlState());
      }
    } else if (message.action === 'release') {
      const released = arbiter.releaseExclusiveControl();
      const response: ControlResponseMessage = {
        type: 'control_response',
        granted: true,
        reason: released ? undefined : 'No exclusive control to release',
      };
      this.sendToClient(ws, response);

      if (released) {
        // Broadcast control status to all clients in session
        this.broadcastControlStatus(client.sessionId, arbiter.getControlState());
      }
    }
  }

  /**
   * Get or create arbiter for a session
   */
  private getOrCreateArbiter(sessionId: string): InputArbiter {
    let arbiter = this.sessionArbiters.get(sessionId);
    if (!arbiter) {
      arbiter = new InputArbiter(sessionId);
      arbiter.start();

      // Wire up audit logging to session store
      if (this.sessionManager) {
        arbiter.setAuditLogger((entry) => {
          // Log control events to input_log table using special markers
          this.sessionManager?.logInput(
            sessionId,
            entry.clientId,
            `[CONTROL:${entry.eventType.toUpperCase()}] ${entry.details}`,
            true // Control events are always "accepted" in terms of logging
          );
        });
      }

      // Wire up arbiter events
      arbiter.on('stateChange', (newState, oldState, controlState) => {
        this.broadcastControlStatus(sessionId, controlState);
      });

      arbiter.on('inputRejected', (clientId, input, reason) => {
        // Find the client's WebSocket and send rejection
        for (const [ws, client] of this.clients) {
          if (client.clientId === clientId) {
            const msg: InputRejectedMessage = {
              type: 'input_rejected',
              reason,
            };
            this.sendToClient(ws, msg);
            break;
          }
        }
      });

      this.sessionArbiters.set(sessionId, arbiter);
    }
    return arbiter;
  }

  /**
   * Broadcast control status to all clients in a session
   */
  broadcastControlStatus(sessionId: string, controlState: ControlState): void {
    const message: ControlStatusMessage = {
      type: 'control_status',
      sessionId,
      state: controlState.state,
      activeClient: controlState.currentOwner,
      exclusiveExpires: controlState.exclusiveExpires?.getTime(),
      lastPcActivity: controlState.lastPcInput?.getTime(),
    };
    this.broadcastToSession(sessionId, message);
  }

  /**
   * Broadcast to all clients in a session
   */
  broadcastToSession(sessionId: string, message: unknown, excludeClientId?: string): void {
    const data = JSON.stringify(message);
    for (const [ws, client] of this.clients) {
      if (
        ws.readyState === WebSocket.OPEN &&
        client.authenticated &&
        client.sessionId === sessionId &&
        client.clientId !== excludeClientId
      ) {
        ws.send(data);
      }
    }
  }

  /**
   * Broadcast session state change to all clients in a session
   */
  broadcastSessionState(sessionId: string, state: 'running' | 'paused' | 'completed'): void {
    const session = this.sessionManager?.getSession(sessionId);
    if (!session) return;

    const message: SessionStateMessage = {
      type: 'session_state',
      sessionId,
      state,
      lastActivity: session.lastActivity.getTime(),
    };
    this.broadcastToSession(sessionId, message);
  }

  /**
   * Handle input to an agent
   */
  private handleInput(ws: WebSocket, agentId: string, data: string): void {
    if (!this.agentManager) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Agent manager not initialized',
        timestamp: Date.now(),
      });
      return;
    }

    // Check read-only mode
    if (this.isReadOnly) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Read-only mode is active. Toggle to input mode first.',
        timestamp: Date.now(),
      });
      return;
    }

    // Sanitize input
    const sanitized = sanitizeInput(data);

    // Check guardrails for commands (lines ending with newline)
    const isCommand = sanitized.includes('\n') || sanitized.includes('\r');

    if (isCommand && this.guardrailConfig) {
      // Check for injection
      if (detectInjection(sanitized)) {
        this.broadcast({
          type: 'command_blocked',
          agentId,
          command: '[hidden for security]',
          reason: 'Potential injection detected',
          timestamp: Date.now(),
        });
        return;
      }

      // Check guardrails
      const check = checkCommand(sanitized, this.guardrailConfig);
      if (check.blocked) {
        this.broadcast({
          type: 'command_blocked',
          agentId,
          command: sanitized,
          reason: check.reason || 'Command blocked by guardrails',
          timestamp: Date.now(),
        });
        return;
      }

      if (check.requiresApproval) {
        this.broadcast({
          type: 'approval_request',
          agentId,
          command: sanitized,
          reason: check.reason || 'Command requires approval',
          timestamp: Date.now(),
        });
        return;
      }
    }

    // Send to agent
    const success = this.agentManager.writeToAgent(agentId, sanitized);
    if (!success) {
      this.sendToClient(ws, {
        type: 'error',
        message: `Agent ${agentId} not found or not running`,
        agentId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle agent creation request
   */
  private async handleCreateAgent(ws: WebSocket, config: Omit<AgentConfig, 'cwd'>): Promise<void> {
    if (!this.agentManager) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Agent manager not initialized',
        timestamp: Date.now(),
      });
      return;
    }

    try {
      const agent = await this.agentManager.createAgent(config);
      this.broadcast({
        type: 'agent_created',
        agent: agent.getInfo(),
        timestamp: Date.now(),
      });
    } catch (error) {
      this.sendToClient(ws, {
        type: 'error',
        message: `Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle agent kill request
   */
  private handleKillAgent(ws: WebSocket, agentId: string, signal?: string): void {
    if (!this.agentManager) {
      return;
    }

    const success = this.agentManager.killAgent(agentId, signal);
    if (!success) {
      this.sendToClient(ws, {
        type: 'error',
        message: `Agent ${agentId} not found`,
        agentId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all authenticated clients
   */
  broadcast(message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const [client, info] of this.clients) {
      if (client.readyState === WebSocket.OPEN && info.authenticated) {
        client.send(data);
      }
    }
  }

  /**
   * Get connected client count
   */
  get clientCount(): number {
    return this.clients.size;
  }

  /**
   * Get read-only status
   */
  get readOnly(): boolean {
    return this.isReadOnly;
  }

  /**
   * Close all connections and cleanup
   */
  close(): void {
    this.stopHeartbeat();
    for (const [client] of this.clients) {
      client.close(1000, 'Server shutting down');
    }
    this.clients.clear();
    this.controlRequestRateLimiter.clear();

    // Stop and cleanup all arbiters
    for (const arbiter of this.sessionArbiters.values()) {
      arbiter.stop();
    }
    this.sessionArbiters.clear();

    this.wss.close();
    this.rateLimiter.cleanup();
  }

  /**
   * Get clients attached to a specific session
   */
  getSessionClients(sessionId: string): ClientInfoV2[] {
    return Array.from(this.clients.values()).filter(
      (client) => client.sessionId === sessionId
    );
  }
}
