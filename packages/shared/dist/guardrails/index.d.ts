/**
 * Guardrails configuration and command checking
 *
 * Provides command filtering to prevent dangerous operations from
 * being executed on remote hosts. Supports 4 tiers:
 * - none: No filtering (development only)
 * - permissive: Block only critical system-destroying commands
 * - default: Block dangerous + require approval for destructive
 * - strict: Require approval for most operations
 */
/**
 * Guardrail security levels
 */
export type GuardrailLevel = 'none' | 'permissive' | 'default' | 'strict';
/**
 * Guardrail configuration
 */
export interface GuardrailConfig {
    /** Security level */
    level: GuardrailLevel;
    /** Patterns that are always blocked */
    blockedPatterns: RegExp[];
    /** Patterns that require approval */
    approvalPatterns: RegExp[];
}
/**
 * Result of command check
 */
export interface CommandCheck {
    /** Whether the command is blocked */
    blocked: boolean;
    /** Whether the command requires approval */
    requiresApproval: boolean;
    /** Human-readable reason */
    reason?: string;
}
/**
 * Load guardrails configuration based on level
 */
export declare function loadGuardrails(level: GuardrailLevel | string): GuardrailConfig;
/**
 * Check if a command should be blocked or requires approval
 */
export declare function checkCommand(command: string, config: GuardrailConfig): CommandCheck;
/**
 * Filter a command, returning either the command or null if blocked
 */
export declare function filterCommand(command: string, config: GuardrailConfig): {
    allowed: boolean;
    command: string | null;
    check: CommandCheck;
};
/**
 * Get all blocked patterns for a level
 */
export declare function getBlockedPatterns(level: GuardrailLevel): RegExp[];
/**
 * Get all approval patterns for a level
 */
export declare function getApprovalPatterns(level: GuardrailLevel): RegExp[];
/**
 * Check if guardrails are effectively disabled
 */
export declare function isGuardrailsDisabled(level: GuardrailLevel): boolean;
/**
 * Get human-readable description of a guardrail level
 */
export declare function getGuardrailDescription(level: GuardrailLevel): string;
//# sourceMappingURL=index.d.ts.map