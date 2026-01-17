#!/usr/bin/env node
/**
 * Quick start script - bypasses wizard and starts session directly
 */

import { startSession } from './packages/cli/src/session.js';
import { getDefaultShell } from './packages/cli/src/agents/types.js';

// T015: Add unhandledRejection handler to log errors instead of crashing
process.on('unhandledRejection', (reason, _promise) => {
  console.error('[MConnect] Unhandled Promise rejection:', reason);
  // Don't exit - let the session continue running
});

// T014: Ensure uncaughtException doesn't crash the server
process.on('uncaughtException', (error) => {
  console.error('[MConnect] Uncaught exception:', error);
  // For critical errors, still exit gracefully
  if (error.message?.includes('EADDRINUSE') || error.message?.includes('EACCES')) {
    process.exit(1);
  }
  // Otherwise, try to continue
});

async function main() {
  await startSession({
    workDir: process.cwd(),
    guardrails: 'default',
    agents: [
      {
        type: 'shell',
        name: 'Shell',
        command: getDefaultShell(),
      },
    ],
    enableTmux: false,
    port: 8765,
  });
}

main().catch((error) => {
  console.error('[MConnect] Fatal error:', error);
  process.exit(1);
});
