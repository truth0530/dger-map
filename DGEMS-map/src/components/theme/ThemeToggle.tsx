'use client';

/**
 * 테마 토글 버튼
 * 다크모드/라이트모드 전환
 */

import { useTheme } from '@/lib/contexts/ThemeContext';
import { useEffect, useState } from 'react';

function ThemeToggleContent() {
  const { toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    setMounted(true);
    const currentDark = document.documentElement.classList.contains('dark') ||
                       !document.documentElement.classList.contains('light');
    setIsDark(currentDark);
  }, []);

  const handleToggle = () => {
    toggleTheme();
    setIsDark(!isDark);
  };

  if (!mounted) {
    return null;
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        onClick={handleToggle}
        className="inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 relative"
        aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      >
        {/* 달 모양 아이콘 */}
        <svg
          className="w-5 h-5 text-blue-300"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      </button>

      {/* 마우스 오버시 표시되는 텍스트 */}
      <div
        className={`absolute top-full right-0 mt-2 px-2 py-1 text-xs text-white bg-gray-900 rounded whitespace-nowrap transition-opacity pointer-events-none z-50 ${
          showTooltip ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {isDark ? '라이트모드로 변경' : '다크모드로 변경'}
      </div>
    </div>
  );
}

export function ThemeToggle() {
  return <ThemeToggleContent />;
}
