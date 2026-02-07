/**
 * Input Arbiter - State machine for input control arbitration
 * MConnect V2 Server
 *
 * Ported from packages/cli/src/input/InputArbiter.ts with adaptations for server-side use.
 *
 * Manages which client has control based on:
 * - Priority levels (exclusive > high > normal > low > observer)
 * - Idle detection (PC idle after 30s allows mobile input)
 * - Explicit control requests (mobile can request exclusive for 5min)
 */

import { EventEmitter } from 'node:events';
import type { ClientType, Priority } from '@lecoder/shared';
import type { InputRejectionReason } from '@lecoder/shared/protocol';

// ============================================================================
// Types
// ============================================================================

/**
 * Arbiter state machine states
 */
export type ArbiterState = 'pc_active' | 'pc_idle' | 'pc_disconnected' | 'mobile_exclusive';

/**
 * Configuration for the Input Arbiter
 */
export interface InputArbiterConfig {
  /** PC idle threshold in ms (default: 30s) */
  pcIdleThresholdMs: number;
  /** Mobile grace period after PC resumes (default: 5s) */
  mobileGracePeriodMs: number;
  /** Exclusive control timeout in ms (default: 5min) */
  exclusiveTimeoutMs: number;
  /** Window to detect concurrent inputs (default: 100ms) */
  conflictWindowMs: number;
  /** Input rate limit in chars per second (default: 100) */
  inputRateLimitCps: number;
}

/**
 * Default configuration values
 */
const DEFAULT_ARBITER_CONFIG: InputArbiterConfig = {
  pcIdleThresholdMs: 30000,
  mobileGracePeriodMs: 5000,
  exclusiveTimeoutMs: 300000,
  conflictWindowMs: 100,
  inputRateLimitCps: 100,
};

/**
 * Result of processing input
 */
export interface InputResult {
  accepted: boolean;
  rejectReason?: InputRejectionReason;
}

/**
 * Queued client in priority queue
 */
export interface QueuedClient {
  clientId: string;
  clientType: ClientType;
  priority: Priority;
  joinedAt: Date;
}

/**
 * Idle state for a client
 */
interface IdleState {
  clientId: string;
  clientType: ClientType;
  lastActivity: Date;
  isIdle: boolean;
}

/**
 * Audit log entry types for control transfer events
 */
export type AuditEventType =
  | 'control_granted'
  | 'control_released'
  | 'control_timeout'
  | 'state_change';

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  eventType: AuditEventType;
  clientId: string;
  details: string;
  timestamp: Date;
}

/**
 * Callback for audit logging
 */
export type AuditLogCallback = (entry: AuditLogEntry) => void;

// ============================================================================
// Priority Order
// ============================================================================

/**
 * Priority order mapping (higher number = higher priority)
 */
const PRIORITY_ORDER: Record<Priority, number> = {
  exclusive: 4,
  high: 3,
  normal: 2,
  low: 1,
  observer: 0,
};

// ============================================================================
// Priority Queue
// ============================================================================

/**
 * Priority queue for client management
 */
class PriorityQueue {
  private clients: Map<string, QueuedClient> = new Map();

  /**
   * Add or update a client in the queue
   */
  add(clientId: string, clientType: ClientType, priority: Priority = 'normal'): void {
    const existing = this.clients.get(clientId);

    this.clients.set(clientId, {
      clientId,
      clientType,
      priority,
      joinedAt: existing?.joinedAt ?? new Date(),
    });
  }

  /**
   * Remove a client from the queue
   */
  remove(clientId: string): boolean {
    return this.clients.delete(clientId);
  }

  /**
   * Update a client's priority
   */
  updatePriority(clientId: string, priority: Priority): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    client.priority = priority;
    return true;
  }

  /**
   * Get the highest priority client that can send input
   */
  getActiveClient(): QueuedClient | null {
    let highest: QueuedClient | null = null;
    let highestOrder = -1;

    for (const client of this.clients.values()) {
      // Observers cannot send input
      if (client.priority === 'observer') {
        continue;
      }

      const order = PRIORITY_ORDER[client.priority];
      if (order > highestOrder) {
        highest = client;
        highestOrder = order;
      } else if (order === highestOrder && highest) {
        // Same priority: prefer PC clients, then earlier join time
        if (client.clientType === 'pc' && highest.clientType !== 'pc') {
          highest = client;
        } else if (client.clientType === highest.clientType) {
          // Same type: prefer earlier join time
          if (client.joinedAt < highest.joinedAt) {
            highest = client;
          }
        }
      }
    }

    return highest;
  }

  /**
   * Get a client by ID
   */
  get(clientId: string): QueuedClient | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get all clients
   */
  getAll(): QueuedClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get PC clients (non-observer)
   */
  getPcClients(): QueuedClient[] {
    return this.getAll().filter(c => c.clientType === 'pc' && c.priority !== 'observer');
  }

  /**
   * Check if any PC client is present (non-observer)
   */
  hasPcClient(): boolean {
    return this.getPcClients().length > 0;
  }

  /**
   * Check if any mobile client is present (non-observer)
   */
  hasMobileClient(): boolean {
    return this.getAll().filter(c => c.clientType === 'mobile' && c.priority !== 'observer').length > 0;
  }

  /**
   * Get default priority for a client type
   */
  static getDefaultPriority(clientType: ClientType): Priority {
    return clientType === 'pc' ? 'high' : 'normal';
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.clients.size;
  }
}

