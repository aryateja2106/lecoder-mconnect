/**
 * Agents Module
 *
 * Agent lifecycle management and container orchestration.
 * - Agent Manager (lifecycle, I/O, status tracking)
 * - Container runtime (Docker)
 * - Agent presets (Claude, Shell)
 * - I/O streaming
 */

// Agent Manager
export {
  AgentManager,
  getAgentManager,
  initializeAgentManager,
  resetAgentManager,
  type AgentOutputCallback,
  type AgentStatusCallback,
  type AgentManagerEvents,
  type MCPResponse,
} from './AgentManager.js';

// Agent WS Bridge
export {
  AgentWSBridge,
  getAgentWSBridge,
  initializeAgentWSBridge,
  resetAgentWSBridge,
} from './AgentWSBridge.js';

// Container Runtime
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
