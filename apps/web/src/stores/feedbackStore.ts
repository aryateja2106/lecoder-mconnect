'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VoxInteraction } from '@/types/agent';

interface DataPoint {
  date: string;
  accuracy: number;
  total: number;
}

interface FeedbackStore {
  // State
  interactions: VoxInteraction[];
  accuracyByDay: DataPoint[];
  totalCorrections: number;

  // Actions
  recordInteraction: (interaction: VoxInteraction) => void;
  getAccuracy: () => number;
  exportCorrections: () => string;
  clearAll: () => void;
}

export const useFeedbackStore = create<FeedbackStore>()(
  persist(
    (set, get) => ({
      interactions: [],
      accuracyByDay: [],
      totalCorrections: 0,

      recordInteraction: (interaction) =>
        set((state) => {
          const interactions = [interaction, ...state.interactions].slice(0, 500);
          const isCorrection = interaction.userAction === 'edit';
          const totalCorrections = state.totalCorrections + (isCorrection ? 1 : 0);

          // Update accuracy by day
          const today = new Date().toISOString().slice(0, 10);
          const acceptCount = interactions.filter(
            (i) => i.userAction === 'accept' && i.timestamp > Date.now() - 86400000
          ).length;
          const todayTotal = interactions.filter(
            (i) => i.timestamp > Date.now() - 86400000
          ).length;

          const accuracyByDay = [...state.accuracyByDay];
          const todayIdx = accuracyByDay.findIndex((d) => d.date === today);
          const todayData = {
            date: today,
            accuracy: todayTotal > 0 ? Math.round((acceptCount / todayTotal) * 100) : 0,
            total: todayTotal,
          };

          if (todayIdx >= 0) {
            accuracyByDay[todayIdx] = todayData;
          } else {
            accuracyByDay.push(todayData);
          }

          return { interactions, totalCorrections, accuracyByDay: accuracyByDay.slice(-30) };
        }),

      getAccuracy: () => {
        const { interactions } = get();
        if (interactions.length === 0) return 0;
        const accepted = interactions.filter((i) => i.userAction === 'accept').length;
        return Math.round((accepted / interactions.length) * 100);
      },

      exportCorrections: () => {
        const { interactions } = get();
        const corrections = interactions
          .filter((i) => i.userAction === 'edit' && i.editedCommand)
          .map((i) => ({
            query: i.query,
            original: i.suggestedCommand,
            corrected: i.editedCommand,
            timestamp: new Date(i.timestamp).toISOString(),
          }));
        return JSON.stringify(corrections, null, 2);
      },

      clearAll: () => set({ interactions: [], accuracyByDay: [], totalCorrections: 0 }),
    }),
    {
      name: 'mconnect-feedback',
      partialize: (state) => ({
        interactions: state.interactions.slice(0, 200),
        accuracyByDay: state.accuracyByDay,
        totalCorrections: state.totalCorrections,
      }),
    }
  )
);
