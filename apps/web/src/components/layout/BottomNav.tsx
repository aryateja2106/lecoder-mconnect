'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Bot, Sparkles, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoxStore } from '@/stores/voxStore';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, isVox: false },
  { href: '/agents', label: 'Agents', icon: Bot, isVox: false },
  { href: '#vox', label: 'Vox', icon: Sparkles, isVox: true },
  { href: '/feedback', label: 'Feedback', icon: BarChart3, isVox: false },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const openVox = useVoxStore((s) => s.open);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-800 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {navItems.map((item) => {
          if (item.isVox) {
            return (
              <button
                key={item.label}
                onClick={openVox}
                className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] group"
              >
                <div className="w-9 h-9 rounded-xl bg-[var(--agent-active)]/10 border border-[var(--agent-active)]/20 flex items-center justify-center group-active:scale-95 transition-transform">
                  <item.icon size={18} className="text-[var(--agent-active)]" />
                </div>
              </button>
            );
          }

          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] transition-colors',
                isActive ? 'text-white' : 'text-zinc-500'
              )}
            >
              <item.icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
