'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { AgentState } from '@/types/agent';

interface StatusDotProps {
  state: AgentState;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
};

const colorMap: Record<AgentState, string> = {
  idle: '#71717A',
  connecting: '#1FD5F9',
  thinking: '#1FD5F9',
  executing: '#22C55E',
  error: '#EF4444',
};

export function StatusDot({ state, size = 'md' }: StatusDotProps) {
  const color = colorMap[state];
  const sizeClass = sizeMap[size];

  if (state === 'idle' || state === 'error') {
    return (
      <span
        className={cn('rounded-full shrink-0 inline-block', sizeClass)}
        style={{ backgroundColor: color }}
      />
    );
  }

  if (state === 'connecting') {
    return (
      <motion.span
        className={cn('rounded-full shrink-0 inline-block', sizeClass)}
        style={{ backgroundColor: color }}
        animate={{
          scale: [0.8, 1.2, 0.8],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    );
  }

  if (state === 'thinking') {
    return (
      <span className={cn('relative inline-flex shrink-0 items-center justify-center', sizeClass)}>
        <motion.span
          className="absolute inset-0 rounded-full border"
          style={{ borderColor: color }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />
        <span
          className="rounded-full"
          style={{
            backgroundColor: color,
            width: '55%',
            height: '55%',
          }}
        />
      </span>
    );
  }

  if (state === 'executing') {
    return (
      <motion.span
        className={cn('rounded-full shrink-0 inline-block', sizeClass)}
        style={{ backgroundColor: color }}
        animate={{ scale: [0.9, 1.1, 0.9] }}
        transition={{
          duration: 0.4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    );
  }

  return (
    <span
      className={cn('rounded-full shrink-0 inline-block', sizeClass)}
      style={{ backgroundColor: color }}
    />
  );
}
