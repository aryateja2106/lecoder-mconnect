/**
 * Container Manager for MConnect
 *
 * Manages Docker container lifecycle for session isolation.
 * Uses execFileSync for safe command execution (no shell injection risk).
 */

import { execFileSync, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { getObservability } from '../observability/index.js';
import {
  createDefaultDevContainerConfig,
  getVolumeMounts,
  parseDevContainer,
} from './devcontainer.js';
import { DEFAULT_DOCKERFILE } from './dockerfile.js';
import type {
  ContainerConfig,
  ContainerExecOptions,
  ContainerExecResult,
  ContainerInstance,
  DevContainerConfig,
  DockerInfo,
} from './types.js';

/**
 * Cache for docker binary path
 */
let cachedDockerPath: string | null = null;

/**
 * Find the full path to the docker binary
 */
function findDockerPath(): string {
  if (cachedDockerPath) {
    return cachedDockerPath;
  }

  // Common docker paths on different systems
  const commonPaths = [
    '/usr/local/bin/docker',
    '/opt/homebrew/bin/docker', // macOS Homebrew ARM
    '/usr/bin/docker',
    '/usr/local/docker/bin/docker',
    '/Applications/Docker.app/Contents/Resources/bin/docker', // Docker Desktop macOS
    '/snap/bin/docker', // Snap-installed Docker on Linux
    `${process.env.HOME}/.docker/bin/docker`, // Docker Desktop user-level
  ];

  // Check common paths first
  for (const path of commonPaths) {
    if (existsSync(path)) {
      cachedDockerPath = path;
      return path;
    }
  }

  // Fall back to 'which docker' (works on macOS and Linux)
  try {
    const result = execSync('which docker', { encoding: 'utf-8', timeout: 5000 });
    const path = result.trim();
    if (path && existsSync(path)) {
      cachedDockerPath = path;
      return path;
    }
  } catch {
    // 'which' failed, continue to next fallback
  }

  // Fall back to 'command -v docker' (POSIX compliant)
  try {
    const result = execSync('command -v docker', {
      encoding: 'utf-8',
      timeout: 5000,
      shell: '/bin/sh',
    });
    const path = result.trim();
    if (path && existsSync(path)) {
      cachedDockerPath = path;
      return path;
    }
  } catch {
    // command -v failed
  }

  // Last resort: just return 'docker' and hope it's in PATH
  // Note: PTY validateShell() has special handling for container runtimes
  console.warn(
    '[Container] Docker binary not found in standard paths. Ensure docker is installed and in PATH.'
  );
  return 'docker';
}

/**
 * Container name prefix for MConnect containers
 */
const CONTAINER_PREFIX = 'mconnect';

/**
 * Generate a deterministic container name from workspace path
 */
function generateContainerName(workspaceDir: string, sessionId?: string): string {
  const hash = createHash('sha256').update(workspaceDir).digest('hex').substring(0, 8);
  const baseName = basename(workspaceDir)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');
  const suffix = sessionId ? `-${sessionId.substring(0, 6)}` : '';
  return `${CONTAINER_PREFIX}-${baseName}-${hash}${suffix}`;
}

/**
 * Execute a Docker command using execFileSync (safe, no shell injection)
 */
function dockerExec(args: string[], options?: { timeout?: number }): string {
  const timeout = options?.timeout ?? 30000;
  try {
    const result = execFileSync('docker', args, {
      encoding: 'utf-8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Docker command failed: docker ${args.join(' ')}\n${message}`);
  }
}

/**
 * Container Manager class
 * Handles Docker container lifecycle for MConnect sessions
 */
export class ContainerManager {
  private containers: Map<string, ContainerInstance> = new Map();
  private dockerAvailable: boolean | null = null;

  /**
   * Check if Docker CLI is available
   */
  async isDockerAvailable(): Promise<boolean> {
    if (this.dockerAvailable !== null) {
      return this.dockerAvailable;
    }

    try {
      execFileSync('docker', ['--version'], {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.dockerAvailable = true;
    } catch {
      this.dockerAvailable = false;
    }

    return this.dockerAvailable;
  }

  /**
   * Check if Docker daemon is running
   */
  async isDockerRunning(): Promise<boolean> {
    try {
      execFileSync('docker', ['info'], {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Docker system information
   */
  async getDockerInfo(): Promise<DockerInfo> {
    const info: DockerInfo = {
      version: 'unknown',
      daemonRunning: false,
    };

    try {
      // Get CLI version
      const versionOutput = execFileSync('docker', ['--version'], {
        encoding: 'utf-8',
        timeout: 5000,
      });
      const versionMatch = versionOutput.match(/Docker version ([^,]+)/);
      if (versionMatch) {
        info.version = versionMatch[1];
      }

      // Get server info
      const infoOutput = execFileSync('docker', ['info', '--format', '{{json .}}'], {
        encoding: 'utf-8',
        timeout: 10000,
      });
      const dockerInfo = JSON.parse(infoOutput);

      info.daemonRunning = true;
      info.serverVersion = dockerInfo.ServerVersion;
      info.os = dockerInfo.OSType;
      info.arch = dockerInfo.Architecture;
    } catch (error) {
      info.error = error instanceof Error ? error.message : String(error);
    }

    return info;
  }

  /**
   * Check Docker status for wizard (quick combined check)
   */
  async checkDockerStatus(): Promise<{
    installed: boolean;
    running: boolean;
    version?: string;
  }> {
    const result = {
      installed: false,
      running: false,
      version: undefined as string | undefined,
    };

    // Check if Docker CLI is installed
    try {
      const versionOutput = execFileSync('docker', ['--version'], {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      result.installed = true;

      // Extract version
      const versionMatch = versionOutput.match(/Docker version ([^,]+)/);
      if (versionMatch) {
        result.version = versionMatch[1];
      }
    } catch {
      return result;
    }

    // Check if Docker daemon is running
    try {
      execFileSync('docker', ['info'], {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      result.running = true;
    } catch {
      // Docker installed but daemon not running
    }

    return result;
  }

  /**
   * Check if a container exists (running or stopped)
   */
  async containerExists(containerName: string): Promise<boolean> {
    try {
      const output = dockerExec(['ps', '-a', '-q', '-f', `name=^${containerName}$`]);
      return output.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Check if a container is running
   */
  async isContainerRunning(containerName: string): Promise<boolean> {
    try {
      const output = dockerExec(['ps', '-q', '-f', `name=^${containerName}$`]);
      return output.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get container ID by name
   */
  async getContainerId(containerName: string): Promise<string | null> {
    try {
      const output = dockerExec(['ps', '-aq', '-f', `name=^${containerName}$`]);
      return output || null;
    } catch {
      return null;
    }
  }

  /**
   * Create and start a container
   */
  async createContainer(
    workspaceDir: string,
    config: ContainerConfig | DevContainerConfig,
    sessionId?: string
  ): Promise<ContainerInstance> {
    // Ensure Docker is available
    if (!(await this.isDockerAvailable())) {
      throw new Error('Docker is not installed. Please install Docker to use container isolation.');
    }

    if (!(await this.isDockerRunning())) {
      throw new Error(
        'Docker daemon is not running. Please start Docker Desktop or the Docker service.'
      );
    }

    const containerName = generateContainerName(workspaceDir, sessionId);

    // Check if container already exists
    if (await this.containerExists(containerName)) {
      // Start if stopped
      if (!(await this.isContainerRunning(containerName))) {
        dockerExec(['start', containerName]);
      }

      const containerId = await this.getContainerId(containerName);
      const instance: ContainerInstance = {
        id: containerId || containerName,
        name: containerName,
        state: 'running',
        image: this.getImageFromConfig(config),
        hostWorkDir: workspaceDir,
        containerWorkDir: this.getWorkDirFromConfig(config),
        createdAt: new Date(),
      };
      this.containers.set(containerName, instance);
      return instance;
    }

    // Build docker run command
    const args = ['run', '-d', '--name', containerName];

    // Interactive and TTY for shell support
    args.push('-it');

    // Add labels for identification
    args.push('--label', 'mconnect=true');
    args.push('--label', `mconnect.workspace=${workspaceDir}`);

    // Get image and config-specific args
    const image = this.getImageFromConfig(config);
    const workDir = this.getWorkDirFromConfig(config);

    // Volume mounts - distinguish ContainerConfig from DevContainerConfig
    // ContainerConfig has 'enabled' property, DevContainerConfig does not
    const isContainerConfig = 'enabled' in config;

    if (isContainerConfig) {
      // Inline ContainerConfig - use -v mounts
      const containerConfig = config as ContainerConfig;
      if (containerConfig.volumes && containerConfig.volumes.length > 0) {
        for (const vol of containerConfig.volumes) {
          args.push('-v', vol.includes(':') ? vol : `${vol}:${vol}`);
        }
      } else {
        // Default workspace mount for ContainerConfig
        args.push('-v', `${workspaceDir}:${workDir}`);
      }
    } else {
      // DevContainerConfig - use --mount from helper (includes default workspace mount)
      const devConfig = config as DevContainerConfig;
      const mounts = getVolumeMounts(devConfig, workspaceDir);
      for (const mount of mounts) {
        args.push('--mount', mount);
      }
    }

    // Working directory
    args.push('-w', workDir);

    // Environment variables
    const env = this.getEnvFromConfig(config);
    for (const [key, value] of Object.entries(env)) {
      args.push('-e', `${key}=${value}`);
    }

    // User
    const user = this.getUserFromConfig(config);
    if (user) {
      args.push('-u', user);
    }

    // Port mappings
    if ('ports' in config && config.ports) {
      for (const port of config.ports) {
        args.push('-p', port);
      }
    } else if ('forwardPorts' in config && config.forwardPorts) {
      for (const port of config.forwardPorts) {
        args.push('-p', `${port}:${port}`);
      }
    }

    // Network
    if ('network' in config && config.network) {
      args.push('--network', config.network);
    }

    // Privileged mode
    if ('privileged' in config && config.privileged) {
      args.push('--privileged');
    }

    // Additional run args from DevContainerConfig
    if ('runArgs' in config && config.runArgs) {
      args.push(...config.runArgs);
    }

    // Image and command (sleep infinity to keep container running)
    args.push(image);
    args.push('sleep', 'infinity');

    // Create container
    console.log(`[Container] Creating container: ${containerName}`);
    let containerId: string;
    try {
      containerId = dockerExec(args);
    } catch (error) {
      // Trace container error
      const obs = getObservability();
      if (obs.isEnabled()) {
        obs.traceContainerLifecycle('error', containerName, {
          image,
          workDir,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }

    const instance: ContainerInstance = {
      id: containerId.trim(),
      name: containerName,
      state: 'running',
      image,
      hostWorkDir: workspaceDir,
      containerWorkDir: workDir,
      createdAt: new Date(),
    };

    this.containers.set(containerName, instance);

    // Trace container creation
    const obs = getObservability();
    if (obs.isEnabled()) {
      obs.traceContainerLifecycle('create', containerName, {
        image,
        workDir,
      });
    }

    // Run post-create commands if any
    await this.runLifecycleCommands(instance, config);

    return instance;
  }

  /**
   * Run lifecycle commands from DevContainerConfig
   */
  private async runLifecycleCommands(
    instance: ContainerInstance,
    config: ContainerConfig | DevContainerConfig
  ): Promise<void> {
    if (!('postCreateCommand' in config) || !config.postCreateCommand) {
      return;
    }

    const command = config.postCreateCommand;

    try {
      if (typeof command === 'string') {
        console.log(`[Container] Running postCreateCommand: ${command}`);
        // For shell commands, we use /bin/sh -c inside the container
        dockerExec(
          ['exec', '-w', instance.containerWorkDir, instance.name, '/bin/sh', '-c', command],
          { timeout: 300000 }
        ); // 5 minute timeout for setup commands
      } else if (Array.isArray(command)) {
        console.log(`[Container] Running postCreateCommand: ${command.join(' ')}`);
        dockerExec(['exec', '-w', instance.containerWorkDir, instance.name, ...command], {
          timeout: 300000,
        });
      }
      // Object format (parallel commands) not implemented yet
    } catch (error) {
      console.warn(`[Container] postCreateCommand failed: ${error}`);
      // Don't fail container creation for post-create command failures
    }
  }

  /**
   * Build docker exec command for running a shell in container
   */
  execInContainer(options: ContainerExecOptions): ContainerExecResult {
    const args = ['exec'];

    // Interactive and TTY
    if (options.interactive !== false) {
      args.push('-i');
    }
    if (options.tty !== false) {
      args.push('-t');
    }

    // Working directory
    if (options.workDir) {
      args.push('-w', options.workDir);
    }

    // User
    if (options.user) {
      args.push('-u', options.user);
    }

    // Environment variables
    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        args.push('-e', `${key}=${value}`);
      }
    }

    // Container name/ID
    args.push(options.containerId);

    // Command and arguments
    args.push(options.command);
    if (options.args) {
      args.push(...options.args);
    }

    // Use full path to docker binary to pass PTY validation
    const dockerPath = findDockerPath();

    // Trace container exec
    const obs = getObservability();
    if (obs.isEnabled()) {
      obs.traceContainerExec(options.containerId, options.command);
    }

    return {
      command: dockerPath,
      args,
      env: options.env,
    };
  }

  /**
   * Stop a container
   */
  async stopContainer(containerName: string, remove = true): Promise<void> {
    const instance = this.containers.get(containerName);
    if (instance) {
      instance.state = 'stopping';
    }

    try {
      if (await this.isContainerRunning(containerName)) {
        console.log(`[Container] Stopping container: ${containerName}`);
        dockerExec(['stop', '-t', '5', containerName]);
      }

      if (remove) {
        console.log(`[Container] Removing container: ${containerName}`);
        dockerExec(['rm', '-f', containerName]);
      }

      // Trace container stop
      const obs = getObservability();
      if (obs.isEnabled()) {
        obs.traceContainerLifecycle('stop', containerName);
      }

      this.containers.delete(containerName);
    } catch (error) {
      console.warn(`[Container] Failed to stop/remove: ${error}`);
      // Trace container error
      const obs = getObservability();
      if (obs.isEnabled()) {
        obs.traceContainerLifecycle('error', containerName, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (instance) {
        instance.state = 'error';
      }
    }
  }

  /**
   * Stop all MConnect containers
   */
  async stopAllContainers(): Promise<void> {
    // Find all mconnect containers
    try {
      const output = dockerExec(['ps', '-aq', '-f', 'label=mconnect=true']);
      if (output) {
        const containerIds = output.split('\n').filter(Boolean);
        for (const id of containerIds) {
          await this.stopContainer(id, true);
        }
      }
    } catch {
      // Ignore errors - containers may not exist
    }

    this.containers.clear();
  }

  /**
   * Get a container instance by name
   */
  getContainer(containerName: string): ContainerInstance | undefined {
    return this.containers.get(containerName);
  }

  /**
   * Ensure a container exists and is running for a workspace
   *
   * This is the main entry point for agent integration.
   * It parses devcontainer.json if present, or uses defaults.
   */
  async ensureContainer(
    workspaceDir: string,
    options?: {
      sessionId?: string;
      forceNew?: boolean;
      config?: ContainerConfig;
    }
  ): Promise<ContainerInstance> {
    const containerName = generateContainerName(workspaceDir, options?.sessionId);

    // Check for existing container
    if (!options?.forceNew && (await this.isContainerRunning(containerName))) {
      const existingInstance = this.containers.get(containerName);
      if (existingInstance) {
        return existingInstance;
      }
    }

    // Get config: explicit > devcontainer.json > default
    let config: ContainerConfig | DevContainerConfig;

    if (options?.config) {
      config = options.config;
    } else {
      const devContainerConfig = parseDevContainer(workspaceDir);
      if (devContainerConfig) {
        console.log('[Container] Using devcontainer.json configuration');
        config = devContainerConfig;
      } else {
        console.log('[Container] Using default container configuration');
        config = createDefaultDevContainerConfig(workspaceDir);
      }
    }

    return this.createContainer(workspaceDir, config, options?.sessionId);
  }

  /**
   * Build a container image from Dockerfile
   */
  async buildImage(workspaceDir: string, config?: DevContainerConfig): Promise<string> {
    const imageName = `mconnect-${basename(workspaceDir)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')}`;

    // Check for existing Dockerfile
    let dockerfilePath: string;

    if (config?.build?.dockerfile) {
      dockerfilePath = join(workspaceDir, '.devcontainer', config.build.dockerfile);
    } else if (existsSync(join(workspaceDir, '.devcontainer/Dockerfile'))) {
      dockerfilePath = join(workspaceDir, '.devcontainer/Dockerfile');
    } else if (existsSync(join(workspaceDir, 'Dockerfile'))) {
      dockerfilePath = join(workspaceDir, 'Dockerfile');
    } else {
      // Generate default Dockerfile
      const tmpDir = join(tmpdir(), 'mconnect-build');
      mkdirSync(tmpDir, { recursive: true });
      dockerfilePath = join(tmpDir, 'Dockerfile');
      writeFileSync(dockerfilePath, DEFAULT_DOCKERFILE);
    }

    // Build the image
    console.log(`[Container] Building image: ${imageName}`);
    const context = config?.build?.context
      ? join(workspaceDir, '.devcontainer', config.build.context)
      : workspaceDir;

    const args = ['build', '-t', imageName, '-f', dockerfilePath];

    // Add build args
    if (config?.build?.args) {
      for (const [key, value] of Object.entries(config.build.args)) {
        args.push('--build-arg', `${key}=${value}`);
      }
    }

    // Add target for multi-stage builds
    if (config?.build?.target) {
      args.push('--target', config.build.target);
    }

    args.push(context);

    const startTime = Date.now();
    try {
      dockerExec(args, { timeout: 600000 }); // 10 minute timeout for builds
      const durationMs = Date.now() - startTime;

      // Trace successful build
      const obs = getObservability();
      if (obs.isEnabled()) {
        obs.traceContainerBuild(imageName, true, durationMs);
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Trace failed build
      const obs = getObservability();
      if (obs.isEnabled()) {
        obs.traceContainerBuild(
          imageName,
          false,
          durationMs,
          error instanceof Error ? error.message : String(error)
        );
      }
      throw error;
    }

    return imageName;
  }

  // Helper methods to extract config values

  private getImageFromConfig(config: ContainerConfig | DevContainerConfig): string {
    if ('image' in config && config.image) {
      return config.image;
    }
    return 'ubuntu:22.04';
  }

  private getWorkDirFromConfig(config: ContainerConfig | DevContainerConfig): string {
    if ('workDir' in config && config.workDir) {
      return config.workDir;
    }
    if ('workspaceFolder' in config && config.workspaceFolder) {
      return config.workspaceFolder;
    }
    return '/workspace';
  }

  private getEnvFromConfig(config: ContainerConfig | DevContainerConfig): Record<string, string> {
    const env: Record<string, string> = {
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      FORCE_COLOR: '1',
    };

    if ('env' in config && config.env) {
      Object.assign(env, config.env);
    }
    if ('containerEnv' in config && config.containerEnv) {
      Object.assign(env, config.containerEnv);
    }
    if ('remoteEnv' in config && config.remoteEnv) {
      Object.assign(env, config.remoteEnv);
    }

    return env;
  }

  private getUserFromConfig(config: ContainerConfig | DevContainerConfig): string | undefined {
    if ('user' in config && config.user) {
      return config.user;
    }
    if ('remoteUser' in config) {
      return config.remoteUser;
    }
    if ('containerUser' in config) {
      return config.containerUser;
    }
    return undefined;
  }
}

// Singleton instance
let containerManagerInstance: ContainerManager | null = null;

/**
 * Get the global ContainerManager instance
 */
export function getContainerManager(): ContainerManager {
  if (!containerManagerInstance) {
    containerManagerInstance = new ContainerManager();
  }
  return containerManagerInstance;
}

/**
 * Reset the ContainerManager instance (for testing)
 */
export function resetContainerManager(): void {
  containerManagerInstance = null;
}
