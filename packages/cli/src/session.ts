/**
 * Session Manager v2 for MConnect v0.1.2
 *
 * Orchestrates multi-agent sessions with PTY management,
 * WebSocket hub, and optional tmux visualization.
 *
 * Supports both interactive (TTY) and headless (non-TTY) modes.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import qrcode from 'qrcode-terminal';

// Lazy-load @clack/prompts and chalk only when in TTY mode
let p: typeof import('@clack/prompts') | null = null;
let chalk: typeof import('chalk').default | null = null;

async function loadInteractiveModules(): Promise<void> {
  if (!p) {
    p = await import('@clack/prompts');
  }
  if (!chalk) {
    chalk = (await import('chalk')).default;
  }
}

/**
 * Simple logging for headless mode (no TTY required)
 */
function headlessLog(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info'): void {
  const prefix = {
    info: '[INFO]',
    success: '[OK]',
    error: '[ERROR]',
    warn: '[WARN]',
  };
  console.log(`${prefix[type]} ${message}`);
}

/**
 * Find an available port starting from the given port
 * Tries up to 10 ports before giving up
 */
async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
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
import { AgentManager } from './agents/agent-manager.js';
import type { AgentConfig } from './agents/types.js';
import { type GuardrailConfig, loadGuardrails } from './guardrails.js';
import type { InputArbiter } from './input/InputArbiter.js';
import { generateSecureToken, generateSessionId, getPairingCodeManager, hashForLogging } from './security.js';
import type { SessionManager } from './session/SessionManager.js';
import { TmuxManager } from './tmux/tmux-manager.js';
import { createTunnelWithFeedback } from './tunnel.js';
import { getWebClientHTML } from './web/web-client.js';
import { WSHub } from './ws/ws-hub.js';

export interface SessionConfig {
  /** Working directory */
  workDir: string;
  /** Guardrails preset name */
  guardrails: string;
  /** Initial agents to spawn */
  agents: Omit<AgentConfig, 'cwd'>[];
  /** Enable tmux visualization (default: true) */
  enableTmux?: boolean;
  /** Server port (default: 8765) */
  port?: number;
  /** Show pairing code in terminal (default: false, QR only for mobile) */
  showPairingCode?: boolean;
  /** Web app base URL (if using external web UI) */
  webUrl?: string;
}

export interface HeadlessSessionConfig extends SessionConfig {
  /** Output session info as JSON */
  jsonOutput?: boolean;
  /** Run in background and exit immediately after starting */
  background?: boolean;
}

/**
 * SessionContext holds references to the session management infrastructure
 * Used for coordinating between SessionManager, InputArbiter, and other components
 */
export interface SessionContext {
  /** The SessionManager for persistent session storage */
  sessionManager: SessionManager | null;
  /** The InputArbiter for control arbitration (one per session) */
  inputArbiter: InputArbiter | null;
  /** Session ID for this context */
  sessionId: string;
}

/**
 * Initialization status tracking for component startup
 */
export interface InitializationStatus {
  pty: { success: boolean; error?: string };
  websocket: { success: boolean; error?: string };
  tunnel: { success: boolean; error?: string; url?: string };
  tmux: { success: boolean; error?: string };
  httpServer: { success: boolean; error?: string };
}

export interface MConnectSession {
  id: string;
  token: string;
  config: SessionConfig;
  httpServer: ReturnType<typeof createServer>;
  wsHub: WSHub;
  agentManager: AgentManager;
  tmuxManager: TmuxManager | null;
  guardrailConfig: GuardrailConfig;
  tunnelUrl: string | null;
  /** Session context for v2 persistent sessions */
  context: SessionContext | null;
  /** Initialization status for each component */
  initStatus: InitializationStatus;
}

let currentSession: MConnectSession | null = null;

/**
 * Error handling wrapper for optional components (tunnel, tmux, etc.)
 * Returns the result or null if the component fails to initialize
 *
 * @param name - Component name for logging
 * @param init - Async initialization function
 * @param options - Options for error handling
 * @returns The result of init() or null on error
 */
