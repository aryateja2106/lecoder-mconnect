import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/__tests__/**',
        'src/index.ts',
        'src/index-v2.ts',  // CLI entry point - integration test
        'src/session.ts',   // Integration test - requires WebSocket server
        'src/session-v2.ts', // Integration test - requires full system
        'src/tunnel.ts',    // Integration test - requires cloudflared
        'src/web-client.ts', // Integration test - requires browser
        'src/web/**',       // Web modules - integration tests
        'src/ws/**',        // WebSocket modules - integration tests
      ],
      // Coverage thresholds for unit-testable modules
      // Reduced thresholds to account for mocked native modules
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 60,
        lines: 70,
      },
    },
    testTimeout: 15000,
    // Ensure mock isolation between tests
    mockReset: true,
    restoreMocks: true,
  },
});
