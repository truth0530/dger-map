'use client';

/**
 * 병상 포화도 배터리 아이콘 컴포넌트
 * 병상현황, 응급메시지 등 여러 페이지에서 공용으로 사용
 */

interface OccupancyBatteryProps {
  rate: number;
  isDark: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function OccupancyBattery({ rate, isDark, size = 'medium' }: OccupancyBatteryProps) {
  const fillWidth = Math.min(100, Math.max(0, rate));
  const fillClass = rate >= 95 ? 'bg-red-500' : rate >= 60 ? 'bg-amber-500' : 'bg-green-500';

  const sizeConfig = {
    small: { wrapper: 'w-9 h-5 border', text: 'text-[10px] leading-none', knobW: 2, knobH: 6, knobPos: -2 },
    medium: { wrapper: 'w-11 h-6 border', text: 'text-xs leading-none', knobW: 2, knobH: 8, knobPos: -2 },
    large: { wrapper: 'w-12 h-7 border-2', text: 'text-sm leading-none', knobW: 4, knobH: 10, knobPos: -4 },
  };

  const config = sizeConfig[size];

  // 텍스트 색상: 채워진 부분이 많으면 흰색, 적으면 배경에 맞게
  const textColor = rate >= 50
    ? 'text-white'
    : isDark ? 'text-gray-200' : 'text-gray-700';

  return (
    <div className="inline-flex items-center justify-center">
      <div className={`relative ${config.wrapper} rounded flex items-center justify-center border-gray-500`} style={{ background: 'transparent' }}>
        <div
          className={`absolute top-0.5 left-0.5 bottom-0.5 transition-all ${fillClass}`}
          style={{ width: `calc(${fillWidth}% - 4px)`, borderRadius: '2px' }}
        />
        <span className={`relative z-10 ${config.text} font-bold ${textColor}`}>
          {rate}%
        </span>
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            right: config.knobPos,
            width: config.knobW,
            height: config.knobH,
            backgroundColor: isDark ? '#6b7280' : '#ffffff',
            borderRadius: '1px'
          }}
        />
      </div>
    </div>
  );
}

/**
 * 기관 유형 뱃지 컴포넌트
 */
interface OrgTypeBadgeProps {
  type: '권역' | '센터' | '기관' | string;
  isDark?: boolean;
}

export function OrgTypeBadge({ type, isDark = false }: OrgTypeBadgeProps) {
  const badgeConfig: Record<string, { bg: string; text: string }> = {
    '권역': {
      bg: isDark ? 'bg-amber-600/30' : 'bg-amber-100',
      text: isDark ? 'text-amber-300' : 'text-amber-700'
    },
    '센터': {
      bg: isDark ? 'bg-blue-600/30' : 'bg-blue-100',
      text: isDark ? 'text-blue-300' : 'text-blue-700'
    },
    '기관': {
      bg: isDark ? 'bg-gray-600/30' : 'bg-gray-200',
      text: isDark ? 'text-gray-300' : 'text-gray-600'
    },
  };

  const config = badgeConfig[type] || badgeConfig['기관'];

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${config.bg} ${config.text}`}>
      {type}
    </span>
  );
}

/**
 * 포화도 계산 함수 (응급실 병상 기준)
 * @param total - 응급실 총 병상 수 (hvs01)
 * @param available - 응급실 가용 병상 수 (hvec)
 */
export function calculateOccupancyRate(total: number, available: number): { rate: number; occupied: number } {
  const occupied = Math.max(0, total - available);
  const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;
  return { rate, occupied };
}

export default OccupancyBattery;
