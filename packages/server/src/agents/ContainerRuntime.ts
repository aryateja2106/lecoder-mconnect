/**
 * Container Runtime
 *
 * Docker container lifecycle management using dockerode.
 * Implements the Container Orchestration layer from spec section 2.1:
 * - Container lifecycle (create, start, stop, remove)
 * - Resource limits (CPU, memory, disk)
 * - Namespace/cgroup isolation
 */

import Docker from 'dockerode';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import {
  type ContainerConfig,
  type ContainerSecurityProfile,
  type ContainerResourceLimits,
  DEFAULT_SECURITY_PROFILE,
} from '@lecoder/shared';

// ============================================================================
// Types
// ============================================================================

/**
 * Container runtime state
 */
export type ContainerRuntimeState =
  | 'created'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error';

/**
 * Container runtime info
 */
export interface ContainerRuntimeInfo {
  /** Docker container ID */
  id: string;
  /** Container name */
  name: string;
  /** Image used */
  image: string;
  /** Current state */
  state: ContainerRuntimeState;
  /** Exit code (if exited) */
  exitCode?: number;
  /** Error message (if error) */
  error?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Start timestamp */
  startedAt?: Date;
  /** Stop timestamp */
  stoppedAt?: Date;
}

/**
 * Container create options
 */
export interface ContainerCreateOptions {
  /** Container name (optional, auto-generated if not provided) */
  name?: string;
  /** Image to use */
  image: string;
  /** Command to run */
  command?: string[];
  /** Working directory inside container */
  workDir?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Volume mounts in Docker format */
  volumes?: string[];
  /** Port mappings */
  ports?: string[];
  /** Docker network */
  network?: string;
  /** Run in privileged mode */
  privileged?: boolean;
  /** User to run as */
  user?: string;
  /** Resource limits */
  resourceLimits?: ContainerResourceLimits;
  /** Security profile (defaults to DEFAULT_SECURITY_PROFILE) */
  securityProfile?: Partial<ContainerSecurityProfile>;
  /** Labels for the container */
  labels?: Record<string, string>;
  /** Remove container when stopped */
  autoRemove?: boolean;
  /** Allocate a pseudo-TTY */
  tty?: boolean;
  /** Keep STDIN open even if not attached */
  openStdin?: boolean;
}

/**
 * Container attach streams
 */
export interface ContainerStreams {
  /** Combined stdin/stdout stream for attach */
  stream: NodeJS.ReadWriteStream;
  /** Stdin stream (write to send input) */
  stdin: PassThrough;
  /** Stdout stream (read for output) */
  stdout: PassThrough;
  /** Stderr stream (read for errors) */
  stderr: PassThrough;
}

/**
 * Container run command options
 */
export interface ContainerRunOptions {
  /** Command to run */
  command: string[];
  /** Working directory */
  workDir?: string;
  /** Environment variables */
  env?: string[];
  /** Allocate a pseudo-TTY */
  tty?: boolean;
  /** User to run as */
  user?: string;
}

/**
 * Container events
 */
export interface ContainerRuntimeEvents {
  /** Container started */
  start: (info: ContainerRuntimeInfo) => void;
  /** Container stopped */
  stop: (info: ContainerRuntimeInfo) => void;
  /** Container output received */
  output: (data: string) => void;
  /** Container error occurred */
  error: (error: Error) => void;
}

// ============================================================================
// ContainerRuntime Class
// ============================================================================

/**
 * Container Runtime for managing Docker containers
 *
 * Provides container lifecycle management with:
 * - Security profiles for isolation
 * - Resource limits enforcement
 * - Stdin/stdout streaming
 */
export class ContainerRuntime extends EventEmitter {
  private docker: Docker;
  private containers: Map<string, Docker.Container> = new Map();
  private containerInfos: Map<string, ContainerRuntimeInfo> = new Map();
  private streams: Map<string, ContainerStreams> = new Map();

  constructor(dockerOptions?: Docker.DockerOptions) {
    super();
    this.docker = new Docker(
      dockerOptions ?? {
        socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock',
      }
    );
  }

  // ==========================================================================
  // Container Lifecycle
  // ==========================================================================

