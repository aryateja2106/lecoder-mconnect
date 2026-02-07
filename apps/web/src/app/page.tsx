'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useWebSocket, type SessionSummary } from '@/hooks/useWebSocket';
import { ControlBar } from '@/components/terminal/ControlBar';
import { DemoProvider, useDemoContext, isDemoModeEnabled } from '@/context/DemoContext';
import { Wifi, WifiOff, Terminal, Loader2, AlertCircle, RefreshCw, Lock, Play, Users, Clock, ArrowLeft, KeyRound, RotateCcw, ChevronDown, ChevronUp, ExternalLink, Copy, Check } from 'lucide-react';

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

// Demo mode controls overlay
function DemoControls() {
  const { isDemoMode, playbackState, currentTimestamp, totalDuration, restart, play, pause, progress } = useDemoContext();

  if (!isDemoMode) return null;

  // Format time as mm:ss
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-zinc-900/95 backdrop-blur rounded-full px-4 py-2 border border-zinc-700 shadow-lg">
      <button
        onClick={restart}
        className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors"
        title="Restart demo"
      >
        <RotateCcw size={16} className="text-zinc-400" />
      </button>

      <button
        onClick={playbackState === 'playing' ? pause : play}
        className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors"
        title={playbackState === 'playing' ? 'Pause' : 'Play'}
      >
        {playbackState === 'playing' ? (
          <div className="w-4 h-4 flex items-center justify-center gap-0.5">
            <div className="w-1 h-3 bg-zinc-400 rounded-sm" />
            <div className="w-1 h-3 bg-zinc-400 rounded-sm" />
          </div>
        ) : (
          <Play size={16} className="text-zinc-400" />
        )}
      </button>

      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span>{formatTime(currentTimestamp)}</span>
        <div className="w-20 h-1 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-500 rounded-full transition-all duration-100"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <span>{formatTime(totalDuration)}</span>
      </div>
    </div>
  );
}

