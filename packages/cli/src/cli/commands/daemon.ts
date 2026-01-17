/**
 * Daemon CLI Commands
 * MConnect v0.2.0
 *
 * Commands: start, stop, restart, status, logs, install, uninstall
 */

import { Command } from 'commander';
import { createConnection } from 'node:net';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawn, execSync } from 'node:child_process';
import chalk from 'chalk';
import {
  daemonize,
  isDaemonRunning,
  getDaemonPid,
  killDaemon,
} from '../../daemon/daemonize.js';
import { DaemonLogger } from '../../daemon/logging.js';
import { migrateConfig, getDataDir, getPort, getMergedConfig } from '../../config.js';

const DEFAULT_DATA_DIR = `${process.env.HOME}/.mconnect`;
const DEFAULT_IPC_PATH = '/tmp/mconnect.sock';
const DEFAULT_PORT = 8765;

/**
 * Send IPC message to daemon and get response
 */
async function sendIpcMessage(
  message: { action: string; [key: string]: unknown },
  ipcPath: string = DEFAULT_IPC_PATH
): Promise<{ status: string; data?: unknown; message?: string }> {
  return new Promise((resolve, reject) => {
    const client = createConnection(ipcPath, () => {
      client.write(JSON.stringify(message));
    });

    let data = '';
    client.on('data', (chunk) => {
      data += chunk.toString();
    });

    client.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid response from daemon'));
      }
    });

    client.on('error', (err) => {
      reject(err);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      client.destroy();
      reject(new Error('Connection timeout'));
    }, 5000);
  });
}

/**
 * Create the daemon command group
 */
