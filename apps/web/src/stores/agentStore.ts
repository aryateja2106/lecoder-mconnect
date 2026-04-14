'use client';

import { create } from 'zustand';
import type { AgentSession, AgentState, ConnectionStatus, Machine, ApprovalRequest } from '@/types/agent';

interface AgentStore {
  // State
  machines: Machine[];
  sessions: AgentSession[];
  activeSessionId: string | null;
  wsStatus: ConnectionStatus;
  agentState: AgentState;
  pendingApproval: ApprovalRequest | null;

  // Stats
  totalCommandsExecuted: number;
  uptimeStart: number | null;

  // Actions
  setMachines: (machines: Machine[]) => void;
  setSessions: (sessions: AgentSession[]) => void;
  addSession: (session: AgentSession) => void;
  updateSession: (id: string, updates: Partial<AgentSession>) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  setWsStatus: (status: ConnectionStatus) => void;
  setAgentState: (state: AgentState) => void;
  setPendingApproval: (approval: ApprovalRequest | null) => void;
  incrementCommands: () => void;
  setUptimeStart: (timestamp: number | null) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  // Initial state
  machines: [],
  sessions: [],
  activeSessionId: null,
  wsStatus: 'idle',
  agentState: 'idle',
  pendingApproval: null,
  totalCommandsExecuted: 0,
  uptimeStart: null,

  // Actions
  setMachines: (machines) => set({ machines }),
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) =>
    set((state) => ({ sessions: [...state.sessions, session] })),
  updateSession: (id, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),
  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
    })),
  setActiveSession: (id) => set({ activeSessionId: id }),
  setWsStatus: (status) => set({ wsStatus: status }),
  setAgentState: (state) => set({ agentState: state }),
  setPendingApproval: (approval) => set({ pendingApproval: approval }),
  incrementCommands: () =>
    set((state) => ({ totalCommandsExecuted: state.totalCommandsExecuted + 1 })),
  setUptimeStart: (timestamp) => set({ uptimeStart: timestamp }),
}));
