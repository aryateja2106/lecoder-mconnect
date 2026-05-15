"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { SessionHeader, type ConnectionState } from "./SessionHeader";
import { FloatingControlPill } from "./FloatingControlPill";
import { HardwareKeyToolbar } from "./HardwareKeyToolbar";
import { useVisualViewport } from "@/hooks/useVisualViewport";

export interface MobileTerminalShellProps {
  /** xterm.js host (or any terminal renderer) — passed as children so the
   *  shell stays renderer-agnostic. */
  children: ReactNode;

  sessionTitle: string;
  connectionState: ConnectionState;

  onBack: () => void;
  onTapSession: () => void;

  /** Send raw bytes/escape sequences into the active PTY. */
  onSend: (data: string) => void;

  /** Two-finger tap on the terminal body opens the agent action sheet. */
  onAgentSheet?: () => void;
}

/**
 * Outer chrome for the mobile terminal. Owns:
 *   - safe-area / visual-viewport math
 *   - sticky header (back + session pill + connection pill)
 *   - floating control pill (auto-hides after 3s of input inactivity)
 *   - two-row hardware-key toolbar above the soft keyboard
 *   - two-finger-tap quick action gesture on the body
 *
 * The terminal renderer (xterm.js) is injected via children so this component
 * stays decoupled from any one library.
 */
export function MobileTerminalShell({
  children,
  sessionTitle,
  connectionState,
  onBack,
  onTapSession,
  onSend,
  onAgentSheet,
}: MobileTerminalShellProps) {
  const { keyboardOffset, keyboardOpen } = useVisualViewport();
  const [pillVisible, setPillVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide the control pill after 3 s of input inactivity, but stay
  // visible while the soft keyboard is up (user is mid-typing).
  const armAutoHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (keyboardOpen) return;
    hideTimer.current = setTimeout(() => setPillVisible(false), 3000);
  }, [keyboardOpen]);

  useEffect(() => {
    armAutoHide();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [armAutoHide]);

  const wrappedSend = useCallback(
    (data: string) => {
      setPillVisible(true);
      armAutoHide();
      onSend(data);
    },
    [armAutoHide, onSend],
  );

  // Two-finger tap gesture handler — uses native touch events so we can count
  // distinct finger touches (PointerEvent.pointerId tracking).
  const lastTwoFingerTap = useRef(0);
  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.changedTouches.length === 2 || e.touches.length === 1 /* one already lifted */) {
        const now = Date.now();
        if (now - lastTwoFingerTap.current < 350) {
          onAgentSheet?.();
          lastTwoFingerTap.current = 0;
        } else {
          lastTwoFingerTap.current = now;
        }
      }
    },
    [onAgentSheet],
  );

  const handleBodyTap = useCallback(() => {
    setPillVisible((v) => !v);
    armAutoHide();
  }, [armAutoHide]);

  return (
    <div className="mconnect-terminal-host fixed inset-0 flex flex-col">
      <SessionHeader
        sessionTitle={sessionTitle}
        connectionState={connectionState}
        onBack={onBack}
        onTapSession={onTapSession}
      />

      <div
        className="relative flex-1 overflow-hidden"
        onClick={handleBodyTap}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>

      <FloatingControlPill
        visible={pillVisible}
        bottomOffsetPx={keyboardOffset}
        onToggleKeyboard={() => {
          // Re-focus the hidden input owned by the renderer; xterm.js
          // creates its own textarea, so a click on the children area
          // typically already focuses. This button is a fallback.
          const textarea = document.querySelector<HTMLTextAreaElement>(".xterm-helper-textarea");
          textarea?.focus();
          setPillVisible(true);
          armAutoHide();
        }}
        onMic={() => {
          // Voice dictation hook-in. Stub for now — emit a custom event so
          // parents that opt in can wire up Web Speech API or a server-side
          // ASR pipeline without changing this component.
          window.dispatchEvent(new CustomEvent("mconnect:dictation:start"));
        }}
        onAI={() => onAgentSheet?.()}
        onSettings={() => window.dispatchEvent(new CustomEvent("mconnect:settings:open"))}
        onDismiss={() => setPillVisible(false)}
      />

      <HardwareKeyToolbar onSend={wrappedSend} bottomOffsetPx={keyboardOffset} />
    </div>
  );
}
