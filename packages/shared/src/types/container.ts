/**
 * Container types for MConnect V2
 *
 * Supports both inline container configuration and Dev Container spec
 * for session isolation on any device including Raspberry Pi (aarch64).
 */

/**
 * Container runtime state
 */
export type ContainerState = 'none' | 'creating' | 'running' | 'stopping' | 'stopped' | 'error';

/**
 * Container resource limits
 */
export interface ContainerResourceLimits {
  /** CPU shares (relative weight) */
  cpuShares?: number;
  /** Memory limit in MB */
  memoryMB?: number;
  /** Disk space limit in MB */
  diskMB?: number;
}

/**
 * Inline container configuration for agent-level isolation
 */
export interface ContainerConfig {
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

  /** Resource limits for the container */
  resourceLimits?: ContainerResourceLimits;
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
 * Container instance info
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
 * Container security profile for agent containers
 */
export interface ContainerSecurityProfile {
  /** PID namespace: 'private' = own namespace */
  pid: 'private' | 'host';
  /** Network mode */
  network: 'bridge' | 'host' | 'none';
  /** IPC namespace */
  ipc: 'private' | 'host';
  /** Memory limit (e.g., '512m') */
  memory: string;
  /** CPU limit (e.g., '1.0') */
  cpus: string;
  /** Max processes */
  pids: number;
  /** Read-only root filesystem */
  readOnlyRootfs: boolean;
  /** Prevent privilege escalation */
  noNewPrivileges: boolean;
  /** Capabilities to drop */
  capDrop: string[];
  /** Capabilities to add */
  capAdd: string[];
  /** Seccomp profile */
  seccompProfile: 'default' | 'unconfined';
}

/**
 * Default container configuration
 */
export const DEFAULT_CONTAINER_CONFIG: Partial<ContainerConfig> = {
  image: 'ubuntu:22.04',
  workDir: '/workspace',
  removeOnExit: true,
  privileged: false,
};

/**
 * Default MConnect dev container image
 */
export const MCONNECT_DEFAULT_IMAGE = 'ubuntu:22.04';

/**
 * Default container security profile
 */
export const DEFAULT_SECURITY_PROFILE: ContainerSecurityProfile = {
  pid: 'private',
  network: 'bridge',
  ipc: 'private',
  memory: '512m',
  cpus: '1.0',
  pids: 100,
  readOnlyRootfs: false,
  noNewPrivileges: true,
  capDrop: ['ALL'],
  capAdd: ['CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'SETGID', 'SETUID'],
  seccompProfile: 'default',
};