export async function tryInitOptionalComponent<T>(
  name: string,
  init: () => Promise<T>,
  options: { silent?: boolean; warnMessage?: string } = {}
): Promise<T | null> {
  try {
    return await init();
  } catch (error) {
    if (!options.silent) {
      const message = options.warnMessage ||
        `Could not initialize ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      p!.log.warning(message);
    }
    return null;
  }
}

/**
 * Start a new MConnect v2 session (interactive mode with TTY)
 */
export async function startSession(config: SessionConfig): Promise<void> {
  // Load interactive modules first
  await loadInteractiveModules();

  const sessionId = generateSessionId();
  const sessionToken = generateSecureToken();
  const port = config.port || 8765;

  // Show startup spinner
  const spinner = p!.spinner();
  spinner.start('Initializing MConnect v2...');

  // Load guardrails
  const guardrailConfig = loadGuardrails(config.guardrails);

  // Create pairing code
  const pairingManager = getPairingCodeManager();
  const pairingCode = pairingManager.createCode(sessionId, sessionToken);

  // Create HTTP server
  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    // Detect protocol from X-Forwarded-Proto (set by cloudflared/proxies) or default to http
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = (typeof forwardedProto === 'string' ? forwardedProto : 'http') + ':';
    // Use X-Forwarded-Host if available (for proxy/tunnel scenarios)
    const forwardedHost = req.headers['x-forwarded-host'];
    const host = typeof forwardedHost === 'string' ? forwardedHost : req.headers.host;
    const url = new URL(req.url || '/', `${protocol}//${host}`);

    // CORS headers for API endpoints
    const setCorsHeaders = () => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    };

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      setCorsHeaders();
      res.writeHead(204);
      res.end();
      return;
    }

    // Pairing code exchange endpoint
    if (url.pathname === '/api/pair') {
      setCorsHeaders();
      const code = url.searchParams.get('code');

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing code parameter' }));
        return;
      }

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

    // Web client (requires token)
    const providedToken = url.searchParams.get('token');

    if (!providedToken || providedToken !== sessionToken) {
      // Show pairing entry page instead of just 401
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      res.end(getPairingEntryHTML(url.origin));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store',
    });
    res.end(getWebClientHTML(sessionToken, sessionId, true));
  });

  // Start HTTP server
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, () => resolve());
    httpServer.on('error', reject);
  });

  // Initialize status tracking (T012)
  const initStatus: InitializationStatus = {
    pty: { success: false },
    websocket: { success: false },
    tunnel: { success: false },
    tmux: { success: false },
    httpServer: { success: true }, // Already started at this point
  };

  // Create WebSocket hub
  const wsHub = new WSHub(httpServer, {
    token: sessionToken,
    sessionId,
    rateLimit: 10,
    rateLimitWindow: 60000,
  });
  wsHub.setGuardrails(guardrailConfig);
  initStatus.websocket = { success: true };

  // Create agent manager (T009 - graceful fallback)
  spinner.message('Initializing PTY manager...');
  const agentManager = new AgentManager(config.workDir);

  try {
    await agentManager.initialize();
    initStatus.pty = { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    initStatus.pty = { success: false, error: errorMsg };
    p!.log.warning(`PTY initialization failed: ${errorMsg}`);
    p!.log.warning('Session will continue with limited functionality (no terminal input)');
    // Don't throw - continue with graceful fallback
  }

  // Connect agent manager to WebSocket hub
  wsHub.setAgentManager(agentManager);

  // Setup tmux (optional) (T011 - already graceful)
  let tmuxManager: TmuxManager | null = null;
  if (config.enableTmux !== false) {
    spinner.message('Setting up tmux visualization...');
    tmuxManager = new TmuxManager();
    const tmuxInstalled = await tmuxManager.isInstalled();

    if (tmuxInstalled) {
      try {
        await tmuxManager.createSession({
          name: sessionId,
          cwd: config.workDir,
          windowName: 'agents',
        });
        initStatus.tmux = { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        initStatus.tmux = { success: false, error: errorMsg };
        p!.log.warning('Could not create tmux session');
        tmuxManager = null;
      }
    } else {
      initStatus.tmux = { success: false, error: 'Tmux not installed' };
      tmuxManager = null;
    }
  } else {
    initStatus.tmux = { success: false, error: 'Disabled by config' };
  }

  // Create tunnel (T010 - already graceful)
  spinner.message('Creating secure tunnel...');
  const tunnelResult = await createTunnelWithFeedback(port);
  const tunnelUrl = tunnelResult?.url || null;
  if (tunnelUrl) {
    initStatus.tunnel = { success: true, url: tunnelUrl };
  } else {
    initStatus.tunnel = { success: false, error: 'Cloudflared not available or tunnel creation failed' };
  }

  // Store session
  currentSession = {
    id: sessionId,
    token: sessionToken,
    config,
    httpServer,
    wsHub,
    agentManager,
    tmuxManager,
    guardrailConfig,
    tunnelUrl,
    context: {
      sessionManager: null, // Will be initialized in Phase 6 (US4)
      inputArbiter: null,   // Will be initialized in Phase 7 (US5)
      sessionId,
    },
    initStatus,
  };

  // Spawn initial agents
  spinner.message('Starting agents...');
  for (const agentConfig of config.agents) {
    try {
      await agentManager.createAgent(agentConfig);
      p!.log.step(`Started agent: ${agentConfig.name}`);
    } catch (error) {
      p!.log.error(
        `Failed to start ${agentConfig.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  spinner.stop('Session ready!');

  // Display initialization status summary (T013)
  console.log('\n');
  p!.log.info('Component Status:');
  const statusIcon = (success: boolean) => success ? chalk!.green('✓') : chalk!.yellow('○');
  console.log(`  ${statusIcon(initStatus.httpServer.success)} HTTP Server`);
  console.log(`  ${statusIcon(initStatus.websocket.success)} WebSocket`);
  console.log(`  ${statusIcon(initStatus.pty.success)} PTY Manager${initStatus.pty.error ? chalk!.dim(` (${initStatus.pty.error})`) : ''}`);
  console.log(`  ${statusIcon(initStatus.tunnel.success)} Tunnel${initStatus.tunnel.error ? chalk!.dim(` (${initStatus.tunnel.error})`) : ''}`);
  console.log(`  ${statusIcon(initStatus.tmux.success)} Tmux${initStatus.tmux.error ? chalk!.dim(` (${initStatus.tmux.error})`) : ''}`);

  // Display session info
  const serverUrl = tunnelUrl || `http://localhost:${port}`;
  let connectUrl = new URL(serverUrl);
  let usingWebUrl = false;

  if (config.webUrl) {
    try {
      connectUrl = new URL(config.webUrl);
      usingWebUrl = true;
    } catch (error) {
      p!.log.warning(`Invalid web URL provided: ${config.webUrl}`);
      p!.log.warning('Falling back to the built-in web client.');
    }
  }

  connectUrl.searchParams.set('token', sessionToken);
  if (usingWebUrl) {
    connectUrl.searchParams.set('server', serverUrl);
  }
  const connectUrlString = connectUrl.toString();

  console.log('\n');
  p!.log.success('MConnect v0.1.2 - Multi-Agent Session');
  console.log('\n');

  // Display QR code
  console.log(chalk!.bold('  Scan this QR code with your phone:\n'));
  qrcode.generate(connectUrlString, { small: true }, (qr) => {
    console.log(qr);
  });

  console.log('\n');
  console.log(chalk!.dim(`  Session ID: ${sessionId}`));
  if (usingWebUrl) {
    console.log(chalk!.green(`  Web URL: ${connectUrlString}`));
    console.log(chalk!.dim(`  Server URL: ${serverUrl}`));
  } else if (tunnelUrl) {
    console.log(chalk!.green(`  Remote URL: ${tunnelUrl}`));
  } else {
    console.log(chalk!.yellow(`  Local URL: http://localhost:${port}`));
    console.log(chalk!.dim('  (Install cloudflared for remote access)'));
  }
  console.log(chalk!.dim(`  Agents: ${agentManager.count}`));
  console.log(chalk!.dim(`  Mode: ${chalk!.yellow('Read-only')} (toggle in app)`));
  console.log(chalk!.dim(`  Token: ${hashForLogging(sessionToken)}... (secure)`));
  if (tmuxManager?.getCurrentSession()) {
    console.log(chalk!.dim(`  Tmux: ${tmuxManager.getCurrentSession()}`));
  }
  console.log('\n');

  // Display pairing code only if --code flag is used
  if (config.showPairingCode) {
    console.log(chalk!.bold.cyan('  ────────────────────────────────────'));
    console.log(chalk!.bold.cyan(`  │  PAIRING CODE:  ${chalk!.white.bold(pairingCode)}  │`));
    console.log(chalk!.bold.cyan('  ────────────────────────────────────'));
    console.log(chalk!.dim('  Enter this code in the web app to connect'));
    console.log(chalk!.dim('  (Valid for 5 minutes)'));
    console.log('\n');
  }

  p!.log.info(`Press ${chalk!.cyan('Ctrl+C')} to stop the session`);
  console.log('\n');

  // Event handlers for agent manager
  agentManager.on('data', (_agentId, data) => {
    process.stdout.write(data);
  });

  agentManager.on('exit', (agentId, code) => {
    p!.log.info(`Agent ${agentId} exited with code ${code}`);
  });

  // Keep running
  await new Promise<void>((resolve) => {
    process.on('SIGINT', () => {
      cleanup();
      resolve();
    });

    process.on('SIGTERM', () => {
      cleanup();
      resolve();
    });
  });
}

/**
 * Start a new MConnect session in headless mode (no TTY required)
 * This works in Claude Code's Bash tool and other non-interactive environments
 */
export async function startSessionHeadless(config: HeadlessSessionConfig): Promise<void> {
  const sessionId = generateSessionId();
  const sessionToken = generateSecureToken();

  // Find an available port (auto-increment if default is busy)
  const requestedPort = config.port || 8765;
  let port: number;
  try {
    port = await findAvailablePort(requestedPort);
    if (port !== requestedPort) {
      headlessLog(`Port ${requestedPort} in use, using ${port} instead`, 'warn');
    }
  } catch (error) {
    headlessLog(`Could not find available port: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    throw error;
  }

  headlessLog('Initializing MConnect v2 (headless mode)...');

  // Load guardrails
  const guardrailConfig = loadGuardrails(config.guardrails);

  // Create pairing code
  const pairingManager = getPairingCodeManager();
  const pairingCode = pairingManager.createCode(sessionId, sessionToken);

  // Create HTTP server (same as interactive mode)
  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = (typeof forwardedProto === 'string' ? forwardedProto : 'http') + ':';
    const forwardedHost = req.headers['x-forwarded-host'];
    const host = typeof forwardedHost === 'string' ? forwardedHost : req.headers.host;
    const url = new URL(req.url || '/', `${protocol}//${host}`);

    const setCorsHeaders = () => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    };

    if (req.method === 'OPTIONS') {
      setCorsHeaders();
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === '/api/pair') {
      setCorsHeaders();
      const code = url.searchParams.get('code');

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing code parameter' }));
        return;
      }

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

    const providedToken = url.searchParams.get('token');

    if (!providedToken || providedToken !== sessionToken) {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      res.end(getPairingEntryHTML(url.origin));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store',
    });
    res.end(getWebClientHTML(sessionToken, sessionId, true));
  });

  // Start HTTP server
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, () => resolve());
    httpServer.on('error', reject);
  });

  headlessLog(`HTTP server started on port ${port}`, 'success');

  // Initialize status tracking
  const initStatus: InitializationStatus = {
    pty: { success: false },
    websocket: { success: false },
    tunnel: { success: false },
    tmux: { success: false },
    httpServer: { success: true },
  };

  // Create WebSocket hub
  const wsHub = new WSHub(httpServer, {
    token: sessionToken,
    sessionId,
    rateLimit: 10,
    rateLimitWindow: 60000,
  });
  wsHub.setGuardrails(guardrailConfig);
  initStatus.websocket = { success: true };
  headlessLog('WebSocket hub ready', 'success');

  // Create agent manager
  const agentManager = new AgentManager(config.workDir);

  try {
    await agentManager.initialize();
    initStatus.pty = { success: true };
    headlessLog('PTY manager initialized', 'success');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    initStatus.pty = { success: false, error: errorMsg };
    headlessLog(`PTY initialization failed: ${errorMsg}`, 'warn');
  }

  wsHub.setAgentManager(agentManager);

  // Setup tmux (optional)
  let tmuxManager: TmuxManager | null = null;
  if (config.enableTmux !== false) {
    tmuxManager = new TmuxManager();
    const tmuxInstalled = await tmuxManager.isInstalled();

    if (tmuxInstalled) {
      try {
        await tmuxManager.createSession({
          name: sessionId,
          cwd: config.workDir,
          windowName: 'agents',
        });
        initStatus.tmux = { success: true };
        headlessLog('Tmux session created', 'success');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        initStatus.tmux = { success: false, error: errorMsg };
        headlessLog('Tmux session creation failed', 'warn');
        tmuxManager = null;
      }
    } else {
      initStatus.tmux = { success: false, error: 'Tmux not installed' };
    }
  }

  // Create tunnel
  const tunnelResult = await createTunnelWithFeedback(port);
  const tunnelUrl = tunnelResult?.url || null;
  if (tunnelUrl) {
    initStatus.tunnel = { success: true, url: tunnelUrl };
    headlessLog(`Tunnel created: ${tunnelUrl}`, 'success');
  } else {
    initStatus.tunnel = { success: false, error: 'Cloudflared not available' };
    headlessLog('Tunnel not available (cloudflared not installed)', 'warn');
  }

  // Store session
  currentSession = {
    id: sessionId,
    token: sessionToken,
    config,
    httpServer,
    wsHub,
    agentManager,
    tmuxManager,
    guardrailConfig,
    tunnelUrl,
    context: {
      sessionManager: null,
      inputArbiter: null,
      sessionId,
    },
    initStatus,
  };

  // Spawn initial agents
  for (const agentConfig of config.agents) {
    try {
      await agentManager.createAgent(agentConfig);
      headlessLog(`Started agent: ${agentConfig.name}`, 'success');
    } catch (error) {
      headlessLog(
        `Failed to start ${agentConfig.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  }

  // Build connection info
  const serverUrl = tunnelUrl || `http://localhost:${port}`;
  let connectUrl = new URL(serverUrl);
  if (config.webUrl) {
    try {
      connectUrl = new URL(config.webUrl);
      connectUrl.searchParams.set('server', serverUrl);
    } catch {
      headlessLog(`Invalid web URL: ${config.webUrl}`, 'warn');
    }
  }
  connectUrl.searchParams.set('token', sessionToken);
  const connectUrlString = connectUrl.toString();

  // Handle background mode - output connection info LAST so it's visible in truncated views
  if (config.background) {
    if (config.jsonOutput) {
      // JSON output for programmatic use
      const sessionInfo = {
        success: true,
        sessionId,
        pairingCode,
        port,
        localUrl: `http://localhost:${port}`,
        tunnelUrl: tunnelUrl || null,
        connectUrl: connectUrlString,
        agents: config.agents.map((a) => a.name),
        status: {
          httpServer: initStatus.httpServer.success,
          websocket: initStatus.websocket.success,
          pty: initStatus.pty.success,
          tunnel: initStatus.tunnel.success,
          tmux: initStatus.tmux.success,
        },
      };
      console.log(JSON.stringify(sessionInfo, null, 2));
    } else {
      // Compact output optimized for Claude Code's "last 10 lines" view
      // Critical info printed LAST so it stays visible
      console.log('\n');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('  MCONNECT SESSION READY');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`  PAIRING CODE:  ${pairingCode}`);
      console.log(`  SESSION ID:    ${sessionId}`);
      if (tunnelUrl) {
        console.log(`  REMOTE URL:    ${tunnelUrl}`);
      }
      console.log(`  LOCAL URL:     http://localhost:${port}`);
      console.log('───────────────────────────────────────────────────────────────');
      console.log(`  CONNECT URL:   ${connectUrlString}`);
      console.log('═══════════════════════════════════════════════════════════════');
    }
    // Don't wait - return immediately
    return;
  }

  // Non-background mode: full output with QR code
  if (config.jsonOutput) {
    // JSON output for programmatic use
    const sessionInfo = {
      success: true,
      sessionId,
      pairingCode,
      port,
      localUrl: `http://localhost:${port}`,
      tunnelUrl: tunnelUrl || null,
      connectUrl: connectUrlString,
      agents: config.agents.map((a) => a.name),
      status: {
        httpServer: initStatus.httpServer.success,
        websocket: initStatus.websocket.success,
        pty: initStatus.pty.success,
        tunnel: initStatus.tunnel.success,
        tmux: initStatus.tmux.success,
      },
    };
    console.log(JSON.stringify(sessionInfo, null, 2));
  } else {
    // Human-friendly text output with QR code
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           MConnect Session Ready (Headless Mode)             ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║                                                              ║');
    console.log('║  SCAN THIS QR CODE WITH YOUR PHONE:                          ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    // Generate ASCII QR code (works in non-TTY)
    await new Promise<void>((resolve) => {
      qrcode.generate(connectUrlString, { small: true }, (qr) => {
        console.log(qr);
        resolve();
      });
    });

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log(`║  Pairing Code: ${pairingCode}                                       ║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Session ID:   ${sessionId}                                       ║`);
    console.log(`║  Local URL:    http://localhost:${port}                           ║`);
    if (tunnelUrl) {
      const shortUrl = tunnelUrl.length > 50 ? tunnelUrl.substring(0, 47) + '...' : tunnelUrl;
      console.log(`║  Remote URL:   ${shortUrl.padEnd(46)}║`);
    }
    console.log(`║  Agents:       ${config.agents.map((a) => a.name).join(', ').padEnd(46)}║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║                                                              ║');
    console.log('║  TO CONNECT:                                                 ║');
    console.log('║  1. Scan the QR code above with your phone camera            ║');
    console.log('║  2. OR open the Remote URL in any browser                    ║');
    console.log('║  3. OR enter the Pairing Code at the login page              ║');
    console.log('║                                                              ║');
    console.log('║  Press Ctrl+C to stop the session                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n');

    // Also print the full URL for easy copying
    console.log('Full Connect URL (copy/paste):');
    console.log(connectUrlString);
    console.log('\n');
  }

  // Event handlers
  agentManager.on('data', (_agentId, data) => {
    process.stdout.write(data);
  });

  agentManager.on('exit', (agentId, code) => {
    headlessLog(`Agent ${agentId} exited with code ${code}`);
  });

  // Keep running until SIGINT/SIGTERM
  await new Promise<void>((resolve) => {
    process.on('SIGINT', () => {
      cleanupHeadless();
      resolve();
    });

    process.on('SIGTERM', () => {
      cleanupHeadless();
      resolve();
    });
  });
}

/**
 * Cleanup session resources (headless mode)
 */
function cleanupHeadless(): void {
  if (!currentSession) return;

  headlessLog('Cleaning up session...');

  currentSession.agentManager.killAllAgents();
  currentSession.wsHub.close();
  if (currentSession.tmuxManager) {
    currentSession.tmuxManager.killSession();
  }
  currentSession.httpServer.close();
  currentSession = null;

  headlessLog('Session ended', 'success');
}

/**
 * Cleanup session resources (interactive mode)
 */
function cleanup(): void {
  if (!currentSession) return;

  p!.log.info('Cleaning up session...');

  // Kill all agents
  currentSession.agentManager.killAllAgents();

  // Close WebSocket hub
  currentSession.wsHub.close();

  // Kill tmux session
  if (currentSession.tmuxManager) {
    currentSession.tmuxManager.killSession();
  }

  // Close HTTP server
  currentSession.httpServer.close();

  currentSession = null;
  p!.outro(chalk!.green('Session ended. Goodbye!'));
}

/**
 * Get unauthorized page HTML
 */
function getUnauthorizedHTML(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>MConnect - Unauthorized</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: system-ui;
      background: #09090B;
      color: #FAFAFA;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .container { text-align: center; padding: 20px; }
    h1 { color: #EF4444; margin-bottom: 16px; }
    p { color: #71717A; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Unauthorized</h1>
    <p>Invalid or missing session token.</p>
    <p>Please scan the QR code from the MConnect CLI.</p>
  </div>
</body>
</html>`;
}

/**
 * Get pairing code entry page HTML
 */
function getPairingEntryHTML(origin: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>MConnect - Enter Pairing Code</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #09090B;
      color: #FAFAFA;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 400px;
      width: 100%;
    }
    .icon {
      width: 64px;
      height: 64px;
      background: #27272A;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .icon svg { width: 32px; height: 32px; color: #22D3EE; }
    h1 {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 8px;
    }
    .subtitle {
      color: #71717A;
      margin: 0 0 32px;
      font-size: 14px;
    }
    .code-input {
      display: flex;
      gap: 8px;
      justify-content: center;
      margin-bottom: 24px;
    }
    .code-input input {
      width: 48px;
      height: 56px;
      background: #18181B;
      border: 2px solid #27272A;
      border-radius: 12px;
      color: #FAFAFA;
      font-size: 24px;
      font-weight: 600;
      text-align: center;
      text-transform: uppercase;
      outline: none;
      transition: border-color 0.2s;
    }
    .code-input input:focus {
      border-color: #22D3EE;
    }
    .code-input input.error {
      border-color: #EF4444;
      animation: shake 0.3s;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }
    .submit-btn {
      width: 100%;
      padding: 16px;
      background: #22D3EE;
      color: #09090B;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .submit-btn:hover { background: #06B6D4; }
    .submit-btn:disabled {
      background: #27272A;
      color: #71717A;
      cursor: not-allowed;
    }
    .error-msg {
      color: #EF4444;
      font-size: 14px;
      margin-top: 16px;
      display: none;
    }
    .error-msg.visible { display: block; }
    .hint {
      color: #52525B;
      font-size: 12px;
      margin-top: 24px;
    }
    .loading {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="m7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    </div>
    <h1>Enter Pairing Code</h1>
    <p class="subtitle">Enter the 6-character code shown in your terminal</p>

    <div class="code-input" id="codeInputs">
      <input type="text" maxlength="1" data-index="0" autocomplete="off" autofocus>
      <input type="text" maxlength="1" data-index="1" autocomplete="off">
      <input type="text" maxlength="1" data-index="2" autocomplete="off">
      <input type="text" maxlength="1" data-index="3" autocomplete="off">
      <input type="text" maxlength="1" data-index="4" autocomplete="off">
      <input type="text" maxlength="1" data-index="5" autocomplete="off">
    </div>

    <button class="submit-btn" id="submitBtn" disabled>Connect</button>
    <p class="error-msg" id="errorMsg">Invalid pairing code. Please try again.</p>
    <p class="hint">Can't find the code? Run <code style="color:#22D3EE">mconnect</code> in your terminal</p>
  </div>

  <script>
    const inputs = document.querySelectorAll('.code-input input');
    const submitBtn = document.getElementById('submitBtn');
    const errorMsg = document.getElementById('errorMsg');
    let isSubmitting = false;

    function getCode() {
      return Array.from(inputs).map(i => i.value).join('').toUpperCase();
    }

    function updateSubmitState() {
      const code = getCode();
      submitBtn.disabled = code.length !== 6 || isSubmitting;
    }

    function showError(msg) {
      errorMsg.textContent = msg;
      errorMsg.classList.add('visible');
      inputs.forEach(i => i.classList.add('error'));
      setTimeout(() => {
        inputs.forEach(i => i.classList.remove('error'));
      }, 300);
    }

    function clearError() {
      errorMsg.classList.remove('visible');
    }

    inputs.forEach((input, idx) => {
      input.addEventListener('input', (e) => {
        clearError();
        const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        e.target.value = value;

        if (value && idx < 5) {
          inputs[idx + 1].focus();
        }
        updateSubmitState();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && idx > 0) {
          inputs[idx - 1].focus();
        }
        if (e.key === 'Enter') {
          submitBtn.click();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const paste = (e.clipboardData.getData('text') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        for (let i = 0; i < 6 && i < paste.length; i++) {
          inputs[i].value = paste[i];
        }
        if (paste.length >= 6) {
          inputs[5].focus();
        }
        updateSubmitState();
      });
    });

    submitBtn.addEventListener('click', async () => {
      if (isSubmitting) return;
      const code = getCode();
      if (code.length !== 6) return;

      isSubmitting = true;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading"></span>Connecting...';
      clearError();

      try {
        const res = await fetch('${origin}/api/pair?code=' + encodeURIComponent(code));
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Invalid code');
        }

        // Success - redirect with token
        window.location.href = '${origin}?token=' + encodeURIComponent(data.token);
      } catch (err) {
        showError(err.message === 'code_expired' ? 'Code expired. Get a new one from terminal.' : 'Invalid pairing code. Please try again.');
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Connect';
        inputs[0].focus();
        inputs[0].select();
      }
    });

    // Focus first input on load
    inputs[0].focus();
  </script>
</body>
</html>`;
}

/**
 * Get current session
 */
export function getCurrentSession(): MConnectSession | null {
  return currentSession;
}
