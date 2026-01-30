/**
 * Tests for container module - MConnect v0.1.7
 *
 * Tests container isolation functionality:
 * - Container types and configuration
 * - DevContainer parsing
 * - Dockerfile templates
 * - ContainerManager operations
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// ContainerManager
import { getContainerManager, resetContainerManager } from '../container/container-manager.js';
// DevContainer parser
import {
  createDefaultDevContainerConfig,
  getContainerEnv,
  getContainerImage,
  getContainerUser,
  getVolumeMounts,
  hasDevContainerConfig,
  parseDevContainer,
  resolveVariables,
} from '../container/devcontainer.js';
// Dockerfile templates
import {
  DEFAULT_DOCKERFILE,
  detectProjectTemplate,
  generateDockerfile,
  getDockerfileTemplate,
  MINIMAL_DOCKERFILE,
  NODEJS_DOCKERFILE,
  PYTHON_DOCKERFILE,
} from '../container/dockerfile.js';
// Types
import type { ContainerConfig, DevContainerConfig } from '../container/types.js';
import {
  ARM64_COMPATIBLE_IMAGES,
  DEFAULT_CONTAINER_CONFIG,
  MCONNECT_DEFAULT_IMAGE,
} from '../container/types.js';

describe('Container Module', () => {
  describe('Container Types', () => {
    it('should export DEFAULT_CONTAINER_CONFIG', () => {
      expect(DEFAULT_CONTAINER_CONFIG).toBeDefined();
      expect(DEFAULT_CONTAINER_CONFIG.enabled).toBe(false);
      expect(DEFAULT_CONTAINER_CONFIG.image).toBe('ubuntu:22.04');
      expect(DEFAULT_CONTAINER_CONFIG.workDir).toBe('/workspace');
      expect(DEFAULT_CONTAINER_CONFIG.removeOnExit).toBe(true);
    });

    it('should export MCONNECT_DEFAULT_IMAGE', () => {
      expect(MCONNECT_DEFAULT_IMAGE).toBe('ubuntu:22.04');
    });

    it('should export ARM64_COMPATIBLE_IMAGES', () => {
      expect(ARM64_COMPATIBLE_IMAGES).toBeInstanceOf(Array);
      expect(ARM64_COMPATIBLE_IMAGES.length).toBeGreaterThan(0);
      expect(ARM64_COMPATIBLE_IMAGES).toContain('ubuntu:22.04');
      expect(ARM64_COMPATIBLE_IMAGES).toContain('alpine:3.19');
    });

    it('should allow creating ContainerConfig objects', () => {
      const config: ContainerConfig = {
        enabled: true,
        image: 'node:20',
        workDir: '/app',
        removeOnExit: false,
      };
      expect(config.enabled).toBe(true);
      expect(config.image).toBe('node:20');
    });
  });

  describe('DevContainer Parser', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'mconnect-test-'));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    describe('hasDevContainerConfig', () => {
      it('should return false when no devcontainer.json exists', () => {
        expect(hasDevContainerConfig(tempDir)).toBe(false);
      });

      it('should return true when devcontainer.json exists', () => {
        const devcontainerDir = join(tempDir, '.devcontainer');
        mkdirSync(devcontainerDir);
        writeFileSync(join(devcontainerDir, 'devcontainer.json'), JSON.stringify({ name: 'Test' }));
        expect(hasDevContainerConfig(tempDir)).toBe(true);
      });

      it('should return true when devcontainer.json in root exists', () => {
        writeFileSync(join(tempDir, '.devcontainer.json'), JSON.stringify({ name: 'Test' }));
        expect(hasDevContainerConfig(tempDir)).toBe(true);
      });
    });

    describe('parseDevContainer', () => {
      it('should return null when no config exists', () => {
        expect(parseDevContainer(tempDir)).toBeNull();
      });

      it('should parse valid devcontainer.json', () => {
        const devcontainerDir = join(tempDir, '.devcontainer');
        mkdirSync(devcontainerDir);
        writeFileSync(
          join(devcontainerDir, 'devcontainer.json'),
          JSON.stringify({
            name: 'Test Container',
            image: 'node:20',
            workspaceFolder: '/workspace/project',
            remoteUser: 'node',
          })
        );

        const config = parseDevContainer(tempDir);
        expect(config).not.toBeNull();
        expect(config?.name).toBe('Test Container');
        expect(config?.image).toBe('node:20');
        expect(config?.workspaceFolder).toBe('/workspace/project');
        expect(config?.remoteUser).toBe('node');
      });

      it('should handle JSON with comments (JSONC)', () => {
        const devcontainerDir = join(tempDir, '.devcontainer');
        mkdirSync(devcontainerDir);
        writeFileSync(
          join(devcontainerDir, 'devcontainer.json'),
          `{
            // This is a comment
            "name": "Test",
            /* Multi-line
               comment */
            "image": "ubuntu:22.04"
          }`
        );

        const config = parseDevContainer(tempDir);
        expect(config).not.toBeNull();
        expect(config?.name).toBe('Test');
        expect(config?.image).toBe('ubuntu:22.04');
      });

      it('should handle trailing commas', () => {
        const devcontainerDir = join(tempDir, '.devcontainer');
        mkdirSync(devcontainerDir);
        writeFileSync(
          join(devcontainerDir, 'devcontainer.json'),
          `{
            "name": "Test",
            "image": "ubuntu:22.04",
          }`
        );

        const config = parseDevContainer(tempDir);
        expect(config).not.toBeNull();
        expect(config?.name).toBe('Test');
      });
    });

    describe('resolveVariables', () => {
      it('should resolve localWorkspaceFolder variable', () => {
        const context = { localWorkspaceFolder: tempDir };
        const pattern = ['$', '{localWorkspaceFolder}/src'].join('');
        const result = resolveVariables(pattern, context);
        expect(result).toBe(`${tempDir}/src`);
      });

      it('should resolve localWorkspaceFolderBasename variable', () => {
        const context = { localWorkspaceFolder: '/home/user/my-project' };
        const pattern = ['/workspace/$', '{localWorkspaceFolderBasename}'].join('');
        const result = resolveVariables(pattern, context);
        expect(result).toBe('/workspace/my-project');
      });

      it('should resolve localEnv variable', () => {
        process.env.TEST_VAR = 'test_value';
        const context = { localWorkspaceFolder: tempDir };
        const pattern = ['prefix-$', '{localEnv:TEST_VAR}-suffix'].join('');
        const result = resolveVariables(pattern, context);
        expect(result).toBe('prefix-test_value-suffix');
        delete process.env.TEST_VAR;
      });

      it('should return empty string for undefined env vars', () => {
        const context = { localWorkspaceFolder: tempDir };
        const pattern = ['$', '{localEnv:UNDEFINED_VAR}'].join('');
        const result = resolveVariables(pattern, context);
        expect(result).toBe('');
      });
    });

    describe('getContainerImage', () => {
      it('should return image from config', () => {
        const config: DevContainerConfig = { image: 'python:3.12' };
        expect(getContainerImage(config)).toBe('python:3.12');
      });

      it('should return default image when no image specified', () => {
        const config: DevContainerConfig = { name: 'Test' };
        expect(getContainerImage(config)).toBe('ubuntu:22.04');
      });
    });

    describe('getVolumeMounts', () => {
      it('should return default workspace mount', () => {
        const config: DevContainerConfig = {};
        const mounts = getVolumeMounts(config, tempDir);
        expect(mounts).toHaveLength(1);
        expect(mounts[0]).toContain(`source=${tempDir}`);
        expect(mounts[0]).toContain('target=/workspace');
      });

      it('should include custom mounts', () => {
        const config: DevContainerConfig = {
          mounts: ['source=/host/path,target=/container/path,type=bind'],
        };
        const mounts = getVolumeMounts(config, tempDir);
        expect(mounts.length).toBeGreaterThanOrEqual(2);
        expect(mounts).toContain('source=/host/path,target=/container/path,type=bind');
      });
    });

    describe('getContainerEnv', () => {
      it('should return empty env for empty config', () => {
        const config: DevContainerConfig = {};
        const env = getContainerEnv(config);
        expect(Object.keys(env).length).toBe(0);
      });

      it('should merge containerEnv', () => {
        const config: DevContainerConfig = {
          containerEnv: { MY_VAR: 'value', TERM: 'xterm-256color' },
        };
        const env = getContainerEnv(config);
        expect(env.MY_VAR).toBe('value');
        expect(env.TERM).toBe('xterm-256color');
      });

      it('should merge remoteEnv', () => {
        const config: DevContainerConfig = {
          remoteEnv: { REMOTE_VAR: 'remote_value' },
        };
        const env = getContainerEnv(config);
        expect(env.REMOTE_VAR).toBe('remote_value');
      });

      it('should merge both containerEnv and remoteEnv', () => {
        const config: DevContainerConfig = {
          containerEnv: { CONTAINER_VAR: 'container' },
          remoteEnv: { REMOTE_VAR: 'remote' },
        };
        const env = getContainerEnv(config);
        expect(env.CONTAINER_VAR).toBe('container');
        expect(env.REMOTE_VAR).toBe('remote');
      });
    });

    describe('getContainerUser', () => {
      it('should return remoteUser when specified', () => {
        const config: DevContainerConfig = { remoteUser: 'node' };
        expect(getContainerUser(config)).toBe('node');
      });

      it('should return containerUser when specified', () => {
        const config: DevContainerConfig = { containerUser: 'root' };
        expect(getContainerUser(config)).toBe('root');
      });

      it('should return undefined when no user specified', () => {
        const config: DevContainerConfig = {};
        expect(getContainerUser(config)).toBeUndefined();
      });
    });

    describe('createDefaultDevContainerConfig', () => {
      it('should create default config', () => {
        const config = createDefaultDevContainerConfig('/home/user/my-project');
        expect(config.name).toBe('MConnect - my-project');
        expect(config.image).toBe('ubuntu:22.04');
        expect(config.workspaceFolder).toBe('/workspace');
        expect(config.remoteUser).toBe('root');
      });

      it('should use custom image when provided', () => {
        const config = createDefaultDevContainerConfig('/home/user/project', 'node:20');
        expect(config.image).toBe('node:20');
      });

      it('should include terminal env in containerEnv', () => {
        const config = createDefaultDevContainerConfig('/home/user/project');
        expect(config.containerEnv?.TERM).toBe('xterm-256color');
        expect(config.containerEnv?.COLORTERM).toBe('truecolor');
      });
    });
  });

  describe('Dockerfile Templates', () => {
    describe('template constants', () => {
      it('should export DEFAULT_DOCKERFILE', () => {
        expect(DEFAULT_DOCKERFILE).toBeDefined();
        expect(DEFAULT_DOCKERFILE).toContain('FROM ubuntu:22.04');
        expect(DEFAULT_DOCKERFILE).toContain('nodejs');
        expect(DEFAULT_DOCKERFILE).toContain('python3');
      });

      it('should export MINIMAL_DOCKERFILE', () => {
        expect(MINIMAL_DOCKERFILE).toBeDefined();
        expect(MINIMAL_DOCKERFILE).toContain('FROM alpine:3.19');
        expect(MINIMAL_DOCKERFILE).toContain('bash');
      });

      it('should export NODEJS_DOCKERFILE', () => {
        expect(NODEJS_DOCKERFILE).toBeDefined();
        expect(NODEJS_DOCKERFILE).toContain('FROM node:22-bookworm');
      });

      it('should export PYTHON_DOCKERFILE', () => {
        expect(PYTHON_DOCKERFILE).toBeDefined();
        expect(PYTHON_DOCKERFILE).toContain('FROM python:3.12-bookworm');
      });
    });

    describe('getDockerfileTemplate', () => {
      it('should return default template', () => {
        expect(getDockerfileTemplate('default')).toBe(DEFAULT_DOCKERFILE);
      });

      it('should return minimal template', () => {
        expect(getDockerfileTemplate('minimal')).toBe(MINIMAL_DOCKERFILE);
      });

      it('should return nodejs template', () => {
        expect(getDockerfileTemplate('nodejs')).toBe(NODEJS_DOCKERFILE);
      });

      it('should return python template', () => {
        expect(getDockerfileTemplate('python')).toBe(PYTHON_DOCKERFILE);
      });
    });

    describe('generateDockerfile', () => {
      it('should generate basic dockerfile', () => {
        const dockerfile = generateDockerfile({});
        expect(dockerfile).toContain('FROM ubuntu:22.04');
        expect(dockerfile).toContain('WORKDIR /workspace');
        expect(dockerfile).toContain('TERM=xterm-256color');
      });

      it('should use custom base image', () => {
        const dockerfile = generateDockerfile({ baseImage: 'debian:12' });
        expect(dockerfile).toContain('FROM debian:12');
      });

      it('should use custom workDir', () => {
        const dockerfile = generateDockerfile({ workDir: '/app' });
        expect(dockerfile).toContain('WORKDIR /app');
      });

      it('should include custom packages', () => {
        const dockerfile = generateDockerfile({
          packages: ['nginx', 'redis-server'],
        });
        expect(dockerfile).toContain('nginx');
        expect(dockerfile).toContain('redis-server');
      });

      it('should handle alpine base', () => {
        const dockerfile = generateDockerfile({
          baseImage: 'alpine:3.19',
        });
        expect(dockerfile).toContain('apk add');
        expect(dockerfile).not.toContain('apt-get');
      });
    });

    describe('detectProjectTemplate', () => {
      let tempDir: string;

      beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'mconnect-detect-'));
      });

      afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
      });

      it('should detect nodejs project', () => {
        writeFileSync(join(tempDir, 'package.json'), '{}');
        expect(detectProjectTemplate(tempDir)).toBe('nodejs');
      });

      it('should detect python project with requirements.txt', () => {
        writeFileSync(join(tempDir, 'requirements.txt'), '');
        expect(detectProjectTemplate(tempDir)).toBe('python');
      });

      it('should detect python project with pyproject.toml', () => {
        writeFileSync(join(tempDir, 'pyproject.toml'), '');
        expect(detectProjectTemplate(tempDir)).toBe('python');
      });

      it('should detect python project with setup.py', () => {
        writeFileSync(join(tempDir, 'setup.py'), '');
        expect(detectProjectTemplate(tempDir)).toBe('python');
      });

      it('should return default for unknown project', () => {
        expect(detectProjectTemplate(tempDir)).toBe('default');
      });
    });
  });

  describe('ContainerManager', () => {
    beforeEach(() => {
      resetContainerManager();
    });

    afterEach(() => {
      resetContainerManager();
    });

    describe('getContainerManager', () => {
      it('should return singleton instance', () => {
        const manager1 = getContainerManager();
        const manager2 = getContainerManager();
        expect(manager1).toBe(manager2);
      });

      it('should create new instance after reset', () => {
        const manager1 = getContainerManager();
        resetContainerManager();
        const manager2 = getContainerManager();
        expect(manager1).not.toBe(manager2);
      });
    });

    describe('checkDockerStatus', () => {
      it('should return status object', async () => {
        const manager = getContainerManager();
        const status = await manager.checkDockerStatus();
        expect(status).toHaveProperty('installed');
        expect(status).toHaveProperty('running');
        expect(typeof status.installed).toBe('boolean');
        expect(typeof status.running).toBe('boolean');
      });
    });

    describe('execInContainer', () => {
      it('should build docker exec command', () => {
        const manager = getContainerManager();
        const result = manager.execInContainer({
          containerId: 'test-container',
          command: '/bin/bash',
          args: ['-l'],
          workDir: '/workspace',
          tty: true,
          interactive: true,
        });

        expect(result.command).toBe('docker');
        expect(result.args).toContain('exec');
        expect(result.args).toContain('-i');
        expect(result.args).toContain('-t');
        expect(result.args).toContain('-w');
        expect(result.args).toContain('/workspace');
        expect(result.args).toContain('test-container');
        expect(result.args).toContain('/bin/bash');
        expect(result.args).toContain('-l');
      });

      it('should include environment variables', () => {
        const manager = getContainerManager();
        const result = manager.execInContainer({
          containerId: 'test-container',
          command: '/bin/sh',
          env: { MY_VAR: 'value' },
        });

        expect(result.args).toContain('-e');
        expect(result.args).toContain('MY_VAR=value');
      });

      it('should include user when specified', () => {
        const manager = getContainerManager();
        const result = manager.execInContainer({
          containerId: 'test-container',
          command: '/bin/sh',
          user: 'node',
        });

        expect(result.args).toContain('-u');
        expect(result.args).toContain('node');
      });
    });
  });
});
