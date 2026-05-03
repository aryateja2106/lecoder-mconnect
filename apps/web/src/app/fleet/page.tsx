'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Server,
} from 'lucide-react';

interface FleetRuntime {
  id: string;
  name: string;
  hostname: string;
  platform: string;
  arch: string;
  user: string;
  version: string;
  status: 'online' | 'stale' | 'offline';
  registeredAt: number;
  lastHeartbeatAt: number;
}

interface FleetListResponse {
  runtimes: FleetRuntime[];
}

function formatRelative(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatusDot({ status }: { status: FleetRuntime['status'] }) {
  const colors: Record<FleetRuntime['status'], string> = {
    online: 'bg-green-500',
    stale: 'bg-yellow-500',
    offline: 'bg-red-500',
  };
  const labels: Record<FleetRuntime['status'], string> = {
    online: 'Online',
    stale: 'Stale',
    offline: 'Offline',
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
      <span className="text-zinc-300">{labels[status]}</span>
    </span>
  );
}

interface DispatchModalProps {
  runtime: FleetRuntime;
  hubUrl: string;
  hubToken: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

function DispatchModal({ runtime, hubUrl, hubToken, onClose, onSuccess }: DispatchModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [provider, setProvider] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${hubUrl}/fleet/${runtime.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(hubToken ? { Authorization: `Bearer ${hubToken}` } : {}),
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim() || undefined,
          provider: provider.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Hub ${res.status}: ${text || res.statusText}`);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dispatch task');
    } finally {
      setSubmitting(false);
    }
  }, [title, body, provider, hubUrl, hubToken, runtime.id, onClose, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Dispatch task</h2>
            <p className="text-sm text-zinc-400">to {runtime.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
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
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="fix flaky test in auth.spec.ts"
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
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="The flake started after PR #123 — failure is racey on Linux..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="provider">
              Provider hint (optional)
            </label>
            <input
              id="provider"
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="claude, codex, gemini..."
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
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-500 text-zinc-950 hover:bg-cyan-400 disabled:bg-zinc-700 disabled:text-zinc-500 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={14} /> Dispatching...
              </>
            ) : (
              <>
                <Plus size={14} /> Dispatch
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function FleetCard({
  runtime,
  onDispatch,
}: {
  runtime: FleetRuntime;
  onDispatch: () => void;
}) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Server size={16} className="text-cyan-400" />
            <span className="font-semibold text-white">{runtime.name}</span>
          </div>
          <code className="text-xs text-zinc-500">{runtime.id.slice(0, 16)}</code>
        </div>
        <StatusDot status={runtime.status} />
      </div>

      <dl className="text-xs space-y-1.5 mb-4">
        <div className="flex justify-between">
          <dt className="text-zinc-500">Host</dt>
          <dd className="text-zinc-300 font-mono">{runtime.hostname}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">Platform</dt>
          <dd className="text-zinc-300 font-mono">
            {runtime.platform}/{runtime.arch}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">User</dt>
          <dd className="text-zinc-300 font-mono">{runtime.user}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">Version</dt>
          <dd className="text-zinc-300 font-mono">{runtime.version}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">Heartbeat</dt>
          <dd className="text-zinc-300">{formatRelative(runtime.lastHeartbeatAt)}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onDispatch}
        disabled={runtime.status === 'offline'}
        className="w-full px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus size={14} /> Dispatch task
      </button>
    </div>
  );
}

export default function FleetPage() {
  const [runtimes, setRuntimes] = useState<FleetRuntime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hubUrl, setHubUrl] = useState('');
  const [hubToken, setHubToken] = useState<string | null>(null);
  const [dispatchTarget, setDispatchTarget] = useState<FleetRuntime | null>(null);

  // Resolve hub URL from query string (?hub=...&token=...) or fall back to same-origin.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const url = params.get('hub') || window.location.origin;
    const token = params.get('token');
    setHubUrl(url);
    setHubToken(token);
  }, []);

  const refresh = useCallback(async () => {
    if (!hubUrl) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${hubUrl}/fleet`, {
        headers: hubToken ? { Authorization: `Bearer ${hubToken}` } : {},
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Unauthorized — set ?token=... in the URL or pair via the CLI');
        }
        throw new Error(`Hub ${res.status}: ${res.statusText}`);
      }
      const data = (await res.json()) as FleetListResponse;
      setRuntimes(data.runtimes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fleet');
    } finally {
      setLoading(false);
    }
  }, [hubUrl, hubToken]);

  // Load on mount + every 10s
  useEffect(() => {
    if (!hubUrl) return;
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [hubUrl, refresh]);

  const sortedRuntimes = useMemo(() => {
    return [...runtimes].sort((a, b) => {
      const order: Record<FleetRuntime['status'], number> = { online: 0, stale: 1, offline: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return a.name.localeCompare(b.name);
    });
  }, [runtimes]);

  const onlineCount = sortedRuntimes.filter((r) => r.status === 'online').length;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="p-1 hover:bg-zinc-800 rounded transition-colors"
              aria-label="Back"
            >
              <ArrowLeft size={18} className="text-zinc-400" />
            </a>
            <Layers size={20} className="text-cyan-400" />
            <div>
              <h1 className="text-lg font-semibold leading-tight">Fleet</h1>
              <p className="text-xs text-zinc-500">
                {onlineCount} online · {sortedRuntimes.length} total
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
            aria-label="Refresh"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
            <AlertCircle className="text-red-400 mt-0.5" size={18} />
            <div>
              <div className="text-sm font-medium text-red-200">Couldn&apos;t load fleet</div>
              <div className="text-xs text-red-300 mt-0.5">{error}</div>
            </div>
          </div>
        )}

        {loading && sortedRuntimes.length === 0 && (
          <div className="flex flex-col items-center py-16 text-zinc-500">
            <Loader2 size={28} className="animate-spin mb-2" />
            <p className="text-sm">Loading fleet...</p>
          </div>
        )}

        {!loading && !error && sortedRuntimes.length === 0 && (
          <div className="rounded-xl border border-zinc-800 p-8 text-center">
            <Activity size={32} className="text-zinc-600 mx-auto mb-3" />
            <h3 className="text-base font-medium text-zinc-200 mb-1">No runtimes yet</h3>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto">
              Start a daemon with{' '}
              <code className="text-cyan-400">LECODER_HUB_URL={hubUrl} lecoder daemon start</code>{' '}
              and it will appear here.
            </p>
          </div>
        )}

        {sortedRuntimes.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedRuntimes.map((runtime) => (
              <FleetCard
                key={runtime.id}
                runtime={runtime}
                onDispatch={() => setDispatchTarget(runtime)}
              />
            ))}
          </div>
        )}
      </div>

      {dispatchTarget && (
        <DispatchModal
          runtime={dispatchTarget}
          hubUrl={hubUrl}
          hubToken={hubToken}
          onClose={() => setDispatchTarget(null)}
          onSuccess={refresh}
        />
      )}
    </main>
  );
}
