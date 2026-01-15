'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  onData?: (data: string) => void;
  isReadOnly: boolean;
}

export function TerminalView({ onData, isReadOnly }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: !isReadOnly,
      cursorStyle: isReadOnly ? 'underline' : 'block',
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      theme: {
        background: '#09090b',
        foreground: '#fafafa',
        cursor: '#fafafa',
        cursorAccent: '#09090b',
        selectionBackground: '#3f3f46',
        black: '#09090b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#fafafa',
        brightBlack: '#71717a',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      scrollback: 10000,
      convertEol: true,
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
      term.dispose();
    };
  }, [isReadOnly, onData]);

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
      className="w-full h-full bg-zinc-950"
      style={{ padding: '8px' }}
    />
  );
}

export default TerminalView;
