/**
 * Session Manager v2 for MConnect v0.1.2
 *
 * Orchestrates multi-agent sessions with PTY management,
 * WebSocket hub, and optional tmux visualization.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import qrcode from 'qrcode-terminal';
import { generateSecureToken, generateSessionId, hashForLogging } from './security.js';
import { loadGuardrails, GuardrailConfig } from './guardrails.js';
import { createTunnelWithFeedback } from './tunnel.js';
import { AgentManager } from './agents/agent-manager.js';
import { WSHub } from './ws/ws-hub.js';
import { TmuxManager } from './tmux/tmux-manager.js';
import { getWebClientHTML } from './web/web-client.js';
import type { AgentConfig } from './agents/types.js';

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
}

let currentSession: MConnectSession | null = null;

/**
 * Start a new MConnect v2 session
 */
export async function startSession(config: SessionConfig): Promise<void> {
  const sessionId = generateSessionId();
  const sessionToken = generateSecureToken();
  const port = config.port || 8765;

  // Show startup spinner
  const spinner = p.spinner();
  spinner.start('Initializing MConnect v2...');

  // Load guardrails
  const guardrailConfig = loadGuardrails(config.guardrails);

  // Create HTTP server
  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const providedToken = url.searchParams.get('token');

    if (!providedToken || providedToken !== sessionToken) {
      res.writeHead(401, { 'Content-Type': 'text/html' });
      res.end(getUnauthorizedHTML());
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

  // Create WebSocket hub
  const wsHub = new WSHub(httpServer, {
    token: sessionToken,
    sessionId,
    rateLimit: 10,
    rateLimitWindow: 60000,
  });
  wsHub.setGuardrails(guardrailConfig);

  // Create agent manager
  spinner.message('Initializing PTY manager...');
  const agentManager = new AgentManager(config.workDir);

  try {
    await agentManager.initialize();
  } catch (error) {
    spinner.stop('Failed to initialize PTY manager');
    p.log.error(error instanceof Error ? error.message : 'Unknown error');
    p.note(
      'Run the setup script to install dependencies:\n' +
      '  ./scripts/setup-pty.sh',
      'Setup Required'
    );
    throw error;
  }

  // Connect agent manager to WebSocket hub
  wsHub.setAgentManager(agentManager);

  // Setup tmux (optional)
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
        p.log.step('Tmux session created');
      } catch (_error) {
        p.log.warning('Could not create tmux session');
        tmuxManager = null;
      }
    } else {
      p.log.warning('Tmux not installed (optional - for server-side visualization)');
      tmuxManager = null;
    }
  }

  // Create tunnel
  spinner.message('Creating secure tunnel...');
  const tunnelResult = await createTunnelWithFeedback(port);
  const tunnelUrl = tunnelResult?.url || null;

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
  };

  // Spawn initial agents
  spinner.message('Starting agents...');
  for (const agentConfig of config.agents) {
    try {
      await agentManager.createAgent(agentConfig);
      p.log.step(`Started agent: ${agentConfig.name}`);
    } catch (error) {
      p.log.error(`Failed to start ${agentConfig.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  spinner.stop('Session ready!');

  // Display session info
  const baseUrl = tunnelUrl || `http://localhost:${port}`;
  const connectUrl = `${baseUrl}?token=${sessionToken}`;

  console.log('\n');
  p.log.success('MConnect v0.1.2 - Multi-Agent Session');
  console.log('\n');

  // Display QR code
  console.log(chalk.bold('  Scan this QR code with your phone:\n'));
  qrcode.generate(connectUrl, { small: true }, (qr) => {
    console.log(qr);
  });

  console.log('\n');
  console.log(chalk.dim(`  Session ID: ${sessionId}`));
  if (tunnelUrl) {
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

  p.log.info(`Press ${chalk.cyan('Ctrl+C')} to stop the session`);
  console.log('\n');

  // Event handlers for agent manager
  agentManager.on('data', (agentId, data) => {
    process.stdout.write(data);
  });

  agentManager.on('exit', (agentId, code) => {
    p.log.info(`Agent ${agentId} exited with code ${code}`);
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
 * Cleanup session resources
 */
function cleanup(): void {
  if (!currentSession) return;

  p.log.info('Cleaning up session...');

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
  p.outro(chalk.green('Session ended. Goodbye!'));
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
 * Get current session
 */
export function getCurrentSession(): MConnectSession | null {
  return currentSession;
}
