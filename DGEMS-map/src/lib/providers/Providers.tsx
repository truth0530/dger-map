'use client';

/**
 * 클라이언트 프로바이더 래퍼
 * React Query, 기타 클라이언트 사이드 프로바이더 통합
 */

import { QueryProvider } from './QueryProvider';
import { ErrorBoundary, PageErrorBoundary } from '@/components/ErrorBoundary';
import type { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <PageErrorBoundary>
        {children}
      </PageErrorBoundary>
    </QueryProvider>
  );
}
