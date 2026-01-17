'use client';

import { RefreshCw, WifiOff, AlertCircle, Loader2, MessageSquare } from 'lucide-react';

interface ReconnectOverlayProps {
  status: 'connecting' | 'disconnected' | 'error' | 'loading_scrollback';
  error?: string;
  scrollbackProgress?: {
    loaded: number;
    total: number;
  };
  queuedCommands?: number;
  onReconnect?: () => void;
}

export function ReconnectOverlay({
  status,
  error,
  scrollbackProgress,
  queuedCommands = 0,
  onReconnect,
}: ReconnectOverlayProps) {
  if (status === 'loading_scrollback') {
    const percent = scrollbackProgress
      ? Math.round((scrollbackProgress.loaded / scrollbackProgress.total) * 100)
      : 0;

    return (
      <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
        <div className="text-center p-6 max-w-xs">
          <Loader2 size={48} className="mx-auto mb-4 text-blue-500 animate-spin" />
          <h3 className="text-lg font-semibold text-white mb-2">Loading History</h3>
          <p className="text-zinc-400 text-sm mb-4">
            Restoring terminal scrollback...
          </p>
          {scrollbackProgress && (
            <div className="w-full bg-zinc-700 rounded-full h-2 mb-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
          {scrollbackProgress && (
            <p className="text-xs text-zinc-500">
              {scrollbackProgress.loaded.toLocaleString()} / {scrollbackProgress.total.toLocaleString()} lines
            </p>
          )}
        </div>
      </div>
    );
  }

  if (status === 'connecting') {
    return (
      <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
        <div className="text-center p-6 max-w-xs">
          <Loader2 size={48} className="mx-auto mb-4 text-blue-500 animate-spin" />
          <h3 className="text-lg font-semibold text-white mb-2">Connecting</h3>
          <p className="text-zinc-400 text-sm">
            Establishing connection to server...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
        <div className="text-center p-6 max-w-xs">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-semibold text-white mb-2">Connection Error</h3>
          <p className="text-zinc-400 text-sm mb-4">
            {error || 'Unable to connect to the server.'}
          </p>
          {onReconnect && (
            <button
              onClick={onReconnect}
              className="flex items-center gap-2 mx-auto px-4 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-zinc-200 transition-colors"
            >
              <RefreshCw size={18} />
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // disconnected
  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
      <div className="text-center p-6 max-w-xs">
        <WifiOff size={48} className="mx-auto mb-4 text-yellow-500" />
        <h3 className="text-lg font-semibold text-white mb-2">Disconnected</h3>
        <p className="text-zinc-400 text-sm mb-4">
          Connection lost. Your session is still running on the server.
        </p>

        {/* Queued Commands Notification */}
        {queuedCommands > 0 && (
          <div className="flex items-center justify-center gap-2 mb-4 px-4 py-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
            <MessageSquare size={16} className="text-yellow-400" />
            <span className="text-yellow-300 text-sm font-medium">
              {queuedCommands} command{queuedCommands !== 1 ? 's' : ''} queued
            </span>
          </div>
        )}

        {onReconnect && (
          <button
            onClick={onReconnect}
            className="flex items-center gap-2 mx-auto px-4 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-zinc-200 transition-colors"
          >
            <RefreshCw size={18} />
            Reconnect
          </button>
        )}
        <p className="text-xs text-zinc-500 mt-4">
          {queuedCommands > 0
            ? 'Queued commands will be sent after reconnecting.'
            : 'Reconnecting automatically...'}
        </p>
      </div>
    </div>
  );
}

export default ReconnectOverlay;
