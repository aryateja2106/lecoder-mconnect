/**
 * PostgreSQL Database Client
 *
 * Provides connection management for PostgreSQL using the `postgres` package.
 * Supports connection pooling, transactions, and health checks.
 */

import postgres from 'postgres';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Database configuration options
 */
export interface DatabaseConfig {
  /** PostgreSQL connection URL */
  connectionUrl?: string;
  /** Host (if not using connection URL) */
  host?: string;
  /** Port (default: 5432) */
  port?: number;
  /** Database name */
  database?: string;
  /** Username */
  username?: string;
  /** Password */
  password?: string;
  /** Maximum connections in pool (default: 10) */
  maxConnections?: number;
  /** Idle timeout in seconds (default: 20) */
  idleTimeout?: number;
  /** Connection timeout in seconds (default: 30) */
  connectionTimeout?: number;
  /** Enable SSL (default: false for local dev) */
  ssl?: boolean | 'require' | 'prefer';
  /** Log queries (default: false) */
  debug?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<DatabaseConfig> = {
  host: 'localhost',
  port: 5432,
  database: 'mconnect',
  username: 'postgres',
  password: 'postgres',
  maxConnections: 10,
  idleTimeout: 20,
  connectionTimeout: 30,
  ssl: false,
  debug: false,
};

// ============================================================================
// Database Client
// ============================================================================

/**
 * PostgreSQL client instance
 */
export type SqlClient = postgres.Sql;

/**
 * Global database client singleton
 */
let dbClient: SqlClient | null = null;

/**
 * Create a new database client
 *
 * @param config - Database configuration
 * @returns PostgreSQL client instance
 */
export function createClient(config: DatabaseConfig = {}): SqlClient {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Use connection URL if provided
  if (finalConfig.connectionUrl) {
    return postgres(finalConfig.connectionUrl, {
      max: finalConfig.maxConnections,
      idle_timeout: finalConfig.idleTimeout,
      connect_timeout: finalConfig.connectionTimeout,
      debug: finalConfig.debug ? console.log : undefined,
    });
  }

  // Otherwise use individual connection params
  return postgres({
    host: finalConfig.host,
    port: finalConfig.port,
    database: finalConfig.database,
    username: finalConfig.username,
    password: finalConfig.password,
    max: finalConfig.maxConnections,
    idle_timeout: finalConfig.idleTimeout,
    connect_timeout: finalConfig.connectionTimeout,
    ssl: finalConfig.ssl,
    debug: finalConfig.debug ? console.log : undefined,
  });
}

/**
 * Get the global database client instance
 *
 * Creates the client on first call using environment variables.
 *
 * @returns PostgreSQL client instance
 */
export function getClient(): SqlClient {
  if (!dbClient) {
    dbClient = createClient(getConfigFromEnv());
  }
  return dbClient;
}

/**
 * Initialize the database connection
 *
 * Call this at startup to verify connection and create client.
 *
 * @param config - Optional database configuration
 * @returns PostgreSQL client instance
 */
export async function initializeDatabase(config?: DatabaseConfig): Promise<SqlClient> {
  const client = config ? createClient(config) : getClient();

  // Verify connection
  await client`SELECT 1`;

  dbClient = client;
  return client;
}

/**
 * Close the database connection
 *
 * Call this at shutdown for graceful cleanup.
 */
export async function closeDatabase(): Promise<void> {
  if (dbClient) {
    await dbClient.end();
    dbClient = null;
  }
}

/**
 * Check database health
 *
 * @returns True if database is responsive
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const client = getClient();
    await client`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Transactions
// ============================================================================

/**
 * Transaction callback type
 */
export type TransactionCallback<T> = (sql: SqlClient) => Promise<T>;

/**
 * Execute a function within a transaction
 *
 * @param callback - Function to execute within transaction
 * @returns Result of the callback
 * @throws If callback throws, transaction is rolled back
 */
export async function withTransaction<T>(callback: TransactionCallback<T>): Promise<T> {
  const client = getClient();

  // postgres.js handles transactions via .begin()
  // Type assertion needed because postgres.js TransactionSql type differs from Sql
  return client.begin(async (sql) => {
    return callback(sql as unknown as SqlClient);
  }) as Promise<T>;
}

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Parse database configuration from environment variables
 *
 * Supports:
 * - DATABASE_URL: Full connection URL
 * - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD: Individual params
 * - DB_MAX_CONNECTIONS, DB_IDLE_TIMEOUT, DB_CONNECTION_TIMEOUT
 * - DB_SSL, DB_DEBUG
 */
export function getConfigFromEnv(): DatabaseConfig {
  const config: DatabaseConfig = {};

  // Connection URL takes precedence
  if (process.env.DATABASE_URL) {
    config.connectionUrl = process.env.DATABASE_URL;
  } else {
    // Individual connection params
    if (process.env.DB_HOST) config.host = process.env.DB_HOST;
    if (process.env.DB_PORT) config.port = Number.parseInt(process.env.DB_PORT, 10);
    if (process.env.DB_NAME) config.database = process.env.DB_NAME;
    if (process.env.DB_USER) config.username = process.env.DB_USER;
    if (process.env.DB_PASSWORD) config.password = process.env.DB_PASSWORD;
  }

  // Pool configuration
  if (process.env.DB_MAX_CONNECTIONS) {
    config.maxConnections = Number.parseInt(process.env.DB_MAX_CONNECTIONS, 10);
  }
  if (process.env.DB_IDLE_TIMEOUT) {
    config.idleTimeout = Number.parseInt(process.env.DB_IDLE_TIMEOUT, 10);
  }
  if (process.env.DB_CONNECTION_TIMEOUT) {
    config.connectionTimeout = Number.parseInt(process.env.DB_CONNECTION_TIMEOUT, 10);
  }

  // SSL
  if (process.env.DB_SSL) {
    const sslValue = process.env.DB_SSL.toLowerCase();
    if (sslValue === 'true' || sslValue === '1') {
      config.ssl = true;
    } else if (sslValue === 'require' || sslValue === 'prefer') {
      config.ssl = sslValue;
    } else if (sslValue === 'false' || sslValue === '0') {
      config.ssl = false;
    }
  }

  // Debug
  if (process.env.DB_DEBUG === 'true' || process.env.DB_DEBUG === '1') {
    config.debug = true;
  }

  return config;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  createClient,
  getClient,
  initializeDatabase,
  closeDatabase,
  healthCheck,
  withTransaction,
  getConfigFromEnv,
};
