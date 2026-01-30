/**
 * Container types for MConnect
 *
 * Supports both inline container configuration and Dev Container spec
 * for session isolation on any device including Raspberry Pi (aarch64).
 */

/**
 * Container runtime state
 */
export type ContainerState = 'none' | 'creating' | 'running' | 'stopping' | 'stopped' | 'error';

/**
 * Inline container configuration for agent-level isolation
 */
export interface ContainerConfig {
  /** Enable container isolation for this agent */
  enabled: boolean;

  /** Docker image to use (e.g., 'node:22-alpine', 'ubuntu:22.04') */
  image: string;

  /** Volume mounts in Docker format (e.g., ['./:/workspace', '/tmp:/tmp']) */
  volumes?: string[];

  /** Port mappings (e.g., ['3000:3000', '8080:80']) */
  ports?: string[];

  /** Environment variables for the container */
  env?: Record<string, string>;

  /** Docker network to connect to */
  network?: string;

  /** Working directory inside the container */
  workDir?: string;

  /** Remove container when session ends (default: true) */
  removeOnExit?: boolean;

  /** Run in privileged mode (required for Docker-in-Docker) */
  privileged?: boolean;

  /** User to run as inside container (e.g., 'node', 'vscode') */
  user?: string;
}

/**
 * Parsed devcontainer.json configuration
 * Based on Dev Container spec: https://containers.dev/implementors/json_reference/
 */
export interface DevContainerConfig {
  /** Container name for display */
  name?: string;

  /** Pre-built image to use */
  image?: string;

  /** Build configuration for custom Dockerfile */
  build?: {
    /** Path to Dockerfile relative to devcontainer.json */
    dockerfile?: string;
    /** Build context path */
    context?: string;
    /** Build arguments */
    args?: Record<string, string>;
    /** Multi-stage build target */
    target?: string;
  };

  /** Dev Container Features to install */
  features?: Record<string, Record<string, unknown> | string>;

  /** Override default workspace mount */
  workspaceMount?: string;

  /** Default path inside container */
  workspaceFolder?: string;

  /** Additional mounts beyond workspace */
  mounts?: string[];

  /** Command to run after container creation (once) */
  onCreateCommand?: string | string[] | Record<string, string | string[]>;

  /** Command to run after each container start */
  postStartCommand?: string | string[] | Record<string, string | string[]>;

  /** Command to run after postStartCommand */
  postCreateCommand?: string | string[] | Record<string, string | string[]>;

  /** Command to run on host before container creation */
  initializeCommand?: string | string[] | Record<string, string | string[]>;

  /** User for lifecycle scripts and editor processes */
  remoteUser?: string;

  /** User for all container operations */
  containerUser?: string;

  /** Environment variables for entire container lifetime */
  containerEnv?: Record<string, string>;

  /** Environment variables for tools and sub-processes */
  remoteEnv?: Record<string, string>;

  /** Update UID/GID to match local user (Linux only) */
  updateRemoteUserUID?: boolean;

  /** Ports to forward from container to localhost */
  forwardPorts?: (number | string)[];

  /** Enable privileged mode */
  privileged?: boolean;

  /** Linux capabilities to add */
  capAdd?: string[];

  /** Security options */
  securityOpt?: string[];

  /** Docker Compose file path(s) for multi-container setups */
  dockerComposeFile?: string | string[];

  /** Service to connect to when using Docker Compose */
  service?: string;

  /** Services to start when using Docker Compose */
  runServices?: string[];

  /** What to do on shutdown: 'none' | 'stopCompose' */
  shutdownAction?: string;

  /** Custom Docker run arguments */
  runArgs?: string[];

  /** VS Code / tool customizations */
  customizations?: Record<string, unknown>;
}

/**
 * Container instance info returned by ContainerManager
 */
export interface ContainerInstance {
  /** Container ID (Docker container ID) */
  id: string;

  /** Container name */
  name: string;

  /** Current state */
  state: ContainerState;

  /** Image used */
  image: string;

  /** Workspace directory on host */
  hostWorkDir: string;

  /** Workspace directory in container */
  containerWorkDir: string;

  /** Created timestamp */
  createdAt: Date;
}

/**
 * Options for executing commands in a container
 */
export interface ContainerExecOptions {
  /** Container ID or name */
  containerId: string;

  /** Command to execute */
  command: string;

  /** Command arguments */
  args?: string[];

  /** Working directory inside container */
  workDir?: string;

  /** User to run as */
  user?: string;

  /** Environment variables */
  env?: Record<string, string>;

  /** Allocate pseudo-TTY */
  tty?: boolean;

  /** Keep STDIN open */
  interactive?: boolean;
}

/**
 * Result of container exec for PTY creation
 */
export interface ContainerExecResult {
  /** Full command to spawn (e.g., 'docker') */
  command: string;

  /** Arguments for the command */
  args: string[];

  /** Environment variables to set */
  env?: Record<string, string>;
}

/**
 * Docker info for diagnostics
 */
export interface DockerInfo {
  /** Docker CLI version */
  version: string;

  /** Docker server/daemon version */
  serverVersion?: string;

  /** Docker API version */
  apiVersion?: string;

  /** Whether daemon is running */
  daemonRunning: boolean;

  /** Operating system */
  os?: string;

  /** Architecture (e.g., 'amd64', 'arm64') */
  arch?: string;

  /** Error message if something failed */
  error?: string;
}

/**
 * Default container configuration
 */
export const DEFAULT_CONTAINER_CONFIG: Partial<ContainerConfig> = {
  enabled: false,
  image: 'ubuntu:22.04',
  workDir: '/workspace',
  removeOnExit: true,
  privileged: false,
};

/**
 * Default MConnect dev container image
 * Pre-built with common dev tools for fast startup
 */
export const MCONNECT_DEFAULT_IMAGE = 'ubuntu:22.04';

/**
 * Known ARM64-compatible base images (2026)
 */
export const ARM64_COMPATIBLE_IMAGES = [
  'ubuntu:22.04',
  'ubuntu:24.04',
  'debian:12',
  'debian:bookworm',
  'node:20',
  'node:22',
  'python:3.11',
  'python:3.12',
  'golang:1.22',
  'rust:1.75',
  'alpine:3.19',
];
