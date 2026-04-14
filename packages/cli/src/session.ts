/**
 * Session Manager v2 for MConnect
 *
 * Orchestrates multi-agent sessions with PTY management,
 * WebSocket hub, and optional tmux visualization.
 */

import type { ChildProcess } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import qrcode from 'qrcode-terminal';
import { AgentManager } from './agents/agent-manager.js';
import type { AgentConfig } from './agents/types.js';
import { getDataDir } from './config.js';
import { type GuardrailConfig, loadGuardrails } from './guardrails.js';
import type { InputArbiter } from './input/InputArbiter.js';
import {
  generateSecureToken,
  generateSessionId,
  getPairingCodeManager,
  hashForLogging,
} from './security.js';
import { writeSessionFile, removeSessionFile, registerSession, unregisterSession, listRegisteredSessions } from './session-file.js';
import { SessionManager } from './session/SessionManager.js';
import { TmuxManager } from './tmux/tmux-manager.js';
import { createTunnelWithFeedback } from './tunnel.js';
import { PRODUCT_NAME, VERSION } from './version.js';
import { getWebClientHTML } from './web/web-client.js';
import { getSessionListHTML } from './web/session-list.js';
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
  /** Web app base URL (if using external web UI) */
  webUrl?: string;
  /** Output session info as JSON to stdout (for agents/scripts) */
  jsonOutput?: boolean;
  /** Session timeout in minutes (default: 60). 0 = no timeout. */
  timeout?: number;
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
  sessionManager: SessionManager | null;
  /** SQLite-assigned session UUID (may differ from mconnect session id) */
  sqliteSessionId: string;
  guardrailConfig: GuardrailConfig;
  tunnelUrl: string | null;
  tunnelProcess: ChildProcess | null;
  /** Session context for v2 persistent sessions */
  context: SessionContext | null;
  /** Initialization status for each component */
  initStatus: InitializationStatus;
  /** Timer handle for periodic activity updates */
  activityTimer: ReturnType<typeof setInterval> | null;
}

let currentSession: MConnectSession | null = null;

/**
 * Start a new MConnect v2 session
 */
