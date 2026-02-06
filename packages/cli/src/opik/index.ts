/**
 * Opik Tracer for MConnect
 *
 * Provides observability tracing for MConnect sessions, agents, commands,
 * and approval flows using the Opik SDK.
 *
 * Gracefully degrades to no-op when OPIK_API_KEY is not set.
 */

import type {
  AgentExitData,
  AgentSpanAttributes,
  ApprovalResponseData,
  ApprovalSpanAttributes,
  ClientConnectionAttributes,
  CommandSpanAttributes,
  OpikConfig,
  SessionSpanAttributes,
} from './types.js';

// Re-export types for convenience
export * from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamically imported SDK types
type OpikClient = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpikTrace = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpikSpan = any;

/**
 * Active trace/span tracking
 */
interface ActiveSession {
  trace: OpikTrace;
  agentSpans: Map<string, OpikSpan>;
  approvalSpans: Map<string, OpikSpan>;
  startTime: number;
}

/**
 * OpikTracer - Main tracing class for MConnect observability
 *
 * Usage:
 * ```typescript
 * const tracer = new OpikTracer({
 *   projectName: 'mconnect',
 *   environment: 'production'
 * });
 *
 * // Start session trace
 * tracer.startSession(sessionId, { guardrailsPreset: 'default', ... });
 *
 * // Track agent lifecycle
 * tracer.agentSpawn(sessionId, agentId, { agentType: 'claude-code', ... });
 * tracer.agentExit(sessionId, agentId, { exitCode: 0, duration: 5000 });
 *
 * // Track commands
 * tracer.commandExecute(sessionId, { agentId, command: 'git push', ... });
 *
 * // Track approvals
 * tracer.approvalRequest(sessionId, { agentId, command: 'git push', reason: '...' });
 * tracer.approvalResponse(sessionId, command, { approved: true, responseTime: 2000 });
 *
 * // End session
 * tracer.endSession(sessionId);
 * await tracer.flush();
 * ```
 */
export class OpikTracer {
  private client: OpikClient | null = null;
  private config: OpikConfig;
  private activeSessions: Map<string, ActiveSession> = new Map();
  private enabled: boolean = false;

