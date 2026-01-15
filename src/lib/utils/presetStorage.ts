/**
 * 프리셋 저장/관리 유틸리티
 * localStorage를 사용하여 사용자 프리셋 저장
 */

// 프리셋 타입 정의
export interface RegionPreset {
  id: string;
  name: string;
  type: 'region';
  regions: string[];  // 지역 value 배열 (예: ['대구', '경북'])
  isBuiltIn: boolean; // 기본 제공 프리셋 여부
  createdAt: number;
}

export interface HospitalPreset {
  id: string;
  name: string;
  type: 'hospital';
  hospitalIds: string[];  // hpid 배열
  hospitalNames: string[]; // 표시용 병원명 배열
  isBuiltIn: boolean;
  createdAt: number;
}

export type Preset = RegionPreset | HospitalPreset;

// 기본 제공 지역 프리셋
export const BUILT_IN_REGION_PRESETS: RegionPreset[] = [
  {
    id: 'builtin-daegu-gyeongbuk',
    name: '대구경북',
    type: 'region',
    regions: ['대구', '경북'],
    isBuiltIn: true,
    createdAt: 0
  },
  {
    id: 'builtin-buulgyeong',
    name: '부울경',
    type: 'region',
    regions: ['부산', '울산', '경남'],
    isBuiltIn: true,
    createdAt: 0
  },
  {
    id: 'builtin-seoul-incheon',
    name: '서울인천',
    type: 'region',
    regions: ['서울', '인천', '제주'],
    isBuiltIn: true,
    createdAt: 0
  },
  {
    id: 'builtin-gyeonggi-gangwon',
    name: '경기강원',
    type: 'region',
    regions: ['경기', '강원'],
    isBuiltIn: true,
    createdAt: 0
  },
  {
    id: 'builtin-daejeon-chungcheong',
    name: '대전충청',
    type: 'region',
    regions: ['대전', '세종', '충북', '충남'],
    isBuiltIn: true,
    createdAt: 0
  },
  {
    id: 'builtin-gwangju-jeolla',
    name: '광주전라',
    type: 'region',
    regions: ['광주', '전북', '전남'],
    isBuiltIn: true,
    createdAt: 0
  }
];

const STORAGE_KEY = 'dger-presets';
const MAX_CUSTOM_PRESETS = 10;

/**
 * localStorage에서 사용자 프리셋 로드
 */
export function loadUserPresets(): Preset[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed;
  } catch (error) {
    console.error('[presetStorage] 프리셋 로드 실패:', error);
    return [];
  }
}

/**
 * 사용자 프리셋 저장
 */
export function saveUserPresets(presets: Preset[]): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // 기본 제공 프리셋은 저장하지 않음
    const customPresets = presets.filter(p => !p.isBuiltIn);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets));
    return true;
  } catch (error) {
    console.error('[presetStorage] 프리셋 저장 실패:', error);
    return false;
  }
}

/**
 * 모든 프리셋 가져오기 (기본 제공 + 사용자)
 */
export function getAllPresets(): Preset[] {
  const userPresets = loadUserPresets();
  return [...BUILT_IN_REGION_PRESETS, ...userPresets];
}

/**
 * 지역 프리셋만 가져오기
 */
export function getRegionPresets(): RegionPreset[] {
  return getAllPresets().filter((p): p is RegionPreset => p.type === 'region');
}

/**
 * 병원 프리셋만 가져오기
 */
export function getHospitalPresets(): HospitalPreset[] {
  return getAllPresets().filter((p): p is HospitalPreset => p.type === 'hospital');
}

/**
 * 새 지역 프리셋 추가
 */
export function addRegionPreset(name: string, regions: string[]): RegionPreset | null {
  const userPresets = loadUserPresets();
  const customCount = userPresets.filter(p => !p.isBuiltIn).length;

  if (customCount >= MAX_CUSTOM_PRESETS) {
    console.warn('[presetStorage] 최대 프리셋 개수 초과');
    return null;
  }

  // 중복 이름 체크
  const allPresets = getAllPresets();
  if (allPresets.some(p => p.name === name)) {
    console.warn('[presetStorage] 중복된 프리셋 이름');
    return null;
  }

  const newPreset: RegionPreset = {
    id: `custom-region-${Date.now()}`,
    name,
    type: 'region',
    regions,
    isBuiltIn: false,
    createdAt: Date.now()
  };

  saveUserPresets([...userPresets, newPreset]);
  return newPreset;
}

/**
 * 새 병원 프리셋 추가
 */
export function addHospitalPreset(
  name: string,
  hospitalIds: string[],
  hospitalNames: string[]
): HospitalPreset | null {
  const userPresets = loadUserPresets();
  const customCount = userPresets.filter(p => !p.isBuiltIn).length;

  if (customCount >= MAX_CUSTOM_PRESETS) {
    console.warn('[presetStorage] 최대 프리셋 개수 초과');
    return null;
  }

  // 중복 이름 체크
  const allPresets = getAllPresets();
  if (allPresets.some(p => p.name === name)) {
    console.warn('[presetStorage] 중복된 프리셋 이름');
    return null;
  }

  const newPreset: HospitalPreset = {
    id: `custom-hospital-${Date.now()}`,
    name,
    type: 'hospital',
    hospitalIds,
    hospitalNames,
    isBuiltIn: false,
    createdAt: Date.now()
  };

  saveUserPresets([...userPresets, newPreset]);
  return newPreset;
}

/**
 * 프리셋 삭제 (사용자 프리셋만 가능)
 */
export function deletePreset(presetId: string): boolean {
  const userPresets = loadUserPresets();
  const preset = userPresets.find(p => p.id === presetId);

  if (!preset || preset.isBuiltIn) {
    console.warn('[presetStorage] 삭제할 수 없는 프리셋');
    return false;
  }

  const filtered = userPresets.filter(p => p.id !== presetId);
  return saveUserPresets(filtered);
}

/**
 * 프리셋 ID로 찾기
 */
export function getPresetById(presetId: string): Preset | null {
  const allPresets = getAllPresets();
  return allPresets.find(p => p.id === presetId) || null;
}

/**
 * 마지막으로 사용한 프리셋 ID 저장
 */
export function setLastUsedPreset(presetId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dger-last-preset', presetId);
}

/**
 * 마지막으로 사용한 프리셋 ID 가져오기
 */
export function getLastUsedPreset(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('dger-last-preset');
}
