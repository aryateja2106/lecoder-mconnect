/**
 * Vox Feedback Store
 * MConnect vox integration
 *
 * SQLite persistence for vox interaction history and feedback.
 * Uses better-sqlite3 with WAL mode, consistent with SessionStore.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { getDataDir } from '../config.js';

// Use createRequire for CommonJS native module (same pattern as doctor.ts)
const require = createRequire(import.meta.url);

export type UserAction = 'run' | 'copy' | 'skip' | 'error';

export interface VoxFeedbackEntry {
  query: string;
  suggestedCommand: string;
  userAction: UserAction;
  editedCommand?: string;
  wasDangerous: boolean;
  model: string;
  latencyMs: number;
  exitCode?: number;
}

export interface VoxHistoryRow {
  id: number;
  query: string;
  suggested_command: string;
  user_action: UserAction;
  edited_command: string | null;
  was_dangerous: number;
  model: string;
  latency_ms: number;
  exit_code: number | null;
  created_at: number;
}

export interface VoxStats {
  total: number;
  runRate: number;
  dangerousCount: number;
}

export class VoxFeedbackStore {
  // biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 is a CJS module
  private db: any;

  constructor(dataDir?: string) {
    const dir = dataDir ?? getDataDir();

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const dbPath = join(dir, 'vox.db');
    const Database = require('better-sqlite3');
    this.db = new Database(dbPath);

    // Enable WAL mode and foreign keys — consistent with SessionStore
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.createTable();
  }

  private createTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vox_feedback (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        query            TEXT    NOT NULL,
        suggested_command TEXT   NOT NULL,
        user_action      TEXT    NOT NULL
          CHECK(user_action IN ('run','copy','skip','error')),
        edited_command   TEXT,
        was_dangerous    INTEGER NOT NULL DEFAULT 0,
        model            TEXT    NOT NULL,
        latency_ms       INTEGER NOT NULL,
        exit_code        INTEGER,
        created_at       INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_vox_feedback_created
        ON vox_feedback(created_at DESC);
    `);
  }

  /**
   * Log a vox interaction. Returns the inserted row id.
   */
  log(entry: VoxFeedbackEntry): number {
    const stmt = this.db.prepare(`
      INSERT INTO vox_feedback
        (query, suggested_command, user_action, edited_command,
         was_dangerous, model, latency_ms, exit_code, created_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      entry.query,
      entry.suggestedCommand,
      entry.userAction,
      entry.editedCommand ?? null,
      entry.wasDangerous ? 1 : 0,
      entry.model,
      entry.latencyMs,
      entry.exitCode ?? null,
      Date.now()
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Retrieve the most recent interactions, newest first.
   */
  getHistory(limit = 20): VoxHistoryRow[] {
    return this.db
      .prepare(`
        SELECT * FROM vox_feedback
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(limit) as VoxHistoryRow[];
  }

  /**
   * Return aggregate usage statistics.
   */
  getStats(): VoxStats {
    const total = (
      this.db.prepare('SELECT COUNT(*) as count FROM vox_feedback').get() as { count: number }
    ).count;

    const runCount = (
      this.db
        .prepare("SELECT COUNT(*) as count FROM vox_feedback WHERE user_action = 'run'")
        .get() as { count: number }
    ).count;

    const dangerousCount = (
      this.db
        .prepare('SELECT COUNT(*) as count FROM vox_feedback WHERE was_dangerous = 1')
        .get() as { count: number }
    ).count;

    return {
      total,
      runRate: total > 0 ? runCount / total : 0,
      dangerousCount,
    };
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }
}
