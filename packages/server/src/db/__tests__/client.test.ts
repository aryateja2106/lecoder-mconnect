/**
 * Database Client Tests
 *
 * Unit tests for the database client module.
 * These tests mock the postgres module to test client behavior.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  createClient,
  getConfigFromEnv,
  type DatabaseConfig,
} from '../client.js';

describe('Database Client', () => {
  describe('getConfigFromEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset env before each test
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('returns empty config when no env vars set', () => {
      // Clear relevant env vars
      process.env.DATABASE_URL = undefined;
      process.env.DB_HOST = undefined;
      process.env.DB_PORT = undefined;
      process.env.DB_NAME = undefined;
      process.env.DB_USER = undefined;
      process.env.DB_PASSWORD = undefined;

      const config = getConfigFromEnv();

      expect(config.connectionUrl).toBeUndefined();
      expect(config.host).toBeUndefined();
    });

    test('parses DATABASE_URL', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5433/db';

      const config = getConfigFromEnv();

      expect(config.connectionUrl).toBe('postgresql://user:pass@host:5433/db');
    });

    test('parses individual connection params', () => {
      process.env.DB_HOST = 'testhost';
      process.env.DB_PORT = '5433';
      process.env.DB_NAME = 'testdb';
      process.env.DB_USER = 'testuser';
      process.env.DB_PASSWORD = 'testpass';

      const config = getConfigFromEnv();

      expect(config.host).toBe('testhost');
      expect(config.port).toBe(5433);
      expect(config.database).toBe('testdb');
      expect(config.username).toBe('testuser');
      expect(config.password).toBe('testpass');
    });

    test('parses pool configuration', () => {
      process.env.DB_MAX_CONNECTIONS = '20';
      process.env.DB_IDLE_TIMEOUT = '30';
      process.env.DB_CONNECTION_TIMEOUT = '60';

      const config = getConfigFromEnv();

      expect(config.maxConnections).toBe(20);
      expect(config.idleTimeout).toBe(30);
      expect(config.connectionTimeout).toBe(60);
    });

    test('parses SSL configuration', () => {
      process.env.DB_SSL = 'true';
      let config = getConfigFromEnv();
      expect(config.ssl).toBe(true);

      process.env.DB_SSL = 'require';
      config = getConfigFromEnv();
      expect(config.ssl).toBe('require');

      process.env.DB_SSL = 'prefer';
      config = getConfigFromEnv();
      expect(config.ssl).toBe('prefer');

      process.env.DB_SSL = 'false';
      config = getConfigFromEnv();
      expect(config.ssl).toBe(false);
    });

    test('parses debug flag', () => {
      process.env.DB_DEBUG = 'true';
      let config = getConfigFromEnv();
      expect(config.debug).toBe(true);

      process.env.DB_DEBUG = '1';
      config = getConfigFromEnv();
      expect(config.debug).toBe(true);

      process.env.DB_DEBUG = 'false';
      config = getConfigFromEnv();
      expect(config.debug).toBeUndefined();
    });
  });

  describe('createClient', () => {
    test('creates client with default config', () => {
      // This will fail to connect but should create client instance
      const client = createClient({
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test',
        connectionTimeout: 1, // Short timeout so test fails fast if no DB
      });

      expect(client).toBeDefined();
      // Clean up
      client.end();
    });

    test('creates client with connection URL', () => {
      const client = createClient({
        connectionUrl: 'postgresql://test:test@localhost:5432/test',
        connectionTimeout: 1,
      });

      expect(client).toBeDefined();
      client.end();
    });
  });
});

describe('DatabaseConfig', () => {
  test('config interface has all expected properties', () => {
    const config: DatabaseConfig = {
      connectionUrl: 'postgresql://localhost',
      host: 'localhost',
      port: 5432,
      database: 'test',
      username: 'user',
      password: 'pass',
      maxConnections: 10,
      idleTimeout: 20,
      connectionTimeout: 30,
      ssl: true,
      debug: false,
    };

    expect(config).toBeDefined();
  });
});
