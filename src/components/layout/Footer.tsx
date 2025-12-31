'use client';

/**
 * 푸터 컴포넌트
 * 국립중앙의료원 정보 및 사업자 정보 표시
 * 카카오 비즈앱 등록 요건 충족을 위해 필요
 */

import { useTheme } from '@/lib/contexts/ThemeContext';

export default function Footer() {
  const { isDark } = useTheme();

  return (
    <footer
      className="border-t py-5"
      style={{
        backgroundColor: isDark ? '#0f172a' : '#173535',
        color: isDark ? '#94a3b8' : '#d4d4d8',
        borderColor: isDark ? '#334155' : '#2a4a4a'
      }}
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-col gap-1">
            <a
              href="https://www.e-gen.or.kr/nemc/organization_chart.do"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold transition-colors hover:opacity-80"
              style={{ color: isDark ? '#e2e8f0' : '#ffffff' }}
            >
              국립중앙의료원 대구응급의료지원센터
            </a>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1">
                <span className="opacity-70">사업자등록번호</span>
                <span>104-82-11329</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="opacity-70">주소</span>
                <span>대구광역시 중구 동덕로 167</span>
              </span>
            </div>
          </div>

          <div className="text-xs md:text-sm md:text-right">
            <p>&copy; 2021 DGER. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
