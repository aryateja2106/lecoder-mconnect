'use client';

import { create } from 'zustand';
import type { VoxSuggestion, VoxInteraction } from '@/types/agent';

interface VoxStore {
  // State
  isOpen: boolean;
  query: string;
  suggestion: VoxSuggestion | null;
  history: VoxInteraction[];
  isLoading: boolean;
  error: string | null;

  // Actions
  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (query: string) => void;
  setSuggestion: (suggestion: VoxSuggestion | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Feedback actions
  acceptSuggestion: () => void;
  editSuggestion: (editedCommand: string) => void;
  rejectSuggestion: () => void;
  addInteraction: (interaction: VoxInteraction) => void;
  clearHistory: () => void;

  // Ollama interaction
  submitQuery: (query: string) => Promise<void>;
}

export const useVoxStore = create<VoxStore>((set, get) => ({
  // Initial state
  isOpen: false,
  query: '',
  suggestion: null,
  history: [],
  isLoading: false,
  error: null,

  // Panel actions
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, query: '', suggestion: null, error: null }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setQuery: (query) => set({ query }),
  setSuggestion: (suggestion) => set({ suggestion }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Feedback
  acceptSuggestion: () => {
    const { suggestion } = get();
    if (!suggestion) return;

    const interaction: VoxInteraction = {
      id: crypto.randomUUID(),
      query: suggestion.query,
      suggestedCommand: suggestion.command,
      userAction: 'accept',
      isDangerous: suggestion.isDangerous,
      model: suggestion.model,
      latencyMs: suggestion.latencyMs,
      timestamp: Date.now(),
    };

    set((state) => ({
      suggestion: null,
      query: '',
      history: [interaction, ...state.history].slice(0, 100),
    }));
  },

  editSuggestion: (editedCommand) => {
    const { suggestion } = get();
    if (!suggestion) return;

    const interaction: VoxInteraction = {
      id: crypto.randomUUID(),
      query: suggestion.query,
      suggestedCommand: suggestion.command,
      userAction: 'edit',
      editedCommand,
      isDangerous: suggestion.isDangerous,
      model: suggestion.model,
      latencyMs: suggestion.latencyMs,
      timestamp: Date.now(),
    };

    set((state) => ({
      suggestion: null,
      query: '',
      history: [interaction, ...state.history].slice(0, 100),
    }));
  },

  rejectSuggestion: () => {
    const { suggestion } = get();
    if (!suggestion) return;

    const interaction: VoxInteraction = {
      id: crypto.randomUUID(),
      query: suggestion.query,
      suggestedCommand: suggestion.command,
      userAction: 'reject',
      isDangerous: suggestion.isDangerous,
      model: suggestion.model,
      latencyMs: suggestion.latencyMs,
      timestamp: Date.now(),
    };

    set((state) => ({
      suggestion: null,
      query: '',
      history: [interaction, ...state.history].slice(0, 100),
    }));
  },

  addInteraction: (interaction) =>
    set((state) => ({
      history: [interaction, ...state.history].slice(0, 100),
    })),

  clearHistory: () => set({ history: [] }),

  // Ollama API call
  submitQuery: async (query) => {
    set({ isLoading: true, error: null, suggestion: null });

    const startTime = Date.now();
    const model = 'qwen2.5-coder:0.5b';
    const apiUrl = 'http://localhost:11434';

    try {
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `You are an expert shell programmer on ${navigator.platform.includes('Mac') ? 'macOS' : 'Linux'}. Given a natural language request, output ONLY the corresponding shell command. No explanations, no markdown, no code fences, no comments. Just the raw command.`,
            },
            { role: 'user', content: query },
          ],
          stream: false,
          options: { temperature: 0.1, num_predict: 256 },
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Model '${model}' not found. Run: ollama pull ${model}`);
        }
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      const raw = data?.message?.content ?? '';
      const command = cleanResponse(raw);
      const latencyMs = Date.now() - startTime;

      if (!command) {
        set({ isLoading: false, error: 'Could not translate. Try rephrasing.' });
        return;
      }

      const isDangerous = checkDangerous(command);

      set({
        isLoading: false,
        suggestion: { query, command, isDangerous, model, latencyMs },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to Ollama';
      if (message.includes('fetch') || message.includes('NetworkError') || message.includes('abort')) {
        set({ isLoading: false, error: 'Ollama not running. Start with: ollama serve' });
      } else {
        set({ isLoading: false, error: message });
      }
    }
  },
}));

// Clean LLM response artifacts
function cleanResponse(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:bash|sh|shell|zsh)?\n?/, '');
  cleaned = cleaned.replace(/\n?```$/, '');
  if (cleaned.startsWith('`') && cleaned.endsWith('`') && (cleaned.match(/`/g)?.length ?? 0) === 2) {
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = cleaned.replace(/^[$>]\s*/, '');
  cleaned = cleaned.replace(/^(?:Here (?:is|are) (?:the )?(?:command|script)s?:?\s*\n?)/i, '');
  const lines = cleaned.trim().split('\n');
  while (lines.length > 0 && lines[0].trim().startsWith('#')) {
    lines.shift();
  }
  cleaned = lines.join('\n').trim();
  return cleaned.length > 1000 ? '' : cleaned;
}

// Check for destructive commands
const DANGEROUS_PATTERNS = [
  /\brm\s+.*-\w*[rf]\w*/i,
  /\brm\s+-\w*R/i,
  /\bsudo\b/i,
  /\bdd\b\s+if=/i,
  /\bmkfs\b/i,
  /\bshred\b/i,
  /\bwipefs\b/i,
  /\b:\(\)\s*\{/,
  /\bchmod\s+777\b/i,
  />\s*\/dev\/sd[a-z]/i,
  /\bsystemctl\s+(stop|disable|mask)\b/i,
  /\bkillall\b/i,
  /\breboot\b/i,
  /\bshutdown\b/i,
  /\bpoweroff\b/i,
];

function checkDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(command));
}
