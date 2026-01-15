#!/usr/bin/env node
/**
 * Minimal PTY test - run this to debug spawn issues
 * Usage: node test-pty.js
 */

const { createRequire } = require('module');

console.log('=== PTY Spawn Test ===\n');

// System info
console.log('Platform:', process.platform);
console.log('Arch:', process.arch);
console.log('Node:', process.version);
console.log('SHELL env:', process.env.SHELL);
console.log('CWD:', process.cwd());
console.log('');

// Try to load node-pty
let pty;
try {
  pty = require('node-pty');
  console.log('✓ node-pty loaded successfully');
} catch (err) {
  console.error('✗ Failed to load node-pty:', err.message);
  process.exit(1);
}

// Check spawn-helper on macOS
if (process.platform === 'darwin') {
  const path = require('path');
  const fs = require('fs');

  const nodePtyPath = require.resolve('node-pty');
  const libDir = path.dirname(nodePtyPath);
  const arch = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  const spawnHelperPath = path.join(libDir, '..', 'prebuilds', arch, 'spawn-helper');

  console.log('spawn-helper path:', spawnHelperPath);

  if (fs.existsSync(spawnHelperPath)) {
    console.log('✓ spawn-helper exists');
    try {
      fs.accessSync(spawnHelperPath, fs.constants.X_OK);
      console.log('✓ spawn-helper is executable');
    } catch {
      console.log('✗ spawn-helper is NOT executable');
      console.log('  Fix: chmod +x', spawnHelperPath);
    }
  } else {
    console.log('✗ spawn-helper NOT found');
    console.log('  Fix: npm rebuild node-pty');
  }
}

console.log('');

// Try to spawn a shell
const shell = process.env.SHELL || '/bin/bash';
console.log('Attempting to spawn:', shell);

try {
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
    env: process.env,
  });

  console.log('✓ PTY spawned successfully!');
  console.log('  PID:', ptyProcess.pid);

  // Collect some output
  let output = '';
  ptyProcess.onData((data) => {
    output += data;
    process.stdout.write(data);
  });

  // Send a test command
  setTimeout(() => {
    console.log('\n--- Sending test command: echo "Hello from PTY" ---\n');
    ptyProcess.write('echo "Hello from PTY"\r');
  }, 500);

  // Exit after 3 seconds
  setTimeout(() => {
    console.log('\n--- Test complete, killing PTY ---');
    ptyProcess.kill();
    console.log('\n✓ PTY test passed! Shell spawning works.');
    process.exit(0);
  }, 3000);

} catch (err) {
  console.error('✗ Failed to spawn PTY:', err.message);
  console.error('');
  console.error('Full error:', err);
  process.exit(1);
}
