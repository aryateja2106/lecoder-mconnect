/**
 * MConnect Daemon - Main daemon class
 * MConnect v0.2.0
 *
 * Background service that manages sessions, WebSocket server, and IPC
 */

import { createServer, type Server } from 'node:net';
import { unlinkSync, existsSync } from 'node:fs';
import { WebSocketServer } from 'ws';
import { DaemonLogger } from './logging.js';
import { setupSignalHandlers } from './signals.js';

export interface DaemonConfig {
  port: number;
  ipcPath: string;
  dataDir: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface DaemonStatus {
  status: 'running' | 'stopped';
  pid?: number;
  uptime?: number;
  port: number;
  ipcPath: string;
  sessions: {
    running: number;
    completed: number;
  };
  clients: {
    pc: number;
    mobile: number;
  };
  memory?: number;
  cpu?: number;
}

const DEFAULT_CONFIG: DaemonConfig = {
  port: 8765,
  ipcPath: '/tmp/mconnect.sock',
  dataDir: `${process.env.HOME}/.mconnect`,
};

export class MConnectDaemon {
  private config: DaemonConfig;
  private logger: DaemonLogger;
  private wsServer: WebSocketServer | null = null;
  private ipcServer: Server | null = null;
  private startTime: number = 0;
  private isRunning = false;

  constructor(config: Partial<DaemonConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new DaemonLogger(this.config.dataDir, this.config.logLevel);
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Daemon is already running');
    }

    this.logger.info('Starting MConnect daemon...');
    this.startTime = Date.now();

    // Setup signal handlers for graceful shutdown
    setupSignalHandlers(async () => {
      await this.stop();
    });

    // Start WebSocket server
    await this.startWebSocketServer();

    // Start IPC server for local CLI communication
    await this.startIPCServer();

    this.isRunning = true;
    this.logger.info(`Daemon started on port ${this.config.port}`);
    this.logger.info(`IPC socket: ${this.config.ipcPath}`);
  }

  /**
   * Stop the daemon gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping MConnect daemon...');

    // Close WebSocket server
    if (this.wsServer) {
      await new Promise<void>((resolve) => {
        this.wsServer?.close(() => resolve());
      });
      this.wsServer = null;
    }

    // Close IPC server
    if (this.ipcServer) {
      await new Promise<void>((resolve) => {
        this.ipcServer?.close(() => resolve());
      });
      this.ipcServer = null;
    }

    this.isRunning = false;
    this.logger.info('Daemon stopped');
  }

  /**
   * Get daemon status
   */
  getStatus(): DaemonStatus {
    const memUsage = process.memoryUsage();

    return {
      status: this.isRunning ? 'running' : 'stopped',
      pid: process.pid,
      uptime: this.isRunning ? Math.floor((Date.now() - this.startTime) / 1000) : undefined,
      port: this.config.port,
      ipcPath: this.config.ipcPath,
      sessions: {
        running: 0, // TODO: Get from SessionManager
        completed: 0,
      },
      clients: {
        pc: 0, // TODO: Get from ClientRegistry
        mobile: 0,
      },
      memory: memUsage.heapUsed,
      cpu: 0, // TODO: Calculate CPU usage
    };
  }

  /**
   * Check if daemon is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Start the WebSocket server
   */
  private async startWebSocketServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wsServer = new WebSocketServer({ port: this.config.port });

        this.wsServer.on('listening', () => {
          this.logger.info(`WebSocket server listening on port ${this.config.port}`);
          resolve();
        });

        this.wsServer.on('error', (error) => {
          this.logger.error(`WebSocket server error: ${error.message}`);
          reject(error);
        });

        this.wsServer.on('connection', (ws, req) => {
          this.logger.debug(`New WebSocket connection from ${req.socket.remoteAddress}`);
          // TODO: Handle connection with protocol v2
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Start the IPC server for local CLI communication
   */
  private async startIPCServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Remove existing socket file if it exists
        if (existsSync(this.config.ipcPath)) {
          unlinkSync(this.config.ipcPath);
        }

        this.ipcServer = createServer((socket) => {
          this.logger.debug('New IPC connection');

          socket.on('data', (data) => {
            try {
              const message = JSON.parse(data.toString());
              this.handleIPCMessage(message, socket);
            } catch (error) {
              socket.write(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
            }
          });

          socket.on('error', (error) => {
            this.logger.error(`IPC socket error: ${error.message}`);
          });
        });

        this.ipcServer.listen(this.config.ipcPath, () => {
          this.logger.info(`IPC server listening on ${this.config.ipcPath}`);
          resolve();
        });

        this.ipcServer.on('error', (error) => {
          this.logger.error(`IPC server error: ${error.message}`);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle IPC messages from CLI
   */
  private handleIPCMessage(message: { action: string; [key: string]: unknown }, socket: import('node:net').Socket): void {
    switch (message.action) {
      case 'status':
        socket.write(JSON.stringify({ status: 'ok', data: this.getStatus() }));
        break;

      case 'session_list':
        // TODO: Implement session listing
        socket.write(JSON.stringify({ status: 'ok', data: { sessions: [] } }));
        break;

      case 'session_create':
        // TODO: Implement session creation
        socket.write(JSON.stringify({ status: 'ok', data: { sessionId: 'placeholder' } }));
        break;

      case 'session_attach':
        // TODO: Implement session attach
        socket.write(JSON.stringify({ status: 'ok', data: {} }));
        break;

      case 'session_kill':
        // TODO: Implement session termination
        socket.write(JSON.stringify({ status: 'ok', data: {} }));
        break;

      case 'shutdown':
        socket.write(JSON.stringify({ status: 'ok', message: 'Shutting down' }));
        this.stop();
        break;

      default:
        socket.write(JSON.stringify({ status: 'error', message: `Unknown action: ${message.action}` }));
    }
  }
}
