'use client';

/**
 * 메인 네비게이션 컴포넌트
 * dger-api와 dger-map 기능 통합
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const NAV_ITEMS = [
  { href: '/', label: '병상현황', description: '응급실 병상 현황' },
  { href: '/severe', label: '중증질환', description: '27개 중증질환 수용현황' },
  { href: '/messages', label: '응급메시지', description: '병원별 응급 메시지 조회' },
  { href: '/map', label: '지도', description: '중증응급질환 지도 시각화' },
  { href: '/feedback', label: '피드백', description: '릴리즈 노트 및 피드백' }
];

/**
 * 스킵 네비게이션 컴포넌트
 * 키보드 사용자가 메인 콘텐츠로 바로 이동할 수 있도록 지원
 */
function SkipNavigation() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-[#0a3a82] focus:rounded-md focus:font-medium focus:shadow-lg"
    >
      본문으로 바로가기
    </a>
  );
}

export default function Navigation() {
  const pathname = usePathname();

  return (
    <>
      <SkipNavigation />
      <nav
        className="bg-[#0a3a82] text-white"
        role="navigation"
        aria-label="메인 네비게이션"
      >
        <div className="max-w-full mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* 로고 */}
            <Link
              href="/"
              className="font-bold text-lg hover:text-blue-200 transition-colors"
              aria-label="DGER 홈으로 이동"
            >
              DGER
            </Link>

            {/* 네비게이션 메뉴 */}
            <div className="flex items-center gap-1" role="menubar">
              {NAV_ITEMS.map(item => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                    title={item.description}
                    aria-label={item.description}
                    aria-current={isActive ? 'page' : undefined}
                    role="menuitem"
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* 테마 토글 */}
            <ThemeToggle />

          </div>
        </div>
      </nav>
    </>
  );
}
