# Changelog

All notable changes to MConnect will be documented in this file.

## [0.1.2] - 2026-01-15

### Added

#### Shell-First Architecture
- Implemented shell-first approach for spawning AI agents
- All agents now spawn inside a login shell first, then optionally run AI commands
- This ensures proper PATH resolution and environment variable handling
- Fixes the `posix_spawnp failed` error when trying to spawn commands directly

#### Doctor Command
- New `mconnect doctor` command for system diagnostics
- Checks all dependencies: Node.js, Python, C++ compiler, node-pty, tmux, cloudflared
- Provides clear fix instructions for any missing dependencies
- Pre-flight check for node-pty before starting a session

#### Multi-Agent Presets
- `shell-only` - Single interactive shell (recommended to start)
- `single` - Single AI agent (Claude Code) with shell wrapper
- `research-spec-test` - 3 shells for parallel ideation workflow
- `dev-review` - 2 shells for development + code review workflow
- `custom` - Configure multiple shells manually

#### New Agent System
- New `agents/types.ts` with comprehensive type definitions
- `AgentType` union: `'claude' | 'gemini' | 'codex' | 'aider' | 'shell' | 'custom'`
- `AgentStatus` for tracking agent lifecycle
- `AGENT_COMMANDS` mapping for running AI tools inside shells
- `AGENT_PRESETS` for common multi-agent configurations

#### Agent Manager
- New `AgentManager` class for multi-agent lifecycle management
- Handles agent creation, event routing, and cleanup
- Event-driven architecture with data/status/exit/error handlers
- Support for creating agents from presets

#### PTY Manager
- New `PTYManager` class wrapping node-pty
- Full terminal emulation with color support (xterm-256color)
- Login shell spawning with `-l` flag for proper environment
- Dynamic import of node-pty for graceful degradation

#### Tmux Manager
- New `TmuxManager` for server-side visualization
- Manages tmux sessions for viewing multiple agents
- Auto-detection of tmux binary path
- Layout management (tiled, horizontal, vertical)

#### Comprehensive Test Suite
- 226 tests covering all new modules
- Tests for: types, doctor, agent-manager, pty-manager, tmux-manager
- Mocked native modules for CI compatibility
- 84%+ statement coverage on unit-testable modules

### Changed

- CLI entry point moved to `index-v2.ts` for the new architecture
- Build outputs to `dist-v2/` directory
- Updated vitest configuration for new modules
- Improved error messages with actionable fix suggestions

### Fixed

- Fixed `posix_spawnp failed` error by using shell-first approach
- Fixed escaped template literals causing build failures
- Fixed node-pty detection and improved error handling
- Fixed environment variable propagation to spawned shells
- Fixed ESM/CommonJS compatibility for node-pty using `createRequire`
- Added shell binary validation before spawn (checks existence and executable permission)
- Added working directory validation before spawn
- Added environment variable filtering (removes undefined values from process.env)
- Enhanced doctor command to verify spawn-helper binary on macOS
- Added debug logging for PTY spawn operations

### Technical Details

#### Shell-First Architecture
Instead of spawning `claude` directly (which fails due to PATH issues):
```typescript
// OLD (broken)
spawn('claude', [], { cwd: '/project' })

// NEW (working)
spawn('/bin/zsh', ['-l'], { cwd: '/project' })
// Then write 'claude\n' to the PTY stdin
```

#### Environment Setup
All spawned shells now include:
```typescript
{
  TERM: 'xterm-256color',
  COLORTERM: 'truecolor',
  FORCE_COLOR: '1',
  CLICOLOR: '1',
  CLICOLOR_FORCE: '1',
}
```

## [0.1.1] - Previous Release

- Initial multi-agent architecture planning
- WebSocket hub for multiplexed routing
- Basic web client with tab-based UI

## [0.1.0] - Initial Release

- Single agent support
- Cloudflare tunnel integration
- QR code mobile connection
- Basic guardrails system
- Read-only mode for mobile viewing
