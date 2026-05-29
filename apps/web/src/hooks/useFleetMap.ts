'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * useFleetMap — fetch the runtime registry once and expose a lookup helper.
 *
 * Both /tasks and /tasks/[id] need to render runtime *names* (e.g. "demo-laptop"),
 * but the task records only carry the raw runtime UUID. Rather than have each
 * page re-implement the same fetch, we share a tiny hook that resolves IDs to
 * names with a graceful UUID-prefix fallback.
 *
 * The hook re-fetches every 30s so a renamed or newly-registered runtime shows
 * up without a manual refresh. The cost is tiny — /fleet is an in-memory list
 * keyed by user.
 */

interface FleetRuntime {
  id: string;
  name: string;
  hostname: string;
  status: 'online' | 'stale' | 'offline';
}

interface FleetListResponse {
  runtimes: FleetRuntime[];
}

export interface FleetMap {
  /** Friendly name for a runtime, or a short UUID prefix when unknown. */
  nameFor(runtimeId: string | undefined | null): string;
  /** Status, or null when the runtime is unknown to the hub. */
  statusFor(runtimeId: string | undefined | null): FleetRuntime['status'] | null;
  /** True until the first successful fetch completes. */
  loading: boolean;
}

export function useFleetMap(hubUrl: string, hubToken: string | null): FleetMap {
  const [runtimes, setRuntimes] = useState<Map<string, FleetRuntime>>(new Map());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!hubUrl) return;
    try {
      const res = await fetch(`${hubUrl}/fleet`, {
        headers: hubToken ? { Authorization: `Bearer ${hubToken}` } : {},
      });
      if (!res.ok) return;
      const data = (await res.json()) as FleetListResponse;
      const next = new Map<string, FleetRuntime>();
      for (const rt of data.runtimes) next.set(rt.id, rt);
      setRuntimes(next);
    } catch {
      // Swallow — the consuming page already reports its own fetch errors.
    } finally {
      setLoading(false);
    }
  }, [hubUrl, hubToken]);

  useEffect(() => {
    if (!hubUrl) return;
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [hubUrl, refresh]);

  const nameFor = useCallback(
    (runtimeId: string | undefined | null): string => {
      if (!runtimeId) return '';
      const hit = runtimes.get(runtimeId);
      if (hit) return hit.name;
      return runtimeId.slice(0, 8);
    },
    [runtimes]
  );

  const statusFor = useCallback(
    (runtimeId: string | undefined | null): FleetRuntime['status'] | null => {
      if (!runtimeId) return null;
      return runtimes.get(runtimeId)?.status ?? null;
    },
    [runtimes]
  );

  return { nameFor, statusFor, loading };
}
