import { describe, expect, test } from 'bun:test';

describe('MConnect V2 Server', () => {
  test('health endpoint returns ok status', async () => {
    // Import server to start it
    const { server } = await import('./index');

    try {
      const response = await fetch(`http://localhost:${server.port}/health`);
      const data = (await response.json()) as { status: string; version: string; timestamp: string };

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.version).toBe('0.1.0');
      expect(data.timestamp).toBeDefined();
    } finally {
      server.stop();
    }
  });

  test('root endpoint returns API info', async () => {
    const { server } = await import('./index');

    try {
      const response = await fetch(`http://localhost:${server.port}/`);
      const data = (await response.json()) as { name: string; endpoints: string[] };

      expect(response.status).toBe(200);
      expect(data.name).toBe('MConnect V2 Server');
      expect(data.endpoints).toBeDefined();
    } finally {
      server.stop();
    }
  });

  test('unknown routes return 404', async () => {
    const { server } = await import('./index');

    try {
      const response = await fetch(`http://localhost:${server.port}/unknown`);
      const data = (await response.json()) as { error: string };

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not Found');
    } finally {
      server.stop();
    }
  });
});
