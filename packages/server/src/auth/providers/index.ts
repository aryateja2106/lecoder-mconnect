/**
 * OAuth Provider Registry
 *
 * Exports all OAuth providers and registration functions.
 */

export { githubProvider, registerGitHubProvider } from './github.js';

/**
 * Register all OAuth providers
 * Call this during server initialization
 */
export function registerAllProviders(): void {
  // Import dynamically to avoid circular dependencies
  const { registerGitHubProvider } = require('./github.js');
  registerGitHubProvider();
}
