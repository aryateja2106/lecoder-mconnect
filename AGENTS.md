# MConnect Multi-Agent Architecture

MConnect supports multiple concurrent AI coding agents running in isolated pseudo-terminals (PTY). This document describes the architecture and how to configure agents.

## Supported Agent Types

MConnect supports these agent types out of the box:

| Type | Command | Description |
|------|---------|-------------|
| `shell` | User's default shell | Plain shell for manual commands |
| `claude` | `claude` | Claude Code (Anthropic's AI assistant) |
| `gemini` | `gemini` | Google Gemini CLI |
| `aider` | `aider` | Aider AI coding assistant |
| `codex` | `codex` | OpenAI Codex CLI |
| `custom` | User-defined | Any custom command |

## Agent Presets

Presets define which agents to spawn on startup:

### `shell-only` (Default)
Single shell for manual use:
```
mconnect start --preset shell-only
```

### `single`
One Claude Code agent:
```
mconnect start --preset single
```

### `dev-review`
Development setup with Claude for coding and shell for testing:
```
mconnect start --preset dev-review
```

### `research-spec-test`
Research workflow with Gemini for research, Claude for implementation, and shell for testing:
```
mconnect start --preset research-spec-test
```

### `custom`
Define agents via JSON array:
```
mconnect start --preset custom --agents '[{"type":"claude","name":"AI"},{"type":"shell","name":"Term"}]'
```

## WebSocket Protocol

Clients communicate with the server via WebSocket using JSON messages.

### Client to Server Messages

```typescript
// Send input to an agent
{ type: 'input', agentId: string, data: string }

// Resize terminal
{ type: 'resize', agentId: string, cols: number, rows: number }

// Create new agent
{ type: 'create_agent', config: AgentConfig }

// Kill agent
{ type: 'kill_agent', agentId: string, signal?: string }

// Switch focused agent
{ type: 'switch_agent', agentId: string }

// List all agents
{ type: 'list_agents' }

// Toggle read-only mode
{ type: 'mode_change', readOnly: boolean }

// Keepalive ping
{ type: 'ping' }
```

### Server to Client Messages

```typescript
// Session initialization
{ type: 'session_info', sessionId: string, isReadOnly: boolean, agents: AgentInfo[] }

// Terminal output from agent
{ type: 'output', agentId: string, data: string }

// Agent status change
{ type: 'agent_status', agentId: string, status: 'running' | 'exited' | 'error' }

// Agent exited
{ type: 'agent_exited', agentId: string, exitCode: number, signal?: string }

// New agent created
{ type: 'agent_created', agent: AgentInfo }

// Agent list response
{ type: 'agent_list', agents: AgentInfo[] }

// Mode changed
{ type: 'mode_changed', isReadOnly: boolean }

// Command blocked by guardrails
{ type: 'command_blocked', agentId: string, command: string, reason: string }

// Error
{ type: 'error', message: string, agentId?: string }

// Pong response
{ type: 'pong' }
```

## Agent Configuration

```typescript
interface AgentConfig {
  type: 'shell' | 'claude' | 'gemini' | 'aider' | 'codex' | 'custom';
  name: string;
  command?: string;      // For 'custom' type
  args?: string[];       // Command arguments
  env?: Record<string, string>;  // Environment variables
  cols?: number;         // Terminal columns (default: 80)
  rows?: number;         // Terminal rows (default: 24)
  initialPrompt?: string; // Auto-send after spawn
}
```

## Shell-First Architecture

MConnect uses a "shell-first" approach where each agent runs inside the user's login shell:

```
/bin/zsh -l -c "claude --allowedTools='Bash(command:*),Read,Write,Edit,...'"
```

Benefits:
- Inherits PATH and environment variables from shell profile
- Tools like `nvm`, `pyenv`, `rbenv` work correctly
- SSH keys and credentials are available
- Consistent with how users run commands manually

## Security

- **Token Authentication**: Each session requires a unique token
- **Rate Limiting**: Prevents connection spam (default: 10 connections/minute per IP)
- **Guardrails**: Block dangerous commands (see `--guardrails` option)
- **Read-Only Mode**: Default mode prevents accidental input
- **Input Sanitization**: Blocks injection attempts

## Adding Custom Agent Types

To add support for a new AI CLI tool, modify `src/agents/agent-types.ts`:

```typescript
export const AGENT_TYPES: Record<string, AgentTypeConfig> = {
  // ... existing types
  mycli: {
    name: 'MyCLI',
    command: 'mycli',
    args: ['--interactive'],
    description: 'My custom AI CLI tool',
  },
};
```

Then use it:
```
mconnect start --preset custom --agents '[{"type":"mycli","name":"My Agent"}]'
```
