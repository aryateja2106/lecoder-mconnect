"use client";

import { Mic, Keyboard, Sparkles, SlidersHorizontal, X } from "lucide-react";

export interface FloatingControlPillProps {
  visible: boolean;
  onMic?: () => void;
  onToggleKeyboard?: () => void;
  onAI?: () => void;
  onSettings?: () => void;
  onDismiss?: () => void;
  /**
   * Number of pixels the soft keyboard is occupying. We float just above it.
   */
  bottomOffsetPx: number;
}

const buttonClass =
  "flex h-9 w-9 items-center justify-center rounded-full text-white/90 active:bg-white/15 active:scale-95 transition";

/**
 * Translucent pill of quick controls — mic, keyboard toggle, AI sheet,
 * settings, dismiss. Centered above the keyboard. Auto-hide is owned by the
 * parent (so input arbitration can reset the timer cleanly).
 */
export function FloatingControlPill({
  visible,
  onMic,
  onToggleKeyboard,
  onAI,
  onSettings,
  onDismiss,
  bottomOffsetPx,
}: FloatingControlPillProps) {
  if (!visible) return null;

  return (
    <div
      role="toolbar"
      aria-label="Session quick controls"
      className="mconnect-pill pointer-events-auto fixed left-1/2 z-30 -translate-x-1/2 px-2 py-1.5"
      style={{
        bottom: `calc(${bottomOffsetPx}px + env(safe-area-inset-bottom, 0) + var(--hardware-key-toolbar) + 12px)`,
      }}
    >
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Voice dictation" className={buttonClass} onClick={onMic}>
          <Mic className="h-4.5 w-4.5" />
        </button>
        <button type="button" aria-label="Toggle keyboard" className={buttonClass} onClick={onToggleKeyboard}>
          <Keyboard className="h-4.5 w-4.5" />
        </button>
        <button type="button" aria-label="Quick agent actions" className={buttonClass} onClick={onAI}>
          <Sparkles className="h-4.5 w-4.5" />
        </button>
        <button type="button" aria-label="Session settings" className={buttonClass} onClick={onSettings}>
          <SlidersHorizontal className="h-4.5 w-4.5" />
        </button>
        <button type="button" aria-label="Dismiss controls" className={buttonClass} onClick={onDismiss}>
          <X className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
  );
}
