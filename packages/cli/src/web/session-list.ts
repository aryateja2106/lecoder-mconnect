/**
 * Session List UI for MConnect
 *
 * Home view showing active and previous sessions.
 * Mobile-first, dark theme matching the existing web client.
 */

import { VERSION } from '../version.js';

export function getSessionListHTML(token: string, currentSessionId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#09090B">
  <title>MConnect - Sessions</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --void: #09090B;
      --surface: #18181B;
      --surface-hover: #27272A;
      --border: #333;
      --text: #e0e0e0;
      --text-muted: #71717A;
      --text-dim: #52525B;
      --success: #22C55E;
      --accent: #22D3EE;
      --danger: #EF4444;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--void);
      color: var(--text);
      min-height: 100vh;
      min-height: 100dvh;
      -webkit-font-smoothing: antialiased;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      background: var(--void);
      z-index: 10;
    }

    .header-title {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .header-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--text-muted);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .status-dot.online { background: var(--success); }
    .status-dot.offline { background: var(--text-dim); }

    .content {
      padding: 20px;
      padding-bottom: 100px;
    }

    .section-header {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 12px;
      margin-top: 24px;
    }

    .section-header:first-child {
      margin-top: 0;
    }

    .session-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      text-decoration: none;
      display: block;
      color: inherit;
    }

    .session-card:hover {
      background: var(--surface-hover);
    }

    .session-card.current {
      border-color: var(--accent);
    }

    .session-card.dead {
      opacity: 0.6;
      cursor: default;
    }

    .session-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .session-name {
      font-size: 15px;
      font-weight: 500;
    }

    .session-badge {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 6px;
    }

    .session-badge.online {
      color: var(--success);
      background: rgba(34, 197, 94, 0.1);
    }

    .session-badge.offline {
      color: var(--text-dim);
      background: rgba(82, 82, 91, 0.2);
    }

    .session-badge .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .session-badge.online .badge-dot { background: var(--success); }
    .session-badge.offline .badge-dot { background: var(--text-dim); }

    .session-path {
      font-size: 12px;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .current-tag {
      display: inline-block;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--accent);
      background: rgba(34, 211, 238, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 8px;
    }

    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--surface);
      border-top: 1px solid var(--border);
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 10;
    }

    .terminal-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--accent);
      color: var(--void);
      border: none;
      border-radius: 10px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: opacity 0.15s;
    }

    .terminal-btn:hover { opacity: 0.9; }

    .footer-version {
      font-size: 12px;
      color: var(--text-dim);
    }

    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-muted);
      font-size: 14px;
    }

    .loading {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-muted);
      font-size: 14px;
    }

    .clear-btn {
      background: none;
      border: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      float: right;
      margin-top: -2px;
    }

    .clear-btn:hover {
      color: var(--danger);
      border-color: var(--danger);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-title">MConnect</div>
    <div class="header-status">
      <div class="status-dot online"></div>
      Connected
    </div>
  </div>

  <div class="content">
    <div class="loading" id="loadingState">Loading sessions...</div>
    <div id="sessionsContainer" style="display:none"></div>
  </div>

  <div class="footer">
    <a class="terminal-btn" id="terminalBtn" href="/terminal?token=${encodeURIComponent(token)}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 17 10 11 4 5"></polyline>
        <line x1="12" y1="19" x2="20" y2="19"></line>
      </svg>
      Terminal
    </a>
    <span class="footer-version">v${VERSION}</span>
  </div>

  <script>
    const TOKEN = ${JSON.stringify(token)};
    const CURRENT_SESSION_ID = ${JSON.stringify(currentSessionId)};

    function timeAgo(dateStr) {
      const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (seconds < 60) return 'just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return minutes + 'm ago';
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return hours + 'h ago';
      const days = Math.floor(hours / 24);
      return days + 'd ago';
    }

    function basename(path) {
      if (!path) return 'unknown';
      const parts = path.replace(/\\/\\/$/g, '').split('/');
      return parts[parts.length - 1] || path;
    }

    function renderSessions(data) {
      const container = document.getElementById('sessionsContainer');
      const active = data.sessions.filter(s => s.alive);
      const dead = data.sessions.filter(s => !s.alive);

      let html = '';

      // Active sessions
      html += '<div class="section-header">Active Sessions</div>';
      if (active.length === 0) {
        html += '<div class="empty-state">No active sessions</div>';
      } else {
        for (const s of active) {
          const isCurrent = s.sessionId === CURRENT_SESSION_ID;
          html += '<a class="session-card' + (isCurrent ? ' current' : '') + '" href="' + s.connectUrl + '">';
          html += '<div class="session-card-top">';
          html += '<span class="session-name">' + escapeHtml(basename(s.workDir)) + (isCurrent ? '<span class="current-tag">CURRENT</span>' : '') + '</span>';
          html += '<span class="session-badge online"><span class="badge-dot"></span>online</span>';
          html += '</div>';
          html += '<div class="session-path">' + escapeHtml(s.workDir) + '</div>';
          html += '</a>';
        }
      }

      // Previous sessions
      if (dead.length > 0) {
        html += '<div class="section-header">Previous Sessions</div>';
        for (const s of dead) {
          html += '<div class="session-card dead">';
          html += '<div class="session-card-top">';
          html += '<span class="session-name">' + escapeHtml(basename(s.workDir)) + '</span>';
          html += '<span class="session-badge offline"><span class="badge-dot"></span>last seen ' + timeAgo(s.startedAt) + '</span>';
          html += '</div>';
          html += '<div class="session-path">' + escapeHtml(s.workDir) + '</div>';
          html += '</div>';
        }
      }

      container.innerHTML = html;
      container.style.display = 'block';
      document.getElementById('loadingState').style.display = 'none';
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    async function fetchSessions() {
      try {
        const res = await fetch('/api/sessions?token=' + encodeURIComponent(TOKEN));
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        renderSessions(data);
      } catch (err) {
        document.getElementById('loadingState').textContent = 'Failed to load sessions';
      }
    }

    // Initial fetch
    fetchSessions();

    // Poll every 10 seconds
    setInterval(fetchSessions, 10000);
  </script>
</body>
</html>`;
}