  constructor(config: Partial<OpikConfig> = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.OPIK_API_KEY,
      apiUrl: config.apiUrl || process.env.OPIK_URL_OVERRIDE || 'https://www.comet.com/opik/api',
      projectName: config.projectName || process.env.OPIK_PROJECT_NAME || 'mconnect',
      workspaceName: config.workspaceName || process.env.OPIK_WORKSPACE_NAME,
      environment: config.environment || process.env.NODE_ENV || 'development',
    };
  }

  /**
   * Initialize the Opik client
   * Call this before using any tracing methods
   * Gracefully handles missing API key
   */
  async initialize(): Promise<boolean> {
    if (!this.config.apiKey) {
      console.log('[OpikTracer] No OPIK_API_KEY found - tracing disabled');
      this.enabled = false;
      return false;
    }

    try {
      // Dynamic import to avoid hard dependency
      const { Opik } = await import('opik');

      this.client = new Opik({
        apiKey: this.config.apiKey,
        apiUrl: this.config.apiUrl,
        projectName: this.config.projectName,
        workspaceName: this.config.workspaceName,
      });

      this.enabled = true;
      console.log(`[OpikTracer] Initialized - project: ${this.config.projectName}`);
      return true;
    } catch (error) {
      console.warn('[OpikTracer] Failed to initialize Opik SDK:', error);
      this.enabled = false;
      return false;
    }
  }

  /**
   * Check if tracing is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  // ============================================
  // Session Lifecycle
  // ============================================

  /**
   * Start a new session trace (root trace)
   */
  startSession(sessionId: string, attributes: Omit<SessionSpanAttributes, 'sessionId'>): void {
    if (!this.isEnabled() || !this.client) return;

    const trace = this.client.trace({
      name: `session:${sessionId}`,
      input: {
        type: 'session',
        sessionId,
        ...attributes,
        environment: this.config.environment,
      },
    });

    this.activeSessions.set(sessionId, {
      trace,
      agentSpans: new Map(),
      approvalSpans: new Map(),
      startTime: attributes.startTime,
    });

    console.log(`[OpikTracer] Session trace started: ${sessionId}`);
  }

  /**
   * End a session trace
   */
  endSession(sessionId: string): void {
    if (!this.isEnabled()) return;

    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // End any remaining agent spans
    for (const [agentId, span] of session.agentSpans) {
      span.end({ output: { status: 'session_ended' } });
      console.log(`[OpikTracer] Agent span ended (session cleanup): ${agentId}`);
    }

    // End any remaining approval spans
    for (const [command, span] of session.approvalSpans) {
      span.end({ output: { status: 'session_ended', approved: false } });
      console.log(`[OpikTracer] Approval span ended (session cleanup): ${command.slice(0, 20)}...`);
    }

    // End the session trace
    const duration = Date.now() - session.startTime;
    session.trace.end({
      output: {
        status: 'completed',
        duration,
        agentCount: session.agentSpans.size,
      },
    });

    this.activeSessions.delete(sessionId);
    console.log(`[OpikTracer] Session trace ended: ${sessionId} (${duration}ms)`);
  }

  // ============================================
  // Agent Lifecycle
  // ============================================

  /**
   * Track agent spawn
   */
  agentSpawn(
    sessionId: string,
    agentId: string,
    attributes: Omit<AgentSpanAttributes, 'sessionId' | 'agentId'>
  ): void {
    if (!this.isEnabled()) return;

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`[OpikTracer] Cannot spawn agent - session not found: ${sessionId}`);
      return;
    }

    const span = session.trace.span({
      name: `agent:${attributes.agentType}:${agentId}`,
      type: 'agent',
      input: {
        type: 'agent_spawn',
        sessionId,
        agentId,
        ...attributes,
      },
    });

    session.agentSpans.set(agentId, span);
    console.log(`[OpikTracer] Agent span started: ${agentId} (${attributes.agentType})`);
  }

  /**
   * Track agent exit
   */
  agentExit(sessionId: string, agentId: string, data: AgentExitData): void {
    if (!this.isEnabled()) return;

    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const span = session.agentSpans.get(agentId);
    if (!span) {
      console.warn(`[OpikTracer] Cannot exit agent - span not found: ${agentId}`);
      return;
    }

    span.end({
      output: {
        type: 'agent_exit',
        ...data,
      },
    });

    session.agentSpans.delete(agentId);
    console.log(`[OpikTracer] Agent span ended: ${agentId} (exit: ${data.exitCode})`);
  }

  // ============================================
  // Command Tracking
  // ============================================

  /**
   * Track command execution
   */
  commandExecute(sessionId: string, attributes: Omit<CommandSpanAttributes, 'sessionId'>): void {
    if (!this.isEnabled()) return;

    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const agentSpan = session.agentSpans.get(attributes.agentId);
    const parentSpan = agentSpan || session.trace;

    // Create a quick span for the command (auto-ends)
    const commandSpan = parentSpan.span({
      name: `command:${attributes.blocked ? 'blocked' : attributes.requiresApproval ? 'approval' : 'executed'}`,
      type: 'command',
      input: {
        type: 'command',
        sessionId,
        ...attributes,
        // Truncate command for privacy/size
        command: attributes.command.slice(0, 200),
      },
    });

    // End immediately for non-approval commands
    if (!attributes.requiresApproval) {
      commandSpan.end({
        output: {
          status: attributes.blocked ? 'blocked' : 'executed',
          blocked: attributes.blocked,
          blockReason: attributes.blockReason,
        },
      });
    }

    console.log(
      `[OpikTracer] Command tracked: ${attributes.command.slice(0, 30)}... (${attributes.blocked ? 'blocked' : attributes.requiresApproval ? 'pending' : 'executed'})`
    );
  }

  // ============================================
  // Approval Flow
  // ============================================

  /**
   * Track approval request
   */
  approvalRequest(sessionId: string, attributes: Omit<ApprovalSpanAttributes, 'sessionId'>): void {
    if (!this.isEnabled()) return;

    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const agentSpan = session.agentSpans.get(attributes.agentId);
    const parentSpan = agentSpan || session.trace;

    const span = parentSpan.span({
      name: `approval:${attributes.command.slice(0, 30)}`,
      type: 'approval',
      input: {
        type: 'approval_request',
        sessionId,
        ...attributes,
        command: attributes.command.slice(0, 200),
      },
    });

    // Key by command for lookup
    session.approvalSpans.set(attributes.command, span);
    console.log(`[OpikTracer] Approval request: ${attributes.command.slice(0, 30)}...`);
  }

  /**
   * Track approval response
   */
  approvalResponse(sessionId: string, command: string, data: ApprovalResponseData): void {
    if (!this.isEnabled()) return;

    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const span = session.approvalSpans.get(command);
    if (!span) {
      console.warn(
        `[OpikTracer] Cannot resolve approval - span not found: ${command.slice(0, 20)}...`
      );
      return;
    }

    span.end({
      output: {
        type: 'approval_response',
        ...data,
      },
    });

    session.approvalSpans.delete(command);
    console.log(
      `[OpikTracer] Approval ${data.approved ? 'approved' : 'denied'}: ${command.slice(0, 30)}... (${data.responseTime}ms)`
    );
  }

  // ============================================
  // Client Connection Tracking
  // ============================================

  /**
   * Track client connection
   */
  clientConnected(
    sessionId: string,
    attributes: Omit<ClientConnectionAttributes, 'sessionId'>
  ): void {
    if (!this.isEnabled()) return;

    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Create a quick span for client connection (auto-ends)
    const span = session.trace.span({
      name: `client:${attributes.clientType}:${attributes.clientId}`,
      type: 'client_connection',
      input: {
        type: 'client_connected',
        sessionId,
        ...attributes,
      },
    });

    span.end({
      output: { status: 'connected' },
    });

    console.log(`[OpikTracer] Client connected: ${attributes.clientType} (${attributes.clientId})`);
  }

  /**
   * Track client disconnection
   */
  clientDisconnected(sessionId: string, clientId: string, duration: number): void {
    if (!this.isEnabled()) return;

    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Create a quick span for client disconnection
    const span = session.trace.span({
      name: `client_disconnect:${clientId}`,
      type: 'client_connection',
      input: {
        type: 'client_disconnected',
        sessionId,
        clientId,
      },
    });

    span.end({
      output: {
        status: 'disconnected',
        duration,
      },
    });

    console.log(`[OpikTracer] Client disconnected: ${clientId} (${duration}ms)`);
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Flush all pending traces to Opik
   * Call this before application exit
   */
  async flush(): Promise<void> {
    if (!this.isEnabled() || !this.client) return;

    try {
      await this.client.flush();
      console.log('[OpikTracer] Traces flushed successfully');
    } catch (error) {
      console.warn('[OpikTracer] Failed to flush traces:', error);
    }
  }

  /**
   * Get the number of active sessions being traced
   */
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Check if a session is being traced
   */
  hasActiveSession(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }
}

// ============================================
// Singleton Instance
// ============================================

let globalTracer: OpikTracer | null = null;

/**
 * Get the global OpikTracer instance
 * Creates one if it doesn't exist
 */
export function getOpikTracer(config?: Partial<OpikConfig>): OpikTracer {
  if (!globalTracer) {
    globalTracer = new OpikTracer(config);
  }
  return globalTracer;
}

/**
 * Initialize the global tracer
 * Returns true if tracing is enabled
 */
export async function initializeOpikTracer(config?: Partial<OpikConfig>): Promise<boolean> {
  const tracer = getOpikTracer(config);
  return tracer.initialize();
}

/**
 * Reset the global tracer (for testing)
 */
export function resetOpikTracer(): void {
  if (globalTracer) {
    globalTracer.flush().catch(() => {});
  }
  globalTracer = null;
}
