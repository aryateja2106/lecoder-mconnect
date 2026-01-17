'use client';

import { useState, useCallback, useEffect } from 'react';

export type ArbiterState = 'pc_active' | 'pc_idle' | 'pc_disconnected' | 'mobile_exclusive';

export interface ControlStatus {
  state: ArbiterState;
  activeClient?: string;
  exclusiveExpires?: number;
  lastPcActivity?: number;
  canTakeControl: boolean;
  hasExclusiveControl: boolean;
  exclusiveTimeRemaining?: number;
}

interface UseControlStateOptions {
  clientId?: string;
  clientType?: 'pc' | 'mobile';
  sendMessage?: (type: string, payload: Record<string, unknown>) => void;
}

interface UseControlStateReturn {
  controlStatus: ControlStatus;
  requestExclusiveControl: () => void;
  releaseControl: () => void;
  updateControlStatus: (message: Record<string, unknown>) => void;
  handleControlResponse: (message: { granted: boolean; reason?: string; expiresAt?: number }) => void;
  isPending: boolean;
  lastError?: string;
}

export function useControlState(options: UseControlStateOptions = {}): UseControlStateReturn {
  const { clientId, clientType = 'mobile', sendMessage } = options;

  const [controlStatus, setControlStatus] = useState<ControlStatus>({
    state: 'pc_disconnected',
    canTakeControl: false,
    hasExclusiveControl: false,
  });
  const [isPending, setIsPending] = useState(false);
  const [lastError, setLastError] = useState<string | undefined>();

  // Update exclusive time remaining
  useEffect(() => {
    if (!controlStatus.exclusiveExpires) return;

    const updateRemaining = () => {
      const remaining = controlStatus.exclusiveExpires! - Date.now();
      setControlStatus((prev) => ({
        ...prev,
        exclusiveTimeRemaining: remaining > 0 ? remaining : 0,
      }));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [controlStatus.exclusiveExpires]);

  // Handle control_status messages from server
  const updateControlStatus = useCallback(
    (message: Record<string, unknown>) => {
      const state = message.state as ArbiterState;
      const activeClient = message.activeClient as string | undefined;
      const exclusiveExpires = message.exclusiveExpires as number | undefined;
      const lastPcActivity = message.lastPcActivity as number | undefined;

      // Determine if this client can take control
      // Mobile can take control when PC is active but not exclusive
      const canTakeControl =
        clientType === 'mobile' &&
        state === 'pc_active' &&
        activeClient !== clientId;

      // Check if this client has exclusive control
      const hasExclusiveControl = state === 'mobile_exclusive' && activeClient === clientId;

      setControlStatus({
        state,
        activeClient,
        exclusiveExpires,
        lastPcActivity,
        canTakeControl,
        hasExclusiveControl,
        exclusiveTimeRemaining: exclusiveExpires ? exclusiveExpires - Date.now() : undefined,
      });
    },
    [clientId, clientType]
  );

  // Handle control_response messages from server
  const handleControlResponse = useCallback(
    (message: { granted: boolean; reason?: string; expiresAt?: number }) => {
      setIsPending(false);

      if (!message.granted) {
        setLastError(message.reason);
      } else {
        setLastError(undefined);
      }
    },
    []
  );

  // Request exclusive control
  const requestExclusiveControl = useCallback(() => {
    if (!sendMessage || isPending) return;

    setIsPending(true);
    setLastError(undefined);
    sendMessage('control_request', { action: 'exclusive' });
  }, [sendMessage, isPending]);

  // Release control
  const releaseControl = useCallback(() => {
    if (!sendMessage || isPending) return;

    setIsPending(true);
    setLastError(undefined);
    sendMessage('control_request', { action: 'release' });
  }, [sendMessage, isPending]);

  return {
    controlStatus,
    requestExclusiveControl,
    releaseControl,
    updateControlStatus,
    handleControlResponse,
    isPending,
    lastError,
  };
}

export default useControlState;
