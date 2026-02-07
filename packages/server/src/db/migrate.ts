/**
 * Database Migration Runner
 *
 * Executes SQL migrations in order, tracking applied migrations
 * in the _migrations table.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { type SqlClient, createClient, getConfigFromEnv } from './client.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Migration file info
 */
interface Migration {
  /** Migration number (from filename) */
  version: number;
  /** Migration name (from filename) */
  name: string;
  /** Full filename */
  filename: string;
  /** Full path to migration file */
  filepath: string;
}

/**
 * Applied migration record from database
 */
interface AppliedMigration {
  id: number;
  name: string;
  applied_at: Date;
}

// ============================================================================
// Migration Runner
// ============================================================================

/**
 * Get the migrations directory path
 */
function getMigrationsDir(): string {
  // Handle both dev (src/) and prod (dist/) paths
  const currentDir = new URL('.', import.meta.url).pathname;
  const srcPath = path.join(currentDir, 'migrations');
  const distPath = path.join(currentDir, '..', 'src', 'db', 'migrations');

  if (fs.existsSync(srcPath)) {
    return srcPath;
  }
  if (fs.existsSync(distPath)) {
    return distPath;
  }
  throw new Error(`Migrations directory not found. Checked: ${srcPath}, ${distPath}`);
}

/**
 * Parse migration files from directory
 *
 * @param dir - Migrations directory path
 * @returns Sorted list of migrations
 */
function parseMigrations(dir: string): Migration[] {
  const files = fs.readdirSync(dir);

  const migrations: Migration[] = files
    .filter((f) => f.endsWith('.sql'))
    .map((filename) => {
      // Parse filename: 001_initial.sql -> { version: 1, name: '001_initial' }
      const match = filename.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        throw new Error(`Invalid migration filename: ${filename}. Expected format: NNN_name.sql`);
      }

      return {
        version: Number.parseInt(match[1], 10),
        name: `${match[1]}_${match[2]}`,
        filename,
        filepath: path.join(dir, filename),
      };
    })
    .sort((a, b) => a.version - b.version);

  return migrations;
}

/**
 * Get list of applied migrations from database
 *
 * @param sql - Database client
 * @returns List of applied migration names
 */
async function getAppliedMigrations(sql: SqlClient): Promise<Set<string>> {
  // Ensure migrations table exists
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  const rows = await sql<AppliedMigration[]>`
    SELECT id, name, applied_at FROM _migrations ORDER BY id
  `;

  return new Set(rows.map((r) => r.name));
}

/**
 * Apply a single migration
 *
 * @param sql - Database client
 * @param migration - Migration to apply
 */
async function applyMigration(sql: SqlClient, migration: Migration): Promise<void> {
  const content = fs.readFileSync(migration.filepath, 'utf-8');

  console.log(`Applying migration: ${migration.name}`);

  // Execute migration in a transaction
  // Type assertion needed because postgres.js TransactionSql differs from Sql
  await sql.begin(async (txSql) => {
    // Cast for full SQL functionality
    const tx = txSql as unknown as SqlClient;

    // Execute the migration SQL
    await tx.unsafe(content);

    // Record the migration
    await tx`
      INSERT INTO _migrations (name) VALUES (${migration.name})
    `;
  });

  console.log(`  ✓ Applied: ${migration.name}`);
}

/**
 * Run all pending migrations
 *
 * @param sql - Database client (optional, creates one if not provided)
 * @returns Number of migrations applied
 */
export async function runMigrations(sql?: SqlClient): Promise<number> {
  const client = sql ?? createClient(getConfigFromEnv());
  const shouldClose = !sql;

  try {
    const migrationsDir = getMigrationsDir();
    const migrations = parseMigrations(migrationsDir);
    const applied = await getAppliedMigrations(client);

    console.log(`Found ${migrations.length} migrations, ${applied.size} already applied`);

    const pending = migrations.filter((m) => !applied.has(m.name));

    if (pending.length === 0) {
      console.log('No pending migrations');
      return 0;
    }

    console.log(`Applying ${pending.length} pending migrations...`);

    for (const migration of pending) {
      await applyMigration(client, migration);
    }

    console.log(`Successfully applied ${pending.length} migrations`);
    return pending.length;
  } finally {
    if (shouldClose) {
      await client.end();
    }
  }
}

