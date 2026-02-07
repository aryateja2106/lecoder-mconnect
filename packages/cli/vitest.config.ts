import { defineConfig } from 'vitest/config';

// Tests that require native modules (node-pty, better-sqlite3) which may fail in CI
const nativeModuleTests = [
  'src/__tests__/pty-manager.test.ts',
  'src/__tests__/scrollback-buffer.test.ts',
  'src/__tests__/session-manager.test.ts',
];

// Skip native module tests in CI on Linux (PTY spawning fails)
// Set SKIP_NATIVE_TESTS=true to skip, or run on macOS for full coverage
const skipNativeTests = process.env.SKIP_NATIVE_TESTS === 'true';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    exclude: skipNativeTests ? nativeModuleTests : [],
    // Use forks instead of threads for better native module cleanup (node-pty)
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Force exit after tests complete to prevent hanging on PTY cleanup
    teardownTimeout: 5000,
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
      // Reduced thresholds: native module tests skipped in CI (SKIP_NATIVE_TESTS=true),
      // and many modules are integration-only (session, tunnel, web, ws)
      thresholds: {
        statements: 35,
        branches: 55,
        functions: 50,
        lines: 35,
      },
    },
    testTimeout: 15000,
    // Ensure mock isolation between tests
    mockReset: true,
    restoreMocks: true,
  },
});
