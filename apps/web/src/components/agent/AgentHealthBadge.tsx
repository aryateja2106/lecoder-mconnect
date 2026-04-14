'use client';

import { cn } from '@/lib/utils';

interface AgentHealthBadgeProps {
  name: string;
  installed: boolean;
}

export function AgentHealthBadge({ name, installed }: AgentHealthBadgeProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium',
        installed
          ? 'bg-[var(--agent-success)]/10 border-[var(--agent-success)]/20 text-[var(--agent-success)]'
          : 'bg-zinc-800/60 border-zinc-700/50 text-zinc-500'
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          installed ? 'bg-[var(--agent-success)]' : 'bg-zinc-600'
        )}
      />
      <span className="text-[var(--text-secondary)]">{name}</span>
      <span className={installed ? 'text-[var(--agent-success)]' : 'text-zinc-600'}>
        {installed ? 'Installed' : 'Not found'}
      </span>
    </div>
  );
}