  /**
   * Create a new container
   */
  async createContainer(options: ContainerCreateOptions): Promise<string> {
    const securityProfile: ContainerSecurityProfile = {
      ...DEFAULT_SECURITY_PROFILE,
      ...options.securityProfile,
    };

    // Build container configuration
    const containerConfig: Docker.ContainerCreateOptions = {
      Image: options.image,
      Cmd: options.command,
      WorkingDir: options.workDir,
      Tty: options.tty ?? true,
      OpenStdin: options.openStdin ?? true,
      StdinOnce: false,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Env: this.buildEnvArray(options.env),
      Labels: {
        'mconnect.managed': 'true',
        ...options.labels,
      },
      HostConfig: this.buildHostConfig(options, securityProfile),
    };

    // Add container name if provided
    if (options.name) {
      containerConfig.name = options.name;
    }

    // Create the container
    const container = await this.docker.createContainer(containerConfig);
    const containerId = container.id;

    // Store container reference
    this.containers.set(containerId, container);

    // Initialize container info
    const info: ContainerRuntimeInfo = {
      id: containerId,
      name: options.name ?? containerId.substring(0, 12),
      image: options.image,
      state: 'created',
      createdAt: new Date(),
    };
    this.containerInfos.set(containerId, info);

    return containerId;
  }

  /**
   * Start a container
   */
  async startContainer(containerId: string): Promise<void> {
    const container = this.getContainer(containerId);
    const info = this.getContainerInfo(containerId);

    info.state = 'starting';
    this.containerInfos.set(containerId, info);

    await container.start();

    info.state = 'running';
    info.startedAt = new Date();
    this.containerInfos.set(containerId, info);

    this.emit('start', info);
  }

  /**
   * Stop a container
   */
  async stopContainer(containerId: string, timeout = 10): Promise<void> {
    const container = this.getContainer(containerId);
    const info = this.getContainerInfo(containerId);

    info.state = 'stopping';
    this.containerInfos.set(containerId, info);

    // Close streams if attached
    const streams = this.streams.get(containerId);
    if (streams) {
      streams.stdin.end();
      streams.stdout.end();
      streams.stderr.end();
      this.streams.delete(containerId);
    }

    try {
      await container.stop({ t: timeout });
    } catch (error) {
      // Container may already be stopped
      // Docker returns 304 "container already stopped" or "not running"
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('not running') && !errorMessage.includes('already stopped')) {
        throw error;
      }
    }

    // Get exit code from inspection
    const inspection = await container.inspect();
    info.state = 'stopped';
    info.stoppedAt = new Date();
    info.exitCode = inspection.State.ExitCode;
    this.containerInfos.set(containerId, info);

