'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react';

type TaskStatus = 'queued' | 'dispatched' | 'running' | 'completed' | 'failed' | 'cancelled';
type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled';
type CommentKind = 'human' | 'agent' | 'system';

interface Task {
  id: string;
  title: string;
  body?: string;
  status: TaskStatus;
  provider?: string;
  assigneeRuntimeId?: string;
  workingDirectory?: string;
  worktreePath?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

interface Run {
  id: string;
  taskId: string;
  status: RunStatus;
  exitCode?: number;
  worktreePath?: string;
  iteration: number;
  startedAt: number;
  endedAt?: number;
}

interface Comment {
  id: string;
  taskId: string;
  authorKind: CommentKind;
  body: string;
  createdAt: number;
}

interface DetailResponse {
  task: Task;
  runs: Run[];
  comments: Comment[];
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

function StatusPill({ status }: { status: TaskStatus | RunStatus }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    queued: {
      label: 'Queued',
      cls: 'bg-zinc-800 text-zinc-300',
      icon: <Circle size={12} />,
    },
    dispatched: {
      label: 'Dispatched',
      cls: 'bg-blue-500/20 text-blue-400',
      icon: <Loader2 size={12} className="animate-spin" />,
    },
    running: {
      label: 'Running',
      cls: 'bg-cyan-500/20 text-cyan-400',
      icon: <Loader2 size={12} className="animate-spin" />,
    },
    completed: {
      label: 'Completed',
      cls: 'bg-green-500/20 text-green-400',
      icon: <CheckCircle2 size={12} />,
    },
    failed: {
      label: 'Failed',
      cls: 'bg-red-500/20 text-red-400',
      icon: <XCircle size={12} />,
    },
    cancelled: {
      label: 'Cancelled',
      cls: 'bg-zinc-800 text-zinc-400',
      icon: <XCircle size={12} />,
    },
  };
  const entry = map[status] ?? map.queued;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${entry.cls}`}
    >
      {entry.icon}
      {entry.label}
    </span>
  );
}

function CommentBubble({ comment }: { comment: Comment }) {
  const palette: Record<CommentKind, string> = {
    human: 'border-cyan-500/40 bg-cyan-500/5',
    agent: 'border-purple-500/40 bg-purple-500/5',
    system: 'border-zinc-700 bg-zinc-900',
  };
  const labelPalette: Record<CommentKind, string> = {
    human: 'text-cyan-400',
    agent: 'text-purple-400',
    system: 'text-zinc-400',
  };
  return (
    <div className={`rounded-xl border p-3 ${palette[comment.authorKind]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-medium uppercase tracking-wide ${labelPalette[comment.authorKind]}`}>
          {comment.authorKind}
        </span>
        <span className="text-xs text-zinc-500">{formatRel(comment.createdAt)} ago</span>
      </div>
      <p className="text-sm text-zinc-200 whitespace-pre-wrap">{comment.body}</p>
    </div>
  );
}

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const taskId = params?.id ?? '';
  const [hubUrl, setHubUrl] = useState('');
  const [hubToken, setHubToken] = useState<string | null>(null);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    setHubUrl(p.get('hub') || window.location.origin);
    setHubToken(p.get('token'));
  }, []);

  const refresh = useCallback(async () => {
    if (!hubUrl || !taskId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${hubUrl}/tasks/${taskId}`, {
        headers: hubToken ? { Authorization: `Bearer ${hubToken}` } : {},
      });
      if (!res.ok) throw new Error(`Hub ${res.status}: ${res.statusText}`);
      setData((await res.json()) as DetailResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [hubUrl, hubToken, taskId]);

  useEffect(() => {
    if (!hubUrl) return;
    refresh();
    const id = setInterval(refresh, 5_000);
    return () => clearInterval(id);
  }, [hubUrl, refresh]);

