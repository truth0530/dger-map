'use client';

/**
 * 메인 네비게이션 컴포넌트
 * dger-api와 dger-map 기능 통합
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: '지도', description: '중증응급질환 지도 시각화' },
  { href: '/bed', label: '병상현황', description: '응급실 병상 현황' },
  { href: '/severe', label: '중증질환', description: '27개 중증질환 수용현황' }
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-[#0a3a82] text-white">
      <div className="max-w-full mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* 로고 */}
          <Link href="/" className="font-bold text-lg hover:text-blue-200 transition-colors">
            DGER
          </Link>

          {/* 네비게이션 메뉴 */}
          <div className="flex items-center gap-1">
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
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* 외부 링크 */}
          <div className="flex items-center gap-2">
            <a
              href="https://dger.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/60 hover:text-white/80 transition-colors"
            >
              dger.kr
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
