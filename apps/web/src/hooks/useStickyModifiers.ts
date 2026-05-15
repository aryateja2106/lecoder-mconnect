"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Sticky-modifier state machine for the hardware-key toolbar.
 *
 * Tap once  → ARMED  (will affect the next key, then auto-clear)
 * Tap twice → LOCKED (stays on until tapped again)
 * Tap when locked → IDLE
 *
 * Mirrors StickyModifierState in the iOS app so both sides feel identical.
 */
export type Modifier = "ctrl" | "shift" | "alt" | "cmd";

const DOUBLE_TAP_MS = 350;

export interface StickyModifiersApi {
  armed: ReadonlySet<Modifier>;
  locked: ReadonlySet<Modifier>;
  isActive: (mod: Modifier) => boolean;
  /** Cycle a modifier: idle → armed → locked → idle. */
  tap: (mod: Modifier) => void;
  /** Clear ARMED set after a key was sent. Locked stays. */
  consume: () => void;
  /** Force-clear everything (e.g. user dismissed toolbar). */
  reset: () => void;
}

export function useStickyModifiers(): StickyModifiersApi {
  const [armed, setArmed] = useState<Set<Modifier>>(() => new Set());
  const [locked, setLocked] = useState<Set<Modifier>>(() => new Set());
  const lastTap = useRef<Map<Modifier, number>>(new Map());

  const isActive = useCallback(
    (mod: Modifier) => armed.has(mod) || locked.has(mod),
    [armed, locked],
  );

  const tap = useCallback((mod: Modifier) => {
    const now = Date.now();
    const prev = lastTap.current.get(mod) ?? 0;
    const isDoubleTap = now - prev < DOUBLE_TAP_MS;
    lastTap.current.set(mod, now);

    setLocked((curLocked) => {
      const wasLocked = curLocked.has(mod);
      setArmed((curArmed) => {
        const next = new Set(curArmed);
        if (wasLocked) {
          // Locked → idle on any tap.
          next.delete(mod);
          return next;
        }
        if (isDoubleTap) {
          // Promote to LOCKED, clear from ARMED.
          next.delete(mod);
          return next;
        }
        if (next.has(mod)) {
          next.delete(mod);
        } else {
          next.add(mod);
        }
        return next;
      });
      const next = new Set(curLocked);
      if (wasLocked) next.delete(mod);
      else if (isDoubleTap) next.add(mod);
      return next;
    });
  }, []);

  const consume = useCallback(() => {
    setArmed((cur) => (cur.size ? new Set() : cur));
  }, []);

  const reset = useCallback(() => {
    setArmed(new Set());
    setLocked(new Set());
    lastTap.current.clear();
  }, []);

  return { armed, locked, isActive, tap, consume, reset };
}
