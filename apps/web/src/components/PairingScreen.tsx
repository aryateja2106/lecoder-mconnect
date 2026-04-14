'use client';

import { useState, useRef, useCallback } from 'react';
import { KeyRound, Loader2, Terminal, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PairingScreenProps {
  serverUrl: string;
  onSuccess: (token: string) => void;
  recentSessionId?: string | null;
  onShowHistory?: () => void;
}

export function PairingScreen({ serverUrl, onSuccess, recentSessionId, onShowHistory }: PairingScreenProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleInput = useCallback((index: number, value: string) => {
    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (char.length > 1) {
      // Paste handling
      const chars = char.split('').slice(0, 6);
      const newCode = [...code];
      chars.forEach((c, i) => {
        if (index + i < 6) newCode[index + i] = c;
      });
      setCode(newCode);
      setError(null);
      const focusIndex = Math.min(index + chars.length, 5);
      inputRefs.current[focusIndex]?.focus();
    } else {
      const newCode = [...code];
      newCode[index] = char;
      setCode(newCode);
      setError(null);
      if (char && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  }, [code]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      void handleSubmit();
    }
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6 || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${serverUrl}/api/pair?code=${encodeURIComponent(fullCode)}`);
      const data = await res.json() as { token?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? 'Invalid code');
      }

      if (data.token) {
        onSuccess(data.token);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg === 'code_expired' ? 'Code expired. Get a new one from terminal.' : 'Invalid code. Please try again.');
      setIsSubmitting(false);
      inputRefs.current[0]?.focus();
    }
  }, [code, isSubmitting, serverUrl, onSuccess]);

  const isComplete = code.every(c => c.length === 1);

  return (
    <main className="min-h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center p-6">
      {/* App branding */}
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Terminal size={18} className="text-cyan-400" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">MConnect</span>
        </div>
        <p className="text-zinc-500 text-sm">Terminal in your pocket</p>
      </div>

      {/* Main pairing card */}
      <div className="w-full max-w-sm">
        <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl shadow-black/50">
          {/* Subtle glow effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none" />

          {/* Icon + title */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-4">
              <KeyRound size={24} className="text-cyan-400" />
            </div>
            <h1 className="text-lg font-semibold text-white mb-1.5">Enter Pairing Code</h1>
            <p className="text-zinc-400 text-sm">
              Enter the 6-character code shown in your terminal
            </p>
          </div>

          {/* Code input cells */}
          <div className="flex gap-2 justify-center mb-6">
            {code.map((char, idx) => (
              <input
                key={idx}
                ref={el => { inputRefs.current[idx] = el; }}
                type="text"
                inputMode="text"
                maxLength={6}
                value={char}
                onChange={(e) => handleInput(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={cn(
                  'w-11 h-13 bg-zinc-950 border-2 rounded-xl text-center text-xl font-bold font-mono text-white uppercase outline-none transition-all select-none',
                  'focus:scale-105',
                  error
                    ? 'border-red-500/70 bg-red-500/5'
                    : char
                      ? 'border-cyan-400/60 bg-cyan-400/5'
                      : 'border-zinc-700 focus:border-cyan-400'
                )}
                style={{ height: '52px' }}
                autoFocus={idx === 0}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            ))}
          </div>

          {/* Error message */}
          {error && (
            <p className="text-red-400 text-sm text-center mb-4 animate-in fade-in slide-in-from-top-1">
              {error}
            </p>
          )}

          {/* Connect button */}
          <Button
            onClick={() => void handleSubmit()}
            disabled={!isComplete || isSubmitting}
            className="w-full h-11 bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-semibold text-sm transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wifi size={16} />
                Connect
              </>
            )}
          </Button>

          {/* Hint */}
          <p className="text-zinc-600 text-xs text-center mt-5">
            Run <code className="text-cyan-400 font-mono">mconnect</code> in your terminal to get a code
          </p>
        </div>

        {/* Recent session shortcut */}
        {recentSessionId && onShowHistory && (
          <button
            onClick={onShowHistory}
            className="w-full mt-3 py-3 px-4 rounded-xl border border-zinc-800 bg-zinc-900/50 text-zinc-400 text-sm text-center hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            View recent sessions
          </button>
        )}
      </div>
    </main>
  );
}

export default PairingScreen;
