'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';

interface Autopilot {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  task: {
    title: string;
    body?: string;
    provider?: string;
    assigneeRuntimeId?: string;
  };
  createdAt: number;
  lastRunAt?: number;
  nextRunAt: number;
}

interface ListResponse {
  autopilots: Autopilot[];
}

function formatRel(ts: number): string {
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const future = diff > 0;
  const s = Math.floor(abs / 1000);
  if (s < 60) return future ? `in ${s}s` : `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return future ? `in ${m}m` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return future ? `in ${h}h` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return future ? `in ${d}d` : `${d}d ago`;
}

interface CreateModalProps {
  hubUrl: string;
  hubToken: string | null;
  onClose: () => void;
  onCreated: () => void;
}

function CreateModal({ hubUrl, hubToken, onClose, onCreated }: CreateModalProps) {
  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState('every 1h');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskBody, setTaskBody] = useState('');
  const [provider, setProvider] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!name.trim() || !taskTitle.trim()) {
      setError('Name and task title required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${hubUrl}/autopilots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(hubToken ? { Authorization: `Bearer ${hubToken}` } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          schedule: schedule.trim(),
          task: {
            title: taskTitle.trim(),
            body: taskBody.trim() || undefined,
            provider: provider.trim() || undefined,
          },
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Hub ${res.status}: ${text || res.statusText}`);
      }
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }, [name, schedule, taskTitle, taskBody, provider, hubUrl, hubToken, onClose, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">New autopilot</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="ap-name">
              Name
            </label>
            <input
              id="ap-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daily standup recap"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="ap-schedule">
              Schedule
            </label>
            <input
              id="ap-schedule"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="every 1h | daily 09:00 | hourly | every 30m"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500 font-mono"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Supported: <code>every Nm</code>, <code>every Nh</code>, <code>every Nd</code>,{' '}
              <code>daily HH:MM</code>, <code>hourly</code>
            </p>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="ap-task-title">
              Task title
            </label>
            <input
              id="ap-task-title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="post yesterday's commit summary"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="ap-body">
              Task body (optional)
            </label>
            <textarea
              id="ap-body"
              rows={3}
              value={taskBody}
              onChange={(e) => setTaskBody(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="ap-provider">
              Provider (optional)
            </label>
            <input
              id="ap-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="claude"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-500 text-zinc-950 hover:bg-cyan-400 disabled:bg-zinc-700 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={14} /> Creating...
              </>
            ) : (
              <>
                <Plus size={14} /> Create
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function AutopilotCard({
  ap,
  onToggle,
  onDelete,
}: {
  ap: Autopilot;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`rounded-xl bg-zinc-900 border p-4 ${
        ap.enabled ? 'border-zinc-800' : 'border-zinc-800/50 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-white">{ap.name}</h3>
          <p className="text-xs text-zinc-500">
            <code className="font-mono">{ap.schedule}</code>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggle}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
            title={ap.enabled ? 'Pause' : 'Resume'}
          >
            {ap.enabled ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="text-sm text-zinc-300 mt-2">{ap.task.title}</div>
      {ap.task.body && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{ap.task.body}</p>}

      <div className="flex items-center gap-3 mt-3 text-xs text-zinc-500">
        {ap.task.provider && <span>{ap.task.provider}</span>}
        <span className="ml-auto">next: {formatRel(ap.nextRunAt)}</span>
      </div>
    </div>
  );
}

export default function AutopilotsPage() {
  const [hubUrl, setHubUrl] = useState('');
  const [hubToken, setHubToken] = useState<string | null>(null);
  const [autopilots, setAutopilots] = useState<Autopilot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    setHubUrl(p.get('hub') || window.location.origin);
    setHubToken(p.get('token'));
  }, []);

  const refresh = useCallback(async () => {
    if (!hubUrl) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${hubUrl}/autopilots`, {
        headers: hubToken ? { Authorization: `Bearer ${hubToken}` } : {},
      });
      if (!res.ok) throw new Error(`Hub ${res.status}: ${res.statusText}`);
      const data = (await res.json()) as ListResponse;
      setAutopilots(data.autopilots);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [hubUrl, hubToken]);

  useEffect(() => {
    if (!hubUrl) return;
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [hubUrl, refresh]);

  const toggle = useCallback(
    async (ap: Autopilot) => {
      await fetch(`${hubUrl}/autopilots/${ap.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(hubToken ? { Authorization: `Bearer ${hubToken}` } : {}),
        },
        body: JSON.stringify({ enabled: !ap.enabled }),
      });
      refresh();
    },
    [hubUrl, hubToken, refresh]
  );

  const remove = useCallback(
    async (ap: Autopilot) => {
      if (!confirm(`Delete autopilot "${ap.name}"?`)) return;
      await fetch(`${hubUrl}/autopilots/${ap.id}`, {
        method: 'DELETE',
        headers: hubToken ? { Authorization: `Bearer ${hubToken}` } : {},
      });
      refresh();
    },
    [hubUrl, hubToken, refresh]
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="p-1 hover:bg-zinc-800 rounded transition-colors">
              <ArrowLeft size={18} className="text-zinc-400" />
            </a>
            <Calendar size={20} className="text-cyan-400" />
            <h1 className="text-lg font-semibold">Autopilots</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white"
              aria-label="Refresh"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold text-sm flex items-center gap-1.5"
            >
              <Plus size={14} /> New autopilot
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-400 mt-0.5" /> {error}
          </div>
        )}

        {loading && autopilots.length === 0 && (
          <div className="flex flex-col items-center py-12 text-zinc-500">
            <Loader2 size={28} className="animate-spin mb-2" />
            <p className="text-sm">Loading...</p>
          </div>
        )}

        {!loading && autopilots.length === 0 && (
          <div className="rounded-xl border border-zinc-800 p-8 text-center">
            <Calendar size={32} className="text-zinc-600 mx-auto mb-3" />
            <h3 className="text-base font-medium text-zinc-200 mb-1">No autopilots yet</h3>
            <p className="text-sm text-zinc-500">
              Schedule a recurring task to fire on its own.
            </p>
          </div>
        )}

        {autopilots.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-3">
            {autopilots.map((ap) => (
              <AutopilotCard
                key={ap.id}
                ap={ap}
                onToggle={() => toggle(ap)}
                onDelete={() => remove(ap)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal
          hubUrl={hubUrl}
          hubToken={hubToken}
          onClose={() => setShowCreate(false)}
          onCreated={refresh}
        />
      )}
    </main>
  );
}
