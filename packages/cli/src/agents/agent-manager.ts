/**
 * Agent Manager for MConnect
 *
 * Shell-first architecture: All agents spawn a shell first,
 * then optionally run commands inside that shell.
 *
 * Container support: Agents can optionally run inside Docker containers
 * for isolation, supporting both inline config and devcontainer.json.
 */

import { randomBytes } from 'node:crypto';
import { type ContainerInstance, getContainerManager } from '../container/index.js';
import { getOpikTracer } from '../opik/index.js';
import { getPTYManager, type PTYManager } from '../pty/pty-manager.js';
import type { PTYInstance } from '../pty/types.js';
import type { AgentConfig, AgentInfo, AgentStatus } from './types.js';
import { AGENT_COMMANDS, getDefaultShell } from './types.js';

/**
 * Generate unique agent ID
 */
function generateAgentId(): string {
  return `agent_${randomBytes(4).toString('hex')}`;
}

/**
 * Single Agent Instance
 */
export class AgentInstance {
  public readonly id: string;
  public readonly config: AgentConfig;

  private ptyInstance: PTYInstance | null = null;
  private containerInstance: ContainerInstance | null = null;
  private status: AgentStatus = 'starting';
  private createdAt: number;
  private lastActivityAt: number;
  private exitCode?: number;
  private dataHandlers: ((data: string) => void)[] = [];
  private statusHandlers: ((status: AgentStatus) => void)[] = [];
  private exitHandlers: ((code: number, signal?: number) => void)[] = [];

  constructor(id: string, config: AgentConfig) {
    this.id = id;
    this.config = config;
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();
  }

  /**
   * Check if this agent uses container isolation
   */
  get isContainerized(): boolean {
    return this.config.container?.enabled === true;
  }

  /**
   * Get container info if running in container
   */
  get container(): ContainerInstance | null {
    return this.containerInstance;
  }

