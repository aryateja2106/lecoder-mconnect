import { spawn, ChildProcess, execSync } from 'child_process';
import { existsSync } from 'fs';
import { EventEmitter } from 'events';
import * as p from '@clack/prompts';

export interface TunnelConfig {
  localPort: number;
  protocol?: 'http' | 'tcp';
}

export interface TunnelResult {
  url: string;
  process: ChildProcess;
}

// Common cloudflared installation paths
const CLOUDFLARED_PATHS = [
  'cloudflared',                          // In PATH
  '/usr/local/bin/cloudflared',           // Homebrew Intel Mac
  '/opt/homebrew/bin/cloudflared',        // Homebrew Apple Silicon
  '/usr/bin/cloudflared',                 // Linux package manager
  `${process.env.HOME}/.cloudflared/cloudflared`, // User install
];

/**
 * Find cloudflared binary path
 */
function findCloudflared(): string | null {
  // First try using 'command -v' which is more portable than 'which'
  try {
    const result = execSync('command -v cloudflared', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (result.trim()) {
      return result.trim();
    }
  } catch {
    // Ignore error, try other methods
  }

  // Check known paths
  for (const path of CLOUDFLARED_PATHS) {
    if (path === 'cloudflared') continue; // Skip generic, already tried above
    if (existsSync(path)) {
      return path;
    }
  }

  return null;
}

/**
 * Cloudflare Tunnel Manager
 * Creates ephemeral tunnels using cloudflared (quick tunnels)
 */
export class TunnelManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private url: string | null = null;
  private cloudflaredPath: string | null = null;

  /**
   * Check if cloudflared is installed and get path
   */
  async isCloudflaredInstalled(): Promise<boolean> {
    this.cloudflaredPath = findCloudflared();
    return this.cloudflaredPath !== null;
  }

  /**
   * Get the cloudflared binary path
   */
  getCloudflaredPath(): string | null {
    return this.cloudflaredPath;
  }

  /**
   * Start a quick tunnel (no account required)
   * Uses trycloudflare.com - no configuration needed
   */
  async startTunnel(config: TunnelConfig): Promise<TunnelResult> {
    if (!this.cloudflaredPath) {
      const found = await this.isCloudflaredInstalled();
      if (!found) {
        throw new Error(
          'cloudflared not found. Install it:\n' +
          '  macOS: brew install cloudflared\n' +
          '  Linux: See https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/'
        );
      }
    }

    return new Promise((resolve, reject) => {
      // Start cloudflared quick tunnel (trycloudflare.com - no config needed)
      const args = [
        'tunnel',
        '--url',
        `http://localhost:${config.localPort}`,
        '--no-autoupdate',
      ];

      this.process = spawn(this.cloudflaredPath!, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let urlFound = false;
      let errorOutput = '';

      const timeout = setTimeout(() => {
        if (!urlFound) {
          this.stop();
          reject(new Error(`Tunnel startup timeout. Error output:\n${errorOutput}`));
        }
      }, 30000);

      // Parse output for the tunnel URL
      const parseOutput = (data: Buffer) => {
        const output = data.toString();
        errorOutput += output;

        // Look for the trycloudflare.com URL (quick tunnel)
        const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
        if (urlMatch && !urlFound) {
          urlFound = true;
          clearTimeout(timeout);
          this.url = urlMatch[0];
          this.emit('ready', this.url);
          resolve({
            url: this.url,
            process: this.process!,
          });
        }
      };

      this.process.stdout?.on('data', parseOutput);
      this.process.stderr?.on('data', parseOutput);

      this.process.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start tunnel: ${error.message}`));
      });

      this.process.on('close', (code) => {
        if (!urlFound) {
          clearTimeout(timeout);
          reject(new Error(`Tunnel exited with code ${code}. Output:\n${errorOutput}`));
        }
        this.emit('close', code);
      });
    });
  }

  /**
   * Stop the tunnel
   */
  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.url = null;
    }
  }

  /**
   * Get the current tunnel URL
   */
  getUrl(): string | null {
    return this.url;
  }
}

/**
 * Create a tunnel with user feedback
 * Note: Caller should manage spinner - this function uses log messages only
 */
export async function createTunnelWithFeedback(port: number): Promise<TunnelResult | null> {
  const manager = new TunnelManager();

  const installed = await manager.isCloudflaredInstalled();
  if (!installed) {
    // No cloudflared - just return null, caller handles the fallback
    return null;
  }

  p.log.step(`Found cloudflared at: ${manager.getCloudflaredPath()}`);

  try {
    const result = await manager.startTunnel({ localPort: port });
    p.log.step('Tunnel established');
    return result;
  } catch (error) {
    p.log.warning(error instanceof Error ? error.message : 'Unknown tunnel error');
    return null;
  }
}
