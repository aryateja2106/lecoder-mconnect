/**
 * MConnect Doctor - System diagnostics
 *
 * Checks all dependencies and provides clear guidance on what's missing.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import chalk from 'chalk';

// Use createRequire to load CommonJS modules in ESM
const require = createRequire(import.meta.url);

export interface DiagnosticResult {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  fix?: string;
}

/**
 * Check if a command exists in PATH
 */
function commandExists(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get command version
 */
function getVersion(cmd: string, args: string = '--version'): string | null {
  try {
    const output = execSync(`${cmd} ${args}`, { encoding: 'utf8', stdio: 'pipe' });
    return output.trim().split('\n')[0];
  } catch {
    return null;
  }
}

/**
 * Check if node-pty can be loaded and spawn-helper exists
 */
async function checkNodePty(): Promise<DiagnosticResult> {
  try {
    // Use require() for CommonJS native module compatibility
    const _nodePty = require('node-pty');

    // On macOS, also check for spawn-helper
    if (process.platform === 'darwin') {
      const path = await import('node:path');
      const fs = await import('node:fs');

      // Try to find spawn-helper in node-pty directory
      const nodePtyPath = require.resolve('node-pty');
      const libDir = path.dirname(nodePtyPath);

      // Detect architecture
      const arch = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
      const spawnHelperPath = path.join(libDir, '..', 'prebuilds', arch, 'spawn-helper');

      if (fs.existsSync(spawnHelperPath)) {
        try {
          fs.accessSync(spawnHelperPath, fs.constants.X_OK);
          return {
            name: 'node-pty',
            status: 'ok',
            message: `Native PTY module loaded (${arch} spawn-helper found)`,
          };
        } catch {
          return {
            name: 'node-pty',
            status: 'error',
            message: `spawn-helper exists but is not executable`,
            fix: `Run: chmod +x ${spawnHelperPath}`,
          };
        }
      } else {
        return {
          name: 'node-pty',
          status: 'warning',
          message: `node-pty loaded but spawn-helper not found at ${spawnHelperPath}`,
          fix: 'Run: npm rebuild node-pty',
        };
      }
    }

    return {
      name: 'node-pty',
      status: 'ok',
      message: 'Native PTY module loaded successfully',
    };
  } catch (error: any) {
    const errorMsg = error?.message || 'Unknown error';

    // Check if it's a "not found" vs "failed to load" error
    if (errorMsg.includes('Cannot find module') || errorMsg.includes('MODULE_NOT_FOUND')) {
      return {
        name: 'node-pty',
        status: 'error',
        message: 'node-pty module not found',
        fix: 'Run: npm install && npm rebuild node-pty',
      };
    } else if (errorMsg.includes('was compiled against a different Node.js version')) {
      return {
        name: 'node-pty',
        status: 'error',
        message: 'node-pty needs rebuild for current Node.js version',
        fix: 'Run: npm rebuild node-pty',
      };
    } else {
      return {
        name: 'node-pty',
        status: 'error',
        message: `node-pty failed to load: ${errorMsg.substring(0, 100)}`,
        fix: 'Run: npm install && npm rebuild node-pty',
      };
    }
  }
}

/**
 * Check Node.js version
 */
function checkNode(): DiagnosticResult {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);

  if (major >= 20) {
    return {
      name: 'Node.js',
      status: 'ok',
      message: `Node.js ${version} installed`,
    };
  } else if (major >= 18) {
    return {
      name: 'Node.js',
      status: 'warning',
      message: `Node.js ${version} (v20+ recommended)`,
    };
  } else {
    return {
      name: 'Node.js',
      status: 'error',
      message: `Node.js ${version} is too old`,
      fix: 'Install Node.js 20 or later from https://nodejs.org',
    };
  }
}

/**
 * Check Python (required for node-gyp)
 */
function checkPython(): DiagnosticResult {
  if (commandExists('python3')) {
    const version = getVersion('python3');
    return {
      name: 'Python',
      status: 'ok',
      message: version || 'Python 3 installed',
    };
  } else if (commandExists('python')) {
    const version = getVersion('python');
    if (version?.includes('Python 3')) {
      return {
        name: 'Python',
        status: 'ok',
        message: version,
      };
    }
  }

  return {
    name: 'Python',
    status: 'error',
    message: 'Python 3 not found',
    fix:
      process.platform === 'darwin' ? 'Run: brew install python3' : 'Run: sudo apt install python3',
  };
}

/**
 * Check C++ compiler
 */