// ============================================================================
// Idle Detector
// ============================================================================

/**
 * Per-client idle tracking
 */
class IdleDetector extends EventEmitter {
  private clients: Map<string, IdleState> = new Map();
  private idleThresholdMs: number;
  private checkIntervalMs: number;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(idleThresholdMs: number = 30000, checkIntervalMs: number = 5000) {
    super();
    this.idleThresholdMs = idleThresholdMs;
    this.checkIntervalMs = checkIntervalMs;
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
    }, this.checkIntervalMs);
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
    return idleDuration >= this.idleThresholdMs;
  }

  /**
   * Get last activity time for a client
   */
  getLastActivity(clientId: string): Date | null {
    return this.clients.get(clientId)?.lastActivity ?? null;
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
   * Check for newly idle clients and emit events
   */
  private checkIdleClients(): void {
    const now = Date.now();

    for (const state of this.clients.values()) {
      const idleDuration = now - state.lastActivity.getTime();
      const shouldBeIdle = idleDuration >= this.idleThresholdMs;

      // Emit idle event on transition
      if (shouldBeIdle && !state.isIdle) {
        state.isIdle = true;
        this.emit('idle', state.clientId, state.clientType);
      }
    }
  }
}

// ============================================================================
// Input Arbiter
// ============================================================================

/**
 * Input Arbiter - State machine for input control arbitration
 */
export class InputArbiter extends EventEmitter {
  private sessionId: string;
  private config: InputArbiterConfig;
  private priorityQueue: PriorityQueue;
  private idleDetector: IdleDetector;

  private state: ArbiterState = 'pc_disconnected';
  private exclusiveClientId: string | null = null;
  private exclusiveTimeout: ReturnType<typeof setTimeout> | null = null;
  private mobileGraceTimeout: ReturnType<typeof setTimeout> | null = null;
  private inMobileGracePeriod = false;

  /** Rate limiting: track chars per client */
  private inputRateTracking: Map<string, { chars: number; windowStart: number }> = new Map();

  /** Audit logger callback for control transfer events */
  private auditLogger: AuditLogCallback | null = null;

  constructor(sessionId: string, config: Partial<InputArbiterConfig> = {}) {
    super();
    this.sessionId = sessionId;
    this.config = { ...DEFAULT_ARBITER_CONFIG, ...config };

    this.priorityQueue = new PriorityQueue();
    this.idleDetector = new IdleDetector(this.config.pcIdleThresholdMs);

    // Listen for idle events
    this.idleDetector.on('idle', this.handleClientIdle.bind(this));
    this.idleDetector.on('active', this.handleClientActive.bind(this));
  }

  /**
   * Start the arbiter
   */
  start(): void {
    this.idleDetector.start();
  }

  /**
   * Stop the arbiter
   */
  stop(): void {
    this.idleDetector.stop();
    this.clearExclusiveTimeout();
    this.clearMobileGraceTimeout();
  }

  /**
   * Set the audit logger callback
   */
  setAuditLogger(logger: AuditLogCallback): void {
    this.auditLogger = logger;
  }

