'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useWebSocket, type SessionSummary } from '@/hooks/useWebSocket';
import { ControlBar } from '@/components/terminal/ControlBar';
import { StatusBar } from '@/components/terminal/StatusBar';
import { PairingScreen } from '@/components/PairingScreen';
import { SessionHistory } from '@/components/SessionHistory';
import { DemoProvider, useDemoContext } from '@/context/DemoContext';
import { useSessionStore } from '@/stores/sessionStore';
import {
  Wifi, WifiOff, Terminal, Loader2, AlertCircle, RefreshCw, Lock,
  Play, Users, Clock, ArrowLeft, RotateCcw, History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TerminalView = dynamic(
  () => import('@/components/terminal/TerminalView'),
  { ssr: false, loading: () => <div className="flex-1 bg-zinc-950" /> }
);

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

function SessionCard({ session, onSelect }: { session: SessionSummary; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="w-full bg-zinc-900 rounded-xl p-4 text-left hover:bg-zinc-800 transition-colors border border-zinc-800 hover:border-zinc-700 group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', session.state === 'running' ? 'bg-green-500 shadow-sm shadow-green-500/50' : session.state === 'paused' ? 'bg-yellow-500' : 'bg-zinc-500')} />
          <span className="text-white font-semibold text-sm font-mono">{session.id.slice(0, 8)}</span>
        </div>
        <Badge variant={session.state === 'running' ? 'success' : session.state === 'paused' ? 'warning' : 'secondary'} className="text-[10px]">{session.state}</Badge>
      </div>
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1"><Users size={11} />{session.connectedClients} client{session.connectedClients !== 1 ? 's' : ''}</span>
        <span className="flex items-center gap-1"><Clock size={11} />{formatRelativeTime(session.lastActivity)}</span>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-cyan-400 text-sm font-medium group-hover:text-cyan-300 transition-colors"><Play size={13} />Attach to Session</div>
    </button>
  );
}

function ConnectContent() {
  const demoContext = useDemoContext();
  const { isDemoMode, connect: demoConnect, getWebSocket } = demoContext;
  const [wsUrl, setWsUrl] = useState('');
  const [noToken, setNoToken] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [demoInitialized, setDemoInitialized] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [attachedAt, setAttachedAt] = useState<number | null>(null);
  const sessionStore = useSessionStore();

  const resolveServerOrigin = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const serverParam = params.get('server');
    if (serverParam) { try { return new URL(serverParam).origin; } catch { /* ignore */ } }
    if (window.location.hostname.includes('trycloudflare.com')) return window.location.origin;
    if (window.location.hostname === 'localhost' && window.location.port === '3000') return 'http://localhost:8765';
    return window.location.origin;
  }, []);

  const handlePairingSuccess = useCallback((token: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('token', token);
    window.history.replaceState({}, '', url.toString());
    const origin = resolveServerOrigin();
    const wsProtocol = origin.startsWith('https') ? 'wss:' : 'ws:';
    const wsHost = new URL(origin).host;
    setWsUrl(`${wsProtocol}//${wsHost}?token=${token}`);
    setNoToken(false);
  }, [resolveServerOrigin]);

  const handleHistoryReconnect = useCallback((_sessionId: string) => { setShowHistory(false); setNoToken(true); }, []);

  useEffect(() => {
    if (isDemoMode) { setNoToken(false); return; }
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const apiHost = resolveServerOrigin();
    setServerUrl(apiHost);
    if (!token) { setNoToken(true); return; }
    const wsProtocol = apiHost.startsWith('https') ? 'wss:' : 'ws:';
    const wsHost = new URL(apiHost).host;
    setWsUrl(`${wsProtocol}//${wsHost}?token=${token}`);
  }, [resolveServerOrigin, isDemoMode]);

  useEffect(() => { if (isDemoMode && !demoInitialized) { demoConnect(); setDemoInitialized(true); } }, [isDemoMode, demoConnect, demoInitialized]);

  useEffect(() => {
    if (!isDemoMode) return;
    const ws = getWebSocket();
    if (!ws) return;
    const originalOnMessage = ws.onmessage;
    ws.onmessage = (event: MessageEvent) => {
      if (originalOnMessage) originalOnMessage.call(ws, event);
      try {
        const message = JSON.parse(event.data as string) as { type: string; data?: string };
        const w = window as unknown as Record<string, unknown>;
        if (message.type === 'output' && w.mconnectTerminal) (w.mconnectTerminal as { write: (d: string) => void }).write(message.data ?? '');
      } catch { /* ignore */ }
    };
  }, [isDemoMode, getWebSocket]);

  const { status: wsStatus, isConnected: wsIsConnected, isReadOnly: wsIsReadOnly, sessionInfo, pendingApproval: wsPendingApproval, error, sendInput, toggleMode, sendKill, sendApproval, reconnect, sessions, attachedSessionId: wsAttachedSessionId, attachToSession, detachFromSession } = useWebSocket(isDemoMode ? '' : wsUrl, { protocolVersion: '1.0', clientType: 'mobile' });

  const status = isDemoMode ? 'connected' : wsStatus;
  const isConnected = isDemoMode ? true : wsIsConnected;
  const isReadOnly = isDemoMode ? true : wsIsReadOnly;
  const pendingApproval = isDemoMode ? demoContext.pendingApproval : wsPendingApproval;
  const attachedSessionId = isDemoMode ? demoContext.activeSessionId : wsAttachedSessionId;

  useEffect(() => {
    if (attachedSessionId) {
      setAttachedAt(Date.now());
      sessionStore.updateSession({ id: attachedSessionId, lastAttached: Date.now(), scrollbackPosition: 0 });
      sessionStore.setCurrentSession(attachedSessionId);
    } else { setAttachedAt(null); sessionStore.setCurrentSession(null); }
  }, [attachedSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = () => { if (isDemoMode) demoContext.respondToApproval(true); else if (pendingApproval) sendApproval(true, pendingApproval.command); };
  const handleDeny = () => { if (isDemoMode) demoContext.respondToApproval(false); else if (pendingApproval) sendApproval(false, pendingApproval.command); };
  const handleSendKey = useCallback((key: string) => { if (!isReadOnly) sendInput(key); }, [isReadOnly, sendInput]);

  if (noToken && !isDemoMode) {
    if (showHistory) {
      return (
        <main className="h-screen w-screen bg-zinc-950 flex flex-col overflow-hidden">
          <SessionHistory sessions={sessionStore.state.sessions} onReconnect={handleHistoryReconnect} onRemove={sessionStore.removeSession} onClear={sessionStore.clearSessions} onClose={() => setShowHistory(false)} />
        </main>
      );
    }
    return <PairingScreen serverUrl={serverUrl} onSuccess={handlePairingSuccess} recentSessionId={sessionStore.state.sessions.length > 0 ? sessionStore.state.sessions[0]?.id : null} onShowHistory={() => setShowHistory(true)} />;
  }

  const showSessionSelection = !isDemoMode && isConnected && !attachedSessionId;

  return (
    <main className="h-screen w-screen bg-zinc-950 flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          {attachedSessionId && !isDemoMode && (
            <button onClick={detachFromSession} className="p-1.5 -ml-1 hover:bg-zinc-800 rounded-lg transition-colors" title="Back to sessions"><ArrowLeft size={16} className="text-zinc-400" /></button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center"><Terminal size={14} className="text-cyan-400" /></div>
            <span className="font-bold text-white text-sm tracking-tight">MConnect</span>
          </div>
          {attachedSessionId && <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-500 font-mono">{isDemoMode ? 'demo' : attachedSessionId.slice(0, 8)}</span>}
          {isReadOnly && attachedSessionId && <Badge variant="secondary" className="text-[10px]">Read-only</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {sessionInfo && attachedSessionId && !isDemoMode && <span className="text-xs text-zinc-600 hidden sm:block">{sessionInfo.agent}</span>}
          {isDemoMode ? <Badge variant="warning" className="gap-1"><Play size={10} />Demo</Badge> :
            status === 'connecting' ? <Badge variant="warning" className="gap-1"><Loader2 size={10} className="animate-spin" />Connecting</Badge> :
            status === 'connected' ? <Badge variant="success" className="gap-1"><Wifi size={10} />Connected</Badge> :
            status === 'disconnected' ? <Badge variant="secondary" className="gap-1"><WifiOff size={10} />Disconnected</Badge> :
            status === 'unauthorized' ? <Badge variant="destructive" className="gap-1"><Lock size={10} />Unauthorized</Badge> :
            <Badge variant="destructive" className="gap-1"><AlertCircle size={10} />Error</Badge>}
          {!isDemoMode && sessionStore.state.sessions.length > 0 && (
            <button onClick={() => setShowHistory(!showHistory)} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors" title="Session history"><History size={15} className="text-zinc-500 hover:text-zinc-300" /></button>
          )}
        </div>
      </header>

      {showHistory && !isDemoMode && (
        <div className="absolute inset-0 z-30 bg-zinc-950 flex flex-col">
          <SessionHistory sessions={sessionStore.state.sessions} onReconnect={handleHistoryReconnect} onRemove={sessionStore.removeSession} onClear={sessionStore.clearSessions} onClose={() => setShowHistory(false)} />
        </div>
      )}

      {showSessionSelection ? (
        <div className="flex-1 overflow-auto p-5">
          <div className="max-w-md mx-auto">
            <h2 className="text-base font-semibold text-white mb-1">Select Session</h2>
            <p className="text-zinc-500 text-sm mb-5">Choose a session to connect to.</p>
            {sessions.length === 0 ? (
              <div className="text-center py-14 border border-zinc-800 rounded-xl bg-zinc-900/50">
                <Loader2 size={28} className="text-zinc-600 animate-spin mx-auto mb-3" />
                <p className="text-zinc-500 text-sm font-medium">Waiting for sessions...</p>
                <p className="text-zinc-600 text-xs mt-1.5">Start one with <code className="text-cyan-400">mconnect start</code></p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.filter((s) => s.state === 'running').map((session) => <SessionCard key={session.id} session={session} onSelect={() => attachToSession(session.id)} />)}
                {sessions.filter((s) => s.state !== 'running').map((session) => <SessionCard key={session.id} session={session} onSelect={() => attachToSession(session.id)} />)}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-hidden relative">
            <TerminalView isReadOnly={isReadOnly} onData={isReadOnly ? undefined : sendInput} />
            {!isDemoMode && status !== 'connected' && (
              <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-sm flex items-center justify-center p-6 z-10">
                <div className="max-w-sm text-center w-full">
                  {status === 'connecting' && <><div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4"><Loader2 size={32} className="text-cyan-400 animate-spin" /></div><h2 className="text-lg font-semibold text-white mb-2">Connecting</h2><p className="text-zinc-400 text-sm">Establishing secure connection...</p></>}
                  {status === 'error' && <><div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4"><AlertCircle size={28} className="text-red-400" /></div><h2 className="text-lg font-semibold text-white mb-2">Connection Error</h2><p className="text-zinc-400 text-sm mb-5">{error ?? 'Failed to connect'}</p><Button onClick={reconnect} variant="secondary" className="gap-2"><RefreshCw size={15} />Retry</Button></>}
                  {status === 'disconnected' && <><div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-4"><WifiOff size={28} className="text-zinc-500" /></div><h2 className="text-lg font-semibold text-white mb-2">Disconnected</h2><p className="text-zinc-400 text-sm mb-5">Attempting to reconnect...</p><Button onClick={reconnect} variant="secondary" className="gap-2"><RefreshCw size={15} />Reconnect</Button></>}
                </div>
              </div>
            )}
            {isDemoMode && <DemoControls />}
          </div>
          <StatusBar status={status as 'connecting' | 'connected' | 'disconnected' | 'error' | 'unauthorized'} sessionId={attachedSessionId} isDemoMode={isDemoMode} attachedAt={attachedAt} />
          <ControlBar isReadOnly={isReadOnly} onToggleMode={isDemoMode ? () => {} : toggleMode} onKill={isDemoMode ? () => {} : sendKill} pendingApproval={pendingApproval} onApprove={handleApprove} onDeny={handleDeny} onSendKey={isReadOnly ? undefined : handleSendKey} />
        </>
      )}
    </main>
  );
}

function DemoControls() {
  const { playbackState, currentTimestamp, totalDuration, restart, play, pause, progress } = useDemoContext();
  const formatTime = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; };
  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-zinc-900/95 backdrop-blur rounded-full px-4 py-2 border border-zinc-700 shadow-lg">
      <button onClick={restart} className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors"><RotateCcw size={16} className="text-zinc-400" /></button>
      <button onClick={playbackState === 'playing' ? pause : play} className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors">
        {playbackState === 'playing' ? <div className="w-4 h-4 flex items-center justify-center gap-0.5"><div className="w-1 h-3 bg-zinc-400 rounded-sm" /><div className="w-1 h-3 bg-zinc-400 rounded-sm" /></div> : <Play size={16} className="text-zinc-400" />}
      </button>
      <div className="flex items-center gap-2 text-xs text-zinc-400"><span>{formatTime(currentTimestamp)}</span><div className="w-20 h-1 bg-zinc-700 rounded-full overflow-hidden"><div className="h-full bg-cyan-500 rounded-full transition-all duration-100" style={{ width: `${Math.min(100, progress)}%` }} /></div><span>{formatTime(totalDuration)}</span></div>
    </div>
  );
}

export default function ConnectPage() {
  return <DemoProvider><ConnectContent /></DemoProvider>;
}
