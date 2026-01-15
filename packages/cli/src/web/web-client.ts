/**
 * Web Client v2 for MConnect v0.1.2
 *
 * Multi-agent tab-based terminal interface.
 * Supports multiple AI agents with individual terminal views.
 *
 * FIXES IMPLEMENTED:
 * 1. Terminal resize propagation to PTY (critical for TUI apps)
 * 2. Mobile touch scrolling with alternate buffer detection
 * 3. Real-time input for shell/TUI apps (they handle their own echo)
 * 4. VisualViewport API for mobile keyboard handling
 * 5. Proper terminal.onResize event handling
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
      --border: #27272A;
      --border-light: #3F3F46;
      --text: #FAFAFA;
      --text-muted: #A1A1AA;
      --text-dim: #71717A;
      --accent: #FAFAFA;
      --success: #22C55E;
      --warning: #EAB308;
      --danger: #EF4444;
      --agent-research: #3B82F6;
      --agent-spec: #8B5CF6;
      --agent-tests: #10B981;
      --agent-shell: #F59E0B;
      --app-height: 100vh;
      --bottom-bars-height: 152px; /* shortcut(~48) + input(~56) + control(~48) */
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
      height: 100%;
      height: var(--app-height);
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
      width: 6px;
      height: 6px;
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
      color: var(--text-dim);
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

    .agent-tabs::-webkit-scrollbar {
      display: none;
    }

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
      /* Bottom margin to reserve space for fixed bottom bars */
      margin-bottom: var(--bottom-bars-height, 152px);
    }

    .terminal-view {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      /* Leave extra space at bottom so TUI status bars are visible above our bottom bars */
      bottom: 0;
      display: none;
      background: var(--void);
      overflow: hidden;
      cursor: text; /* Show text cursor to indicate clickable for typing */
    }

    .terminal-view.active {
      display: block;
    }

    .terminal-view .xterm {
      height: 100%;
      padding: 4px;
    }

    /* CRITICAL: Enable native xterm.js scrolling */
    .terminal-view .xterm-viewport {
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: var(--border-light) transparent;
    }

    .terminal-view .xterm-viewport::-webkit-scrollbar {
      width: 6px;
    }

    .terminal-view .xterm-viewport::-webkit-scrollbar-track {
      background: transparent;
    }

    .terminal-view .xterm-viewport::-webkit-scrollbar-thumb {
      background: var(--border-light);
      border-radius: 3px;
    }

    /* Scroll Controls */
    .scroll-controls {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 10;
      opacity: 0.6;
    }

    .scroll-controls:hover {
      opacity: 1;
    }

    .scroll-btn {
      width: 32px;
      height: 32px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text-muted);
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .scroll-btn:active {
      background: var(--border);
    }

    /* Bottom Bars Container - Fixed at bottom */
    .bottom-bars {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 20;
      background: var(--void);
      transition: transform 0.15s ease-out;
    }

    /* Shortcut Bar */
    .shortcut-bar {
      display: flex;
      gap: 4px;
      padding: 8px;
      background: var(--surface);
      border-top: 1px solid var(--border);
      overflow-x: auto;
      flex-shrink: 0;
    }

    .shortcut-btn {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 8px 12px;
      background: var(--void);
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 4px;
      cursor: pointer;
      white-space: nowrap;
    }

    .shortcut-btn:active {
      background: var(--border);
    }

    .shortcut-btn.active {
      background: var(--text);
      color: var(--void);
    }

    .shortcut-btn.enter-btn {
      background: var(--success);
      color: var(--void);
      border-color: var(--success);
      font-weight: 600;
    }

    .shortcut-btn.enter-btn:active {
      background: #16A34A;
    }

    .shortcut-btn.copy-btn {
      background: var(--agent-research);
      color: white;
      border-color: var(--agent-research);
    }

    .shortcut-btn.copy-btn:active {
      background: #2563EB;
    }

    .shortcut-btn.copy-btn.copied {
      background: var(--success);
      border-color: var(--success);
    }

    .shortcut-btn.delete-btn {
      background: var(--warning);
      color: var(--void);
      border-color: var(--warning);
      font-size: 14px;
    }

    .shortcut-btn.delete-btn:active {
      background: #CA8A04;
    }

    /* Input Bar */
    .input-bar {
      display: flex;
      gap: 8px;
      padding: 8px;
      background: var(--void);
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }

    .input-field {
      flex: 1;
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      padding: 12px;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      outline: none;
    }

    .input-field:focus {
      border-color: var(--text-dim);
    }

    .input-field:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .send-btn {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 600;
      padding: 12px 20px;
      background: var(--text);
      color: var(--void);
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }

    .send-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    /* Control Bar */
    .control-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      background: var(--void);
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }

    .mode-btn {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      padding: 10px 16px;
      background: var(--surface);
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 6px;
      cursor: pointer;
      text-transform: uppercase;
    }

    .mode-btn.active {
      background: var(--success);
      color: var(--void);
      border-color: var(--success);
    }

    .kill-btn {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      padding: 10px 16px;
      background: transparent;
      color: var(--danger);
      border: 1px solid var(--danger);
      border-radius: 6px;
      cursor: pointer;
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 20px;
    }

    .modal-overlay.show {
      display: flex;
    }

    .modal {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 100%;
    }

    .modal h3 {
      font-size: 16px;
      margin-bottom: 12px;
    }

    .modal p {
      font-size: 14px;
      color: var(--text-muted);
      margin-bottom: 20px;
    }

    .modal-buttons {
      display: flex;
      gap: 12px;
    }

    .modal-btn {
      flex: 1;
      padding: 12px;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 500;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }

    .modal-btn.cancel {
      background: var(--void);
      color: var(--text);
      border: 1px solid var(--border);
    }

    .modal-btn.confirm {
      background: var(--text);
      color: var(--void);
    }

    .modal-btn.danger {
      background: var(--danger);
      color: white;
    }

    /* Agent Color Badges */
    .agent-badge {
      display: inline-block;
      width: 4px;
      height: 100%;
      border-radius: 2px;
    }

    /* Readonly Hint */
    .readonly-hint {
      position: fixed;
      bottom: 120px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--surface);
      color: var(--text-muted);
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
      z-index: 50;
    }

    .readonly-hint.show {
      opacity: 1;
    }

    /* Toast notification */
    .toast {
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

    .toast.show {
      opacity: 1;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo">
        <span>>_<</span>
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
      <!-- Tabs will be dynamically added -->
      <button class="add-agent-btn" id="addAgentBtn" title="Add Agent">+</button>
    </div>

    <!-- Terminal Views -->
    <div class="terminals-container" id="terminalsContainer">
      <!-- Terminal views will be dynamically added -->
    </div>

    <!-- Scroll Controls (floating) -->
    <div class="scroll-controls" id="scrollControls">
      <button class="scroll-btn" onclick="scrollTerminal('top')" title="Scroll to top">\u2912</button>
      <button class="scroll-btn" onclick="scrollTerminal('up')" title="Scroll up">\u2191</button>
      <button class="scroll-btn" onclick="scrollTerminal('down')" title="Scroll down">\u2193</button>
      <button class="scroll-btn" onclick="scrollTerminal('bottom')" title="Scroll to bottom">\u2913</button>
    </div>

    <!-- Bottom Bars (Fixed at bottom) -->
    <div class="bottom-bars" id="bottomBars">
      <!-- Shortcut Bar -->
      <div class="shortcut-bar">
        <button class="shortcut-btn copy-btn" id="copyBtn" onclick="copySelection()">Copy</button>
        <button class="shortcut-btn delete-btn" onclick="sendBackspace()">\u232B</button>
        <button class="shortcut-btn" id="ctrlBtn" onclick="toggleCtrl()">Ctrl</button>
        <button class="shortcut-btn" onclick="sendKey('Tab')">Tab</button>
        <button class="shortcut-btn" onclick="sendKey('Escape')">Esc</button>
        <button class="shortcut-btn" onclick="sendKey('ArrowUp')">\u2191</button>
        <button class="shortcut-btn" onclick="sendKey('ArrowDown')">\u2193</button>
      </div>

      <!-- Input Bar -->
      <div class="input-bar">
        <input
          type="text"
          class="input-field"
          id="inputField"
          placeholder="$ type command..."
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          disabled
        >
        <button class="shortcut-btn enter-btn" onclick="sendEnter()" style="padding: 12px 16px;">Enter</button>
        <button class="send-btn" id="sendBtn" onclick="sendInput()" disabled>Run</button>
      </div>

      <!-- Control Bar -->
      <div class="control-bar">
        <button class="mode-btn" id="modeToggle" onclick="toggleMode()">Read-Only</button>
        <button class="kill-btn" id="killBtn" onclick="showKillModal()">KILL ^C</button>
      </div>
    </div>
  </div>

  <!-- Mode Change Modal -->
  <div class="modal-overlay" id="modeModal">
    <div class="modal">
      <h3>Enable Input Mode</h3>
      <p>This allows you to send commands to the agent. Make sure you know what you're doing.</p>
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
      <p>This will send SIGINT (^C) to the current agent. Use this to interrupt long-running operations.</p>
      <div class="modal-buttons">
        <button class="modal-btn cancel" onclick="hideKillModal()">Cancel</button>
        <button class="modal-btn danger" onclick="confirmKill()">Kill</button>
      </div>
    </div>
  </div>

  <!-- Readonly Hint -->
  <div class="readonly-hint" id="readonlyHint">Enable input mode to type</div>

  <!-- Toast -->
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
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    // Agent management
    const agents = new Map(); // agentId -> { terminal, fitAddon, info, touchHandler }
    let activeAgentId = null;

    // DOM elements
    const inputField = document.getElementById('inputField');
    const sendBtn = document.getElementById('sendBtn');
    const ctrlBtn = document.getElementById('ctrlBtn');
    const agentTabs = document.getElementById('agentTabs');
    const terminalsContainer = document.getElementById('terminalsContainer');
    const addAgentBtn = document.getElementById('addAgentBtn');
    const terminalSizeEl = document.getElementById('terminalSize');
    const bottomBars = document.getElementById('bottomBars');

    // ============================================
    // VIEWPORT HEIGHT FIX (Mobile Safari/Chrome)
    // ============================================
    let initialViewportHeight = window.innerHeight;
    let keyboardVisible = false;

    function updateViewportHeight() {
      const vh = window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight;
      document.documentElement.style.setProperty('--app-height', vh + 'px');
    }

    function updateBottomBarsPosition() {
      // Position bottom bars at the actual visual viewport bottom
      // This keeps the input bar visible just above the keyboard
      if (window.visualViewport) {
        const viewportBottom = window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop;
        bottomBars.style.bottom = Math.max(0, viewportBottom) + 'px';
      } else {
        bottomBars.style.bottom = '0px';
      }
    }

    // Initial setup
    updateViewportHeight();
    updateBottomBarsPosition();
    initialViewportHeight = window.visualViewport?.height || window.innerHeight;

    // Listen for viewport changes (keyboard show/hide)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        const currentHeight = window.visualViewport.height;
        const heightDiff = initialViewportHeight - currentHeight;

        // Detect keyboard show/hide (keyboard typically > 200px)
        const wasKeyboardVisible = keyboardVisible;
        keyboardVisible = heightDiff > 200;

        // Always update bottom bars position to stay above keyboard
        updateBottomBarsPosition();

        // DON'T resize terminal when keyboard shows - this keeps content stable
        // Only resize when keyboard hides (going back to full screen)
        if (wasKeyboardVisible && !keyboardVisible) {
          // Keyboard was hidden - safe to resize
          updateViewportHeight();
          debouncedRefitAll();
        }

        // When keyboard shows, scroll terminal to bottom so user sees latest content
        if (!wasKeyboardVisible && keyboardVisible) {
          if (activeAgentId) {
            const agent = agents.get(activeAgentId);
            if (agent && agent.terminal.buffer.active.type !== 'alternate') {
              agent.terminal.scrollToBottom();
            }
          }
        }
      });

      // Also listen for scroll events on visualViewport (iOS Safari)
      window.visualViewport.addEventListener('scroll', () => {
        updateBottomBarsPosition();
      });
    }

    window.addEventListener('resize', () => {
      // Only resize if not keyboard-related
      if (!keyboardVisible) {
        updateViewportHeight();
        updateBottomBarsPosition();
        initialViewportHeight = window.visualViewport?.height || window.innerHeight;
        debouncedRefitAll();
      }
    });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        updateViewportHeight();
        updateBottomBarsPosition();
        initialViewportHeight = window.visualViewport?.height || window.innerHeight;
        debouncedRefitAll();
      }, 100);
    });

    // ============================================
    // TOUCH SCROLL HANDLER
    // ============================================
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

    // ============================================
    // TERMINAL MANAGEMENT
    // ============================================

    // Debounced refit all terminals
    let refitTimeout = null;
    function debouncedRefitAll() {
      if (refitTimeout) clearTimeout(refitTimeout);
      refitTimeout = setTimeout(() => {
        agents.forEach((agent, id) => {
          try {
            agent.fitAddon.fit();
            // Send resize after fit
            sendResize(id, agent.terminal.cols, agent.terminal.rows);
            updateTerminalSizeDisplay(agent.terminal);
          } catch (e) {
            console.warn('Fit failed for agent', id, e);
          }
        });
      }, 100);
    }

    function updateTerminalSizeDisplay(terminal) {
      if (terminal) {
        terminalSizeEl.textContent = terminal.cols + 'x' + terminal.rows;
      }
    }

    // Create terminal for an agent
    function createAgentTerminal(agentInfo) {
      const { id, config, status } = agentInfo;

      // Create terminal with proper options for TUI support
      const terminal = new Terminal({
        theme: {
          background: '#09090B',
          foreground: '#FAFAFA',
          cursor: '#FAFAFA',
          cursorAccent: '#09090B',
          selectionBackground: '#3F3F46',
          black: '#27272A',
          red: '#EF4444',
          green: '#22C55E',
          yellow: '#EAB308',
          blue: '#3B82F6',
          magenta: '#8B5CF6',
          cyan: '#06B6D4',
          white: '#FAFAFA',
        },
        fontSize: 13,
        fontFamily: "'JetBrains Mono', monospace",
        cursorBlink: true,
        cursorStyle: 'block',
        allowProposedApi: true,
        scrollback: 10000,
        // CRITICAL for TUI apps: translate wheel to arrow keys in alternate buffer
        alternateScroll: true,
        smoothScrollDuration: 50,
      });

      const fitAddon = new FitAddon.FitAddon();
      const webLinksAddon = new WebLinksAddon.WebLinksAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      // Create DOM elements
      const tabEl = document.createElement('button');
      tabEl.className = 'agent-tab';
      tabEl.dataset.agentId = id;
      tabEl.innerHTML = \`
        <span class="dot \${status}"></span>
        <span>\${config.name}</span>
      \`;
      tabEl.onclick = () => switchToAgent(id);
      agentTabs.insertBefore(tabEl, addAgentBtn);

      const viewEl = document.createElement('div');
      viewEl.className = 'terminal-view';
      viewEl.id = 'terminal-' + id;
      terminalsContainer.appendChild(viewEl);

      terminal.open(viewEl);

      // Wait for DOM to settle, then fit with minimum size enforcement
      requestAnimationFrame(() => {
        fitAddon.fit();

        // Enforce minimum terminal size for TUI app compatibility
        let cols = Math.max(terminal.cols, 40);
        let rows = Math.max(terminal.rows, 10);

        // If terminal calculated smaller than minimum, manually resize
        if (terminal.cols < 40 || terminal.rows < 10) {
          terminal.resize(cols, rows);
        }

        // CRITICAL: Send initial resize to PTY immediately after fit
        sendResize(id, cols, rows);
        updateTerminalSizeDisplay(terminal);
        console.log('[Terminal] Initial size:', cols, 'x', rows, 'for agent', id);
      });

      // CRITICAL: Handle terminal.onResize event - sync size with PTY
      terminal.onResize(({ cols, rows }) => {
        // Enforce minimum size
        cols = Math.max(cols, 40);
        rows = Math.max(rows, 10);
        console.log('[Terminal] Resize event:', cols, 'x', rows, 'for agent', id);
        sendResize(id, cols, rows);
        updateTerminalSizeDisplay(terminal);
      });

      // Setup touch scroll handler
      const touchHandler = new TouchScrollHandler(terminal, (data) => {
        sendTerminalData(id, data);
      });

      // CRITICAL: Click on terminal focuses input field for immediate typing
      viewEl.addEventListener('click', (e) => {
        // Don't focus if user is selecting text
        if (window.getSelection()?.toString()) return;
        // Don't focus if touch is scrolling
        if (touchHandler.isScrolling) return;
        // Focus input field if not in read-only mode
        if (!isReadOnly && !inputField.disabled) {
          inputField.focus();
        }
      });

      // Store agent data
      agents.set(id, {
        terminal,
        fitAddon,
        info: agentInfo,
        tabEl,
        viewEl,
        touchHandler,
      });

      // Welcome message
      terminal.write(\`\\x1b[90m[\${config.name}]\\x1b[0m Connected (\\x1b[32m\${terminal.cols}x\${terminal.rows}\\x1b[0m)\\r\\n\`);

      return id;
    }

    // Switch to agent tab
    function switchToAgent(agentId) {
      if (!agents.has(agentId)) return;

      // Update active state
      activeAgentId = agentId;

      // Update tab styles
      document.querySelectorAll('.agent-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.agentId === agentId);
      });

      // Update terminal visibility
      document.querySelectorAll('.terminal-view').forEach(view => {
        view.classList.toggle('active', view.id === 'terminal-' + agentId);
      });

      // Fit terminal and send resize
      const agent = agents.get(agentId);
      if (agent) {
        setTimeout(() => {
          agent.fitAddon.fit();
          sendResize(agentId, agent.terminal.cols, agent.terminal.rows);
          updateTerminalSizeDisplay(agent.terminal);
        }, 10);
      }

      // Notify server
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'switch_agent', agentId }));
      }
    }

    // Update agent status
    function updateAgentStatus(agentId, status) {
      const agent = agents.get(agentId);
      if (agent) {
        agent.info.status = status;
        const dot = agent.tabEl.querySelector('.dot');
        dot.className = 'dot ' + status;
      }
    }

    // Remove agent
    function removeAgent(agentId) {
      const agent = agents.get(agentId);
      if (agent) {
        agent.touchHandler?.dispose();
        agent.terminal.dispose();
        agent.tabEl.remove();
        agent.viewEl.remove();
        agents.delete(agentId);

        // Switch to another agent if this was active
        if (activeAgentId === agentId) {
          const remaining = Array.from(agents.keys());
          if (remaining.length > 0) {
            switchToAgent(remaining[0]);
          }
        }
      }
    }

    // ============================================
    // RESIZE HANDLING
    // ============================================

    // Send resize to server - CRITICAL for TUI apps
    function sendResize(agentId, cols, rows) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('[WS] Sending resize:', cols, 'x', rows, 'for agent', agentId);
        ws.send(JSON.stringify({
          type: 'resize',
          agentId,
          cols,
          rows
        }));
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

      // For TUI apps, we need to send keys even in read-only mode
      // because scrolling doesn't modify anything - it's viewing
      function sendScrollKey(key) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'input',
            agentId: activeAgentId,
            data: key
          }));
        }
      }

      switch (direction) {
        case 'up':
          if (isAltBuffer) {
            // Send multiple arrow keys for faster scrolling
            sendScrollKey('\\x1b[A\\x1b[A\\x1b[A');
          } else {
            terminal.scrollLines(-5);
          }
          break;
        case 'down':
          if (isAltBuffer) {
            sendScrollKey('\\x1b[B\\x1b[B\\x1b[B');
          } else {
            terminal.scrollLines(5);
          }
          break;
        case 'top':
          if (isAltBuffer) {
            // Send Page Up or gg (vim-like navigation)
            sendScrollKey('\\x1b[5~'); // Page Up
          } else {
            terminal.scrollToTop();
          }
          break;
        case 'bottom':
          if (isAltBuffer) {
            // Send Page Down or G (vim-like navigation)
            sendScrollKey('\\x1b[6~'); // Page Down
          } else {
            terminal.scrollToBottom();
          }
          break;
      }
    }

    // ============================================
    // INPUT HANDLING
    // ============================================

    // Handle keydown for special keys
    inputField.addEventListener('keydown', (e) => {
      if (isReadOnly) return;
      if (!activeAgentId) return;

      // Send command on Enter
      if (e.key === 'Enter') {
        e.preventDefault();
        sendInput();
        return;
      }

      // Tab completion - send immediately
      if (e.key === 'Tab') {
        e.preventDefault();
        sendTerminalData(activeAgentId, '\\t');
        return;
      }

      // Handle Ctrl+ combinations (send immediately)
      if (e.ctrlKey && e.key.length === 1) {
        e.preventDefault();
        const charCode = e.key.toLowerCase().charCodeAt(0) - 96;
        sendTerminalData(activeAgentId, String.fromCharCode(charCode));
        return;
      }
    });

    // Send the complete command from input field
    function sendInput() {
      if (isReadOnly || !activeAgentId) return;
      const command = inputField.value;
      if (command) {
        // Send command + carriage return
        sendTerminalData(activeAgentId, command + '\\r');
      } else {
        // Just send Enter if empty
        sendTerminalData(activeAgentId, '\\r');
      }
      inputField.value = '';
      inputField.focus();
    }

    function sendTerminalData(agentId, data) {
      if (isReadOnly) {
        showReadonlyHint();
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

    // Key mappings for shortcut buttons
    const keyMap = {
      'Tab': '\\t',
      'Escape': '\\x1b',
      'ArrowUp': '\\x1b[A',
      'ArrowDown': '\\x1b[B',
      'ArrowRight': '\\x1b[C',
      'ArrowLeft': '\\x1b[D',
    };

    function sendKey(key) {
      if (!activeAgentId) return;
      if (isReadOnly) { showReadonlyHint(); return; }
      let data = keyMap[key] || '';
      if (ctrlPressed && key.length === 1) {
        data = String.fromCharCode(key.toLowerCase().charCodeAt(0) - 96);
        toggleCtrl();
      }
      if (data) sendTerminalData(activeAgentId, data);
    }

    function sendBackspace() {
      if (!activeAgentId) return;
      if (isReadOnly) { showReadonlyHint(); return; }
      // Send backspace character (ASCII 127 or \\x7f)
      sendTerminalData(activeAgentId, '\\x7f');
    }

    function sendEnter() {
      if (!activeAgentId) return;
      if (isReadOnly) { showReadonlyHint(); return; }
      // If input field has content, send it
      if (inputField.value) {
        sendInput();
      } else {
        sendTerminalData(activeAgentId, '\\r');
      }
    }

    function sendCtrlKey(key) {
      if (!activeAgentId) return;
      if (isReadOnly) { showReadonlyHint(); return; }
      const charCode = key.toLowerCase().charCodeAt(0) - 96;
      sendTerminalData(activeAgentId, String.fromCharCode(charCode));
    }

    function toggleCtrl() {
      ctrlPressed = !ctrlPressed;
      ctrlBtn.classList.toggle('active', ctrlPressed);
    }

    // ============================================
    // COPY FUNCTIONALITY
    // ============================================

    async function copySelection() {
      if (!activeAgentId) return;
      const agent = agents.get(activeAgentId);
      if (!agent) return;

      let text = '';

      // Try to get selection first
      if (agent.terminal.hasSelection()) {
        text = agent.terminal.getSelection();
      } else {
        // Copy all visible buffer content
        const buffer = agent.terminal.buffer.active;
        const lines = [];
        for (let i = 0; i < buffer.length; i++) {
          const line = buffer.getLine(i);
          if (line) {
            lines.push(line.translateToString(true));
          }
        }
        text = lines.join('\\n').trimEnd();
      }

      if (!text) {
        showToast('Nothing to copy');
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        const copyBtn = document.getElementById('copyBtn');
        copyBtn.classList.add('copied');
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.textContent = 'Copy';
        }, 1500);
      } catch (err) {
        showToast('Failed to copy');
      }
    }

    // ============================================
    // UI HELPERS
    // ============================================

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
    // WEBSOCKET CONNECTION
    // ============================================

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + window.location.host + '?token=' + token;
      updateStatus('connecting', 'Connecting');
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        reconnectAttempts = 0;
        updateStatus('connected', 'Connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (e) {
          console.error('Parse error:', e);
        }
      };

      ws.onclose = (event) => {
        updateStatus('disconnected', 'Offline');
        if (event.code === 4001) return;
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
          setTimeout(connect, delay);
        }
      };

      ws.onerror = () => updateStatus('disconnected', 'Error');
    }

    function handleMessage(message) {
      switch (message.type) {
        case 'output':
          const agent = agents.get(message.agentId);
          if (agent) {
            agent.terminal.write(message.data);
          }
          break;

        case 'session_info':
          isReadOnly = message.isReadOnly;
          updateModeUI();
          // Create terminals for existing agents
          message.agents.forEach(agentInfo => {
            if (!agents.has(agentInfo.id)) {
              createAgentTerminal(agentInfo);
            }
          });
          // Activate first agent
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
            exitAgent.terminal.write(\`\\r\\n\\x1b[33m[exit]\\x1b[0m code \${message.exitCode}\\r\\n\`);
          }
          break;

        case 'agent_list':
          message.agents.forEach(agentInfo => {
            if (!agents.has(agentInfo.id)) {
              createAgentTerminal(agentInfo);
            }
          });
          break;

        case 'mode_changed':
          isReadOnly = message.isReadOnly;
          updateModeUI();
          break;

        case 'command_blocked':
          const blockedAgent = agents.get(message.agentId);
          if (blockedAgent) {
            blockedAgent.terminal.write(\`\\r\\n\\x1b[31m[blocked]\\x1b[0m \${message.reason}\\r\\n\`);
          }
          break;

        case 'error':
          showError(message.message);
          break;

        case 'pong':
          break;
      }
    }

    function updateStatus(status, text) {
      document.getElementById('statusDot').className = 'status-dot ' + status;
      document.getElementById('statusText').textContent = text;
    }

    function updateModeUI() {
      const btn = document.getElementById('modeToggle');
      if (isReadOnly) {
        btn.textContent = 'Read-Only';
        btn.classList.remove('active');
        inputField.disabled = true;
        sendBtn.disabled = true;
        inputField.placeholder = '$ enable input mode...';
      } else {
        btn.textContent = 'Input';
        btn.classList.add('active');
        inputField.disabled = false;
        sendBtn.disabled = false;
        inputField.placeholder = '$ type command...';
        inputField.focus();
      }
    }

    function toggleMode() {
      if (isReadOnly) {
        document.getElementById('modeModal').classList.add('show');
      } else {
        sendModeChange(true);
      }
    }

    function hideModeModal() {
      document.getElementById('modeModal').classList.remove('show');
    }

    function confirmModeChange() {
      hideModeModal();
      sendModeChange(false);
    }

    function sendModeChange(readOnly) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'mode_change',
          readOnly: readOnly
        }));
      }
    }

    function showKillModal() {
      document.getElementById('killModal').classList.add('show');
    }

    function hideKillModal() {
      document.getElementById('killModal').classList.remove('show');
    }

    function confirmKill() {
      hideKillModal();
      if (activeAgentId && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'kill_agent',
          agentId: activeAgentId
        }));
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
    addAgentBtn.onclick = () => {
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

    // Calculate actual bottom bars height and set CSS variable
    function measureBottomBarsHeight() {
      if (bottomBars) {
        const height = bottomBars.offsetHeight;
        document.documentElement.style.setProperty('--bottom-bars-height', height + 'px');
      }
    }

    // Init
    updateModeUI();
    measureBottomBarsHeight();
    connect();
  </script>
</body>
</html>`;
}
