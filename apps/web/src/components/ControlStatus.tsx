'use client';

import { Monitor, Smartphone, Wifi, WifiOff, Clock } from 'lucide-react';
import type { ArbiterState } from '../hooks/useControlState';

interface ControlStatusProps {
  state: ArbiterState;
  activeClient?: string;
  exclusiveTimeRemaining?: number;
  className?: string;
}

function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function ControlStatus({
  state,
  activeClient,
  exclusiveTimeRemaining,
  className = '',
}: ControlStatusProps) {
  const getStatusConfig = () => {
    switch (state) {
      case 'pc_active':
        return {
          icon: <Monitor size={16} />,
          label: 'PC Active',
          color: 'bg-green-500',
          textColor: 'text-green-400',
          description: 'PC has control',
        };
      case 'pc_idle':
        return {
          icon: <Monitor size={16} />,
          label: 'PC Idle',
          color: 'bg-yellow-500',
          textColor: 'text-yellow-400',
          description: 'You can type',
        };
      case 'pc_disconnected':
        return {
          icon: <WifiOff size={16} />,
          label: 'No PC',
          color: 'bg-zinc-500',
          textColor: 'text-zinc-400',
          description: 'You have control',
        };
      case 'mobile_exclusive':
        return {
          icon: <Smartphone size={16} />,
          label: 'Exclusive',
          color: 'bg-purple-500',
          textColor: 'text-purple-400',
          description: exclusiveTimeRemaining
            ? `${formatTime(exclusiveTimeRemaining)} remaining`
            : 'Mobile has exclusive control',
        };
      default:
        return {
          icon: <Wifi size={16} />,
          label: 'Unknown',
          color: 'bg-zinc-500',
          textColor: 'text-zinc-400',
          description: 'Status unknown',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Status indicator dot */}
      <div className={`w-2 h-2 rounded-full ${config.color} animate-pulse`} />

      {/* Icon and label */}
      <div className={`flex items-center gap-1.5 ${config.textColor}`}>
        {config.icon}
        <span className="text-sm font-medium">{config.label}</span>
      </div>

      {/* Description */}
      <span className="text-xs text-zinc-500 hidden sm:inline">
        {config.description}
      </span>

      {/* Timer for exclusive mode */}
      {state === 'mobile_exclusive' && exclusiveTimeRemaining && (
        <div className="flex items-center gap-1 text-xs text-purple-400">
          <Clock size={12} />
          <span>{formatTime(exclusiveTimeRemaining)}</span>
        </div>
      )}
    </div>
  );
}

export default ControlStatus;
