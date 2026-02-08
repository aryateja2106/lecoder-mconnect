/**
 * Opik Observability Integration for MConnect
 *
 * Provides tracing and monitoring for:
 * - Session lifecycle (start, end, duration)
 * - Agent spawning and management
 * - Terminal I/O and command execution
 * - Guardrails checks and blocks
 * - Client connections (mobile vs PC)
 *
 * @see https://www.comet.com/docs/opik/
 */

import { createRequire } from 'node:module';
import type { AgentConfig, AgentStatus } from '../agents/types.js';
import type { CommandCheck, GuardrailConfig } from '../guardrails.js';

// Use 'any' for Opik types since the SDK is optional and types may vary
// The actual types will be resolved at runtime when opik is available
type OpikClient = any;
type OpikTrace = any;
type OpikSpan = any;

// Create a require function for loading CommonJS modules (like opik)
const require = createRequire(import.meta.url);

/**
 * MConnect Observability Manager
 *
 * Wraps Opik SDK for MConnect-specific tracing
 */
export class MConnectObservability {
  private client: OpikClient | null = null;
  private enabled = false;
  private sessionTrace: OpikTrace | null = null;
  private agentSpans: Map<string, OpikSpan> = new Map();
  private approvalSpans: Map<string, OpikSpan> = new Map();
  private metrics: MConnectMetrics = {
    sessionId: '',
    startTime: 0,
    agentsSpawned: 0,
    commandsExecuted: 0,
    commandsBlocked: 0,
    commandsApproved: 0,
    mobileConnections: 0,
    pcConnections: 0,
    totalInputBytes: 0,
    totalOutputBytes: 0,
    containersCreated: 0,
    containerErrors: 0,
    authFailures: 0,
    inputsRejected: 0,
    exclusiveGrants: 0,
    rateLimitEvents: 0,
    securityEvents: 0,
    ptySpawns: 0,
    ptyExits: 0,
  };

