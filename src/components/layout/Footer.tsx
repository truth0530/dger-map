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
      className="border-t py-6"
      style={{
        backgroundColor: isDark ? '#111827' : '#1E3A3A',
        color: isDark ? '#9ca3af' : '#d1d5db',
        borderColor: isDark ? '#374151' : '#2d4a4a'
      }}
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* 기관 정보 */}
          <div className="text-sm">
            <p className="font-semibold mb-1" style={{ color: isDark ? '#d1d5db' : '#ffffff' }}>
              <a
                href="https://www.e-gen.or.kr/nemc/organization_chart.do"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:opacity-80"
              >
                국립중앙의료원 대구응급의료지원센터
              </a>
            </p>
            <p>사업자등록번호: 104-82-11329</p>
            <p>주소: 대구광역시 중구 동덕로 167</p>
          </div>

          {/* 저작권 */}
          <div className="text-sm text-right">
            <p>&copy; 2021 DGER. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
