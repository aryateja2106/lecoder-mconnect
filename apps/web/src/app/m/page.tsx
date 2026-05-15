"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MobileTerminalShell } from "@/components/terminal/MobileTerminalShell";
import type { ConnectionState } from "@/components/terminal/SessionHeader";

const TerminalView = dynamic(
  () => import("@/components/terminal/TerminalView"),
  { ssr: false, loading: () => <div className="flex-1 bg-black" /> },
);

/**
 * Standalone preview route for the iOS-first mobile terminal at /m.
 * Wires the new chrome (SessionHeader / FloatingControlPill / HardwareKeyToolbar)
 * around the existing xterm.js renderer with no real WebSocket attached —
 * use it on a phone to design-review the look and the keyboard interactions
 * without spinning up the daemon.
 *
 * In production, mount MobileTerminalShell from your real session page and
 * swap the `onSend` / `connectionState` props to your useWebSocket hook.
 */
export default function MobileTerminalPreviewPage() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connected");
  const writeRef = useRef<((s: string) => void) | null>(null);

  // Demo: simulate a brief reconnect 4 s after mount so the amber pulse is
  // visible during design review.
  useEffect(() => {
    const t1 = setTimeout(() => setConnectionState("reconnecting"), 4000);
    const t2 = setTimeout(() => setConnectionState("connected"), 5500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Bridge keystrokes from the hardware-key bar back into the terminal.
  // TerminalView publishes a global window.mconnectTerminal helper today
  // (see src/components/terminal/TerminalView.tsx). We use that here.
  useEffect(() => {
    const w = window as unknown as { mconnectTerminal?: { write: (s: string) => void } };
    writeRef.current = (s) => w.mconnectTerminal?.write(s);
  }, []);

  const onSend = (data: string) => {
    writeRef.current?.(data);
  };

  return (
    <MobileTerminalShell
      sessionTitle="Shell"
      connectionState={connectionState}
      onBack={() => history.back()}
      onTapSession={() => alert("Session switcher — wire this up to your session list")}
      onSend={onSend}
      onAgentSheet={() => alert("Quick agent actions — Run, Stop, Resume…")}
    >
      <TerminalView onData={onSend} isReadOnly={false} />
    </MobileTerminalShell>
  );
}
