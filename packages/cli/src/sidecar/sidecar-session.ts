/**
 * Sidecar Session Manager
 * MConnect v1.1.0 - Sidecar Mode
 *
 * Manages a sidecar session that bridges the current terminal
 * to remote WebSocket clients without spawning new shells.
 */

import { EventEmitter } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import type {
  SidecarConfig,
  ConnectionInfo,
  ClientInfo,
  SidecarInfo,
  SidecarSessionEvents,
} from './types.js';
import { TerminalBridge } from './terminal-bridge.js';
import { generateSecureToken, generateSessionId, getPairingCodeManager } from '../security.js';
import { createTunnelWithFeedback } from '../tunnel.js';
import { getWebClientHTML } from '../web/web-client.js';

/**
 * SidecarSession manages a sidecar session that enables
 * remote observation and control of the current terminal.
 *
 * @example
 * ```typescript
 * const session = new SidecarSession({ port: 8765 });
 *
 * session.on('client_connected', (client) => {
 *   console.log(`Client connected: ${client.id}`);
 * });
 *
 * const info = await session.start();
 * console.log(`Connect at: ${info.localUrl}`);
 * ```
 */
export class SidecarSession extends EventEmitter {
  private config: Required<Omit<SidecarConfig, 'webUrl'>> & { webUrl?: string };
  private bridge: TerminalBridge | null = null;
  private httpServer: Server | null = null;
  private clients: Map<string, ClientInfo> = new Map();
  private sessionId: string = '';
  private sessionToken: string = '';
  private tunnelUrl: string | null = null;
  private pairingCode: string = '';
  private _isRunning = false;
  private startTime: Date | null = null;

  constructor(config: SidecarConfig = {}) {
    super();
    this.config = {
      port: config.port ?? 8765,
      enableTunnel: config.enableTunnel ?? true,
      observeOnly: config.observeOnly ?? false,
      background: config.background ?? false,
      webUrl: config.webUrl,
    };
  }

