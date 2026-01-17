/**
 * Signal Handlers for MConnect Daemon
 * MConnect v0.2.0
 *
 * Graceful shutdown handling for SIGINT, SIGTERM, etc.
 */

export type ShutdownHandler = () => Promise<void> | void;

let shutdownHandlers: ShutdownHandler[] = [];
let isShuttingDown = false;

/**
 * Setup signal handlers for graceful daemon shutdown
 *
 * @param handler - Async function to call on shutdown
 */
export function setupSignalHandlers(handler: ShutdownHandler): void {
  shutdownHandlers.push(handler);

  // Only register process handlers once
  if (shutdownHandlers.length === 1) {
    registerProcessHandlers();
  }
}

/**
 * Remove a shutdown handler
 *
 * @param handler - The handler to remove
 */
export function removeShutdownHandler(handler: ShutdownHandler): void {
  const index = shutdownHandlers.indexOf(handler);
  if (index !== -1) {
    shutdownHandlers.splice(index, 1);
  }
}

/**
 * Clear all shutdown handlers
 */
export function clearShutdownHandlers(): void {
  shutdownHandlers = [];
}

/**
 * Trigger graceful shutdown manually
 */
export async function triggerShutdown(): Promise<void> {
  await executeShutdown('manual');
}

/**
 * Register process signal handlers
 */
function registerProcessHandlers(): void {
  // SIGINT - Ctrl+C
  process.on('SIGINT', async () => {
    await executeShutdown('SIGINT');
  });

  // SIGTERM - Kill command
  process.on('SIGTERM', async () => {
    await executeShutdown('SIGTERM');
  });

  // SIGHUP - Terminal hangup
  process.on('SIGHUP', async () => {
    await executeShutdown('SIGHUP');
  });

  // Uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    await executeShutdown('uncaughtException');
    process.exit(1);
  });

  // Unhandled promise rejections
  process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled rejection:', reason);
    await executeShutdown('unhandledRejection');
    process.exit(1);
  });
}

/**
 * Execute all shutdown handlers
 *
 * @param signal - The signal that triggered shutdown
 */
async function executeShutdown(signal: string): Promise<void> {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  // Set a hard timeout for shutdown
  const shutdownTimeout = setTimeout(() => {
    console.error('Shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, 10000); // 10 second timeout

  try {
    // Execute all handlers in reverse order (LIFO)
    for (let i = shutdownHandlers.length - 1; i >= 0; i--) {
      try {
        await shutdownHandlers[i]();
      } catch (error) {
        console.error(`Error in shutdown handler: ${error}`);
      }
    }

    clearTimeout(shutdownTimeout);
    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimeout);
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Check if shutdown is in progress
 */
export function isShutdownInProgress(): boolean {
  return isShuttingDown;
}
