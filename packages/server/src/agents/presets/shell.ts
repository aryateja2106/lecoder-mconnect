/**
 * Shell Agent Preset
 *
 * Configures a basic interactive shell agent. Can run either
 * containerized (for isolation) or directly on the host.
 */

import type { AgentPreset } from '@lecoder/shared';

/**
 * Shell container image - lightweight Alpine for fast startup
 */
export const SHELL_IMAGE = 'alpine:3.19';

/**
 * Shell agent preset
 *
 * Creates a single interactive shell agent in a container with:
 * - /bin/sh as the entry point (Alpine uses ash)
 * - 256MB memory (shells need less than AI agents)
 * - /workspace as the working directory
 */
export const shellPreset: AgentPreset = {
  name: 'shell',
  description: 'Interactive shell with container isolation',
  agents: [
    {
      type: 'shell',
      name: 'Shell',
      command: '/bin/sh',
      autoRun: true,
      env: {
        TERM: 'xterm-256color',
      },
      container: {
        image: SHELL_IMAGE,
        workDir: '/workspace',
        removeOnExit: true,
        resourceLimits: {
          memoryMB: 256,
          cpuShares: 512,
        },
      },
    },
  ],
};

/**
 * Ubuntu shell preset
 *
 * Full Ubuntu shell for development tasks that need apt-get,
 * build tools, etc.
 */
export const ubuntuShellPreset: AgentPreset = {
  name: 'ubuntu-shell',
  description: 'Ubuntu shell with development tools',
  agents: [
    {
      type: 'shell',
      name: 'Ubuntu Shell',
      command: '/bin/bash',
      autoRun: true,
      env: {
        TERM: 'xterm-256color',
      },
      container: {
        image: 'ubuntu:22.04',
        workDir: '/workspace',
        removeOnExit: true,
        resourceLimits: {
          memoryMB: 512,
          cpuShares: 1024,
        },
      },
    },
  ],
};
