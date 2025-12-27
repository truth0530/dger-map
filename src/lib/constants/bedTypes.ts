/**
 * 병상 유형 정의
 */

import type { HospitalBedData } from '@/lib/hooks/useBedData';

export type BedType = 'general' | 'cohort' | 'erNegative' | 'erGeneral' | 'pediatric' | 'pediatricNegative' | 'pediatricGeneral';

export const BED_TYPE_CONFIG: Record<BedType, {
  label: string;
  shortLabel: string;
  availableKey: keyof HospitalBedData;
  totalKey: keyof HospitalBedData
}> = {
  general: { label: '일반', shortLabel: '일반', availableKey: 'hvec', totalKey: 'hvs01' },
  cohort: { label: '코호트', shortLabel: '코호트', availableKey: 'hv27', totalKey: 'HVS59' },
  erNegative: { label: '음압격리', shortLabel: '음압', availableKey: 'hv29', totalKey: 'HVS03' },
  erGeneral: { label: '일반격리', shortLabel: '격리', availableKey: 'hv30', totalKey: 'HVS04' },
  pediatric: { label: '소아', shortLabel: '소아', availableKey: 'hv28', totalKey: 'HVS02' },
  pediatricNegative: { label: '소아음압', shortLabel: '소아음압', availableKey: 'hv15', totalKey: 'HVS48' },
  pediatricGeneral: { label: '소아격리', shortLabel: '소아격리', availableKey: 'hv16', totalKey: 'HVS49' }
};

export const BED_TYPE_KEYS = Object.keys(BED_TYPE_CONFIG) as BedType[];
