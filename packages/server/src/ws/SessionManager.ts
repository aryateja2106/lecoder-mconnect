/**
 * SessionManager — tmux-style session persistence wiring.
 *
 * Bridges the WSHub scrollback hook to AgentManager + AgentWSBridge so that
 * when an iOS client reattaches via `session_attach`, the hub can replay
 * the buffered terminal output for every agent in the session.
 *
 * This is a thin wiring layer; the actual ring buffer lives in
 * SessionScrollback (driven by AgentManager.handleAgentOutput).
 *
 * Lifecycle:
 *   - On session start, call `registerSession(sessionId)`.
 *   - On session teardown, call `unregisterSession(sessionId)`.
 *
 * Agents may be added or removed at any time; `registerSession` reads the
 * current set lazily on every replay so mid-session attaches Just Work.
 */

import { type AgentManager, getAgentManager } from '../agents/AgentManager.js';
import { type AgentWSBridge, getAgentWSBridge } from '../agents/AgentWSBridge.js';
import { type WSHub, getWSHub, type ScrollbackEntry } from './WSHub.js';

export class SessionManager {
  private readonly agentManager: AgentManager;
  private readonly bridge: AgentWSBridge;
  private readonly wsHub: WSHub;
  /** Sessions currently registered for scrollback replay. */
  private readonly registered: Set<string> = new Set();

  constructor(opts: {
    agentManager?: AgentManager;
    bridge?: AgentWSBridge;
    wsHub?: WSHub;
  } = {}) {
    this.agentManager = opts.agentManager ?? getAgentManager();
    this.bridge = opts.bridge ?? getAgentWSBridge();
    this.wsHub = opts.wsHub ?? getWSHub();
  }

  /**
   * Register a session for tmux-style scrollback replay. Idempotent.
   */
  registerSession(sessionId: string): void {
    if (this.registered.has(sessionId)) return;
    this.registered.add(sessionId);

    this.wsHub.registerScrollbackProvider(sessionId, (sid, agentId) => {
      return this.collectScrollback(sid, agentId);
    });
  }

  /**
   * Stop replaying scrollback for this session.
   */
  unregisterSession(sessionId: string): void {
    if (!this.registered.has(sessionId)) return;
    this.registered.delete(sessionId);
    this.wsHub.unregisterScrollbackProvider(sessionId);
  }

  /**
   * Whether a session is registered.
   */
  isRegistered(sessionId: string): boolean {
    return this.registered.has(sessionId);
  }

  /**
   * Build the scrollback payload for a session at request time. Either all
   * agents in the session (if `agentId` is omitted) or a single agent.
   */
  private collectScrollback(sessionId: string, agentId?: string): ScrollbackEntry[] {
    const targets = agentId
      ? [agentId]
      : this.bridge.getSessionAgents(sessionId);

    const out: ScrollbackEntry[] = [];
    for (const id of targets) {
      const data = this.agentManager.getScrollback(id);
      if (!data) continue;
      out.push({
        agentId: id,
        data,
        bytes: this.agentManager.getScrollbackSize(id),
      });
    }
    return out;
  }

  /**
   * Drop all registrations.
   */
  cleanup(): void {
    for (const sessionId of this.registered) {
      this.wsHub.unregisterScrollbackProvider(sessionId);
    }
    this.registered.clear();
  }
}

// ============================================================================
// Singleton
// ============================================================================

let sessionManagerInstance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}

export function resetSessionManager(): void {
  if (sessionManagerInstance) {
    sessionManagerInstance.cleanup();
    sessionManagerInstance = null;
  }
}

export default SessionManager;
