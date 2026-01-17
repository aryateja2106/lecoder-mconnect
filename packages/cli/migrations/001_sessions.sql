-- migrations/001_sessions.sql
-- MConnect v0.2.0 - Persistent Sessions Schema

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Sessions table: persistent shell sessions with state
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  last_activity INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'running'
    CHECK(state IN ('running', 'paused', 'completed')),
  agent_config TEXT NOT NULL,  -- JSON blob
  working_directory TEXT NOT NULL
);

-- Scrollback table: terminal output history for session reconnection
CREATE TABLE scrollback (
  session_id TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  PRIMARY KEY (session_id, line_number),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Connected clients table: track PC and mobile connections
CREATE TABLE connected_clients (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  client_type TEXT NOT NULL CHECK(client_type IN ('pc', 'mobile')),
  connected_at INTEGER NOT NULL,
  last_heartbeat INTEGER NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK(priority IN ('exclusive', 'high', 'normal', 'low', 'observer')),
  user_agent TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Input log table: audit trail for all input events
CREATE TABLE input_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  input TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  accepted INTEGER NOT NULL,  -- 0 or 1
  reject_reason TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX idx_sessions_state ON sessions(state);
CREATE INDEX idx_scrollback_session ON scrollback(session_id);
CREATE INDEX idx_clients_session ON connected_clients(session_id);
CREATE INDEX idx_input_log_session ON input_log(session_id, timestamp);
