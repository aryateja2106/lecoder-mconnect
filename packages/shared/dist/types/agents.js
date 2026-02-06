/**
 * Agent Types for MConnect V2
 *
 * Shell-first architecture: All agents run inside a shell for proper
 * PATH resolution and environment handling.
 *
 * Container support: Agents can optionally run inside Docker containers
 * for isolation, supporting both inline config and devcontainer.json.
 */
/**
 * Agent commands by type
 */
export const AGENT_COMMANDS = {
    claude: {
        shellCommand: 'claude',
        description: 'Claude Code CLI',
    },
    gemini: {
        shellCommand: 'gemini',
        description: 'Google Gemini CLI',
    },
    codex: {
        shellCommand: 'codex',
        description: 'OpenAI Codex CLI',
    },
    aider: {
        shellCommand: 'aider',
        description: 'Aider AI pair programmer',
    },
    shell: {
        shellCommand: '',
        description: 'Interactive shell',
    },
    custom: {
        shellCommand: '',
        description: 'Custom command',
    },
};
//# sourceMappingURL=agents.js.map