'use client';

/**
 * React Query Provider
 * 데이터 페칭, 캐싱, 상태 관리를 위한 프로바이더
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 기본 stale time: 2분
            staleTime: 2 * 60 * 1000,
            // 기본 캐시 시간: 5분
            gcTime: 5 * 60 * 1000,
            // 재시도 횟수
            retry: 2,
            // 재시도 딜레이 (지수 백오프)
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // 포커스 시 리페치
            refetchOnWindowFocus: false,
            // 네트워크 재연결 시 리페치
            refetchOnReconnect: true,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      )}
    </QueryClientProvider>
  );
}
