/**
 * Session Store - SQLite persistence layer
 * MConnect v0.2.0
 *
 * Handles database connection, migrations, and CRUD operations
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  Session,
  SessionRow,
  SessionState,
  Client,
  ClientRow,
  ClientType,
  Priority,
  ScrollbackLine,
  ScrollbackRow,
  InputLogEntry,
  InputLogRow,
  RejectReason,
  AgentConfig,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface SessionStoreConfig {
  dataDir: string;
  dbName?: string;
}

export class SessionStore {
  private db: Database.Database;
  private dataDir: string;

  constructor(config: SessionStoreConfig) {
    this.dataDir = config.dataDir;
    const dbPath = join(config.dataDir, config.dbName || 'sessions.db');

    // Ensure data directory exists
    if (!existsSync(config.dataDir)) {
      mkdirSync(config.dataDir, { recursive: true });
    }

    // Open database
    this.db = new Database(dbPath);

    // Enable WAL mode and foreign keys
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Run migrations
    this.runMigrations();
  }

  /**
   * Run database migrations
   */
  private runMigrations(): void {
    // Get migration file path (relative to package root)
    const migrationsDir = join(__dirname, '../../migrations');
    const migrationFile = join(migrationsDir, '001_sessions.sql');

    if (!existsSync(migrationFile)) {
      // Create tables inline if migration file doesn't exist
      this.createTables();
      return;
    }

    // Check if tables exist
    const tablesExist = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
      .get();

    if (!tablesExist) {
      const migration = readFileSync(migrationFile, 'utf-8');
      this.db.exec(migration);
    }
  }

  /**
   * Create tables (fallback if migration file not found)
   */
  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        last_activity INTEGER NOT NULL,
        state TEXT NOT NULL DEFAULT 'running'
          CHECK(state IN ('running', 'paused', 'completed')),
        agent_config TEXT NOT NULL,
        working_directory TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scrollback (
        session_id TEXT NOT NULL,
        line_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        PRIMARY KEY (session_id, line_number),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS connected_clients (
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

      CREATE TABLE IF NOT EXISTS input_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        input TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        accepted INTEGER NOT NULL,
        reject_reason TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions(state);
      CREATE INDEX IF NOT EXISTS idx_scrollback_session ON scrollback(session_id);
      CREATE INDEX IF NOT EXISTS idx_clients_session ON connected_clients(session_id);
      CREATE INDEX IF NOT EXISTS idx_input_log_session ON input_log(session_id, timestamp);
    `);
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  // ============================================
  // Session CRUD
  // ============================================

  createSession(session: Omit<Session, 'createdAt' | 'lastActivity'>): Session {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, created_at, last_activity, state, agent_config, working_directory)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      now,
      now,
      session.state,
      JSON.stringify(session.agentConfig),
      session.workingDirectory
    );

    return {
      ...session,
      createdAt: new Date(now),
      lastActivity: new Date(now),
    };
  }

  getSession(id: string): Session | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
    return row ? this.rowToSession(row) : null;
  }

  getAllSessions(includeCompleted = false): Session[] {
    const query = includeCompleted
      ? 'SELECT * FROM sessions ORDER BY last_activity DESC'
      : "SELECT * FROM sessions WHERE state != 'completed' ORDER BY last_activity DESC";

    const rows = this.db.prepare(query).all() as SessionRow[];
    return rows.map((row) => this.rowToSession(row));
  }

  getSessionsByState(state: SessionState): Session[] {
    const rows = this.db
      .prepare('SELECT * FROM sessions WHERE state = ? ORDER BY last_activity DESC')
      .all(state) as SessionRow[];
    return rows.map((row) => this.rowToSession(row));
  }

  updateSessionState(id: string, state: SessionState): boolean {
    const stmt = this.db.prepare('UPDATE sessions SET state = ?, last_activity = ? WHERE id = ?');
    const result = stmt.run(state, Date.now(), id);
    return result.changes > 0;
  }

  updateSessionActivity(id: string): boolean {
    const stmt = this.db.prepare('UPDATE sessions SET last_activity = ? WHERE id = ?');
    const result = stmt.run(Date.now(), id);
    return result.changes > 0;
  }

  deleteSession(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  deleteCompletedSessions(olderThanMs: number): number {
    const cutoff = Date.now() - olderThanMs;
    const stmt = this.db.prepare("DELETE FROM sessions WHERE state = 'completed' AND last_activity < ?");
    const result = stmt.run(cutoff);
    return result.changes;
  }

  // ============================================
  // Client CRUD
  // ============================================

  addClient(client: Omit<Client, 'connectedAt' | 'lastHeartbeat'>): Client {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO connected_clients (id, session_id, client_type, connected_at, last_heartbeat, priority, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      client.id,
      client.sessionId,
      client.clientType,
      now,
      now,
      client.priority,
      client.userAgent || null
    );

    return {
      ...client,
      connectedAt: new Date(now),
      lastHeartbeat: new Date(now),
    };
  }

  getClient(id: string): Client | null {
    const row = this.db.prepare('SELECT * FROM connected_clients WHERE id = ?').get(id) as ClientRow | undefined;
    return row ? this.rowToClient(row) : null;
  }

  getClientsBySession(sessionId: string): Client[] {
    const rows = this.db
      .prepare('SELECT * FROM connected_clients WHERE session_id = ?')
      .all(sessionId) as ClientRow[];
    return rows.map((row) => this.rowToClient(row));
  }

  updateClientHeartbeat(id: string): boolean {
    const stmt = this.db.prepare('UPDATE connected_clients SET last_heartbeat = ? WHERE id = ?');
    const result = stmt.run(Date.now(), id);
    return result.changes > 0;
  }

  updateClientPriority(id: string, priority: Priority): boolean {
    const stmt = this.db.prepare('UPDATE connected_clients SET priority = ? WHERE id = ?');
    const result = stmt.run(priority, id);
    return result.changes > 0;
  }

  removeClient(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM connected_clients WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  removeStaleClients(olderThanMs: number): number {
    const cutoff = Date.now() - olderThanMs;
    const stmt = this.db.prepare('DELETE FROM connected_clients WHERE last_heartbeat < ?');
    const result = stmt.run(cutoff);
    return result.changes;
  }

  // ============================================
  // Scrollback CRUD
  // ============================================

  appendScrollback(sessionId: string, content: string): number {
    // Get next line number
    const lastLine = this.db
      .prepare('SELECT MAX(line_number) as max_line FROM scrollback WHERE session_id = ?')
      .get(sessionId) as { max_line: number | null } | undefined;

    const lineNumber = (lastLine?.max_line ?? -1) + 1;
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO scrollback (session_id, line_number, content, timestamp)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(sessionId, lineNumber, content, now);
    return lineNumber;
  }

  appendScrollbackBatch(sessionId: string, lines: string[]): void {
    const lastLine = this.db
      .prepare('SELECT MAX(line_number) as max_line FROM scrollback WHERE session_id = ?')
      .get(sessionId) as { max_line: number | null } | undefined;

    let lineNumber = (lastLine?.max_line ?? -1) + 1;
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO scrollback (session_id, line_number, content, timestamp)
      VALUES (?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((lines: string[]) => {
      for (const line of lines) {
        stmt.run(sessionId, lineNumber++, line, now);
      }
    });

    insertMany(lines);
  }

  getScrollback(sessionId: string, fromLine: number, count: number): ScrollbackLine[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM scrollback
        WHERE session_id = ? AND line_number >= ?
        ORDER BY line_number ASC
        LIMIT ?
      `)
      .all(sessionId, fromLine, count) as ScrollbackRow[];

    return rows.map((row) => this.rowToScrollback(row));
  }

  getScrollbackRange(sessionId: string, fromLine: number, toLine: number): ScrollbackLine[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM scrollback
        WHERE session_id = ? AND line_number >= ? AND line_number <= ?
        ORDER BY line_number ASC
      `)
      .all(sessionId, fromLine, toLine) as ScrollbackRow[];

    return rows.map((row) => this.rowToScrollback(row));
  }

  getLatestScrollback(sessionId: string, count: number): ScrollbackLine[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM (
          SELECT * FROM scrollback
          WHERE session_id = ?
          ORDER BY line_number DESC
          LIMIT ?
        ) ORDER BY line_number ASC
      `)
      .all(sessionId, count) as ScrollbackRow[];

    return rows.map((row) => this.rowToScrollback(row));
  }

  getScrollbackLineCount(sessionId: string): number {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM scrollback WHERE session_id = ?')
      .get(sessionId) as { count: number } | undefined;

    return result?.count ?? 0;
  }

  trimScrollback(sessionId: string, keepLines: number): number {
    const totalLines = this.getScrollbackLineCount(sessionId);
    if (totalLines <= keepLines) {
      return 0;
    }

    const linesToDelete = totalLines - keepLines;
    const stmt = this.db.prepare(`
      DELETE FROM scrollback
      WHERE session_id = ? AND line_number < ?
    `);

    const result = stmt.run(sessionId, linesToDelete);
    return result.changes;
  }

  // ============================================
  // Input Log CRUD
  // ============================================

  logInput(
    sessionId: string,
    clientId: string,
    input: string,
    accepted: boolean,
    rejectReason?: RejectReason
  ): number {
    const stmt = this.db.prepare(`
      INSERT INTO input_log (session_id, client_id, input, timestamp, accepted, reject_reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      sessionId,
      clientId,
      input,
      Date.now(),
      accepted ? 1 : 0,
      rejectReason || null
    );

    return result.lastInsertRowid as number;
  }

  getInputLog(sessionId: string, limit = 100): InputLogEntry[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM input_log
        WHERE session_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `)
      .all(sessionId, limit) as InputLogRow[];

    return rows.map((row) => this.rowToInputLog(row));
  }

  // ============================================
  // Row Converters
  // ============================================

  private rowToSession(row: SessionRow): Session {
    return {
      id: row.id,
      createdAt: new Date(row.created_at),
      lastActivity: new Date(row.last_activity),
      state: row.state,
      agentConfig: JSON.parse(row.agent_config) as AgentConfig,
      workingDirectory: row.working_directory,
    };
  }

  private rowToClient(row: ClientRow): Client {
    return {
      id: row.id,
      sessionId: row.session_id,
      clientType: row.client_type,
      connectedAt: new Date(row.connected_at),
      lastHeartbeat: new Date(row.last_heartbeat),
      priority: row.priority,
      userAgent: row.user_agent || undefined,
    };
  }

  private rowToScrollback(row: ScrollbackRow): ScrollbackLine {
    return {
      sessionId: row.session_id,
      lineNumber: row.line_number,
      content: row.content,
      timestamp: new Date(row.timestamp),
    };
  }

  private rowToInputLog(row: InputLogRow): InputLogEntry {
    return {
      id: row.id,
      sessionId: row.session_id,
      clientId: row.client_id,
      input: row.input,
      timestamp: new Date(row.timestamp),
      accepted: row.accepted === 1,
      rejectReason: row.reject_reason || undefined,
    };
  }
}
