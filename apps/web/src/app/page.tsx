'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useWebSocket, type SessionSummary } from '@/hooks/useWebSocket';
import { ControlBar } from '@/components/terminal/ControlBar';
import { Wifi, WifiOff, Terminal, Loader2, AlertCircle, RefreshCw, Lock, Play, Users, Clock, ArrowLeft, KeyRound } from 'lucide-react';

// Dynamic import for terminal (needs window)
const TerminalView = dynamic(
  () => import('@/components/terminal/TerminalView'),
  { ssr: false, loading: () => <div className="flex-1 bg-zinc-950" /> }
);

// Format relative time for session display
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

// Pairing code entry component
function PairingCodeEntry({
  onSuccess,
  serverUrl,
}: {
  onSuccess: (token: string) => void;
  serverUrl: string;
}) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleInput = useCallback((index: number, value: string) => {
    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (char.length > 1) {
      // Handle paste
      const chars = char.split('').slice(0, 6);
      const newCode = [...code];
      chars.forEach((c, i) => {
        if (index + i < 6) newCode[index + i] = c;
      });
      setCode(newCode);
      setError(null);
      const focusIndex = Math.min(index + chars.length, 5);
      inputRefs.current[focusIndex]?.focus();
    } else {
      const newCode = [...code];
      newCode[index] = char;
      setCode(newCode);
      setError(null);
      if (char && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  }, [code]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }, [code]);

  const handleSubmit = useCallback(async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6 || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${serverUrl}/api/pair?code=${encodeURIComponent(fullCode)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid code');
      }

      onSuccess(data.token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg === 'code_expired' ? 'Code expired. Get a new one from terminal.' : 'Invalid code. Please try again.');
      setIsSubmitting(false);
      inputRefs.current[0]?.focus();
    }
  }, [code, isSubmitting, serverUrl, onSuccess]);

  const isComplete = code.every(c => c.length === 1);

  return (
    <div className="max-w-sm mx-auto text-center">
      <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-6">
        <KeyRound size={32} className="text-cyan-400" />
      </div>
      <h1 className="text-xl font-semibold text-white mb-2">Enter Pairing Code</h1>
      <p className="text-zinc-400 text-sm mb-8">
        Enter the 6-character code shown in your terminal
      </p>

      <div className="flex gap-2 justify-center mb-6">
        {code.map((char, idx) => (
          <input
            key={idx}
            ref={el => { inputRefs.current[idx] = el; }}
            type="text"
            maxLength={6}
            value={char}
            onChange={(e) => handleInput(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            className={`w-12 h-14 bg-zinc-900 border-2 rounded-xl text-center text-xl font-bold text-white uppercase outline-none transition-colors ${
              error ? 'border-red-500' : 'border-zinc-700 focus:border-cyan-400'
            }`}
            autoFocus={idx === 0}
          />
        ))}
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-4">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!isComplete || isSubmitting}
        className="w-full py-3 px-4 bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Connecting...
          </>
        ) : (
          'Connect'
        )}
      </button>

      <p className="text-zinc-600 text-xs mt-6">
        Run <code className="text-cyan-400">mconnect</code> in your terminal to get a code
      </p>
    </div>
  );
}

// Session card component
function SessionCard({
  session,
  onSelect,
}: {
  session: SessionSummary;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full bg-zinc-900 rounded-xl p-4 text-left hover:bg-zinc-800 transition-colors border border-zinc-800"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              session.state === 'running'
                ? 'bg-green-500'
                : session.state === 'paused'
                  ? 'bg-yellow-500'
                  : 'bg-zinc-500'
            }`}
          />
          <span className="text-white font-medium text-sm">
            Session {session.id.slice(0, 8)}
          </span>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            session.state === 'running'
              ? 'bg-green-500/20 text-green-400'
              : session.state === 'paused'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-zinc-500/20 text-zinc-400'
          }`}
        >
          {session.state}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1">
          <Users size={12} />
          {session.connectedClients} client{session.connectedClients !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {formatRelativeTime(session.lastActivity)}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 text-cyan-400 text-sm font-medium">
        <Play size={14} />
        Attach to Session
      </div>
    </button>
  );
}