  /**
   * Log an audit event
   */
  private logAuditEvent(eventType: AuditEventType, clientId: string, details: string): void {
    if (this.auditLogger) {
      this.auditLogger({
        eventType,
        clientId,
        details,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Add a client to the session
   */
  addClient(clientId: string, clientType: ClientType, priority?: Priority): void {
    const defaultPriority = priority ?? PriorityQueue.getDefaultPriority(clientType);
    this.priorityQueue.add(clientId, clientType, defaultPriority);
    this.idleDetector.register(clientId, clientType);

    // Update state based on new client
    this.updateState();
  }

  /**
   * Remove a client from the session
   */
  removeClient(clientId: string): void {
    // If this client had exclusive control, release it
    if (this.exclusiveClientId === clientId) {
      this.releaseExclusiveControl();
    }

    this.priorityQueue.remove(clientId);
    this.idleDetector.unregister(clientId);
    this.inputRateTracking.delete(clientId);

    // Update state based on remaining clients
    this.updateState();
  }

  /**
   * Process an input from a client
   */
  processInput(clientId: string, input: string): InputResult {
    // Check if client exists
    const client = this.priorityQueue.get(clientId);
    if (!client) {
      return { accepted: false, rejectReason: 'read_only' };
    }

    // Observers can never send input
    if (client.priority === 'observer') {
      return { accepted: false, rejectReason: 'read_only' };
    }

    // Check rate limiting
    if (this.isRateLimited(clientId, input.length)) {
      this.emit('inputRejected', clientId, input, 'rate_limited');
      return { accepted: false, rejectReason: 'rate_limited' };
    }

    // Record activity (resets idle timer)
    this.idleDetector.recordActivity(clientId);

    // Check exclusive control
    if (this.exclusiveClientId && this.exclusiveClientId !== clientId) {
      const reason: InputRejectionReason = 'other_exclusive';
      this.emit('inputRejected', clientId, input, reason);
      return { accepted: false, rejectReason: reason };
    }

    // Check state-based control
    const canInput = this.canClientInput(clientId, client.clientType);
    if (!canInput.allowed) {
      this.emit('inputRejected', clientId, input, canInput.reason!);
      return { accepted: false, rejectReason: canInput.reason };
    }

    // Track rate
    this.trackInputRate(clientId, input.length);

    // Input accepted
    this.emit('inputAccepted', clientId, input);
    return { accepted: true };
  }

  /**
   * Request exclusive control for a client
   */
  requestExclusiveControl(clientId: string): boolean {
    const client = this.priorityQueue.get(clientId);
    if (!client) {
      return false;
    }

    // Only mobile clients can request exclusive (PC already has high priority)
    if (client.clientType !== 'mobile') {
      return false;
    }

    // Can't take exclusive if already exclusive
    if (this.exclusiveClientId) {
      return false;
    }

    // Grant exclusive control
    this.exclusiveClientId = clientId;
    this.priorityQueue.updatePriority(clientId, 'exclusive');

    // Set timeout for auto-release
    this.clearExclusiveTimeout();
    this.exclusiveTimeout = setTimeout(() => {
      this.releaseExclusiveControlInternal(true); // true = timeout
    }, this.config.exclusiveTimeoutMs);

    // Update state
    const oldState = this.state;
    this.state = 'mobile_exclusive';
    this.emitStateChange(oldState);

    // Audit log: control granted
    this.logAuditEvent(
      'control_granted',
      clientId,
      `Exclusive control granted to mobile client (timeout: ${this.config.exclusiveTimeoutMs}ms)`
    );

    this.emit('controlGranted', clientId, 'exclusive');
    return true;
  }

  /**
   * Release exclusive control (public API - manual release)
   */
  releaseExclusiveControl(): boolean {
    return this.releaseExclusiveControlInternal(false);
  }

  /**
   * Internal release method
   */
  private releaseExclusiveControlInternal(isTimeout: boolean): boolean {
    if (!this.exclusiveClientId) {
      return false;
    }

    const clientId = this.exclusiveClientId;
    const client = this.priorityQueue.get(clientId);

    if (client) {
      // Reset to normal priority for mobile
      this.priorityQueue.updatePriority(clientId, 'normal');
    }

    this.exclusiveClientId = null;
    this.clearExclusiveTimeout();

    // Update state
    this.updateState();

    // Audit log
    this.logAuditEvent(
      isTimeout ? 'control_timeout' : 'control_released',
      clientId,
      isTimeout
        ? 'Exclusive control timed out automatically'
        : 'Exclusive control released by client'
    );

    this.emit('controlReleased', clientId);
    return true;
  }

  /**
   * Get current control state
   */
  getControlState(): { state: ArbiterState; currentOwner?: string; exclusiveExpires?: Date; lastPcInput?: Date } {
    const activeClient = this.priorityQueue.getActiveClient();

    return {
      state: this.state,
      currentOwner: activeClient?.clientId,
      exclusiveExpires:
        this.exclusiveClientId && this.exclusiveTimeout
          ? new Date(Date.now() + this.config.exclusiveTimeoutMs)
          : undefined,
      lastPcInput: this.getLastPcActivity(),
    };
  }

  /**
   * Get current arbiter state
   */
  getState(): ArbiterState {
    return this.state;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Check if a client has exclusive control
   */
  hasExclusiveControl(clientId: string): boolean {
    return this.exclusiveClientId === clientId;
  }

  /**
   * Get the client with exclusive control
   */
  getExclusiveClient(): string | null {
    return this.exclusiveClientId;
  }

  /**
   * Get all clients
   */
  getClients(): QueuedClient[] {
    return this.priorityQueue.getAll();
  }

  /**
   * Get client by ID
   */
  getClient(clientId: string): QueuedClient | undefined {
    return this.priorityQueue.get(clientId);
  }

  // ============================================
  // Private Methods
  // ============================================

  private canClientInput(
    clientId: string,
    clientType: ClientType
  ): { allowed: boolean; reason?: InputRejectionReason } {
    switch (this.state) {
      case 'pc_active':
        // PC active: only PC can input, unless in mobile grace period
        if (clientType === 'pc') {
          return { allowed: true };
        }
        // Mobile blocked unless in grace period
        if (this.inMobileGracePeriod) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'pc_typing' };

      case 'pc_idle':
        // PC idle: both PC and mobile can input
        return { allowed: true };

      case 'pc_disconnected':
        // No PC: anyone can input
        return { allowed: true };

      case 'mobile_exclusive':
        // Mobile exclusive: only the exclusive client
        if (this.exclusiveClientId === clientId) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'other_exclusive' };

      default:
        return { allowed: true };
    }
  }

  private handleClientIdle(_clientId: string, clientType: ClientType): void {
    if (clientType === 'pc' && this.state === 'pc_active') {
      // All PC clients idle: transition to pc_idle
      if (this.idleDetector.allPcClientsIdle()) {
        const oldState = this.state;
        this.state = 'pc_idle';
        this.emitStateChange(oldState);
      }
    }
  }

  private handleClientActive(_clientId: string, clientType: ClientType): void {
    if (clientType === 'pc') {
      // PC became active
      if (this.state === 'pc_idle' || this.state === 'pc_disconnected') {
        const oldState = this.state;
        this.state = 'pc_active';

        // If mobile was sending input, start grace period
        if (this.priorityQueue.hasMobileClient()) {
          this.startMobileGracePeriod();
        }

        this.emitStateChange(oldState);
      }
    }
  }

  private updateState(): void {
    const hasPc = this.priorityQueue.hasPcClient();
    const oldState = this.state;

    if (this.exclusiveClientId) {
      this.state = 'mobile_exclusive';
    } else if (!hasPc) {
      this.state = 'pc_disconnected';
    } else if (this.idleDetector.allPcClientsIdle()) {
      this.state = 'pc_idle';
    } else {
      this.state = 'pc_active';
    }

    if (oldState !== this.state) {
      this.emitStateChange(oldState);
    }
  }

  private emitStateChange(oldState: ArbiterState): void {
    // Audit log: state change
    const activeClient = this.priorityQueue.getActiveClient();
    this.logAuditEvent(
      'state_change',
      activeClient?.clientId || 'system',
      `Control state changed: ${oldState} → ${this.state}`
    );

    this.emit('stateChange', this.state, oldState, this.getControlState());
  }

  private startMobileGracePeriod(): void {
    this.inMobileGracePeriod = true;
    this.clearMobileGraceTimeout();

    this.mobileGraceTimeout = setTimeout(() => {
      this.inMobileGracePeriod = false;
    }, this.config.mobileGracePeriodMs);
  }

  private clearExclusiveTimeout(): void {
    if (this.exclusiveTimeout) {
      clearTimeout(this.exclusiveTimeout);
      this.exclusiveTimeout = null;
    }
  }

  private clearMobileGraceTimeout(): void {
    if (this.mobileGraceTimeout) {
      clearTimeout(this.mobileGraceTimeout);
      this.mobileGraceTimeout = null;
    }
  }

  private getLastPcActivity(): Date | undefined {
    const pcClients = this.priorityQueue.getPcClients();
    let latest: Date | undefined;

    for (const client of pcClients) {
      const activity = this.idleDetector.getLastActivity(client.clientId);
      if (activity && (!latest || activity > latest)) {
        latest = activity;
      }
    }

    return latest;
  }

  private isRateLimited(clientId: string, charCount: number): boolean {
    const now = Date.now();
    const windowMs = 1000; // 1 second window
    const maxChars = this.config.inputRateLimitCps;

    let tracking = this.inputRateTracking.get(clientId);

    if (!tracking || now - tracking.windowStart >= windowMs) {
      // New window
      tracking = { chars: 0, windowStart: now };
      this.inputRateTracking.set(clientId, tracking);
    }

    if (tracking.chars + charCount > maxChars) {
      return true; // Would exceed rate limit
    }

    return false;
  }

  private trackInputRate(clientId: string, charCount: number): void {
    const tracking = this.inputRateTracking.get(clientId);
    if (tracking) {
      tracking.chars += charCount;
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export default InputArbiter;
