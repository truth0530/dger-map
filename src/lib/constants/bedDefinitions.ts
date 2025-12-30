/**
 * 병상 코드 정의
 * 원본: dger-api/public/js/bed-definitions.js
 */

export interface BedDefinition {
  total: string;        // 총 병상 수 필드명
  available: string;    // 가용 병상 수 필드명
  description: string;  // 설명
  displayName: string;  // 표시명
}

export interface BedDescription {
  name: string;
  description: string;
  unit: string;
}

export interface BedStatusColor {
  color: string;
  backgroundColor: string;
  description: string;
}

// 병상 유형별 정의
export const BED_DEFINITIONS: Record<string, BedDefinition> = {
  // 일반병상
  general: {
    total: 'hvs01',
    available: 'hvec',
    description: '일반병상',
    displayName: '일반병상'
  },
  // 코호트 격리
  cohort: {
    total: 'HVS59',
    available: 'hv27',
    description: '코호트 격리',
    displayName: '코호트'
  },
  // 응급실 음압격리 (통합: HVS03 + HVS46)
  erNegative: {
    total: 'HVS03',
    available: 'hv29',
    description: '응급실 음압격리',
    displayName: '응급실 음압격리'
  },
  // 응급실 일반격리 (통합: HVS04 + HVS47)
  erGeneral: {
    total: 'HVS04',
    available: 'hv30',
    description: '응급실 일반격리',
    displayName: '응급실 일반격리'
  },
  // 소아 응급실
  pediatric: {
    total: 'HVS02',
    available: 'hv28',
    description: '소아 응급실',
    displayName: '소아 응급실'
  },
  // 소아 음압격리
  pediatricNegative: {
    total: 'HVS48',
    available: 'hv15',
    description: '소아 음압격리',
    displayName: '소아 음압격리'
  },
  // 소아 일반격리
  pediatricGeneral: {
    total: 'HVS49',
    available: 'hv16',
    description: '소아 일반격리',
    displayName: '소아 일반격리'
  }
};

// 통합 필드 매핑 (HVS03+HVS46, HVS04+HVS47 등)
export const UNIFIED_BED_FIELDS: Record<string, { primary: string; secondary: string }> = {
  erNegativeTotal: { primary: 'HVS03', secondary: 'HVS46' },
  erNegativeAvail: { primary: 'hv29', secondary: 'hv13' },
  erGeneralTotal: { primary: 'HVS04', secondary: 'HVS47' },
  erGeneralAvail: { primary: 'hv30', secondary: 'hv14' }
};

// 병상 코드별 상세 설명
export const BED_DESCRIPTIONS: Record<string, BedDescription> = {
  hvs01: {
    name: '일반병상',
    description: '응급실 일반병상 총 병상 수',
    unit: '병상'
  },
  hvec: {
    name: '일반병상 가용',
    description: '응급실 일반병상 가용 병상 수',
    unit: '병상'
  },
  HVS59: {
    name: '코호트 격리',
    description: '응급실 코호트 격리 총 병상 수',
    unit: '병상'
  },
  hv27: {
    name: '코호트 격리 가용',
    description: '응급실 코호트 격리 가용 병상 수',
    unit: '병상'
  },
  HVS03: {
    name: '응급실 음압격리',
    description: '응급실 음압격리 총 병상 수',
    unit: '병상'
  },
  HVS46: {
    name: '응급실 음압격리 (추가)',
    description: '응급실 음압격리 추가 병상 수 (HVS03과 통합)',
    unit: '병상'
  },
  hv29: {
    name: '응급실 음압격리 가용',
    description: '응급실 음압격리 가용 병상 수',
    unit: '병상'
  },
  hv13: {
    name: '응급실 음압격리 가용 (추가)',
    description: '응급실 음압격리 가용 추가 병상 수 (hv29와 통합)',
    unit: '병상'
  },
  HVS04: {
    name: '응급실 일반격리',
    description: '응급실 일반격리 총 병상 수',
    unit: '병상'
  },
  HVS47: {
    name: '응급실 일반격리 (추가)',
    description: '응급실 일반격리 추가 병상 수 (HVS04와 통합)',
    unit: '병상'
  },
  hv30: {
    name: '응급실 일반격리 가용',
    description: '응급실 일반격리 가용 병상 수',
    unit: '병상'
  },
  hv14: {
    name: '응급실 일반격리 가용 (추가)',
    description: '응급실 일반격리 가용 추가 병상 수 (hv30과 통합)',
    unit: '병상'
  },
  HVS02: {
    name: '소아 응급실',
    description: '소아 응급실 총 병상 수',
    unit: '병상'
  },
  hv28: {
    name: '소아 응급실 가용',
    description: '소아 응급실 가용 병상 수',
    unit: '병상'
  },
  HVS48: {
    name: '소아 음압격리',
    description: '소아 음압격리 총 병상 수',
    unit: '병상'
  },
  hv15: {
    name: '소아 음압격리 가용',
    description: '소아 음압격리 가용 병상 수',
    unit: '병상'
  },
  HVS49: {
    name: '소아 일반격리',
    description: '소아 일반격리 총 병상 수',
    unit: '병상'
  },
  hv16: {
    name: '소아 일반격리 가용',
    description: '소아 일반격리 가용 병상 수',
    unit: '병상'
  }
};

