'use client';

import { useState } from 'react';
import { Lock, Unlock, X, Check, Skull } from 'lucide-react';
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
}

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
}: ControlBarProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showKillConfirm, setShowKillConfirm] = useState(false);

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

  const handleKill = () => {
    setShowKillConfirm(true);
  };

  const confirmKill = () => {
    setShowKillConfirm(false);
    onKill();
  };

  return (
    <>
      {/* Control Status Bar (v2) */}
      {controlStatus && (
        <div className="fixed bottom-16 left-0 right-0 bg-zinc-900/95 border-t border-zinc-800 px-4 py-2 safe-area-inset-bottom">
          <div className="flex items-center justify-center max-w-lg mx-auto">
            <ControlStatus
              state={controlStatus.state}
              activeClient={controlStatus.activeClient}
              exclusiveTimeRemaining={controlStatus.exclusiveTimeRemaining}
            />
          </div>
        </div>
      )}

      {/* Main Control Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 p-3 safe-area-inset-bottom">
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
          {/* Mode Toggle */}
          <button
            onClick={handleToggle}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm
              transition-all duration-200
              ${isReadOnly
                ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                : 'bg-yellow-500 text-black hover:bg-yellow-400'
              }
            `}
          >
            {isReadOnly ? <Lock size={18} /> : <Unlock size={18} />}
            {isReadOnly ? 'Read-Only' : 'Edit Mode'}
          </button>

          {/* Take Control Button (v2 mobile) */}
          {controlStatus && onRequestControl && onReleaseControl && (
            <TakeControlButton
              controlStatus={controlStatus}
              onRequestControl={onRequestControl}
              onReleaseControl={onReleaseControl}
              isPending={isControlPending}
            />
          )}

          {/* Approval Buttons (shown when pending) */}
          {pendingApproval && (
            <div className="flex items-center gap-2">
              <button
                onClick={onDeny}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-zinc-700 text-white font-medium text-sm hover:bg-zinc-600 transition-colors"
              >
                <X size={18} />
                Deny
              </button>
              <button
                onClick={onApprove}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-zinc-200 transition-colors"
              >
                <Check size={18} />
                Approve
              </button>
            </div>
          )}

          {/* Kill Switch */}
          <button
            onClick={handleKill}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-500 transition-colors"
          >
            <Skull size={18} />
            Kill
          </button>
        </div>
      </div>

      {/* Pending Approval Banner */}
      {pendingApproval && (
        <div className="fixed bottom-20 left-0 right-0 bg-yellow-500 text-black px-4 py-3">
          <div className="max-w-lg mx-auto">
            <p className="font-medium text-sm">Approval Required</p>
            <code className="text-xs bg-yellow-600/30 px-2 py-0.5 rounded mt-1 block">
              {pendingApproval.command}
            </code>
            <p className="text-xs mt-1 opacity-75">{pendingApproval.reason}</p>
          </div>
        </div>
      )}

      {/* Toggle Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Enable Edit Mode?</h3>
            <p className="text-zinc-400 text-sm mb-6">
              You'll be able to type commands. This could interrupt running processes.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 text-white font-medium text-sm hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmToggle}
                className="flex-1 px-4 py-2.5 rounded-xl bg-yellow-500 text-black font-medium text-sm hover:bg-yellow-400 transition-colors"
              >
                Enable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kill Confirmation Modal */}
      {showKillConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Kill Process?</h3>
            <p className="text-zinc-400 text-sm mb-6">
              This will send Ctrl+C to stop the running process. Any unsaved work may be lost.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowKillConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 text-white font-medium text-sm hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmKill}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-500 transition-colors"
              >
                Kill Process
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ControlBar;
