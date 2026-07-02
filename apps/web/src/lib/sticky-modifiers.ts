export type Modifier = "ctrl" | "shift" | "alt" | "cmd";

const DOUBLE_TAP_MS = 350;

export interface StickyModifierSnapshot {
  armed: Set<Modifier>;
  locked: Set<Modifier>;
}

export interface StickyModifierState {
  isActive: (mod: Modifier) => boolean;
  tap: (mod: Modifier, now?: number) => StickyModifierSnapshot;
  consume: () => StickyModifierSnapshot;
  reset: () => StickyModifierSnapshot;
  snapshot: () => StickyModifierSnapshot;
}

function copySnapshot(
  armed: ReadonlySet<Modifier>,
  locked: ReadonlySet<Modifier>,
): StickyModifierSnapshot {
  return {
    armed: new Set(armed),
    locked: new Set(locked),
  };
}

export function createStickyModifierState(): StickyModifierState {
  const armed = new Set<Modifier>();
  const locked = new Set<Modifier>();
  const lastTap = new Map<Modifier, number>();

  return {
    isActive(mod) {
      return armed.has(mod) || locked.has(mod);
    },

    tap(mod, now = Date.now()) {
      const prev = lastTap.get(mod) ?? 0;
      const isDoubleTap = now - prev < DOUBLE_TAP_MS;
      lastTap.set(mod, now);

      if (locked.has(mod)) {
        locked.delete(mod);
        armed.delete(mod);
        return copySnapshot(armed, locked);
      }

      if (isDoubleTap) {
        armed.delete(mod);
        locked.add(mod);
        return copySnapshot(armed, locked);
      }

      if (armed.has(mod)) {
        armed.delete(mod);
      } else {
        armed.add(mod);
      }

      return copySnapshot(armed, locked);
    },

    consume() {
      armed.clear();
      return copySnapshot(armed, locked);
    },

    reset() {
      armed.clear();
      locked.clear();
      lastTap.clear();
      return copySnapshot(armed, locked);
    },

    snapshot() {
      return copySnapshot(armed, locked);
    },
  };
}
