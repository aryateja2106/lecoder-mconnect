'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  XCircle,
} from 'lucide-react';

type TaskStatus = 'queued' | 'dispatched' | 'running' | 'completed' | 'failed' | 'cancelled';

interface Task {
  id: string;
  title: string;
  body?: string;
  status: TaskStatus;
  provider?: string;
  assigneeRuntimeId?: string;
  createdAt: number;
  updatedAt: number;
}

interface ListResponse {
  tasks: Task[];
}

function formatRel(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'completed') return <CheckCircle2 size={14} className="text-green-400" />;
  if (status === 'failed') return <XCircle size={14} className="text-red-400" />;
  if (status === 'running' || status === 'dispatched')
    return <Loader2 size={14} className="text-cyan-400 animate-spin" />;
  if (status === 'cancelled') return <XCircle size={14} className="text-zinc-500" />;
  return <Circle size={14} className="text-zinc-500" />;
}

function TaskRow({ task }: { task: Task }) {
  return (
    <a
      href={`/tasks/${task.id}`}
      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-cyan-500/50 transition-colors"
    >
      <StatusIcon status={task.status} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white truncate">{task.title}</div>
        <div className="text-xs text-zinc-500 truncate">
          <code className="text-zinc-400">{task.id.slice(0, 8)}</code>
          {task.provider && <span className="ml-2">· {task.provider}</span>}
          {task.assigneeRuntimeId && (
            <span className="ml-2">· runtime {task.assigneeRuntimeId.slice(0, 8)}</span>
          )}
        </div>
      </div>
      <div className="text-xs text-zinc-500 shrink-0">{formatRel(task.createdAt)}</div>
    </a>
  );
}

interface CreateModalProps {
  hubUrl: string;
  hubToken: string | null;
  onClose: () => void;
  onCreated: () => void;
}

function CreateModal({ hubUrl, hubToken, onClose, onCreated }: CreateModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [provider, setProvider] = useState('');
  const [runtime, setRuntime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!title.trim()) {
      setErr('Title required');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(`${hubUrl}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(hubToken ? { Authorization: `Bearer ${hubToken}` } : {}),
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim() || undefined,
          provider: provider.trim() || undefined,
          assigneeRuntimeId: runtime.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Hub ${res.status}: ${text || res.statusText}`);
      }
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }, [title, body, provider, runtime, hubUrl, hubToken, onClose, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">New task</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="fix flaky test"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="body">
              Description (optional)
            </label>
            <textarea
              id="body"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1" htmlFor="provider">
                Provider
              </label>
              <input
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="claude"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1" htmlFor="runtime">
                Runtime ID
              </label>
              <input
                id="runtime"
                value={runtime}
                onChange={(e) => setRuntime(e.target.value)}
                placeholder="(any)"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {err && (
            <div className="text-sm text-red-400 flex items-center gap-2">
              <AlertCircle size={14} /> {err}
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

export default function TasksPage() {
  const [hubUrl, setHubUrl] = useState('');
  const [hubToken, setHubToken] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setHubUrl(params.get('hub') || window.location.origin);
    setHubToken(params.get('token'));
  }, []);

  const refresh = useCallback(async () => {
    if (!hubUrl) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${hubUrl}/tasks`, {
        headers: hubToken ? { Authorization: `Bearer ${hubToken}` } : {},
      });
      if (!res.ok) throw new Error(`Hub ${res.status}: ${res.statusText}`);
      const data = (await res.json()) as ListResponse;
      setTasks(data.tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [hubUrl, hubToken]);

  useEffect(() => {
    if (!hubUrl) return;
    refresh();
    const id = setInterval(refresh, 8_000);
    return () => clearInterval(id);
  }, [hubUrl, refresh]);

  const filtered = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="p-1 hover:bg-zinc-800 rounded transition-colors">
              <ArrowLeft size={18} className="text-zinc-400" />
            </a>
            <ClipboardList size={20} className="text-cyan-400" />
            <h1 className="text-lg font-semibold">Tasks</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
              aria-label="Refresh"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold text-sm flex items-center gap-1.5"
            >
              <Plus size={14} /> New task
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {(['all', 'queued', 'dispatched', 'running', 'completed', 'failed', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === s
                  ? 'bg-cyan-500 text-zinc-950'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-400 mt-0.5" /> {error}
          </div>
        )}

        {loading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 text-zinc-500">
            <Loader2 size={28} className="animate-spin mb-2" />
            <p className="text-sm">Loading tasks...</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-zinc-800 p-8 text-center">
            <ClipboardList size={32} className="text-zinc-600 mx-auto mb-3" />
            <h3 className="text-base font-medium text-zinc-200 mb-1">No tasks yet</h3>
            <p className="text-sm text-zinc-500">Create one with the button above.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((t) => (
              <TaskRow key={t.id} task={t} />
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
