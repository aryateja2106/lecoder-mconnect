'use client';

import { useState } from 'react';
import { Hand, X } from 'lucide-react';
import type { ControlStatus } from '../hooks/useControlState';

interface TakeControlButtonProps {
  controlStatus: ControlStatus;
  onRequestControl: () => void;
  onReleaseControl: () => void;
  isPending?: boolean;
  disabled?: boolean;
}

export function TakeControlButton({
  controlStatus,
  onRequestControl,
  onReleaseControl,
  isPending = false,
  disabled = false,
}: TakeControlButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);

  const handleTakeControl = () => {
    setShowConfirm(true);
  };

  const confirmTakeControl = () => {
    setShowConfirm(false);
    onRequestControl();
  };

  const handleReleaseControl = () => {
    setShowReleaseConfirm(true);
  };

  const confirmReleaseControl = () => {
    setShowReleaseConfirm(false);
    onReleaseControl();
  };

  // If we have exclusive control, show release button
  if (controlStatus.hasExclusiveControl) {
    return (
      <>
        <button
          onClick={handleReleaseControl}
          disabled={isPending || disabled}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm
            transition-all duration-200
            ${isPending || disabled
              ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-500'
            }
          `}
        >
          <X size={18} />
          {isPending ? 'Releasing...' : 'Release Control'}
        </button>

        {/* Release Confirmation Modal */}
        {showReleaseConfirm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold text-white mb-2">Release Control?</h3>
              <p className="text-zinc-400 text-sm mb-6">
                PC users will be able to type again immediately.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReleaseConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 text-white font-medium text-sm hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReleaseControl}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 text-white font-medium text-sm hover:bg-purple-500 transition-colors"
                >
                  Release
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // If we can't take control, show disabled button or hide
  if (!controlStatus.canTakeControl) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleTakeControl}
        disabled={isPending || disabled}
        className={`
          flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm
          transition-all duration-200
          ${isPending || disabled
            ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            : 'bg-purple-600 text-white hover:bg-purple-500'
          }
        `}
      >
        <Hand size={18} />
        {isPending ? 'Requesting...' : 'Take Control'}
      </button>

      {/* Take Control Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Take Exclusive Control?</h3>
            <p className="text-zinc-400 text-sm mb-4">
              You'll have exclusive control for 5 minutes. PC users won't be able to type during this time.
            </p>
            <p className="text-zinc-500 text-xs mb-6">
              The PC user will see a notification that you've taken control.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 text-white font-medium text-sm hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmTakeControl}
                className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 text-white font-medium text-sm hover:bg-purple-500 transition-colors"
              >
                Take Control
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TakeControlButton;
