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

  // 텍스트 색상: 배경색과 모드에 따라 가독성 확보
  // - 빨강(95%+): 흰색
  // - 노랑/주황(60-94%): 다크모드=흰색, 라이트모드=진한 갈색
  // - 초록(50-59%): 흰색
  // - 낮은 비율(<50): 배경색에 맞게
  const getTextColor = () => {
    if (rate >= 95) return 'text-white'; // 빨간 배경
    if (rate >= 60) return isDark ? 'text-white' : 'text-amber-900'; // 노란/주황 배경
    if (rate >= 50) return 'text-white'; // 초록 배경
    return isDark ? 'text-gray-200' : 'text-gray-700'; // 채워지지 않은 부분
  };
  const textColor = getTextColor();

  return (
    <div className="inline-flex items-center justify-center">
      <div className={`relative ${config.wrapper} rounded flex items-center justify-center border-gray-500`} style={{ background: 'transparent' }}>
        <div
          className={`absolute top-0.5 left-0.5 bottom-0.5 transition-all ${fillClass}`}
          style={{ width: `calc(${fillWidth}% - 4px)`, borderRadius: '2px' }}
        />
        <span className={`relative z-0 ${config.text} font-bold ${textColor}`}>
          {rate}%
        </span>
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            right: config.knobPos,
            width: config.knobW,
            height: config.knobH,
            backgroundColor: '#6b7280',
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
export default OccupancyBattery;
