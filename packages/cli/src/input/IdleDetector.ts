/**
 * Idle Detector - Per-client idle tracking
 * MConnect v0.2.0
 *
 * Tracks when clients become idle to enable automatic control handoff
 */

import { EventEmitter } from 'node:events';
import type { ClientType } from '../session/types.js';

export interface IdleState {
  clientId: string;
  clientType: ClientType;
  lastActivity: Date;
  isIdle: boolean;
}

export interface IdleDetectorConfig {
  /** Idle threshold in milliseconds (default: 30000ms / 30s) */
  idleThresholdMs: number;
  /** How often to check for idle clients (default: 5000ms / 5s) */
  checkIntervalMs: number;
}

const DEFAULT_CONFIG: IdleDetectorConfig = {
  idleThresholdMs: 30000,
  checkIntervalMs: 5000,
};

export interface IdleDetectorEvents {
  idle: (clientId: string, clientType: ClientType) => void;
  active: (clientId: string, clientType: ClientType) => void;
}

export class IdleDetector extends EventEmitter {
  private clients: Map<string, IdleState> = new Map();
  private config: IdleDetectorConfig;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<IdleDetectorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start idle detection
   */
  start(): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(() => {
      this.checkIdleClients();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop idle detection
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Register a client for idle tracking
   */
  register(clientId: string, clientType: ClientType): void {
    this.clients.set(clientId, {
      clientId,
      clientType,
      lastActivity: new Date(),
      isIdle: false,
    });
  }

  /**
   * Unregister a client
   */
  unregister(clientId: string): void {
    this.clients.delete(clientId);
  }

  /**
   * Record activity from a client (resets idle timer)
   */
  recordActivity(clientId: string): void {
    const state = this.clients.get(clientId);
    if (!state) {
      return;
    }

    const wasIdle = state.isIdle;
    state.lastActivity = new Date();
    state.isIdle = false;

    // Emit active event if client was previously idle
    if (wasIdle) {
      this.emit('active', clientId, state.clientType);
    }
  }

  /**
   * Check if a client is idle
   */
  isIdle(clientId: string): boolean {
    const state = this.clients.get(clientId);
    if (!state) {
      return true; // Unknown client is considered idle
    }

    const idleDuration = Date.now() - state.lastActivity.getTime();
    return idleDuration >= this.config.idleThresholdMs;
  }

  /**
   * Get time since last activity for a client
   */
  getIdleDuration(clientId: string): number {
    const state = this.clients.get(clientId);
    if (!state) {
      return Infinity;
    }

    return Date.now() - state.lastActivity.getTime();
  }

  /**
   * Get last activity time for a client
   */
  getLastActivity(clientId: string): Date | null {
    return this.clients.get(clientId)?.lastActivity ?? null;
  }

  /**
   * Check if any PC client is active (not idle)
   */
  hasActivePcClient(): boolean {
    for (const state of this.clients.values()) {
      if (state.clientType === 'pc' && !this.isIdle(state.clientId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if all PC clients are idle
   */
  allPcClientsIdle(): boolean {
    let hasPc = false;
    for (const state of this.clients.values()) {
      if (state.clientType === 'pc') {
        hasPc = true;
        if (!this.isIdle(state.clientId)) {
          return false;
        }
      }
    }
    return hasPc; // True only if there are PC clients and all are idle
  }

  /**
   * Get all PC clients that are currently idle
   */
  getIdlePcClients(): IdleState[] {
    return Array.from(this.clients.values()).filter(
      (state) => state.clientType === 'pc' && this.isIdle(state.clientId)
    );
  }

  /**
   * Get all active (non-idle) PC clients
   */
  getActivePcClients(): IdleState[] {
    return Array.from(this.clients.values()).filter(
      (state) => state.clientType === 'pc' && !this.isIdle(state.clientId)
    );
  }

  /**
   * Get idle state for all clients
   */
  getAll(): IdleState[] {
    return Array.from(this.clients.values()).map((state) => ({
      ...state,
      isIdle: this.isIdle(state.clientId),
    }));
  }

  /**
   * Get number of tracked clients
   */
  size(): number {
    return this.clients.size;
  }

  /**
   * Clear all clients
   */
  clear(): void {
    this.clients.clear();
  }

  /**
   * Check for newly idle clients and emit events
   */
  private checkIdleClients(): void {
    const now = Date.now();

    for (const state of this.clients.values()) {
      const idleDuration = now - state.lastActivity.getTime();
      const shouldBeIdle = idleDuration >= this.config.idleThresholdMs;

      // Emit idle event on transition
      if (shouldBeIdle && !state.isIdle) {
        state.isIdle = true;
        this.emit('idle', state.clientId, state.clientType);
      }
    }
  }

  /**
   * Update the idle threshold
   */
  setIdleThreshold(thresholdMs: number): void {
    this.config.idleThresholdMs = thresholdMs;
  }

  /**
   * Get current idle threshold
   */
  getIdleThreshold(): number {
    return this.config.idleThresholdMs;
  }
}