  /**
   * Initialize Opik client
   */
  async initialize(config: OpikConfig): Promise<boolean> {
    if (!config.apiKey) {
      console.log('[Opik] No API key provided, observability disabled');
      return false;
    }

    try {
      // Use require() for CommonJS compatibility with the Opik SDK
      // The SDK has internal CommonJS dependencies that don't work with ESM import
      const opikModule = require('opik');
      const Opik = opikModule.Opik || opikModule.default?.Opik || opikModule;

      this.client = new Opik({
        apiKey: config.apiKey,
        apiUrl: config.apiUrl || 'https://www.comet.com/opik/api',
        projectName: config.projectName || 'lecoder-mconnect',
        workspaceName: config.workspaceName,
      });

      this.enabled = true;
      console.log('[Opik] Observability initialized successfully');
      return true;
    } catch (error) {
      // Silently fail if opik is not installed or has compatibility issues
      // This is expected in development or when opik is not needed
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('Cannot find module')) {
        console.log('[Opik] SDK not installed, observability disabled');
        console.log('[Opik] Install with: npm install opik');
      } else {
        console.log('[Opik] Initialization skipped:', errorMsg);
      }
      return false;
    }
  }

  /**
   * Check if observability is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  /**
   * Start tracing a new session
   */
  startSessionTrace(sessionId: string, config: SessionTraceConfig): void {
    if (!this.isEnabled() || !this.client) return;

    this.metrics = {
      sessionId,
      startTime: Date.now(),
      agentsSpawned: 0,
      commandsExecuted: 0,
      commandsBlocked: 0,
      commandsApproved: 0,
      mobileConnections: 0,
      pcConnections: 0,
      totalInputBytes: 0,
      totalOutputBytes: 0,
      containersCreated: 0,
      containerErrors: 0,
      authFailures: 0,
      inputsRejected: 0,
      exclusiveGrants: 0,
      rateLimitEvents: 0,
      securityEvents: 0,
      ptySpawns: 0,
      ptyExits: 0,
    };

    this.sessionTrace = this.client.trace({
      name: 'mconnect_session',
      input: {
        sessionId,
        workDir: config.workDir,
        guardrailsLevel: config.guardrailsLevel,
        agentCount: config.agents.length,
        agentTypes: config.agents.map((a) => a.type || 'shell'),
        enableTmux: config.enableTmux,
        hasContainer: config.agents.some((a) => a.container?.enabled),
      },
      metadata: {
        version: config.version || '0.1.7',
        platform: process.platform,
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      },
    });

    this.approvalSpans.clear();
    this.agentSpans.clear();

    console.log(`[Opik] Session trace started: ${sessionId}`);
  }

  /**
   * End the current session trace
   */
  async endSessionTrace(reason: 'user_exit' | 'error' | 'timeout' = 'user_exit'): Promise<void> {
    if (!this.sessionTrace) return;

    const duration = Date.now() - this.metrics.startTime;

    for (const [command, span] of this.approvalSpans) {
      try {
        span.end({
          output: {
            approved: false,
            reason: 'session_ended',
            command: command.substring(0, 200),
          },
          metadata: {
            endTime: new Date().toISOString(),
          },
        });
      } catch {
        // Ignore missing/ended span errors
      }
    }
    this.approvalSpans.clear();

    for (const [_agentId, span] of this.agentSpans) {
      try {
        span.end({
          output: {
            finalStatus: 'session_ended',
          },
          metadata: {
            endTime: new Date().toISOString(),
          },
        });
      } catch {
        // Ignore missing/ended span errors
      }
    }
    this.agentSpans.clear();

    this.sessionTrace.end({
      output: {
        reason,
        duration,
        metrics: { ...this.metrics },
      },
      metadata: {
        endTime: new Date().toISOString(),
        totalAgentsSpawned: this.metrics.agentsSpawned,
        totalCommands: this.metrics.commandsExecuted,
        blockedCommands: this.metrics.commandsBlocked,
        approvedCommands: this.metrics.commandsApproved,
      },
    });

    this.sessionTrace = null;
    console.log(`[Opik] Session trace ended (${reason}, ${duration}ms)`);
  }

  /**
   * Trace agent spawn event
   */
  traceAgentSpawn(agentId: string, config: AgentConfig): void {
    if (!this.sessionTrace) return;

    this.metrics.agentsSpawned++;

    const span = this.sessionTrace.span({
      name: 'agent_spawn',
      type: 'tool',
      input: {
        agentId,
        agentName: config.name,
        agentType: config.type || 'shell',
        command: config.command,
        containerEnabled: config.container?.enabled || false,
        containerImage: config.container?.image,
        autoRun: config.autoRun,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        workDir: config.cwd,
      },
    });

    this.agentSpans.set(agentId, span);
  }

  /**
   * Trace agent status change
   */
  traceAgentStatusChange(agentId: string, status: AgentStatus, exitCode?: number): void {
    const span = this.agentSpans.get(agentId);
    if (!span) return;

    if (status === 'exited' || status === 'error') {
      span.end({
        output: {
          finalStatus: status,
          exitCode,
        },
        metadata: {
          endTime: new Date().toISOString(),
        },
      });
      this.agentSpans.delete(agentId);
    }
  }

  /**
   * Trace command execution
   */
  traceCommand(agentId: string, command: string, check: CommandCheck): void {
    if (!this.sessionTrace) return;

    this.metrics.commandsExecuted++;

    if (check.blocked) {
      this.metrics.commandsBlocked++;
    } else if (check.requiresApproval) {
      this.metrics.commandsApproved++;
    }

    const agentSpan = this.agentSpans.get(agentId);
    const parentSpan = agentSpan || this.sessionTrace;

    const span = parentSpan.span({
      name: 'command_execution',
      type: 'tool',
      input: {
        agentId,
        command: command.substring(0, 500), // Truncate long commands
        commandLength: command.length,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        blocked: check.blocked,
        requiresApproval: check.requiresApproval,
        reason: check.reason,
      },
    });

    // End immediately for command traces
    span.end({
      output: {
        allowed: !check.blocked,
        approved: check.requiresApproval,
      },
    });
  }

  /**
   * Trace approval request lifecycle.
   */
  traceApprovalRequest(agentId: string, command: string, reason: string, requestTime: number): void {
    if (!this.sessionTrace) return;

    const agentSpan = this.agentSpans.get(agentId);
    const parentSpan = agentSpan || this.sessionTrace;

    const span = parentSpan.span({
      name: 'approval_request',
      type: 'tool',
      input: {
        agentId,
        command: command.substring(0, 500),
        reason,
      },
      metadata: {
        requestTime,
        timestamp: new Date().toISOString(),
      },
    });

    this.approvalSpans.set(command, span);
  }

  /**
   * Trace approval response and close pending approval span.
   */
  traceApprovalResponse(
    command: string,
    approved: boolean,
    responder: 'mobile' | 'pc' = 'pc',
    responseTime: number = 0
  ): void {
    if (!this.sessionTrace) return;

    const pendingSpan = this.approvalSpans.get(command);
    if (pendingSpan) {
      pendingSpan.end({
        output: {
          approved,
          responder,
          responseTime,
        },
        metadata: {
          resolvedAt: new Date().toISOString(),
        },
      });
      this.approvalSpans.delete(command);
      return;
    }

    const span = this.sessionTrace.span({
      name: 'approval_response',
      type: 'tool',
      input: {
        command: command.substring(0, 500),
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

    span.end({
      output: {
        approved,
        responder,
        responseTime,
      },
    });
  }

  /**
   * Trace guardrails check
   */
  traceGuardrailCheck(command: string, config: GuardrailConfig, result: CommandCheck): void {
    if (!this.sessionTrace) return;

    const span = this.sessionTrace.span({
      name: 'guardrail_check',
      type: 'tool',
      input: {
        command: command.substring(0, 200),
        guardrailLevel: config.level,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

    span.end({
      output: {
        blocked: result.blocked,
        requiresApproval: result.requiresApproval,
        reason: result.reason,
      },
      metadata: {
        blockedPatternsCount: config.blockedPatterns.length,
        approvalPatternsCount: config.approvalPatterns.length,
      },
    });
  }

  /**
   * Trace client connection
   */
  traceClientConnection(clientType: 'mobile' | 'pc', action: 'connect' | 'disconnect'): void {
    if (!this.sessionTrace) return;

    if (action === 'connect') {
      if (clientType === 'mobile') {
        this.metrics.mobileConnections++;
      } else {
        this.metrics.pcConnections++;
      }
    }

    const span = this.sessionTrace.span({
      name: 'client_connection',
      type: 'general',
      input: {
        clientType,
        action,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        totalMobileConnections: this.metrics.mobileConnections,
        totalPcConnections: this.metrics.pcConnections,
      },
    });

    span.end();
  }

  /**
   * Trace terminal I/O
   */
  traceTerminalIO(agentId: string, direction: 'input' | 'output', bytes: number): void {
    if (direction === 'input') {
      this.metrics.totalInputBytes += bytes;
    } else {
      this.metrics.totalOutputBytes += bytes;
    }

    // Don't create spans for every I/O event to avoid overwhelming Opik
    // Instead, we'll include totals in the session end trace
  }

  /**
   * Trace tunnel creation
   */
  traceTunnelCreation(success: boolean, url?: string, error?: string): void {
    if (!this.sessionTrace) return;

    const span = this.sessionTrace.span({
      name: 'tunnel_creation',
      type: 'tool',
      input: {
        provider: 'cloudflare',
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

    span.end({
      output: {
        success,
        url: url ? url.substring(0, 100) : undefined, // Truncate URL
        error,
      },
    });
  }

  // ============================================
  // WebSocket Hub Tracing Methods
  // ============================================

  /**
   * Trace authentication failure
   */
  traceAuthFailure(clientIp: string, reason: string): void {
    if (!this.sessionTrace) return;

    this.metrics.authFailures++;

    const span = this.sessionTrace.span({
      name: 'auth_failure',
      type: 'general',
      input: {
        clientIp: clientIp.substring(0, 20), // Truncate for privacy
        reason,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        totalAuthFailures: this.metrics.authFailures,
      },
    });

    span.end({
      output: { success: false, reason },
    });
  }

  /**
   * Trace rate limiting event
   */
  traceRateLimited(clientId: string, limit: number): void {
    if (!this.sessionTrace) return;

    this.metrics.rateLimitEvents++;

    const span = this.sessionTrace.span({
      name: 'rate_limited',
      type: 'general',
      input: {
        clientId,
        limit,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        totalRateLimitEvents: this.metrics.rateLimitEvents,
      },
    });

    span.end();
  }

  // ============================================
  // Input Arbiter Tracing Methods
  // ============================================

  /**
   * Trace input decision (accepted or rejected)
   */
  traceInputDecision(
    decision: 'accepted' | 'rejected',
    clientId: string,
    reason?: string
  ): void {
    if (!this.sessionTrace) return;

    if (decision === 'rejected') {
      this.metrics.inputsRejected++;
    }

    const span = this.sessionTrace.span({
      name: 'input_decision',
      type: 'general',
      input: {
        clientId,
        decision,
        reason,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        totalRejected: this.metrics.inputsRejected,
      },
    });

    span.end({
      output: { accepted: decision === 'accepted', reason },
    });
  }

  /**
   * Trace control change events
   */
  traceControlChange(
    event: 'exclusive_granted' | 'exclusive_released' | 'timeout',
    clientId: string
  ): void {
    if (!this.sessionTrace) return;

    if (event === 'exclusive_granted') {
      this.metrics.exclusiveGrants++;
    }

    const span = this.sessionTrace.span({
      name: 'control_change',
      type: 'general',
      input: {
        event,
        clientId,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        totalExclusiveGrants: this.metrics.exclusiveGrants,
      },
    });

    span.end();
  }

  /**
   * Trace arbiter state changes
   */
  traceArbiterState(
    newState: 'pc_active' | 'pc_idle' | 'pc_disconnected' | 'mobile_exclusive',
    oldState?: string
  ): void {
    if (!this.sessionTrace) return;

    const span = this.sessionTrace.span({
      name: 'arbiter_state_change',
      type: 'general',
      input: {
        newState,
        oldState,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

    span.end();
  }

  // ============================================
  // Container Tracing Methods
  // ============================================

  /**
   * Trace container lifecycle events
   */
  traceContainerLifecycle(
    event: 'create' | 'start' | 'stop' | 'error',
    containerId: string,
    metadata: {
      image?: string;
      workDir?: string;
      error?: string;
    } = {}
  ): void {
    if (!this.sessionTrace) return;

    if (event === 'create') {
      this.metrics.containersCreated++;
    } else if (event === 'error') {
      this.metrics.containerErrors++;
    }

    const span = this.sessionTrace.span({
      name: 'container_lifecycle',
      type: 'tool',
      input: {
        event,
        containerId,
        image: metadata.image,
        workDir: metadata.workDir,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        totalContainers: this.metrics.containersCreated,
        totalErrors: this.metrics.containerErrors,
      },
    });

    span.end({
      output: {
        success: event !== 'error',
        error: metadata.error,
      },
    });
  }

  /**
   * Trace container exec operations
   */
  traceContainerExec(containerId: string, command: string): void {
    if (!this.sessionTrace) return;

    const span = this.sessionTrace.span({
      name: 'container_exec',
      type: 'tool',
      input: {
        containerId,
        command: command.substring(0, 200),
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

    span.end();
  }

  /**
   * Trace container image build
   */
  traceContainerBuild(
    image: string,
    success: boolean,
    durationMs: number,
    error?: string
  ): void {
    if (!this.sessionTrace) return;

    const span = this.sessionTrace.span({
      name: 'container_build',
      type: 'tool',
      input: {
        image,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        durationMs,
      },
    });

    span.end({
      output: {
        success,
        durationMs,
        error,
      },
    });
  }

  // ============================================
  // PTY Tracing Methods
  // ============================================

  /**
   * Trace PTY spawn event
   */
  tracePtySpawn(ptyId: string, command: string, pid: number): void {
    if (!this.sessionTrace) return;

    this.metrics.ptySpawns++;

    const span = this.sessionTrace.span({
      name: 'pty_spawn',
      type: 'tool',
      input: {
        ptyId,
        command,
        pid,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        totalSpawns: this.metrics.ptySpawns,
      },
    });

    span.end();
  }

  /**
   * Trace PTY exit event
   */
  tracePtyExit(ptyId: string, exitCode: number, signal?: number): void {
    if (!this.sessionTrace) return;

    this.metrics.ptyExits++;

    const span = this.sessionTrace.span({
      name: 'pty_exit',
      type: 'tool',
      input: {
        ptyId,
        exitCode,
        signal,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        totalExits: this.metrics.ptyExits,
      },
    });

    span.end();
  }

  // ============================================
  // Security Tracing Methods
  // ============================================

  /**
   * Trace token validation
   */
  traceTokenValidation(
    result: 'valid' | 'invalid' | 'expired',
    tokenHash: string
  ): void {
    if (!this.sessionTrace) return;

    const span = this.sessionTrace.span({
      name: 'token_validation',
      type: 'general',
      input: {
        result,
        tokenHash: tokenHash.substring(0, 8), // Only first 8 chars for security
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

    span.end({
      output: { valid: result === 'valid' },
    });
  }

  /**
   * Trace security events (injection attempts, etc.)
   */
  traceSecurityEvent(
    eventType: 'injection' | 'rate_limit' | 'invalid_input',
    details: { pattern?: string; input?: string; clientId?: string }
  ): void {
    if (!this.sessionTrace) return;

    this.metrics.securityEvents++;

    const span = this.sessionTrace.span({
      name: 'security_event',
      type: 'general',
      input: {
        eventType,
        pattern: details.pattern,
        // Truncate input for safety
        inputPreview: details.input?.substring(0, 50),
        clientId: details.clientId,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        totalSecurityEvents: this.metrics.securityEvents,
      },
    });

    span.end();
  }

  /**
   * Trace pairing code validation
   */
  tracePairingCode(result: 'validated' | 'expired' | 'invalid'): void {
    if (!this.sessionTrace) return;

    const span = this.sessionTrace.span({
      name: 'pairing_code_validation',
      type: 'general',
      input: {
        result,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

    span.end({
      output: { valid: result === 'validated' },
    });
  }

  // ============================================
  // Component Initialization Tracing
  // ============================================

  /**
   * Trace component initialization
   */
  traceComponentInit(
    component: 'pty' | 'websocket' | 'tunnel' | 'tmux' | 'http',
    success: boolean,
    error?: string
  ): void {
    if (!this.sessionTrace) return;

    const span = this.sessionTrace.span({
      name: 'component_init',
      type: 'tool',
      input: {
        component,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

    span.end({
      output: {
        success,
        error,
      },
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): MConnectMetrics {
    return { ...this.metrics };
  }

  /**
   * Flush all pending traces
   */
  async flush(): Promise<void> {
    if (this.client) {
      try {
        await this.client.flush();
      } catch (error) {
        console.log('[Opik] Flush error:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }
}

/**
 * Opik configuration
 */
export interface OpikConfig {
  apiKey?: string;
  apiUrl?: string;
  projectName?: string;
  workspaceName?: string;
}

/**
 * Session trace configuration
 */
export interface SessionTraceConfig {
  workDir: string;
  guardrailsLevel: string;
  agents: AgentConfig[];
  enableTmux: boolean;
  version?: string;
}

/**
 * MConnect metrics - Enhanced for hackathon
 */
export interface MConnectMetrics {
  sessionId: string;
  startTime: number;
  agentsSpawned: number;
  commandsExecuted: number;
  commandsBlocked: number;
  commandsApproved: number;
  mobileConnections: number;
  pcConnections: number;
  totalInputBytes: number;
  totalOutputBytes: number;
  // Enhanced metrics
  containersCreated: number;
  containerErrors: number;
  authFailures: number;
  inputsRejected: number;
  exclusiveGrants: number;
  rateLimitEvents: number;
  securityEvents: number;
  ptySpawns: number;
  ptyExits: number;
}

// Singleton instance
let observabilityInstance: MConnectObservability | null = null;

/**
 * Get the global observability instance
 */
export function getObservability(): MConnectObservability {
  if (!observabilityInstance) {
    observabilityInstance = new MConnectObservability();
  }
  return observabilityInstance;
}

/**
 * Initialize observability from environment variables
 */
export async function initObservabilityFromEnv(): Promise<boolean> {
  const obs = getObservability();
  return obs.initialize({
    apiKey: process.env.OPIK_API_KEY,
    apiUrl: process.env.OPIK_URL_OVERRIDE,
    projectName: process.env.OPIK_PROJECT_NAME || 'lecoder-mconnect',
    workspaceName: process.env.OPIK_WORKSPACE,
  });
}
