/**
 * Container module for MConnect
 *
 * Provides Docker container isolation for AI agent sessions.
 * Supports both inline container configuration and Dev Container spec.
 */

// Types
export type {
  ContainerConfig,
  ContainerExecOptions,
  ContainerExecResult,
  ContainerInstance,
  ContainerState,
  DevContainerConfig,
  DockerInfo,
} from './types.js';

export {
  DEFAULT_CONTAINER_CONFIG,
  MCONNECT_DEFAULT_IMAGE,
  ARM64_COMPATIBLE_IMAGES,
} from './types.js';

// DevContainer parser
export {
  findDevContainerConfig,
  hasDevContainerConfig,
  parseDevContainer,
  resolveVariables,
  getContainerImage,
  getVolumeMounts,
  getContainerEnv,
  getContainerUser,
  getDockerRunArgs,
  createDefaultDevContainerConfig,
} from './devcontainer.js';

// Dockerfile templates
export {
  DEFAULT_DOCKERFILE,
  MINIMAL_DOCKERFILE,
  NODEJS_DOCKERFILE,
  PYTHON_DOCKERFILE,
  getDockerfileTemplate,
  generateDockerfile,
  detectProjectTemplate,
} from './dockerfile.js';

// Container Manager
export {
  ContainerManager,
  getContainerManager,
  resetContainerManager,
} from './container-manager.js';
