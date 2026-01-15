# MConnect Testing Guide

## Quick Start Commands

```bash
# From project root
cd lecoder-mconnect

# Install all dependencies
npm install

# Build CLI
npm run build:cli

# Run CLI (shows wizard)
npm run cli

# Run CLI with help
npm run cli -- --help

# Run web dev server
npm run dev

# Run all tests
npm run test:cli

# Run tests with coverage
cd packages/cli && npm run test:coverage
```

## Test Results Summary

| Module | Tests | Coverage |
|--------|-------|----------|
| security.ts | 27 | 100% |
| guardrails.ts | 31 | 100% |
| tunnel.ts | 7 | mocked |
| web-client.ts | 16 | 100% |
| agents.ts | 6 | 80% |
| **Total** | **87** | **95.6%** |

---

## Unit Test Coverage

### Security Module (100% coverage)

| Test Case | Description |
|-----------|-------------|
| generateSecureToken - default length | Generates 43+ char tokens |
| generateSecureToken - specified length | Respects length parameter |
| generateSecureToken - uniqueness | 100 tokens all unique |
| generateSecureToken - charset | Only base64url chars |
| generateSessionId - format | 8-char hex string |
| generateSessionId - uniqueness | All unique |
| hashForLogging - length | Returns 8 chars |
| hashForLogging - consistency | Same input = same hash |
| hashForLogging - variance | Different inputs = different hashes |
| isValidToken - valid tokens | Accepts valid base64url |
| isValidToken - too short | Rejects < 20 chars |
| isValidToken - too long | Rejects > 64 chars |
| isValidToken - invalid chars | Rejects spaces, +, / |
| RateLimiter - within limit | Allows up to limit |
| RateLimiter - exceeds limit | Blocks after limit |
| RateLimiter - per IP | Different IPs tracked separately |
| RateLimiter - cleanup | Expired entries removed |
| sanitizeInput - null bytes | Removes \x00 |
| sanitizeInput - preserves sequences | Keeps ANSI codes |
| sanitizeInput - preserves newlines | Keeps \n and \t |
| detectInjection - $() | Detects command substitution |
| detectInjection - backticks | Detects `cmd` |
| detectInjection - pipe to shell | Detects \| sh |
| detectInjection - system files | Detects > /etc/ |
| detectInjection - remote exec | Detects curl\|sh |
| detectInjection - normal cmds | Allows ls, git, npm |
| detectInjection - semicolon rm | Detects ; rm |

### Guardrails Module (100% coverage)

| Test Case | Description |
|-----------|-------------|
| loadGuardrails - default | Returns default config |
| loadGuardrails - strict | Returns strict config |
| loadGuardrails - permissive | Returns permissive config |
| loadGuardrails - none | Returns empty patterns |
| loadGuardrails - unknown | Falls back to default |
| checkCommand - rm -rf / | Blocked |
| checkCommand - rm -rf ~ | Blocked |
| checkCommand - rm -rf . | Blocked |
| checkCommand - mkfs | Blocked |
| checkCommand - dd if= | Blocked |
| checkCommand - fork bomb | Blocked |
| checkCommand - git push --force | Requires approval |
| checkCommand - git reset --hard | Requires approval |
| checkCommand - rm -rf ./path | Requires approval |
| checkCommand - npm publish | Requires approval |
| checkCommand - DROP TABLE | Requires approval |
| checkCommand - ls | Allowed |
| checkCommand - git status | Allowed |
| checkCommand - npm install | Allowed |
| checkCommand - git push | Allowed |
| checkCommand - mkdir | Allowed |
| checkCommand - strict rm | Requires approval |
| checkCommand - strict git push | Requires approval |
| checkCommand - none rm -rf / | Allowed |
| checkCommand - case insensitive | Works regardless of case |

### Agents Module (80% coverage)

| Test Case | Description |
|-----------|-------------|
| getAgentConfig - claude | Returns Claude Code config |
| getAgentConfig - gemini | Returns Gemini CLI config |
| getAgentConfig - codex | Returns Codex config |
| getAgentConfig - aider | Returns Aider config |
| getAgentConfig - unknown | Returns generic config |
| getAgentConfig - empty | Handles empty string |

### Tunnel Module (mocked - 7 tests)

| Test Case | Description |
|-----------|-------------|
| isCloudflaredInstalled - command -v | Finds via `command -v cloudflared` |
| isCloudflaredInstalled - known paths | Falls back to checking known installation paths |
| isCloudflaredInstalled - not found | Returns false when not installed |
| isCloudflaredInstalled - Intel Mac | Finds at `/usr/local/bin/cloudflared` |
| isCloudflaredInstalled - Linux | Finds at `/usr/bin/cloudflared` |
| getUrl - initial | Returns null initially |
| stop - no process | Doesn't throw when no process running |

