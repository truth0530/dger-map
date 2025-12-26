'use client';

/**
 * 클라이언트 프로바이더 래퍼
 * React Query, 테마, 기타 클라이언트 사이드 프로바이더 통합
 */

import { QueryProvider } from './QueryProvider';
import { ErrorBoundary, PageErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/lib/contexts/ThemeContext';
import type { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <PageErrorBoundary>
          {children}
        </PageErrorBoundary>
      </QueryProvider>
    </ThemeProvider>
  );
}