function checkCompiler(): DiagnosticResult {
  if (process.platform === 'darwin') {
    try {
      execSync('xcode-select -p', { stdio: 'pipe' });
      return {
        name: 'C++ Compiler',
        status: 'ok',
        message: 'Xcode Command Line Tools installed',
      };
    } catch {
      return {
        name: 'C++ Compiler',
        status: 'error',
        message: 'Xcode Command Line Tools not found',
        fix: 'Run: xcode-select --install',
      };
    }
  } else {
    if (commandExists('g++')) {
      const version = getVersion('g++');
      return {
        name: 'C++ Compiler',
        status: 'ok',
        message: version || 'g++ installed',
      };
    }
    return {
      name: 'C++ Compiler',
      status: 'error',
      message: 'g++ not found',
      fix: 'Run: sudo apt install build-essential',
    };
  }
}

/**
 * Check tmux (optional)
 */
function checkTmux(): DiagnosticResult {
  if (commandExists('tmux')) {
    const version = getVersion('tmux', '-V');
    return {
      name: 'tmux',
      status: 'ok',
      message: version || 'tmux installed',
    };
  }
  return {
    name: 'tmux',
    status: 'warning',
    message: 'tmux not found (optional - for server visualization)',
    fix: process.platform === 'darwin' ? 'Run: brew install tmux' : 'Run: sudo apt install tmux',
  };
}

/**
 * Check cloudflared (optional)
 */
function checkCloudflared(): DiagnosticResult {
  if (commandExists('cloudflared')) {
    const version = getVersion('cloudflared');
    return {
      name: 'cloudflared',
      status: 'ok',
      message: version || 'cloudflared installed',
    };
  }
  return {
    name: 'cloudflared',
    status: 'warning',
    message: 'cloudflared not found (optional - for remote access)',
    fix:
      process.platform === 'darwin'
        ? 'Run: brew install cloudflared'
        : 'See: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/',
  };
}

/**
 * Check default shell
 */
function checkShell(): DiagnosticResult {
  const shell = process.env.SHELL || '/bin/bash';
  if (existsSync(shell)) {
    return {
      name: 'Shell',
      status: 'ok',
      message: `Default shell: ${shell}`,
    };
  }
  return {
    name: 'Shell',
    status: 'error',
    message: `Shell not found: ${shell}`,
    fix: 'Set the SHELL environment variable to a valid shell path',
  };
}

/**
 * Run all diagnostics
 */
export async function runDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  // Required checks
  results.push(checkNode());
  results.push(checkShell());
  results.push(checkPython());
  results.push(checkCompiler());
  results.push(await checkNodePty());

  // Optional checks
  results.push(checkTmux());
  results.push(checkCloudflared());

  return results;
}

/**
 * Print diagnostic results
 */
export function printDiagnostics(results: DiagnosticResult[]): void {
  console.log(`\n${chalk.bold('MConnect v0.1.2 - System Diagnostics')}\n`);

  let hasErrors = false;
  let hasWarnings = false;

  for (const result of results) {
    let icon: string;
    let color: typeof chalk;

    switch (result.status) {
      case 'ok':
        icon = '✓';
        color = chalk.green;
        break;
      case 'warning':
        icon = '!';
        color = chalk.yellow;
        hasWarnings = true;
        break;
      case 'error':
        icon = '✗';
        color = chalk.red;
        hasErrors = true;
        break;
    }

    console.log(color(`  ${icon} ${result.name}: ${result.message}`));
    if (result.fix) {
      console.log(chalk.dim(`    → ${result.fix}`));
    }
  }

  console.log('');

  if (hasErrors) {
    console.log(chalk.red.bold('  Some required dependencies are missing.'));
    console.log(chalk.dim('  Please fix the errors above before running MConnect.\n'));
  } else if (hasWarnings) {
    console.log(chalk.yellow('  Some optional dependencies are missing.'));
    console.log(chalk.dim('  MConnect will work, but some features may be unavailable.\n'));
  } else {
    console.log(chalk.green.bold('  All checks passed! MConnect is ready to use.\n'));
  }
}

/**
 * Check if node-pty is available (quick check)
 */
export async function isNodePtyAvailable(): Promise<boolean> {
  try {
    // Use require() for CommonJS native module compatibility
    require('node-pty');
    return true;
  } catch (error: any) {
    // Log detailed error for debugging
    if (process.env.DEBUG) {
      console.error('node-pty load error:', error?.message);
    }
    return false;
  }
}

/**
 * Get detailed node-pty error for diagnostics
 */
export async function getNodePtyError(): Promise<string | null> {
  try {
    // Use require() for CommonJS native module compatibility
    require('node-pty');
    return null;
  } catch (error: any) {
    return error?.message || 'Unknown error loading node-pty';
  }
}

/**
 * Try to install node-pty automatically
 */
export async function tryInstallNodePty(): Promise<boolean> {
  console.log(chalk.yellow('\n  Attempting to install node-pty...\n'));

  try {
    execSync('npm install node-pty', {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    return true;
  } catch {
    return false;
  }
}
