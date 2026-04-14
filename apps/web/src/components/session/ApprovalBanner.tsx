'use client';

import { AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ApprovalRequest } from '@/types/agent';

/** Commands that carry elevated risk and should display the warning icon. */
const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\b/,
  /\bsudo\b/,
  /\bchmod\b/,
  /\bdd\s+if=/,
  /\bmkfs\b/,
  /\bformat\b/,
  />\s*\/dev\//,
  /\bkill\b/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bcurl\b.*\|\s*(?:sh|bash)/,
  /\bwget\b.*\|\s*(?:sh|bash)/,
];

function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

interface ApprovalBannerProps {
  approval: ApprovalRequest;
  onApprove: () => void;
  onDeny: () => void;
}

export function ApprovalBanner({ approval, onApprove, onDeny }: ApprovalBannerProps) {
  const dangerous = isDangerous(approval.command);

  return (
    <motion.div
      initial={{ translateY: '100%' }}
      animate={{ translateY: '0%' }}
      exit={{ translateY: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className={cn(
        'w-full border-t bg-zinc-900 px-4 pb-safe pt-3',
        dangerous ? 'border-yellow-500/30' : 'border-zinc-700/50'
      )}
    >
      {/* Header row */}
      <div className="mb-2 flex items-center gap-2">
        {dangerous && (
          <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" aria-hidden />
        )}
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Approval Required
        </span>
      </div>

      {/* Command */}
      <div
        className={cn(
          'mb-2 rounded-lg border px-3 py-2',
          dangerous
            ? 'border-yellow-500/20 bg-yellow-500/5'
            : 'border-zinc-700/50 bg-zinc-950/60'
        )}
      >
        <code
          className={cn(
            'break-all font-mono text-sm',
            dangerous ? 'text-yellow-300' : 'text-zinc-100'
          )}
        >
          {approval.command}
        </code>
      </div>

      {/* Reason */}
      {approval.reason && (
        <p className="mb-3 text-xs leading-relaxed text-zinc-400">{approval.reason}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          variant="success"
          className="min-h-[44px] flex-1"
          onClick={onApprove}
          aria-label="Allow this command"
        >
          Allow
        </Button>
        <Button
          variant="destructive"
          className="min-h-[44px] flex-1"
          onClick={onDeny}
          aria-label="Deny this command"
        >
          Deny
        </Button>
      </div>
    </motion.div>
  );
}

export default ApprovalBanner;
