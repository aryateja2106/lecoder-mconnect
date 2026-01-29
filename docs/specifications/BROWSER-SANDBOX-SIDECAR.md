# SPEC: Browser Sandbox Sidecar Mode

**Version:** 1.0.0
**Status:** Draft
**Author:** LeCoder Team
**Date:** 2026-01-29
**Feature Branch:** `feature/browser-sandbox-sidecar`

---

## 1. Executive Summary

This specification defines a new **Sidecar Mode** for MConnect that enables:
1. **Terminal Sharing** - Attach to an existing Claude Code session instead of spawning new shells
2. **Browser as Sandbox** - Use browser security primitives for safe remote collaboration
3. **Work from Anywhere** - Watch, collaborate, and control terminal sessions from any device

### Vision
> "Spin up Claude Code, go for a walk, and manage it from your phone"

The key insight: Instead of spawning new terminals, sidecar mode **bridges the current terminal** to remote clients. When combined with browser-based sandboxing, this creates a secure environment for agentic AI collaboration.

---

## 2. Goals and Non-Goals

### Goals
- [G1] Enable remote observation/control of current Claude Code session
- [G2] Minimal footprint - no additional processes when not needed
- [G3] Browser-first security model using native sandbox primitives
- [G4] Graceful degradation when browser APIs unavailable
- [G5] Maintain compatibility with existing MConnect v2 protocol

### Non-Goals
- Container-based isolation (heavyweight, different use case)
- Full VNC/RDP-style remote desktop
- Multi-user concurrent editing (v1 is single-controller model)
- AI model execution in browser (we only sandbox the UI/terminal)

---

## 3. Architecture Overview

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     HOST MACHINE                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 CLAUDE CODE SESSION                          │   │
│  │  ┌──────────────┐                                           │   │
│  │  │   Terminal   │ ←────────────────────────┐                │   │
│  │  │   (stdin/    │                          │                │   │
│  │  │    stdout)   │                          │                │   │
│  │  └──────────────┘                          │                │   │
│  └───────────────────────────────────────────┼─────────────────┘   │
│                                              │                      │
│  ┌───────────────────────────────────────────┼─────────────────┐   │
│  │              MCONNECT SIDECAR              │                 │   │
│  │  ┌────────────┐   ┌──────────────────────┼─┐               │   │
│  │  │  Terminal  │   │    WebSocket Hub     │ │               │   │
│  │  │  Bridge    │───│  (Protocol v2.1)     │ │               │   │
│  │  └────────────┘   └──────────────────────┼─┘               │   │
│  │                                          │                  │   │
│  │  ┌────────────┐   ┌──────────────────────┴─┐               │   │
│  │  │ Cloudflare │   │    HTTP Server         │               │   │
│  │  │   Tunnel   │───│  + Static Assets       │               │   │
│  │  └────────────┘   └────────────────────────┘               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS + WSS
                              │
┌─────────────────────────────┴───────────────────────────────────────┐
│                     BROWSER (SANDBOX)                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    MAIN FRAME                                │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  Content Security Policy                             │   │   │
│  │  │  default-src 'self';                                 │   │   │
│  │  │  connect-src 'self' wss://*.trycloudflare.com;       │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                                                              │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐    │   │
│  │  │  Terminal  │  │ Permission │  │   File System      │    │   │
│  │  │  (xterm.js)│  │  Manager   │  │   Access API       │    │   │
│  │  └────────────┘  └────────────┘  └────────────────────┘    │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  SANDBOXED IFRAME (for untrusted content)            │   │   │
│  │  │  sandbox="allow-scripts"                              │   │   │
│  │  │  csp="default-src 'none'"                             │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Breakdown

| Component | Location | Purpose |
|-----------|----------|---------|
| TerminalBridge | `packages/cli/src/sidecar/terminal-bridge.ts` | Bridges stdin/stdout to WebSocket |
| SidecarSession | `packages/cli/src/sidecar/sidecar-session.ts` | Manages sidecar lifecycle |
| SandboxClient | `apps/web/src/lib/sandbox/` | Browser sandbox primitives |
| PermissionManager | `apps/web/src/lib/sandbox/permissions.ts` | Granular permission control |

---

## 4. Sidecar Mode Design

### 4.1 CLI Interface

```bash
# Start sidecar mode (minimal - just server)
mconnect sidecar

# With options
mconnect sidecar --port 8765 --no-tunnel

# Inside Claude Code session
claude --background "mconnect sidecar --background"
```

**New CLI Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--sidecar` | false | Enable sidecar mode (server only, no PTY spawn) |
| `--attach-tty` | false | Attempt to attach to current TTY for I/O |
| `--observe-only` | false | Read-only mode (no input forwarding) |
| `--background` | false | Daemonize after printing connection info |

### 4.2 Terminal Bridge

The Terminal Bridge is the core of sidecar mode. It captures terminal I/O without spawning a new PTY.

```typescript
interface TerminalBridge {
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // I/O
  onOutput(handler: (data: Buffer) => void): void;
  write(data: Buffer): void;

