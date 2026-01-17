'use client';

import { useState, useCallback, useEffect } from 'react';

export interface QueuedCommand {
  id: string;
  command: string;
  timestamp: number;
  sessionId?: string;
}

interface UseOfflineQueueOptions {
  storageKey?: string;
  maxQueueSize?: number;
}

interface UseOfflineQueueReturn {
  queue: QueuedCommand[];
  isOffline: boolean;
  queueCommand: (command: string, sessionId?: string) => void;
  editCommand: (id: string, newCommand: string) => void;
  removeCommand: (id: string) => void;
  clearQueue: () => void;
  sendQueue: () => QueuedCommand[];
  setOffline: (offline: boolean) => void;
}

const STORAGE_KEY = 'mconnect_offline_queue';
const MAX_QUEUE_SIZE = 100;

export function useOfflineQueue(options: UseOfflineQueueOptions = {}): UseOfflineQueueReturn {
  const { storageKey = STORAGE_KEY, maxQueueSize = MAX_QUEUE_SIZE } = options;

  const [queue, setQueue] = useState<QueuedCommand[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as QueuedCommand[];
        setQueue(parsed);
      }
    } catch (e) {
      console.error('Failed to load offline queue:', e);
    }
  }, [storageKey]);

  // Save to localStorage when queue changes
  useEffect(() => {
    try {
      if (queue.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(queue));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (e) {
      console.error('Failed to save offline queue:', e);
    }
  }, [queue, storageKey]);

  // Queue a command
  const queueCommand = useCallback(
    (command: string, sessionId?: string) => {
      const newCommand: QueuedCommand = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        command,
        timestamp: Date.now(),
        sessionId,
      };

      setQueue((prev) => {
        const updated = [...prev, newCommand];
        // Limit queue size
        if (updated.length > maxQueueSize) {
          return updated.slice(-maxQueueSize);
        }
        return updated;
      });
    },
    [maxQueueSize]
  );

  // Edit a queued command
  const editCommand = useCallback((id: string, newCommand: string) => {
    setQueue((prev) =>
      prev.map((cmd) => (cmd.id === id ? { ...cmd, command: newCommand } : cmd))
    );
  }, []);

  // Remove a command from queue
  const removeCommand = useCallback((id: string) => {
    setQueue((prev) => prev.filter((cmd) => cmd.id !== id));
  }, []);

  // Clear entire queue
  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  // Send queue (returns commands and clears)
  const sendQueue = useCallback(() => {
    const commands = [...queue];
    setQueue([]);
    return commands;
  }, [queue]);

  // Set offline status
  const setOffline = useCallback((offline: boolean) => {
    setIsOffline(offline);
  }, []);

  return {
    queue,
    isOffline,
    queueCommand,
    editCommand,
    removeCommand,
    clearQueue,
    sendQueue,
    setOffline,
  };
}

export default useOfflineQueue;
