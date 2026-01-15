/**
 * WebSocket Hub for MConnect v0.1.2
 *
 * Multiplexes multiple agent streams over WebSocket connections.
 * Handles authentication, message routing, and broadcast.
 */

import type { Server as HTTPServer, IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { AgentManager } from '../agents/agent-manager.js';
import type { AgentConfig } from '../agents/types.js';
import { checkCommand, type GuardrailConfig } from '../guardrails.js';
import { detectInjection, RateLimiter, sanitizeInput } from '../security.js';
import type { ClientInfo, ClientMessage, ServerMessage, WSHubConfig } from './types.js';

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
 * WebSocket Hub - manages all WebSocket connections and message routing
 */
export class WSHub {
  private wss: WebSocketServer;
  private config: WSHubConfig;
  private clients: Map<WebSocket, ClientInfo> = new Map();
  private rateLimiter: RateLimiter;
  private agentManager: AgentManager | null = null;
  private isReadOnly: boolean = true;
  private guardrailConfig: GuardrailConfig | null = null;

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

    // Authenticate
    if (providedToken !== this.config.token) {
      console.log(`[WSHub] Unauthorized connection from ${ip}`);
      ws.close(4001, 'Unauthorized');
      return;
    }

    const clientInfo: ClientInfo = {
      ip,
      connectedAt: Date.now(),
      authenticated: true,
    };

    this.clients.set(ws, clientInfo);
    console.log(`[WSHub] Client connected from ${ip} (${this.clients.size} total)`);

    // Send initial session info
    this.sendToClient(ws, {
      type: 'session_info',
      sessionId: this.config.sessionId,
      isReadOnly: this.isReadOnly,
      agents: this.agentManager?.getAllAgentInfos() || [],
      timestamp: Date.now(),
    });

    // Handle messages
    ws.on('message', (data) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
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
      this.clients.delete(ws);
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
        this.handleInput(ws, message.agentId, message.data);
        break;

      case 'resize':
        if (this.agentManager) {
          this.agentManager.resizeAgent(message.agentId, message.cols, message.rows);
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

      default:
        console.warn('[WSHub] Unknown message type:', (message as any).type);
    }
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
    for (const [client] of this.clients) {
      client.close(1000, 'Server shutting down');
    }
    this.clients.clear();
    this.wss.close();
    this.rateLimiter.cleanup();
  }
}
