/**
 * RuntimeRegistry
 *
 * In-memory directory of registered LeCoder daemons (a.k.a. "runtimes").
 *
 * The hub does not own task execution — daemons do. The registry's only job
 * is to:
 *   1. Track which daemons are alive (last heartbeat within OFFLINE_AFTER_MS).
 *   2. Hold per-runtime queues of pending tasks so daemons can claim them
 *      via long-poll (`GET /fleet/:id/tasks/next`).
 *   3. Expose a snapshot for the `/fleet` REST endpoints and the web console.
 *
 * Persistence is intentionally deferred — when the hub restarts, daemons
 * re-register on their next heartbeat. Tasks themselves live in Postgres
 * (added in M2), so the only volatile state here is the live runtime set.
 */

export const OFFLINE_AFTER_MS = 60_000;

export type RuntimeStatus = 'online' | 'stale' | 'offline';

export interface Runtime {
  id: string;
  name: string;
  hostname: string;
  platform: string;
  arch: string;
  user: string;
  version: string;
  registeredAt: number;
  lastHeartbeatAt: number;
  status: RuntimeStatus;
  ownerUserId?: string;
}

export interface RuntimeRegistration {
  name: string;
  hostname: string;
  platform: string;
  arch: string;
  user: string;
  version: string;
  ownerUserId?: string;
}

export interface QueuedTask {
  id: string;
  title: string;
  body?: string;
  provider?: string;
  workingDirectory?: string;
}

/**
 * Time source — overridable for tests.
 */
export interface Clock {
  now(): number;
}

const realClock: Clock = { now: () => Date.now() };

/**
 * Generate a runtime ID. Public so test code can stub it.
 */
function defaultGenerateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `runtime_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export interface RuntimeRegistryOptions {
  clock?: Clock;
  generateId?: () => string;
  offlineAfterMs?: number;
}

export class RuntimeRegistry {
  private readonly clock: Clock;
  private readonly generateId: () => string;
  private readonly offlineAfterMs: number;
  private readonly runtimes = new Map<string, Runtime>();
  private readonly queues = new Map<string, QueuedTask[]>();

  constructor(options: RuntimeRegistryOptions = {}) {
    this.clock = options.clock ?? realClock;
    this.generateId = options.generateId ?? defaultGenerateId;
    this.offlineAfterMs = options.offlineAfterMs ?? OFFLINE_AFTER_MS;
  }

  /**
   * Register a new runtime or refresh an existing one with the same hostname+user.
   *
   * Re-registration of an existing host returns the same runtime ID so daemons
   * are idempotent across restarts.
   */
  register(input: RuntimeRegistration): Runtime {
    const now = this.clock.now();
    const existing = this.findExistingRuntime(input);

    if (existing) {
      const refreshed: Runtime = {
        ...existing,
        ...input,
        registeredAt: existing.registeredAt,
        lastHeartbeatAt: now,
        status: 'online',
      };
      this.runtimes.set(refreshed.id, refreshed);
      return refreshed;
    }

    const id = this.generateId();
    const runtime: Runtime = {
      id,
      ...input,
      registeredAt: now,
      lastHeartbeatAt: now,
      status: 'online',
    };
    this.runtimes.set(id, runtime);
    return runtime;
  }

  /**
   * Record a heartbeat for a runtime. Returns false if unknown so the caller
   * can return 404 and the daemon will re-register.
   */
  heartbeat(runtimeId: string): boolean {
    const runtime = this.runtimes.get(runtimeId);
    if (!runtime) return false;

    runtime.lastHeartbeatAt = this.clock.now();
    runtime.status = 'online';
    return true;
  }

  /**
   * Drop a runtime entirely. Used when the daemon explicitly deregisters or
   * when a long-offline runtime is pruned.
   */
  remove(runtimeId: string): boolean {
    this.queues.delete(runtimeId);
    return this.runtimes.delete(runtimeId);
  }

  get(runtimeId: string): Runtime | null {
    const runtime = this.runtimes.get(runtimeId);
    if (!runtime) return null;
    return { ...runtime, status: this.computeStatus(runtime) };
  }

  list(filter?: { ownerUserId?: string }): Runtime[] {
    const result: Runtime[] = [];
    for (const runtime of this.runtimes.values()) {
      if (filter?.ownerUserId && runtime.ownerUserId !== filter.ownerUserId) continue;
      result.push({ ...runtime, status: this.computeStatus(runtime) });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Add a task to a runtime's pending queue. */
  enqueueTask(runtimeId: string, task: QueuedTask): boolean {
    if (!this.runtimes.has(runtimeId)) return false;
    const queue = this.queues.get(runtimeId) ?? [];
    queue.push(task);
    this.queues.set(runtimeId, queue);
    return true;
  }

  /** Pop up to `max` queued tasks for a runtime. */
  drainTasks(runtimeId: string, max = 10): QueuedTask[] {
    const queue = this.queues.get(runtimeId);
    if (!queue || queue.length === 0) return [];
    const drained = queue.splice(0, max);
    if (queue.length === 0) this.queues.delete(runtimeId);
    return drained;
  }

  /** How many tasks are waiting for this runtime. */
  queueDepth(runtimeId: string): number {
    return this.queues.get(runtimeId)?.length ?? 0;
  }

  /**
   * Periodic sweep — call from a setInterval to demote stale runtimes.
   * Returns the number of runtimes whose status changed.
   */
  sweepStaleRuntimes(): number {
    let changed = 0;
    for (const runtime of this.runtimes.values()) {
      const next = this.computeStatus(runtime);
      if (next !== runtime.status) {
        runtime.status = next;
        changed++;
      }
    }
    return changed;
  }

  /** Test/diag helper — clear everything. */
  reset(): void {
    this.runtimes.clear();
    this.queues.clear();
  }

  /** Test/diag helper — count of runtimes currently registered. */
  size(): number {
    return this.runtimes.size;
  }

  private computeStatus(runtime: Runtime): RuntimeStatus {
    const age = this.clock.now() - runtime.lastHeartbeatAt;
    if (age <= this.offlineAfterMs) return 'online';
    if (age <= this.offlineAfterMs * 5) return 'stale';
    return 'offline';
  }

  private findExistingRuntime(input: RuntimeRegistration): Runtime | null {
    for (const runtime of this.runtimes.values()) {
      if (
        runtime.hostname === input.hostname &&
        runtime.user === input.user &&
        runtime.ownerUserId === input.ownerUserId
      ) {
        return runtime;
      }
    }
    return null;
  }
}

let singleton: RuntimeRegistry | null = null;

export function getRuntimeRegistry(): RuntimeRegistry {
  if (!singleton) singleton = new RuntimeRegistry();
  return singleton;
}

export function resetRuntimeRegistryForTests(): void {
  singleton = null;
}
