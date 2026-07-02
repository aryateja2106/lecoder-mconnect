'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { normalizeServerMessage } from '@/lib/protocol-adapter';

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
  onTerminalOutput?: (data: string, agentId?: string) => void;
  onSystemNotice?: (message: string, tone: 'info' | 'warning' | 'danger') => void;
  onInputRejected?: (reason: string) => void;
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
    onTerminalOutput,
    onSystemNotice,
    onInputRejected,
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
    const normalized = normalizeServerMessage(message);

    switch (normalized.kind) {
      case 'session_info':
        setSessionInfo(normalized.session);
        setIsReadOnly(normalized.session.isReadOnly);
        setAttachedSessionId(normalized.session.id);
        break;

      case 'terminal_output':
        onTerminalOutput?.(normalized.data, normalized.agentId);
        break;

      case 'mode_changed':
        setIsReadOnly(normalized.isReadOnly);
        break;

      case 'approval_request':
        setPendingApproval({
          command: normalized.command,
          reason: normalized.reason,
        });
        // Vibrate on mobile if supported
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
        break;

      case 'command_blocked':
        onSystemNotice?.(`BLOCKED: ${normalized.command}\nReason: ${normalized.reason}`, 'danger');
        break;

      case 'system_notice':
        onSystemNotice?.(normalized.message, normalized.tone);
        break;

      case 'error':
        setError(normalized.message);
        break;

      case 'pong':
        // Connection alive
        break;

      // v2 Protocol messages
      case 'auth_success':
        setClientId(normalized.clientId);
        break;

      case 'session_list':
        setSessions(normalized.sessions as SessionSummary[]);
        break;

      case 'session_state':
        // Update session in list
        setSessions((prev) =>
          prev.map((s) =>
            s.id === normalized.sessionId
              ? { ...s, state: normalized.state as SessionSummary['state'], lastActivity: normalized.lastActivity ?? s.lastActivity }
              : s
          )
        );
        break;

      case 'control_status': {
        const controlMessage = normalized.message;
        const cs: ControlStatusState = {
          state: (controlMessage as { state: ControlStatusState['state'] }).state,
          activeClient: (controlMessage as { activeClient?: string }).activeClient,
          exclusiveExpires: (controlMessage as { exclusiveExpires?: number }).exclusiveExpires,
          lastPcActivity: (controlMessage as { lastPcActivity?: number }).lastPcActivity,
        };
        setControlStatus(cs);
        onControlStatus?.(cs);
        break;
      }

      case 'control_response':
        if (onControlResponse) {
          onControlResponse(normalized.message as unknown as ControlResponseMessage);
        }
        break;

      case 'scrollback_response':
        if (onScrollbackResponse) {
          onScrollbackResponse(normalized.message as unknown as ScrollbackMessage);
        }
        break;

      case 'input_rejected':
        onInputRejected?.(normalized.reason);
        onSystemNotice?.(`Input blocked: ${normalized.reason}`, 'warning');
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
        if (normalized.kind === 'unknown') {
          console.log('Unknown message type:', normalized.type);
        }
    }
  }, [onTerminalOutput, onSystemNotice, onInputRejected, onScrollbackResponse, onControlResponse, onControlStatus]);

  const sendMessage = useCallback((type: string, payload: Record<string, unknown>) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, ...payload, timestamp: Date.now() }));
    }
  }, []);

  const sendInput = useCallback(
    (data: string) => {
      sendMessage('terminal_input', { data });
    },
    [sendMessage]
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
