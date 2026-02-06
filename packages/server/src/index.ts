/**
 * MConnect V2 Server
 *
 * Bun-based backend for AI agent orchestration.
 * This is the main entry point for the server.
 */

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

const server = Bun.serve({
  port: PORT,
  hostname: HOST,

  fetch(request: Request): Response {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
      });
    }

    // API version info
    if (url.pathname === '/') {
      return Response.json({
        name: 'MConnect V2 Server',
        version: '0.1.0',
        endpoints: {
          health: '/health',
          auth: '/auth/*',
          sessions: '/sessions/*',
          agents: '/agents/*',
        },
      });
    }

    // 404 for unmatched routes
    return Response.json({ error: 'Not Found' }, { status: 404 });
  },
});

console.log(`🚀 MConnect V2 Server running at http://${HOST}:${PORT}`);

export { server };