// 병상 상태별 색상 정의
export const BED_STATUS_COLORS: Record<string, BedStatusColor> = {
  safe: {
    color: '#10b981',
    backgroundColor: '#d1fae5',
    description: '여유'
  },
  warning: {
    color: '#eab308',
    backgroundColor: '#fef9c3',
    description: '주의'
  },
  danger: {
    color: '#ef4444',
    backgroundColor: '#fee2e2',
    description: '혼잡'
  },
  na: {
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    description: '정보 없음'
  }
};

export type BedStatus = 'safe' | 'warning' | 'danger' | 'na';

/**
 * 병상 상태 판별 함수
 */
export function getBedStatus(available: number | string, total: number | string): BedStatus {
  const availableNum = parseInt(String(available) || '0');
  const totalNum = parseInt(String(total) || '0');

  if (totalNum === 0) return 'na';

  const percentage = (availableNum / totalNum) * 100;

  if (percentage <= 5) return 'danger';
  if (percentage <= 40) return 'warning';
  return 'safe';
}

/**
 * 병상 정보 가져오기
 */
export function getBedInfo(bedType: string): BedDefinition | null {
  return BED_DEFINITIONS[bedType] || null;
}

/**
 * 병상 코드 설명 가져오기
 */
export function getBedDescription(code: string): BedDescription | null {
  return BED_DESCRIPTIONS[code] || null;
}

/**
 * 병상 상태 색상 가져오기
 */
export function getBedStatusColor(status: BedStatus): BedStatusColor {
  return BED_STATUS_COLORS[status] || BED_STATUS_COLORS.na;
}

/**
 * 통합 필드 값 계산 (예: HVS03 + HVS46)
 */
export function getUnifiedBedValue(
  data: Record<string, unknown>,
  fieldType: keyof typeof UNIFIED_BED_FIELDS
): number {
  const fields = UNIFIED_BED_FIELDS[fieldType];
  if (!fields) return 0;

  const primary = parseInt(String(data[fields.primary] || 0));
  const secondary = parseInt(String(data[fields.secondary] || 0));

  return primary + secondary;
}

/**
 * 병상 유형 목록 가져오기
 */
export function getBedTypes(): string[] {
  return Object.keys(BED_DEFINITIONS);
}

/**
 * 소아 관련 병상인지 확인
 */
export function isPediatricBed(bedType: string): boolean {
  return bedType.startsWith('pediatric');
}

/**
 * 격리 병상인지 확인
 */
export function isIsolationBed(bedType: string): boolean {
  return bedType.includes('Negative') || bedType.includes('General') || bedType === 'cohort';
}
