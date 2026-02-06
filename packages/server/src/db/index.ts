/**
 * Database Module
 *
 * PostgreSQL database layer for MConnect V2.
 *
 * Components:
 * - Client: Connection management and pooling
 * - Migrations: Schema version management
 * - Repositories: CRUD operations for each table
 */

// Client and connection management
export {
  type DatabaseConfig,
  type SqlClient,
  type TransactionCallback,
  createClient,
  getClient,
  initializeDatabase,
  closeDatabase,
  healthCheck,
  withTransaction,
  getConfigFromEnv,
} from './client.js';

// Migration utilities
export { runMigrations, getMigrationStatus, resetDatabase } from './migrate.js';

// Repositories
export {
  userRepository,
  sessionRepository,
  agentRepository,
  clientRepository,
  type CreateUserInput,
  type UpdateUserInput,
  type CreateSessionInput,
  type UpdateSessionInput,
  type SessionFilter,
  type CreateAgentInput,
  type UpdateAgentInput,
  type AgentFilter,
  type CreateClientInput,
  type UpdateClientInput,
  type ClientFilter,
} from './repositories/index.js';
