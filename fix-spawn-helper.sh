#!/bin/bash
# Fix spawn-helper permissions for node-pty on macOS

echo "Fixing spawn-helper permissions..."

# Find and fix all spawn-helper binaries
find node_modules/node-pty/prebuilds -name "spawn-helper" -exec chmod +x {} \;

echo "✓ Done! Now run: node test-pty.js"
