/**
 * Container types for MConnect V2
 *
 * Supports both inline container configuration and Dev Container spec
 * for session isolation on any device including Raspberry Pi (aarch64).
 */
/**
 * Default container configuration
 */
export const DEFAULT_CONTAINER_CONFIG = {
    image: 'ubuntu:22.04',
    workDir: '/workspace',
    removeOnExit: true,
    privileged: false,
};
/**
 * Default MConnect dev container image
 */
export const MCONNECT_DEFAULT_IMAGE = 'ubuntu:22.04';
/**
 * Default container security profile
 */
export const DEFAULT_SECURITY_PROFILE = {
    pid: 'private',
    network: 'bridge',
    ipc: 'private',
    memory: '512m',
    cpus: '1.0',
    pids: 100,
    readOnlyRootfs: false,
    noNewPrivileges: true,
    capDrop: ['ALL'],
    capAdd: ['CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'SETGID', 'SETUID'],
    seccompProfile: 'default',
};
//# sourceMappingURL=container.js.map