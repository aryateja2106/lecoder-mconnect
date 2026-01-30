/**
 * Dockerfile templates for MConnect containers
 *
 * Provides default development container configurations
 * that work on both x86_64 and ARM64 (Raspberry Pi).
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Default Dockerfile for MConnect development containers
 *
 * Based on Ubuntu 22.04 with common development tools.
 * Supports both amd64 and arm64 architectures.
 */
export const DEFAULT_DOCKERFILE = `# MConnect Default Development Container
# Supports: linux/amd64, linux/arm64

FROM ubuntu:22.04

# Avoid prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install common development tools
RUN apt-get update && apt-get install -y \\
    # Essential tools
    git \\
    curl \\
    wget \\
    vim \\
    nano \\
    less \\
    htop \\
    # Build tools
    build-essential \\
    ca-certificates \\
    gnupg \\
    # Shell utilities
    zsh \\
    tmux \\
    jq \\
    # Network tools
    openssh-client \\
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 22.x (LTS)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \\
    && apt-get install -y nodejs \\
    && rm -rf /var/lib/apt/lists/*

# Install Python 3
RUN apt-get update && apt-get install -y \\
    python3 \\
    python3-pip \\
    python3-venv \\
    && rm -rf /var/lib/apt/lists/*

# Set up workspace directory
WORKDIR /workspace

# Set terminal environment
ENV TERM=xterm-256color
ENV COLORTERM=truecolor
ENV FORCE_COLOR=1

# Default to bash
CMD ["/bin/bash"]
`;

/**
 * Minimal Dockerfile for lightweight containers
 * Good for Raspberry Pi and resource-constrained environments
 */
export const MINIMAL_DOCKERFILE = `# MConnect Minimal Container
# Lightweight image for resource-constrained environments

FROM alpine:3.19

# Install essential tools only
RUN apk add --no-cache \\
    bash \\
    git \\
    curl \\
    vim \\
    openssh-client

# Set up workspace
WORKDIR /workspace

# Set terminal environment
ENV TERM=xterm-256color

CMD ["/bin/bash"]
`;

/**
 * Node.js focused Dockerfile
 */
export const NODEJS_DOCKERFILE = `# MConnect Node.js Development Container

FROM node:22-bookworm

# Install additional tools
RUN apt-get update && apt-get install -y \\
    git \\
    vim \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Set up workspace
WORKDIR /workspace

# Set terminal environment
ENV TERM=xterm-256color
ENV COLORTERM=truecolor

CMD ["/bin/bash"]
`;

/**
 * Python focused Dockerfile
 */
export const PYTHON_DOCKERFILE = `# MConnect Python Development Container

FROM python:3.12-bookworm

# Install additional tools
RUN apt-get update && apt-get install -y \\
    git \\
    vim \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Set up workspace
WORKDIR /workspace

# Set terminal environment
ENV TERM=xterm-256color
ENV COLORTERM=truecolor

CMD ["/bin/bash"]
`;

/**
 * Get a Dockerfile template by name
 *
 * @param template - Template name: 'default', 'minimal', 'nodejs', 'python'
 * @returns Dockerfile content
 */
export function getDockerfileTemplate(
  template: 'default' | 'minimal' | 'nodejs' | 'python' = 'default'
): string {
  switch (template) {
    case 'minimal':
      return MINIMAL_DOCKERFILE;
    case 'nodejs':
      return NODEJS_DOCKERFILE;
    case 'python':
      return PYTHON_DOCKERFILE;
    default:
      return DEFAULT_DOCKERFILE;
  }
}

/**
 * Generate a Dockerfile from configuration
 *
 * @param baseImage - Base image to use
 * @param packages - Additional packages to install
 * @param workDir - Working directory inside container
 * @returns Generated Dockerfile content
 */
export function generateDockerfile(options: {
  baseImage?: string;
  packages?: string[];
  workDir?: string;
  nodeVersion?: string;
  pythonVersion?: string;
}): string {
  const {
    baseImage = 'ubuntu:22.04',
    packages = [],
    workDir = '/workspace',
    nodeVersion,
    pythonVersion,
  } = options;

  const lines: string[] = [
    `# MConnect Generated Development Container`,
    `FROM ${baseImage}`,
    '',
    '# Avoid prompts during package installation',
    'ENV DEBIAN_FRONTEND=noninteractive',
    '',
  ];

  // Determine package manager based on base image
  const isAlpine = baseImage.includes('alpine');
  const installCmd = isAlpine ? 'apk add --no-cache' : 'apt-get update && apt-get install -y';
  const cleanCmd = isAlpine ? '' : '&& rm -rf /var/lib/apt/lists/*';

  // Base packages
  const basePackages = isAlpine
    ? ['bash', 'git', 'curl', 'vim']
    : ['git', 'curl', 'vim', 'ca-certificates'];

  const allPackages = [...basePackages, ...packages];

  if (allPackages.length > 0) {
    lines.push('# Install packages');
    lines.push(`RUN ${installCmd} \\`);
    lines.push(`    ${allPackages.join(' \\\n    ')} \\`);
    lines.push(`    ${cleanCmd}`);
    lines.push('');
  }

  // Node.js installation
  if (nodeVersion && !isAlpine) {
    lines.push(`# Install Node.js ${nodeVersion}`);
    lines.push(`RUN curl -fsSL https://deb.nodesource.com/setup_${nodeVersion}.x | bash - \\`);
    lines.push('    && apt-get install -y nodejs \\');
    lines.push('    && rm -rf /var/lib/apt/lists/*');
    lines.push('');
  }

  // Python installation (usually pre-installed, but explicit version)
  if (pythonVersion && !isAlpine && !baseImage.includes('python')) {
    lines.push(`# Install Python ${pythonVersion}`);
    lines.push('RUN apt-get update && apt-get install -y \\');
    lines.push(`    python${pythonVersion} \\`);
    lines.push(`    python${pythonVersion}-pip \\`);
    lines.push(`    python${pythonVersion}-venv \\`);
    lines.push('    && rm -rf /var/lib/apt/lists/*');
    lines.push('');
  }

  // Workspace setup
  lines.push('# Set up workspace');
  lines.push(`WORKDIR ${workDir}`);
  lines.push('');

  // Environment
  lines.push('# Set terminal environment');
  lines.push('ENV TERM=xterm-256color');
  lines.push('ENV COLORTERM=truecolor');
  lines.push('ENV FORCE_COLOR=1');
  lines.push('');

  // Default command
  lines.push('CMD ["/bin/bash"]');

  return lines.join('\n');
}

/**
 * Detect project type and suggest appropriate Dockerfile template
 *
 * @param workspaceDir - Path to workspace
 * @returns Suggested template name
 */
export function detectProjectTemplate(
  workspaceDir: string
): 'default' | 'nodejs' | 'python' | 'minimal' {
  // Check for Node.js project
  if (existsSync(join(workspaceDir, 'package.json'))) {
    return 'nodejs';
  }

  // Check for Python project
  if (
    existsSync(join(workspaceDir, 'requirements.txt')) ||
    existsSync(join(workspaceDir, 'pyproject.toml')) ||
    existsSync(join(workspaceDir, 'setup.py'))
  ) {
    return 'python';
  }

  // Default to full development container
  return 'default';
}
