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
 * Default blocked patterns (dangerous, never allow)
 * These patterns prevent system-destroying operations.
 */
const BLOCKED_PATTERNS_BASE = [
    /rm\s+(-rf?|--recursive)\s+[/~]/i, // rm -rf on root or home
    /rm\s+-rf?\s+\.\/?$/i, // rm -rf .
    /mkfs/i, // Format disk
    /dd\s+if=/i, // Direct disk write
    /:\(\)\{\s*:\|:&\s*\};:/, // Fork bomb
    /chmod\s+-R\s+777/i, // Dangerous permissions
    />\s*\/dev\/sd/i, // Write to disk device
];
/**
 * Approval patterns by security level
 */
const APPROVAL_PATTERNS = {
    none: [],
    permissive: [
        /git\s+push\s+.*--force/i, // Only force push
        /git\s+reset\s+--hard/i, // Only hard reset
    ],
    default: [
        /git\s+push\s+.*--force/i, // Force push
        /git\s+reset\s+--hard/i, // Hard reset
        /rm\s+-rf?\s+/i, // rm -rf (not root)
        /npm\s+publish/i, // npm publish
        /DROP\s+TABLE/i, // SQL drop
    ],
    strict: [
        /rm\s/i, // Any rm command
        /git\s+push/i, // All git push
        /git\s+reset/i, // All git reset
        /npm\s+publish/i, // npm publish
        /docker\s+rm/i, // docker remove
        /kubectl\s+delete/i, // k8s delete
        /DROP\s+TABLE/i, // SQL drop
        /DELETE\s+FROM/i, // SQL delete
    ],
};
/**
 * Load guardrails configuration based on level
 */
export function loadGuardrails(level) {
    const normalizedLevel = normalizeLevel(level);
    switch (normalizedLevel) {
        case 'strict':
            return {
                level: 'strict',
                blockedPatterns: BLOCKED_PATTERNS_BASE,
                approvalPatterns: APPROVAL_PATTERNS.strict,
            };
        case 'permissive':
            return {
                level: 'permissive',
                blockedPatterns: BLOCKED_PATTERNS_BASE.slice(0, 4), // Only critical
                approvalPatterns: APPROVAL_PATTERNS.permissive,
            };
        case 'none':
            return {
                level: 'none',
                blockedPatterns: [],
                approvalPatterns: [],
            };
        default:
            return {
                level: 'default',
                blockedPatterns: BLOCKED_PATTERNS_BASE,
                approvalPatterns: APPROVAL_PATTERNS.default,
            };
    }
}
/**
 * Normalize level string to GuardrailLevel
 */
function normalizeLevel(level) {
    const normalized = level.toLowerCase().trim();
    if (['none', 'permissive', 'default', 'strict'].includes(normalized)) {
        return normalized;
    }
    return 'default';
}
/**
 * Check if a command should be blocked or requires approval
 */
export function checkCommand(command, config) {
    // Check blocked patterns first
    for (const pattern of config.blockedPatterns) {
        if (pattern.test(command)) {
            return {
                blocked: true,
                requiresApproval: false,
                reason: 'Command blocked: matches dangerous pattern',
            };
        }
    }
    // Check approval patterns
    for (const pattern of config.approvalPatterns) {
        if (pattern.test(command)) {
            return {
                blocked: false,
                requiresApproval: true,
                reason: `Command requires approval: ${getApprovalReason(command)}`,
            };
        }
    }
    // Command is allowed
    return {
        blocked: false,
        requiresApproval: false,
    };
}
/**
 * Get a human-readable reason for why approval is required
 */
function getApprovalReason(command) {
    if (/git\s+push.*--force/i.test(command)) {
        return 'Force push can overwrite remote history';
    }
    if (/git\s+reset\s+--hard/i.test(command)) {
        return 'Hard reset will discard local changes';
    }
    if (/rm\s+-rf?/i.test(command)) {
        return 'Recursive delete operation';
    }
    if (/npm\s+publish/i.test(command)) {
        return 'Publishing to npm registry';
    }
    if (/DROP\s+TABLE/i.test(command)) {
        return 'Dropping database table';
    }
    if (/DELETE\s+FROM/i.test(command)) {
        return 'Deleting database records';
    }
    if (/git\s+push/i.test(command)) {
        return 'Pushing to remote repository';
    }
    if (/git\s+reset/i.test(command)) {
        return 'Resetting git state';
    }
    if (/docker\s+rm/i.test(command)) {
        return 'Removing Docker container';
    }
    if (/kubectl\s+delete/i.test(command)) {
        return 'Deleting Kubernetes resources';
    }
    return 'Potentially destructive operation';
}
/**
 * Filter a command, returning either the command or null if blocked
 */
export function filterCommand(command, config) {
    const check = checkCommand(command, config);
    if (check.blocked) {
        return { allowed: false, command: null, check };
    }
    // For approval patterns, we still allow the command but mark it
    return { allowed: true, command, check };
}
/**
 * Get all blocked patterns for a level
 */
export function getBlockedPatterns(level) {
    return loadGuardrails(level).blockedPatterns;
}
/**
 * Get all approval patterns for a level
 */
export function getApprovalPatterns(level) {
    return loadGuardrails(level).approvalPatterns;
}
/**
 * Check if guardrails are effectively disabled
 */
export function isGuardrailsDisabled(level) {
    return level === 'none';
}
/**
 * Get human-readable description of a guardrail level
 */
export function getGuardrailDescription(level) {
    switch (level) {
        case 'none':
            return 'No guardrails - all commands allowed (development only)';
        case 'permissive':
            return 'Minimal guardrails - only critical system commands blocked';
        case 'default':
            return 'Standard guardrails - dangerous commands blocked, destructive require approval';
        case 'strict':
            return 'Strict guardrails - most operations require approval';
    }
}
//# sourceMappingURL=index.js.map