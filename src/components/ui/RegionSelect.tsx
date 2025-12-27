'use client';

import { cn } from '@/lib/utils';
import { REGIONS } from '@/lib/constants/dger';

export type RegionValue = typeof REGIONS[number]['value'];

interface RegionSelectProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  label?: string;
  showLabel?: boolean;
  includeAll?: boolean;
  allLabel?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const SIZE_STYLES = {
  sm: 'px-2 py-1 text-xs h-7',
  md: 'px-3 py-2 text-sm h-9',
  lg: 'px-4 py-2.5 text-base h-11'
};

/**
 * 지역 선택 컴포넌트
 * 17개 시도 지역을 선택할 수 있는 드롭다운
 */
export function RegionSelect({
  value,
  onChange,
  id = 'regionSelect',
  label = '지역 선택',
  showLabel = false,
  includeAll = false,
  allLabel = '전국',
  className,
  size = 'md',
  disabled = false
}: RegionSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={id}
        className={cn(
          'text-sm text-gray-600 font-medium',
          !showLabel && 'sr-only'
        )}
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={label}
        className={cn(
          'border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3a82]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          SIZE_STYLES[size],
          className
        )}
      >
        {includeAll && (
          <option value="all">{allLabel}</option>
        )}
        {REGIONS.map(region => (
          <option key={region.value} value={region.value}>
            {region.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * 지역 선택 (전체 이름 형식)
 * MapDashboard에서 사용하는 전체 이름 형식 (서울특별시, 부산광역시 등)
 */
export const REGIONS_FULL = [
  { value: 'all', label: '전국' },
  { value: '서울특별시', label: '서울' },
  { value: '부산광역시', label: '부산' },
  { value: '대구광역시', label: '대구' },
  { value: '인천광역시', label: '인천' },
  { value: '광주광역시', label: '광주' },
  { value: '대전광역시', label: '대전' },
  { value: '울산광역시', label: '울산' },
  { value: '세종특별자치시', label: '세종' },
  { value: '경기도', label: '경기' },
  { value: '강원특별자치도', label: '강원' },
  { value: '충청북도', label: '충북' },
  { value: '충청남도', label: '충남' },
  { value: '전북특별자치도', label: '전북' },
  { value: '전라남도', label: '전남' },
  { value: '경상북도', label: '경북' },
  { value: '경상남도', label: '경남' },
  { value: '제주특별자치도', label: '제주' }
] as const;

export type RegionFullValue = typeof REGIONS_FULL[number]['value'];

interface RegionSelectFullProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  label?: string;
  showLabel?: boolean;
  includeAll?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

/**
 * 지역 선택 컴포넌트 (전체 이름 형식)
 * 지도 관련 컴포넌트에서 사용
 */
export function RegionSelectFull({
  value,
  onChange,
  id = 'regionSelect',
  label = '지역 선택',
  showLabel = false,
  includeAll = true,
  className,
  size = 'md',
  disabled = false
}: RegionSelectFullProps) {
  const regions = includeAll
    ? REGIONS_FULL
    : REGIONS_FULL.filter(r => r.value !== 'all');

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={id}
        className={cn(
          'text-sm text-gray-600 font-medium',
          !showLabel && 'sr-only'
        )}
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={label}
        className={cn(
          'border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0a3a82]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          SIZE_STYLES[size],
          className
        )}
      >
        {regions.map(region => (
          <option key={region.value} value={region.value}>
            {region.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * 지역 이름 변환 유틸리티
 */
export function mapSidoNameToShort(fullName: string): string {
  const region = REGIONS_FULL.find(r => r.value === fullName);
  if (region) return region.label;

  // 이미 짧은 이름인 경우
  const shortRegion = REGIONS.find(r => r.value === fullName);
  if (shortRegion) return fullName;

  return fullName;
}

export function mapSidoNameToFull(shortName: string): string {
  const region = REGIONS.find(r => r.value === shortName);
  if (region) return region.label;

  // 이미 긴 이름인 경우
  const fullRegion = REGIONS_FULL.find(r => r.value === shortName);
  if (fullRegion) return shortName;

  return shortName;
}
