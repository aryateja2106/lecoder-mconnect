'use client';

import { useRouter } from 'next/navigation';
import { Plus, Activity, Terminal, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MachineFleet } from '@/components/machines/MachineFleet';
import { AgentSessionCard } from '@/components/agent/AgentSessionCard';
import { useAgentStore } from '@/stores/agentStore';
import type { Machine, AgentSession } from '@/types/agent';

// --- Demo data (replace with real store data once WS is wired) ---
const DEMO_MACHINES: Machine[] = [
  {
    id: 'machine-1',
    name: 'MBP M4 Pro',
    os: 'macos',
    online: true,
    agentCount: 2,
    ip: '100.72.14.33',
    lastSeen: Date.now(),
  },
  {
    id: 'machine-2',
    name: 'rpi5-ubuntu',
    os: 'linux',
    online: false,
    agentCount: 0,
    ip: '100.72.14.41',
    lastSeen: Date.now() - 1000 * 60 * 15,
  },
];

const DEMO_SESSIONS: AgentSession[] = [
  {
    id: 'session-1',
    agentName: 'Claude Code',
    agentState: 'executing',
    machineId: 'machine-1',
    machineName: 'MBP M4 Pro',
    lastOutput: '> cargo clippy --all-targets && cargo test\n   Compiling lecoder-core v0.3.1',
    createdAt: Date.now() - 1000 * 60 * 40,
    lastActivity: Date.now() - 1000 * 12,
    connectedClients: 1,
    guardrails: 'default',
    workingDirectory: '~/Projects/karna',
    preset: 'single',
  },
  {
    id: 'session-2',
    agentName: 'Research Agent',
    agentState: 'thinking',
    machineId: 'machine-1',
    machineName: 'MBP M4 Pro',
    lastOutput: 'Analyzing codebase structure for refactoring opportunities...',
    createdAt: Date.now() - 1000 * 60 * 10,
    lastActivity: Date.now() - 1000 * 3,
    connectedClients: 0,
    guardrails: 'strict',
    workingDirectory: '~/Projects/lecoder-mconnect',
    preset: 'research-spec-test',
  },
  {
    id: 'session-3',
    agentName: 'Shell',
    agentState: 'idle',
    machineId: 'machine-1',
    machineName: 'MBP M4 Pro',
    lastOutput: '$ ',
    createdAt: Date.now() - 1000 * 60 * 90,
    lastActivity: Date.now() - 1000 * 60 * 5,
    connectedClients: 0,
    guardrails: 'permissive',
    workingDirectory: '~',
    preset: 'shell-only',
  },
];
// --- End demo data ---

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1 rounded-xl bg-[#131316] border border-zinc-800 px-3 py-3">
      <span className="text-zinc-500">{icon}</span>
      <span className="text-base font-bold text-zinc-50">{value}</span>
      <span className="text-[10px] text-zinc-600 uppercase tracking-wide">{label}</span>
    </div>
  );
}

function formatUptime(startMs: number | null): string {
  if (startMs === null) return '--';
  const elapsed = Math.floor((Date.now() - startMs) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function DashboardView() {
  const router = useRouter();
  const { sessions, totalCommandsExecuted, uptimeStart } = useAgentStore();

  // Use real sessions if available, fall back to demo
  const displaySessions = sessions.length > 0 ? sessions : DEMO_SESSIONS;
  const activeSessions = displaySessions.filter(
    (s) => s.agentState !== 'idle' && s.agentState !== 'error'
  );

  return (
    <div className="flex flex-col gap-6 px-4 pt-4 pb-28">
      {/* Machines section */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Machines
          </h2>
          <span className="text-[10px] text-zinc-600">
            {DEMO_MACHINES.filter((m) => m.online).length}/{DEMO_MACHINES.length} online
          </span>
        </div>
        <MachineFleet machines={DEMO_MACHINES} />
      </section>

      {/* Active Sessions section */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Active Sessions
          </h2>
          <span className="text-[10px] text-zinc-600">{displaySessions.length} total</span>
        </div>

        {displaySessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-800 p-8 text-center">
            <Terminal className="h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-500">No active sessions</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displaySessions.map((session) => (
              <AgentSessionCard
                key={session.id}
                session={session}
                onClick={() => {}}
              />
            ))}
          </div>
        )}
      </section>

      {/* Stats row */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Stats</h2>
        <div className="flex gap-3">
          <StatPill
            icon={<Activity className="h-3.5 w-3.5" />}
            label="Active"
            value={activeSessions.length}
          />
          <StatPill
            icon={<Terminal className="h-3.5 w-3.5" />}
            label="Commands"
            value={totalCommandsExecuted}
          />
          <StatPill
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Uptime"
            value={formatUptime(uptimeStart)}
          />
        </div>
      </section>

      {/* New Session CTA */}
      <Button
        size="lg"
        className="w-full min-h-[44px] bg-[#1FD5F9] hover:bg-[#1FD5F9]/90 text-zinc-950 font-semibold gap-2"
        onClick={() => router.push('/connect')}
      >
        <Plus className="h-4 w-4" />
        New Session
      </Button>
    </div>
  );
}