export function createDaemonCommand(): Command {
  const daemon = new Command('daemon').description('Manage the MConnect daemon');

  // daemon start
  daemon
    .command('start')
    .description('Start the MConnect daemon')
    .option('--foreground', 'Run in foreground (for systemd/launchd)')
    .option('--port <port>', 'WebSocket server port', String(DEFAULT_PORT))
    .option('--ipc-path <path>', 'Unix socket path', DEFAULT_IPC_PATH)
    .action(async (options) => {
      // Run config migration if needed
      const migration = migrateConfig();
      if (migration.migrated) {
        console.log(chalk.green('  Config migrated:'), migration.message);
      } else if (migration.message) {
        console.log(chalk.yellow('  Note:'), migration.message);
      }

      const dataDir = getDataDir();

      if (options.foreground) {
        // Run in foreground mode (for service managers)
        console.log(chalk.blue('Starting MConnect daemon in foreground mode...'));

        // Dynamic import to avoid loading heavy dependencies for CLI
        const { MConnectDaemon } = await import('../../daemon/MConnectDaemon.js');
        const daemon = new MConnectDaemon({
          port: parseInt(options.port, 10),
          ipcPath: options.ipcPath,
          dataDir,
        });

        await daemon.start();
        console.log(chalk.green(`✓ MConnect daemon started on port ${options.port}`));

        // Keep running until signal
        process.on('SIGINT', async () => {
          await daemon.stop();
          process.exit(0);
        });
        process.on('SIGTERM', async () => {
          await daemon.stop();
          process.exit(0);
        });
      } else {
        // Daemonize
        if (isDaemonRunning(dataDir)) {
          const pid = getDaemonPid(dataDir);
          console.log(chalk.yellow(`Daemon is already running (PID: ${pid})`));
          process.exit(1);
        }

        try {
          // Get the path to the daemon entry script
          const scriptPath = process.argv[1];
          const pid = daemonize(scriptPath, ['daemon', 'start', '--foreground'], dataDir);
          console.log(chalk.green(`✓ MConnect daemon started (PID: ${pid})`));
          console.log(chalk.green(`✓ Listening on port ${options.port}`));
          console.log(chalk.green(`✓ IPC socket: ${options.ipcPath}`));
        } catch (error) {
          console.error(chalk.red(`Failed to start daemon: ${error instanceof Error ? error.message : error}`));
          process.exit(1);
        }
      }
    });

  // daemon stop
  daemon
    .command('stop')
    .description('Stop the running daemon')
    .option('--force', 'Kill immediately (SIGKILL)')
    .option('--timeout <ms>', 'Grace period before force kill', '5000')
    .action(async (options) => {
      const dataDir = process.env.MCONNECT_HOME || DEFAULT_DATA_DIR;

      if (!isDaemonRunning(dataDir)) {
        console.log(chalk.yellow('Daemon is not running'));
        process.exit(1);
      }

      const pid = getDaemonPid(dataDir);
      console.log(chalk.blue(`Stopping daemon (PID: ${pid})...`));

      // Try graceful shutdown via IPC first
      try {
        await sendIpcMessage({ action: 'shutdown' });
        console.log(chalk.green('✓ Daemon stopped gracefully'));
      } catch {
        // Fall back to signal
        if (killDaemon(dataDir, options.force)) {
          console.log(chalk.green('✓ Daemon stopped'));
        } else {
          console.error(chalk.red('Failed to stop daemon'));
          process.exit(1);
        }
      }
    });

  // daemon restart
  daemon
    .command('restart')
    .description('Restart the daemon')
    .option('--port <port>', 'WebSocket server port', String(DEFAULT_PORT))
    .option('--ipc-path <path>', 'Unix socket path', DEFAULT_IPC_PATH)
    .action(async (options) => {
      const dataDir = process.env.MCONNECT_HOME || DEFAULT_DATA_DIR;

      // Stop if running
      if (isDaemonRunning(dataDir)) {
        console.log(chalk.blue('Stopping existing daemon...'));
        killDaemon(dataDir);
        // Wait for it to stop
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Start
      try {
        const scriptPath = process.argv[1];
        const pid = daemonize(scriptPath, ['daemon', 'start', '--foreground'], dataDir);
        console.log(chalk.green(`✓ MConnect daemon restarted (PID: ${pid})`));
      } catch (error) {
        console.error(chalk.red(`Failed to restart daemon: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // daemon status
  daemon
    .command('status')
    .description('Show daemon health and statistics')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const dataDir = process.env.MCONNECT_HOME || DEFAULT_DATA_DIR;

      if (!isDaemonRunning(dataDir)) {
        if (options.json) {
          console.log(JSON.stringify({ status: 'stopped' }));
        } else {
          console.log(chalk.yellow('MConnect Daemon Status'));
          console.log(chalk.gray('──────────────────────'));
          console.log(`Status:     ${chalk.red('Stopped')}`);
        }
        process.exit(1);
      }

      try {
        const response = await sendIpcMessage({ action: 'status' });

        if (options.json) {
          console.log(JSON.stringify(response.data));
        } else {
          const data = response.data as any;
          console.log(chalk.blue('MConnect Daemon Status'));
          console.log(chalk.gray('──────────────────────'));
          console.log(`Status:     ${chalk.green('Running')} (PID: ${data.pid})`);
          console.log(`Uptime:     ${formatUptime(data.uptime)}`);
          console.log(`Port:       ${data.port}`);
          console.log(`IPC:        ${data.ipcPath}`);
          console.log('');
          console.log(`Sessions:   ${data.sessions.running} running, ${data.sessions.completed} completed`);
          console.log(`Clients:    ${data.clients.pc} PC, ${data.clients.mobile} mobile`);
          console.log('');
          console.log(`Memory:     ${formatBytes(data.memory)}`);
        }
      } catch (error) {
        console.error(chalk.red(`Failed to get daemon status: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // daemon logs
  daemon
    .command('logs')
    .description('View daemon logs')
    .option('-n, --lines <count>', 'Number of lines to show', '50')
    .option('-f, --follow', 'Follow log output')
    .action(async (options) => {
      const dataDir = process.env.MCONNECT_HOME || DEFAULT_DATA_DIR;
      const logger = new DaemonLogger(dataDir);
      const logPath = logger.getLogPath();

      if (!existsSync(logPath)) {
        console.log(chalk.yellow('No log file found'));
        process.exit(1);
      }

      const lines = parseInt(options.lines, 10);
      const logLines = logger.readLastLines(lines);

      for (const line of logLines) {
        console.log(line);
      }

      if (options.follow) {
        // Use tail -f for following
        const tail = spawn('tail', ['-f', logPath], { stdio: 'inherit' });
        tail.on('error', () => {
          console.error(chalk.red('Failed to follow logs'));
        });
      }
    });

  // daemon install
  daemon
    .command('install')
    .description('Install daemon as a system service')
    .option('--no-start', "Don't start after install")
    .action(async (options) => {
      const platform = process.platform;
      const dataDir = process.env.MCONNECT_HOME || DEFAULT_DATA_DIR;

      console.log(chalk.blue('Installing MConnect daemon service...'));

      if (platform === 'darwin') {
        await installMacOS(dataDir, options.start);
      } else if (platform === 'linux') {
        await installLinux(dataDir, options.start);
      } else {
        console.error(chalk.red(`Unsupported platform: ${platform}`));
        process.exit(1);
      }

      console.log(chalk.green('✓ MConnect daemon installed successfully'));
    });

  // daemon uninstall
  daemon
    .command('uninstall')
    .description('Remove daemon system service')
    .option('--keep-sessions', "Don't terminate running sessions")
    .action(async (options) => {
      const platform = process.platform;
      const dataDir = process.env.MCONNECT_HOME || DEFAULT_DATA_DIR;

      console.log(chalk.blue('Uninstalling MConnect daemon service...'));

      // Stop daemon first
      if (isDaemonRunning(dataDir)) {
        console.log(chalk.blue('Stopping daemon...'));
        killDaemon(dataDir);
      }

      if (platform === 'darwin') {
        await uninstallMacOS();
      } else if (platform === 'linux') {
        await uninstallLinux();
      } else {
        console.error(chalk.red(`Unsupported platform: ${platform}`));
        process.exit(1);
      }

      console.log(chalk.green('✓ MConnect daemon uninstalled'));
    });

  return daemon;
}

/**
 * Install on macOS using launchd
 */
async function installMacOS(dataDir: string, start: boolean): Promise<void> {
  const plistPath = `${process.env.HOME}/Library/LaunchAgents/com.lecoder.mconnect.plist`;
  const execPath = process.argv[1]; // Current executable path

  // Get template
  const templatePath = join(dirname(execPath), '../assets/com.lecoder.mconnect.plist');
  let plistContent: string;

  if (existsSync(templatePath)) {
    plistContent = readFileSync(templatePath, 'utf-8');
  } else {
    // Generate plist
    plistContent = generateMacOSPlist(execPath, dataDir);
  }

  // Ensure directory exists
  const launchAgentsDir = `${process.env.HOME}/Library/LaunchAgents`;
  if (!existsSync(launchAgentsDir)) {
    mkdirSync(launchAgentsDir, { recursive: true });
  }

  // Write plist
  writeFileSync(plistPath, plistContent, 'utf-8');
  console.log(chalk.green(`✓ Created ${plistPath}`));

  // Load the service
  try {
    execSync(`launchctl load ${plistPath}`, { stdio: 'inherit' });
    console.log(chalk.green('✓ Service enabled (will start on login)'));
  } catch {
    console.warn(chalk.yellow('Warning: Failed to load service'));
  }

  if (start) {
    try {
      execSync(`launchctl start com.lecoder.mconnect`, { stdio: 'inherit' });
      console.log(chalk.green('✓ Starting daemon...'));
    } catch {
      console.warn(chalk.yellow('Warning: Failed to start service'));
    }
  }
}

/**
 * Install on Linux using systemd
 */
async function installLinux(dataDir: string, start: boolean): Promise<void> {
  const servicePath = `${process.env.HOME}/.config/systemd/user/mconnect.service`;
  const execPath = process.argv[1];

  // Get template
  const templatePath = join(dirname(execPath), '../assets/mconnect.service');
  let serviceContent: string;

  if (existsSync(templatePath)) {
    serviceContent = readFileSync(templatePath, 'utf-8');
  } else {
    // Generate service file
    serviceContent = generateLinuxService(execPath, dataDir);
  }

  // Ensure directory exists
  const systemdDir = `${process.env.HOME}/.config/systemd/user`;
  if (!existsSync(systemdDir)) {
    mkdirSync(systemdDir, { recursive: true });
  }

  // Write service file
  writeFileSync(servicePath, serviceContent, 'utf-8');
  console.log(chalk.green(`✓ Created ${servicePath}`));

  // Reload systemd
  try {
    execSync('systemctl --user daemon-reload', { stdio: 'inherit' });
    execSync('systemctl --user enable mconnect.service', { stdio: 'inherit' });
    console.log(chalk.green('✓ Service enabled (will start on login)'));
  } catch {
    console.warn(chalk.yellow('Warning: Failed to enable service'));
  }

  if (start) {
    try {
      execSync('systemctl --user start mconnect.service', { stdio: 'inherit' });
      console.log(chalk.green('✓ Starting daemon...'));
    } catch {
      console.warn(chalk.yellow('Warning: Failed to start service'));
    }
  }
}

/**
 * Uninstall on macOS
 */
async function uninstallMacOS(): Promise<void> {
  const plistPath = `${process.env.HOME}/Library/LaunchAgents/com.lecoder.mconnect.plist`;

  try {
    execSync(`launchctl unload ${plistPath}`, { stdio: 'inherit' });
  } catch {
    // Ignore if not loaded
  }

  if (existsSync(plistPath)) {
    unlinkSync(plistPath);
    console.log(chalk.green(`✓ Removed ${plistPath}`));
  }
}

/**
 * Uninstall on Linux
 */
async function uninstallLinux(): Promise<void> {
  const servicePath = `${process.env.HOME}/.config/systemd/user/mconnect.service`;

  try {
    execSync('systemctl --user stop mconnect.service', { stdio: 'inherit' });
    execSync('systemctl --user disable mconnect.service', { stdio: 'inherit' });
  } catch {
    // Ignore if not running
  }

  if (existsSync(servicePath)) {
    unlinkSync(servicePath);
    console.log(chalk.green(`✓ Removed ${servicePath}`));
  }

  try {
    execSync('systemctl --user daemon-reload', { stdio: 'inherit' });
  } catch {
    // Ignore
  }
}

/**
 * Generate macOS launchd plist
 */
function generateMacOSPlist(execPath: string, dataDir: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.lecoder.mconnect</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${execPath}</string>
    <string>daemon</string>
    <string>start</string>
    <string>--foreground</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>MCONNECT_HOME</key>
    <string>${dataDir}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${dataDir}/logs/daemon.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${dataDir}/logs/daemon.stderr.log</string>
</dict>
</plist>`;
}

/**
 * Generate Linux systemd service file
 */
function generateLinuxService(execPath: string, dataDir: string): string {
  return `[Unit]
Description=MConnect Daemon
After=network.target

[Service]
Type=simple
ExecStart=${process.execPath} ${execPath} daemon start --foreground
Environment=MCONNECT_HOME=${dataDir}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target`;
}

/**
 * Format uptime in human readable form
 */
function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Format bytes in human readable form
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let value = bytes;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