    this.emit('stop', info);
  }

  /**
   * Remove a container
   */
  async removeContainer(containerId: string, force = false): Promise<void> {
    const container = this.getContainer(containerId);

    // Ensure streams are closed
    const streams = this.streams.get(containerId);
    if (streams) {
      streams.stdin.end();
      streams.stdout.end();
      streams.stderr.end();
      this.streams.delete(containerId);
    }

    await container.remove({ force, v: true });

    // Cleanup references
    this.containers.delete(containerId);
    this.containerInfos.delete(containerId);
  }

  /**
   * Kill a container
   */
  async killContainer(containerId: string, signal = 'SIGTERM'): Promise<void> {
    const container = this.getContainer(containerId);
    const info = this.getContainerInfo(containerId);

    await container.kill({ signal });

    // Update state
    info.state = 'stopped';
    info.stoppedAt = new Date();
    this.containerInfos.set(containerId, info);

    this.emit('stop', info);
  }

  // ==========================================================================
  // Container I/O
  // ==========================================================================

  /**
   * Attach to container stdin/stdout
   *
   * Returns streams for reading output and writing input.
   * Note: For best results, call this BEFORE starting the container.
   */
  async attachToContainer(containerId: string): Promise<ContainerStreams> {
    const container = this.getContainer(containerId);

    // Check if already attached
    const existingStreams = this.streams.get(containerId);
    if (existingStreams) {
      return existingStreams;
    }

    // Check if TTY is enabled - changes how we handle streams
    const inspection = await container.inspect();
    const isTty = inspection.Config.Tty;

    // Attach to container using callback pattern (promise pattern doesn't work correctly)
    const stream = await new Promise<NodeJS.ReadWriteStream>((resolve, reject) => {
      container.attach(
        {
          stream: true,
          stdin: true,
          stdout: true,
          stderr: true,
        },
        (err, stream) => {
          if (err) {
            reject(err);
          } else if (!stream) {
            reject(new Error('No stream returned from attach'));
          } else {
            resolve(stream);
          }
        }
      );
    });

    // Create pass-through streams for separation
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();

    // Pipe stdin to container
    stdin.pipe(stream);

    if (isTty) {
      // TTY mode: output is raw, no multiplexing
      stream.on('data', (data: Buffer) => {
        stdout.write(data);
      });
      stream.on('end', () => {
        stdout.end();
        stderr.end();
      });
      stream.on('error', (err) => {
        stdout.destroy(err);
        stderr.destroy(err);
      });
    } else {
      // Non-TTY mode: demultiplex Docker stream
      // Docker streams have an 8-byte header for each frame:
      // [type (1 byte), 0, 0, 0, size (4 bytes)]
      // type: 0 = stdin, 1 = stdout, 2 = stderr
      this.demuxStream(stream, stdout, stderr);
    }

    const streams: ContainerStreams = {
      stream,
      stdin,
      stdout,
      stderr,
    };

    this.streams.set(containerId, streams);

    // Emit output events
    stdout.on('data', (data: Buffer) => {
      this.emit('output', data.toString());
    });

    stderr.on('data', (data: Buffer) => {
      this.emit('output', data.toString());
    });

    return streams;
  }

  /**
   * Write to container stdin
   */
  async writeToContainer(containerId: string, data: string): Promise<void> {
    const streams = this.streams.get(containerId);
    if (!streams) {
      throw new Error(`Container ${containerId} is not attached`);
    }

    streams.stdin.write(data);
  }

  /**
   * Run a command in a running container
   */
  async runInContainer(
    containerId: string,
    options: ContainerRunOptions
  ): Promise<{ exitCode: number; output: string }> {
    const container = this.getContainer(containerId);

    // Create instance for running command
    const instance = await container.exec({
      Cmd: options.command,
      WorkingDir: options.workDir,
      Env: options.env,
      Tty: options.tty ?? false,
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      User: options.user,
    });

    // Start and collect output - don't use hijack mode
    const stream = await instance.start({});

    const output = await this.collectStreamOutput(stream);

    // Get exit code
    const inspection = await instance.inspect();
    const exitCode = inspection.ExitCode ?? 0;

    return { exitCode, output };
  }

  /**
   * Resize container TTY
   */
  async resizeContainer(
    containerId: string,
    width: number,
    height: number
  ): Promise<void> {
    const container = this.getContainer(containerId);
    await container.resize({ w: width, h: height });
  }

  // ==========================================================================
  // Container Status
  // ==========================================================================

  /**
   * Get container status
   */
  async getContainerStatus(containerId: string): Promise<ContainerRuntimeInfo> {
    const info = this.containerInfos.get(containerId);
    if (!info) {
      throw new Error(`Container ${containerId} not found`);
    }

    // Refresh state from Docker
    const container = this.containers.get(containerId);
    if (container) {
      try {
        const inspection = await container.inspect();
        if (inspection.State.Running) {
          info.state = 'running';
        } else if (inspection.State.Paused) {
          info.state = 'stopped';
        } else if (inspection.State.Status === 'created') {
          // Container was created but never started
          info.state = 'created';
        } else {
          info.state = 'stopped';
          info.exitCode = inspection.State.ExitCode;
        }
      } catch {
        // Container may have been removed externally
        info.state = 'error';
        info.error = 'Container not found';
      }
    }

    return info;
  }

  /**
   * List all managed containers
   */
  async listContainers(): Promise<ContainerRuntimeInfo[]> {
    return Array.from(this.containerInfos.values());
  }

  /**
   * Check if container is running
   */
  async isRunning(containerId: string): Promise<boolean> {
    const container = this.containers.get(containerId);
    if (!container) {
      return false;
    }

    try {
      const inspection = await container.inspect();
      return inspection.State.Running;
    } catch {
      return false;
    }
  }

  /**
   * Wait for container to stop
   */
  async waitForContainer(containerId: string): Promise<{ exitCode: number }> {
    const container = this.getContainer(containerId);
    const result = await container.wait();
    return { exitCode: result.StatusCode };
  }

  // ==========================================================================
  // Image Management
  // ==========================================================================

  /**
   * Pull an image if not present
   */
  async ensureImage(image: string): Promise<void> {
    try {
      await this.docker.getImage(image).inspect();
    } catch {
      // Image not found, pull it
      await this.pullImage(image);
    }
  }

  /**
   * Pull an image
   */
  async pullImage(image: string): Promise<void> {
    const stream = await this.docker.pull(image);
    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(stream, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Cleanup all managed containers
   */
  async cleanup(): Promise<void> {
    const containerIds = Array.from(this.containers.keys());

    // Use Promise.allSettled for parallel cleanup
    await Promise.allSettled(
      containerIds.map(async (containerId) => {
        try {
          // Use force remove which kills and removes in one step
          await this.removeContainer(containerId, true);
        } catch (error) {
          // Log but continue cleanup
          console.error(`Failed to cleanup container ${containerId}:`, error);
        }
      })
    );

    this.containers.clear();
    this.containerInfos.clear();
    this.streams.clear();
  }

  /**
   * Cleanup orphaned MConnect containers
   */
  async cleanupOrphaned(): Promise<number> {
    let cleaned = 0;

    const containers = await this.docker.listContainers({
      all: true,
      filters: { label: ['mconnect.managed=true'] },
    });

    for (const containerInfo of containers) {
      // Skip containers we're managing
      if (this.containers.has(containerInfo.Id)) {
        continue;
      }

      try {
        const container = this.docker.getContainer(containerInfo.Id);
        if (containerInfo.State === 'running') {
          await container.stop({ t: 5 });
        }
        await container.remove({ force: true, v: true });
        cleaned++;
      } catch (error) {
        console.error(
          `Failed to cleanup orphaned container ${containerInfo.Id}:`,
          error
        );
      }
    }

    return cleaned;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private getContainer(containerId: string): Docker.Container {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }
    return container;
  }

  private getContainerInfo(containerId: string): ContainerRuntimeInfo {
    const info = this.containerInfos.get(containerId);
    if (!info) {
      throw new Error(`Container ${containerId} info not found`);
    }
    return info;
  }

  /**
   * Build environment variable array from object
   */
  private buildEnvArray(env?: Record<string, string>): string[] | undefined {
    if (!env) return undefined;
    return Object.entries(env).map(([key, value]) => `${key}=${value}`);
  }

  /**
   * Build HostConfig with resource limits and security profile
   */
  private buildHostConfig(
    options: ContainerCreateOptions,
    securityProfile: ContainerSecurityProfile
  ): Docker.HostConfig {
    const hostConfig: Docker.HostConfig = {
      // Network mode
      NetworkMode: options.network ?? securityProfile.network,

      // Resource limits
      Memory: this.parseMemoryLimit(
        options.resourceLimits?.memoryMB
          ? `${options.resourceLimits.memoryMB}m`
          : securityProfile.memory
      ),
      NanoCpus: this.parseCpuLimit(
        options.resourceLimits?.cpuShares?.toString() ?? securityProfile.cpus
      ),
      PidsLimit: securityProfile.pids,

      // Security settings
      Privileged: options.privileged ?? false,
      ReadonlyRootfs: securityProfile.readOnlyRootfs,
      SecurityOpt: securityProfile.noNewPrivileges
        ? ['no-new-privileges:true']
        : [],

      // Capabilities
      CapDrop: securityProfile.capDrop,
      CapAdd: securityProfile.capAdd,

      // Cleanup
      AutoRemove: options.autoRemove ?? false,

      // Volume mounts
      Binds: options.volumes,

      // Port bindings
      PortBindings: this.parsePortBindings(options.ports),
    };

    // Add seccomp profile if not unconfined
    if (securityProfile.seccompProfile !== 'unconfined') {
      hostConfig.SecurityOpt = [
        ...(hostConfig.SecurityOpt || []),
        'seccomp=unconfined', // TODO: Use proper seccomp profile
      ];
    }

    return hostConfig;
  }

  /**
   * Parse memory limit string to bytes
   */
  private parseMemoryLimit(memory: string): number {
    const match = memory.match(/^(\d+)([kmg]?)$/i);
    if (!match) {
      return 512 * 1024 * 1024; // Default 512MB
    }

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'k':
        return value * 1024;
      case 'm':
        return value * 1024 * 1024;
      case 'g':
        return value * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }

  /**
   * Parse CPU limit string to nanocpus
   */
  private parseCpuLimit(cpus: string): number {
    const value = parseFloat(cpus);
    return Math.floor(value * 1_000_000_000); // Convert to nanocpus
  }

  /**
   * Parse port mapping strings to Docker format
   */
  private parsePortBindings(
    ports?: string[]
  ): Docker.HostConfig['PortBindings'] {
    if (!ports || ports.length === 0) {
      return undefined;
    }

    const portBindings: Record<string, Array<{ HostPort: string }>> = {};

    for (const port of ports) {
      const [hostPort, containerPort] = port.split(':');
      const key = `${containerPort}/tcp`;
      portBindings[key] = [{ HostPort: hostPort }];
    }

    return portBindings;
  }

  /**
   * Demultiplex Docker stream into stdout and stderr
   *
   * Docker streams have an 8-byte header for each frame:
   * [type (1 byte), 0, 0, 0, size (4 bytes big-endian)]
   * type: 0 = stdin (ignored), 1 = stdout, 2 = stderr
   */
  private demuxStream(
    stream: NodeJS.ReadableStream,
    stdout: PassThrough,
    stderr: PassThrough
  ): void {
    let header: Buffer | null = null;
    let remaining = 0;
    let currentStream: PassThrough | null = null;

    stream.on('data', (chunk: Buffer) => {
      let offset = 0;

      while (offset < chunk.length) {
        if (remaining === 0) {
          // Read header
          if (chunk.length - offset < 8) {
            // Not enough data for header, save for next chunk
            header = Buffer.concat([header || Buffer.alloc(0), chunk.slice(offset)]);
            break;
          }

          const headerStart = header
            ? Buffer.concat([header, chunk.slice(offset, offset + 8 - header.length)])
            : chunk.slice(offset, offset + 8);

          const streamType = headerStart.readUInt8(0);
          remaining = headerStart.readUInt32BE(4);

          if (streamType === 1) {
            currentStream = stdout;
          } else if (streamType === 2) {
            currentStream = stderr;
          } else {
            currentStream = null;
          }

          offset += 8 - (header?.length || 0);
          header = null;
        }

        if (remaining > 0) {
          const toRead = Math.min(remaining, chunk.length - offset);
          const data = chunk.slice(offset, offset + toRead);

          if (currentStream) {
            currentStream.write(data);
          }

          remaining -= toRead;
          offset += toRead;
        }
      }
    });

    stream.on('end', () => {
      stdout.end();
      stderr.end();
    });

    stream.on('error', (err) => {
      stdout.destroy(err);
      stderr.destroy(err);
    });
  }

  /**
   * Collect output from a stream
   */
  private async collectStreamOutput(stream: NodeJS.ReadableStream): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        // Strip Docker demux headers if present
        const stripped = this.stripDemuxHeaders(buffer);
        resolve(stripped.toString());
      });

      stream.on('error', reject);
    });
  }

  /**
   * Strip Docker multiplexed stream headers from buffer
   *
   * Docker streams have an 8-byte header for each frame:
   * [type (1 byte), 0, 0, 0, size (4 bytes big-endian)]
   * type: 0 = stdin (ignored), 1 = stdout, 2 = stderr
   */
  private stripDemuxHeaders(buffer: Buffer): Buffer {
    const output: Buffer[] = [];
    let offset = 0;

    while (offset < buffer.length) {
      // Need at least 8 bytes for header
      if (buffer.length - offset < 8) {
        // Remaining data without header - append as-is
        output.push(buffer.slice(offset));
        break;
      }

      const streamType = buffer.readUInt8(offset);
      const size = buffer.readUInt32BE(offset + 4);

      // Check if this looks like a valid Docker header (type 0-2, reasonable size)
      if (streamType > 2 || size > buffer.length - offset - 8) {
        // Doesn't look like demuxed output, return original
        return buffer;
      }

      offset += 8;

      if (size > 0 && offset + size <= buffer.length) {
        output.push(buffer.slice(offset, offset + size));
        offset += size;
      }
    }

    return Buffer.concat(output);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a container runtime instance
 */
export function createContainerRuntime(
  dockerOptions?: Docker.DockerOptions
): ContainerRuntime {
  return new ContainerRuntime(dockerOptions);
}

/**
 * Create container options from ContainerConfig
 */
export function createContainerOptions(
  config: ContainerConfig,
  name?: string,
  command?: string[]
): ContainerCreateOptions {
  return {
    name,
    image: config.image,
    command,
    workDir: config.workDir ?? '/workspace',
    env: config.env,
    volumes: config.volumes,
    ports: config.ports,
    network: config.network,
    privileged: config.privileged ?? false,
    user: config.user,
    resourceLimits: config.resourceLimits,
    autoRemove: config.removeOnExit ?? true,
    tty: true,
    openStdin: true,
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultRuntime: ContainerRuntime | null = null;

/**
 * Get the default container runtime instance
 */
export function getContainerRuntime(): ContainerRuntime {
  if (!defaultRuntime) {
    defaultRuntime = createContainerRuntime();
  }
  return defaultRuntime;
}

/**
 * Set the default container runtime instance (for testing)
 */
export function setContainerRuntime(runtime: ContainerRuntime | null): void {
  defaultRuntime = runtime;
}

export default ContainerRuntime;
