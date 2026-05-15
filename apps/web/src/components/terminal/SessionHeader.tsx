"use client";

import { ChevronDown, ChevronLeft } from "lucide-react";

export type ConnectionState = "connected" | "reconnecting" | "disconnected";

export interface SessionHeaderProps {
  sessionTitle: string;
  connectionState: ConnectionState;
  onBack: () => void;
  onTapSession: () => void;
}

/**
 * Sticky top bar overlaying the terminal body. White pill chips on dark
 * background — matches the iOS design exactly.
 */
export function SessionHeader({
  sessionTitle,
  connectionState,
  onBack,
  onTapSession,
}: SessionHeaderProps) {
  const statusLabel =
    connectionState === "connected"
      ? "Connected"
      : connectionState === "reconnecting"
        ? "Reconnecting"
        : "Disconnected";

  return (
    <header
      className="safe-area-inset-top relative z-20 flex items-center justify-between gap-3 px-3 pb-3 pt-2"
      style={{ minHeight: `calc(env(safe-area-inset-top, 0) + var(--header-height))` }}
    >
      <button
        type="button"
        aria-label="Back to machines"
        onClick={onBack}
        className="mconnect-chip h-9 w-9 justify-center !p-0"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <button
        type="button"
        aria-label={`Session ${sessionTitle}, tap to switch`}
        onClick={onTapSession}
        className="mconnect-chip"
      >
        <span className="mconnect-status-dot" data-state="connected" aria-hidden />
        <span>{sessionTitle}</span>
        <ChevronDown className="h-4 w-4 -mr-0.5" />
      </button>

      <div
        role="status"
        aria-live="polite"
        className="mconnect-chip"
        title={statusLabel}
      >
        <span className="mconnect-status-dot" data-state={connectionState} aria-hidden />
        <span>{statusLabel}</span>
      </div>
    </header>
  );
}
