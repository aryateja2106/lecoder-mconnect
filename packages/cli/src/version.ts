/**
 * MConnect Version Module
 *
 * Single source of truth for version information.
 * All version references should import from this module.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Read version from package.json at build time
 * This ensures the version is always in sync with the npm package
 */
function getPackageVersion(): string {
  try {
    // In development: ../package.json (from src/)
    // In production: ../package.json (from dist/)
    const packagePath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return packageJson.version || '0.0.0';
  } catch {
    // Fallback if package.json can't be read
    return '0.1.7';
  }
}

/**
 * The current version of MConnect
 * Reads from package.json to ensure consistency
 */
export const VERSION = getPackageVersion();

/**
 * Version with 'v' prefix for display
 */
export const VERSION_DISPLAY = `v${VERSION}`;

/**
 * Full product name with version
 */
export const PRODUCT_NAME = `MConnect v${VERSION}`;
