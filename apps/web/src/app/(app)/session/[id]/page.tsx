'use client';

import { use } from 'react';
import { SessionView } from '@/components/views/SessionView';

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SessionView sessionId={id} />;
}
