/**
 * Sidecar CLI Command
 * MConnect v1.1.0
 *
 * Command for starting a sidecar session that attaches to
 * the current terminal instead of spawning new shells.
 */

import { Command } from 'commander';
import qrcode from 'qrcode-terminal';
import { SidecarSession, type SidecarConfig } from '../../sidecar/index.js';

/**
 * Log helper for consistent output
 */
function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info'): void {
  const prefix = {
    info: '[INFO]',
    success: '[OK]',
    error: '[ERROR]',
    warn: '[WARN]',
  };
  console.log(`${prefix[type]} ${message}`);
}

/**
 * Create the sidecar command
 */
export function createSidecarCommand(): Command {
  const cmd = new Command('sidecar');

  cmd
    .description('Start a sidecar session to share the current terminal')
    .option('--port <number>', 'Server port (default: 8765)', '8765')
    .option('--no-tunnel', 'Disable Cloudflare tunnel')
    .option('--observe-only', 'Read-only mode (no input forwarding)')
    .option('--background', 'Run in background after printing connection info')
    .option('--json', 'Output connection info as JSON')
    .option('--web-url <url>', 'Web app URL for external UI')
    .action(async (options) => {
      await runSidecar({
        port: parseInt(options.port, 10),
        enableTunnel: options.tunnel !== false,
        observeOnly: options.observeOnly === true,
        background: options.background === true,
        webUrl: options.webUrl,
      }, options.json === true);
    });

  return cmd;
}

/**
 * Run the sidecar session
 */
async function runSidecar(config: SidecarConfig, jsonOutput: boolean): Promise<void> {
  const session = new SidecarSession(config);

  // Set up event handlers
  session.on('client_connected', (client) => {
    if (!jsonOutput && !config.background) {
      log(`Client connected: ${client.id} (${client.type})`, 'success');
    }
  });

  session.on('client_disconnected', (client) => {
    if (!jsonOutput && !config.background) {
      log(`Client disconnected: ${client.id}`, 'info');
    }
  });

  session.on('input_rejected', ({ clientId, reason }) => {
    if (!jsonOutput && !config.background) {
      log(`Input rejected from ${clientId}: ${reason}`, 'warn');
    }
  });

  session.on('error', (error) => {
    if (!jsonOutput) {
      log(error.message, 'error');
    }
  });

  try {
    log('Starting sidecar session...');
    const info = await session.start();
    const connectionInfo = session.getConnectionInfo();

    if (!connectionInfo) {
      throw new Error('Failed to get connection info');
    }

    // Build connect URL
    let connectUrl = connectionInfo.tunnelUrl || connectionInfo.localUrl;
    if (config.webUrl) {
      const webUrl = new URL(config.webUrl);
      webUrl.searchParams.set('server', connectUrl);
      connectUrl = webUrl.toString();
    }

    if (jsonOutput) {
      // JSON output for programmatic use
      console.log(JSON.stringify({
        success: true,
        mode: 'sidecar',
        sessionId: connectionInfo.sessionId,
        pairingCode: connectionInfo.pairingCode,
        localUrl: connectionInfo.localUrl,
        tunnelUrl: connectionInfo.tunnelUrl || null,
        connectUrl,
        attached: info.attached,
        terminalSize: info.terminalSize,
        observeOnly: config.observeOnly || false,
      }, null, 2));
    } else if (config.background) {
      // Compact output for background mode
      console.log('\n');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('  MCONNECT SIDECAR SESSION READY');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`  PAIRING CODE:  ${connectionInfo.pairingCode}`);
      console.log(`  SESSION ID:    ${connectionInfo.sessionId}`);
      console.log(`  MODE:          ${config.observeOnly ? 'Observe Only' : 'Full Control'}`);
      if (connectionInfo.tunnelUrl) {
        console.log(`  REMOTE URL:    ${connectionInfo.tunnelUrl}`);
      }
      console.log(`  LOCAL URL:     ${connectionInfo.localUrl}`);
      console.log('───────────────────────────────────────────────────────────────');
      console.log(`  CONNECT:       ${connectUrl}`);
      console.log('═══════════════════════════════════════════════════════════════');
      return; // Exit for background mode
    } else {
      // Full interactive output
      console.log('\n');
      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║              MConnect Sidecar Session Ready                  ║');
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log('║                                                              ║');
      console.log('║  SCAN THIS QR CODE TO CONNECT:                               ║');
      console.log('║                                                              ║');
      console.log('╚══════════════════════════════════════════════════════════════╝');

      // Generate QR code
      await new Promise<void>((resolve) => {
        qrcode.generate(connectUrl, { small: true }, (qr) => {
          console.log(qr);
          resolve();
        });
      });

      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log(`║  Pairing Code: ${connectionInfo.pairingCode}                                       ║`);
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log(`║  Mode:         ${config.observeOnly ? 'Observe Only (read-only)' : 'Full Control      '}         ║`);
      console.log(`║  Terminal:     ${info.terminalSize.cols}x${info.terminalSize.rows}                                       ║`);
      console.log(`║  Session ID:   ${connectionInfo.sessionId}                       ║`);
      if (connectionInfo.tunnelUrl) {
        const shortUrl = connectionInfo.tunnelUrl.length > 45
          ? connectionInfo.tunnelUrl.substring(0, 42) + '...'
          : connectionInfo.tunnelUrl;
        console.log(`║  Remote URL:   ${shortUrl.padEnd(45)}║`);
      }
      console.log(`║  Local URL:    ${connectionInfo.localUrl.padEnd(45)}║`);
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log('║                                                              ║');
      console.log('║  This session shares your current terminal.                  ║');
      console.log('║  Press Ctrl+C to stop the sidecar.                           ║');
      console.log('║                                                              ║');
      console.log('╚══════════════════════════════════════════════════════════════╝');
      console.log('\n');
    }

    // Keep running until signal
    await new Promise<void>((resolve) => {
      const cleanup = async () => {
        if (!jsonOutput) {
          log('Stopping sidecar session...');
        }
        await session.stop();
        if (!jsonOutput) {
          log('Sidecar session ended', 'success');
        }
        resolve();
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
    });

  } catch (error) {
    if (jsonOutput) {
      console.log(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }, null, 2));
    } else {
      log(error instanceof Error ? error.message : String(error), 'error');
    }
    process.exit(1);
  }
}
