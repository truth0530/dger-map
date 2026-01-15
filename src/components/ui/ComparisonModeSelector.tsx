'use client';

/**
 * 통합 지역 선택기 컴포넌트
 * 즐겨찾기 + 17개 시도 + 6개 광역 프리셋을 하나의 드롭다운으로 제공
 */

import { useCallback } from 'react';
import { REGIONS } from '@/lib/constants/dger';
import { BUILT_IN_REGION_PRESETS, RegionPreset } from '@/lib/utils/presetStorage';

// 단일 지역 선택, 광역 프리셋 선택, 또는 즐겨찾기
export type SelectionMode = 'single' | 'comparison' | 'favorites';

// 선택 결과 타입
export interface RegionSelection {
  mode: SelectionMode;
  // 단일 모드: 선택된 지역 (예: '대구')
  region: string;
  // 비교 모드: 선택된 프리셋
  preset: RegionPreset | null;
}

interface UnifiedRegionSelectorProps {
  isDark: boolean;
  // 현재 선택된 값 (지역명, 'preset:ID', 또는 'favorites')
  value: string;
  onChange: (selection: RegionSelection) => void;
  // 즐겨찾기 개수
  favoriteCount?: number;
  // 크기 옵션: 'xxs' | 'xs' | 'sm' | 'default'
  size?: 'xxs' | 'xs' | 'sm' | 'default';
  // 추가 클래스명
  className?: string;
}

/**
 * 통합 지역 선택기
 * - 즐겨찾기: 'favorites' value
 * - 17개 시도는 value로 직접 사용 (예: '대구')
 * - 6개 광역 프리셋은 preset:ID 형식으로 구분 (예: 'preset:builtin-daegu-gyeongbuk')
 */
export default function ComparisonModeSelector({
  isDark,
  value,
  onChange,
  favoriteCount = 0,
  size = 'default',
  className = ''
}: UnifiedRegionSelectorProps) {
  const handleChange = useCallback((selectedValue: string) => {
    if (selectedValue === 'favorites') {
      // 즐겨찾기 선택
      onChange({
        mode: 'favorites',
        region: '',
        preset: null
      });
    } else if (selectedValue.startsWith('preset:')) {
      // 프리셋 선택
      const presetId = selectedValue.replace('preset:', '');
      const preset = BUILT_IN_REGION_PRESETS.find(p => p.id === presetId);
      if (preset) {
        onChange({
          mode: 'comparison',
          region: preset.regions[0], // 첫 번째 지역을 기본값으로
          preset
        });
      }
    } else {
      // 단일 지역 선택
      onChange({
        mode: 'single',
        region: selectedValue,
        preset: null
      });
    }
  }, [onChange]);

  // 사이즈별 스타일
  const sizeStyles = {
    xxs: 'px-0.5 py-0 text-[9px] leading-tight',
    xs: 'px-1 py-0.5 text-[11px] h-6',
    sm: 'px-1.5 py-1 text-xs h-7',
    default: 'px-2 py-1.5 text-sm h-9'
  };

  const sizeMinWidth = {
    xxs: '46px',
    xs: '60px',
    sm: '70px',
    default: '90px'
  };

  const sizeHeight = {
    xxs: '18px',
    xs: '24px',
    sm: '28px',
    default: '36px'
  };

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className={`border rounded appearance-none cursor-pointer ${sizeStyles[size]} ${
        isDark
          ? 'bg-gray-800 border-gray-600 text-white'
          : 'bg-white border-gray-300 text-gray-900'
      } ${className}`}
      style={{
        minWidth: sizeMinWidth[size],
        height: sizeHeight[size],
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 2px center',
        paddingRight: '14px'
      }}
    >
      {/* 즐겨찾기 (최상단) */}
      {favoriteCount > 0 && (
        <option value="favorites">
          ★ 즐겨찾기 ({favoriteCount})
        </option>
      )}

      {/* 광역 프리셋 */}
      <optgroup label="광역">
        {BUILT_IN_REGION_PRESETS.map(preset => (
          <option key={preset.id} value={`preset:${preset.id}`}>
            {preset.name}
          </option>
        ))}
      </optgroup>

      {/* 17개 시도 */}
      <optgroup label="시도">
        {REGIONS.map(region => (
          <option key={region.value} value={region.value}>
            {region.value}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
