'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, Loader2, AlertCircle, Lock, Clock, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'unauthorized';

interface StatusBarProps {
  status: ConnectionStatus;
  sessionId?: string | null;
  isDemoMode?: boolean;
  attachedAt?: number | null;
}

function SessionTimer({ attachedAt }: { attachedAt: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - attachedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [attachedAt]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  if (hours > 0) {
    return <span>{hours}h {String(minutes).padStart(2, '0')}m</span>;
  }
  return <span>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>;
}

export function StatusBar({ status, sessionId, isDemoMode, attachedAt }: StatusBarProps) {
  const statusConfig = {
    connecting: {
      icon: <Loader2 size={11} className="animate-spin" />,
      label: 'Connecting',
      dot: 'bg-yellow-500 animate-pulse',
      text: 'text-yellow-400',
    },
    connected: {
      icon: <Wifi size={11} />,
      label: 'Connected',
      dot: 'bg-green-500',
      text: 'text-green-400',
    },
    disconnected: {
      icon: <WifiOff size={11} />,
      label: 'Disconnected',
      dot: 'bg-zinc-500',
      text: 'text-zinc-400',
    },
    error: {
      icon: <AlertCircle size={11} />,
      label: 'Error',
      dot: 'bg-red-500',
      text: 'text-red-400',
    },
    unauthorized: {
      icon: <Lock size={11} />,
      label: 'Unauthorized',
      dot: 'bg-red-500',
      text: 'text-red-400',
    },
  };

  const config = isDemoMode
    ? { icon: <Play size={11} />, label: 'Demo', dot: 'bg-amber-500', text: 'text-amber-400' }
    : statusConfig[status];

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-t border-zinc-800 text-xs">
      {/* Left: connection status */}
      <div className={cn('flex items-center gap-1.5', config.text)}>
        <div className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
        {config.icon}
        <span>{config.label}</span>
      </div>

      {/* Center: session ID */}
      {sessionId && (
        <span className="text-zinc-600 font-mono">
          {sessionId.slice(0, 8)}
        </span>
      )}

      {/* Right: session timer */}
      {attachedAt && status === 'connected' && (
        <div className="flex items-center gap-1 text-zinc-600">
          <Clock size={10} />
          <SessionTimer attachedAt={attachedAt} />
        </div>
      )}
    </div>
  );
}

export default StatusBar;
