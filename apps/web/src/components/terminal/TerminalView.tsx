'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { TerminalInputSource } from '@/lib/analytics';

export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface TerminalViewApi {
  write: (data: string) => void;
  writeln: (data: string) => void;
  clear: () => void;
  focus: () => void;
  paste: (data: string) => void;
  fit: () => TerminalSize;
  getSize: () => TerminalSize;
}

interface TerminalViewProps {
  readOnly?: boolean;
  isReadOnly?: boolean;
  onInput?: (data: string, source: TerminalInputSource) => void;
  onData?: (data: string) => void;
  onResize?: (size: TerminalSize) => void;
  onReady?: (api: TerminalViewApi) => void;
  connectionState?: 'connected' | 'reconnecting' | 'disconnected';
  reservedBottomPx?: number;
  className?: string;
}

function terminalTone(tone: 'info' | 'warning' | 'danger') {
  if (tone === 'danger') return '\x1b[31m';
  if (tone === 'warning') return '\x1b[33m';
  return '\x1b[90m';
}

export function TerminalView({
  readOnly,
  isReadOnly,
  onInput,
  onData,
  onResize,
  onReady,
  reservedBottomPx = 0,
  className = '',
}: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const readOnlyRef = useRef(readOnly ?? isReadOnly ?? true);
  const onInputRef = useRef(onInput);
  const onDataRef = useRef(onData);
  const onResizeRef = useRef(onResize);

  const effectiveReadOnly = readOnly ?? isReadOnly ?? true;

  useEffect(() => {
    readOnlyRef.current = effectiveReadOnly;
    const term = terminalInstanceRef.current;
    if (term) {
      term.options.cursorBlink = !effectiveReadOnly;
      term.options.cursorStyle = effectiveReadOnly ? 'underline' : 'block';
    }
  }, [effectiveReadOnly]);

  useEffect(() => {
    onInputRef.current = onInput;
    onDataRef.current = onData;
    onResizeRef.current = onResize;
  }, [onInput, onData, onResize]);

  const emitResize = useCallback(() => {
    const term = terminalInstanceRef.current;
    if (!term) return { cols: 0, rows: 0 };
    const size = { cols: term.cols, rows: term.rows };
    onResizeRef.current?.(size);
    return size;
  }, []);

  const fit = useCallback(() => {
    const term = terminalInstanceRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return { cols: 0, rows: 0 };
    fitAddon.fit();
    return emitResize();
  }, [emitResize]);

  const send = useCallback((data: string, source: TerminalInputSource) => {
    if (readOnlyRef.current) return;
    onInputRef.current?.(data, source);
    onDataRef.current?.(data);
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;
    if (terminalInstanceRef.current) return;

    const term = new Terminal({
      cursorBlink: !readOnlyRef.current,
      cursorStyle: readOnlyRef.current ? 'underline' : 'block',
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
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;
    terminalInstanceRef.current = term;

    term.open(terminalRef.current);
    fit();

    const handleResize = () => {
      fit();
    };
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);

    term.onData((data) => send(data, 'keyboard'));
    term.onResize(({ cols, rows }) => onResizeRef.current?.({ cols, rows }));

    const api: TerminalViewApi = {
      write: (data: string) => term.write(data),
      writeln: (data: string) => term.writeln(data),
      clear: () => term.clear(),
      focus: () => term.focus(),
      paste: (data: string) => send(data, 'paste'),
      fit,
      getSize: () => ({ cols: term.cols, rows: term.rows }),
    };
    onReady?.(api);

    term.writeln('\x1b[90mMConnect terminal ready. Waiting for session output...\x1b[0m');

    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
      term.dispose();
      terminalInstanceRef.current = null;
      fitAddonRef.current = null;
    };
  }, [fit, onReady, send]);

  useEffect(() => {
    fit();
  }, [reservedBottomPx, fit]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain');
      if (!text || readOnlyRef.current) return;
      event.preventDefault();
      send(text, 'paste');
    };

    terminalRef.current?.addEventListener('paste', onPaste);
    return () => terminalRef.current?.removeEventListener('paste', onPaste);
  }, [send]);

  return (
    <div
      ref={terminalRef}
      className={`h-full w-full bg-black ${className}`}
      data-readonly={effectiveReadOnly || undefined}
      style={{
        padding: '8px',
        paddingBottom: `calc(${reservedBottomPx}px + 8px)`,
        touchAction: 'pan-y',
      }}
    />
  );
}

export default TerminalView;
export { terminalTone };
