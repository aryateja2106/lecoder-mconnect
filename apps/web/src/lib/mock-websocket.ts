/**
 * MockWebSocket - Simulates WebSocket for Demo Mode
 *
 * Implements the browser WebSocket interface to enable demo mode
 * without requiring a real CLI connection. Plays back pre-recorded
 * terminal sessions with realistic timing.
 *
 * MConnect v0.2.0
 */

import type { DemoSession, DemoFrame, DemoScenario } from '../data/demo-session';
import { getDefaultDemoSession, getAllDemoSessions, getDemoSession } from '../data/demo-session';

// ============================================
// Types
// ============================================

export interface MockWebSocketOptions {
  /** Demo scenario to play */
  scenario?: DemoScenario;
  /** Playback speed multiplier (1.0 = normal, 2.0 = 2x speed) */
  playbackSpeed?: number;
  /** Whether to loop playback when finished */
  loop?: boolean;
  /** Initial session ID to start with */
  initialSessionId?: string;
  /** Callback when approval is requested */
  onApprovalRequest?: (command: string, reason: string) => void;
}

export type MockWebSocketState = 'connecting' | 'open' | 'closing' | 'closed';

export type PlaybackState = 'playing' | 'paused' | 'stopped';

// ============================================
// MockWebSocket Class
// ============================================

/**
 * MockWebSocket simulates the browser WebSocket API for demo mode.
 *
 * Usage:
 * ```ts
 * const ws = new MockWebSocket('wss://demo', { playbackSpeed: 1.0 });
 * ws.onopen = () => console.log('Connected');
 * ws.onmessage = (e) => console.log('Message:', e.data);
 * ws.connect();
 * ```
 */
export class MockWebSocket {
  // ============================================
  // WebSocket Interface Properties
  // ============================================

  /** WebSocket readyState constants */
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = MockWebSocket.CONNECTING;
  readonly OPEN = MockWebSocket.OPEN;
  readonly CLOSING = MockWebSocket.CLOSING;
  readonly CLOSED = MockWebSocket.CLOSED;

  /** Current connection state */
  readyState: number = MockWebSocket.CONNECTING;

  /** URL (for compatibility) */
  readonly url: string;

  /** Binary type (for compatibility) */
  binaryType: BinaryType = 'blob';

  /** Buffered amount (always 0 for mock) */
  readonly bufferedAmount: number = 0;

  /** Extensions (empty for mock) */
  readonly extensions: string = '';

  /** Protocol (empty for mock) */
  readonly protocol: string = '';

  // ============================================
  // Event Handlers
  // ============================================

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  // ============================================
  // Private Properties
  // ============================================

  private options: Required<MockWebSocketOptions>;
  private currentSession: DemoSession;
  private allSessions: DemoSession[];
  private frameIndex: number = 0;
  private startTime: number = 0;
  private pausedAt: number = 0;
  private playbackState: PlaybackState = 'stopped';
  private frameTimers: Map<number, NodeJS.Timeout> = new Map();
  private pendingApproval: { command: string; reason: string } | null = null;
  private approvalResolvedAt: number | null = null;

  // ============================================
  // Constructor
  // ============================================

  constructor(url: string, options: MockWebSocketOptions = {}) {
    this.url = url;
    this.options = {
      scenario: options.scenario ?? {
        sessions: getAllDemoSessions(),
        defaultSessionId: getDefaultDemoSession().id,
      },
      playbackSpeed: options.playbackSpeed ?? 1.0,
      loop: options.loop ?? false,
      initialSessionId: options.initialSessionId ?? getDefaultDemoSession().id,
      onApprovalRequest: options.onApprovalRequest ?? (() => {}),
    };

    this.allSessions = this.options.scenario.sessions;
    this.currentSession = getDemoSession(this.options.initialSessionId) ?? getDefaultDemoSession();
  }

  // ============================================
  // Public Methods - WebSocket Interface
  // ============================================

