'use client';

import { useTheme } from '@/lib/contexts/ThemeContext';

interface LegendProps {
  position?: 'bottom-left' | 'top-left';
  showBedStatus?: boolean;
  className?: string;
}

/**
 * 공통 범례 컴포넌트
 * Maptiler(MapLibreMap)와 SVG 지도(KoreaSidoMap, KoreaGugunMap)에서 재사용
 */
export function Legend({
  position = 'bottom-left',
  showBedStatus = true,
  className = ''
}: LegendProps) {
  const { isDark } = useTheme();

  const positionClass = position === 'bottom-left' ? 'bottom-20 left-4' : 'top-4 left-4';
  const maxHeightClass = showBedStatus ? 'max-h-64 overflow-y-auto' : '';

  return (
    <div
      className={`absolute ${positionClass} z-10 backdrop-blur-sm rounded-lg shadow-lg border p-3 text-xs w-fit max-w-xs ${maxHeightClass} ${isDark ? 'bg-gray-900/95 border-gray-700/50' : 'bg-white/95 border-gray-300/50'} ${className}`}
    >
      {/* 기관분류 범례 */}
      <div>
        <div className={`font-semibold mb-2.5 text-[11px] uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          기관분류 범례
        </div>

        <div className="space-y-1.5">
          {/* 권역응급의료센터 */}
          <div className="flex items-center gap-2.5 flex-nowrap">
            <div
              className="w-3 h-3 flex-shrink-0 bg-emerald-500 shadow-sm"
              style={{ minWidth: '12px' }}
            />
            <span className={`text-[10px] whitespace-nowrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              권역응급의료센터
            </span>
          </div>

          {/* 지역응급의료센터 */}
          <div className="flex items-center gap-2.5 flex-nowrap">
            <div
              className="w-3 h-3 flex-shrink-0 bg-emerald-500 rounded-full shadow-sm"
              style={{ minWidth: '12px' }}
            />
            <span className={`text-[10px] whitespace-nowrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              지역응급의료센터
            </span>
          </div>

          {/* 지역응급의료기관 */}
          <div className="flex items-center gap-2.5 flex-nowrap">
            <div
              className="w-0 h-0 flex-shrink-0 shadow-sm"
              style={{
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderBottom: '10px solid rgb(16, 185, 129)'
              }}
            />
            <span className={`text-[10px] whitespace-nowrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              지역응급의료기관
            </span>
          </div>
        </div>
      </div>

      {/* 병상 상태 (선택사항) */}
      {showBedStatus && (
        <div className={`border-t pt-2.5 mt-2.5 ${isDark ? 'border-gray-700/50' : 'border-gray-300/50'}`}>
          <div className={`font-semibold text-[9px] uppercase mb-1.5 tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            병상 상태
          </div>

          <div className="space-y-1">
            {/* 여유 있음 */}
            <div className="flex items-center gap-2.5 flex-nowrap">
              <div className="w-2 h-2 flex-shrink-0 bg-green-500 rounded-full shadow-sm" />
              <span className={`text-[9px] whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                여유 있음
              </span>
            </div>

            {/* 적정 수준 */}
            <div className="flex items-center gap-2.5 flex-nowrap">
              <div className="w-2 h-2 flex-shrink-0 bg-blue-500 rounded-full shadow-sm" />
              <span className={`text-[9px] whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                적정 수준
              </span>
            </div>

            {/* 부족 */}
            <div className="flex items-center gap-2.5 flex-nowrap">
              <div className="w-2 h-2 flex-shrink-0 bg-red-500 rounded-full shadow-sm" />
              <span className={`text-[9px] whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                부족
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
