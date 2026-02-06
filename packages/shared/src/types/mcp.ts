/**
 * MCP (Model Context Protocol) types for MConnect V2
 *
 * Based on the MCP specification for tool and resource handling.
 */

/**
 * MCP transport type
 */
export type MCPTransport = 'stdio' | 'sse';

/**
 * MCP tool parameter schema
 */
export interface MCPToolParameter {
  /** Parameter name */
  name: string;
  /** JSON Schema type */
  type: string;
  /** Human-readable description */
  description?: string;
  /** Whether the parameter is required */
  required?: boolean;
  /** Default value */
  default?: unknown;
  /** Enum values for string types */
  enum?: string[];
}

/**
 * MCP tool configuration
 */
export interface MCPToolConfig {
  /** Tool name (identifier) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Input schema */
  inputSchema?: {
    type: 'object';
    properties?: Record<string, MCPToolParameter>;
    required?: string[];
  };
}

/**
 * MCP tool instance
 */
export interface MCPTool extends MCPToolConfig {
  /** Server providing this tool */
  server?: string;
}

/**
 * MCP resource configuration
 */
export interface MCPResourceConfig {
  /** Resource URI pattern */
  uri: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description?: string;
  /** MIME type */
  mimeType?: string;
}

/**
 * MCP configuration for an agent
 */
export interface MCPConfig {
  /** Transport type */
  transport: MCPTransport;
  /** Tool configurations */
  tools?: MCPToolConfig[];
  /** Resource configurations */
  resources?: MCPResourceConfig[];
}

/**
 * Base MCP message structure
 */
export interface MCPMessage {
  /** JSON-RPC version */
  jsonrpc: '2.0';
  /** Message ID for request/response correlation */
  id?: string | number;
  /** Method name (for requests/notifications) */
  method?: string;
  /** Parameters (for requests/notifications) */
  params?: unknown;
  /** Result (for responses) */
  result?: unknown;
  /** Error (for error responses) */
  error?: MCPError;
}

/**
 * MCP error structure
 */
export interface MCPError {
  /** Error code */
  code: number;
  /** Error message */
  message: string;
  /** Additional error data */
  data?: unknown;
}

/**
 * MCP request message
 */
export interface MCPRequest extends MCPMessage {
  id: string | number;
  method: string;
}

/**
 * MCP response message
 */
export interface MCPResponse extends MCPMessage {
  id: string | number;
}

/**
 * MCP notification message (no id, no response expected)
 */
export interface MCPNotification extends MCPMessage {
  method: string;
}

/**
 * MCP tool call request params
 */
export interface MCPToolCallParams {
  /** Tool name */
  name: string;
  /** Tool arguments */
  arguments?: Record<string, unknown>;
}

/**
 * MCP tool call result
 */
export interface MCPToolCallResult {
  /** Content returned by the tool */
  content: MCPContent[];
  /** Whether the tool call resulted in an error */
  isError?: boolean;
}

/**
 * MCP content types
 */
export type MCPContentType = 'text' | 'image' | 'resource';

/**
 * MCP content block
 */
export interface MCPContent {
  /** Content type */
  type: MCPContentType;
  /** Text content (for type='text') */
  text?: string;
  /** Image data (for type='image') */
  data?: string;
  /** MIME type (for type='image') */
  mimeType?: string;
  /** Resource URI (for type='resource') */
  resource?: {
    uri: string;
    text?: string;
    blob?: string;
    mimeType?: string;
  };
}
