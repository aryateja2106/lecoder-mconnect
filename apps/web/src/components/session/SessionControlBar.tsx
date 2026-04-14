'use client';

import { useState } from 'react';
import {
  Eye,
  Pencil,
  Square,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface SessionControlBarProps {
  isReadOnly: boolean;
  onSendKey: (key: string) => void;
  onToggleMode: () => void;
  onKill: () => void;
}

interface KeyButton {
  label: string;
  key: string;
  title: string;
  wide?: boolean;
}

const KEY_BUTTONS: KeyButton[] = [
  { label: 'C-c', key: '\x03', title: 'Ctrl+C — interrupt' },
  { label: 'C-d', key: '\x04', title: 'Ctrl+D — EOF / logout' },
  { label: 'C-z', key: '\x1a', title: 'Ctrl+Z — suspend' },
  { label: 'Tab', key: '\t', title: 'Tab — autocomplete', wide: true },
  { label: 'Esc', key: '\x1b', title: 'Escape' },
];

const ARROW_BUTTONS: { label: React.ReactNode; key: string; title: string; Icon: React.ElementType }[] = [
  { label: null, key: '\x1b[A', title: 'Up arrow', Icon: ChevronUp },
  { label: null, key: '\x1b[B', title: 'Down arrow', Icon: ChevronDown },
  { label: null, key: '\x1b[D', title: 'Left arrow', Icon: ChevronLeft },
  { label: null, key: '\x1b[C', title: 'Right arrow', Icon: ChevronRight },
];

export function SessionControlBar({
  isReadOnly,
  onSendKey,
  onToggleMode,
  onKill,
}: SessionControlBarProps) {
  const [killDialogOpen, setKillDialogOpen] = useState(false);

  function handleKillConfirm() {
    setKillDialogOpen(false);
    onKill();
  }

  return (
    <>
      <div
        className={cn(
          'flex h-[52px] shrink-0 items-center gap-1 border-t border-zinc-800 bg-zinc-900 px-2',
          'overflow-x-auto scrollbar-none'
        )}
      >
        {/* Keyboard shortcut buttons */}
        {KEY_BUTTONS.map(({ label, key, title, wide }) => (
          <button
            key={label}
            title={title}
            onClick={() => onSendKey(key)}
            disabled={isReadOnly}
            className={cn(
              'inline-flex h-11 shrink-0 items-center justify-center rounded-lg',
              'bg-zinc-800 font-mono text-xs text-zinc-300',
              'transition-colors hover:bg-zinc-700 hover:text-zinc-100',
              'disabled:cursor-not-allowed disabled:opacity-40',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400',
              wide ? 'min-w-[52px] px-3' : 'min-w-[44px] px-2'
            )}
          >
            {label}
          </button>
        ))}

        {/* Arrow keys */}
        {ARROW_BUTTONS.map(({ key, title, Icon }) => (
          <button
            key={key}
            title={title}
            onClick={() => onSendKey(key)}
            disabled={isReadOnly}
            className={cn(
              'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
              'bg-zinc-800 text-zinc-300',
              'transition-colors hover:bg-zinc-700 hover:text-zinc-100',
              'disabled:cursor-not-allowed disabled:opacity-40',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400'
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Toggle read-only / control mode */}
        <button
          title={isReadOnly ? 'Take control (edit mode)' : 'Release control (read-only)'}
          onClick={onToggleMode}
          className={cn(
            'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
            'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400',
            isReadOnly
              ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-[#1FD5F9]'
              : 'bg-[#1FD5F9]/10 text-[#1FD5F9] hover:bg-[#1FD5F9]/20'
          )}
        >
          {isReadOnly ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
        </button>

        {/* Kill session */}
        <button
          title="Kill session"
          onClick={() => setKillDialogOpen(true)}
          className={cn(
            'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
            'bg-zinc-800 text-zinc-400',
            'transition-colors hover:bg-red-500/10 hover:text-red-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400'
          )}
        >
          <Square className="h-4 w-4" />
        </button>
      </div>

      {/* Kill confirmation dialog */}
      <Dialog open={killDialogOpen} onOpenChange={setKillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kill session?</DialogTitle>
            <DialogDescription>
              This will send a kill signal to the running process. The session cannot be
              recovered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3">
            <Button
              variant="outline"
              className="min-h-[44px] flex-1"
              onClick={() => setKillDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-h-[44px] flex-1"
              onClick={handleKillConfirm}
            >
              Kill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SessionControlBar;