  const cancelTask = useCallback(async () => {
    if (!confirm('Cancel this task?')) return;
    await fetch(`${hubUrl}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: hubToken ? { Authorization: `Bearer ${hubToken}` } : {},
    });
    refresh();
  }, [hubUrl, hubToken, taskId, refresh]);

  const sendComment = useCallback(async () => {
    if (!commentBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${hubUrl}/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(hubToken ? { Authorization: `Bearer ${hubToken}` } : {}),
        },
        body: JSON.stringify({ body: commentBody.trim() }),
      });
      if (res.ok) {
        setCommentBody('');
        refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }, [commentBody, hubUrl, hubToken, taskId, refresh]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <a href="/tasks" className="p-1 hover:bg-zinc-800 rounded transition-colors">
            <ArrowLeft size={18} className="text-zinc-400" />
          </a>
          <h1 className="text-lg font-semibold">Task</h1>
          <button
            type="button"
            onClick={refresh}
            className="ml-auto p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-400 mt-0.5" /> {error}
          </div>
        )}

        {!data && loading && (
          <div className="flex flex-col items-center py-12 text-zinc-500">
            <Loader2 size={28} className="animate-spin mb-2" />
            <p className="text-sm">Loading...</p>
          </div>
        )}

        {data && (
          <>
            <section className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="text-xl font-semibold leading-tight">{data.task.title}</h2>
                <StatusPill status={data.task.status} />
              </div>
              <code className="block text-xs text-zinc-500 mb-3">{data.task.id}</code>
              {data.task.body && (
                <p className="text-sm text-zinc-300 whitespace-pre-wrap mb-4">{data.task.body}</p>
              )}

              <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
                {data.task.provider && (
                  <>
                    <dt className="text-zinc-500">Provider</dt>
                    <dd className="text-zinc-300 font-mono">{data.task.provider}</dd>
                  </>
                )}
                {data.task.assigneeRuntimeId && (
                  <>
                    <dt className="text-zinc-500">Runtime</dt>
                    <dd className="text-zinc-300 font-mono">{data.task.assigneeRuntimeId}</dd>
                  </>
                )}
                {data.task.workingDirectory && (
                  <>
                    <dt className="text-zinc-500">Working dir</dt>
                    <dd className="text-zinc-300 font-mono">{data.task.workingDirectory}</dd>
                  </>
                )}
                {data.task.worktreePath && (
                  <>
                    <dt className="text-zinc-500">Worktree</dt>
                    <dd className="text-zinc-300 font-mono">{data.task.worktreePath}</dd>
                  </>
                )}
                <dt className="text-zinc-500">Created</dt>
                <dd className="text-zinc-300">{formatRel(data.task.createdAt)} ago</dd>
                {data.task.completedAt && (
                  <>
                    <dt className="text-zinc-500">Completed</dt>
                    <dd className="text-zinc-300">{formatRel(data.task.completedAt)} ago</dd>
                  </>
                )}
              </dl>

              {(data.task.status === 'queued' ||
                data.task.status === 'dispatched' ||
                data.task.status === 'running') && (
                <button
                  type="button"
                  onClick={cancelTask}
                  className="mt-4 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium"
                >
                  Cancel task
                </button>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-zinc-300 mb-2">Runs ({data.runs.length})</h3>
              {data.runs.length === 0 ? (
                <p className="text-sm text-zinc-500">No runs yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.runs.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 flex items-center gap-3"
                    >
                      <span className="text-xs text-zinc-500 w-12">#{r.iteration}</span>
                      <StatusPill status={r.status} />
                      {r.exitCode !== undefined && (
                        <span className="text-xs text-zinc-500">exit={r.exitCode}</span>
                      )}
                      <span className="text-xs text-zinc-500 ml-auto">
                        {formatRel(r.startedAt)} ago
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
                <MessageSquare size={14} /> Comments ({data.comments.length})
              </h3>
              <div className="space-y-2 mb-3">
                {data.comments.map((c) => (
                  <CommentBubble key={c.id} comment={c} />
                ))}
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Add a comment..."
                  rows={2}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500 resize-none"
                />
                <button
                  type="button"
                  onClick={sendComment}
                  disabled={submitting || !commentBody.trim()}
                  className="px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-700 text-zinc-950 font-semibold text-sm"
                  aria-label="Post comment"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
