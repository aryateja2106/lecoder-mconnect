'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Check, Pencil, X, AlertTriangle, Loader2, Command } from 'lucide-react';
import { useVoxStore } from '@/stores/voxStore';
import { useFeedbackStore } from '@/stores/feedbackStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function VoxPanelView() {
  const {
    isOpen, query, suggestion, history, isLoading, error,
    close, setQuery, submitQuery, acceptSuggestion, editSuggestion, rejectSuggestion,
  } = useVoxStore();
  const recordInteraction = useFeedbackStore((s) => s.recordInteraction);

  const inputRef = useRef<HTMLInputElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      void submitQuery(query.trim());
    }
  };

  const handleAccept = () => {
    if (suggestion) {
      recordInteraction({
        id: crypto.randomUUID(),
        query: suggestion.query,
        suggestedCommand: suggestion.command,
        userAction: 'accept',
        isDangerous: suggestion.isDangerous,
        model: suggestion.model,
        latencyMs: suggestion.latencyMs,
        timestamp: Date.now(),
      });
      acceptSuggestion();
    }
  };

  const handleEdit = () => {
    if (suggestion) {
      setEditMode(true);
      setEditValue(suggestion.command);
    }
  };

  const handleEditSubmit = () => {
    if (suggestion && editValue.trim()) {
      recordInteraction({
        id: crypto.randomUUID(),
        query: suggestion.query,
        suggestedCommand: suggestion.command,
        userAction: 'edit',
        editedCommand: editValue.trim(),
        isDangerous: suggestion.isDangerous,
        model: suggestion.model,
        latencyMs: suggestion.latencyMs,
        timestamp: Date.now(),
      });
      editSuggestion(editValue.trim());
      setEditMode(false);
    }
  };

  const handleReject = () => {
    if (suggestion) {
      recordInteraction({
        id: crypto.randomUUID(),
        query: suggestion.query,
        suggestedCommand: suggestion.command,
        userAction: 'reject',
        isDangerous: suggestion.isDangerous,
        model: suggestion.model,
        latencyMs: suggestion.latencyMs,
        timestamp: Date.now(),
      });
      rejectSuggestion();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed inset-x-4 top-20 z-50 max-w-lg mx-auto"
          >
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                <Sparkles size={16} className="text-[var(--agent-active)]" />
                <span className="text-sm font-semibold text-white">Vox</span>
                <span className="text-xs text-zinc-500">Natural language to shell</span>
                <button onClick={close} className="ml-auto p-1 hover:bg-zinc-800 rounded-lg">
                  <X size={14} className="text-zinc-500" />
                </button>
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="px-4 pb-3">
                <div className="flex items-center gap-2 bg-zinc-800 rounded-xl px-3 py-2.5 border border-zinc-700 focus-within:border-[var(--agent-active)]/50 transition-colors">
                  <Command size={14} className="text-zinc-500 shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="What do you want to do?"
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
                    disabled={isLoading}
                  />
                  {query.trim() && (
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="p-1 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      {isLoading ? (
                        <Loader2 size={14} className="text-[var(--agent-active)] animate-spin" />
                      ) : (
                        <ArrowRight size={14} className="text-[var(--agent-active)]" />
                      )}
                    </button>
                  )}
                </div>
              </form>

              {/* Error */}
              {error && (
                <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {error}
                </div>
              )}

              {/* Suggestion */}
              {suggestion && !editMode && (
                <div className="mx-4 mb-3">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5 px-1">
                    Suggested Command
                  </p>
                  <div className={cn(
                    'bg-zinc-950 rounded-xl p-3 border font-mono text-sm',
                    suggestion.isDangerous
                      ? 'border-[var(--agent-warning)]/30'
                      : 'border-zinc-700'
                  )}>
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-500 select-none">$</span>
                      <span className="text-[var(--agent-active)] break-all">{suggestion.command}</span>
                    </div>
                    {suggestion.isDangerous && (
                      <div className="flex items-center gap-1.5 mt-2 text-[var(--agent-warning)] text-xs">
                        <AlertTriangle size={12} />
                        <span>Destructive command — review carefully</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={handleAccept}
                      className="flex-1 gap-1.5 bg-[var(--agent-success)]/10 hover:bg-[var(--agent-success)]/20 text-[var(--agent-success)] border border-[var(--agent-success)]/20"
                    >
                      <Check size={13} /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleEdit}
                      className="flex-1 gap-1.5"
                    >
                      <Pencil size={13} /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleReject}
                      className="gap-1.5 px-3"
                    >
                      <X size={13} />
                    </Button>
                  </div>

                  {/* Feedback chip */}
                  <p className="text-[10px] text-zinc-600 text-center mt-2">
                    Your corrections help improve the model
                  </p>
                </div>
              )}

              {/* Edit mode */}
              {editMode && suggestion && (
                <div className="mx-4 mb-3">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5 px-1">
                    Edit Command
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 bg-zinc-950 rounded-lg px-3 py-2 text-sm font-mono text-white border border-zinc-700 outline-none focus:border-[var(--agent-active)]/50"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleEditSubmit()}
                    />
                    <Button size="sm" onClick={handleEditSubmit} className="gap-1">
                      <Check size={13} /> Save
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditMode(false)}
                    >
                      <X size={13} />
                    </Button>
                  </div>
                </div>
              )}

              {/* Recent history */}
              {!suggestion && !isLoading && history.length > 0 && (
                <div className="px-4 pb-3">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5 px-1">
                    Recent
                  </p>
                  <div className="space-y-1 max-h-32 overflow-auto">
                    {history.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setQuery(item.query);
                          void submitQuery(item.query);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        <p className="text-xs text-zinc-400 truncate">{item.query}</p>
                        <p className="text-[10px] font-mono text-zinc-600 truncate">
                          $ {item.editedCommand || item.suggestedCommand}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Latency indicator */}
              {suggestion && (
                <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-zinc-600">
                  <span>{suggestion.model}</span>
                  <span>{suggestion.latencyMs}ms</span>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
