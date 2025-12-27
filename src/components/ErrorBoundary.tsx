'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * 에러 경계 컴포넌트
 * React 컴포넌트 트리에서 발생하는 JavaScript 에러를 잡아서
 * 폴백 UI를 표시합니다.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] 에러 발생:', error);
    console.error('[ErrorBoundary] 컴포넌트 스택:', errorInfo.componentStack);

    this.setState({ errorInfo });

    // 외부 에러 핸들러 호출
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // 커스텀 폴백이 제공된 경우
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 기본 에러 UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-gray-800 rounded-lg border border-red-500/30 p-6 text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="w-12 h-12 text-red-400" />
            </div>

            <h2 className="text-xl font-semibold text-white mb-2">
              오류가 발생했습니다
            </h2>

            <p className="text-gray-400 mb-4">
              예기치 않은 오류가 발생했습니다. 페이지를 새로고침하거나 다시 시도해 주세요.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-4 p-3 bg-red-900/20 rounded text-left">
                <p className="text-red-400 text-sm font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                다시 시도
              </button>

              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                페이지 새로고침
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 페이지 레벨 에러 경계
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error) => {
        // 프로덕션에서는 에러 트래킹 서비스로 전송
        if (process.env.NODE_ENV === 'production') {
          console.error('[PageError]', error);
        }
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * 섹션 레벨 에러 경계 (작은 영역용)
 */
export function SectionErrorBoundary({
  children,
  fallbackMessage = '이 섹션을 로드하는 중 오류가 발생했습니다.'
}: {
  children: ReactNode;
  fallbackMessage?: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-center">
          <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 text-sm">{fallbackMessage}</p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
