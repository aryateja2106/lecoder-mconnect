'use client';

/**
 * Client-side session state management
 * MConnect v0.2.0
 *
 * Stores session state locally for offline support and quick reconnection
 */

import { useState, useCallback, useEffect } from 'react';

export interface StoredSession {
  id: string;
  lastAttached: number;
  scrollbackPosition: number;
  workingDirectory?: string;
}

interface SessionStoreState {
  currentSessionId: string | null;
  sessions: StoredSession[];
  isReconnecting: boolean;
  lastScrollPosition: number;
}

interface UseSessionStoreReturn {
  state: SessionStoreState;
  setCurrentSession: (sessionId: string | null) => void;
  updateSession: (session: Partial<StoredSession> & { id: string }) => void;
  removeSession: (sessionId: string) => void;
  setReconnecting: (reconnecting: boolean) => void;
  setScrollPosition: (position: number) => void;
  getSession: (sessionId: string) => StoredSession | undefined;
  clearSessions: () => void;
}

const STORAGE_KEY = 'mconnect_session_store';

const initialState: SessionStoreState = {
  currentSessionId: null,
  sessions: [],
  isReconnecting: false,
  lastScrollPosition: 0,
};

function loadState(): SessionStoreState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...initialState,
        ...parsed,
        isReconnecting: false, // Always start fresh
      };
    }
  } catch (e) {
    console.error('Failed to load session store:', e);
  }
  return initialState;
}

function saveState(state: SessionStoreState): void {
  try {
    // Only persist certain fields
    const toStore = {
      currentSessionId: state.currentSessionId,
      sessions: state.sessions,
      lastScrollPosition: state.lastScrollPosition,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch (e) {
    console.error('Failed to save session store:', e);
  }
}

export function useSessionStore(): UseSessionStoreReturn {
  const [state, setState] = useState<SessionStoreState>(initialState);

  // Load from localStorage on mount
  useEffect(() => {
    setState(loadState());
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  const setCurrentSession = useCallback((sessionId: string | null) => {
    setState((prev) => ({
      ...prev,
      currentSessionId: sessionId,
    }));
  }, []);

  const updateSession = useCallback((session: Partial<StoredSession> & { id: string }) => {
    setState((prev) => {
      const existingIndex = prev.sessions.findIndex((s) => s.id === session.id);

      if (existingIndex >= 0) {
        // Update existing
        const updated = [...prev.sessions];
        updated[existingIndex] = { ...updated[existingIndex], ...session };
        return { ...prev, sessions: updated };
      } else {
        // Add new
        const newSession: StoredSession = {
          id: session.id,
          lastAttached: session.lastAttached ?? Date.now(),
          scrollbackPosition: session.scrollbackPosition ?? 0,
          workingDirectory: session.workingDirectory,
        };
        return { ...prev, sessions: [...prev.sessions, newSession] };
      }
    });
  }, []);

  const removeSession = useCallback((sessionId: string) => {
    setState((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((s) => s.id !== sessionId),
      currentSessionId: prev.currentSessionId === sessionId ? null : prev.currentSessionId,
    }));
  }, []);

  const setReconnecting = useCallback((reconnecting: boolean) => {
    setState((prev) => ({
      ...prev,
      isReconnecting: reconnecting,
    }));
  }, []);

  const setScrollPosition = useCallback((position: number) => {
    setState((prev) => ({
      ...prev,
      lastScrollPosition: position,
    }));
  }, []);

  const getSession = useCallback(
    (sessionId: string): StoredSession | undefined => {
      return state.sessions.find((s) => s.id === sessionId);
    },
    [state.sessions]
  );

  const clearSessions = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    state,
    setCurrentSession,
    updateSession,
    removeSession,
    setReconnecting,
    setScrollPosition,
    getSession,
    clearSessions,
  };
}

export default useSessionStore;