export default function Home() {
  const [wsUrl, setWsUrl] = useState<string>('');
  const [noToken, setNoToken] = useState(false);
  const [serverUrl, setServerUrl] = useState<string>('');

  const resolveServerOrigin = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const serverParam = params.get('server');
    if (serverParam) {
      try {
        return new URL(serverParam).origin;
      } catch {
        // Ignore invalid server param and fall back to heuristics
      }
    }

    if (window.location.hostname.includes('trycloudflare.com')) {
      return window.location.origin;
    }
    if (window.location.hostname === 'localhost' && window.location.port === '3000') {
      return 'http://localhost:8765';
    }
    return window.location.origin;
  }, []);

  // Handle successful pairing code entry
  const handlePairingSuccess = useCallback((token: string) => {
    // Update URL with token (for reload persistence)
    const url = new URL(window.location.href);
    url.searchParams.set('token', token);
    window.history.replaceState({}, '', url.toString());

    const origin = resolveServerOrigin();
    const wsProtocol = origin.startsWith('https') ? 'wss:' : 'ws:';
    const wsHost = new URL(origin).host;
    setWsUrl(`${wsProtocol}//${wsHost}?token=${token}`);
    setNoToken(false);
  }, [resolveServerOrigin]);

  // Get token from URL params and construct WebSocket URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    const apiHost = resolveServerOrigin();
    setServerUrl(apiHost);

    if (!token) {
      setNoToken(true);
      return;
    }

    const wsProtocol = apiHost.startsWith('https') ? 'wss:' : 'ws:';
    const wsHost = new URL(apiHost).host;
    setWsUrl(`${wsProtocol}//${wsHost}?token=${token}`);
  }, [resolveServerOrigin]);

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
    // v2 Protocol
    sessions,
    attachedSessionId,
    attachToSession,
    detachFromSession,
    controlStatus,
  } = useWebSocket(wsUrl, {
    protocolVersion: '1.0',  // Use v1.0 protocol for now until daemon is fully implemented
    clientType: 'mobile',
  });

  // No token provided - show pairing code entry
  if (noToken) {
    return (
      <main className="h-screen w-screen bg-zinc-950 flex items-center justify-center p-6">
        <PairingCodeEntry
          serverUrl={serverUrl}
          onSuccess={handlePairingSuccess}
        />
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

  // Session selection screen
  const renderSessionSelection = () => {
    const runningSessions = sessions.filter((s) => s.state === 'running');
    const otherSessions = sessions.filter((s) => s.state !== 'running');

    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-md mx-auto">
          <h2 className="text-lg font-semibold text-white mb-2">Select Session</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Choose a session to connect to, or wait for one to be created.
          </p>

          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 size={32} className="text-zinc-600 animate-spin mx-auto mb-4" />
              <p className="text-zinc-500 text-sm">Waiting for sessions...</p>
              <p className="text-zinc-600 text-xs mt-2">
                Start a session with <code className="text-cyan-400">mconnect start</code>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {runningSessions.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                    Running
                  </h3>
                  <div className="space-y-2">
                    {runningSessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        onSelect={() => attachToSession(session.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {otherSessions.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 mt-4">
                    Other
                  </h3>
                  <div className="space-y-2">
                    {otherSessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        onSelect={() => attachToSession(session.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
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

  // Determine if we should show session selection (connected but not attached)
  const showSessionSelection = isConnected && !attachedSessionId;

  return (
    <main className="h-screen w-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          {attachedSessionId && (
            <button
              onClick={detachFromSession}
              className="p-1 hover:bg-zinc-800 rounded transition-colors mr-1"
              title="Back to sessions"
            >
              <ArrowLeft size={18} className="text-zinc-400" />
            </button>
          )}
          <Terminal size={20} className="text-cyan-400" />
          <span className="font-semibold text-white">MConnect</span>
          {attachedSessionId && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {attachedSessionId.slice(0, 8)}
            </span>
          )}
          {isReadOnly && attachedSessionId && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              Read-only
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {sessionInfo && attachedSessionId && (
            <span className="text-xs text-zinc-500 hidden sm:block">
              {sessionInfo.agent}
            </span>
          )}
          {renderConnectionStatus()}
        </div>
      </header>

      {/* Main Content */}
      {showSessionSelection ? (
        renderSessionSelection()
      ) : (
        <>
          {/* Terminal */}
          <div className="flex-1 overflow-hidden relative">
            <TerminalView
              isReadOnly={isReadOnly}
              onData={isReadOnly ? undefined : sendInput}
            />
            {renderOverlay()}
          </div>

          {/* Control Bar - v1.0 protocol doesn't show session selection */}
          <ControlBar
            isReadOnly={isReadOnly}
            onToggleMode={toggleMode}
            onKill={sendKill}
            pendingApproval={pendingApproval}
            onApprove={() => pendingApproval && sendApproval(true, pendingApproval.command)}
            onDeny={() => pendingApproval && sendApproval(false, pendingApproval.command)}
          />
        </>
      )}
    </main>
  );
}
