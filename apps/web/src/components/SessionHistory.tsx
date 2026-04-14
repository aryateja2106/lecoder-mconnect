'use client';

import { useCallback } from 'react';
import { Clock, RefreshCw, Trash2, Terminal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { StoredSession } from '@/stores/sessionStore';

interface SessionHistoryProps {
  sessions: StoredSession[];
  onReconnect: (sessionId: string) => void;
  onRemove: (sessionId: string) => void;
  onClear: () => void;
  onClose: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function SessionCard({
  session,
  onReconnect,
  onRemove,
}: {
  session: StoredSession;
  onReconnect: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group relative flex items-start gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800/70 hover:border-zinc-700 transition-all">
      {/* Session icon */}
      <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
        <Terminal size={15} className="text-zinc-400" />
      </div>

      {/* Session info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-zinc-100 font-mono">
            {session.id.slice(0, 8)}&hellip;
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            stored
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {formatRelativeTime(session.lastAttached)}
          </span>
          {session.workingDirectory && (
            <span className="truncate max-w-[120px] font-mono text-zinc-500">
              {session.workingDirectory}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          onClick={onReconnect}
          variant="secondary"
          size="sm"
          className="h-7 px-2.5 text-xs gap-1"
        >
          <RefreshCw size={11} />
          Reconnect
        </Button>
        <Button
          onClick={onRemove}
          variant="ghost"
          size="icon-sm"
          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
          title="Remove session"
        >
          <X size={13} />
        </Button>
      </div>
    </div>
  );
}

export function SessionHistory({
  sessions,
  onReconnect,
  onRemove,
  onClear,
  onClose,
}: SessionHistoryProps) {
  const sortedSessions = [...sessions].sort((a, b) => b.lastAttached - a.lastAttached);

  const handleReconnect = useCallback((sessionId: string) => {
    onReconnect(sessionId);
    onClose();
  }, [onReconnect, onClose]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
        <div>
          <h2 className="text-base font-semibold text-white">Recent Sessions</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {sessions.length === 0 ? 'No sessions yet' : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} stored`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <Button
              onClick={onClear}
              variant="ghost"
              size="sm"
              className="text-zinc-500 hover:text-red-400 text-xs gap-1.5"
            >
              <Trash2 size={12} />
              Clear all
            </Button>
          )}
          <Button onClick={onClose} variant="ghost" size="icon-sm" className="text-zinc-400">
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {sortedSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                <Terminal size={22} className="text-zinc-600" />
              </div>
              <p className="text-zinc-400 text-sm font-medium mb-1">No sessions yet</p>
              <p className="text-zinc-600 text-xs max-w-[200px]">
                Connect to get started. Sessions you attach to will appear here.
              </p>
            </div>
          ) : (
            sortedSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onReconnect={() => handleReconnect(session.id)}
                onRemove={() => onRemove(session.id)}
              />
            ))
          )}
        </div>

        {sortedSessions.length > 0 && (
          <>
            <Separator />
            <p className="text-center text-xs text-zinc-600 py-4">
              Sessions are stored locally on this device
            </p>
          </>
        )}
      </ScrollArea>
    </div>
  );
}

export default SessionHistory;
