/**
 * WebSocket Protocol v3.0 Message Types
 *
 * Protocol v3.0 extends v2.0 with:
 * - MCP message routing
 * - OAuth token authentication (not query param)
 * - Structured error responses with retry hints
 * - Binary message support for large outputs
 */
// ============================================================================
// Protocol Constants
// ============================================================================
/**
 * Current protocol version
 */
export const PROTOCOL_VERSION = '3.0';
/**
 * Rate limits for protocol operations
 */
export const RATE_LIMITS = {
    /** Max characters per second for input */
    inputCharsPerSecond: 100,
    /** Max control requests per window */
    controlRequestsPerWindow: 1,
    /** Control request window in milliseconds */
    controlRequestWindowMs: 10000,
    /** Max scrollback requests per second */
    scrollbackRequestsPerSecond: 10,
    /** Max MCP messages per second */
    mcpMessagesPerSecond: 20,
    /** Max reconnection attempts per minute */
    reconnectionAttemptsPerMinute: 5,
};
// ============================================================================
// Message Type Guards
// ============================================================================
/**
 * Check if a message is a client message
 */
export function isClientMessage(msg) {
    return [
        'auth',
        'session_attach',
        'session_detach',
        'terminal_input',
        'resize',
        'control_request',
        'scrollback_request',
        'mcp_forward',
        'heartbeat_ack',
        'ping',
    ].includes(msg.type);
}
/**
 * Check if a message is a server message
 */
export function isServerMessage(msg) {
    return [
        'auth_success',
        'auth_failed',
        'session_list',
        'session_state',
        'terminal_output',
        'agent_status',
        'agent_list',
        'control_status',
        'control_response',
        'input_rejected',
        'scrollback_response',
        'mcp_response',
        'client_joined',
        'client_left',
        'heartbeat',
        'pong',
        'error',
    ].includes(msg.type);
}
//# sourceMappingURL=messages.js.map