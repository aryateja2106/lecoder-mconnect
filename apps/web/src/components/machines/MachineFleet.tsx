'use client';

import { Server } from 'lucide-react';
import { MachineCard } from './MachineCard';
import type { Machine } from '@/types/agent';

interface MachineFleetProps {
  machines: Machine[];
}

export function MachineFleet({ machines }: MachineFleetProps) {
  if (machines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-800 p-8 text-center">
        <Server className="h-8 w-8 text-zinc-700" />
        <p className="text-sm text-zinc-500">No machines connected</p>
        <p className="text-xs text-zinc-600">
          Run <code className="font-mono bg-zinc-900 px-1 py-0.5 rounded text-zinc-400">lecoder-mconnect start</code> on your machine
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {machines.map((machine) => (
        <MachineCard key={machine.id} machine={machine} />
      ))}
    </div>
  );
}
