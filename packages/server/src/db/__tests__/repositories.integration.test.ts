/**
 * Repository Integration Tests
 *
 * These tests require a running PostgreSQL database.
 * Run with: bun test:integration
 *
 * Setup:
 *   docker-compose up -d
 *   bun run src/db/migrate.ts up
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createClient, type SqlClient } from '../client.js';
import { runMigrations } from '../migrate.js';
import { userRepository } from '../repositories/user.js';
import { sessionRepository } from '../repositories/session.js';
import { agentRepository } from '../repositories/agent.js';
import { clientRepository } from '../repositories/client.js';

// Skip these tests if DATABASE_URL is not set or if explicitly skipped
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mconnect';
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION === 'true';

describe.skipIf(SKIP_INTEGRATION)('Repository Integration Tests', () => {
  let sql: SqlClient;

  beforeAll(async () => {
    // Connect to test database
    sql = createClient({ connectionUrl: DATABASE_URL });

    // Run migrations
    await runMigrations(sql);
  });

  afterAll(async () => {
    if (sql) {
      await sql.end();
    }
  });

  beforeEach(async () => {
    // Clean up tables before each test (in dependency order)
    await sql`TRUNCATE clients, input_log, scrollback, agents, sessions, refresh_tokens, oauth_tokens, users CASCADE`;
  });

  describe('User Repository', () => {
    test('creates and finds user', async () => {
      const input = {
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
        provider: 'github' as const,
        providerId: '12345',
      };

      const user = await userRepository.create(input, sql);

      expect(user.id).toBeDefined();
      expect(user.email).toBe(input.email);
      expect(user.name).toBe(input.name);
      expect(user.avatarUrl).toBe(input.avatarUrl);
      expect(user.provider).toBe(input.provider);
      expect(user.providerId).toBe(input.providerId);
      expect(user.createdAt).toBeInstanceOf(Date);

      // Find by ID
      const foundById = await userRepository.findById(user.id, sql);
      expect(foundById).toEqual(user);

      // Find by email
      const foundByEmail = await userRepository.findByEmail(user.email, sql);
      expect(foundByEmail).toEqual(user);

      // Find by provider
      const foundByProvider = await userRepository.findByProvider(user.provider, user.providerId, sql);
      expect(foundByProvider).toEqual(user);
    });

    test('upserts user by provider', async () => {
      const input = {
        email: 'test@example.com',
        name: 'Test User',
        provider: 'github' as const,
        providerId: '12345',
      };

      // First upsert creates
      const user1 = await userRepository.upsertByProvider(input, sql);
      expect(user1.id).toBeDefined();
      expect(user1.email).toBe(input.email);

      // Second upsert updates
      const updatedInput = { ...input, name: 'Updated Name' };
      const user2 = await userRepository.upsertByProvider(updatedInput, sql);

      expect(user2.id).toBe(user1.id); // Same user
      expect(user2.name).toBe('Updated Name');
      expect(user2.lastLoginAt).toBeDefined(); // Updated on upsert
    });

    test('updates user', async () => {
      const user = await userRepository.create({
        email: 'test@example.com',
        provider: 'github' as const,
        providerId: '12345',
      }, sql);

      const updated = await userRepository.update(user.id, {
        name: 'New Name',
        avatarUrl: 'https://new.com/avatar.png',
      }, sql);

      expect(updated?.name).toBe('New Name');
      expect(updated?.avatarUrl).toBe('https://new.com/avatar.png');
    });

    test('deletes user', async () => {
      const user = await userRepository.create({
        email: 'test@example.com',
        provider: 'github' as const,
        providerId: '12345',
      }, sql);

      const deleted = await userRepository.deleteById(user.id, sql);
      expect(deleted).toBe(true);

      const found = await userRepository.findById(user.id, sql);
      expect(found).toBeNull();
    });

    test('lists users with pagination', async () => {
      // Create multiple users
      for (let i = 0; i < 5; i++) {
        await userRepository.create({
          email: `user${i}@example.com`,
          provider: 'github' as const,
          providerId: `${i}`,
        }, sql);
      }

      const all = await userRepository.list({}, sql);
      expect(all.length).toBe(5);

      const page1 = await userRepository.list({ limit: 2, offset: 0 }, sql);
      expect(page1.length).toBe(2);

      const page2 = await userRepository.list({ limit: 2, offset: 2 }, sql);
      expect(page2.length).toBe(2);

      const count = await userRepository.count(sql);
      expect(count).toBe(5);
    });
  });

  describe('Session Repository', () => {
    let testUser: Awaited<ReturnType<typeof userRepository.create>>;

    beforeEach(async () => {
      testUser = await userRepository.create({
        email: 'session-test@example.com',
        provider: 'github' as const,
        providerId: 'session-test',
      }, sql);
    });

    test('creates and finds session', async () => {
      const input = {
        userId: testUser.id,
        agentConfig: {
          preset: 'single',
          agents: [{ type: 'claude' as const, name: 'Claude', command: 'claude' }],
        },
        workingDirectory: '/home/user/project',
      };

      const session = await sessionRepository.create(input, sql);

      expect(session.id).toBeDefined();
      expect(session.userId).toBe(testUser.id);
      expect(session.state).toBe('running');
      expect(session.workingDirectory).toBe(input.workingDirectory);
      expect(session.agentConfig).toEqual(input.agentConfig);

      const found = await sessionRepository.findById(session.id, sql);
      expect(found).toEqual(session);
    });

    test('updates session state', async () => {
      const session = await sessionRepository.create({
        userId: testUser.id,
        agentConfig: { preset: 'single', agents: [] },
        workingDirectory: '/test',
      }, sql);

      await sessionRepository.updateState(session.id, 'completed', sql);

      const updated = await sessionRepository.findById(session.id, sql);
      expect(updated?.state).toBe('completed');
      expect(updated?.completedAt).toBeDefined();
    });

    test('lists sessions with filters', async () => {
      // Create sessions
      await sessionRepository.create({
        userId: testUser.id,
        agentConfig: { preset: 'single', agents: [] },
        workingDirectory: '/test1',
      }, sql);

      const session2 = await sessionRepository.create({
        userId: testUser.id,
        agentConfig: { preset: 'single', agents: [] },
        workingDirectory: '/test2',
      }, sql);

      await sessionRepository.updateState(session2.id, 'completed', sql);

      // List all for user
      const all = await sessionRepository.list({ userId: testUser.id }, sql);
      expect(all.length).toBe(2);

      // List running only
      const running = await sessionRepository.list({ userId: testUser.id, state: 'running' }, sql);
      expect(running.length).toBe(1);

      // Get active sessions
      const active = await sessionRepository.getActiveSessions(testUser.id, sql);
      expect(active.length).toBe(1);
    });
  });

  describe('Agent Repository', () => {
    let testUser: Awaited<ReturnType<typeof userRepository.create>>;
    let testSession: Awaited<ReturnType<typeof sessionRepository.create>>;

    beforeEach(async () => {
      testUser = await userRepository.create({
        email: 'agent-test@example.com',
        provider: 'github' as const,
        providerId: 'agent-test',
      }, sql);

      testSession = await sessionRepository.create({
        userId: testUser.id,
        agentConfig: { preset: 'single', agents: [] },
        workingDirectory: '/test',
      }, sql);
    });

    test('creates and finds agent', async () => {
      const input = {
        sessionId: testSession.id,
        type: 'claude' as const,
        name: 'Claude Code',
        config: {
          type: 'claude' as const,
          name: 'Claude Code',
          command: 'claude',
          args: ['--model', 'opus'],
        },
      };

      const agent = await agentRepository.create(input, sql);

      expect(agent.id).toBeDefined();
      expect(agent.sessionId).toBe(testSession.id);
      expect(agent.type).toBe('claude');
      expect(agent.name).toBe('Claude Code');
      expect(agent.status).toBe('starting');

      const found = await agentRepository.findById(agent.id, sql);
      expect(found).toEqual(agent);
    });

    test('updates agent status', async () => {
      const agent = await agentRepository.create({
        sessionId: testSession.id,
        type: 'claude' as const,
        name: 'Test Agent',
        config: { type: 'claude' as const, name: 'Test', command: 'test' },
      }, sql);

      await agentRepository.markStarted(agent.id, 'container-123', sql);

      let updated = await agentRepository.findById(agent.id, sql);
      expect(updated?.status).toBe('running');
      expect(updated?.containerId).toBe('container-123');
      expect(updated?.startedAt).toBeDefined();

      await agentRepository.markStopped(agent.id, 0, 'exited', sql);

      updated = await agentRepository.findById(agent.id, sql);
      expect(updated?.status).toBe('exited');
      expect(updated?.exitCode).toBe(0);
      expect(updated?.stoppedAt).toBeDefined();
    });

    test('gets agents by session', async () => {
      await agentRepository.create({
        sessionId: testSession.id,
        type: 'claude' as const,
        name: 'Agent 1',
        config: { type: 'claude' as const, name: 'Agent 1', command: 'test' },
      }, sql);

      await agentRepository.create({
        sessionId: testSession.id,
        type: 'shell' as const,
        name: 'Agent 2',
        config: { type: 'shell' as const, name: 'Agent 2', command: 'sh' },
      }, sql);

      const agents = await agentRepository.getBySession(testSession.id, sql);
      expect(agents.length).toBe(2);
    });

    test('stops all agents for session', async () => {
      const agent1 = await agentRepository.create({
        sessionId: testSession.id,
        type: 'claude' as const,
        name: 'Agent 1',
        config: { type: 'claude' as const, name: 'Agent 1', command: 'test' },
      }, sql);

      const agent2 = await agentRepository.create({
        sessionId: testSession.id,
        type: 'shell' as const,
        name: 'Agent 2',
        config: { type: 'shell' as const, name: 'Agent 2', command: 'sh' },
      }, sql);

      await agentRepository.markStarted(agent1.id, undefined, sql);
      await agentRepository.markStarted(agent2.id, undefined, sql);

      const stopped = await agentRepository.stopAllForSession(testSession.id, 'exited', 0, sql);
      expect(stopped).toBe(2);

      const running = await agentRepository.getRunningBySession(testSession.id, sql);
      expect(running.length).toBe(0);
    });
  });

  describe('Client Repository', () => {
    let testUser: Awaited<ReturnType<typeof userRepository.create>>;
    let testSession: Awaited<ReturnType<typeof sessionRepository.create>>;

    beforeEach(async () => {
      testUser = await userRepository.create({
        email: 'client-test@example.com',
        provider: 'github' as const,
        providerId: 'client-test',
      }, sql);

      testSession = await sessionRepository.create({
        userId: testUser.id,
        agentConfig: { preset: 'single', agents: [] },
        workingDirectory: '/test',
      }, sql);
    });

    test('creates and finds client', async () => {
      const input = {
        id: 'client-001',
        sessionId: testSession.id,
        userId: testUser.id,
        clientType: 'pc' as const,
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      const client = await clientRepository.create(input, sql);

      expect(client.id).toBe('client-001');
      expect(client.sessionId).toBe(testSession.id);
      expect(client.clientType).toBe('pc');
      expect(client.priority).toBe('normal');

      const found = await clientRepository.findById(client.id, sql);
      expect(found).toEqual(client);
    });

    test('updates client priority', async () => {
      const client = await clientRepository.create({
        id: 'client-002',
        sessionId: testSession.id,
        clientType: 'mobile' as const,
      }, sql);

      await clientRepository.updatePriority(client.id, 'exclusive', sql);

      const updated = await clientRepository.findById(client.id, sql);
      expect(updated?.priority).toBe('exclusive');
    });

    test('records heartbeat', async () => {
      const client = await clientRepository.create({
        id: 'client-003',
        sessionId: testSession.id,
        clientType: 'pc' as const,
      }, sql);

      const originalHeartbeat = client.lastHeartbeatAt;

      // Wait a bit then heartbeat
      await new Promise((r) => setTimeout(r, 100));
      await clientRepository.heartbeat(client.id, sql);

      const updated = await clientRepository.findById(client.id, sql);
      expect(updated?.lastHeartbeatAt.getTime()).toBeGreaterThan(originalHeartbeat.getTime());
    });

    test('manages exclusive control', async () => {
      await clientRepository.create({
        id: 'client-pc',
        sessionId: testSession.id,
        clientType: 'pc' as const,
        priority: 'exclusive',
      }, sql);

      await clientRepository.create({
        id: 'client-mobile',
        sessionId: testSession.id,
        clientType: 'mobile' as const,
      }, sql);

      // Check for exclusive client
      const exclusive = await clientRepository.hasExclusiveClient(testSession.id, sql);
      expect(exclusive?.id).toBe('client-pc');

      // Release exclusive
      await clientRepository.releaseExclusive('client-pc', sql);

      const afterRelease = await clientRepository.hasExclusiveClient(testSession.id, sql);
      expect(afterRelease).toBeNull();
    });

    test('gets clients by type', async () => {
      await clientRepository.create({
        id: 'client-pc-1',
        sessionId: testSession.id,
        clientType: 'pc' as const,
      }, sql);

      await clientRepository.create({
        id: 'client-mobile-1',
        sessionId: testSession.id,
        clientType: 'mobile' as const,
      }, sql);

      const pcClients = await clientRepository.getPCClients(testSession.id, sql);
      expect(pcClients.length).toBe(1);
      expect(pcClients[0].clientType).toBe('pc');

      const mobileClients = await clientRepository.getMobileClients(testSession.id, sql);
      expect(mobileClients.length).toBe(1);
      expect(mobileClients[0].clientType).toBe('mobile');
    });

    test('deletes clients by session', async () => {
      await clientRepository.create({
        id: 'client-a',
        sessionId: testSession.id,
        clientType: 'pc' as const,
      }, sql);

      await clientRepository.create({
        id: 'client-b',
        sessionId: testSession.id,
        clientType: 'mobile' as const,
      }, sql);

      const count = await clientRepository.countBySession(testSession.id, sql);
      expect(count).toBe(2);

      const deleted = await clientRepository.deleteBySession(testSession.id, sql);
      expect(deleted).toBe(2);

      const afterDelete = await clientRepository.countBySession(testSession.id, sql);
      expect(afterDelete).toBe(0);
    });
  });
});
