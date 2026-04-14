'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { WifiOff, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SessionHeader } from '@/components/session/SessionHeader';
import { ApprovalBanner } from '@/components/session/ApprovalBanner';
import { SessionControlBar } from '@/components/session/SessionControlBar';
import { useAgentStore } from '@/stores/agentStore';
import { cn } from '@/lib/utils';

const TerminalView = dynamic(
  () => import('@/components/terminal/TerminalView'),
  { ssr: false, loading: () => <div className="flex-1 bg-zinc-950" /> }
);

interface SessionViewProps {
  sessionId: string;
}

export function SessionView({ sessionId }: SessionViewProps) {
  const router = useRouter();

  // Read from global agent store
  const pendingApproval = useAgentStore((s) => s.pendingApproval);
  const setPendingApproval = useAgentStore((s) => s.setPendingApproval);
  const wsStatus = useAgentStore((s) => s.wsStatus);
  const agentState = useAgentStore((s) => s.agentState);
  const sessions = useAgentStore((s) => s.sessions);

  const session = sessions.find((s) => s.id === sessionId) ?? null;

  // Mock read-only state — will be driven by useWebSocket / useControlState in Phase 4
  const isReadOnly = true;

  function handleBack() {
    router.push('/dashboard');
  }

  function handleSendKey(key: string) {
    // Forwarded to the WebSocket in the real implementation
    if ((window as any).mconnectTerminal) {
      (window as any).mconnectTerminal.write(key);
    }
  }

  function handleToggleMode() {
    // Placeholder — wired to useWebSocket.toggleMode() in Phase 4
  }

  function handleKill() {
    // Placeholder — wired to useWebSocket.sendKill() in Phase 4
  }

  function handleApprove() {
    if (!pendingApproval) return;
    // Placeholder — wired to useWebSocket.sendApproval() in Phase 4
    setPendingApproval(null);
  }

  function handleDeny() {
    if (!pendingApproval) return;
    setPendingApproval(null);
  }

  const isDisconnected = wsStatus === 'disconnected' || wsStatus === 'error';
  const isConnecting = wsStatus === 'connecting' || wsStatus === 'idle';

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      {/* Header */}
      <SessionHeader
        sessionId={sessionId}
        agentName={session?.agentName}
        agentState={agentState}
        onBack={handleBack}
      />

      {/* Terminal area — grows to fill remaining space */}
      <div className="relative min-h-0 flex-1">
        <TerminalView
          isReadOnly={isReadOnly}
          onData={handleSendKey}
        />

        {/* Connection state overlays */}
        {isConnecting && (
          <ConnectionOverlay
            icon={<Loader2 className="h-8 w-8 animate-spin text-zinc-500" />}
            title="Connecting…"
            description="Establishing connection to the agent."
          />
        )}

        {isDisconnected && (
          <ConnectionOverlay
            icon={
              wsStatus === 'error' ? (
                <AlertCircle className="h-8 w-8 text-red-400" />
              ) : (
                <WifiOff className="h-8 w-8 text-zinc-500" />
              )
            }
            title={wsStatus === 'error' ? 'Connection Error' : 'Disconnected'}
            description={
              wsStatus === 'error'
                ? 'Could not reach the agent. Make sure the CLI is running.'
                : 'Lost connection to the agent. Attempting to reconnect…'
            }
          >
            <Button
              variant="outline"
              className="mt-4 min-h-[44px]"
              onClick={() => router.push('/dashboard')}
            >
              Back to Dashboard
            </Button>
          </ConnectionOverlay>
        )}

        {/* Approval banner — anchored to bottom of terminal area */}
        <AnimatePresence>
          {pendingApproval && (
            <div className="absolute inset-x-0 bottom-0">
              <ApprovalBanner
                approval={pendingApproval}
                onApprove={handleApprove}
                onDeny={handleDeny}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Control bar */}
      <SessionControlBar
        isReadOnly={isReadOnly}
        onSendKey={handleSendKey}
        onToggleMode={handleToggleMode}
        onKill={handleKill}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ConnectionOverlayProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}

function ConnectionOverlay({ icon, title, description, children }: ConnectionOverlayProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-10 flex flex-col items-center justify-center',
        'bg-zinc-950/90 backdrop-blur-sm'
      )}
    >
      {icon}
      <p className="mt-3 text-base font-semibold text-zinc-200">{title}</p>
      <p className="mt-1 max-w-xs text-center text-sm text-zinc-500">{description}</p>
      {children}
    </div>
  );
}

export default SessionView;
