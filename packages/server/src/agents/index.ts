/**
 * Agents Module
 *
 * Agent lifecycle management and container orchestration.
 * - Container runtime (Docker)
 * - Agent presets (Claude, Shell)
 * - I/O streaming
 */

export {
  ContainerRuntime,
  createContainerRuntime,
  createContainerOptions,
  getContainerRuntime,
  setContainerRuntime,
  type ContainerRuntimeState,
  type ContainerRuntimeInfo,
  type ContainerCreateOptions,
  type ContainerStreams,
  type ContainerRunOptions,
  type ContainerRuntimeEvents,
} from './ContainerRuntime.js';
