'use client';

/**
 * Demo Context Provider
 *
 * Manages demo mode state for the MConnect web app, including
 * MockWebSocket lifecycle, playback controls, and session management.
 *
 * MConnect v0.2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  MockWebSocket,
  createMockWebSocket,
  isDemoModeEnabled,
  type PlaybackState,
  type MockWebSocketOptions,
} from '../lib/mock-websocket';
import { type DemoSession, getAllDemoSessions, getDefaultDemoSession } from '../data/demo-session';

// ============================================
// Types
// ============================================

export interface DemoContextValue {
  /** Whether demo mode is enabled */
  isDemoMode: boolean;
  /** Current playback state */
  playbackState: PlaybackState;
  /** Current timestamp in milliseconds */
  currentTimestamp: number;
  /** Total duration of current session in milliseconds */
  totalDuration: number;
  /** Progress as a percentage (0-100) */
  progress: number;
  /** All available demo sessions */
  sessions: DemoSession[];
  /** Currently active session ID */
  activeSessionId: string;
  /** Current session data */
  currentSession: DemoSession | null;
  /** Whether there's a pending approval */
  hasPendingApproval: boolean;
  /** Pending approval details */
  pendingApproval: { command: string; reason: string } | null;

  // Control functions
  /** Start or resume playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Restart playback from beginning */
  restart: () => void;
  /** Seek to a specific timestamp */
  seek: (timestamp: number) => void;
  /** Switch to a different demo session */
  switchSession: (sessionId: string) => void;
  /** Respond to an approval request */
  respondToApproval: (approved: boolean) => void;

  // MockWebSocket access for integration
  /** Get the MockWebSocket instance (for direct integration) */
  getWebSocket: () => MockWebSocket | null;
  /** Connect the MockWebSocket */
  connect: () => void;
  /** Disconnect the MockWebSocket */
  disconnect: () => void;
}

// Default context value for non-demo mode
const defaultContextValue: DemoContextValue = {
  isDemoMode: false,
  playbackState: 'stopped',
  currentTimestamp: 0,
  totalDuration: 0,
  progress: 0,
  sessions: [],
  activeSessionId: '',
  currentSession: null,
  hasPendingApproval: false,
  pendingApproval: null,
  play: () => {},
  pause: () => {},
  restart: () => {},
  seek: () => {},
  switchSession: () => {},
  respondToApproval: () => {},
  getWebSocket: () => null,
  connect: () => {},
  disconnect: () => {},
};

// ============================================
// Context
// ============================================

const DemoContext = createContext<DemoContextValue>(defaultContextValue);

// ============================================
// Provider Component
// ============================================

export interface DemoProviderProps {
  children: React.ReactNode;
  /** Override demo mode detection (for testing) */
  forceEnabled?: boolean;
  /** Custom MockWebSocket options */
  options?: MockWebSocketOptions;
}

export function DemoProvider({ children, forceEnabled, options }: DemoProviderProps) {
  const isDemo = forceEnabled ?? isDemoModeEnabled();

  // If not in demo mode, provide default context
  if (!isDemo) {
    return (
      <DemoContext.Provider value={defaultContextValue}>
        {children}
      </DemoContext.Provider>
    );
  }

  // Render the actual demo provider
  return (
    <DemoProviderInner options={options}>
      {children}
    </DemoProviderInner>
  );
}

