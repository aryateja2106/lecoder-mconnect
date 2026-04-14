'use client';

import { Apple, Monitor, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Machine } from '@/types/agent';

interface MachineCardProps {
  machine: Machine;
}

function OsIcon({ os }: { os: Machine['os'] }) {
  const cls = 'h-4 w-4 shrink-0';
  if (os === 'macos') return <Apple className={cls} />;
  if (os === 'windows') return <Monitor className={cls} />;
  return <Server className={cls} />;
}

export function MachineCard({ machine }: MachineCardProps) {
  return (
    <Card className="bg-[#131316] border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-zinc-400">
            <OsIcon os={machine.os} />
          </span>
          <span className="text-sm font-medium text-zinc-50 truncate">{machine.name}</span>
        </div>

        {/* Online indicator */}
        <span
          className={cn(
            'h-2 w-2 rounded-full shrink-0 mt-0.5',
            machine.online ? 'bg-green-500' : 'bg-zinc-500'
          )}
        />
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-500">
          {machine.online ? 'Online' : 'Offline'}
        </span>
        <Badge variant="secondary" className="text-[10px] px-2 py-0">
          {machine.agentCount} {machine.agentCount === 1 ? 'agent' : 'agents'}
        </Badge>
      </div>

      {/* IP if present */}
      {machine.ip && (
        <span className="text-[10px] font-mono text-zinc-600 truncate">{machine.ip}</span>
      )}
    </Card>
  );
}
