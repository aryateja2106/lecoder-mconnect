/**
 * API Module
 *
 * REST API routes for MConnect V2.
 */

export {
  handleCreateSession,
  handleListSessions,
  handleGetSession,
  handleDeleteSession,
  handleGetConnectionInfo,
  handleSessionRoutes,
} from './sessions.js';

export {
  handleListPresets,
  handleGetPreset,
  handleCreatePreset,
  handleDeletePreset,
  handlePresetRoutes,
} from './presets.js';

export {
  handleRegisterToken,
  handleRemoveToken,
  handleDeviceRoutes,
} from './devices.js';

export {
  handleFleetRoutes,
  handleListFleet,
  handleGetRuntime,
  handleEnqueueTask,
  handleRegisterRuntime,
  handleHeartbeat,
  handleTasksNext,
  handleDeregister,
} from './fleet.js';
