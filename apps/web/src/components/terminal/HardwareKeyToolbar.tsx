"use client";

import { useCallback, useEffect, useRef } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { sequenceFor, withCtrl, type SpecialKey } from "@/lib/terminal-keys";
import {
  useStickyModifiers,
  type Modifier,
} from "@/hooks/useStickyModifiers";

export interface HardwareKeyToolbarProps {
  /** Send a string into the active PTY (single chars or escape sequences). */
  onSend: (data: string) => void;
  /** Pixels above the safe-area-inset-bottom (e.g. soft keyboard height). */
  bottomOffsetPx: number;
}

const MODIFIERS: Array<{ id: Modifier; label: string }> = [
  { id: "ctrl", label: "Ctrl" },
  { id: "shift", label: "Shift" },
  { id: "alt", label: "Alt" },
  { id: "cmd", label: "Cmd" },
];

/**
 * Two-row hardware-key bar that lives just above the soft keyboard.
 * Row 1: Esc Tab Ctrl Shift Alt Cmd Del
 * Row 2: ← ↑ ↓ → Home End PgUp PgDn
 *
 * Modifier keys are sticky toggles (single-tap arms, double-tap locks).
 * Arrow keys auto-repeat at 60ms when held.
 */
export function HardwareKeyToolbar({ onSend, bottomOffsetPx }: HardwareKeyToolbarProps) {
  const mods = useStickyModifiers();
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialDelay = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback(
    (data: string) => {
      let payload = data;
      // Ctrl + ASCII letter is the meaningful local combo. Other modifiers
      // pass through (handled by the system keyboard for typed chars).
      if (mods.isActive("ctrl") && payload.length === 1) {
        payload = withCtrl(payload);
      }
      onSend(payload);
      mods.consume();
    },
    [mods, onSend],
  );

  const sendSpecial = useCallback(
    (key: SpecialKey) => send(sequenceFor(key)),
    [send],
  );

  // ── Long-press auto-repeat for arrows ───────────────────────────────────
  const stopRepeat = useCallback(() => {
    if (initialDelay.current) clearTimeout(initialDelay.current);
    if (repeatTimer.current) clearInterval(repeatTimer.current);
    initialDelay.current = null;
    repeatTimer.current = null;
  }, []);

  const startRepeat = useCallback(
    (key: SpecialKey) => {
      sendSpecial(key);
      initialDelay.current = setTimeout(() => {
        repeatTimer.current = setInterval(() => sendSpecial(key), 60);
      }, 350);
    },
    [sendSpecial],
  );

  useEffect(() => stopRepeat, [stopRepeat]);

  const Key = ({
    label,
    onPress,
    armed,
    locked,
    onPressStart,
    onPressEnd,
    ariaLabel,
    children,
  }: {
    label?: string;
    onPress?: () => void;
    armed?: boolean;
    locked?: boolean;
    onPressStart?: () => void;
    onPressEnd?: () => void;
    ariaLabel?: string;
    children?: React.ReactNode;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      data-armed={armed || undefined}
      data-locked={locked || undefined}
      className="mconnect-key"
      onClick={onPress}
      onPointerDown={onPressStart}
      onPointerUp={onPressEnd}
      onPointerCancel={onPressEnd}
      onPointerLeave={onPressEnd}
    >
      {children ?? label}
    </button>
  );

  return (
    <div
      className="safe-area-inset-bottom safe-area-inset-left safe-area-inset-right fixed inset-x-0 z-20 bg-black/95 px-1.5 pt-1.5 backdrop-blur-md"
      style={{ bottom: `${bottomOffsetPx}px` }}
      role="group"
      aria-label="Terminal hardware keys"
    >
      {/* Row 1: modifiers + Esc/Tab/Del */}
      <div className="mb-1.5 flex gap-1.5">
        <Key label="Esc" onPress={() => sendSpecial("Esc")} />
        <Key label="Tab" onPress={() => sendSpecial("Tab")} />
        {MODIFIERS.map((m) => (
          <Key
            key={m.id}
            label={m.label}
            onPress={() => mods.tap(m.id)}
            armed={mods.armed.has(m.id)}
            locked={mods.locked.has(m.id)}
          />
        ))}
        <Key label="Del" onPress={() => sendSpecial("Del")} />
      </div>

      {/* Row 2: arrows + nav */}
      <div className="flex gap-1.5 pb-1.5">
        <Key
          ariaLabel="Arrow Left"
          onPressStart={() => startRepeat("ArrowLeft")}
          onPressEnd={stopRepeat}
        >
          <ArrowLeft className="h-4 w-4" />
        </Key>
        <Key
          ariaLabel="Arrow Up"
          onPressStart={() => startRepeat("ArrowUp")}
          onPressEnd={stopRepeat}
        >
          <ArrowUp className="h-4 w-4" />
        </Key>
        <Key
          ariaLabel="Arrow Down"
          onPressStart={() => startRepeat("ArrowDown")}
          onPressEnd={stopRepeat}
        >
          <ArrowDown className="h-4 w-4" />
        </Key>
        <Key
          ariaLabel="Arrow Right"
          onPressStart={() => startRepeat("ArrowRight")}
          onPressEnd={stopRepeat}
        >
          <ArrowRight className="h-4 w-4" />
        </Key>
        <Key label="Home" onPress={() => sendSpecial("Home")} />
        <Key label="End" onPress={() => sendSpecial("End")} />
        <Key label="PgUp" onPress={() => sendSpecial("PgUp")} />
        <Key label="PgDn" onPress={() => sendSpecial("PgDn")} />
      </div>
    </div>
  );
}
