'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface SessionInfo {
  id: string;
  agent: string;
  isReadOnly: boolean;
  workDir: string;
}

interface ApprovalRequest {
  command: string;
  reason: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'unauthorized';

interface UseWebSocketReturn {
  status: ConnectionStatus;
  isConnected: boolean;
  isReadOnly: boolean;
  sessionInfo: SessionInfo | null;
  pendingApproval: ApprovalRequest | null;
  error: string | null;
  sendInput: (data: string) => void;
  toggleMode: () => void;
  sendKill: () => void;
  sendApproval: (approved: boolean, command: string) => void;
  reconnect: () => void;
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const pingInterval = useRef<NodeJS.Timeout | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (!url) return;

    // Don't reconnect if already connected
    if (ws.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    setError(null);

    try {
      const socket = new WebSocket(url);
      ws.current = socket;

      socket.onopen = () => {
        setStatus('connected');
        setError(null);
        console.log('WebSocket connected');

        // Start ping interval to keep connection alive
        pingInterval.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }
        }, 30000);
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      socket.onclose = (event) => {
        setStatus('disconnected');
        clearInterval(pingInterval.current!);

        if (event.code === 4001) {
          setStatus('unauthorized');
          setError('Invalid or expired session token');
        } else if (event.code !== 1000) {
          // Attempt reconnect for unexpected disconnections
          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, 3000);
        }

        console.log('WebSocket disconnected:', event.code, event.reason);
      };

      socket.onerror = () => {
        setStatus('error');
        setError('Connection failed. Make sure the CLI is running.');
      };
    } catch (e) {
      setStatus('error');
      setError('Failed to create WebSocket connection');
    }
  }, [url]);

  // Initial connection
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (pingInterval.current) {
        clearInterval(pingInterval.current);
      }
      ws.current?.close();
    };
  }, [connect]);

  const handleMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'session_info':
        setSessionInfo(message.payload);
        setIsReadOnly(message.payload.isReadOnly);
        break;

      case 'terminal_output':
        // Write to terminal if available
        if ((window as any).mconnectTerminal) {
          (window as any).mconnectTerminal.write(message.payload.data);
        }
        break;

      case 'mode_changed':
        setIsReadOnly(message.payload.isReadOnly);
        break;

      case 'approval_request':
        setPendingApproval({
          command: message.payload.command,
          reason: message.payload.reason,
        });
        // Vibrate on mobile if supported
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
        break;

      case 'command_blocked':
        if ((window as any).mconnectTerminal) {
          (window as any).mconnectTerminal.writeln(
            `\x1b[31m⛔ BLOCKED: ${message.payload.command}\x1b[0m`
          );
          (window as any).mconnectTerminal.writeln(
            `\x1b[90m   Reason: ${message.payload.reason}\x1b[0m`
          );
        }
        break;

      case 'process_exit':
        if ((window as any).mconnectTerminal) {
          (window as any).mconnectTerminal.writeln(
            `\x1b[33m\nProcess exited with code ${message.payload.code}\x1b[0m`
          );
        }
        break;

      case 'process_killed':
        if ((window as any).mconnectTerminal) {
          (window as any).mconnectTerminal.writeln(
            `\x1b[33m\n^C Process killed\x1b[0m`
          );
        }
        break;

      case 'error':
        setError(message.payload.message);
        break;

      case 'pong':
        // Connection alive
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }, []);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
    }
  }, []);

  const sendInput = useCallback((data: string) => {
    sendMessage('terminal_input', { input: data });
  }, [sendMessage]);

  const toggleMode = useCallback(() => {
    const newMode = !isReadOnly;
    sendMessage('mode_change', { readOnly: newMode });
    setIsReadOnly(newMode);
  }, [isReadOnly, sendMessage]);

  const sendKill = useCallback(() => {
    sendMessage('kill_signal', {});
  }, [sendMessage]);

  const sendApproval = useCallback((approved: boolean, command: string) => {
    sendMessage('approval_response', { approved, command });
    setPendingApproval(null);
  }, [sendMessage]);

  const reconnect = useCallback(() => {
    ws.current?.close();
    connect();
  }, [connect]);

  return {
    status,
    isConnected: status === 'connected',
    isReadOnly,
    sessionInfo,
    pendingApproval,
    error,
    sendInput,
    toggleMode,
    sendKill,
    sendApproval,
    reconnect,
  };
}