  /**
   * Connect and start the demo session.
   * Simulates the WebSocket connection handshake.
   */
  connect(): void {
    if (this.readyState !== MockWebSocket.CONNECTING) {
      return;
    }

    // Simulate connection delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;

      // Fire onopen event
      if (this.onopen) {
        this.onopen(new Event('open'));
      }

      // Send initial protocol messages
      this.sendInitialMessages();

      // Start frame playback
      this.startPlayback();
    }, 100);
  }

  /**
   * Send a message to the mock server.
   * Handles client messages like approval_response, mode_change, ping.
   */
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new DOMException('WebSocket is not open', 'InvalidStateError');
    }

    try {
      const message = JSON.parse(data as string);
      this.handleClientMessage(message);
    } catch {
      // Ignore parse errors for non-JSON messages
    }
  }

  /**
   * Close the WebSocket connection.
   */
  close(code?: number, reason?: string): void {
    if (this.readyState === MockWebSocket.CLOSED) {
      return;
    }

    this.readyState = MockWebSocket.CLOSING;
    this.stopPlayback();

    // Simulate close delay
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;

      if (this.onclose) {
        const closeEvent = new CloseEvent('close', {
          code: code ?? 1000,
          reason: reason ?? 'Normal closure',
          wasClean: true,
        });
        this.onclose(closeEvent);
      }
    }, 50);
  }

  // ============================================
  // Public Methods - Playback Control
  // ============================================

  /**
   * Pause playback at current position.
   */
  pause(): void {
    if (this.playbackState !== 'playing') {
      return;
    }

    this.playbackState = 'paused';
    this.pausedAt = Date.now() - this.startTime;

    // Clear all pending frame timers
    this.frameTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.frameTimers.clear();
  }

  /**
   * Resume playback from paused position.
   */
  resume(): void {
    if (this.playbackState !== 'paused') {
      return;
    }

    this.playbackState = 'playing';
    this.startTime = Date.now() - this.pausedAt;

    // Schedule remaining frames
    this.scheduleRemainingFrames();
  }

  /**
   * Seek to a specific timestamp in the session.
   * @param timestamp - Milliseconds from session start
   */
  seek(timestamp: number): void {
    // Stop current playback
    this.stopPlayback();

    // Find the frame index closest to timestamp
    this.frameIndex = 0;
    for (let i = 0; i < this.currentSession.frames.length; i++) {
      if (this.currentSession.frames[i].timestamp <= timestamp) {
        this.frameIndex = i;
      } else {
        break;
      }
    }

    // Replay all frames up to this point instantly
    this.replayFramesUpTo(this.frameIndex);

    // Set start time to simulate we started at this position
    this.startTime = Date.now() - timestamp;
    this.playbackState = 'playing';

    // Schedule remaining frames
    this.scheduleRemainingFrames();
  }

  /**
   * Restart playback from the beginning.
   */
  restart(): void {
    this.stopPlayback();
    this.frameIndex = 0;
    this.pendingApproval = null;
    this.approvalResolvedAt = null;

    // Clear terminal (send clear sequence)
    this.fireMessage({
      type: 'output',
      data: '\x1b[2J\x1b[H', // Clear screen and move cursor to home
    });

    // Send initial messages again
    this.sendInitialMessages();

    // Start playback
    this.startPlayback();
  }

  /**
   * Switch to a different demo session.
   * @param sessionId - ID of the session to switch to
   */
  switchSession(sessionId: string): void {
    const newSession = getDemoSession(sessionId);
    if (!newSession) {
      console.warn(`Session not found: ${sessionId}`);
      return;
    }

    // Stop current playback
    this.stopPlayback();

    // Switch session
    this.currentSession = newSession;
    this.frameIndex = 0;
    this.pendingApproval = null;
    this.approvalResolvedAt = null;

    // Clear terminal
    this.fireMessage({
      type: 'output',
      data: '\x1b[2J\x1b[H',
    });

    // Send session change notification
    this.fireMessage({
      type: 'session_info',
      sessionId: newSession.id,
      isReadOnly: true,
    });

    // Start new session playback
    this.startPlayback();
  }

  // ============================================
  // Public Getters
  // ============================================

  /**
   * Get current playback state.
   */
  getPlaybackState(): PlaybackState {
    return this.playbackState;
  }

  /**
   * Get current timestamp in milliseconds.
   */
  getCurrentTimestamp(): number {
    if (this.playbackState === 'stopped') {
      return 0;
    }
    if (this.playbackState === 'paused') {
      return this.pausedAt;
    }
    return Date.now() - this.startTime;
  }

  /**
   * Get total duration of current session.
   */
  getTotalDuration(): number {
    return this.currentSession.duration;
  }

  /**
   * Get current session ID.
   */
  getCurrentSessionId(): string {
    return this.currentSession.id;
  }

  /**
   * Get all available sessions.
   */
  getAllSessions(): DemoSession[] {
    return this.allSessions;
  }

  /**
   * Check if there's a pending approval.
   */
  hasPendingApproval(): boolean {
    return this.pendingApproval !== null;
  }

  // ============================================
  // Private Methods - Message Handling
  // ============================================

  /**
   * Send initial protocol messages when connection opens.
   */
  private sendInitialMessages(): void {
    // Send auth_success
    this.fireMessage({
      type: 'auth_success',
      clientId: 'demo-client-1',
      protocolVersion: '2.0',
      clientType: 'mobile',
    });

    // Send session_list
    this.fireMessage({
      type: 'session_list',
      sessions: this.allSessions.map((s) => ({
        id: s.id,
        state: 'running',
        createdAt: Date.now() - s.duration,
        lastActivity: Date.now(),
        agentConfig: {
          preset: s.preset,
          agents: [s.agentType],
        },
        workingDirectory: '~/projects/demo',
        connectedClients: 1,
      })),
    });

    // Send session_info for current session (v1 compatibility)
    this.fireMessage({
      type: 'session_info',
      sessionId: this.currentSession.id,
      isReadOnly: true,
    });

    // Send agent_list
    this.fireMessage({
      type: 'agent_list',
      agents: [
        {
          id: `${this.currentSession.agentType}-1`,
          name: this.currentSession.name,
          type: this.currentSession.agentType,
          status: 'active',
        },
      ],
    });
  }

  /**
   * Handle incoming client messages.
   */
  private handleClientMessage(message: Record<string, unknown>): void {
    switch (message.type) {
      case 'ping':
        this.fireMessage({ type: 'pong' });
        break;

      case 'approval_response':
        this.handleApprovalResponse(message as { approved: boolean; command: string });
        break;

      case 'mode_change':
        // Echo back mode change
        this.fireMessage({
          type: 'mode_changed',
          isReadOnly: message.readOnly as boolean,
        });
        break;

      case 'session_attach':
        this.switchSession(message.sessionId as string);
        break;

      case 'session_detach':
        // No-op in demo mode
        break;

      case 'terminal_input':
        // In demo mode, we don't process input - it's read-only
        this.fireMessage({
          type: 'input_rejected',
          reason: 'read_only',
        });
        break;

      case 'heartbeat_ack':
        // No-op
        break;

      default:
        console.log('[MockWebSocket] Unknown message type:', message.type);
    }
  }

  /**
   * Handle approval response from client.
   */
  private handleApprovalResponse(message: { approved: boolean; command: string }): void {
    if (!this.pendingApproval) {
      return;
    }

    // Record when approval was resolved
    this.approvalResolvedAt = this.getCurrentTimestamp();

    // Clear pending approval
    const approval = this.pendingApproval;
    this.pendingApproval = null;

    // Send resolution output
    if (message.approved) {
      this.fireMessage({
        type: 'output',
        data: `\n\x1b[32m✓\x1b[0m \x1b[92mApproved\x1b[0m by mobile user\n\n`,
      });
    } else {
      this.fireMessage({
        type: 'output',
        data: `\n\x1b[31m✗\x1b[0m \x1b[91mDenied\x1b[0m by mobile user\n`,
      });
      this.fireMessage({
        type: 'output',
        data: `\x1b[90mCommand not executed: ${approval.command}\x1b[0m\n`,
      });
    }

    // Resume playback if approved
    if (message.approved && this.playbackState === 'paused') {
      this.resume();
    }
  }

  // ============================================
  // Private Methods - Playback
  // ============================================

  /**
   * Start frame playback.
   */
  private startPlayback(): void {
    this.playbackState = 'playing';
    this.startTime = Date.now();
    this.frameIndex = 0;
    this.scheduleAllFrames();
  }

  /**
   * Stop frame playback.
   */
  private stopPlayback(): void {
    this.playbackState = 'stopped';

    // Clear all pending timers
    this.frameTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.frameTimers.clear();
  }

  /**
   * Schedule all frames for playback.
   */
  private scheduleAllFrames(): void {
    const frames = this.currentSession.frames;

    for (let i = 0; i < frames.length; i++) {
      this.scheduleFrame(i, frames[i]);
    }

    // Schedule end of session
    this.scheduleEndOfSession();
  }

  /**
   * Schedule remaining frames from current index.
   */
  private scheduleRemainingFrames(): void {
    const frames = this.currentSession.frames;
    const currentTime = this.getCurrentTimestamp();

    for (let i = this.frameIndex; i < frames.length; i++) {
      const frame = frames[i];
      if (frame.timestamp > currentTime) {
        this.scheduleFrame(i, frame);
      }
    }

    // Schedule end of session
    this.scheduleEndOfSession();
  }

  /**
   * Schedule a single frame for playback.
   */
  private scheduleFrame(index: number, frame: DemoFrame): void {
    const adjustedTimestamp = frame.timestamp / this.options.playbackSpeed;
    const currentTime = this.getCurrentTimestamp() / this.options.playbackSpeed;
    const delay = Math.max(0, adjustedTimestamp - currentTime);

    const timer = setTimeout(() => {
      this.frameTimers.delete(index);
      this.playFrame(frame);
      this.frameIndex = index + 1;
    }, delay);

    this.frameTimers.set(index, timer);
  }

  /**
   * Schedule end of session handling.
   */
  private scheduleEndOfSession(): void {
    const duration = this.currentSession.duration / this.options.playbackSpeed;
    const currentTime = this.getCurrentTimestamp() / this.options.playbackSpeed;
    const delay = Math.max(0, duration - currentTime + 100);

    const timer = setTimeout(() => {
      if (this.options.loop) {
        this.restart();
      } else {
        this.playbackState = 'stopped';
      }
    }, delay);

    this.frameTimers.set(-1, timer);
  }

  /**
   * Play a single frame.
   */
  private playFrame(frame: DemoFrame): void {
    switch (frame.type) {
      case 'output':
        this.fireMessage({
          type: 'output',
          data: frame.content,
        });
        break;

      case 'agent_info':
        this.fireMessage({
          type: 'session_info',
          sessionId: frame.metadata?.sessionId ?? this.currentSession.id,
          isReadOnly: frame.metadata?.isReadOnly ?? true,
        });
        break;

      case 'approval':
        this.handleApprovalFrame(frame);
        break;

      case 'status':
        if (frame.content === 'approval_resolved' && frame.metadata?.approved) {
          // This is handled by user interaction, skip if not already resolved
          if (!this.approvalResolvedAt) {
            // Auto-approve after timeout for demo purposes
            this.handleApprovalResponse({
              approved: true,
              command: frame.metadata.command ?? '',
            });
          }
        }
        break;

      case 'input':
        // Input frames are informational only in demo mode
        break;
    }
  }

  /**
   * Handle approval request frame.
   */
  private handleApprovalFrame(frame: DemoFrame): void {
    const command = frame.metadata?.command ?? 'unknown command';
    const reason = frame.metadata?.reason ?? 'Command requires approval';

    this.pendingApproval = { command, reason };

    // Send approval_request message
    this.fireMessage({
      type: 'approval_request',
      payload: {
        command,
        reason,
      },
    });

    // Notify via callback
    this.options.onApprovalRequest(command, reason);

    // Pause playback until approval
    this.pause();
  }

  /**
   * Replay all frames up to a given index instantly (for seeking).
   */
  private replayFramesUpTo(targetIndex: number): void {
    // Clear terminal first
    this.fireMessage({
      type: 'output',
      data: '\x1b[2J\x1b[H',
    });

    // Replay output frames
    for (let i = 0; i <= targetIndex; i++) {
      const frame = this.currentSession.frames[i];
      if (frame.type === 'output') {
        this.fireMessage({
          type: 'output',
          data: frame.content,
        });
      }
    }
  }

  // ============================================
  // Private Methods - Event Firing
  // ============================================

  /**
   * Fire a message event to the onmessage handler.
   */
  private fireMessage(data: Record<string, unknown>): void {
    if (!this.onmessage || this.readyState !== MockWebSocket.OPEN) {
      return;
    }

    const messageEvent = new MessageEvent('message', {
      data: JSON.stringify(data),
    });

    this.onmessage(messageEvent);
  }

  // ============================================
  // EventTarget Interface (minimal)
  // ============================================

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    _options?: boolean | AddEventListenerOptions
  ): void {
    const handler = typeof listener === 'function' ? listener : listener.handleEvent.bind(listener);

    switch (type) {
      case 'open':
        this.onopen = handler as (event: Event) => void;
        break;
      case 'close':
        this.onclose = handler as (event: CloseEvent) => void;
        break;
      case 'message':
        this.onmessage = handler as (event: MessageEvent) => void;
        break;
      case 'error':
        this.onerror = handler as (event: Event) => void;
        break;
    }
  }

  removeEventListener(
    type: string,
    _listener: EventListenerOrEventListenerObject,
    _options?: boolean | EventListenerOptions
  ): void {
    switch (type) {
      case 'open':
        this.onopen = null;
        break;
      case 'close':
        this.onclose = null;
        break;
      case 'message':
        this.onmessage = null;
        break;
      case 'error':
        this.onerror = null;
        break;
    }
  }

  dispatchEvent(_event: Event): boolean {
    // Minimal implementation
    return true;
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create a MockWebSocket instance configured for demo mode.
 *
 * @param options - Optional configuration
 * @returns MockWebSocket instance
 */
export function createMockWebSocket(options: MockWebSocketOptions = {}): MockWebSocket {
  const ws = new MockWebSocket('wss://demo.mconnect.local', options);
  return ws;
}

/**
 * Check if demo mode is enabled via environment variable.
 */
export function isDemoModeEnabled(): boolean {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  }
  return (window as any).__NEXT_PUBLIC_DEMO_MODE === 'true' ||
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}
