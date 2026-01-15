'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ControlBar } from '@/components/terminal/ControlBar';
import { Wifi, WifiOff, Terminal, Loader2, AlertCircle, RefreshCw, Lock } from 'lucide-react';

// Dynamic import for terminal (needs window)
const TerminalView = dynamic(
  () => import('@/components/terminal/TerminalView'),
  { ssr: false, loading: () => <div className="flex-1 bg-zinc-950" /> }
);

export default function Home() {
  const [wsUrl, setWsUrl] = useState<string>('');
  const [noToken, setNoToken] = useState(false);

  // Get token from URL params and construct WebSocket URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setNoToken(true);
      return;
    }

    // Determine WebSocket URL based on current page URL
    const isSecure = window.location.protocol === 'https:';
    const wsProtocol = isSecure ? 'wss:' : 'ws:';

    // If accessed via tunnel (trycloudflare.com), the WebSocket goes through the same URL
    // If accessed locally, connect to the local WebSocket port
    let wsHost: string;

    if (window.location.hostname.includes('trycloudflare.com')) {
      // Cloudflare tunnel - WebSocket through same host
      wsHost = window.location.host;
    } else if (window.location.hostname === 'localhost' && window.location.port === '3000') {
      // Local dev server - WebSocket on different port
      wsHost = 'localhost:8765';
    } else {
      // Direct access to WebSocket server
      wsHost = window.location.host;
    }

    setWsUrl(`${wsProtocol}//${wsHost}?token=${token}`);
  }, []);

  const {
    status,
    isConnected,
    isReadOnly,
    sessionInfo,
    pendingApproval,
    error,
    sendInput,
    toggleMode,
    sendKill,
    sendApproval,
    reconnect,
  } = useWebSocket(wsUrl);

  // No token provided
  if (noToken) {
    return (
      <main className="h-screen w-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <Lock size={32} className="text-zinc-500" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">No Session Token</h1>
          <p className="text-zinc-400 mb-6">
            Scan the QR code from the CLI to connect to your terminal session.
          </p>
          <div className="bg-zinc-900 rounded-xl p-4 text-left">
            <p className="text-sm text-zinc-500 mb-2">Run in your terminal:</p>
            <code className="text-cyan-400 text-sm font-mono">npx @lecoder/mconnect</code>
          </div>
        </div>
      </main>
    );
  }

  // Connection states
  const renderConnectionStatus = () => {
    switch (status) {
      case 'connecting':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400">
            <Loader2 size={12} className="animate-spin" />
            Connecting...
          </div>
        );
      case 'connected':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
            <Wifi size={12} />
            Connected
          </div>
        );
      case 'disconnected':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-zinc-500/20 text-zinc-400">
            <WifiOff size={12} />
            Disconnected
          </div>
        );
      case 'unauthorized':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">
            <Lock size={12} />
            Unauthorized
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">
            <AlertCircle size={12} />
            Error
          </div>
        );
    }
  };

  // Error/disconnected overlay
  const renderOverlay = () => {
    if (status === 'connected') return null;

    return (
      <div className="absolute inset-0 bg-zinc-950/90 flex items-center justify-center p-6 z-10">
        <div className="max-w-sm text-center">
          {status === 'connecting' && (
            <>
              <Loader2 size={48} className="text-cyan-400 animate-spin mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">Connecting...</h2>
              <p className="text-zinc-400 text-sm">Establishing secure connection</p>
            </>
          )}

          {status === 'unauthorized' && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <Lock size={32} className="text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Session Expired</h2>
              <p className="text-zinc-400 text-sm mb-4">
                This session token is no longer valid. Scan a new QR code from the CLI.
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Connection Error</h2>
              <p className="text-zinc-400 text-sm mb-4">{error || 'Failed to connect to terminal'}</p>
              <button
                onClick={reconnect}
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-white text-sm font-medium transition-colors"
              >
                <RefreshCw size={16} />
                Retry Connection
              </button>
            </>
          )}

          {status === 'disconnected' && (
            <>
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                <WifiOff size={32} className="text-zinc-500" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Disconnected</h2>
              <p className="text-zinc-400 text-sm mb-4">Connection lost. Attempting to reconnect...</p>
              <button
                onClick={reconnect}
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-white text-sm font-medium transition-colors"
              >
                <RefreshCw size={16} />
                Reconnect Now
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="h-screen w-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={20} className="text-cyan-400" />
          <span className="font-semibold text-white">MConnect</span>
          {isReadOnly && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              Read-only
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {sessionInfo && (
            <span className="text-xs text-zinc-500 hidden sm:block">
              {sessionInfo.agent}
            </span>
          )}
          {renderConnectionStatus()}
        </div>
      </header>

      {/* Terminal */}
      <div className="flex-1 overflow-hidden relative">
        <TerminalView
          isReadOnly={isReadOnly}
          onData={isReadOnly ? undefined : sendInput}
        />
        {renderOverlay()}
      </div>

      {/* Control Bar */}
      <ControlBar
        isReadOnly={isReadOnly}
        onToggleMode={toggleMode}
        onKill={sendKill}
        pendingApproval={pendingApproval}
        onApprove={() => pendingApproval && sendApproval(true, pendingApproval.command)}
        onDeny={() => pendingApproval && sendApproval(false, pendingApproval.command)}
      />
    </main>
  );
}
