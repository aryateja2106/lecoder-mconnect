import { describe, it, expect, beforeEach } from 'bun:test';
import { TaskStore } from '../../tasks/TaskStore.js';
import { AutopilotScheduler, nextRunAt } from '../Autopilot.js';

class FakeClock {
  current = Date.UTC(2026, 0, 1, 12, 0, 0); // 2026-01-01 12:00:00Z
  now() {
    return this.current;
  }
  advance(ms: number) {
    this.current += ms;
  }
}

describe('nextRunAt', () => {
  const t0 = Date.UTC(2026, 0, 1, 12, 0, 0);

  it('every Nm', () => {
    expect(nextRunAt('every 5m', t0)).toBe(t0 + 5 * 60 * 1000);
  });
  it('every Nh', () => {
    expect(nextRunAt('every 2h', t0)).toBe(t0 + 2 * 60 * 60 * 1000);
  });
  it('every Nd', () => {
    expect(nextRunAt('every 1d', t0)).toBe(t0 + 24 * 60 * 60 * 1000);
  });
  it('hourly', () => {
    expect(nextRunAt('hourly', t0)).toBe(t0 + 60 * 60 * 1000);
  });
  it('daily HH:MM in the future today', () => {
    expect(nextRunAt('daily 14:30', t0)).toBe(Date.UTC(2026, 0, 1, 14, 30));
  });
  it('daily HH:MM that already passed rolls to tomorrow', () => {
    expect(nextRunAt('daily 09:00', t0)).toBe(Date.UTC(2026, 0, 2, 9, 0));
  });
  it('rejects malformed schedules', () => {
    expect(nextRunAt('foo', t0)).toBeNull();
    expect(nextRunAt('every 0m', t0)).toBeNull();
    expect(nextRunAt('daily 99:00', t0)).toBeNull();
    expect(nextRunAt('', t0)).toBeNull();
  });
});

describe('AutopilotScheduler', () => {
  let clock: FakeClock;
  let store: TaskStore;
  let scheduler: AutopilotScheduler;
  let n = 0;

  beforeEach(() => {
    clock = new FakeClock();
    store = new TaskStore({ clock });
    n = 0;
    scheduler = new AutopilotScheduler({
      store,
      clock,
      generateId: () => `ap-${++n}`,
    });
  });

  it('create() rejects an invalid schedule', () => {
    const ap = scheduler.create({
      name: 'broken',
      schedule: 'never',
      task: { title: 'x' },
    });
    expect(ap).toBeNull();
  });

  it('create() schedules nextRunAt forward', () => {
    const ap = scheduler.create({
      name: 'a',
      schedule: 'every 10m',
      task: { title: 'morning standup' },
    });
    expect(ap).not.toBeNull();
    expect(ap?.nextRunAt).toBe(clock.now() + 10 * 60_000);
  });

  it('tick fires pending autopilots and reschedules', () => {
    scheduler.create({
      name: 'standup',
      schedule: 'every 10m',
      task: { title: 'standup' },
    });
    expect(store.size().tasks).toBe(0);

    clock.advance(11 * 60_000);
    const fired = scheduler.tick();
    expect(fired).toBe(1);
    expect(store.size().tasks).toBe(1);

    const tasks = store.listTasks();
    expect(tasks[0].title).toBe('standup');
    expect(tasks[0].metadata.autopilotName).toBe('standup');

    // After firing, should not fire again until next interval.
    expect(scheduler.tick()).toBe(0);

    // Advance another 11 min — fires again.
    clock.advance(11 * 60_000);
    expect(scheduler.tick()).toBe(1);
    expect(store.size().tasks).toBe(2);
  });

  it('disabled autopilots do not fire', () => {
    const ap = scheduler.create({
      name: 'a',
      schedule: 'every 1m',
      task: { title: 'x' },
      enabled: false,
    });
    expect(ap?.enabled).toBe(false);
    clock.advance(60 * 60_000);
    expect(scheduler.tick()).toBe(0);
  });

  it('update() with a new schedule reschedules nextRunAt', () => {
    const ap = scheduler.create({
      name: 'a',
      schedule: 'every 10m',
      task: { title: 'x' },
    });
    const beforeNext = ap?.nextRunAt;
    const updated = scheduler.update(ap!.id, { schedule: 'every 1h' });
    expect(updated?.nextRunAt).not.toBe(beforeNext);
    expect(updated?.nextRunAt).toBe(clock.now() + 60 * 60_000);
  });

  it('update() with an invalid schedule returns null and keeps state', () => {
    const ap = scheduler.create({
      name: 'a',
      schedule: 'every 10m',
      task: { title: 'x' },
    });
    const result = scheduler.update(ap!.id, { schedule: 'forever' });
    expect(result).toBeNull();
    expect(scheduler.get(ap!.id)?.schedule).toBe('every 10m');
  });

  it('list() filters by ownerUserId', () => {
    scheduler.create({
      ownerUserId: 'u-1',
      name: 'mine',
      schedule: 'every 1m',
      task: { title: 'x' },
    });
    scheduler.create({
      ownerUserId: 'u-2',
      name: 'theirs',
      schedule: 'every 1m',
      task: { title: 'y' },
    });
    expect(scheduler.list({ ownerUserId: 'u-1' }).length).toBe(1);
  });

  it('remove() drops the autopilot', () => {
    const ap = scheduler.create({
      name: 'a',
      schedule: 'every 1m',
      task: { title: 'x' },
    });
    expect(scheduler.remove(ap!.id)).toBe(true);
    expect(scheduler.size()).toBe(0);
  });
});
