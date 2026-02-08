/**
 * Opik tracer compatibility adapter.
 *
 * This module preserves the legacy `getOpikTracer()` API while routing all
 * tracing to the canonical observability implementation in `observability/opik.ts`.
 * That ensures there is only one underlying Opik client/session trace.
 */

import type { AgentType } from '../agents/types.js';
import { getObservability } from '../observability/index.js';
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

export * from './types.js';

type ClientType = 'mobile' | 'pc';

function normalizeAgentType(agentType: string): AgentType {
  if (agentType === 'claude' || agentType === 'gemini' || agentType === 'codex' || agentType === 'aider' || agentType === 'shell' || agentType === 'custom') {
    return agentType;
  }
  return 'custom';
}

function sessionClientKey(sessionId: string, clientId: string): string {
  return `${sessionId}:${clientId}`;
}

export class OpikTracer {
  private readonly observability = getObservability();
  private readonly activeSessions: Set<string> = new Set();
  private readonly clientTypes: Map<string, ClientType> = new Map();
  private lastEndPromise: Promise<void> | null = null;
  private enabled = false;

  private config: Partial<OpikConfig>;

  constructor(config: Partial<OpikConfig> = {}) {
    this.config = config;
  }

  async initialize(): Promise<boolean> {
    const config = {
      apiKey: this.config.apiKey || process.env.OPIK_API_KEY,
      apiUrl: this.config.apiUrl || process.env.OPIK_URL_OVERRIDE,
      projectName: this.config.projectName || process.env.OPIK_PROJECT_NAME || 'lecoder-mconnect',
      workspaceName:
        this.config.workspaceName || process.env.OPIK_WORKSPACE || process.env.OPIK_WORKSPACE_NAME,
    };

    this.enabled = await this.observability.initialize(config);
    return this.enabled;
  }

  isEnabled(): boolean {
    return this.enabled && this.observability.isEnabled();
  }

  /**
   * Session root traces are started in session.ts via the canonical observability API.
   * This method only tracks active-session bookkeeping for compatibility.
   */
  startSession(sessionId: string, _attributes: Omit<SessionSpanAttributes, 'sessionId'>): void {
    if (!this.isEnabled()) return;
    this.activeSessions.add(sessionId);
  }

  endSession(sessionId: string): void {
    if (!this.isEnabled()) return;
    this.activeSessions.delete(sessionId);

    this.lastEndPromise = this.observability
      .endSessionTrace('user_exit')
      .catch(() => {})
      .finally(() => {
        this.lastEndPromise = null;
      });
  }

  agentSpawn(
    sessionId: string,
    agentId: string,
    attributes: Omit<AgentSpanAttributes, 'sessionId' | 'agentId'>
  ): void {
    if (!this.isEnabled() || !this.activeSessions.has(sessionId)) return;

    this.observability.traceAgentSpawn(agentId, {
      type: normalizeAgentType(attributes.agentType),
      name: attributes.agentName,
      command: attributes.agentType,
      cwd: attributes.workDir,
      autoRun: false,
      container: attributes.isContainerized
        ? {
            enabled: true,
            image: attributes.containerId || 'unknown',
          }
        : undefined,
    });
  }

  agentExit(sessionId: string, agentId: string, data: AgentExitData): void {
    if (!this.isEnabled() || !this.activeSessions.has(sessionId)) return;
    this.observability.traceAgentStatusChange(agentId, 'exited', data.exitCode);
  }

  commandExecute(sessionId: string, attributes: Omit<CommandSpanAttributes, 'sessionId'>): void {
    if (!this.isEnabled() || !this.activeSessions.has(sessionId)) return;

    this.observability.traceCommand(attributes.agentId, attributes.command, {
      blocked: attributes.blocked,
      requiresApproval: attributes.requiresApproval,
      reason: attributes.blockReason,
    });
  }

  approvalRequest(sessionId: string, attributes: Omit<ApprovalSpanAttributes, 'sessionId'>): void {
    if (!this.isEnabled() || !this.activeSessions.has(sessionId)) return;
    this.observability.traceApprovalRequest(
      attributes.agentId,
      attributes.command,
      attributes.reason,
      attributes.requestTime
    );
  }

  approvalResponse(sessionId: string, command: string, data: ApprovalResponseData): void {
    if (!this.isEnabled() || !this.activeSessions.has(sessionId)) return;
    this.observability.traceApprovalResponse(
      command,
      data.approved,
      data.responder || 'pc',
      data.responseTime
    );
  }

  clientConnected(
    sessionId: string,
    attributes: Omit<ClientConnectionAttributes, 'sessionId'>
  ): void {
    if (!this.isEnabled() || !this.activeSessions.has(sessionId)) return;

    this.clientTypes.set(sessionClientKey(sessionId, attributes.clientId), attributes.clientType);
    this.observability.traceClientConnection(attributes.clientType, 'connect');
  }

  clientDisconnected(sessionId: string, clientId: string, _duration: number): void {
    if (!this.isEnabled() || !this.activeSessions.has(sessionId)) return;

    const key = sessionClientKey(sessionId, clientId);
    const clientType = this.clientTypes.get(key) || 'pc';
    this.clientTypes.delete(key);
    this.observability.traceClientConnection(clientType, 'disconnect');
  }

  async flush(): Promise<void> {
    if (!this.isEnabled()) return;
    if (this.lastEndPromise) {
      await this.lastEndPromise;
    }
    await this.observability.flush();
  }

  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  hasActiveSession(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }
}

let globalTracer: OpikTracer | null = null;

export function getOpikTracer(config?: Partial<OpikConfig>): OpikTracer {
  if (!globalTracer) {
    globalTracer = new OpikTracer(config);
  }
  return globalTracer;
}

export async function initializeOpikTracer(config?: Partial<OpikConfig>): Promise<boolean> {
  const tracer = getOpikTracer(config);
  return tracer.initialize();
}

export function resetOpikTracer(): void {
  if (globalTracer) {
    globalTracer.flush().catch(() => {});
  }
  globalTracer = null;
}
