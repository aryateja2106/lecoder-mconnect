'use client';

import { Download, Sparkles } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useFeedbackStore } from '@/stores/feedbackStore';
import { VoxHistoryItem } from '@/components/vox/VoxHistoryItem';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex-1 bg-[var(--surface)] border border-zinc-800 rounded-xl px-4 py-3 min-w-0">
      <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums leading-none">
        {value}
      </p>
    </div>
  );
}

export function FeedbackView() {
  const { interactions, accuracyByDay, totalCorrections, getAccuracy, exportCorrections } =
    useFeedbackStore();

  const accuracy = getAccuracy();

  const handleExport = () => {
    const json = exportCorrections();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vox-corrections-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isEmpty = interactions.length === 0;

  return (
    <div className="flex flex-col gap-6 px-4 py-6 max-w-2xl mx-auto w-full">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
            Feedback
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Your corrections improve the model
          </p>
        </div>
        {!isEmpty && (
          <Button
            size="sm"
            variant="secondary"
            onClick={handleExport}
            className="gap-1.5 shrink-0 h-8"
          >
            <Download size={13} />
            Export
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="flex gap-3">
        <StatCard label="Interactions" value={interactions.length} />
        <StatCard label="Accuracy" value={`${accuracy}%`} />
        <StatCard label="Corrections" value={totalCorrections} />
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
            <Sparkles size={22} className="text-[var(--agent-active)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">No feedback yet</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Start using Vox{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-400">
                ⌘K
              </kbd>{' '}
              to see your feedback here
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Accuracy chart */}
          {accuracyByDay.length > 1 && (
            <section>
              <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
                Accuracy Over Time
              </p>
              <div className="bg-[var(--surface)] border border-zinc-800 rounded-xl p-4">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={accuracyByDay} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => v.slice(5)} // MM-DD
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#1c1c21',
                        border: '1px solid #27272a',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: '#fafafa',
                      }}
                      formatter={(value) => [`${value}%`, 'Accuracy']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="accuracy"
                      stroke="#1fd5f9"
                      strokeWidth={2}
                      dot={{ fill: '#1fd5f9', r: 3, strokeWidth: 0 }}
                      activeDot={{ fill: '#1fd5f9', r: 5, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <Separator className="bg-zinc-800" />

          {/* Recent interactions */}
          <section>
            <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
              Recent Interactions
            </p>
            <ScrollArea className="max-h-[480px]">
              <div className="flex flex-col gap-2">
                {interactions.slice(0, 50).map((interaction) => (
                  <VoxHistoryItem key={interaction.id} interaction={interaction} />
                ))}
              </div>
            </ScrollArea>
          </section>
        </>
      )}
    </div>
  );
}