  // State
  getTerminalSize(): { rows: number; cols: number };
  isAttached(): boolean;
}
```

**Implementation Strategy:**

1. **TTY Attachment (Preferred)**
   ```typescript
   // If running in a TTY, read from /dev/tty
   const tty = fs.openSync('/dev/tty', 'r+');
   const readStream = fs.createReadStream(null, { fd: tty });
   ```

2. **Pipe Mode (Fallback)**
   ```typescript
   // If stdin/stdout are pipes, bridge them
   process.stdin.on('data', (chunk) => this.emit('output', chunk));
   ```

3. **Script Mode (Advanced)**
   ```bash
   # Use script(1) to capture session
   script -q -F /tmp/mconnect.fifo
   ```

### 4.3 Sidecar Session Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   INIT      │────▶│  ATTACHED   │────▶│  CONNECTED  │
│             │     │             │     │             │
│ Parse args  │     │ Bridge TTY  │     │ Clients OK  │
│ Start HTTP  │     │ Start WS    │     │ Streaming   │
│ Start Tunnel│     │ Wait client │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   ERROR     │     │  DETACHED   │     │  SHUTDOWN   │
│             │     │             │     │             │
│ Tunnel fail │     │ TTY closed  │     │ Signal recv │
│ Port in use │     │ No clients  │     │ Clean exit  │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 5. Browser Sandbox Security Model

### 5.1 Content Security Policy

```http
Content-Security-Policy:
  default-src 'none';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' wss://*.trycloudflare.com wss://localhost:*;
  img-src 'self' data:;
  font-src 'self' https://fonts.gstatic.com;
  frame-src 'self';
  worker-src 'self';
```

### 5.2 Permission Model

Following the principle of least privilege, all capabilities require explicit user consent:

| Permission | Prompt | Persist |
|------------|--------|---------|
| Terminal View | Auto | Session |
| Terminal Input | "Allow typing?" | Session |
| File Download | "Save file?" | Never |
| Clipboard Access | "Copy to clipboard?" | Session |
| Notification | "Allow notifications?" | Permanent |

### 5.3 Sandboxed Iframe for Untrusted Content

When displaying AI-generated content (e.g., markdown preview, HTML output):

```html
<iframe
  sandbox="allow-scripts"
  csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'"
  srcdoc="..."
></iframe>
```

This prevents:
- XSS attacks from AI-generated content
- Network access from untrusted code
- Access to parent frame DOM
- Cookie/storage access

---

## 6. WebSocket Protocol Extensions

### 6.1 Protocol Version Bump

Protocol version: `2.1.0` (backward compatible with 2.0)

### 6.2 New Message Types

**Client → Server:**

```typescript
// Attach to sidecar session (instead of agent)
interface SidecarAttachMessage {
  type: 'sidecar_attach';
  token: string;
  clientType: 'pc' | 'mobile' | 'browser';
}

// Request terminal capabilities
interface CapabilitiesRequest {
  type: 'capabilities_request';
}
```

**Server → Client:**

```typescript
// Sidecar-specific session info
interface SidecarInfo {
  type: 'sidecar_info';
  attached: boolean;
  ttyPath?: string;
  terminalSize: { rows: number; cols: number };
  permissions: PermissionSet;
}

// Capabilities response
interface CapabilitiesResponse {
  type: 'capabilities';
  sandbox: {
    csp: string;
    fileSystemAccess: boolean;
    clipboard: boolean;
  };
  terminal: {
    input: boolean;
    resize: boolean;
    scrollback: number;
  };
}
```

### 6.3 Heartbeat and Keepalive

Sidecar mode uses the same heartbeat mechanism as standard mode:
- Server sends `heartbeat` every 30 seconds
- Client responds with `heartbeat_ack`
- 3 missed heartbeats = disconnect

---

## 7. File System Integration (Future)

### 7.1 File System Access API

For future versions, browser clients can use the File System Access API for local file access:

```typescript
// Request directory access (user-initiated only)
const dirHandle = await window.showDirectoryPicker();

// Read files within the selected directory
const file = await dirHandle.getFileHandle('config.json');
const contents = await file.getFile().then(f => f.text());

