'use client';

/**
 * 테마 토글 버튼
 * 다크모드/라이트모드 전환
 */

import { useTheme } from '@/lib/contexts/ThemeContext';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const currentDark = document.documentElement.classList.contains('dark') ||
                       !document.documentElement.classList.contains('light');
    setIsDark(currentDark);
  }, []);

  const handleToggle = () => {
    try {
      const { toggleTheme } = useTheme();
      toggleTheme();
      const newDark = !isDark;
      setIsDark(newDark);
    } catch (error) {
      // ThemeProvider 외부에서 호출된 경우 무시
      console.warn('ThemeToggle: ThemeProvider context not available');
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <button
      onClick={handleToggle}
      className="inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {isDark ? (
        // 라이트 모드 아이콘 (해)
        <svg
          className="w-5 h-5 text-yellow-300"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 1.78a1 1 0 011.414 0l1.414 1.414a1 1 0 01-1.414 1.414L14.22 3.78a1 1 0 010-1.414zm2.828 4.22a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zm0 5.656a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zM4.22 14.22a1 1 0 011.414 0l1.414 1.414a1 1 0 11-1.414 1.414L4.22 15.634a1 1 0 010-1.414zm1.414-5.656a1 1 0 10-1.414-1.414L2.808 7.192a1 1 0 101.414 1.414L5.636 8.22zM10 18a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zm-4.22-1.78a1 1 0 011.414 0l1.414 1.414a1 1 0 11-1.414 1.414L5.78 15.634a1 1 0 010-1.414zM2 10a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zm14-4a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zM10 5a5 5 0 110 10 5 5 0 010-10z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        // 다크 모드 아이콘 (달)
        <svg
          className="w-5 h-5 text-blue-300"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  );
}
