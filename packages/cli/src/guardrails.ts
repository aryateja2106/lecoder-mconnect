/**
 * Guardrails configuration and command checking
 */

export interface GuardrailConfig {
  level: 'default' | 'strict' | 'permissive' | 'none';
  blockedPatterns: RegExp[];
  approvalPatterns: RegExp[];
}

export interface CommandCheck {
  blocked: boolean;
  requiresApproval: boolean;
  reason?: string;
}

/**
 * Load guardrails configuration based on level
 */
export function loadGuardrails(level: string): GuardrailConfig {
  switch (level) {
    case 'strict':
      return {
        level: 'strict',
        blockedPatterns: [
          /rm\s+(-rf?|--recursive)\s+[\/~]/i,  // rm -rf on root or home
          /rm\s+-rf?\s+\.\/?$/i,                // rm -rf .
          /mkfs/i,                               // Format disk
          /dd\s+if=/i,                           // Direct disk write
          /:\(\)\{\s*:\|:&\s*\};:/,             // Fork bomb
          /chmod\s+-R\s+777/i,                   // Dangerous permissions
          />\s*\/dev\/sd/i,                      // Write to disk device
        ],
        approvalPatterns: [
          /rm\s/i,                               // Any rm command
          /git\s+push/i,                         // All git push
          /git\s+reset/i,                        // All git reset
          /npm\s+publish/i,                      // npm publish
          /docker\s+rm/i,                        // docker remove
          /kubectl\s+delete/i,                   // k8s delete
          /DROP\s+TABLE/i,                       // SQL drop
          /DELETE\s+FROM/i,                      // SQL delete
        ],
      };

    case 'permissive':
      return {
        level: 'permissive',
        blockedPatterns: [
          /rm\s+(-rf?|--recursive)\s+[\/~]/i,  // rm -rf on root or home
          /mkfs/i,                               // Format disk
          /dd\s+if=/i,                           // Direct disk write
          /:\(\)\{\s*:\|:&\s*\};:/,             // Fork bomb
        ],
        approvalPatterns: [
          /git\s+push\s+.*--force/i,            // Only force push
          /git\s+reset\s+--hard/i,              // Only hard reset
        ],
      };

    case 'none':
      return {
        level: 'none',
        blockedPatterns: [],
        approvalPatterns: [],
      };

    case 'default':
    default:
      return {
        level: 'default',
        blockedPatterns: [
          /rm\s+(-rf?|--recursive)\s+[\/~]/i,  // rm -rf on root or home
          /rm\s+-rf?\s+\.\/?$/i,                // rm -rf .
          /mkfs/i,                               // Format disk
          /dd\s+if=/i,                           // Direct disk write
          /:\(\)\{\s*:\|:&\s*\};:/,             // Fork bomb
        ],
        approvalPatterns: [
          /git\s+push\s+.*--force/i,            // Force push
          /git\s+reset\s+--hard/i,              // Hard reset
          /rm\s+-rf?\s+/i,                       // rm -rf (not root)
          /npm\s+publish/i,                      // npm publish
          /DROP\s+TABLE/i,                       // SQL drop
        ],
      };
  }
}

/**
 * Check if a command should be blocked or requires approval
 */
export function checkCommand(command: string, config: GuardrailConfig): CommandCheck {
  // Check blocked patterns first
  for (const pattern of config.blockedPatterns) {
    if (pattern.test(command)) {
      return {
        blocked: true,
        requiresApproval: false,
        reason: `Command blocked: matches dangerous pattern`,
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
function getApprovalReason(command: string): string {
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
  return 'Potentially destructive operation';
}
