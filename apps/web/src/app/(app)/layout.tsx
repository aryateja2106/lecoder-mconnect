import { PageShell } from '@/components/layout/PageShell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <PageShell>{children}</PageShell>;
}
