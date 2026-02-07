/**
 * MCP Module
 *
 * Model Context Protocol bridge for agent communication.
 * - Stdio transport
 * - Tool registration
 * - Message correlation
 */

export {
  MCPBridge,
  MCPRequestError,
  createMCPBridge,
  getMCPBridge,
  removeMCPBridge,
  getAllMCPBridges,
  cleanupMCPBridges,
  type MCPBridgeConfig,
  type MCPBridgeEvents,
  type MCPConnectionState,
} from './MCPBridge.js';
