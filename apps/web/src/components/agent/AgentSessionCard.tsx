'use client';

import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { AgentStateIndicator } from './AgentStateIndicator';
import type { AgentSession } from '@/types/agent';

interface AgentSessionCardProps {
  session: AgentSession;
  onClick: () => void;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AgentSessionCard({ session, onClick }: AgentSessionCardProps) {
  return (
    <Link href={`/session/${session.id}`} onClick={onClick} className="block">
      <Card className="bg-[#131316] border-zinc-800 rounded-xl p-4 flex flex-col gap-3 active:scale-[0.98] transition-transform cursor-pointer hover:border-zinc-700 min-h-[44px]">
        {/* Top row: agent name + state */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-zinc-50 truncate">{session.agentName}</span>
          <AgentStateIndicator state={session.agentState} size="sm" />
        </div>

        {/* Last output preview */}
        {session.lastOutput && (
          <p className="text-[11px] font-mono text-zinc-500 leading-relaxed line-clamp-2 break-all">
            {session.lastOutput}
          </p>
        )}

        {/* Footer row: machine + time */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-600">
            <MapPin className="h-2.5 w-2.5" />
            {session.machineName}
          </span>
          <span className="text-[10px] text-zinc-600">{timeAgo(session.lastActivity)}</span>
        </div>
      </Card>
    </Link>
  );
}
