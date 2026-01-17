'use client';

import { useState } from 'react';
import { Send, Trash2, Edit2, X, Check, AlertTriangle } from 'lucide-react';
import type { QueuedCommand } from '../hooks/useOfflineQueue';

interface OfflineQueueProps {
  queue: QueuedCommand[];
  onEdit: (id: string, newCommand: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onSend: () => void;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function OfflineQueue({
  queue,
  onEdit,
  onRemove,
  onClear,
  onSend,
}: OfflineQueueProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);

  const startEdit = (cmd: QueuedCommand) => {
    setEditingId(cmd.id);
    setEditValue(cmd.command);
  };

  const saveEdit = () => {
    if (editingId && editValue.trim()) {
      onEdit(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  if (queue.length === 0) {
    return null;
  }

  return (
    <>
      {/* Queue Panel */}
      <div className="fixed bottom-20 left-0 right-0 bg-zinc-900 border-t border-zinc-700 max-h-[40vh] overflow-hidden flex flex-col z-30">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-yellow-500/10 border-b border-zinc-700">
          <div className="flex items-center gap-2 text-yellow-400">
            <AlertTriangle size={16} />
            <span className="font-medium text-sm">
              {queue.length} queued command{queue.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <Trash2 size={14} />
              Clear
            </button>
            <button
              onClick={() => setShowSendConfirm(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-500 transition-colors"
            >
              <Send size={14} />
              Send All
            </button>
          </div>
        </div>

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto">
          {queue.map((cmd) => (
            <div
              key={cmd.id}
              className="flex items-start gap-3 px-4 py-2 border-b border-zinc-800 hover:bg-zinc-800/50"
            >
              <span className="text-xs text-zinc-500 pt-1 whitespace-nowrap">
                {formatTime(cmd.timestamp)}
              </span>

              {editingId === cmd.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 bg-zinc-700 text-white px-2 py-1 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                  <button
                    onClick={saveEdit}
                    className="p-1 text-green-400 hover:text-green-300"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-1 text-zinc-400 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <code className="flex-1 text-sm font-mono text-zinc-300 break-all">
                    {cmd.command}
                  </code>
                  <button
                    onClick={() => startEdit(cmd)}
                    className="p-1 text-zinc-500 hover:text-white"
                    title="Edit command"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => onRemove(cmd.id)}
                    className="p-1 text-zinc-500 hover:text-red-400"
                    title="Remove command"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Clear Queue?</h3>
            <p className="text-zinc-400 text-sm mb-6">
              This will discard all {queue.length} queued command{queue.length !== 1 ? 's' : ''}.
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 text-white font-medium text-sm hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowClearConfirm(false);
                  onClear();
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-500 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Confirmation Modal */}
      {showSendConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Send Queued Commands?</h3>
            <p className="text-zinc-400 text-sm mb-4">
              This will send {queue.length} command{queue.length !== 1 ? 's' : ''} to the terminal
              in order.
            </p>
            <p className="text-zinc-500 text-xs mb-6">
              Make sure you're in the right context before sending.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSendConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 text-white font-medium text-sm hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSendConfirm(false);
                  onSend();
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-500 transition-colors"
              >
                Send All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default OfflineQueue;
