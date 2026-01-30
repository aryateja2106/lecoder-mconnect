/**
 * Container module for MConnect
 *
 * Provides Docker container isolation for AI agent sessions.
 * Supports both inline container configuration and Dev Container spec.
 */

// Container Manager
export {
  ContainerManager,
  getContainerManager,
  resetContainerManager,
} from './container-manager.js';
// DevContainer parser
export {
  createDefaultDevContainerConfig,
  findDevContainerConfig,
  getContainerEnv,
  getContainerImage,
  getContainerUser,
  getDockerRunArgs,
  getVolumeMounts,
  hasDevContainerConfig,
  parseDevContainer,
  resolveVariables,
} from './devcontainer.js';
// Dockerfile templates
export {
  DEFAULT_DOCKERFILE,
  detectProjectTemplate,
  generateDockerfile,
  getDockerfileTemplate,
  MINIMAL_DOCKERFILE,
  NODEJS_DOCKERFILE,
  PYTHON_DOCKERFILE,
} from './dockerfile.js';
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
  ARM64_COMPATIBLE_IMAGES,
  DEFAULT_CONTAINER_CONFIG,
  MCONNECT_DEFAULT_IMAGE,
} from './types.js';