  /**
   * Start the agent (shell-first approach, with optional container isolation)
   */
  async start(ptyManager: PTYManager): Promise<void> {
    this.setStatus('starting');

    try {
      let command: string;
      let args: string[];
      let env: Record<string, string>;

      // Check if container mode is enabled
      if (this.config.container?.enabled) {
        // Container mode: spawn shell inside Docker container
        const containerManager = getContainerManager();

        console.log(`[Agent ${this.id}] Starting in container mode...`);

        // Create/ensure container is running
        this.containerInstance = await containerManager.ensureContainer(this.config.cwd, {
          sessionId: this.id,
          config: this.config.container,
        });

        // Build docker exec command
        const shell = this.config.command || '/bin/bash';
        const execResult = containerManager.execInContainer({
          containerId: this.containerInstance.name,
          command: shell,
          args: ['-l'], // Login shell for proper PATH
          workDir: this.containerInstance.containerWorkDir,
          user: this.config.container.user,
          env: this.config.env,
          tty: true,
          interactive: true,
        });

        command = execResult.command;
        args = execResult.args;
        env = {
          ...this.config.env,
          ...execResult.env,
          // Ensure proper terminal
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          FORCE_COLOR: '1',
        };

        console.log(`[Agent ${this.id}] Container: ${this.containerInstance.name}`);
      } else {
        // Direct mode: spawn shell on host
        command = this.config.command || getDefaultShell();
        args = ['-l']; // Login shell for proper PATH
        env = {
          ...this.config.env,
          // Ensure proper terminal
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          // Force colors
          FORCE_COLOR: '1',
          CLICOLOR: '1',
          CLICOLOR_FORCE: '1',
        };
      }

      this.ptyInstance = await ptyManager.create({
        command,
        args,
        cwd: this.config.cwd,
        env,
        cols: 120,
        rows: 30,
      });

      // Wire up PTY events
      this.ptyInstance.onData((data) => {
        this.lastActivityAt = Date.now();
        this.dataHandlers.forEach((handler) => handler(data));
      });

      this.ptyInstance.onExit((code, signal) => {
        this.exitCode = code;
        this.setStatus('exited');
        this.exitHandlers.forEach((handler) => handler(code, signal));
      });

      this.setStatus('running');

      // If this is an AI agent type, optionally run the command
      if (this.config.type !== 'shell' && this.config.type !== 'custom') {
        const agentCmd = AGENT_COMMANDS[this.config.type];
        if (agentCmd?.shellCommand && this.config.autoRun !== false) {
          // Wait for shell to initialize, then run the AI command
          setTimeout(() => {
            this.write(`${agentCmd.shellCommand}\n`);
          }, 500);
        }
      }

      // Send initial prompt if configured
      if (this.config.initialPrompt) {
        const prompt = this.config.initialPrompt;
        setTimeout(() => {
          // Write as a comment/echo so it shows in terminal
          this.write(`echo "${prompt.replace(/"/g, '\\"')}"\n`);
        }, 800);
      }
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }

  /**
   * Write to agent stdin
   */
  write(data: string): void {
    if (
      this.ptyInstance &&
      (this.status === 'running' || this.status === 'idle' || this.status === 'waiting')
    ) {
      this.ptyInstance.write(data);
      this.lastActivityAt = Date.now();
    }
  }

  /**
   * Resize agent PTY
   */
  resize(cols: number, rows: number): void {
    if (this.ptyInstance) {
      // Enforce minimum size for TUI app compatibility
      const safeCols = Math.max(cols, 40);
      const safeRows = Math.max(rows, 10);
      console.log(`[Agent ${this.id}] Resizing PTY to ${safeCols}x${safeRows}`);
      this.ptyInstance.resize({ cols: safeCols, rows: safeRows });
    }
  }

  /**
   * Kill the agent and cleanup container if applicable
   */
  async kill(signal?: string): Promise<void> {
    // Kill PTY first
    if (this.ptyInstance) {
      this.ptyInstance.kill(signal);
      this.setStatus('exited');
    }

    // Cleanup container if running in container mode
    if (this.containerInstance && this.config.container?.removeOnExit !== false) {
      try {
        const containerManager = getContainerManager();
        await containerManager.stopContainer(this.containerInstance.name, true);
        console.log(`[Agent ${this.id}] Container cleaned up: ${this.containerInstance.name}`);
      } catch (error) {
        console.warn(`[Agent ${this.id}] Failed to cleanup container: ${error}`);
      }
      this.containerInstance = null;
    }
  }

  /**
   * Register data handler
   */
  onData(handler: (data: string) => void): void {
    this.dataHandlers.push(handler);
  }

  /**
   * Register status change handler
   */
  onStatusChange(handler: (status: AgentStatus) => void): void {
    this.statusHandlers.push(handler);
  }

  /**
   * Register exit handler
   */
  onExit(handler: (code: number, signal?: number) => void): void {
    this.exitHandlers.push(handler);
  }

  /**
   * Set status and notify handlers
   */
  private setStatus(status: AgentStatus): void {
    this.status = status;
    this.statusHandlers.forEach((handler) => handler(status));
  }

  /**
   * Get agent info
   */
  getInfo(): AgentInfo {
    const info: AgentInfo = {
      id: this.id,
      config: this.config,
      status: this.status,
      ptyId: this.ptyInstance?.id,
      pid: this.ptyInstance?.pid,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
      exitCode: this.exitCode,
    };

    // Add container info if running in container
    if (this.containerInstance) {
      info.containerInfo = {
        id: this.containerInstance.id,
        name: this.containerInstance.name,
        image: this.containerInstance.image,
      };
    }

    return info;
  }

  /**
   * Get current status
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.status === 'running' || this.status === 'idle' || this.status === 'waiting';
  }
}

/**
 * Agent Manager - manages multiple agents
 */
export class AgentManager {
  private agents: Map<string, AgentInstance> = new Map();
  private agentStartTimes: Map<string, number> = new Map();
  private ptyManager: PTYManager;
  private workDir: string;
  private sessionId: string | null = null;
  private eventHandlers: {
    data: ((agentId: string, data: string) => void)[];
    status: ((agentId: string, status: AgentStatus) => void)[];
    exit: ((agentId: string, code: number, signal?: number) => void)[];
    error: ((agentId: string, error: Error) => void)[];
  } = {
    data: [],
    status: [],
    exit: [],
    error: [],
  };

  constructor(workDir: string) {
    this.workDir = workDir;
    this.ptyManager = getPTYManager();
  }

  /**
   * Set the session ID for Opik tracing
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Initialize the agent manager
   */
  async initialize(): Promise<void> {
    await this.ptyManager.initialize();
  }

  /**
   * Create and start a new agent
   */
  async createAgent(config: Omit<AgentConfig, 'cwd'>): Promise<AgentInstance> {
    const id = generateAgentId();
    const startTime = Date.now();

    // Ensure we have a valid command (default to shell)
    const command = config.command || getDefaultShell();

    const fullConfig: AgentConfig = {
      ...config,
      command,
      cwd: this.workDir,
    };

    const agent = new AgentInstance(id, fullConfig);

    // Wire up agent events
    agent.onData((data) => {
      this.eventHandlers.data.forEach((handler) => handler(id, data));
    });

    agent.onStatusChange((status) => {
      this.eventHandlers.status.forEach((handler) => handler(id, status));
    });

    agent.onExit((code, signal) => {
      this.eventHandlers.exit.forEach((handler) => handler(id, code, signal));

      // Track agent exit with Opik
      if (this.sessionId) {
        const agentStartTime = this.agentStartTimes.get(id) || startTime;
        const duration = Date.now() - agentStartTime;
        getOpikTracer().agentExit(this.sessionId, id, {
          exitCode: code,
          signal,
          duration,
        });
        this.agentStartTimes.delete(id);
      }
    });

    this.agents.set(id, agent);
    this.agentStartTimes.set(id, startTime);

    try {
      await agent.start(this.ptyManager);

      // Track agent spawn with Opik
      if (this.sessionId) {
        getOpikTracer().agentSpawn(this.sessionId, id, {
          agentType: config.type,
          agentName: config.name,
          workDir: this.workDir,
          isContainerized: agent.isContainerized,
          containerId: agent.container?.id,
          startTime,
        });
      }
    } catch (error) {
      this.agents.delete(id);
      this.agentStartTimes.delete(id);
      this.eventHandlers.error.forEach((handler) =>
        handler(id, error instanceof Error ? error : new Error(String(error)))
      );
      throw error;
    }

    return agent;
  }

  /**
   * Create multiple agents from a preset
   */
  async createFromPreset(presetName: string): Promise<AgentInstance[]> {
    const { AGENT_PRESETS } = await import('./types.js');
    const preset = AGENT_PRESETS.find((p) => p.name === presetName);
    if (!preset) {
      throw new Error(`Unknown preset: ${presetName}`);
    }

    const agents: AgentInstance[] = [];
    for (const agentConfig of preset.agents) {
      const agent = await this.createAgent(agentConfig);
      agents.push(agent);
    }
    return agents;
  }

  /**
   * Get an agent by ID
   */
  getAgent(id: string): AgentInstance | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all agents
   */
  getAllAgents(): AgentInstance[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get all agent infos
   */
  getAllAgentInfos(): AgentInfo[] {
    return this.getAllAgents().map((agent) => agent.getInfo());
  }

  /**
   * Write to a specific agent
   */
  writeToAgent(agentId: string, data: string): boolean {
    const agent = this.agents.get(agentId);
    if (agent?.isRunning()) {
      agent.write(data);
      return true;
    }
    return false;
  }

  /**
   * Resize an agent's PTY
   */
  resizeAgent(agentId: string, cols: number, rows: number): boolean {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.resize(cols, rows);
      return true;
    }
    return false;
  }

  /**
   * Kill an agent
   */
  async killAgent(agentId: string, signal?: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (agent) {
      await agent.kill(signal);
      this.agents.delete(agentId);
      this.agentStartTimes.delete(agentId); // Clean up start time tracking
      return true;
    }
    return false;
  }

  /**
   * Kill all agents
   */
  async killAllAgents(): Promise<void> {
    const killPromises = Array.from(this.agents.values()).map((agent) => agent.kill());
    await Promise.all(killPromises);
    this.agents.clear();
    this.agentStartTimes.clear(); // Clean up all start time tracking
  }

  /**
   * Register event handler
   */
  on(event: 'data', handler: (agentId: string, data: string) => void): void;
  on(event: 'status', handler: (agentId: string, status: AgentStatus) => void): void;
  on(event: 'exit', handler: (agentId: string, code: number, signal?: number) => void): void;
  on(event: 'error', handler: (agentId: string, error: Error) => void): void;
  // biome-ignore lint/suspicious/noExplicitAny: Required for TypeScript overload compatibility
  on(event: string, handler: (...args: any[]) => void): void {
    if (event in this.eventHandlers) {
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic event handler pattern
      (this.eventHandlers as any)[event].push(handler);
    }
  }

  /**
   * Get count of active agents
   */
  get count(): number {
    return this.agents.size;
  }

  /**
   * Get count of running agents
   */
  get runningCount(): number {
    return this.getAllAgents().filter((a) => a.isRunning()).length;
  }
}

// Singleton instance
let agentManager: AgentManager | null = null;

/**
 * Get the global Agent manager instance
 */
export function getAgentManager(workDir?: string): AgentManager {
  if (!agentManager) {
    if (!workDir) {
      throw new Error('workDir required for first initialization');
    }
    agentManager = new AgentManager(workDir);
  }
  return agentManager;
}

/**
 * Reset the agent manager (for testing)
 */
export function resetAgentManager(): void {
  if (agentManager) {
    agentManager.killAllAgents();
    agentManager = null;
  }
}
