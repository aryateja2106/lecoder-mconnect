/**
 * Web Client v4 for MConnect v0.2.0
 *
 * LeCoder Design System - Monochrome Terminal Aesthetic
 * Inspired by OpenCode, Conductor, Notion
 * Mobile-first design with compact, efficient controls
 *
 * FEATURES:
 * 1. Compact icon-based shortcut bar with grouped controls
 * 2. All essential keys: Tab, ⇧Tab, ^C, ^D, ^F, ^L, arrows
 * 3. Copy/Paste/Link/Image buttons for mobile workflow
 * 4. Terminal resize propagation to PTY
 * 5. Mobile touch scrolling with alternate buffer detection
 * 6. VisualViewport API for mobile keyboard handling
 * 7. Image upload support with server-side storage
 */

export function getWebClientHTML(
  token: string,
  sessionId: string,
  isReadOnly: boolean = true
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, interactive-widget=resizes-content">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#191919">
  <title>MConnect</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css">
  <style>
    :root {
      /* LeCoder Design System - Monochrome Terminal Aesthetic */
      --bg-primary: #191919;
      --bg-secondary: #202020;
      --bg-elevated: #252525;
      --bg-card: #1f1f1f;
      --bg-hover: #2a2a2a;
      --border-subtle: #2a2a2a;
      --border-default: #373737;
      --border-hover: #525252;
      --text-primary: #e9e9e7;
      --text-secondary: #9b9b9b;
      --text-muted: #6b6b6b;
      --text-dim: #4a4a4a;
      --accent-green: #4ade80;
      --accent-green-dim: #22c55e;
      --accent-red: #ef4444;
      --accent-red-dim: #dc2626;
      --accent-yellow: #fbbf24;
      --accent-blue: #60a5fa;
      --accent-purple: #a78bfa;
      --radius: 8px;
      --app-height: 100vh;
      --bottom-height: 120px;
    }

    ::selection {
      background: var(--text-primary);
      color: var(--bg-primary);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    html, body {
      height: 100%;
      height: var(--app-height);
      background: var(--bg-primary);
      font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-primary);
      overflow: hidden;
      touch-action: manipulation;
      position: fixed;
      width: 100%;
    }

    .app {
      display: flex;
      flex-direction: column;
      height: 100%;
      height: var(--app-height);
    }

    /* ═══════════════════════════════════════════
       HEADER - Compact status bar
       ═══════════════════════════════════════════ */
    .header {
      background: var(--bg-primary);
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .brand-icon {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      color: var(--accent-green);
      background: var(--bg-elevated);
      padding: 4px 6px;
      border-radius: 4px;
      letter-spacing: -0.5px;
    }

    .brand-name {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      letter-spacing: -0.3px;
    }

    .status-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .conn-status {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .conn-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent-green);
      box-shadow: 0 0 6px var(--accent-green);
    }

    .conn-dot.offline {
      background: var(--accent-red);
      box-shadow: 0 0 6px var(--accent-red);
    }
    .conn-dot.connecting {
      background: var(--accent-yellow);
      box-shadow: 0 0 6px var(--accent-yellow);
      animation: blink 1.2s ease-in-out infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    .conn-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .term-size {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: var(--text-muted);
      background: var(--bg-secondary);
      padding: 3px 7px;
      border-radius: 4px;
    }

    /* ═══════════════════════════════════════════
       TABS - Shell/Agent switcher
       ═══════════════════════════════════════════ */
    .tabs {
      display: flex;
      background: var(--bg-primary);
      border-bottom: 1px solid var(--border-subtle);
      overflow-x: auto;
      scrollbar-width: none;
      flex-shrink: 0;
    }

    .tabs::-webkit-scrollbar { display: none; }

    .tab {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 9px 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-muted);
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }

    .tab:hover {
      color: var(--text-secondary);
      background: var(--bg-secondary);
    }

    .tab.active {
      color: var(--text-primary);
      border-bottom-color: var(--accent-green);
      background: var(--bg-secondary);
    }

    .tab-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
    }

    .tab-dot.running { background: var(--accent-green); }
    .tab-dot.idle { background: var(--accent-yellow); }
    .tab-dot.exited { background: var(--accent-red); }
    .tab-dot.starting {
      background: var(--accent-yellow);
      animation: blink 1s infinite;
    }

    .tab-add {
      padding: 9px 12px;
      font-size: 14px;
      color: var(--text-muted);
      background: transparent;
      border: none;
      cursor: pointer;
      transition: color 0.12s;
    }

    .tab-add:hover {
      color: var(--accent-green);
    }

    /* ═══════════════════════════════════════════
       TERMINAL AREA
       ═══════════════════════════════════════════ */
    .terminal-area {
      flex: 1;
      position: relative;
      overflow: hidden;
      min-height: 0;
      margin-bottom: var(--bottom-height, 120px);
    }

    .terminal-view {
      position: absolute;
      inset: 0;
      display: none;
      background: var(--bg-primary);
      overflow: hidden;
      cursor: text;
    }

    .terminal-view.active { display: block; }

    .terminal-view .xterm {
      height: 100%;
      padding: 6px;
    }

    .terminal-view .xterm-viewport {
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: var(--border-hover) transparent;
    }

    .terminal-view .xterm-viewport::-webkit-scrollbar { width: 5px; }
    .terminal-view .xterm-viewport::-webkit-scrollbar-track { background: transparent; }
    .terminal-view .xterm-viewport::-webkit-scrollbar-thumb {
      background: var(--border-hover);
      border-radius: 3px;
    }

    /* Scroll nav - floating pills */
    .scroll-nav {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 3px;
      z-index: 10;
      opacity: 0.5;
      transition: opacity 0.15s;
    }

    .scroll-nav:hover { opacity: 0.9; }

    .scroll-pill {
      width: 28px;
      height: 28px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      border-radius: 6px;
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.1s;
    }

    .scroll-pill:active {
      background: var(--bg-hover);
      transform: scale(0.95);
    }

    /* ═══════════════════════════════════════════
       BOTTOM PANEL - Compact controls
       ═══════════════════════════════════════════ */
    .bottom-panel {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 20;
      background: var(--bg-primary);
      border-top: 1px solid var(--border-subtle);
      transition: transform 0.15s ease-out;
    }

    /* Shortcut Row - Compact pills */
    .shortcut-row {
      display: flex;
      gap: 4px;
      padding: 6px 8px;
      background: var(--bg-secondary);
      overflow-x: auto;
      scrollbar-width: none;
    }

    .shortcut-row::-webkit-scrollbar { display: none; }

    .key-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 500;
      padding: 6px 8px;
      min-width: 32px;
      background: var(--bg-elevated);
      color: var(--text-secondary);
      border: 1px solid var(--border-default);
      border-radius: 5px;
      cursor: pointer;
      white-space: nowrap;
      text-align: center;
      transition: all 0.1s;
      flex-shrink: 0;
    }

    .key-pill:active {
      background: var(--bg-hover);
      transform: scale(0.96);
    }

    .key-pill.active {
      background: var(--text-primary);
      color: var(--bg-primary);
      border-color: var(--text-primary);
    }

    /* Key group separators */
    .key-sep {
      width: 1px;
      background: var(--border-default);
      margin: 0 2px;
      flex-shrink: 0;
    }

    /* Special key styles */
    .key-pill.key-ctrl {
      color: var(--accent-blue);
      border-color: var(--accent-blue);
    }

    .key-pill.key-danger {
      color: var(--accent-red);
      border-color: transparent;
    }

    .key-pill.key-action {
      background: var(--accent-green);
      color: var(--bg-primary);
      border-color: var(--accent-green);
      font-weight: 600;
    }

    .key-pill.key-action:active {
      background: var(--accent-green-dim);
    }

    .key-pill.key-run {
      padding: 10px 16px;
      font-size: 14px;
    }

    .key-pill.key-run:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .key-pill.key-copy {
      background: var(--accent-blue);
      color: white;
      border-color: var(--accent-blue);
    }

    .key-pill.key-copy.copied {
      background: var(--accent-green);
      border-color: var(--accent-green);
    }

    .key-pill.key-paste {
      background: var(--accent-purple);
      color: white;
      border-color: var(--accent-purple);
    }

    .key-pill.key-link {
      background: var(--bg-elevated);
      color: var(--text-secondary);
      border-color: var(--border-default);
    }

    .key-pill.key-link:hover {
      border-color: var(--border-hover);
    }

    .key-pill.key-image {
      background: var(--bg-elevated);
      color: var(--text-secondary);
      border-color: var(--border-default);
    }

    .key-pill.key-image:hover {
      border-color: var(--border-hover);
    }

    /* Input Row */
    .input-row {
      display: flex;
      gap: 6px;
      padding: 6px 8px;
      background: var(--bg-primary);
    }

    .cmd-input {
      flex: 1;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      padding: 10px 12px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border-default);
      border-radius: 6px;
      outline: none;
      transition: border-color 0.12s;
    }

    .cmd-input:focus {
      border-color: var(--accent-green);
    }

    .cmd-input:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .cmd-input::placeholder {
      color: var(--text-muted);
    }

    /* Control Row */
    .control-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 8px 8px;
      background: var(--bg-primary);
    }

    .mode-toggle {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 600;
      padding: 7px 12px;
      background: var(--bg-secondary);
      color: var(--text-muted);
      border: 1px solid var(--border-default);
      border-radius: 5px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      transition: all 0.12s;
    }

    .mode-toggle.active {
      background: var(--accent-green);
      color: var(--bg-primary);
      border-color: var(--accent-green);
    }

    .kill-btn {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 600;
      padding: 7px 12px;
      background: transparent;
      color: var(--accent-red);
      border: 1px solid var(--accent-red);
      border-radius: 5px;
      cursor: pointer;
      letter-spacing: 0.3px;
      transition: all 0.12s;
    }

    .kill-btn:active {
      background: var(--accent-red);
      color: white;
    }

    /* ═══════════════════════════════════════════
       MODALS
       ═══════════════════════════════════════════ */
    .modal-bg {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 20px;
      backdrop-filter: blur(4px);
    }

    .modal-bg.show { display: flex; }

    .modal-box {
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      border-radius: 12px;
      padding: 20px;
      max-width: 340px;
      width: 100%;
      animation: modalIn 0.15s ease-out;
    }

    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }

    .modal-box h3 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text-primary);
    }

    .modal-box p {
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 18px;
      line-height: 1.5;
    }

    .modal-actions {
      display: flex;
      gap: 10px;
    }

    .modal-btn {
      flex: 1;
      padding: 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 500;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.1s;
    }

    .modal-btn:active {
      transform: scale(0.98);
    }

    .modal-btn.secondary {
      background: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border-default);
    }

    .modal-btn.primary {
      background: var(--text-primary);
      color: var(--bg-primary);
    }

    .modal-btn.danger {
      background: var(--accent-red);
      color: white;
    }

    .modal-input {
      width: 100%;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      padding: 12px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius);
      outline: none;
      margin-bottom: 16px;
      transition: border-color 0.15s ease;
    }

    .modal-input:focus {
      border-color: var(--accent-green);
    }

    .modal-input::placeholder {
      color: var(--text-muted);
    }

    .modal-path-container,
    .modal-url-container {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }

    .modal-path {
      flex: 1;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 8px 10px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      border-radius: 6px;
      color: var(--text-secondary);
      word-break: break-all;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .modal-btn-small {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 500;
      padding: 6px 10px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border-default);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
      flex-shrink: 0;
    }

    .modal-btn-small:active {
      transform: scale(0.96);
    }

    .modal-warning {
      font-size: 11px;
      color: var(--accent-yellow);
      background: rgba(251, 191, 36, 0.1);
      padding: 8px 10px;
      border-radius: 6px;
      margin-bottom: 12px;
    }

    /* ═══════════════════════════════════════════
       TOAST & HINTS
       ═══════════════════════════════════════════ */
    .toast {
      position: fixed;
      bottom: 140px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-elevated);
      color: var(--text-primary);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
      z-index: 50;
      border: 1px solid var(--border-default);
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }

    .toast.show { opacity: 1; }

    .ro-hint {
      position: fixed;
      bottom: 140px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--accent-yellow);
      color: var(--bg-primary);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
      z-index: 50;
    }

    .ro-hint.show { opacity: 1; }
  </style>
