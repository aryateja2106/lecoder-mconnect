'use client';

import { StatusDot } from '@/components/status/StatusDot';
import { cn } from '@/lib/utils';
import type { AgentState } from '@/types/agent';

interface AgentStateIndicatorProps {
  state: AgentState;
  size?: 'sm' | 'md' | 'lg';
}

const labelMap: Record<AgentState, string> = {
  idle: 'Idle',
  connecting: 'Connecting',
  thinking: 'Thinking',
  executing: 'Executing',
  error: 'Error',
};

const textColorMap: Record<AgentState, string> = {
  idle: 'text-zinc-500',
  connecting: 'text-[#1FD5F9]',
  thinking: 'text-[#1FD5F9]',
  executing: 'text-green-400',
  error: 'text-red-400',
};

const textSizeMap = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
};

export function AgentStateIndicator({ state, size = 'md' }: AgentStateIndicatorProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot state={state} size={size} />
      <span className={cn('font-medium', textSizeMap[size], textColorMap[state])}>
        {labelMap[state]}
      </span>
    </span>
  );
}