### Web Client Module (100% coverage - 10 tests)

| Test Case | Description |
|-----------|-------------|
| getWebClientHTML - token embedded | Token is embedded in HTML |
| getWebClientHTML - xterm CDN | Includes xterm.js from CDN |
| getWebClientHTML - branding | Includes MConnect branding |
| getWebClientHTML - control buttons | Has Read-Only and Kill buttons |
| getWebClientHTML - WebSocket code | Includes WebSocket connection logic |
| getWebClientHTML - isReadOnly param | Respects isReadOnly parameter |
| getWebClientHTML - approval handling | Includes approve/deny UI |
| getWebClientHTML - reconnection | Has reconnection logic |
| getWebClientHTML - keepalive | Has 30s ping/pong keepalive |
| getWebClientHTML - responsive | Has mobile viewport meta tag |

---

## Manual End-to-End Testing

### Test 1: CLI Wizard Flow

```bash
# Run CLI
npm run cli

# Expected:
# 1. Shows "LeCoder MConnect" banner
# 2. Agent selection prompt (Claude, Gemini, Codex, Custom)
# 3. Guardrails selection prompt
# 4. Working directory confirmation
# 5. Safety mode explanation
# 6. Summary and confirmation
# 7. QR code displayed
```

### Test 2: Web App No Token

```bash
# Start web server
npm run dev

# Open http://localhost:3000 in browser

# Expected:
# - "No Session Token" message
# - Lock icon
# - Instructions to run CLI
```

### Test 3: Full Connection Flow

```bash
# Terminal 1: Start CLI
npm run cli
# Select Claude Code (or custom: "echo test")
# Select Default guardrails
# Confirm directory
# Note the displayed URL/QR code

# Terminal 2: Start web
npm run dev

# Browser: Open URL from QR code (with token parameter)

# Expected:
# - Web app shows "Connecting..."
# - Then shows terminal output
# - Read-only mode indicator
# - Control bar with toggle, kill button
```

### Test 4: Mobile Responsiveness

1. Open web app on mobile device (or Chrome DevTools mobile view)
2. Verify:
   - Terminal fills screen
   - Control bar at bottom
   - Toggle button accessible
   - Kill button visible

### Test 5: Read-Only Mode

1. Connect to session
2. Try typing in terminal
3. Should show error about read-only mode
4. Click "Read-Only" toggle
5. Confirm modal appears
6. Click "Enable"
7. Now typing should work

### Test 6: Kill Switch

1. Start a long-running command (e.g., `sleep 100`)
2. Click Kill button
3. Confirm modal
4. Process should receive SIGINT

---

## Integration Test Requirements

The following require actual services running:

| Test | Requirement |
|------|-------------|
| WebSocket connection | CLI running on :8765 |
| Cloudflare Tunnel | cloudflared installed |
| Agent execution | Actual agent (claude/gemini) installed |

---

## Security Testing Checklist

- [ ] Tokens are cryptographically secure (32 bytes random)
- [ ] Session IDs don't leak sensitive info
- [ ] Rate limiting prevents connection flooding
- [ ] Invalid tokens are rejected (4001 Unauthorized)
- [ ] Null bytes are stripped from input
- [ ] Injection patterns are detected and blocked
- [ ] Dangerous commands are blocked or require approval
- [ ] No sensitive data in console logs

---

## Performance Benchmarks

| Operation | Expected |
|-----------|----------|
| Token generation | < 1ms |
| Guardrail check | < 1ms |
| WebSocket message | < 10ms |
| Terminal render | < 50ms |

---

## Known Limitations

1. **session.ts** - Not unit tested (requires integration testing with WebSocket)
2. **WebSocket reconnection** - May need manual refresh after long disconnect
3. **Mobile keyboard** - xterm.js keyboard works but may vary by device
4. **Cloudflare Tunnel** - Requires cloudflared to be installed (auto-detected at `/opt/homebrew/bin/`, `/usr/local/bin/`, `/usr/bin/`, or via `command -v`)

---

## Cloudflared Detection

The tunnel module now searches for cloudflared in the following locations:
1. Via `command -v cloudflared` (shell lookup)
2. `/opt/homebrew/bin/cloudflared` (Homebrew Apple Silicon)
3. `/usr/local/bin/cloudflared` (Homebrew Intel Mac)
4. `/usr/bin/cloudflared` (Linux package manager)
5. `~/.cloudflared/cloudflared` (User install)

---

*Last updated: January 15, 2026*
