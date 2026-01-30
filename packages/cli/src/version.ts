/**
 * Centralized version constant for MConnect CLI
 * Injected at build time from package.json via tsup
 */
declare const __VERSION__: string;

export const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0-dev';
