'use client';

import { Terminal, Bot, Layers, GitBranch, Box } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AgentPreset } from '@/types/agent';

const ICON_MAP: Record<string, LucideIcon> = {
  terminal: Terminal,
  bot: Bot,
  layers: Layers,
  'git-branch': GitBranch,
  container: Box,
};

interface AgentPresetCardProps {
  preset: AgentPreset;
  onLaunch: (presetId: string) => void;
}

export function AgentPresetCard({ preset, onLaunch }: AgentPresetCardProps) {
  const Icon = ICON_MAP[preset.icon] ?? Terminal;

  return (
    <div className="bg-[var(--surface)] border border-zinc-800 rounded-xl p-4 flex flex-col gap-3 hover:border-zinc-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-800 shrink-0">
            <Icon size={18} className="text-[var(--agent-active)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight">
              {preset.name}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              {preset.agentCount} {preset.agentCount === 1 ? 'agent' : 'agents'}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {preset.agentCount}
        </Badge>
      </div>

      {/* Description */}
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
        {preset.description}
      </p>

      {/* Tags + Launch */}
      <div className="flex items-center justify-between gap-2 mt-auto">
        <div className="flex flex-wrap gap-1">
          {preset.tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-medium border',
                tag === 'recommended'
                  ? 'bg-[var(--agent-active)]/10 text-[var(--agent-active)] border-[var(--agent-active)]/20'
                  : 'bg-zinc-800/60 text-zinc-500 border-zinc-700/50'
              )}
            >
              {tag}
            </span>
          ))}
        </div>
        <Button
          size="sm"
          onClick={() => onLaunch(preset.id)}
          className="shrink-0 h-7 px-3 text-xs bg-[var(--agent-active)]/10 hover:bg-[var(--agent-active)]/20 text-[var(--agent-active)] border border-[var(--agent-active)]/20"
        >
          Launch
        </Button>
      </div>
    </div>
  );
}