  /**
   * Start the sidecar session.
   * Sets up HTTP server, terminal bridge, and optional tunnel.
   */
  async start(): Promise<SidecarInfo> {
    if (this._isRunning) {
      throw new Error('Session already running');
    }

    try {
      // Generate session credentials
      this.sessionId = generateSessionId();
      this.sessionToken = generateSecureToken();

      // Create pairing code
      const pairingManager = getPairingCodeManager();
      this.pairingCode = pairingManager.createCode(this.sessionId, this.sessionToken);

      // Find available port
      const port = await this.findAvailablePort(this.config.port);

      // Create HTTP server
      this.httpServer = await this.createHttpServer(port);

      // Attach terminal bridge
      this.bridge = new TerminalBridge();
      const attached = await this.bridge.attach();

      if (attached) {
        this.setupBridgeHandlers();
      }

      // Create tunnel if enabled
      if (this.config.enableTunnel) {
        const tunnelResult = await createTunnelWithFeedback(port);
        this.tunnelUrl = tunnelResult?.url || null;
      }

      this._isRunning = true;
      this.startTime = new Date();

      const info = this.getSidecarInfo();
      this.emit('started', info);

      return info;
    } catch (error) {
      // Cleanup on failure
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop the sidecar session.
   * Disconnects all clients and cleans up resources.
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    // Disconnect all clients
    for (const [clientId, client] of this.clients) {
      this.clients.delete(clientId);
      this.emit('client_disconnected', client);
    }

    await this.cleanup();

    this._isRunning = false;
    this.startTime = null;
    this.emit('stopped');
  }

  /**
   * Check if session is running.
   */
  isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Get list of connected clients.
   */
  getClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get connection information for clients.
   */
  getConnectionInfo(): ConnectionInfo | null {
    if (!this._isRunning || !this.httpServer) {
      return null;
    }

    const address = this.httpServer.address();
    const port = typeof address === 'object' && address ? address.port : this.config.port;

    return {
      localUrl: `http://localhost:${port}`,
      tunnelUrl: this.tunnelUrl || undefined,
      pairingCode: this.pairingCode,
      sessionId: this.sessionId,
    };
  }

  /**
   * Get current sidecar info.
   */
  private getSidecarInfo(): SidecarInfo {
    return {
      attached: this.bridge?.isAttached || false,
      terminalSize: this.bridge?.size || { rows: 24, cols: 80 },
      clientCount: this.clients.size,
      uptime: this.startTime ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0,
    };
  }

  /**
   * Handle client connection (called by WebSocket hub).
   */
  handleClientConnect(clientId: string, clientType: 'pc' | 'mobile' | 'browser', userAgent?: string): void {
    const client: ClientInfo = {
      id: clientId,
      type: clientType,
      connectedAt: new Date(),
      userAgent,
    };
    this.clients.set(clientId, client);
    this.emit('client_connected', client);
  }

  /**
   * Handle client disconnection (called by WebSocket hub).
   */
  handleClientDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      this.emit('client_disconnected', client);
    }
  }

  /**
   * Handle input from a client.
   */
  handleInput(data: Buffer, clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    if (this.config.observeOnly) {
      this.emit('input_rejected', { clientId, reason: 'observe_only' });
      return;
    }

    this.emit('input', data, client);

    // Forward to terminal bridge
    if (this.bridge?.isAttached) {
      this.bridge.write(data);
    }
  }

  /**
   * Find an available port starting from the specified port.
   */
  private async findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
    const net = await import('node:net');

    for (let i = 0; i < maxAttempts; i++) {
      const port = startPort + i;
      const available = await new Promise<boolean>((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
          server.close();
          resolve(true);
        });
        server.listen(port);
      });
      if (available) {
        return port;
      }
    }
    throw new Error(`No available port found in range ${startPort}-${startPort + maxAttempts - 1}`);
  }

  /**
   * Create HTTP server for the sidecar session.
   */
  private async createHttpServer(port: number): Promise<Server> {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      this.handleHttpRequest(req, res);
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(port, () => resolve());
      server.on('error', reject);
    });

    return server;
  }

  /**
   * Handle HTTP requests.
   */
  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = (typeof forwardedProto === 'string' ? forwardedProto : 'http') + ':';
    const forwardedHost = req.headers['x-forwarded-host'];
    const host = typeof forwardedHost === 'string' ? forwardedHost : req.headers.host;
    const url = new URL(req.url || '/', `${protocol}//${host}`);

    // CORS headers
    const setCorsHeaders = () => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    };

    // Handle preflight
    if (req.method === 'OPTIONS') {
      setCorsHeaders();
      res.writeHead(204);
      res.end();
      return;
    }

    // Pairing endpoint
    if (url.pathname === '/api/pair') {
      setCorsHeaders();
      const code = url.searchParams.get('code');

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing code parameter' }));
        return;
      }

      const pairingManager = getPairingCodeManager();
      const result = pairingManager.validateCode(code);

      if (!result.valid) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.reason || 'Invalid code' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token: result.token, sessionId: result.sessionId }));
      return;
    }

    // Sidecar info endpoint
    if (url.pathname === '/api/sidecar/info') {
      setCorsHeaders();
      const providedToken = url.searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '');

      if (providedToken !== this.sessionToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid token' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...this.getSidecarInfo(),
        mode: 'sidecar',
        observeOnly: this.config.observeOnly,
      }));
      return;
    }

    // Web client
    const providedToken = url.searchParams.get('token');

    if (!providedToken || providedToken !== this.sessionToken) {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      res.end(this.getPairingEntryHTML(url.origin));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store',
      // Add CSP header for browser sandbox
      'Content-Security-Policy': this.getCSP(),
    });
    res.end(getWebClientHTML(this.sessionToken, this.sessionId, true));
  }

  /**
   * Get Content Security Policy for browser sandbox.
   */
  private getCSP(): string {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Needed for inline scripts in web client
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      `connect-src 'self' ws://localhost:* wss://localhost:* ${this.tunnelUrl ? `wss://${new URL(this.tunnelUrl).host}` : ''}`,
      "img-src 'self' data:",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ');
  }

  /**
   * Get pairing entry HTML page.
   */
  private getPairingEntryHTML(origin: string): string {
    // Simplified pairing page - reuses the main session.ts implementation pattern
    return `<!DOCTYPE html>
<html>
<head>
  <title>MConnect Sidecar - Enter Code</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'JetBrains Mono', monospace;
      background: #191919;
      color: #e9e9e7;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .container { text-align: center; padding: 24px; max-width: 400px; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { color: #9b9b9b; font-size: 14px; margin-bottom: 24px; }
    .code-input {
      display: flex;
      gap: 8px;
      justify-content: center;
      margin-bottom: 24px;
    }
    .code-input input {
      width: 44px;
      height: 52px;
      background: #202020;
      border: 1px solid #373737;
      border-radius: 8px;
      color: #e9e9e7;
      font-size: 20px;
      text-align: center;
      text-transform: uppercase;
    }
    .code-input input:focus {
      outline: none;
      border-color: #e9e9e7;
    }
    button {
      width: 100%;
      padding: 14px;
      background: #e9e9e7;
      color: #191919;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    button:disabled { background: #373737; color: #6b6b6b; }
    .badge {
      display: inline-block;
      background: #252525;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      color: #9b9b9b;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">SIDECAR MODE</div>
    <h1>Enter Pairing Code</h1>
    <p>Enter the code shown in your terminal</p>
    <div class="code-input" id="inputs">
      ${[0, 1, 2, 3, 4, 5].map(i => `<input type="text" maxlength="1" data-idx="${i}">`).join('')}
    </div>
    <button id="btn" disabled>Connect</button>
  </div>
  <script>
    const inputs = document.querySelectorAll('input');
    const btn = document.getElementById('btn');
    const getCode = () => [...inputs].map(i => i.value).join('').toUpperCase();

    inputs.forEach((inp, i) => {
      inp.addEventListener('input', e => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (e.target.value && i < 5) inputs[i + 1].focus();
        btn.disabled = getCode().length !== 6;
      });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !e.target.value && i > 0) inputs[i - 1].focus();
        if (e.key === 'Enter') btn.click();
      });
    });

    btn.addEventListener('click', async () => {
      const code = getCode();
      if (code.length !== 6) return;
      btn.disabled = true;
      btn.textContent = 'Connecting...';
      try {
        const res = await fetch('${origin}/api/pair?code=' + code);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        location.href = '${origin}?token=' + encodeURIComponent(data.token);
      } catch (err) {
        alert(err.message || 'Invalid code');
        btn.disabled = false;
        btn.textContent = 'Connect';
      }
    });

    inputs[0].focus();
  </script>
</body>
</html>`;
  }

  /**
   * Set up terminal bridge event handlers.
   */
  private setupBridgeHandlers(): void {
    if (!this.bridge) return;

    this.bridge.on('data', (data: Buffer) => {
      // Forward terminal output to all connected clients
      // This will be handled by the WebSocket hub integration
      this.emit('terminal_output', data);
    });

    this.bridge.on('resize', (size) => {
      this.emit('terminal_resize', size);
    });

    this.bridge.on('close', () => {
      // Terminal closed - stop session
      this.stop();
    });

    this.bridge.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  /**
   * Clean up all resources.
   */
  private async cleanup(): Promise<void> {
    if (this.bridge) {
      this.bridge.detach();
      this.bridge.removeAllListeners();
      this.bridge = null;
    }

    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer?.close(() => resolve());
      });
      this.httpServer = null;
    }

    this.clients.clear();
    this.tunnelUrl = null;
    this.pairingCode = '';
    this.sessionId = '';
    this.sessionToken = '';
  }
}

// Type augmentation for EventEmitter
export interface SidecarSession {
  on<K extends keyof SidecarSessionEvents>(event: K, listener: SidecarSessionEvents[K]): this;
  emit<K extends keyof SidecarSessionEvents>(event: K, ...args: Parameters<SidecarSessionEvents[K]>): boolean;
  off<K extends keyof SidecarSessionEvents>(event: K, listener: SidecarSessionEvents[K]): this;
}
