'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  onData?: (data: string) => void;
  isReadOnly: boolean;
}

/**
 * Special key sequences for terminal applications
 * These are ANSI escape sequences that TUI apps expect
 */
const KEY_SEQUENCES = {
  // Shift+Tab (reverse tab / backtab)
  SHIFT_TAB: '\x1b[Z',
  // Ctrl+F (form feed, but we send it as-is for apps that handle it)
  CTRL_F: '\x06',
  // Ctrl+C (interrupt)
  CTRL_C: '\x03',
  // Ctrl+D (EOF)
  CTRL_D: '\x04',
  // Ctrl+Z (suspend)
  CTRL_Z: '\x1a',
  // Ctrl+L (clear screen)
  CTRL_L: '\x0c',
  // Ctrl+A (beginning of line)
  CTRL_A: '\x01',
  // Ctrl+E (end of line)
  CTRL_E: '\x05',
  // Ctrl+K (kill to end of line)
  CTRL_K: '\x0b',
  // Ctrl+U (kill to beginning of line)
  CTRL_U: '\x15',
  // Ctrl+W (delete word backwards)
  CTRL_W: '\x17',
  // Ctrl+R (reverse search)
  CTRL_R: '\x12',
  // Escape
  ESCAPE: '\x1b',
} as const;

export function TerminalView({ onData, isReadOnly }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  /**
   * Handle special keyboard combinations that browsers typically intercept
   * This captures keys before the browser can handle them
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isReadOnly || !onData) return;

    // Shift+Tab - reverse tab navigation (important for Gemini CLI)
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      onData(KEY_SEQUENCES.SHIFT_TAB);
      return;
    }

    // Ctrl+F - browser find, but we need it for terminal apps
    if (e.key === 'f' && e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      onData(KEY_SEQUENCES.CTRL_F);
      return;
    }

    // Ctrl+K - browser shortcut on some systems, but needed for terminal
    if (e.key === 'k' && e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      onData(KEY_SEQUENCES.CTRL_K);
      return;
    }

    // Ctrl+L - some browsers use this, but terminal needs it for clear
    if (e.key === 'l' && e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      onData(KEY_SEQUENCES.CTRL_L);
      return;
    }

    // Ctrl+R - browser refresh, but terminal needs it for reverse search
    if (e.key === 'r' && e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      onData(KEY_SEQUENCES.CTRL_R);
      return;
    }

    // Ctrl+W - browser close tab, but terminal needs it for delete word
    if (e.key === 'w' && e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      onData(KEY_SEQUENCES.CTRL_W);
      return;
    }
  }, [isReadOnly, onData]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: !isReadOnly,
      cursorStyle: isReadOnly ? 'underline' : 'block',
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      theme: {
        background: '#191919',
        foreground: '#e9e9e7',
        cursor: '#e9e9e7',
        cursorAccent: '#191919',
        selectionBackground: '#3f3f46',
        black: '#191919',
        red: '#ef4444',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#22d3ee',
        white: '#e9e9e7',
        brightBlack: '#6b6b6b',
        brightRed: '#f87171',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#67e8f9',
        brightWhite: '#ffffff',
      },
      scrollback: 10000,
      convertEol: true,
      // Allow custom key handling
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    term.open(terminalRef.current);
    fitAddon.fit();

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Add keyboard listener to capture special keys
    const container = terminalRef.current;
    container.addEventListener('keydown', handleKeyDown, { capture: true });

    // Handle input (only if not read-only)
    if (!isReadOnly && onData) {
      term.onData((data) => {
        onData(data);
      });
    }

    setTerminal(term);

    // Write welcome message
    term.writeln('\x1b[36m┌─────────────────────────────────────┐\x1b[0m');
    term.writeln('\x1b[36m│\x1b[0m  \x1b[1mLeCoder MConnect\x1b[0m                  \x1b[36m│\x1b[0m');
    term.writeln('\x1b[36m│\x1b[0m  Terminal in your pocket            \x1b[36m│\x1b[0m');
    term.writeln('\x1b[36m└─────────────────────────────────────┘\x1b[0m');
    term.writeln('');
    term.writeln(`\x1b[33mMode: ${isReadOnly ? 'Read-Only' : 'Edit'}\x1b[0m`);
    term.writeln('\x1b[90mWaiting for terminal output...\x1b[0m');
    term.writeln('');

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('keydown', handleKeyDown, { capture: true });
      term.dispose();
    };
  }, [isReadOnly, onData, handleKeyDown]);

  // Expose write method
  useEffect(() => {
    if (terminal) {
      (window as any).mconnectTerminal = {
        write: (data: string) => terminal.write(data),
        writeln: (data: string) => terminal.writeln(data),
        clear: () => terminal.clear(),
      };
    }
  }, [terminal]);

  return (
    <div
      ref={terminalRef}
      className="w-full h-full bg-[var(--color-bg-primary)]"
      style={{ padding: '8px' }}
    />
  );
}

export default TerminalView;