export async function startSession(config: SessionConfig): Promise<void> {
  const sessionId = generateSessionId();
  const sessionToken = generateSecureToken();
  const port = config.port || 8765;

  const quiet = !!config.jsonOutput;

  // Show startup spinner (skip in JSON mode)
  const spinner = quiet ? { start: () => {}, message: () => {}, stop: () => {} } : p.spinner();
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
    const protocol = `${typeof forwardedProto === 'string' ? forwardedProto : 'http'}:`;
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

    // Health check endpoint (for tunnel/connectivity debugging)
    if (url.pathname === '/health' || url.pathname === '/api/health') {
      setCorsHeaders();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        version: VERSION,
        sessionId,
        agents: currentSession?.agentManager?.getAllAgents()?.length ?? 0,
        timestamp: new Date().toISOString(),
      }));
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

    // Sessions API endpoint (requires token)
    if (url.pathname === '/api/sessions') {
      setCorsHeaders();
      const apiToken = url.searchParams.get('token');
      if (!apiToken || apiToken !== sessionToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      // Return all sessions from SQLite (includes historical sessions)
      const sessMgr = currentSession?.sessionManager;
      if (sessMgr) {
        const allSessions = sessMgr.getAllSessions(true);
        const sessions = allSessions.map((s) => ({
          sessionId: s.id,
          state: s.state,
          createdAt: s.createdAt.toISOString(),
          lastActivity: s.lastActivity.toISOString(),
          agentConfig: s.agentConfig,
          workingDirectory: s.workingDirectory,
          connectedClients: sessMgr.getSessionClients(s.id).length,
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ currentSessionId: sessionId, sessions }));
      } else {
        // Fallback: return process-registry sessions when SQLite not available
        const entries = listRegisteredSessions();
        const sessions = entries.map((entry) => ({
          sessionId: entry.data.sessionId,
          workDir: entry.data.workDir,
          url: entry.data.url,
          connectUrl: entry.data.connectUrl,
          startedAt: entry.data.startedAt,
          pid: entry.data.pid,
          alive: entry.alive,
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ currentSessionId: sessionId, sessions }));
      }
      return;
    }

    // Scrollback API endpoint — returns scrollback lines for a session from SQLite
    const scrollbackMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/scrollback$/);
    if (scrollbackMatch) {
      setCorsHeaders();
      const apiToken = url.searchParams.get('token');
      if (!apiToken || apiToken !== sessionToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const targetSessionId = scrollbackMatch[1];
      const fromLine = parseInt(url.searchParams.get('from') ?? '0', 10);
      const count = Math.min(parseInt(url.searchParams.get('count') ?? '1000', 10), 5000);

      const sessMgr = currentSession?.sessionManager;
      if (!sessMgr) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session store not available' }));
        return;
      }

      const lines = sessMgr.getScrollback(targetSessionId, fromLine, count);
      const totalLines = sessMgr.getScrollbackLineCount(targetSessionId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessionId: targetSessionId, fromLine, lines, totalLines }));
      return;
    }

    // All other routes require token
    const providedToken = url.searchParams.get('token');

    if (!providedToken || providedToken !== sessionToken) {
      // Show pairing entry page instead of just 401
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      res.end(getPairingEntryHTML(url.origin));
      return;
    }

    // Terminal view — the existing web client
    if (url.pathname === '/terminal') {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      res.end(getWebClientHTML(sessionToken, sessionId, true));
      return;
    }

    // Default: session list (home view)
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store',
    });
    res.end(getSessionListHTML(sessionToken, sessionId));
  });

  // Start HTTP server (bind to 0.0.0.0 for tunnel/network accessibility)
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, '0.0.0.0', () => resolve());
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

  // Initialize SessionManager for SQLite persistence
  spinner.message('Initializing session store...');
  let sessionManager: SessionManager | null = null;
  // sqliteSessionId is the SQLite-assigned UUID for the current session's record.
  // It differs from the mconnect sessionId (used for WS auth) — we need this to
  // route appendOutput() and terminateSession() calls to the right DB row.
  let sqliteSessionId: string = sessionId;
  try {
    const dataDir = getDataDir();
    sessionManager = new SessionManager({ dataDir });
    await sessionManager.initialize();

    // Create the session record in SQLite; SessionManager assigns its own UUID
    const agentNames = config.agents.map((a) => a.name);
    const persistedSession = sessionManager.createSession(
      {
        preset: config.guardrails,
        agents: agentNames,
        guardrails: config.guardrails,
      },
      config.workDir
    );
    sqliteSessionId = persistedSession.id;

    // Wire session manager into WebSocket hub so v2 protocol works
    wsHub.setSessionManager(sessionManager);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    p.log.warning(`Session store initialization failed: ${errorMsg}`);
    p.log.warning('Session will continue without persistence (reconnect/scrollback unavailable)');
    sessionManager = null;
  }

  // Create agent manager (T009 - graceful fallback)
  spinner.message('Initializing PTY manager...');
  const agentManager = new AgentManager(config.workDir);

  try {
    await agentManager.initialize();
    initStatus.pty = { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    initStatus.pty = { success: false, error: errorMsg };
    p.log.warning(`PTY initialization failed: ${errorMsg}`);
    p.log.warning('Session will continue with limited functionality (no terminal input)');
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
        p.log.warning('Could not create tmux session');
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
  // Check for named tunnel URL (production: MCONNECT_TUNNEL_URL=https://app.lesearch.ai)
  const namedTunnelUrl = process.env.MCONNECT_TUNNEL_URL || null;
  const tunnelDisabled = process.env.MCONNECT_NO_TUNNEL === '1' || process.env.MCONNECT_NO_TUNNEL === 'true';

  let tunnelUrl: string | null = null;
  let tunnelResult: Awaited<ReturnType<typeof createTunnelWithFeedback>> = null;

  if (namedTunnelUrl) {
    // Named tunnel already running externally (e.g. cloudflared tunnel run mconnect)
    tunnelUrl = namedTunnelUrl;
    initStatus.tunnel = { success: true, url: namedTunnelUrl };
    spinner.message(`Using named tunnel: ${namedTunnelUrl}`);
  } else if (tunnelDisabled) {
    initStatus.tunnel = { success: false, error: 'Disabled via MCONNECT_NO_TUNNEL' };
  } else {
    spinner.message('Creating secure tunnel...');
    tunnelResult = await createTunnelWithFeedback(port);
    tunnelUrl = tunnelResult?.url || null;
    if (tunnelUrl) {
      initStatus.tunnel = { success: true, url: tunnelUrl };
    } else {
      initStatus.tunnel = {
        success: false,
        error: 'Cloudflared not available or tunnel creation failed',
      };
    }
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
    sessionManager,
    sqliteSessionId,
    guardrailConfig,
    tunnelUrl,
    tunnelProcess: tunnelResult?.process || null,
    context: {
      sessionManager,
      inputArbiter: null,
      sessionId,
    },
    initStatus,
    activityTimer: null,
  };

  // Spawn initial agents
  spinner.message('Starting agents...');
  for (const agentConfig of config.agents) {
    try {
      await agentManager.createAgent(agentConfig);
      p.log.step(`Started agent: ${agentConfig.name}`);
    } catch (error) {
      p.log.error(
        `Failed to start ${agentConfig.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  spinner.stop('Session ready!');

  // Display initialization status summary (T013)
  if (!quiet) {
    console.log('\n');
    p.log.info('Component Status:');
    const statusIcon = (success: boolean) => (success ? chalk.green('✓') : chalk.yellow('○'));
    console.log(`  ${statusIcon(initStatus.httpServer.success)} HTTP Server`);
    console.log(`  ${statusIcon(initStatus.websocket.success)} WebSocket`);
    console.log(
      `  ${statusIcon(initStatus.pty.success)} PTY Manager${initStatus.pty.error ? chalk.dim(` (${initStatus.pty.error})`) : ''}`
    );
    console.log(
      `  ${statusIcon(initStatus.tunnel.success)} Tunnel${initStatus.tunnel.error ? chalk.dim(` (${initStatus.tunnel.error})`) : ''}`
    );
    console.log(
      `  ${statusIcon(initStatus.tmux.success)} Tmux${initStatus.tmux.error ? chalk.dim(` (${initStatus.tmux.error})`) : ''}`
    );
  }

  // Build connection URLs
  const serverUrl = tunnelUrl || `http://localhost:${port}`;
  let connectUrl = new URL(serverUrl);
  let usingWebUrl = false;

  if (config.webUrl) {
    try {
      connectUrl = new URL(config.webUrl);
      usingWebUrl = true;
    } catch (_error) {
      if (!config.jsonOutput) {
        p.log.warning(`Invalid web URL provided: ${config.webUrl}`);
        p.log.warning('Falling back to the built-in web client.');
      }
    }
  }

  connectUrl.searchParams.set('token', sessionToken);
  if (usingWebUrl) {
    connectUrl.searchParams.set('server', serverUrl);
  }
  const connectUrlString = connectUrl.toString();

  // Write session file for `mconnect info` and agent consumption
  const sessionFileData = {
    sessionId,
    pairingCode,
    url: serverUrl,
    connectUrl: connectUrlString,
    token: sessionToken,
    port,
    startedAt: new Date().toISOString(),
    pid: process.pid,
  };

  try {
    writeSessionFile(config.workDir, sessionFileData);
  } catch {
    // Session file write is best-effort
  }

  // Register session in central registry for `mconnect ps`
  try {
    registerSession({ ...sessionFileData, workDir: config.workDir });
  } catch {
    // Registry write is best-effort
  }

  // JSON output mode: print machine-readable info and skip the fancy display
  if (config.jsonOutput) {
    console.log(JSON.stringify(sessionFileData, null, 2));
  } else {
    console.log('\n');
    p.log.success(`${PRODUCT_NAME} - Multi-Agent Session`);
    console.log('\n');

    // Display QR code
    console.log(chalk.bold('  Scan this QR code with your phone:\n'));
    qrcode.generate(connectUrlString, { small: false }, (qr) => {
      const lines = qr.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          console.log(`  ${line}`);
        }
      }
    });

    console.log('\n');
    console.log(chalk.dim(`  Session ID: ${sessionId}`));
    if (usingWebUrl) {
      console.log(chalk.green(`  Web URL: ${connectUrlString}`));
      console.log(chalk.dim(`  Server URL: ${serverUrl}`));
    } else if (tunnelUrl) {
      console.log(chalk.green(`  Remote URL: ${tunnelUrl}`));
    } else {
      console.log(chalk.yellow(`  Local URL: http://localhost:${port}`));
      console.log(chalk.dim('  (Install cloudflared for remote access)'));
    }
    console.log(chalk.dim(`  Agents: ${agentManager.count}`));
    console.log(chalk.dim(`  Mode: ${chalk.yellow('Read-only')} (toggle in app)`));
    console.log(chalk.dim(`  Token: ${hashForLogging(sessionToken)}... (secure)`));
    if (tmuxManager?.getCurrentSession()) {
      console.log(chalk.dim(`  Tmux: ${tmuxManager.getCurrentSession()}`));
    }
    console.log('\n');

    {
      const codeDisplay = chalk.bgCyan.black.bold(` ${pairingCode} `);
      const border = chalk.bold;
      process.stdout.write(border('  ╔══════════════════════════════════════╗\n'));
      process.stdout.write(`${border('  ║  PAIRING CODE:  ')}${codeDisplay}${border('  ║')}\n`);
      process.stdout.write(border('  ╚══════════════════════════════════════╝\n'));
      console.log(chalk.dim('  Enter this code in the web app to connect'));
      console.log(chalk.dim("  (Valid for 5 minutes) \xB7 Can't scan QR? Use this code."));
      console.log('\n');
    }

    p.log.info(`Press ${chalk.cyan('Ctrl+C')} to stop the session`);
    console.log('\n');
  }

  // Event handlers for agent manager
  agentManager.on('data', (_agentId, data) => {
    process.stdout.write(data);
    // Persist output to SQLite scrollback (buffered via ScrollbackBuffer)
    if (currentSession?.sessionManager) {
      currentSession.sessionManager.appendOutput(sqliteSessionId, data);
    }
  });

  agentManager.on('exit', (agentId, code) => {
    p.log.info(`Agent ${agentId} exited with code ${code}`);
  });

  // Start periodic activity heartbeat — updates last_activity in SQLite every 30s
  if (sessionManager) {
    const activityTimer = setInterval(() => {
      if (currentSession?.sessionManager) {
        currentSession.sessionManager.updateActivity(currentSession.sqliteSessionId);
      }
    }, 30_000);
    activityTimer.unref(); // Don't prevent process exit
    currentSession.activityTimer = activityTimer;

    // Start WebSocket heartbeat for v2 clients
    wsHub.startHeartbeat();
  }

  // Session timeout — auto-shutdown after configured duration (0 = no timeout)
  const timeoutMinutes = config.timeout ?? 0;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  if (timeoutMinutes > 0) {
    timeoutTimer = setTimeout(async () => {
      if (!quiet) {
        p.log.warning(`Session timed out after ${timeoutMinutes} minutes. Shutting down.`);
      }
      await cleanup();
      process.exit(0);
    }, timeoutMinutes * 60 * 1000);
    timeoutTimer.unref();
  }

  if (!quiet) {
    if (timeoutMinutes > 0) {
      p.log.info(`Session will auto-expire in ${timeoutMinutes} minutes. Use --timeout to change.`);
    } else {
      p.log.info('Session has no timeout. Use --timeout <minutes> to set one.');
    }
  }

  // Keep running
  await new Promise<void>((resolve) => {
    process.on('SIGINT', async () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      await cleanup();
      resolve();
    });

    process.on('SIGTERM', async () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      await cleanup();
      resolve();
    });
  });
}

