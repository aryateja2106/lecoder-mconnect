'use client';

import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VoxInteraction } from '@/types/agent';

interface VoxHistoryItemProps {
  interaction: VoxInteraction;
}

function timeAgo(timestamp: number): string {
  const delta = Math.floor((Date.now() - timestamp) / 1000);
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

const ACTION_STYLES: Record<VoxInteraction['userAction'], { label: string; className: string }> = {
  accept: {
    label: 'Accepted',
    className: 'bg-[var(--agent-success)]/10 text-[var(--agent-success)] border border-[var(--agent-success)]/20',
  },
  edit: {
    label: 'Edited',
    className: 'bg-[var(--agent-warning)]/10 text-[var(--agent-warning)] border border-[var(--agent-warning)]/20',
  },
  reject: {
    label: 'Rejected',
    className: 'bg-[var(--agent-error)]/10 text-[var(--agent-error)] border border-[var(--agent-error)]/20',
  },
  error: {
    label: 'Error',
    className: 'bg-zinc-800 text-zinc-500 border border-zinc-700',
  },
};

export function VoxHistoryItem({ interaction }: VoxHistoryItemProps) {
  const action = ACTION_STYLES[interaction.userAction];

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-zinc-800 hover:border-zinc-700 transition-colors">
      {/* Query + action + time */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-[var(--text-primary)] leading-snug flex-1 min-w-0 truncate">
          {interaction.query}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', action.className)}>
            {action.label}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">
            {timeAgo(interaction.timestamp)}
          </span>
        </div>
      </div>

      {/* Suggested command */}
      <p className="font-mono text-[11px] text-[var(--agent-active)] bg-zinc-900 rounded px-2 py-1 truncate">
        $ {interaction.suggestedCommand}
      </p>

      {/* Edited diff — only when edited */}
      {interaction.userAction === 'edit' && interaction.editedCommand && (
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-zinc-600 line-through truncate flex-1 min-w-0">
            {interaction.suggestedCommand}
          </span>
          <ArrowRight size={10} className="text-[var(--agent-warning)] shrink-0" />
          <span className="text-[var(--agent-warning)] truncate flex-1 min-w-0">
            {interaction.editedCommand}
          </span>
        </div>
      )}
    </div>
  );
}
