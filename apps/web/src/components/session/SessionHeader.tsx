'use client';

import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AgentState } from '@/types/agent';

interface SessionHeaderProps {
  sessionId: string;
  agentName?: string;
  agentState: AgentState;
  onBack: () => void;
}

function agentStateBadgeVariant(
  state: AgentState
): 'secondary' | 'success' | 'warning' | 'destructive' | 'info' {
  switch (state) {
    case 'idle':
      return 'secondary';
    case 'connecting':
      return 'info';
    case 'thinking':
      return 'warning';
    case 'executing':
      return 'success';
    case 'error':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function agentStateLabel(state: AgentState): string {
  switch (state) {
    case 'idle':
      return 'Idle';
    case 'connecting':
      return 'Connecting';
    case 'thinking':
      return 'Thinking';
    case 'executing':
      return 'Executing';
    case 'error':
      return 'Error';
    default:
      return state;
  }
}

export function SessionHeader({
  sessionId,
  agentName,
  agentState,
  onBack,
}: SessionHeaderProps) {
  const shortId = sessionId.length > 8 ? `${sessionId.slice(0, 8)}…` : sessionId;

  return (
    <header
      className={cn(
        'flex h-12 items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3',
        'shrink-0'
      )}
    >
      {/* Left: back button + session ID */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back to dashboard"
          className="h-11 w-11 shrink-0 text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="font-mono text-xs text-zinc-500 tabular-nums">{shortId}</span>
      </div>

      {/* Center: agent name */}
      <div className="flex min-w-0 flex-1 justify-center">
        {agentName && (
          <span className="truncate text-sm font-medium text-zinc-100">{agentName}</span>
        )}
      </div>

      {/* Right: state badge */}
      <div className="flex min-w-0 flex-1 justify-end">
        <Badge
          variant={agentStateBadgeVariant(agentState)}
          className={cn(
            'shrink-0 capitalize',
            agentState === 'executing' && 'animate-pulse'
          )}
        >
          {agentStateLabel(agentState)}
        </Badge>
      </div>
    </header>
  );
}

export default SessionHeader;
