/**
 * Session Manager - Session lifecycle and state machine
 * MConnect v0.2.0
 *
 * Handles session create, attach, detach, terminate with state transitions
 */

import { randomUUID } from 'node:crypto';
import { SessionStore } from './SessionStore.js';
import { ScrollbackBuffer } from './ScrollbackBuffer.js';
import type {
  Session,
  SessionState,
  AgentConfig,
  Client,
  ClientType,
  Priority,
  DEFAULT_SESSION_CONFIG,
} from './types.js';

export interface SessionManagerConfig {
  dataDir: string;
  scrollbackLines?: number;
  cleanupAfterHours?: number;
}

export interface ActiveSession {
  session: Session;
  scrollback: ScrollbackBuffer;
  clients: Map<string, Client>;
}

export class SessionManager {
  private store: SessionStore;
  private config: SessionManagerConfig;
  private activeSessions: Map<string, ActiveSession> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: SessionManagerConfig) {
    this.config = config;
    this.store = new SessionStore({ dataDir: config.dataDir });
  }

  /**
   * Initialize the session manager and restore active sessions
   */
  async initialize(): Promise<void> {
    // Restore running sessions from database
    const runningSessions = this.store.getSessionsByState('running');

    for (const session of runningSessions) {
      const scrollback = new ScrollbackBuffer(session.id, this.store, {
        maxTotalLines: this.config.scrollbackLines ?? 10000,
      });
      scrollback.restore();

      this.activeSessions.set(session.id, {
        session,
        scrollback,
        clients: new Map(),
      });
    }

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Create a new session
   */
  createSession(
    agentConfig: AgentConfig,
    workingDirectory: string
  ): Session {
    const id = randomUUID();

    const session = this.store.createSession({
      id,
      state: 'running',
      agentConfig,
      workingDirectory,
    });

    const scrollback = new ScrollbackBuffer(session.id, this.store, {
      maxTotalLines: this.config.scrollbackLines ?? 10000,
    });

    this.activeSessions.set(id, {
      session,
      scrollback,
      clients: new Map(),
    });

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(id: string): Session | null {
    const active = this.activeSessions.get(id);
    if (active) {
      return active.session;
    }
    return this.store.getSession(id);
  }

  /**
   * Get all sessions (optionally including completed)
   */
  getAllSessions(includeCompleted = false): Session[] {
    return this.store.getAllSessions(includeCompleted);
  }

  /**
   * Get active session with scrollback
   */
  getActiveSession(id: string): ActiveSession | undefined {
    return this.activeSessions.get(id);
  }

  /**
   * Attach a client to a session
   */
  attachClient(
    sessionId: string,
    clientId: string,
    clientType: ClientType,
    userAgent?: string
  ): Client | null {
    const active = this.activeSessions.get(sessionId);
    if (!active) {
      return null;
    }

    // Determine default priority based on client type
    const priority: Priority = clientType === 'pc' ? 'high' : 'normal';

    const client = this.store.addClient({
      id: clientId,
      sessionId,
      clientType,
      priority,
      userAgent,
    });

    active.clients.set(clientId, client);

    // Update session activity
    this.updateActivity(sessionId);

    return client;
  }

  /**
   * Detach a client from their session
   */
  detachClient(clientId: string): boolean {
    // Find the session this client is attached to
    for (const [sessionId, active] of this.activeSessions) {
      if (active.clients.has(clientId)) {
        active.clients.delete(clientId);
        this.store.removeClient(clientId);
        return true;
      }
    }
    return false;
  }

  /**
   * Get clients attached to a session
   */
  getSessionClients(sessionId: string): Client[] {
    const active = this.activeSessions.get(sessionId);
    if (!active) {
      return [];
    }
    return Array.from(active.clients.values());
  }

  /**
   * Append output to session scrollback
   */
  appendOutput(sessionId: string, data: string): void {
    const active = this.activeSessions.get(sessionId);
    if (active) {
      active.scrollback.append(data);
      this.updateActivity(sessionId);
    }
  }

  /**
   * Get scrollback for a session
   */
  getScrollback(sessionId: string, fromLine: number, count: number): string[] {
    const active = this.activeSessions.get(sessionId);
    if (!active) {
      // Try to get from database for completed sessions
      const lines = this.store.getScrollback(sessionId, fromLine, count);
      return lines.map((l) => l.content);
    }
    return active.scrollback.getRange(fromLine, count).map((l) => l.content);
  }

  /**
   * Get most recent scrollback lines
   */
  getRecentScrollback(sessionId: string, count: number): string[] {
    const active = this.activeSessions.get(sessionId);
    if (!active) {
      const lines = this.store.getLatestScrollback(sessionId, count);
      return lines.map((l) => l.content);
    }
    return active.scrollback.getRecent(count);
  }

  /**
   * Get total scrollback line count
   */
  getScrollbackLineCount(sessionId: string): number {
    const active = this.activeSessions.get(sessionId);
    if (active) {
      return active.scrollback.getTotalLines();
    }
    return this.store.getScrollbackLineCount(sessionId);
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(sessionId: string): void {
    const active = this.activeSessions.get(sessionId);
    if (active) {
      active.session.lastActivity = new Date();
      this.store.updateSessionActivity(sessionId);
    }
  }

  /**
   * Transition session state
   */
  transitionState(sessionId: string, newState: SessionState): boolean {
    const active = this.activeSessions.get(sessionId);

    if (!this.store.updateSessionState(sessionId, newState)) {
      return false;
    }

    if (active) {
      active.session.state = newState;

      // If completing, flush scrollback and remove from active
      if (newState === 'completed') {
        active.scrollback.flush();
        // Don't remove from activeSessions yet - keep for a grace period
      }
    }

    return true;
  }

  /**
   * Terminate a session (mark as completed)
   */
  terminateSession(sessionId: string): boolean {
    const active = this.activeSessions.get(sessionId);
    if (!active) {
      return false;
    }

    // Flush scrollback
    active.scrollback.flush();

    // Update state
    this.store.updateSessionState(sessionId, 'completed');
    active.session.state = 'completed';

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    return true;
  }

  /**
   * Delete a session permanently
   */
  deleteSession(sessionId: string): boolean {
    this.activeSessions.delete(sessionId);
    return this.store.deleteSession(sessionId);
  }

  /**
   * Clean up old completed sessions
   */
  cleanupCompletedSessions(): number {
    const cleanupAfterMs = (this.config.cleanupAfterHours ?? 24) * 60 * 60 * 1000;
    return this.store.deleteCompletedSessions(cleanupAfterMs);
  }

  /**
   * Start the cleanup timer
   */
  private startCleanupTimer(): void {
    // Run cleanup every hour
    this.cleanupTimer = setInterval(() => {
      const deleted = this.cleanupCompletedSessions();
      if (deleted > 0) {
        console.log(`Cleaned up ${deleted} completed sessions`);
      }
    }, 60 * 60 * 1000);
  }

  /**
   * Stop the cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Shutdown the session manager
   */
  async shutdown(): Promise<void> {
    this.stopCleanupTimer();

    // Flush all scrollback buffers
    for (const active of this.activeSessions.values()) {
      active.scrollback.flush();
    }

    // Close database connection
    this.store.close();
  }

  /**
   * Get session statistics
   */
  getStats(): { running: number; completed: number; totalClients: number } {
    let totalClients = 0;
    for (const active of this.activeSessions.values()) {
      totalClients += active.clients.size;
    }

    const allSessions = this.store.getAllSessions(true);
    const running = allSessions.filter((s) => s.state === 'running').length;
    const completed = allSessions.filter((s) => s.state === 'completed').length;

    return { running, completed, totalClients };
  }

  /**
   * Log input event (for audit logging)
   */
  logInput(
    sessionId: string,
    clientId: string,
    input: string,
    accepted: boolean,
    rejectReason?: import('./types.js').RejectReason
  ): number {
    return this.store.logInput(sessionId, clientId, input, accepted, rejectReason);
  }

  /**
   * Get input log for a session (for debugging/audit)
   */
  getInputLog(sessionId: string, limit = 100) {
    return this.store.getInputLog(sessionId, limit);
  }
}
