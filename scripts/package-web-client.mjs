#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const webOut = resolve(repoRoot, 'apps/web/out');
const cliAssets = resolve(repoRoot, 'packages/cli/assets/web');

if (!existsSync(resolve(webOut, 'index.html'))) {
  console.error('Missing apps/web/out/index.html. Run `npm run build:web` first.');
  process.exit(1);
}

rmSync(cliAssets, { recursive: true, force: true });
mkdirSync(cliAssets, { recursive: true });
cpSync(webOut, cliAssets, { recursive: true });

console.log(`Packaged web client: ${cliAssets}`);