// Write files (requires explicit permission)
const writable = await file.createWritable();
await writable.write(newContents);
await writable.close();
```

This provides a "chroot jail" - all operations are scoped to the user-selected directory with no parent traversal possible.

### 7.2 Virtual File System

For sandboxed operations, we provide a virtual filesystem that:
- Maps to IndexedDB storage
- Provides POSIX-like API
- Can sync with server on demand

---

## 8. Security Considerations

### 8.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Malicious remote client | Token-based auth, rate limiting, CSP |
| XSS from terminal output | Sandboxed iframe, output sanitization |
| Session hijacking | Short-lived tokens, HTTPS only |
| Clipboard exfiltration | Permission prompt, user consent |
| Local network scanning | CSP connect-src restriction |

### 8.2 Defense in Depth

1. **Transport Security**: HTTPS/WSS only (via Cloudflare Tunnel)
2. **Authentication**: 6-char pairing code + session token
3. **Authorization**: Permission system for all capabilities
4. **Isolation**: Sandboxed iframes for untrusted content
5. **Rate Limiting**: 100 chars/sec input, 10 req/sec API

### 8.3 Known Limitations

1. Terminal output is trusted by default (no per-line sanitization)
2. Copy/paste crosses the sandbox boundary
3. Browser APIs have inconsistent cross-browser support

---

## 9. Implementation Phases

### Phase 1: Core Sidecar Mode (v1.1.0)
- [ ] Terminal Bridge implementation
- [ ] `mconnect sidecar` CLI command
- [ ] Basic WebSocket bridging
- [ ] Headless/background mode support

### Phase 2: Browser Sandbox (v1.2.0)
- [ ] CSP implementation
- [ ] Permission manager
- [ ] Sandboxed iframe for content
- [ ] Updated web UI

### Phase 3: Enhanced Features (v1.3.0)
- [ ] File System Access API integration
- [ ] Clipboard API with permissions
- [ ] Notification API
- [ ] Offline support (Service Worker)

### Phase 4: Collaboration Features (v2.0.0)
- [ ] Multi-viewer support
- [ ] Cursor sharing
- [ ] Chat/comments
- [ ] Session recording

---

## 10. API Reference

### 10.1 SidecarSession

```typescript
class SidecarSession {
  constructor(config: SidecarConfig);

  // Lifecycle
  start(): Promise<SidecarInfo>;
  stop(): Promise<void>;

  // Events
  on(event: 'client_connected', handler: (client: ClientInfo) => void): void;
  on(event: 'client_disconnected', handler: (client: ClientInfo) => void): void;
  on(event: 'input', handler: (data: Buffer, client: ClientInfo) => void): void;

  // State
  isRunning(): boolean;
  getClients(): ClientInfo[];
  getConnectionInfo(): ConnectionInfo;
}

interface SidecarConfig {
  port?: number;           // Default: 8765
  enableTunnel?: boolean;  // Default: true
  observeOnly?: boolean;   // Default: false
  background?: boolean;    // Default: false
}

interface ConnectionInfo {
  localUrl: string;
  tunnelUrl?: string;
  pairingCode: string;
  sessionId: string;
}
```

### 10.2 TerminalBridge

```typescript
class TerminalBridge extends EventEmitter {
  constructor();

  // Lifecycle
  attach(): Promise<boolean>;
  detach(): void;

  // I/O
  write(data: Buffer): void;

  // Events
  on(event: 'data', handler: (data: Buffer) => void): void;
  on(event: 'resize', handler: (size: TerminalSize) => void): void;
  on(event: 'close', handler: () => void): void;

  // Properties
  readonly isAttached: boolean;
  readonly size: TerminalSize;
}
```

---

## 11. Testing Strategy

### 11.1 Unit Tests

| Component | Test File | Coverage Target |
|-----------|-----------|-----------------|
| TerminalBridge | `terminal-bridge.test.ts` | 80% |
| SidecarSession | `sidecar-session.test.ts` | 80% |
| Protocol | `protocol-v21.test.ts` | 90% |

### 11.2 Integration Tests

1. **Sidecar → WebSocket → Browser Client**
2. **TTY Attachment in various terminal emulators**
3. **Cloudflare Tunnel with sidecar mode**

### 11.3 E2E Tests

1. Start sidecar from Claude Code
2. Connect from mobile browser
3. Type command → verify output appears
4. Disconnect → verify graceful cleanup

---

## 12. Appendix

### A. Compatibility Matrix

| Environment | TTY Attach | Pipe Mode | Notes |
|-------------|------------|-----------|-------|
| macOS Terminal | ✅ | ✅ | Full support |
| iTerm2 | ✅ | ✅ | Full support |
| VS Code Terminal | ⚠️ | ✅ | Limited TTY |
| tmux | ✅ | ✅ | Full support |
| Claude Code Bash | ❌ | ✅ | Non-TTY |
| SSH | ✅ | ✅ | Full support |

### B. Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| WebSocket | ✅ | ✅ | ✅ | ✅ |
| CSP | ✅ | ✅ | ✅ | ✅ |
| Sandbox Iframe | ✅ | ✅ | ✅ | ✅ |
| File System Access | ✅ | ❌ | ❌ | ✅ |
| Clipboard API | ✅ | ✅ | ⚠️ | ✅ |

### C. References

- [The Browser is the Sandbox](https://aifoc.us/the-browser-is-the-sandbox/)
- [Fence: Container-free Sandboxing](https://github.com/Use-Tusk/fence)
- [Co-do: Browser-based AI Sandbox Demo](https://github.com/PaulKinlan/Co-do)
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

*End of Specification*
