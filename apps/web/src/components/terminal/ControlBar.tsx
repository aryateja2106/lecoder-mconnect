'use client';

import { useState } from 'react';
import { Lock, Unlock, X, Check, Skull, ChevronUp, ChevronDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ControlStatus } from '../ControlStatus';
import { TakeControlButton } from '../TakeControlButton';
import type { ControlStatus as ControlStatusType } from '../../hooks/useControlState';

interface ControlBarProps {
  isReadOnly: boolean;
  onToggleMode: () => void;
  onApprove?: () => void;
  onDeny?: () => void;
  onKill: () => void;
  pendingApproval?: {
    command: string;
    reason: string;
  } | null;
  // v2 protocol additions
  controlStatus?: ControlStatusType;
  onRequestControl?: () => void;
  onReleaseControl?: () => void;
  isControlPending?: boolean;
  // Terminal input passthrough for keyboard helpers
  onSendKey?: (key: string) => void;
}

// Key helper definitions
const KEY_HELPERS = [
  { label: 'Esc', key: '\x1b', title: 'Escape' },
  { label: 'Tab', key: '\t', title: 'Tab' },
  { label: 'Ctrl+C', key: '\x03', title: 'Interrupt (Ctrl+C)' },
  { label: 'Ctrl+D', key: '\x04', title: 'EOF / Exit (Ctrl+D)' },
  { label: 'Ctrl+Z', key: '\x1a', title: 'Suspend (Ctrl+Z)' },
  { label: '', key: '\x1b[A', title: 'Up arrow' },
  { label: '', key: '\x1b[B', title: 'Down arrow' },
  { label: '', key: '\x1b[C', title: 'Right arrow' },
  { label: '', key: '\x1b[D', title: 'Left arrow' },
];

export function ControlBar({
  isReadOnly,
  onToggleMode,
  onApprove,
  onDeny,
  onKill,
  pendingApproval,
  controlStatus,
  onRequestControl,
  onReleaseControl,
  isControlPending,
  onSendKey,
}: ControlBarProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const [showKeyHelpers, setShowKeyHelpers] = useState(false);

  const handleToggle = () => {
    if (isReadOnly) {
      setShowConfirm(true);
    } else {
      onToggleMode();
    }
  };

  const confirmToggle = () => {
    setShowConfirm(false);
    onToggleMode();
  };

  const confirmKill = () => {
    setShowKillConfirm(false);
    onKill();
  };

  return (
    <TooltipProvider delayDuration={400}>
      {/* Control Status Bar (v2) */}
      {controlStatus && (
        <div className="bg-zinc-900/95 border-t border-zinc-800 px-4 py-2">
          <div className="flex items-center justify-center max-w-lg mx-auto">
            <ControlStatus
              state={controlStatus.state}
              activeClient={controlStatus.activeClient}
              exclusiveTimeRemaining={controlStatus.exclusiveTimeRemaining}
            />
          </div>
        </div>
      )}

      {/* Pending Approval Banner */}
      {pendingApproval && (
        <div className="bg-amber-950/80 border-t border-amber-500/30 px-4 py-3 backdrop-blur-sm">
          <div className="max-w-lg mx-auto">
            <p className="font-semibold text-amber-400 text-sm mb-1">Approval Required</p>
            <code className="text-xs bg-black/30 text-amber-300 px-2 py-1 rounded-lg font-mono block mb-1 truncate">
              {pendingApproval.command}
            </code>
            <p className="text-xs text-amber-500/80">{pendingApproval.reason}</p>
          </div>
        </div>
      )}

      {/* Mobile keyboard helpers toolbar (collapsible) */}
      {!isReadOnly && onSendKey && (
        <div className={`bg-zinc-900 border-t border-zinc-800 transition-all duration-200 ${showKeyHelpers ? 'max-h-16' : 'max-h-0 overflow-hidden border-t-0'}`}>
          <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto no-scrollbar">
            {KEY_HELPERS.map((kh) => (
              <button
                key={kh.key}
                onClick={() => onSendKey(kh.key)}
                title={kh.title}
                className="flex-shrink-0 h-8 min-w-[44px] px-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-mono hover:bg-zinc-700 hover:text-white active:bg-zinc-600 transition-colors"
              >
                {kh.label || (kh.key === '\x1b[A' ? '↑' : kh.key === '\x1b[B' ? '↓' : kh.key === '\x1b[C' ? '→' : '←')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Control Bar */}
      <div className="bg-zinc-950 border-t border-zinc-800 px-3 py-2.5 safe-area-inset-bottom">
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
          {/* Left: Mode toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleToggle}
                variant={isReadOnly ? 'secondary' : 'warning'}
                size="sm"
                className="gap-1.5 font-medium"
              >
                {isReadOnly ? <Lock size={15} /> : <Unlock size={15} />}
                {isReadOnly ? 'Read-only' : 'Editing'}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isReadOnly ? 'Enable edit mode to type' : 'Switch to read-only mode'}
            </TooltipContent>
          </Tooltip>

          {/* Center: Take control (v2 only) */}
          {controlStatus && onRequestControl && onReleaseControl && (
            <TakeControlButton
              controlStatus={controlStatus}
              onRequestControl={onRequestControl}
              onReleaseControl={onReleaseControl}
              isPending={isControlPending}
            />
          )}

          {/* Approval buttons (when pending) */}
          {pendingApproval && (
            <div className="flex items-center gap-1.5">
              <Button
                onClick={onDeny}
                variant="secondary"
                size="sm"
                className="gap-1"
              >
                <X size={14} />
                Deny
              </Button>
              <Button
                onClick={onApprove}
                variant="success"
                size="sm"
                className="gap-1"
              >
                <Check size={14} />
                Approve
              </Button>
            </div>
          )}

          {/* Right: Key helpers toggle + Kill */}
          <div className="flex items-center gap-1.5">
            {!isReadOnly && onSendKey && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowKeyHelpers(!showKeyHelpers)}
                    variant="ghost"
                    size="icon-sm"
                    className={showKeyHelpers ? 'bg-zinc-800 text-zinc-300' : 'text-zinc-500'}
                  >
                    {showKeyHelpers ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {showKeyHelpers ? 'Hide key helpers' : 'Show key helpers (Esc, Ctrl+C, arrows...)'}
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setShowKillConfirm(true)}
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                >
                  <Minus size={14} />
                  Kill
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Send Ctrl+C to stop the running process
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Toggle Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Skull size={18} className="text-yellow-400" />
              Enable Edit Mode?
            </DialogTitle>
            <DialogDescription>
              You will be able to type commands directly in the terminal. This could interrupt running processes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="secondary" onClick={() => setShowConfirm(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="warning" onClick={confirmToggle} className="flex-1">
              Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kill Confirmation Dialog */}
      <Dialog open={showKillConfirm} onOpenChange={setShowKillConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Skull size={18} className="text-red-400" />
              Kill Process?
            </DialogTitle>
            <DialogDescription>
              This will send Ctrl+C to stop the running process. Any unsaved work may be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="secondary" onClick={() => setShowKillConfirm(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmKill} className="flex-1">
              Kill Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

export default ControlBar;
