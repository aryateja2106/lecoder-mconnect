'use client';

import { useEffect, useCallback } from 'react';
import { Terminal } from 'lucide-react';
import { BottomNav } from './BottomNav';
import { VoxPanelView } from '@/components/views/VoxPanelView';
import { useVoxStore } from '@/stores/voxStore';

export function PageShell({ children }: { children: React.ReactNode }) {
  const { isOpen: voxOpen, toggle: toggleVox, close: closeVox } = useVoxStore();

  // Cmd+K / Ctrl+K keyboard shortcut
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleVox();
      }
      if (e.key === 'Escape' && voxOpen) {
        closeVox();
      }
    },
    [toggleVox, closeVox, voxOpen]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 bg-zinc-900/95 backdrop-blur-lg border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--agent-active)]/10 border border-[var(--agent-active)]/20 flex items-center justify-center">
            <Terminal size={14} className="text-[var(--agent-active)]" />
          </div>
          <span className="font-bold text-white text-sm tracking-tight">MConnect</span>
        </div>

        <button
          onClick={toggleVox}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-xs text-zinc-400 transition-colors"
        >
          <span>Ask Vox</span>
          <kbd className="text-[10px] bg-zinc-700 px-1 rounded">⌘K</kbd>
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-16 overflow-auto">
        {children}
      </main>

      {/* Bottom navigation */}
      <BottomNav />

      {/* Vox Panel Overlay */}
      {voxOpen && <VoxPanelView />}
    </div>
  );
}
