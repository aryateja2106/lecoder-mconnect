/**
 * Web Client v2.4 for MConnect v0.1.3
 *
 * UX OVERHAUL v2.4:
 * 1. Native terminal typing - tap terminal to type directly
 * 2. Hidden input overlay for Direct Mode keyboard capture
 * 3. Input bar hidden in Direct Mode (more screen space)
 * 4. Clearer Shift button label
 * 5. Larger delete key
 * 6. Improved scroll controls for TUI apps
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, interactive-widget=resizes-visual">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#09090B">
  <title>MConnect</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css">
  <style>
    :root {
      --void: #09090B;
      --surface: #18181B;
      --surface-hover: #27272A;
      --border: #333;
      --border-light: #444;
      --text: #e0e0e0;
      --text-muted: #888;
      --text-dim: #666;
      --success: #22C55E;
      --warning: #EAB308;
      --danger: #EF4444;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    html, body {
      height: 100dvh;
      background: var(--void);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--text);
      overflow: hidden;
      touch-action: manipulation;
      position: fixed;
      width: 100%;
    }

    .container {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      height: 100vh;
      height: 100dvh;
    }

    /* Header */
    .header {
      background: var(--void);
      padding: 8px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .logo {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 600;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
    }

    .status-dot.disconnected { background: var(--danger); }
    .status-dot.connecting {
      background: var(--warning);
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .status-text {
      font-size: 10px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
    }

    .terminal-size {
      font-size: 9px;
      color: var(--text-dim);
      font-family: 'JetBrains Mono', monospace;
      margin-left: 8px;
    }

    /* Agent Tabs */
    .agent-tabs {
      display: flex;
      background: var(--void);
      border-bottom: 1px solid var(--border);
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      flex-shrink: 0;
    }

    .agent-tabs::-webkit-scrollbar { display: none; }

    .agent-tab {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-dim);
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }

    .agent-tab:hover {
      color: var(--text-muted);
      background: var(--surface);
    }

    .agent-tab.active {
      color: var(--text);
      border-bottom-color: var(--text);
      background: var(--surface);
    }

    .agent-tab .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .agent-tab .dot.running { background: var(--success); }
    .agent-tab .dot.idle { background: var(--warning); }
    .agent-tab .dot.exited { background: var(--danger); }
    .agent-tab .dot.starting {
      background: var(--warning);
      animation: pulse 1s infinite;
    }

    .add-agent-btn {
      padding: 10px 14px;
      font-size: 14px;
      color: var(--text-dim);
      background: transparent;
      border: none;
      cursor: pointer;
    }

    .add-agent-btn:hover {
      color: var(--text);
      background: var(--surface);
    }

    /* Terminal Container */
    .terminals-container {
      flex: 1;
      position: relative;
      overflow: hidden;
      min-height: 0;
    }

    .terminal-view {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: none;
      background: var(--void);
      overflow: hidden;
      cursor: text;
    }

    .terminal-view.active {
      display: block;
    }

    .terminal-view .xterm {
      height: 100%;
      padding: 4px;
    }

    /* Enable native xterm.js scrolling */
    .terminal-view .xterm-viewport {
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: var(--border-light) transparent;
    }

    .terminal-view .xterm-screen {
      /* Allow touch scrolling */
      touch-action: pan-y;
    }

    /* Hidden input for Direct Mode - captures keyboard on mobile */
    .direct-input-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 50px;
      z-index: 5;
      display: none;
    }

    .direct-input-overlay.active {
      display: block;
    }

    .direct-input {
      width: 100%;
      height: 100%;
      background: transparent;
      border: none;
      outline: none;
      color: transparent;
      caret-color: transparent;
      font-size: 16px; /* Prevents iOS zoom */
    }

    /* Typing indicator when direct mode active */
    .typing-indicator {
      position: absolute;
      bottom: 8px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 11px;
      color: var(--text-muted);
      display: none;
      z-index: 6;
    }

    .typing-indicator.show {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .typing-indicator .pulse {
      width: 8px;
      height: 8px;
      background: var(--success);
      border-radius: 50%;
      animation: pulse 1s infinite;
    }

    .terminal-view .xterm-viewport::-webkit-scrollbar { width: 6px; }
    .terminal-view .xterm-viewport::-webkit-scrollbar-track { background: transparent; }
    .terminal-view .xterm-viewport::-webkit-scrollbar-thumb {
      background: var(--border-light);
      border-radius: 3px;
    }

    /* Scroll Controls - floating in top-right */
    .scroll-controls {
      position: absolute;
      right: 8px;
      top: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 10;
      opacity: 0.7;
    }

    .scroll-controls:active { opacity: 1; }

    .scroll-row {
      display: flex;
      gap: 4px;
    }

    .scroll-btn {
      width: 36px;
      height: 36px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-muted);
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      -webkit-tap-highlight-color: transparent;
    }

    .scroll-btn:active {
      background: var(--surface-hover);
      border-color: var(--border-light);
    }

    /* Bottom Bars */
    .bottom-bars {
      flex-shrink: 0;
      background: var(--void);
      border-top: 1px solid var(--border);
    }

    /* Shortcut Bar */
    .shortcut-bar {
      display: flex;
      gap: 6px;
      padding: 8px;
      background: var(--surface);
      align-items: center;
      flex-wrap: wrap;
    }

    /* Button base */
    .btn {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 500;
      min-width: 44px;
      min-height: 44px;
      padding: 8px 12px;
      background: var(--void);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      cursor: pointer;
      white-space: nowrap;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.1s, border-color 0.1s;
    }

    .btn:active {
      background: var(--surface-hover);
      border-color: var(--border-light);
    }

    .btn.active {
      background: var(--text);
      color: var(--void);
      border-color: var(--text);
    }

    .btn.danger {
      border-color: var(--danger);
      color: var(--danger);
    }

    .btn.danger:active { background: rgba(239, 68, 68, 0.1); }

    .btn.small {
      min-width: 36px;
      min-height: 36px;
      padding: 6px 8px;
      font-size: 11px;
    }

    .spacer { flex: 1; }

    /* Input Bar - collapsible in direct mode */
    .input-bar {
      display: flex;
      gap: 8px;
      padding: 8px;
      background: var(--void);
      align-items: center;
      transition: max-height 0.2s, padding 0.2s, opacity 0.2s;
      max-height: 80px;
      overflow: hidden;
    }

    .input-bar.collapsed {
      max-height: 0;
      padding: 0 8px;
      opacity: 0;
      pointer-events: none;
    }

    .input-field {
      flex: 1;
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      padding: 12px;
      min-height: 44px;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      outline: none;
    }

    .input-field:focus { border-color: var(--border-light); }
    .input-field:disabled { opacity: 0.5; cursor: not-allowed; }
    .input-field::placeholder { color: var(--text-dim); }

    /* Control Bar */
    .control-bar {
      display: flex;
      gap: 6px;
      padding: 8px;
      background: var(--void);
      align-items: center;
    }

    /* Arrow Keys */
    .arrow-keys {
      display: flex;
      gap: 4px;
    }

    .arrow-keys .btn {
      min-width: 40px;
      padding: 8px;
    }

    /* Mode indicator badge */
    .mode-badge {
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--surface);
      color: var(--text-dim);
      margin-left: 4px;
    }

    .mode-badge.direct {
      background: var(--success);
      color: var(--void);
    }

    /* More Menu */
    .more-menu {
      position: fixed;
      bottom: 140px;
      right: 8px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 4px;
      display: none;
      flex-direction: column;
      gap: 2px;
      z-index: 100;
      min-width: 160px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }

    .more-menu.show { display: flex; }

    .more-menu .btn {
      width: 100%;
      justify-content: flex-start;
      gap: 10px;
      border: none;
      background: transparent;
      border-radius: 4px;
    }

    .more-menu .btn:hover { background: var(--surface-hover); }

    .more-menu-icon {
      width: 20px;
      text-align: center;
      font-size: 11px;
    }

    .menu-divider {
      height: 1px;
      background: var(--border);
      margin: 4px 0;
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 200;
      padding: 20px;
    }

    .modal-overlay.show { display: flex; }

    .modal {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 100%;
    }

    .modal h3 { font-size: 16px; margin-bottom: 12px; }
    .modal p { font-size: 14px; color: var(--text-muted); margin-bottom: 20px; }

    .modal-buttons { display: flex; gap: 12px; }

    .modal-btn {
      flex: 1;
      padding: 12px;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 500;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      min-height: 44px;
    }

    .modal-btn.cancel {
      background: var(--void);
      color: var(--text);
      border: 1px solid var(--border);
    }

    .modal-btn.confirm { background: var(--text); color: var(--void); }
    .modal-btn.danger { background: var(--danger); color: white; }

    /* Toast & Hints */
    .toast, .readonly-hint {
      position: fixed;
      bottom: 180px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--surface);
      color: var(--text);
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
      z-index: 50;
      border: 1px solid var(--border);
    }

    .toast.show, .readonly-hint.show { opacity: 1; }
    .readonly-hint { color: var(--text-muted); }

    /* Backdrop */
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 99;
      display: none;
    }

    .backdrop.show { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo">
        <span>&gt;_</span>
        <span>MConnect</span>
      </div>
      <div class="status">
        <div class="status-dot" id="statusDot"></div>
        <span class="status-text" id="statusText">Connecting</span>
        <span class="terminal-size" id="terminalSize"></span>
      </div>
    </div>

    <!-- Agent Tabs -->
    <div class="agent-tabs" id="agentTabs">
      <button class="add-agent-btn" id="addAgentBtn" title="Add Agent">+</button>
    </div>

    <!-- Terminal Views -->
    <div class="terminals-container" id="terminalsContainer">
      <div class="scroll-controls" id="scrollControls">
        <div class="scroll-row">
          <button class="scroll-btn" onclick="scrollTerminal('up')" title="Scroll Up">&#x2191;</button>
          <button class="scroll-btn" onclick="scrollTerminal('top')" title="Top">&#x21C8;</button>
        </div>
        <div class="scroll-row">
          <button class="scroll-btn" onclick="scrollTerminal('down')" title="Scroll Down">&#x2193;</button>
          <button class="scroll-btn" onclick="scrollTerminal('bottom')" title="Bottom">&#x21CA;</button>
        </div>
      </div>
      <!-- Hidden input for Direct Mode - captures mobile keyboard -->
      <div class="direct-input-overlay" id="directInputOverlay">
        <input
          type="text"
          class="direct-input"
          id="directInput"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          inputmode="text"
        >
      </div>
      <!-- Typing indicator -->
      <div class="typing-indicator" id="typingIndicator">
        <span class="pulse"></span>
        <span>Tap here to type</span>
      </div>
    </div>

    <!-- Bottom Bars -->
    <div class="bottom-bars" id="bottomBars">
      <!-- Row 1: Shortcut Bar -->
      <div class="shortcut-bar">
        <button class="btn" onclick="sendKey('Escape')" title="Escape">Esc</button>
        <button class="btn" id="ctrlBtn" onclick="toggleCtrl()" title="Control modifier">Ctrl</button>
        <button class="btn" id="shiftBtn" onclick="toggleShift()" title="Shift modifier">Shift</button>
        <button class="btn" onclick="sendTabKey()" title="Tab">Tab</button>
        <button class="btn" style="min-width: 52px; padding: 8px 14px;" onclick="sendBackspace()" title="Backspace">Del</button>
        <div class="spacer"></div>
        <button class="btn" id="copyBtn" onclick="copySelection()" title="Copy">Copy</button>
        <button class="btn" id="moreBtn" onclick="toggleMoreMenu()" title="More">&#x22EE;</button>
      </div>

      <!-- Row 2: Input Bar (collapsible in direct mode) -->
      <div class="input-bar" id="inputBar">
        <input
          type="text"
          class="input-field"
          id="inputField"
          placeholder="$ command..."
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          disabled
        >
        <button class="btn" onclick="sendEnter()" title="Send">&#x21B5;</button>
      </div>

      <!-- Row 3: Control Bar -->
      <div class="control-bar">
        <button class="btn" id="modeToggle" onclick="toggleMode()">READ-ONLY</button>
        <button class="btn small" id="directModeBtn" onclick="toggleDirectMode()" title="Direct typing mode">
          DIR<span class="mode-badge" id="directBadge">OFF</span>
        </button>
        <div class="spacer"></div>
        <div class="arrow-keys">
          <button class="btn" onclick="sendKey('ArrowLeft')">&#x2190;</button>
          <button class="btn" onclick="sendKey('ArrowUp')">&#x2191;</button>
          <button class="btn" onclick="sendKey('ArrowDown')">&#x2193;</button>
          <button class="btn" onclick="sendKey('ArrowRight')">&#x2192;</button>
        </div>
        <div class="spacer"></div>
        <button class="btn danger" onclick="sendCtrlC()" title="^C">^C</button>
      </div>
    </div>
  </div>

  <!-- More Menu -->
  <div class="more-menu" id="moreMenu">
    <button class="btn" onclick="pasteFromClipboard()">
      <span class="more-menu-icon">&#x1F4CB;</span> Paste
    </button>
    <button class="btn" onclick="sendCtrlF()">
      <span class="more-menu-icon">^F</span> Search
    </button>
    <div class="menu-divider"></div>
    <button class="btn" onclick="sendCtrlD()">
      <span class="more-menu-icon">^D</span> EOF
    </button>
    <button class="btn" onclick="sendCtrlZ()">
      <span class="more-menu-icon">^Z</span> Suspend
    </button>
    <button class="btn" onclick="sendCtrlL()">
      <span class="more-menu-icon">^L</span> Clear
    </button>
    <div class="menu-divider"></div>
    <button class="btn" onclick="showKillModal()">
      <span class="more-menu-icon" style="color: var(--danger);">&#x2715;</span> Kill Process
    </button>
  </div>

  <div class="backdrop" id="backdrop" onclick="closeMoreMenu()"></div>

  <!-- Mode Modal -->
  <div class="modal-overlay" id="modeModal">
    <div class="modal">
      <h3>Enable Input Mode</h3>
      <p>This allows you to send commands to the agent.</p>
      <div class="modal-buttons">
        <button class="modal-btn cancel" onclick="hideModeModal()">Cancel</button>
        <button class="modal-btn confirm" onclick="confirmModeChange()">Enable</button>
      </div>
    </div>
  </div>

  <!-- Kill Modal -->
  <div class="modal-overlay" id="killModal">
    <div class="modal">
      <h3>Kill Current Agent?</h3>
      <p>This will terminate the process. Use ^C for a gentler interrupt.</p>
      <div class="modal-buttons">
        <button class="modal-btn cancel" onclick="hideKillModal()">Cancel</button>
        <button class="modal-btn danger" onclick="confirmKill()">Kill</button>
      </div>
    </div>
  </div>

  <div class="readonly-hint" id="readonlyHint">Enable input mode to type</div>
  <div class="toast" id="toast"></div>

  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-web-links@0.9.0/lib/xterm-addon-web-links.min.js"></script>
  <script>
    // State
    const token = '${token}';
    const sessionId = '${sessionId}';
    let ws = null;
    let isReadOnly = ${isReadOnly};
    let ctrlPressed = false;
    let shiftPressed = false;
    let directMode = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    // Agent management
    const agents = new Map();
    let activeAgentId = null;

    // DOM elements
    const inputField = document.getElementById('inputField');
    const inputBar = document.getElementById('inputBar');
    const ctrlBtn = document.getElementById('ctrlBtn');
    const shiftBtn = document.getElementById('shiftBtn');
    const directModeBtn = document.getElementById('directModeBtn');
    const directBadge = document.getElementById('directBadge');
    const agentTabs = document.getElementById('agentTabs');
    const terminalsContainer = document.getElementById('terminalsContainer');
    const addAgentBtn = document.getElementById('addAgentBtn');
    const terminalSizeEl = document.getElementById('terminalSize');
    const moreMenu = document.getElementById('moreMenu');
    const backdrop = document.getElementById('backdrop');
    const directInput = document.getElementById('directInput');
    const directInputOverlay = document.getElementById('directInputOverlay');
    const typingIndicator = document.getElementById('typingIndicator');

    // ============================================
    // DIRECT MODE - Native terminal typing experience
    // Tap terminal → keyboard appears → type directly
    // ============================================
    function toggleDirectMode() {
      directMode = !directMode;
      directModeBtn.classList.toggle('active', directMode);
      directBadge.textContent = directMode ? 'ON' : 'OFF';
      directBadge.classList.toggle('direct', directMode);

      if (directMode) {
        // Hide input bar, show overlay
        inputBar.classList.add('collapsed');
        directInputOverlay.classList.add('active');
        typingIndicator.classList.add('show');
        showToast('Direct mode: tap terminal to type');
      } else {
        // Show input bar, hide overlay
        inputBar.classList.remove('collapsed');
        directInputOverlay.classList.remove('active');
        typingIndicator.classList.remove('show');
        directInput.blur();
        showToast('Buffer mode: type command, press Enter');
        if (!isReadOnly) inputField.focus();
      }
    }

    // Tap terminal to focus hidden input (opens keyboard on mobile)
    terminalsContainer.addEventListener('click', (e) => {
      if (!directMode || isReadOnly) return;
      // Don't focus if clicking scroll controls
      if (e.target.closest('.scroll-controls')) return;
      directInput.focus();
      typingIndicator.querySelector('span:last-child').textContent = 'Typing...';
    });

    // When direct input is focused, update indicator
    directInput.addEventListener('focus', () => {
      typingIndicator.querySelector('span:last-child').textContent = 'Typing...';
    });

    directInput.addEventListener('blur', () => {
      typingIndicator.querySelector('span:last-child').textContent = 'Tap here to type';
    });

    // Direct mode: send each character as it's typed
    directInput.addEventListener('input', (e) => {
      if (!directMode || isReadOnly || !activeAgentId) return;

      const data = e.data; // The character(s) inserted
      if (data) {
        sendTerminalData(activeAgentId, data);
      }
      // Clear immediately so it doesn't accumulate
      directInput.value = '';
    });

    // Handle special keys in direct input
    directInput.addEventListener('keydown', (e) => {
      if (!directMode || isReadOnly || !activeAgentId) return;

      // Enter
      if (e.key === 'Enter') {
        e.preventDefault();
        sendTerminalData(activeAgentId, '\\r');
        return;
      }

      // Backspace
      if (e.key === 'Backspace') {
        e.preventDefault();
        sendTerminalData(activeAgentId, '\\x7f');
        return;
      }

      // Tab
      if (e.key === 'Tab') {
        e.preventDefault();
        sendTerminalData(activeAgentId, e.shiftKey ? '\\x1b[Z' : '\\t');
        return;
      }

      // Arrow keys
      if (e.key === 'ArrowUp') { e.preventDefault(); sendTerminalData(activeAgentId, '\\x1b[A'); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); sendTerminalData(activeAgentId, '\\x1b[B'); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); sendTerminalData(activeAgentId, '\\x1b[D'); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); sendTerminalData(activeAgentId, '\\x1b[C'); return; }

      // Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        sendTerminalData(activeAgentId, '\\x1b');
        return;
      }
    });

    // Also handle compositionend for IME input (e.g., Chinese, Japanese)
    directInput.addEventListener('compositionend', (e) => {
      if (!directMode || isReadOnly || !activeAgentId) return;
      if (e.data) {
        sendTerminalData(activeAgentId, e.data);
      }
      directInput.value = '';
    });

    // ============================================
    // VIEWPORT HANDLING
    // ============================================
    let lastVisualViewportHeight = window.visualViewport?.height || window.innerHeight;

    function handleViewportChange() {
      if (!window.visualViewport) return;

      const currentHeight = window.visualViewport.height;
      const heightDiff = lastVisualViewportHeight - currentHeight;

      if (heightDiff > 150) {
        // Keyboard appeared - scroll to bottom
        if (activeAgentId) {
          const agent = agents.get(activeAgentId);
          if (agent && agent.terminal.buffer.active.type !== 'alternate') {
            setTimeout(() => agent.terminal.scrollToBottom(), 50);
          }
        }
      }

      if (heightDiff < -150) {
        debouncedRefitAll();
      }

      lastVisualViewportHeight = currentHeight;
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }

    window.addEventListener('resize', debouncedRefitAll);
    window.addEventListener('orientationchange', () => setTimeout(debouncedRefitAll, 100));

    // ============================================
    // TOUCH SCROLL HANDLER
    // Only handles TUI apps (alternate buffer) - normal buffer uses native xterm scroll
    // ============================================
    class TouchScrollHandler {
      constructor(terminal, sendData) {
        this.terminal = terminal;
        this.sendData = sendData;
        this.touchStartY = 0;
        this.lastTouchY = 0;
        this.element = terminal.element;
        this.isScrolling = false;
        this.lastArrowSent = 0;
        this.arrowDebounce = 100;
        this.arrowThreshold = 50;
        this.bindEvents();
      }

      isInAlternateBuffer() {
        try { return this.terminal.buffer.active.type === 'alternate'; }
        catch (e) { return false; }
      }

      bindEvents() {
        // Only intercept when in alternate buffer (TUI apps)
        this.element.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true });
        this.element.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.element.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true });
        this.element.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
      }

      onTouchStart(e) {
        if (e.touches.length === 1) {
          this.touchStartY = e.touches[0].clientY;
          this.lastTouchY = this.touchStartY;
          this.isScrolling = false;
        }
      }

      onTouchMove(e) {
        // Only handle alternate buffer (TUI apps like Claude Code, vim)
        // Let normal buffer use native xterm scrolling
        if (!this.isInAlternateBuffer()) return;

        if (e.touches.length !== 1) return;
        const currentY = e.touches[0].clientY;
        const deltaY = this.lastTouchY - currentY;
        const totalDeltaY = this.touchStartY - currentY;

        if (!this.isScrolling && Math.abs(totalDeltaY) > 15) {
          this.isScrolling = true;
        }

        if (!this.isScrolling) return;
        e.preventDefault();

        const now = Date.now();
        if (Math.abs(deltaY) > this.arrowThreshold && (now - this.lastArrowSent) > this.arrowDebounce) {
          // Swipe up = scroll up (show previous content) = send Up arrow
          // Swipe down = scroll down = send Down arrow
          this.sendData(deltaY > 0 ? '\\x1b[A' : '\\x1b[B');
          this.lastTouchY = currentY;
          this.lastArrowSent = now;
        }
      }

      onTouchEnd() {
        setTimeout(() => { this.isScrolling = false; }, 100);
      }

      onWheel(e) {
        // Only intercept wheel in alternate buffer
        if (this.isInAlternateBuffer()) {
          e.preventDefault();
          const now = Date.now();
          if ((now - this.lastArrowSent) > this.arrowDebounce) {
            this.sendData(e.deltaY > 0 ? '\\x1b[B' : '\\x1b[A');
            this.lastArrowSent = now;
          }
        }
      }

      dispose() {}
    }

    // ============================================
    // TERMINAL MANAGEMENT
    // ============================================
    let refitTimeout = null;
    function debouncedRefitAll() {
      if (refitTimeout) clearTimeout(refitTimeout);
      refitTimeout = setTimeout(() => {
        agents.forEach((agent, id) => {
          try {
            agent.fitAddon.fit();
            sendResize(id, agent.terminal.cols, agent.terminal.rows);
            updateTerminalSizeDisplay(agent.terminal);
          } catch (e) {}
        });
      }, 100);
    }

    function updateTerminalSizeDisplay(terminal) {
      if (terminal) terminalSizeEl.textContent = terminal.cols + 'x' + terminal.rows;
    }

    function createAgentTerminal(agentInfo) {
      const { id, config, status } = agentInfo;

      const terminal = new Terminal({
        theme: {
          background: '#09090B', foreground: '#FAFAFA', cursor: '#FAFAFA',
          cursorAccent: '#09090B', selectionBackground: '#3F3F46',
          black: '#27272A', red: '#EF4444', green: '#22C55E', yellow: '#EAB308',
          blue: '#3B82F6', magenta: '#8B5CF6', cyan: '#06B6D4', white: '#FAFAFA',
        },
        fontSize: 13,
        fontFamily: "'JetBrains Mono', monospace",
        cursorBlink: true,
        cursorStyle: 'block',
        allowProposedApi: true,
        scrollback: 10000,
        alternateScroll: true,
        smoothScrollDuration: 50,
      });

      const fitAddon = new FitAddon.FitAddon();
      const webLinksAddon = new WebLinksAddon.WebLinksAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      const tabEl = document.createElement('button');
      tabEl.className = 'agent-tab';
      tabEl.dataset.agentId = id;

      const dotSpan = document.createElement('span');
      dotSpan.className = 'dot ' + status;
      tabEl.appendChild(dotSpan);

      const nameSpan = document.createElement('span');
      nameSpan.textContent = config.name;
      tabEl.appendChild(nameSpan);

      tabEl.onclick = () => switchToAgent(id);
      agentTabs.insertBefore(tabEl, addAgentBtn);

      const viewEl = document.createElement('div');
      viewEl.className = 'terminal-view';
      viewEl.id = 'terminal-' + id;
      terminalsContainer.appendChild(viewEl);

      terminal.open(viewEl);

      requestAnimationFrame(() => {
        fitAddon.fit();
        let cols = Math.max(terminal.cols, 40);
        let rows = Math.max(terminal.rows, 10);
        if (terminal.cols < 40 || terminal.rows < 10) terminal.resize(cols, rows);
        sendResize(id, cols, rows);
        updateTerminalSizeDisplay(terminal);

        // Warp-style: scroll to bottom on init
        terminal.scrollToBottom();
      });

      terminal.onResize(({ cols, rows }) => {
        cols = Math.max(cols, 40);
        rows = Math.max(rows, 10);
        sendResize(id, cols, rows);
        updateTerminalSizeDisplay(terminal);
      });

      const touchHandler = new TouchScrollHandler(terminal, (data) => sendTerminalData(id, data));

      viewEl.addEventListener('click', (e) => {
        if (window.getSelection()?.toString()) return;
        if (touchHandler.isScrolling) return;
        if (!isReadOnly && !directMode && !inputField.disabled) inputField.focus();
      });

      agents.set(id, { terminal, fitAddon, info: agentInfo, tabEl, viewEl, touchHandler });
      terminal.write('\\x1b[90m[' + config.name + ']\\x1b[0m Connected (\\x1b[32m' + terminal.cols + 'x' + terminal.rows + '\\x1b[0m)\\r\\n');
      return id;
    }

    function switchToAgent(agentId) {
      if (!agents.has(agentId)) return;
      activeAgentId = agentId;

      document.querySelectorAll('.agent-tab').forEach(tab => {
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
          updateTerminalSizeDisplay(agent.terminal);
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
        const dot = agent.tabEl.querySelector('.dot');
        dot.className = 'dot ' + status;
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

    // ============================================
    // COMMUNICATION
    // ============================================
    function sendResize(agentId, cols, rows) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', agentId, cols, rows }));
      }
    }

    function sendTerminalData(agentId, data) {
      if (isReadOnly) { showReadonlyHint(); return; }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'terminal_input', agentId, data }));
      }
    }

    // ============================================
    // SCROLL CONTROLS
    // ============================================
    function scrollTerminal(direction) {
      if (!activeAgentId) return;
      const agent = agents.get(activeAgentId);
      if (!agent) return;

      const terminal = agent.terminal;
      const isAltBuffer = terminal.buffer.active.type === 'alternate';

      function sendKey(key) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'terminal_input', agentId: activeAgentId, data: key }));
        }
      }

      if (isAltBuffer) {
        // In TUI apps (Claude Code, vim, etc), send actual key inputs
        switch (direction) {
          case 'up': sendKey('\\x1b[A'); break;
          case 'down': sendKey('\\x1b[B'); break;
          case 'top': sendKey('\\x1b[5~'); break;  // Page Up
          case 'bottom': sendKey('\\x1b[6~'); break;  // Page Down
        }
      } else {
        // In normal buffer, use xterm's scroll
        switch (direction) {
          case 'up': terminal.scrollLines(-3); break;
          case 'down': terminal.scrollLines(3); break;
          case 'top': terminal.scrollToTop(); break;
          case 'bottom': terminal.scrollToBottom(); break;
        }
      }
    }

    // ============================================
    // INPUT HANDLING
    // ============================================
    inputField.addEventListener('keydown', (e) => {
      if (isReadOnly || !activeAgentId) return;

      if (e.key === 'Enter') { e.preventDefault(); sendInput(); return; }
      if (e.key === 'Tab') { e.preventDefault(); sendTerminalData(activeAgentId, e.shiftKey ? '\\x1b[Z' : '\\t'); return; }
      if (e.ctrlKey && e.key.length === 1) {
        e.preventDefault();
        sendTerminalData(activeAgentId, String.fromCharCode(e.key.toLowerCase().charCodeAt(0) - 96));
        return;
      }
    });

    function sendInput() {
      if (isReadOnly || !activeAgentId) return;
      const command = inputField.value;
      sendTerminalData(activeAgentId, command ? command + '\\r' : '\\r');
      inputField.value = '';
      inputField.focus();
    }

    const keyMap = {
      'Tab': '\\t', 'Escape': '\\x1b',
      'ArrowUp': '\\x1b[A', 'ArrowDown': '\\x1b[B',
      'ArrowRight': '\\x1b[C', 'ArrowLeft': '\\x1b[D',
    };

    function sendKey(key) {
      if (!activeAgentId) return;
      if (isReadOnly) { showReadonlyHint(); return; }

      let data = keyMap[key] || '';

      // Handle Ctrl modifier
      if (ctrlPressed && key.length === 1) {
        data = String.fromCharCode(key.toLowerCase().charCodeAt(0) - 96);
        toggleCtrl();
      }

      if (data) sendTerminalData(activeAgentId, data);
    }

    function sendTabKey() {
      if (!activeAgentId) return;
      if (isReadOnly) { showReadonlyHint(); return; }
      sendTerminalData(activeAgentId, shiftPressed ? '\\x1b[Z' : '\\t');
      if (shiftPressed) toggleShift();
    }

    function sendBackspace() {
      if (!activeAgentId || isReadOnly) { showReadonlyHint(); return; }
      sendTerminalData(activeAgentId, '\\x7f');
    }

    function sendEnter() {
      if (!activeAgentId || isReadOnly) { showReadonlyHint(); return; }
      if (inputField.value) sendInput();
      else sendTerminalData(activeAgentId, '\\r');
    }

    function sendCtrlC() {
      if (!activeAgentId) return;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'terminal_input', agentId: activeAgentId, data: '\\x03' }));
      }
      showToast('Sent ^C');
    }

    function sendCtrlD() {
      if (!activeAgentId || isReadOnly) { showReadonlyHint(); closeMoreMenu(); return; }
      sendTerminalData(activeAgentId, '\\x04');
      closeMoreMenu();
      showToast('Sent ^D');
    }

    function sendCtrlF() {
      if (!activeAgentId || isReadOnly) { showReadonlyHint(); closeMoreMenu(); return; }
      sendTerminalData(activeAgentId, '\\x06');
      closeMoreMenu();
      showToast('Sent ^F');
    }

    function sendCtrlZ() {
      if (!activeAgentId || isReadOnly) { showReadonlyHint(); closeMoreMenu(); return; }
      sendTerminalData(activeAgentId, '\\x1a');
      closeMoreMenu();
      showToast('Sent ^Z');
    }

    function sendCtrlL() {
      if (!activeAgentId || isReadOnly) { showReadonlyHint(); closeMoreMenu(); return; }
      sendTerminalData(activeAgentId, '\\x0c');
      closeMoreMenu();
      showToast('Sent ^L');
    }

    function toggleCtrl() {
      ctrlPressed = !ctrlPressed;
      ctrlBtn.classList.toggle('active', ctrlPressed);
      if (ctrlPressed && shiftPressed) toggleShift();
    }

    function toggleShift() {
      shiftPressed = !shiftPressed;
      shiftBtn.classList.toggle('active', shiftPressed);
      if (shiftPressed && ctrlPressed) toggleCtrl();
    }

    // ============================================
    // COPY/PASTE
    // ============================================
    async function copySelection() {
      if (!activeAgentId) return;
      const agent = agents.get(activeAgentId);
      if (!agent) return;

      let text = '';
      if (agent.terminal.hasSelection()) {
        text = agent.terminal.getSelection();
      } else {
        const buffer = agent.terminal.buffer.active;
        const lines = [];
        for (let i = 0; i < buffer.length; i++) {
          const line = buffer.getLine(i);
          if (line) lines.push(line.translateToString(true));
        }
        text = lines.join('\\n').trimEnd();
      }

      if (!text) { showToast('Nothing to copy'); return; }

      try {
        await navigator.clipboard.writeText(text);
        const copyBtn = document.getElementById('copyBtn');
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try { document.execCommand('copy'); showToast('Copied!'); }
        catch (e) { showToast('Failed to copy'); }
        document.body.removeChild(textArea);
      }
    }

    async function pasteFromClipboard() {
      if (!activeAgentId || isReadOnly) { showReadonlyHint(); closeMoreMenu(); return; }
      try {
        const text = await navigator.clipboard.readText();
        if (text) { sendTerminalData(activeAgentId, text); showToast('Pasted'); }
      } catch (err) { showToast('Paste not available'); }
      closeMoreMenu();
    }

    // ============================================
    // MENUS & MODALS
    // ============================================
    function toggleMoreMenu() {
      const isOpen = moreMenu.classList.contains('show');
      if (isOpen) closeMoreMenu();
      else { moreMenu.classList.add('show'); backdrop.classList.add('show'); }
    }

    function closeMoreMenu() {
      moreMenu.classList.remove('show');
      backdrop.classList.remove('show');
    }

    function showToast(message) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function showReadonlyHint() {
      const hint = document.getElementById('readonlyHint');
      hint.classList.add('show');
      setTimeout(() => hint.classList.remove('show'), 2000);
    }

    // ============================================
    // WEBSOCKET
    // ============================================
    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + window.location.host + '?token=' + token;
      updateStatus('connecting', 'Connecting');
      ws = new WebSocket(wsUrl);

      ws.onopen = () => { reconnectAttempts = 0; updateStatus('connected', 'Connected'); };

      ws.onmessage = (event) => {
        try { handleMessage(JSON.parse(event.data)); }
        catch (e) { console.error('Parse error:', e); }
      };

      ws.onclose = (event) => {
        updateStatus('disconnected', 'Offline');
        if (event.code === 4001) return;
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          setTimeout(connect, Math.min(1000 * Math.pow(2, reconnectAttempts), 10000));
        }
      };

      ws.onerror = () => updateStatus('disconnected', 'Error');
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
          if (message.agents.length > 0 && !activeAgentId) switchToAgent(message.agents[0].id);
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
          if (exitAgent) exitAgent.terminal.write('\\r\\n\\x1b[33m[exit]\\x1b[0m code ' + message.exitCode + '\\r\\n');
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
          if (blockedAgent) blockedAgent.terminal.write('\\r\\n\\x1b[31m[blocked]\\x1b[0m ' + message.reason + '\\r\\n');
          break;

        case 'error':
          showToast('Error: ' + message.message);
          break;

        case 'pong': break;
      }
    }

    function updateStatus(status, text) {
      document.getElementById('statusDot').className = 'status-dot ' + status;
      document.getElementById('statusText').textContent = text;
    }

    function updateModeUI() {
      const btn = document.getElementById('modeToggle');
      if (isReadOnly) {
        btn.textContent = 'READ-ONLY';
        btn.classList.remove('active');
        inputField.disabled = true;
        inputField.placeholder = '$ enable input...';
      } else {
        btn.textContent = 'INPUT';
        btn.classList.add('active');
        inputField.disabled = false;
        inputField.placeholder = '$ command...';
        if (!directMode) inputField.focus();
      }
    }

    function toggleMode() {
      if (isReadOnly) document.getElementById('modeModal').classList.add('show');
      else sendModeChange(true);
    }

    function hideModeModal() { document.getElementById('modeModal').classList.remove('show'); }

    function confirmModeChange() {
      hideModeModal();
      sendModeChange(false);
    }

    function sendModeChange(readOnly) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'mode_change', readOnly }));
      }
    }

    function showKillModal() {
      closeMoreMenu();
      document.getElementById('killModal').classList.add('show');
    }

    function hideKillModal() { document.getElementById('killModal').classList.remove('show'); }

    function confirmKill() {
      hideKillModal();
      if (activeAgentId && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'kill_agent', agentId: activeAgentId }));
      }
    }

    // Keepalive
    setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 30000);

    // Add shell
    addAgentBtn.onclick = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'create_agent',
          config: { type: 'shell', name: 'Shell ' + (agents.size + 1) }
        }));
      }
    };

    // Init
    updateModeUI();
    connect();
  </script>
</body>
</html>`;
}