</head>
<body>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <div class="brand">
        <span class="brand-icon">>_</span>
        <span class="brand-name">MConnect</span>
      </div>
      <div class="status-group">
        <div class="conn-status">
          <div class="conn-dot" id="connDot"></div>
          <span class="conn-label" id="connLabel">Connecting</span>
        </div>
        <span class="term-size" id="termSize">--x--</span>
      </div>
    </header>

    <!-- Tabs -->
    <nav class="tabs" id="tabs">
      <button class="tab-add" id="tabAdd" title="New shell">+</button>
    </nav>

    <!-- Terminal Area -->
    <main class="terminal-area" id="terminalArea">
      <!-- Terminal views injected here -->
    </main>

    <!-- Scroll Nav -->
    <div class="scroll-nav" id="scrollNav">
      <button class="scroll-pill" onclick="scrollTerm('top')" title="Top">⤒</button>
      <button class="scroll-pill" onclick="scrollTerm('up')" title="Up">↑</button>
      <button class="scroll-pill" onclick="scrollTerm('down')" title="Down">↓</button>
      <button class="scroll-pill" onclick="scrollTerm('bottom')" title="Bottom">⤓</button>
    </div>

    <!-- Bottom Panel -->
    <div class="bottom-panel" id="bottomPanel">
      <!-- Shortcut Row -->
      <div class="shortcut-row">
        <button class="key-pill key-copy" id="copyBtn" onclick="doCopy()">Copy</button>
        <button class="key-pill key-paste" id="pasteBtn" onclick="doPaste()">Paste</button>
        <button class="key-pill" onclick="sendBS()">⌫</button>
        <div class="key-sep"></div>
        <button class="key-pill key-ctrl" id="ctrlKey" onclick="toggleCtrl()">Ctrl</button>
        <button class="key-pill" onclick="sendKey('Tab')">Tab</button>
        <button class="key-pill" onclick="sendKey('ShiftTab')">⇧Tab</button>
        <button class="key-pill" onclick="sendKey('Escape')">Esc</button>
        <div class="key-sep"></div>
        <button class="key-pill" onclick="sendCtrl('c')">^C</button>
        <button class="key-pill" onclick="sendCtrl('d')">^D</button>
        <button class="key-pill" onclick="sendCtrl('f')">^F</button>
        <button class="key-pill" onclick="sendCtrl('l')">^L</button>
        <div class="key-sep"></div>
        <button class="key-pill" onclick="sendKey('ArrowUp')">↑</button>
        <button class="key-pill" onclick="sendKey('ArrowDown')">↓</button>
        <button class="key-pill" onclick="sendKey('ArrowLeft')">←</button>
        <button class="key-pill" onclick="sendKey('ArrowRight')">→</button>
        <div class="key-sep"></div>
        <button class="key-pill key-link" onclick="showLinkModal()">Link</button>
        <button class="key-pill key-image" onclick="triggerImageUpload()">Img</button>
        <input type="file" id="imageInput" accept="image/*" style="display:none" onchange="handleImageUpload(event)">
      </div>

      <!-- Input Row -->
      <div class="input-row">
        <input
          type="text"
          class="cmd-input"
          id="cmdInput"
          placeholder="$ command..."
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          disabled
        >
        <button class="key-pill key-action key-run" id="runBtn" onclick="sendEnter()">↵</button>
      </div>

      <!-- Control Row -->
      <div class="control-row">
        <button class="mode-toggle" id="modeBtn" onclick="toggleMode()">Read-Only</button>
        <button class="kill-btn" onclick="showKillModal()">KILL ^C</button>
      </div>
    </div>
  </div>

  <!-- Mode Modal -->
  <div class="modal-bg" id="modeModal">
    <div class="modal-box">
      <h3>Enable Input Mode?</h3>
      <p>This allows sending commands to the terminal. Use with caution.</p>
      <div class="modal-actions">
        <button class="modal-btn secondary" onclick="hideModeModal()">Cancel</button>
        <button class="modal-btn primary" onclick="confirmMode()">Enable</button>
      </div>
    </div>
  </div>

  <!-- Kill Modal -->
  <div class="modal-bg" id="killModal">
    <div class="modal-box">
      <h3>Send SIGINT?</h3>
      <p>This interrupts the current process (like pressing ^C).</p>
      <div class="modal-actions">
        <button class="modal-btn secondary" onclick="hideKillModal()">Cancel</button>
        <button class="modal-btn danger" onclick="confirmKill()">Kill</button>
      </div>
    </div>
  </div>

  <!-- Link Modal -->
  <div class="modal-bg" id="linkModal">
    <div class="modal-box">
      <h3>Insert Link</h3>
      <p>Paste a URL to insert into the command input.</p>
      <input
        type="url"
        id="linkInput"
        class="modal-input"
        placeholder="https://example.com/..."
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
      >
      <div class="modal-actions">
        <button class="modal-btn secondary" onclick="hideLinkModal()">Cancel</button>
        <button class="modal-btn primary" onclick="insertLink()">Insert</button>
      </div>
    </div>
  </div>

  <!-- Image Uploaded Modal -->
  <div class="modal-bg" id="imageModal">
    <div class="modal-box">
      <h3>Image Uploaded</h3>
      <p id="imageModalText">Image saved successfully.</p>
      <div class="modal-path-container">
        <code id="imageModalPath" class="modal-path"></code>
        <button class="modal-btn-small" onclick="copyImagePath()">Copy</button>
      </div>
      <div class="modal-url-container" id="imageUrlContainer" style="display:none">
        <code id="imageModalUrl" class="modal-path"></code>
        <button class="modal-btn-small" onclick="copyImageUrl()">Copy</button>
      </div>
      <div class="modal-warning" id="imageWarning" style="display:none"></div>
      <div class="modal-actions">
        <button class="modal-btn primary" onclick="hideImageModal()">Done</button>
      </div>
    </div>
  </div>

  <!-- Toast & Hint -->
  <div class="toast" id="toast"></div>
  <div class="ro-hint" id="roHint">Enable input mode first</div>

  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-web-links@0.9.0/lib/xterm-addon-web-links.min.js"></script>
  <script>
    // ═══════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════
    const token = '${token}';
    const sessionId = '${sessionId}';
    let ws = null;
    let isReadOnly = ${isReadOnly};
    let ctrlPressed = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    // Agent management
    const agents = new Map();
    let activeAgentId = null;

    // DOM refs
    const $ = id => document.getElementById(id);
    const cmdInput = $('cmdInput');
    const runBtn = $('runBtn');
    const ctrlKey = $('ctrlKey');
    const tabs = $('tabs');
    const terminalArea = $('terminalArea');
    const tabAdd = $('tabAdd');
    const termSize = $('termSize');
    const bottomPanel = $('bottomPanel');

    // ═══════════════════════════════════════════
    // VIEWPORT HEIGHT FIX (Mobile Safari/Chrome)
    // ═══════════════════════════════════════════
    let initialViewportHeight = window.innerHeight;
    let keyboardVisible = false;

    function updateViewportHeight() {
      const vh = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--app-height', vh + 'px');
    }

    function updatePanelPosition() {
      if (window.visualViewport) {
        const offset = window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop;
        bottomPanel.style.bottom = Math.max(0, offset) + 'px';
      } else {
        bottomPanel.style.bottom = '0px';
      }
    }

    // Initial setup
    updateViewportHeight();
    updatePanelPosition();
    initialViewportHeight = window.visualViewport?.height || window.innerHeight;

    // Listen for viewport changes (keyboard show/hide)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        const currentHeight = window.visualViewport.height;
        const heightDiff = initialViewportHeight - currentHeight;

        const wasKeyboardVisible = keyboardVisible;
        keyboardVisible = heightDiff > 200;

        updatePanelPosition();

        if (wasKeyboardVisible && !keyboardVisible) {
          updateViewportHeight();
          debouncedRefitAll();
        }

        if (!wasKeyboardVisible && keyboardVisible && activeAgentId) {
          const agent = agents.get(activeAgentId);
          if (agent && agent.terminal.buffer.active.type !== 'alternate') {
            agent.terminal.scrollToBottom();
          }
        }
      });

      window.visualViewport.addEventListener('scroll', updatePanelPosition);
    }

    window.addEventListener('resize', () => {
      if (!keyboardVisible) {
        updateViewportHeight();
        updatePanelPosition();
        initialViewportHeight = window.visualViewport?.height || window.innerHeight;
        debouncedRefitAll();
      }
    });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        updateViewportHeight();
        updatePanelPosition();
        initialViewportHeight = window.visualViewport?.height || window.innerHeight;
        debouncedRefitAll();
      }, 100);
    });

    // ═══════════════════════════════════════════
    // TOUCH SCROLL HANDLER
    // ═══════════════════════════════════════════
    class TouchScrollHandler {
      constructor(terminal, sendData) {
        this.terminal = terminal;
        this.sendData = sendData;
        this.touchStartY = 0;
        this.touchStartX = 0;
        this.lastTouchY = 0;
        this.velocity = 0;
        this.lastMoveTime = 0;
        // Thresholds for scrolling
        this.scrollThreshold = 10; // Lower = more responsive for normal buffer
        this.arrowThreshold = 40;  // Higher = less flickering for TUI apps
        this.element = terminal.element;
        this.isScrolling = false;
        this.momentumId = null;
        // Debounce TUI arrow keys to prevent flooding
        this.lastArrowSent = 0;
        this.arrowDebounce = 80; // ms between arrow key sends

        this.bindEvents();
      }

      isInAlternateBuffer() {
        try {
          return this.terminal.buffer.active.type === 'alternate';
        } catch (e) {
          return false;
        }
      }

      bindEvents() {
        this.element.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.element.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.element.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true });
        // Also support mouse wheel for desktop testing
        this.element.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
      }

      onTouchStart(e) {
        // Cancel any ongoing momentum scrolling
        if (this.momentumId) {
          cancelAnimationFrame(this.momentumId);
          this.momentumId = null;
        }

        if (e.touches.length === 1) {
          this.touchStartY = e.touches[0].clientY;
          this.touchStartX = e.touches[0].clientX;
          this.lastTouchY = this.touchStartY;
          this.lastMoveTime = Date.now();
          this.velocity = 0;
          this.isScrolling = false;
        }
      }

      onTouchMove(e) {
        if (e.touches.length !== 1) return;

        const currentY = e.touches[0].clientY;
        const currentTime = Date.now();
        const deltaY = this.lastTouchY - currentY;
        const deltaTime = currentTime - this.lastMoveTime;
        const totalDeltaY = this.touchStartY - currentY;

        // Determine if this is a scroll gesture
        if (!this.isScrolling && Math.abs(totalDeltaY) > 8) {
          this.isScrolling = true;
        }

        if (!this.isScrolling) return;

        // Always prevent default to avoid page scroll
        e.preventDefault();

        // Calculate velocity for momentum
        if (deltaTime > 0) {
          this.velocity = deltaY / deltaTime;
        }

        // Check if in alternate buffer (TUI apps like vim, claude code)
        const isAltBuffer = this.isInAlternateBuffer();

        if (isAltBuffer) {
          // In TUI mode: send arrow keys for scrolling (debounced to prevent flickering)
          const now = Date.now();
          if (Math.abs(deltaY) > this.arrowThreshold && (now - this.lastArrowSent) > this.arrowDebounce) {
            const arrowKey = deltaY > 0 ? '\\x1b[A' : '\\x1b[B'; // Up or Down
            this.sendData(arrowKey);
            this.lastTouchY = currentY;
            this.lastMoveTime = currentTime;
            this.lastArrowSent = now;
          }
        } else {
          // Normal buffer: smooth scroll with lower threshold
          if (Math.abs(deltaY) > this.scrollThreshold) {
            const lines = Math.sign(deltaY) * Math.max(1, Math.floor(Math.abs(deltaY) / this.scrollThreshold));
            this.terminal.scrollLines(lines);
            this.lastTouchY = currentY;
            this.lastMoveTime = currentTime;
          }
        }
      }

      onTouchEnd(e) {
        // Apply momentum scrolling for normal buffer only
        const isAltBuffer = this.isInAlternateBuffer();

        if (!isAltBuffer && Math.abs(this.velocity) > 0.3) {
          this.applyMomentum();
        }

        // Keep isScrolling true briefly to prevent click-to-focus from triggering
        setTimeout(() => {
          this.isScrolling = false;
        }, 100);
      }

      applyMomentum() {
        const friction = 0.92;
        const minVelocity = 0.05;

        const step = () => {
          if (Math.abs(this.velocity) < minVelocity) {
            this.momentumId = null;
            return;
          }

          const lines = Math.sign(this.velocity) * Math.ceil(Math.abs(this.velocity) * 8);
          this.terminal.scrollLines(lines);
          this.velocity *= friction;
          this.momentumId = requestAnimationFrame(step);
        };

        this.momentumId = requestAnimationFrame(step);
      }

      onWheel(e) {
        // Handle mouse wheel for desktop
        const isAltBuffer = this.isInAlternateBuffer();

        if (isAltBuffer) {
          e.preventDefault();
          // Send arrow keys for TUI apps (debounced)
          const now = Date.now();
          if ((now - this.lastArrowSent) > this.arrowDebounce) {
            const arrowKey = e.deltaY > 0 ? '\\x1b[B' : '\\x1b[A';
            this.sendData(arrowKey);
            this.lastArrowSent = now;
          }
        }
        // For normal buffer, let xterm handle wheel scrolling natively
      }

      dispose() {
        if (this.momentumId) {
          cancelAnimationFrame(this.momentumId);
        }
        this.element.removeEventListener('touchstart', this.onTouchStart);
        this.element.removeEventListener('touchmove', this.onTouchMove);
        this.element.removeEventListener('touchend', this.onTouchEnd);
        this.element.removeEventListener('wheel', this.onWheel);
      }
    }

    // ═══════════════════════════════════════════
    // TERMINAL MANAGEMENT
    // ═══════════════════════════════════════════

    let refitTimeout = null;
    function debouncedRefitAll() {
      if (refitTimeout) clearTimeout(refitTimeout);
      refitTimeout = setTimeout(() => {
        agents.forEach((agent, id) => {
          try {
            agent.fitAddon.fit();
            sendResize(id, agent.terminal.cols, agent.terminal.rows);
            updateSizeDisplay(agent.terminal);
          } catch (e) {
            console.warn('Fit failed for agent', id, e);
          }
        });
      }, 100);
    }

    function updateSizeDisplay(terminal) {
      if (terminal) {
        termSize.textContent = terminal.cols + 'x' + terminal.rows;
      }
    }

    function createAgentTerminal(agentInfo) {
      const { id, config, status } = agentInfo;

      // LeCoder Design System theme
      const terminal = new Terminal({
        theme: {
          background: '#191919',
          foreground: '#e9e9e7',
          cursor: '#4ade80',
          cursorAccent: '#191919',
          selectionBackground: '#525252',
          selectionForeground: '#191919',
          black: '#2a2a2a',
          red: '#ef4444',
          green: '#4ade80',
          yellow: '#fbbf24',
          blue: '#60a5fa',
          magenta: '#a78bfa',
          cyan: '#22d3ee',
          white: '#e9e9e7',
        },
        fontSize: 13,
        fontFamily: "'JetBrains Mono', monospace",
        cursorBlink: true,
        cursorStyle: 'bar',
        allowProposedApi: true,
        scrollback: 10000,
        alternateScroll: true,
        smoothScrollDuration: 50,
      });

      const fitAddon = new FitAddon.FitAddon();
      const webLinksAddon = new WebLinksAddon.WebLinksAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      // Create tab using safe DOM methods
      const tabEl = document.createElement('button');
      tabEl.className = 'tab';
      tabEl.dataset.agentId = id;
      const dotSpan = document.createElement('span');
      dotSpan.className = 'tab-dot ' + status;
      const nameSpan = document.createElement('span');
      nameSpan.textContent = config.name;
      tabEl.appendChild(dotSpan);
      tabEl.appendChild(nameSpan);
      tabEl.onclick = () => switchToAgent(id);
      tabs.insertBefore(tabEl, tabAdd);

      // Create terminal view
      const viewEl = document.createElement('div');
      viewEl.className = 'terminal-view';
      viewEl.id = 'terminal-' + id;
      terminalArea.appendChild(viewEl);

      terminal.open(viewEl);

      requestAnimationFrame(() => {
        fitAddon.fit();
        let cols = Math.max(terminal.cols, 40);
        let rows = Math.max(terminal.rows, 10);
        if (terminal.cols < 40 || terminal.rows < 10) {
          terminal.resize(cols, rows);
        }
        sendResize(id, cols, rows);
        updateSizeDisplay(terminal);
      });

      terminal.onResize(({ cols, rows }) => {
        cols = Math.max(cols, 40);
        rows = Math.max(rows, 10);
        sendResize(id, cols, rows);
        updateSizeDisplay(terminal);
      });

      const touchHandler = new TouchScrollHandler(terminal, (data) => {
        sendTerminalData(id, data);
      });

      viewEl.addEventListener('click', (e) => {
        if (window.getSelection()?.toString()) return;
        if (touchHandler.isScrolling) return;
        if (!isReadOnly && !cmdInput.disabled) {
          cmdInput.focus();
        }
      });

      agents.set(id, { terminal, fitAddon, info: agentInfo, tabEl, viewEl, touchHandler });

      terminal.write(\`\\x1b[38;5;244m[\${config.name}]\\x1b[0m \\x1b[38;5;78m●\\x1b[0m connected\\r\\n\`);

      return id;
    }

    function switchToAgent(agentId) {
      if (!agents.has(agentId)) return;

      activeAgentId = agentId;

      document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.agentId === agentId);
      });

      document.querySelectorAll('.terminal-view').forEach(view => {
        view.classList.toggle('active', view.id === 'terminal-' + agentId);
      });

      const agent = agents.get(agentId);
      if (agent) {
        setTimeout(() => {
          agent.fitAddon.fit();
          sendResize(agentId, agent.terminal.cols, agent.terminal.rows);
          updateSizeDisplay(agent.terminal);
        }, 10);
      }

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'switch_agent', agentId }));
      }
    }

    function updateAgentStatus(agentId, status) {
      const agent = agents.get(agentId);
      if (agent) {
        agent.info.status = status;
        const dot = agent.tabEl.querySelector('.tab-dot');
        if (dot) dot.className = 'tab-dot ' + status;
      }
    }

    function removeAgent(agentId) {
      const agent = agents.get(agentId);
      if (agent) {
        agent.touchHandler?.dispose();
        agent.terminal.dispose();
        agent.tabEl.remove();
        agent.viewEl.remove();
        agents.delete(agentId);

        if (activeAgentId === agentId) {
          const remaining = Array.from(agents.keys());
          if (remaining.length > 0) switchToAgent(remaining[0]);
        }
      }
    }

    // ═══════════════════════════════════════════
    // RESIZE HANDLING
    // ═══════════════════════════════════════════

    function sendResize(agentId, cols, rows) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', agentId, cols, rows }));
      }
    }

    // ═══════════════════════════════════════════
    // SCROLL CONTROLS
    // ═══════════════════════════════════════════

    function scrollTerm(direction) {
      if (!activeAgentId) return;
      const agent = agents.get(activeAgentId);
      if (!agent) return;

      const terminal = agent.terminal;
      const isAltBuffer = terminal.buffer.active.type === 'alternate';

      function sendScrollKey(key) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', agentId: activeAgentId, data: key }));
        }
      }

      switch (direction) {
        case 'up':
          isAltBuffer ? sendScrollKey('\\x1b[A\\x1b[A\\x1b[A') : terminal.scrollLines(-5);
          break;
        case 'down':
          isAltBuffer ? sendScrollKey('\\x1b[B\\x1b[B\\x1b[B') : terminal.scrollLines(5);
          break;
        case 'top':
          isAltBuffer ? sendScrollKey('\\x1b[5~') : terminal.scrollToTop();
          break;
        case 'bottom':
          isAltBuffer ? sendScrollKey('\\x1b[6~') : terminal.scrollToBottom();
          break;
      }
    }

    // ═══════════════════════════════════════════
    // INPUT HANDLING
    // ═══════════════════════════════════════════

    cmdInput.addEventListener('keydown', (e) => {
      if (isReadOnly || !activeAgentId) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        runCmd();
        return;
      }

      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        sendTerminalData(activeAgentId, '\\x1b[Z');
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        sendTerminalData(activeAgentId, '\\t');
        return;
      }

      if (e.ctrlKey && e.key.length === 1) {
        e.preventDefault();
        const charCode = e.key.toLowerCase().charCodeAt(0) - 96;
        sendTerminalData(activeAgentId, String.fromCharCode(charCode));
        return;
      }
    });

    function runCmd() {
      if (isReadOnly || !activeAgentId) return;
      const command = cmdInput.value;
      sendTerminalData(activeAgentId, command ? command + '\\r' : '\\r');
      cmdInput.value = '';
      cmdInput.focus();
    }

    function sendTerminalData(agentId, data) {
      if (isReadOnly) {
        showROHint();
        return;
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'input',
          agentId,
          data
        }));
      }
    }

    // Key mappings
    const keyMap = {
      'Tab': '\\t',
      'ShiftTab': '\\x1b[Z',
      'Escape': '\\x1b',
      'ArrowUp': '\\x1b[A',
      'ArrowDown': '\\x1b[B',
      'ArrowRight': '\\x1b[C',
      'ArrowLeft': '\\x1b[D',
    };

    function sendKey(key) {
      if (!activeAgentId) return;
      if (isReadOnly) { showROHint(); return; }
      let data = keyMap[key] || '';
      if (ctrlPressed && key.length === 1) {
        data = String.fromCharCode(key.toLowerCase().charCodeAt(0) - 96);
        toggleCtrl();
      }
      if (data) sendTerminalData(activeAgentId, data);
    }

    function sendBS() {
      if (!activeAgentId) return;
      if (isReadOnly) { showROHint(); return; }
      sendTerminalData(activeAgentId, '\\x7f');
    }

    function sendEnter() {
      if (!activeAgentId) return;
      if (isReadOnly) { showROHint(); return; }
      cmdInput.value ? runCmd() : sendTerminalData(activeAgentId, '\\r');
    }

    function sendCtrl(key) {
      if (!activeAgentId) return;
      if (isReadOnly) { showROHint(); return; }
      const charCode = key.toLowerCase().charCodeAt(0) - 96;
      sendTerminalData(activeAgentId, String.fromCharCode(charCode));
    }

    function toggleCtrl() {
      ctrlPressed = !ctrlPressed;
      ctrlKey.classList.toggle('active', ctrlPressed);
    }

    // ═══════════════════════════════════════════
    // COPY/PASTE FUNCTIONALITY
    // ═══════════════════════════════════════════

    function getSelectionOrBuffer() {
      if (!activeAgentId) return '';
      const agent = agents.get(activeAgentId);
      if (!agent) return '';

      if (agent.terminal.hasSelection()) {
        return agent.terminal.getSelection();
      }

      // Fall back to visible buffer content
      const buffer = agent.terminal.buffer.active;
      const lines = [];
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) lines.push(line.translateToString(true));
      }
      return lines.join('\\n').trimEnd();
    }

    function showCopyFeedback() {
      const btn = $('copyBtn');
      btn.classList.add('copied');
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.textContent = 'Copy';
      }, 1500);
    }

    function fallbackCopy(text) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (success) {
          showCopyFeedback();
        } else {
          showToast('Copy failed - try selecting text manually');
        }
      } catch (err) {
        showToast('Copy not supported on this device');
      }
    }

    async function doCopy() {
      const text = getSelectionOrBuffer();
      if (!text) {
        showToast('Nothing to copy');
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        showCopyFeedback();
      } catch (err) {
        // Fallback for mobile/older browsers
        fallbackCopy(text);
      }
    }

    async function doPaste() {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          cmdInput.value += text;
          cmdInput.focus();
          showToast('Pasted to input');
        } else {
          showToast('Clipboard is empty');
        }
      } catch (err) {
        showToast('Paste not available - check permissions');
      }
    }

    // ═══════════════════════════════════════════
    // LINK MODAL
    // ═══════════════════════════════════════════

    function showLinkModal() {
      const modal = $('linkModal');
      const input = $('linkInput');
      modal.classList.add('show');
      input.value = '';
      setTimeout(() => input.focus(), 100);
    }

    function hideLinkModal() {
      $('linkModal').classList.remove('show');
    }

    function insertLink() {
      const input = $('linkInput');
      const url = input.value.trim();
      if (url) {
        cmdInput.value += url;
        cmdInput.focus();
        showToast('URL inserted');
      }
      hideLinkModal();
    }

    // Handle Enter key in link modal
    $('linkInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        insertLink();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideLinkModal();
      }
    });

    // ═══════════════════════════════════════════
    // IMAGE UPLOAD
    // ═══════════════════════════════════════════

    let lastImagePath = '';
    let lastImageUrl = '';

    function triggerImageUpload() {
      $('imageInput').click();
    }

    async function handleImageUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      // Validate size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showToast('Image too large (max 10MB)');
        event.target.value = '';
        return;
      }

      // Read as base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'file_upload',
            filename: file.name,
            mimeType: file.type,
            data: base64
          }));
          showToast('Uploading image...');
        } else {
          showToast('Not connected - cannot upload');
        }
      };
      reader.onerror = () => {
        showToast('Failed to read image');
      };
      reader.readAsDataURL(file);

      // Reset input for re-upload
      event.target.value = '';
    }

    function showImageModal(path, url, warning) {
      lastImagePath = path;
      lastImageUrl = url || '';

      $('imageModalPath').textContent = path;

      if (url) {
        $('imageModalUrl').textContent = url;
        $('imageUrlContainer').style.display = 'flex';
      } else {
        $('imageUrlContainer').style.display = 'none';
      }

      if (warning) {
        $('imageWarning').textContent = warning;
        $('imageWarning').style.display = 'block';
      } else {
        $('imageWarning').style.display = 'none';
      }

      $('imageModal').classList.add('show');
    }

    function hideImageModal() {
      $('imageModal').classList.remove('show');
    }

    async function copyImagePath() {
      try {
        await navigator.clipboard.writeText(lastImagePath);
        showToast('Path copied!');
      } catch (err) {
        fallbackCopy(lastImagePath);
      }
    }

    async function copyImageUrl() {
      try {
        await navigator.clipboard.writeText(lastImageUrl);
        showToast('URL copied!');
      } catch (err) {
        fallbackCopy(lastImageUrl);
      }
    }

    // ═══════════════════════════════════════════
    // UI HELPERS
    // ═══════════════════════════════════════════

    function showToast(msg) {
      const t = $('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2000);
    }

    function showROHint() {
      const h = $('roHint');
      h.classList.add('show');
      setTimeout(() => h.classList.remove('show'), 2000);
    }

    // ═══════════════════════════════════════════
    // WEBSOCKET CONNECTION
    // ═══════════════════════════════════════════

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + window.location.host + '?token=' + token;
      setConnStatus('connecting', 'Connecting');
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        reconnectAttempts = 0;
        setConnStatus('connected', 'Connected');
      };

      ws.onmessage = (event) => {
        try {
          handleMessage(JSON.parse(event.data));
        } catch (e) {
          console.error('Parse error:', e);
        }
      };

      ws.onclose = (event) => {
        setConnStatus('offline', 'Offline');
        if (event.code === 4001) return;
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          setTimeout(connect, Math.min(1000 * Math.pow(2, reconnectAttempts), 10000));
        }
      };

      ws.onerror = () => setConnStatus('offline', 'Error');
    }

    function handleMessage(message) {
      switch (message.type) {
        case 'output':
          const agent = agents.get(message.agentId);
          if (agent) agent.terminal.write(message.data);
          break;

        case 'session_info':
          isReadOnly = message.isReadOnly;
          updateModeUI();
          message.agents.forEach(agentInfo => {
            if (!agents.has(agentInfo.id)) createAgentTerminal(agentInfo);
          });
          if (message.agents.length > 0 && !activeAgentId) {
            switchToAgent(message.agents[0].id);
          }
          break;

        case 'agent_created':
          createAgentTerminal(message.agent);
          switchToAgent(message.agent.id);
          break;

        case 'agent_status':
          updateAgentStatus(message.agentId, message.status);
          break;

        case 'agent_exited':
          updateAgentStatus(message.agentId, 'exited');
          const exitAgent = agents.get(message.agentId);
          if (exitAgent) {
            exitAgent.terminal.write(\`\\r\\n\\x1b[38;5;214m[exit]\\x1b[0m code \${message.exitCode}\\r\\n\`);
          }
          break;

        case 'agent_list':
          message.agents.forEach(agentInfo => {
            if (!agents.has(agentInfo.id)) createAgentTerminal(agentInfo);
          });
          break;

        case 'mode_changed':
          isReadOnly = message.isReadOnly;
          updateModeUI();
          break;

        case 'command_blocked':
          const blockedAgent = agents.get(message.agentId);
          if (blockedAgent) {
            blockedAgent.terminal.write(\`\\r\\n\\x1b[38;5;203m[blocked]\\x1b[0m \${message.reason}\\r\\n\`);
          }
          break;

        case 'error':
          showError(message.message);
          break;

        case 'pong':
          break;

        case 'file_uploaded':
          // Image/file upload response
          const { path: filePath, url, filename, warning } = message;
          showImageModal(filePath, url, warning);
          // Auto-copy path to clipboard
          navigator.clipboard.writeText(filePath).catch(() => {});
          break;

        case 'file_upload_error':
          showToast('Upload failed: ' + (message.error || 'Unknown error'));
          break;
      }
    }

    function setConnStatus(status, text) {
      const dot = $('connDot');
      dot.className = 'conn-dot';
      if (status === 'offline') dot.classList.add('offline');
      if (status === 'connecting') dot.classList.add('connecting');
      $('connLabel').textContent = text;
    }

    function updateModeUI() {
      const btn = $('modeBtn');
      if (isReadOnly) {
        btn.textContent = 'Read-Only';
        btn.classList.remove('active');
        cmdInput.disabled = true;
        runBtn.disabled = true;
        cmdInput.placeholder = '$ enable input...';
      } else {
        btn.textContent = 'Input';
        btn.classList.add('active');
        cmdInput.disabled = false;
        runBtn.disabled = false;
        cmdInput.placeholder = '$ command...';
        cmdInput.focus();
      }
    }

    function toggleMode() {
      if (isReadOnly) {
        $('modeModal').classList.add('show');
      } else {
        sendModeChange(true);
      }
    }

    function hideModeModal() {
      $('modeModal').classList.remove('show');
    }

    function confirmMode() {
      hideModeModal();
      sendModeChange(false);
    }

    function sendModeChange(readOnly) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'mode_change', readOnly }));
      }
    }

    function showKillModal() {
      $('killModal').classList.add('show');
    }

    function hideKillModal() {
      $('killModal').classList.remove('show');
    }

    function confirmKill() {
      hideKillModal();
      if (activeAgentId && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'kill_agent', agentId: activeAgentId }));
      }
    }

    function showError(message) {
      console.error('[MConnect]', message);
      showToast('Error: ' + message);
    }

    // Keepalive
    setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    // Add new shell tab
    tabAdd.onclick = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        const shellName = 'Shell ' + (agents.size + 1);
        ws.send(JSON.stringify({
          type: 'create_agent',
          config: {
            type: 'shell',
            name: shellName,
          }
        }));
      }
    };

    // Calculate actual bottom panel height and set CSS variable
    function measureBottomHeight() {
      if (bottomPanel) {
        const height = bottomPanel.offsetHeight;
        document.documentElement.style.setProperty('--bottom-height', height + 'px');
      }
    }

    // Init
    updateModeUI();
    measureBottomHeight();
    connect();
  </script>
</body>
</html>`;
}