/**
 * Get migration status
 *
 * @param sql - Database client (optional)
 * @returns Migration status info
 */
export async function getMigrationStatus(sql?: SqlClient): Promise<{
  total: number;
  applied: number;
  pending: number;
  migrations: Array<{ name: string; status: 'applied' | 'pending'; appliedAt?: Date }>;
}> {
  const client = sql ?? createClient(getConfigFromEnv());
  const shouldClose = !sql;

  try {
    const migrationsDir = getMigrationsDir();
    const migrations = parseMigrations(migrationsDir);
    const appliedSet = await getAppliedMigrations(client);

    // Get full applied info with timestamps
    const appliedRows = await client<AppliedMigration[]>`
      SELECT id, name, applied_at FROM _migrations ORDER BY id
    `;
    const appliedMap = new Map(appliedRows.map((r) => [r.name, r.applied_at]));

    const result = migrations.map((m) => ({
      name: m.name,
      status: appliedSet.has(m.name) ? ('applied' as const) : ('pending' as const),
      appliedAt: appliedMap.get(m.name),
    }));

    return {
      total: migrations.length,
      applied: appliedSet.size,
      pending: migrations.length - appliedSet.size,
      migrations: result,
    };
  } finally {
    if (shouldClose) {
      await client.end();
    }
  }
}

/**
 * Reset database (drop all tables and re-run migrations)
 *
 * WARNING: This will delete all data!
 *
 * @param sql - Database client (optional)
 */
export async function resetDatabase(sql?: SqlClient): Promise<void> {
  const client = sql ?? createClient(getConfigFromEnv());
  const shouldClose = !sql;

  try {
    console.log('Dropping all tables...');

    // Drop all tables in reverse dependency order
    await client`DROP TABLE IF EXISTS _migrations CASCADE`;
    await client`DROP TABLE IF EXISTS input_log CASCADE`;
    await client`DROP TABLE IF EXISTS scrollback CASCADE`;
    await client`DROP TABLE IF EXISTS refresh_tokens CASCADE`;
    await client`DROP TABLE IF EXISTS oauth_tokens CASCADE`;
    await client`DROP TABLE IF EXISTS clients CASCADE`;
    await client`DROP TABLE IF EXISTS agents CASCADE`;
    await client`DROP TABLE IF EXISTS sessions CASCADE`;
    await client`DROP TABLE IF EXISTS users CASCADE`;

    console.log('Running migrations...');
    await runMigrations(client);
  } finally {
    if (shouldClose) {
      await client.end();
    }
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * Run as CLI
 *
 * Usage:
 *   bun run src/db/migrate.ts [command]
 *
 * Commands:
 *   up (default) - Run pending migrations
 *   status       - Show migration status
 *   reset        - Drop all tables and re-run migrations
 */
async function main(): Promise<void> {
  const command = process.argv[2] || 'up';

  try {
    switch (command) {
      case 'up':
        await runMigrations();
        break;

      case 'status': {
        const status = await getMigrationStatus();
        console.log('\nMigration Status:');
        console.log(`  Total: ${status.total}`);
        console.log(`  Applied: ${status.applied}`);
        console.log(`  Pending: ${status.pending}`);
        console.log('\nMigrations:');
        for (const m of status.migrations) {
          const statusSymbol = m.status === 'applied' ? '✓' : '○';
          const appliedDate = m.appliedAt ? ` (${m.appliedAt.toISOString()})` : '';
          console.log(`  ${statusSymbol} ${m.name}${appliedDate}`);
        }
        break;
      }

      case 'reset':
        console.log('WARNING: This will delete all data!');
        await resetDatabase();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Usage: bun run src/db/migrate.ts [up|status|reset]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}

export default {
  runMigrations,
  getMigrationStatus,
  resetDatabase,
};
