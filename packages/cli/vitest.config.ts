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
