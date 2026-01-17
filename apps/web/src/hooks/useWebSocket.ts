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

// v2 Protocol types
export interface SessionSummary {
  id: string;
  state: 'running' | 'paused' | 'completed';
  createdAt: number;
  lastActivity: number;
  connectedClients: number;
}

export interface ControlStatusState {
  state: 'pc_active' | 'pc_idle' | 'pc_disconnected' | 'mobile_exclusive';
  activeClient?: string;
  exclusiveExpires?: number;
  lastPcActivity?: number;
}

export interface ScrollbackMessage {
  lines: string[];
  fromLine: number;
  totalLines: number;
}

export interface ControlResponseMessage {
  granted: boolean;
  reason?: string;
  expiresAt?: number;
}

interface UseWebSocketOptions {
  clientType?: 'pc' | 'mobile';
  protocolVersion?: '1.0' | '2.0';
  onScrollbackResponse?: (message: ScrollbackMessage) => void;
  onControlResponse?: (message: ControlResponseMessage) => void;
  onControlStatus?: (message: ControlStatusState) => void;
}

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
  sendMessage: (type: string, payload: Record<string, unknown>) => void;
  // v2 Protocol additions
  clientId: string | null;
  clientType: 'pc' | 'mobile';
  sessions: SessionSummary[];
  controlStatus: ControlStatusState | null;
  attachedSessionId: string | null;
  attachToSession: (sessionId: string) => void;
  detachFromSession: () => void;
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    clientType = 'mobile',
    protocolVersion = '2.0',
    onScrollbackResponse,
    onControlResponse,
    onControlStatus,
  } = options;

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const pingInterval = useRef<NodeJS.Timeout | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  // v2 Protocol state
  const [clientId, setClientId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [controlStatus, setControlStatus] = useState<ControlStatusState | null>(null);
  const [attachedSessionId, setAttachedSessionId] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (!url) return;

    // Don't reconnect if already connected
    if (ws.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    setError(null);

    try {
      // Add protocol version and client type to URL
      const wsUrl = new URL(url);
      wsUrl.searchParams.set('v', protocolVersion);
      wsUrl.searchParams.set('clientType', clientType);

      const socket = new WebSocket(wsUrl.toString());
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
        if (pingInterval.current) {
          clearInterval(pingInterval.current);
        }

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
  }, [url, protocolVersion, clientType]);

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

  const handleMessage = useCallback((message: Record<string, unknown>) => {
    switch (message.type) {
      // v1 Protocol messages
      case 'session_info':
        // v1.0 protocol sends fields directly, not in payload
        // In v1, receiving session_info means we're connected to this session
        setSessionInfo({
          id: message.sessionId as string,
          agent: 'shell',
          isReadOnly: message.isReadOnly as boolean,
          workDir: '~',
        });
        setIsReadOnly(message.isReadOnly as boolean);
        // For v1 protocol, auto-attach since there's only one session
        setAttachedSessionId(message.sessionId as string);
        break;

      case 'terminal_output':
        // Write to terminal if available
        if ((window as any).mconnectTerminal) {
          (window as any).mconnectTerminal.write((message.payload as { data: string }).data);
        }
        break;

      case 'output':
        // v2 output message
        if ((window as any).mconnectTerminal) {
          (window as any).mconnectTerminal.write((message as { data: string }).data);
        }
        break;

      case 'mode_changed':
        setIsReadOnly((message as { isReadOnly: boolean }).isReadOnly);
        break;

      case 'approval_request':
        setPendingApproval({
          command: (message.payload as { command: string }).command,
          reason: (message.payload as { reason: string }).reason,
        });
        // Vibrate on mobile if supported
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
        break;

      case 'command_blocked':
        if ((window as any).mconnectTerminal) {
          const cmd = (message.payload as { command: string }).command;
          const reason = (message.payload as { reason: string }).reason;
          (window as any).mconnectTerminal.writeln(`\x1b[31m⛔ BLOCKED: ${cmd}\x1b[0m`);
          (window as any).mconnectTerminal.writeln(`\x1b[90m   Reason: ${reason}\x1b[0m`);
        }
        break;

      case 'process_exit':
        if ((window as any).mconnectTerminal) {
          (window as any).mconnectTerminal.writeln(
            `\x1b[33m\nProcess exited with code ${(message.payload as { code: number }).code}\x1b[0m`
          );
        }
        break;

      case 'process_killed':
        if ((window as any).mconnectTerminal) {
          (window as any).mconnectTerminal.writeln(`\x1b[33m\n^C Process killed\x1b[0m`);
        }
        break;

      case 'error':
        if (message.payload) {
          setError((message.payload as { message: string }).message);
        } else {
          setError((message as { message: string }).message);
        }
        break;

      case 'pong':
        // Connection alive
        break;

      // v2 Protocol messages
      case 'auth_success':
        setClientId((message as { clientId: string }).clientId);
        break;

      case 'session_list':
        setSessions((message as { sessions: SessionSummary[] }).sessions);
        break;

      case 'session_state':
        // Update session in list
        setSessions((prev) =>
          prev.map((s) =>
            s.id === (message as { sessionId: string }).sessionId
              ? { ...s, state: (message as { state: SessionSummary['state'] }).state }
              : s
          )
        );
        break;

      case 'control_status': {
        const cs: ControlStatusState = {
          state: (message as { state: ControlStatusState['state'] }).state,
          activeClient: (message as { activeClient?: string }).activeClient,
          exclusiveExpires: (message as { exclusiveExpires?: number }).exclusiveExpires,
          lastPcActivity: (message as { lastPcActivity?: number }).lastPcActivity,
        };
        setControlStatus(cs);
        onControlStatus?.(cs);
        break;
      }

      case 'control_response':
        if (onControlResponse) {
          onControlResponse(message as unknown as ControlResponseMessage);
        }
        break;

      case 'scrollback_response':
        if (onScrollbackResponse) {
          onScrollbackResponse(message as unknown as ScrollbackMessage);
        }
        break;

      case 'input_rejected':
        if ((window as any).mconnectTerminal) {
          const reason = (message as { reason: string }).reason;
          (window as any).mconnectTerminal.writeln(`\x1b[33m⚠ Input blocked: ${reason}\x1b[0m`);
        }
        break;

      case 'client_joined':
        console.log('Client joined:', (message as { client: { id: string } }).client);
        break;

      case 'client_left':
        console.log('Client left:', (message as { clientId: string }).clientId);
        break;

      case 'heartbeat':
        // Respond with heartbeat_ack
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(
            JSON.stringify({
              type: 'heartbeat_ack',
              timestamp: Date.now(),
            })
          );
        }
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }, [onScrollbackResponse, onControlResponse, onControlStatus]);

  const sendMessage = useCallback((type: string, payload: Record<string, unknown>) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, ...payload, timestamp: Date.now() }));
    }
  }, []);

  const sendInput = useCallback(
    (data: string) => {
      if (protocolVersion === '2.0') {
        sendMessage('terminal_input', { data });
      } else {
        sendMessage('terminal_input', { input: data });
      }
    },
    [sendMessage, protocolVersion]
  );

  const toggleMode = useCallback(() => {
    const newMode = !isReadOnly;
    sendMessage('mode_change', { readOnly: newMode });
    setIsReadOnly(newMode);
  }, [isReadOnly, sendMessage]);

  const sendKill = useCallback(() => {
    sendMessage('kill_signal', {});
  }, [sendMessage]);

  const sendApproval = useCallback(
    (approved: boolean, command: string) => {
      sendMessage('approval_response', { approved, command });
      setPendingApproval(null);
    },
    [sendMessage]
  );

  const reconnect = useCallback(() => {
    ws.current?.close();
    connect();
  }, [connect]);

  // v2 Protocol functions
  const attachToSession = useCallback(
    (sessionId: string) => {
      sendMessage('session_attach', { sessionId });
      setAttachedSessionId(sessionId);
    },
    [sendMessage]
  );

  const detachFromSession = useCallback(() => {
    sendMessage('session_detach', {});
    setAttachedSessionId(null);
    setControlStatus(null);
  }, [sendMessage]);

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
    sendMessage,
    // v2 Protocol additions
    clientId,
    clientType,
    sessions,
    controlStatus,
    attachedSessionId,
    attachToSession,
    detachFromSession,
  };
}
