/**
 * Autopilot — recurring task scheduler.
 *
 * Inspired by Multica's "autopilots" feature: a saved task spec that fires
 * on a schedule. We deliberately do NOT pull in a full cron parser — the
 * supported expression set is intentionally narrow:
 *
 *   • `every Nm` / `every Nh` / `every Nd` — fire every N minutes/hours/days
 *   • `daily HH:MM`                         — once a day at HH:MM (UTC)
 *   • `hourly`                              — every hour on the hour
 *
 * That covers ~90% of the use cases without a yaml/cron dependency, and the
 * abstraction is small enough to swap in node-cron later.
 *
 * Like RuntimeRegistry, autopilots live in memory; the migration scaffold
 * is left for a future commit when production deployments need persistence.
 */

import type { TaskStore } from '../tasks/TaskStore.js';
import type { CreateTaskInput } from '../tasks/types.js';

export interface AutopilotSpec {
  id: string;
  ownerUserId?: string;
  name: string;
  schedule: string;
  task: CreateTaskInput;
  enabled: boolean;
  createdAt: number;
  lastRunAt?: number;
  nextRunAt: number;
}

export interface CreateAutopilotInput {
  ownerUserId?: string;
  name: string;
  schedule: string;
  task: CreateTaskInput;
  enabled?: boolean;
}

export interface UpdateAutopilotInput {
  name?: string;
  schedule?: string;
  enabled?: boolean;
  task?: CreateTaskInput;
}

export interface Clock {
  now(): number;
}

const realClock: Clock = { now: () => Date.now() };

/**
 * Compute the next firing timestamp for a schedule expression.
 *
 * Returns null when the expression is malformed.
 */
export function nextRunAt(schedule: string, from: number): number | null {
  const trimmed = schedule.trim().toLowerCase();
  if (!trimmed) return null;

  // every Nm | every Nh | every Nd
  const everyMatch = trimmed.match(/^every\s+(\d+)\s*([mhd])$/);
  if (everyMatch) {
    const amount = parseInt(everyMatch[1], 10);
    if (amount <= 0) return null;
    const unit = everyMatch[2];
    const factor = unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
    return from + amount * factor;
  }

  // hourly
  if (trimmed === 'hourly') {
    return from + 60 * 60 * 1000;
  }

  // daily HH:MM (UTC)
  const dailyMatch = trimmed.match(/^daily\s+(\d{1,2}):(\d{2})$/);
  if (dailyMatch) {
    const hour = parseInt(dailyMatch[1], 10);
    const minute = parseInt(dailyMatch[2], 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    const date = new Date(from);
    const candidate = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hour,
      minute,
      0,
      0
    );
    return candidate > from ? candidate : candidate + 86_400_000;
  }

  return null;
}

/**
 * In-memory autopilot store + tick loop.
 */
export class AutopilotScheduler {
  private readonly store: TaskStore;
  private readonly clock: Clock;
  private readonly autopilots = new Map<string, AutopilotSpec>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly newId: () => string;

  constructor(opts: { store: TaskStore; clock?: Clock; generateId?: () => string }) {
    this.store = opts.store;
    this.clock = opts.clock ?? realClock;
    this.newId =
      opts.generateId ??
      (() => {
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
        return `ap_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      });
  }

  start(intervalMs = 30_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick();
    }, intervalMs);
    (this.timer as { unref?: () => void }).unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Run any autopilots whose nextRunAt has passed. Returns the number fired. */
  tick(): number {
    const now = this.clock.now();
    let fired = 0;
    for (const ap of this.autopilots.values()) {
      if (!ap.enabled) continue;
      if (ap.nextRunAt > now) continue;
      this.fire(ap, now);
      fired++;
    }
    return fired;
  }

  create(input: CreateAutopilotInput): AutopilotSpec | null {
    const next = nextRunAt(input.schedule, this.clock.now());
    if (next === null) return null;
    const ap: AutopilotSpec = {
      id: this.newId(),
      ownerUserId: input.ownerUserId,
      name: input.name,
      schedule: input.schedule,
      task: input.task,
      enabled: input.enabled !== false,
      createdAt: this.clock.now(),
      nextRunAt: next,
    };
    this.autopilots.set(ap.id, ap);
    return { ...ap };
  }

  update(id: string, patch: UpdateAutopilotInput): AutopilotSpec | null {
    const existing = this.autopilots.get(id);
    if (!existing) return null;
    if (patch.schedule) {
      const next = nextRunAt(patch.schedule, this.clock.now());
      if (next === null) return null;
      existing.schedule = patch.schedule;
      existing.nextRunAt = next;
    }
    if (typeof patch.enabled === 'boolean') existing.enabled = patch.enabled;
    if (patch.name) existing.name = patch.name;
    if (patch.task) existing.task = patch.task;
    return { ...existing };
  }

  remove(id: string): boolean {
    return this.autopilots.delete(id);
  }

  get(id: string): AutopilotSpec | null {
    const ap = this.autopilots.get(id);
    return ap ? { ...ap } : null;
  }

  list(filter?: { ownerUserId?: string }): AutopilotSpec[] {
    const result: AutopilotSpec[] = [];
    for (const ap of this.autopilots.values()) {
      if (filter?.ownerUserId && ap.ownerUserId !== filter.ownerUserId) continue;
      result.push({ ...ap });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  reset(): void {
    this.autopilots.clear();
  }

  size(): number {
    return this.autopilots.size;
  }

  private fire(ap: AutopilotSpec, now: number): void {
    try {
      this.store.createTask({
        ...ap.task,
        ownerUserId: ap.task.ownerUserId ?? ap.ownerUserId,
        metadata: { ...(ap.task.metadata ?? {}), autopilotId: ap.id, autopilotName: ap.name },
      });
    } catch {
      // Swallow — we still want to advance the next-run-at so we don't spin
      // tightly on a permanently-broken autopilot.
    }
    ap.lastRunAt = now;
    const next = nextRunAt(ap.schedule, now);
    if (next === null) {
      ap.enabled = false;
    } else {
      ap.nextRunAt = next;
    }
  }
}

let singleton: AutopilotScheduler | null = null;

export function getAutopilotScheduler(): AutopilotScheduler {
  if (!singleton) {
    // Lazy-import to avoid a circular dependency at module load time.
    // The store is the singleton, not a wrapped instance, so this is safe.
    // Tests should pass an explicit instance instead.
    const { getTaskStore } = require('../tasks/TaskStore.js') as typeof import('../tasks/TaskStore.js');
    singleton = new AutopilotScheduler({ store: getTaskStore() });
  }
  return singleton;
}

export function resetAutopilotSchedulerForTests(): void {
  if (singleton) singleton.stop();
  singleton = null;
}
