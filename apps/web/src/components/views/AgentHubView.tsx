'use client';

import { Plus } from 'lucide-react';
import { AGENT_PRESETS } from '@/types/agent';
import { AgentPresetCard } from '@/components/agent/AgentPresetCard';
import { AgentHealthBadge } from '@/components/agent/AgentHealthBadge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const SUPPORTED_AGENTS = [
  { name: 'Claude Code', installed: true },
  { name: 'Gemini CLI', installed: true },
  { name: 'Cursor Agent', installed: true },
  { name: 'Aider', installed: true },
  { name: 'OpenAI Codex', installed: true },
];

interface AgentHubViewProps {
  onLaunch?: (presetId: string) => void;
}

export function AgentHubView({ onLaunch }: AgentHubViewProps) {
  const handleLaunch = (presetId: string) => {
    onLaunch?.(presetId);
  };

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-2xl mx-auto w-full">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
          Agent Hub
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Configure and launch agent presets
        </p>
      </div>

      {/* Preset grid — single column on mobile, 2-col on sm+ */}
      <section>
        <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
          Presets
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {AGENT_PRESETS.map((preset) => (
            <AgentPresetCard
              key={preset.id}
              preset={preset}
              onLaunch={handleLaunch}
            />
          ))}
        </div>
      </section>

      <Separator className="bg-zinc-800" />

      {/* Supported agents */}
      <section>
        <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
          Supported Agents
        </p>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_AGENTS.map((agent) => (
            <AgentHealthBadge
              key={agent.name}
              name={agent.name}
              installed={agent.installed}
            />
          ))}
        </div>
      </section>

      <Separator className="bg-zinc-800" />

      {/* Custom setup */}
      <section>
        <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
          Custom Setup
        </p>
        <div className="bg-[var(--surface)] border border-zinc-800 rounded-xl p-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Custom Agent Preset
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm leading-relaxed">
              Define your own agent count, shell commands, and guardrail level. Saved presets appear above.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0 gap-1.5 h-8"
            onClick={() => {
              // Placeholder — custom preset creation not yet implemented
            }}
          >
            <Plus size={13} />
            Create Custom
          </Button>
        </div>
      </section>
    </div>
  );
}
