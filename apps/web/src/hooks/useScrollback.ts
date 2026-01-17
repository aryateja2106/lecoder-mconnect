'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface ScrollbackLine {
  sessionId: string;
  lineNumber: number;
  content: string;
  timestamp: number;
}

export interface ScrollbackState {
  lines: ScrollbackLine[];
  totalLines: number;
  loadedFromLine: number;
  isLoading: boolean;
  hasMore: boolean;
}

interface UseScrollbackOptions {
  sessionId?: string;
  initialLines?: number;
  loadMoreLines?: number;
  sendMessage?: (type: string, payload: Record<string, unknown>) => void;
}

interface UseScrollbackReturn {
  scrollback: ScrollbackState;
  loadMore: () => void;
  handleScrollbackResponse: (message: {
    lines: string[];
    fromLine: number;
    totalLines: number;
  }) => void;
  appendOutput: (data: string) => void;
  reset: () => void;
}

export function useScrollback(options: UseScrollbackOptions = {}): UseScrollbackReturn {
  const {
    sessionId,
    initialLines = 1000,
    loadMoreLines = 500,
    sendMessage,
  } = options;

  const [scrollback, setScrollback] = useState<ScrollbackState>({
    lines: [],
    totalLines: 0,
    loadedFromLine: 0,
    isLoading: false,
    hasMore: false,
  });

  const pendingRequest = useRef<boolean>(false);
  const outputBuffer = useRef<string>('');

  // Handle scrollback_response from server
  const handleScrollbackResponse = useCallback(
    (message: { lines: string[]; fromLine: number; totalLines: number }) => {
      const newLines: ScrollbackLine[] = message.lines.map((content, i) => ({
        sessionId: sessionId || '',
        lineNumber: message.fromLine + i,
        content,
        timestamp: Date.now(),
      }));

      setScrollback((prev) => {
        // Merge new lines with existing, avoiding duplicates
        const existingLineNumbers = new Set(prev.lines.map((l) => l.lineNumber));
        const uniqueNewLines = newLines.filter((l) => !existingLineNumbers.has(l.lineNumber));

        const allLines = [...uniqueNewLines, ...prev.lines].sort(
          (a, b) => a.lineNumber - b.lineNumber
        );

        const loadedFromLine = allLines.length > 0 ? allLines[0].lineNumber : 0;
        const hasMore = loadedFromLine > 0;

        return {
          lines: allLines,
          totalLines: message.totalLines,
          loadedFromLine,
          isLoading: false,
          hasMore,
        };
      });

      pendingRequest.current = false;
    },
    [sessionId]
  );

  // Load more scrollback (older lines)
  const loadMore = useCallback(() => {
    if (!sendMessage || !sessionId || scrollback.isLoading || pendingRequest.current) {
      return;
    }

    if (!scrollback.hasMore || scrollback.loadedFromLine === 0) {
      return;
    }

    const fromLine = Math.max(0, scrollback.loadedFromLine - loadMoreLines);
    const count = Math.min(loadMoreLines, scrollback.loadedFromLine);

    if (count <= 0) {
      return;
    }

    pendingRequest.current = true;
    setScrollback((prev) => ({ ...prev, isLoading: true }));

    sendMessage('scrollback_request', {
      sessionId,
      fromLine,
      count,
    });
  }, [sendMessage, sessionId, scrollback.isLoading, scrollback.hasMore, scrollback.loadedFromLine, loadMoreLines]);

  // Append new output (for live terminal data)
  const appendOutput = useCallback(
    (data: string) => {
      // Accumulate output and split by newlines
      outputBuffer.current += data;
      const lines = outputBuffer.current.split('\n');

      // Keep the last part if it doesn't end with newline (partial line)
      if (!outputBuffer.current.endsWith('\n')) {
        outputBuffer.current = lines.pop() || '';
      } else {
        outputBuffer.current = '';
      }

      if (lines.length === 0) {
        return;
      }

      setScrollback((prev) => {
        const startLineNumber = prev.totalLines;
        const newLines: ScrollbackLine[] = lines.map((content, i) => ({
          sessionId: sessionId || '',
          lineNumber: startLineNumber + i,
          content,
          timestamp: Date.now(),
        }));

        return {
          ...prev,
          lines: [...prev.lines, ...newLines],
          totalLines: prev.totalLines + lines.length,
        };
      });
    },
    [sessionId]
  );

  // Reset scrollback state
  const reset = useCallback(() => {
    setScrollback({
      lines: [],
      totalLines: 0,
      loadedFromLine: 0,
      isLoading: false,
      hasMore: false,
    });
    outputBuffer.current = '';
    pendingRequest.current = false;
  }, []);

  return {
    scrollback,
    loadMore,
    handleScrollbackResponse,
    appendOutput,
    reset,
  };
}

export default useScrollback;