// "Try Locally" expandable section for demo mode
function TryLocallySection() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const { isDemoMode } = useDemoContext();

  if (!isDemoMode) return null;

  const copyToClipboard = async (text: string, command: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCommand(command);
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedCommand(command);
      setTimeout(() => setCopiedCommand(null), 2000);
    }
  };

  const CommandBlock = ({ command, description }: { command: string; description: string }) => (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-zinc-500">{description}</span>
        <button
          onClick={() => copyToClipboard(command, command)}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-all"
          title="Copy command"
        >
          {copiedCommand === command ? (
            <Check size={12} className="text-green-400" />
          ) : (
            <Copy size={12} className="text-zinc-400" />
          )}
        </button>
      </div>
      <div className="bg-zinc-950 rounded-lg p-3 font-mono text-sm text-cyan-400 border border-zinc-800">
        <span className="text-zinc-500">$ </span>{command}
      </div>
    </div>
  );

  return (
    <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-4">
      <div className="bg-zinc-900/95 backdrop-blur rounded-xl border border-zinc-700 shadow-xl overflow-hidden">
        {/* Collapsed header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-cyan-400" />
            <span className="text-sm font-medium text-white">Try It Yourself</span>
          </div>
          {isExpanded ? (
            <ChevronDown size={16} className="text-zinc-400" />
          ) : (
            <ChevronUp size={16} className="text-zinc-400" />
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-400 mt-3">
              Run MConnect locally and control your AI agents from your phone.
            </p>

            <div className="space-y-3">
              <CommandBlock
                command="npm install -g lecoder-mconnect"
                description="Install MConnect globally"
              />
              <CommandBlock
                command="mconnect start"
                description="Start a session"
              />
            </div>

            <p className="text-xs text-zinc-500">
              Scan the QR code that appears to connect from your phone.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://github.com/aryateja2106/lecoder-mconnect"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <ExternalLink size={12} />
                GitHub
              </a>
              <a
                href="https://www.npmjs.com/package/lecoder-mconnect"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <ExternalLink size={12} />
                npm
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main content that can work in both demo and live modes
function HomeContent() {
  const demoContext = useDemoContext();
  const { isDemoMode, connect: demoConnect, getWebSocket } = demoContext;

  const [wsUrl, setWsUrl] = useState<string>('');
  const [noToken, setNoToken] = useState(false);
  const [serverUrl, setServerUrl] = useState<string>('');
  const [demoInitialized, setDemoInitialized] = useState(false);

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
  // In demo mode, we skip token resolution and use MockWebSocket
  useEffect(() => {
    if (isDemoMode) {
      // In demo mode, don't require a token
      setNoToken(false);
      return;
    }

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
  }, [resolveServerOrigin, isDemoMode]);

  // Initialize demo mode WebSocket
  useEffect(() => {
    if (isDemoMode && !demoInitialized) {
      demoConnect();
      setDemoInitialized(true);
    }
  }, [isDemoMode, demoConnect, demoInitialized]);

  // Setup MockWebSocket event handling for demo mode
  useEffect(() => {
    if (!isDemoMode) return;

    const ws = getWebSocket();
    if (!ws) return;

    // The MockWebSocket fires messages that useWebSocket-like hook would process
    // We need to write to the terminal directly when in demo mode
    const originalOnMessage = ws.onmessage;
    ws.onmessage = (event: MessageEvent) => {
      // First call original handler
      if (originalOnMessage) {
        originalOnMessage.call(ws, event);
      }

      // Then write to terminal
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'output' && (window as any).mconnectTerminal) {
          (window as any).mconnectTerminal.write(message.data);
        }
      } catch {
        // Ignore parse errors
      }
    };
  }, [isDemoMode, getWebSocket]);

  const {
    status: wsStatus,
    isConnected: wsIsConnected,
    isReadOnly: wsIsReadOnly,
    sessionInfo,
    pendingApproval: wsPendingApproval,
    error,
    sendInput,
    toggleMode,
    sendKill,
    sendApproval,
    reconnect,
    // v2 Protocol
    sessions,
    attachedSessionId: wsAttachedSessionId,
    attachToSession,
    detachFromSession,
    controlStatus,
  } = useWebSocket(isDemoMode ? '' : wsUrl, {
    protocolVersion: '1.0',  // Use v1.0 protocol for now until daemon is fully implemented
    clientType: 'mobile',
  });

  // In demo mode, override status with demo state
  const status = isDemoMode ? 'connected' : wsStatus;
  const isConnected = isDemoMode ? true : wsIsConnected;
  const isReadOnly = isDemoMode ? true : wsIsReadOnly;
  const pendingApproval = isDemoMode ? demoContext.pendingApproval : wsPendingApproval;
  const attachedSessionId = isDemoMode ? demoContext.activeSessionId : wsAttachedSessionId;

  // Handle approval in demo mode
  const handleApprove = () => {
    if (isDemoMode) {
      demoContext.respondToApproval(true);
    } else if (pendingApproval) {
      sendApproval(true, pendingApproval.command);
    }
  };

  const handleDeny = () => {
    if (isDemoMode) {
      demoContext.respondToApproval(false);
    } else if (pendingApproval) {
      sendApproval(false, pendingApproval.command);
    }
  };

  // No token provided - show pairing code entry (skip in demo mode)
  if (noToken && !isDemoMode) {
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
    if (isDemoMode) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400">
          <Play size={12} />
          Demo
        </div>
      );
    }

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

  // Error/disconnected overlay (not shown in demo mode)
  const renderOverlay = () => {
    if (isDemoMode || status === 'connected') return null;

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
  // In demo mode, we're always attached to the active demo session
  const showSessionSelection = !isDemoMode && isConnected && !attachedSessionId;

  return (
    <main className="h-screen w-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          {attachedSessionId && !isDemoMode && (
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
              {isDemoMode ? 'Claude Code' : attachedSessionId.slice(0, 8)}
            </span>
          )}
          {isReadOnly && attachedSessionId && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              Read-only
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {sessionInfo && attachedSessionId && !isDemoMode && (
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
            {/* Demo controls overlay */}
            {isDemoMode && <DemoControls />}
            {/* Try Locally section for demo mode */}
            {isDemoMode && <TryLocallySection />}
          </div>

          {/* Control Bar - v1.0 protocol doesn't show session selection */}
          <ControlBar
            isReadOnly={isReadOnly}
            onToggleMode={isDemoMode ? () => {} : toggleMode}
            onKill={isDemoMode ? () => {} : sendKill}
            pendingApproval={pendingApproval}
            onApprove={handleApprove}
            onDeny={handleDeny}
          />
        </>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <DemoProvider>
      <HomeContent />
    </DemoProvider>
  );
}