// Inner provider that only mounts when demo mode is enabled
function DemoProviderInner({
  children,
  options,
}: {
  children: React.ReactNode;
  options?: MockWebSocketOptions;
}) {
  // MockWebSocket instance ref
  const wsRef = useRef<MockWebSocket | null>(null);

  // State
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState(getDefaultDemoSession().id);
  const [pendingApproval, setPendingApproval] = useState<{ command: string; reason: string } | null>(null);

  // Get sessions and current session
  const sessions = useMemo(() => getAllDemoSessions(), []);
  const currentSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId]
  );
  const totalDuration = currentSession?.duration ?? 0;

  // Calculate progress
  const progress = totalDuration > 0 ? (currentTimestamp / totalDuration) * 100 : 0;

  // Update timestamp periodically during playback
  useEffect(() => {
    if (playbackState !== 'playing' || !wsRef.current) {
      return;
    }

    const interval = setInterval(() => {
      if (wsRef.current) {
        setCurrentTimestamp(wsRef.current.getCurrentTimestamp());
      }
    }, 100);

    return () => clearInterval(interval);
  }, [playbackState]);

  // Handle approval request from MockWebSocket
  const handleApprovalRequest = useCallback((command: string, reason: string) => {
    setPendingApproval({ command, reason });
    setPlaybackState('paused');
  }, []);

  // Initialize MockWebSocket
  const initWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = createMockWebSocket({
      ...options,
      initialSessionId: activeSessionId,
      onApprovalRequest: handleApprovalRequest,
    });

    wsRef.current = ws;
    return ws;
  }, [options, activeSessionId, handleApprovalRequest]);

  // Control functions
  const connect = useCallback(() => {
    const ws = wsRef.current ?? initWebSocket();
    ws.connect();
    setPlaybackState('playing');
  }, [initWebSocket]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setPlaybackState('stopped');
    setCurrentTimestamp(0);
    setPendingApproval(null);
  }, []);

  const play = useCallback(() => {
    if (!wsRef.current) {
      connect();
      return;
    }

    if (wsRef.current.getPlaybackState() === 'paused') {
      wsRef.current.resume();
    } else if (wsRef.current.getPlaybackState() === 'stopped') {
      wsRef.current.restart();
    }
    setPlaybackState('playing');
  }, [connect]);

  const pause = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.pause();
    }
    setPlaybackState('paused');
  }, []);

  const restart = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.restart();
      setCurrentTimestamp(0);
      setPendingApproval(null);
      setPlaybackState('playing');
    } else {
      connect();
    }
  }, [connect]);

  const seek = useCallback((timestamp: number) => {
    if (wsRef.current) {
      wsRef.current.seek(timestamp);
      setCurrentTimestamp(timestamp);
    }
  }, []);

  const switchSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setPendingApproval(null);
    setCurrentTimestamp(0);

    if (wsRef.current) {
      wsRef.current.switchSession(sessionId);
      setPlaybackState('playing');
    }
  }, []);

  const respondToApproval = useCallback((approved: boolean) => {
    if (!wsRef.current || !pendingApproval) {
      return;
    }

    // Send approval response through the MockWebSocket
    wsRef.current.send(
      JSON.stringify({
        type: 'approval_response',
        approved,
        command: pendingApproval.command,
      })
    );

    setPendingApproval(null);

    // Resume playback if approved
    if (approved) {
      setPlaybackState('playing');
    }
  }, [pendingApproval]);

  const getWebSocket = useCallback(() => wsRef.current, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Context value
  const value: DemoContextValue = useMemo(
    () => ({
      isDemoMode: true,
      playbackState,
      currentTimestamp,
      totalDuration,
      progress,
      sessions,
      activeSessionId,
      currentSession,
      hasPendingApproval: pendingApproval !== null,
      pendingApproval,
      play,
      pause,
      restart,
      seek,
      switchSession,
      respondToApproval,
      getWebSocket,
      connect,
      disconnect,
    }),
    [
      playbackState,
      currentTimestamp,
      totalDuration,
      progress,
      sessions,
      activeSessionId,
      currentSession,
      pendingApproval,
      play,
      pause,
      restart,
      seek,
      switchSession,
      respondToApproval,
      getWebSocket,
      connect,
      disconnect,
    ]
  );

  return (
    <DemoContext.Provider value={value}>
      {children}
    </DemoContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

/**
 * Hook to access demo mode context.
 *
 * @returns DemoContextValue with demo state and controls
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isDemoMode, play, pause, restart } = useDemoContext();
 *
 *   if (!isDemoMode) return null;
 *
 *   return (
 *     <div>
 *       <button onClick={play}>Play</button>
 *       <button onClick={pause}>Pause</button>
 *       <button onClick={restart}>Restart</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDemoContext(): DemoContextValue {
  const context = useContext(DemoContext);
  return context;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if demo mode is enabled via environment variable.
 * Re-exported from mock-websocket for convenience.
 */
export { isDemoModeEnabled };

/**
 * Format time in mm:ss format
 */
export function formatDemoTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
