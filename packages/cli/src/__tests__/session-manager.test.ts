/**
 * SessionManager Unit Tests
 * MConnect v0.2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../session/SessionManager.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let tempDir: string;

  beforeEach(() => {
    // Create temp directory for each test
    tempDir = mkdtempSync(join(tmpdir(), 'mconnect-test-'));
    sessionManager = new SessionManager({ dataDir: tempDir });
  });

  afterEach(async () => {
    // Cleanup
    await sessionManager.shutdown();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('createSession', () => {
    it('should create a new session with generated ID', () => {
      const session = sessionManager.createSession(
        { preset: 'single', agents: ['Claude'] },
        '/home/user/project'
      );

      expect(session.id).toBeDefined();
      expect(session.id.length).toBeGreaterThan(0);
      expect(session.state).toBe('running');
      expect(session.workingDirectory).toBe('/home/user/project');
      expect(session.agentConfig.preset).toBe('single');
    });

    it('should assign creation timestamp', () => {
      const before = new Date();
      const session = sessionManager.createSession(
        { preset: 'single', agents: [] },
        '/tmp'
      );
      const after = new Date();

      expect(session.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(session.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getSession', () => {
    it('should return session by ID', () => {
      const created = sessionManager.createSession(
        { preset: 'shell-only', agents: ['Shell'] },
        '/home'
      );

      const fetched = sessionManager.getSession(created.id);
      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.agentConfig.preset).toBe('shell-only');
    });

    it('should return null for non-existent session', () => {
      const session = sessionManager.getSession('non-existent-id');
      expect(session).toBeNull();
    });
  });

  describe('getAllSessions', () => {
    it('should return all active sessions', async () => {
      await sessionManager.initialize();

      sessionManager.createSession({ preset: 'a', agents: [] }, '/a');
      sessionManager.createSession({ preset: 'b', agents: [] }, '/b');

      const sessions = sessionManager.getAllSessions();
      expect(sessions.length).toBe(2);
    });

    it('should exclude completed sessions by default', async () => {
      await sessionManager.initialize();

      const session = sessionManager.createSession({ preset: 'a', agents: [] }, '/a');
      sessionManager.terminateSession(session.id);

      const sessions = sessionManager.getAllSessions();
      expect(sessions.length).toBe(0);
    });

    it('should include completed sessions when requested', async () => {
      await sessionManager.initialize();

      const session = sessionManager.createSession({ preset: 'a', agents: [] }, '/a');
      sessionManager.terminateSession(session.id);

      const sessions = sessionManager.getAllSessions(true);
      expect(sessions.length).toBe(1);
    });
  });

  describe('terminateSession', () => {
    it('should mark session as completed', async () => {
      await sessionManager.initialize();

      const session = sessionManager.createSession({ preset: 'test', agents: [] }, '/test');
      const result = sessionManager.terminateSession(session.id);

      expect(result).toBe(true);
      const fetched = sessionManager.getSession(session.id);
      expect(fetched?.state).toBe('completed');
    });

    it('should return false for non-existent session', async () => {
      await sessionManager.initialize();

      const result = sessionManager.terminateSession('fake-id');
      expect(result).toBe(false);
    });
  });

  describe('transitionState', () => {
    it('should update session state', async () => {
      await sessionManager.initialize();

      const session = sessionManager.createSession({ preset: 'test', agents: [] }, '/test');
      sessionManager.transitionState(session.id, 'paused');

      const fetched = sessionManager.getSession(session.id);
      expect(fetched?.state).toBe('paused');
    });
  });

  describe('client management', () => {
    it('should attach client to session', async () => {
      await sessionManager.initialize();

      const session = sessionManager.createSession({ preset: 'test', agents: [] }, '/test');
      const client = sessionManager.attachClient(session.id, 'client-1', 'pc');

      expect(client).toBeDefined();
      expect(client?.id).toBe('client-1');
      expect(client?.sessionId).toBe(session.id);
      expect(client?.clientType).toBe('pc');
    });

    it('should list clients for session', async () => {
      await sessionManager.initialize();

      const session = sessionManager.createSession({ preset: 'test', agents: [] }, '/test');
      sessionManager.attachClient(session.id, 'client-1', 'pc');
      sessionManager.attachClient(session.id, 'client-2', 'mobile');

      const clients = sessionManager.getSessionClients(session.id);
      expect(clients.length).toBe(2);
    });

    it('should detach client from session', async () => {
      await sessionManager.initialize();

      const session = sessionManager.createSession({ preset: 'test', agents: [] }, '/test');
      sessionManager.attachClient(session.id, 'client-1', 'pc');
      sessionManager.detachClient('client-1');

      const clients = sessionManager.getSessionClients(session.id);
      expect(clients.length).toBe(0);
    });
  });

  describe('scrollback', () => {
    it('should append and retrieve scrollback', async () => {
      await sessionManager.initialize();

      const session = sessionManager.createSession({ preset: 'test', agents: [] }, '/test');
      sessionManager.appendOutput(session.id, 'Hello World\n');
      sessionManager.appendOutput(session.id, 'Line 2\n');

      const scrollback = sessionManager.getScrollback(session.id, 0, 10);
      expect(scrollback.length).toBe(2);
      expect(scrollback[0]).toBe('Hello World');
      expect(scrollback[1]).toBe('Line 2');
    });

    it('should get scrollback line count', async () => {
      await sessionManager.initialize();

      const session = sessionManager.createSession({ preset: 'test', agents: [] }, '/test');
      sessionManager.appendOutput(session.id, 'Line 1\n');
      sessionManager.appendOutput(session.id, 'Line 2\n');
      sessionManager.appendOutput(session.id, 'Line 3\n');

      const count = sessionManager.getScrollbackLineCount(session.id);
      expect(count).toBe(3);
    });
  });

  describe('input logging', () => {
    it('should log input events', async () => {
      await sessionManager.initialize();

      const session = sessionManager.createSession({ preset: 'test', agents: [] }, '/test');
      sessionManager.logInput(session.id, 'client-1', 'ls -la', true);
      sessionManager.logInput(session.id, 'client-1', 'rm -rf /', false, 'rate_limited');

      const logs = sessionManager.getInputLog(session.id, 10);
      expect(logs.length).toBe(2);
      expect(logs[0].accepted).toBe(false);
      expect(logs[0].rejectReason).toBe('rate_limited');
      expect(logs[1].accepted).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return session statistics', async () => {
      await sessionManager.initialize();

      sessionManager.createSession({ preset: 'a', agents: [] }, '/a');
      const session = sessionManager.createSession({ preset: 'b', agents: [] }, '/b');
      sessionManager.terminateSession(session.id);

      const stats = sessionManager.getStats();
      expect(stats.running).toBe(1);
      expect(stats.completed).toBe(1);
    });
  });
});