/**
 * Cleanup session resources
 */
async function cleanup(): Promise<void> {
  if (!currentSession) return;

  p.log.info('Cleaning up session...');

  // Stop activity heartbeat timer
  if (currentSession.activityTimer) {
    clearInterval(currentSession.activityTimer);
    currentSession.activityTimer = null;
  }

  try {
    removeSessionFile(currentSession.config.workDir);
  } catch {
    // Best-effort cleanup
  }

  // Unregister from central session registry
  try {
    unregisterSession(currentSession.id);
  } catch {
    // Best-effort cleanup
  }

  // Mark session as completed in SQLite and flush scrollback
  if (currentSession.sessionManager) {
    try {
      currentSession.sessionManager.terminateSession(currentSession.sqliteSessionId);
    } catch {
      // Best-effort
    }
    try {
      await currentSession.sessionManager.shutdown();
    } catch {
      // Best-effort
    }
  }

  // Kill all agents
  await currentSession.agentManager.killAllAgents();

  // Close WebSocket hub
  currentSession.wsHub.close();

  // Kill tmux session
  if (currentSession.tmuxManager) {
    currentSession.tmuxManager.killSession();
  }

  // Kill tunnel process (prevents orphaned cloudflared)
  if (currentSession.tunnelProcess) {
    try {
      currentSession.tunnelProcess.kill();
    } catch {
      // Process may already be dead
    }
  }

  // Close HTTP server
  currentSession.httpServer.close();

  currentSession = null;
  p.outro(chalk.green('Session ended. Goodbye!'));
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
