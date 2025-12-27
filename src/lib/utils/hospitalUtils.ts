/**
 * 병원 관련 유틸리티 함수
 * 원본: dger-api/public/js/utils.js, hospital-abbr.js
 *
 * - 병원 정렬 (센터급 우선, 재실인원 내림차순)
 * - 병원명 약어 변환
 * - 재실인원 계산
 * - 병상 상태 판별
 */

// ===== 병원명 약어 매핑 =====
export const HOSPITAL_NAME_MAPPING: Record<string, string> = {
  // 대구 지역
  "경북대학교병원": "경대병원",
  "계명대학교 동산병원": "계명대동산",
  "대구가톨릭대학교병원": "대구가톨릭",
  "영남대학교병원": "영대병원",
  "대구파티마병원": "파티마",
  "대구의료원": "대구의료원",
  "대구보훈병원": "보훈병원",
  "대구가톨릭대학교 칠곡가톨릭병원": "칠곡가톨릭",
  "계명대학교동산병원": "계대동산",
  "칠곡경북대학교병원": "칠곡경대",
  "(재)미리내천주성삼성직수도회천주성삼병원": "천주성삼",
  "강남종합병원": "강남종합",
  "계명대학교대구동산병원": "대구동산",
  "곽병원": "곽병원",
  "나사렛종합병원": "나사렛",
  "대구가톨릭대학교칠곡가톨릭병원": "칠곡가톨릭",
  "대구굿모닝병원": "굿모닝",
  "더블유병원": "더블유",
  "드림종합병원": "드림종합",
  "삼일병원": "삼일병원",
  "의료법인구의료재단구병원": "구병원",
  "한국보훈복지의료공단대구보훈병원": "보훈병원",

  // 서울 지역
  "서울대학교병원": "서울대병원",
  "서울아산병원": "서울아산",
  "삼성서울병원": "삼성서울",
  "세브란스병원": "세브란스",
  "고려대학교안암병원": "고대안암",
  "고려대학교구로병원": "고대구로",
  "서울성모병원": "서울성모",

  // 기타 지역 주요 병원
  "부산대학교병원": "부산대병원",
  "인하대학교병원": "인하대병원",
  "아주대학교병원": "아주대병원",
  "전남대학교병원": "전남대병원",
  "충남대학교병원": "충남대병원",
  "충북대학교병원": "충북대병원",
  "전북대학교병원": "전북대병원",
  "경상국립대학교병원": "경상대병원",
  "원광대학교병원": "원광대병원",
  "조선대학교병원": "조선대병원",
  "울산대학교병원": "울산대병원",
  "제주대학교병원": "제주대병원",
  "강원대학교병원": "강원대병원"
};

/**
 * 병원명을 약어로 변환
 */
export function shortenHospitalName(name: string): string {
  if (!name) return '-';
  return HOSPITAL_NAME_MAPPING[name] || name;
}

// ===== 기관 종별 구분 (HPBD 코드 기반) =====
// HVS05: 권역응급의료센터
// HVS06: 지역응급의료센터
// HVS07: 전문응급의료센터 (소아, 화상 등 특화)
// HVS08: 지역응급의료기관

export type HospitalLevel = '권역응급의료센터' | '지역응급의료센터' | '전문응급의료센터' | '지역응급의료기관' | '기타';

// HPBD 코드 → 등급 매핑
export const HPBD_CODE_MAP: Record<string, HospitalLevel> = {
  'HVS05': '권역응급의료센터',
  'HVS06': '지역응급의료센터',
  'HVS07': '전문응급의료센터',
  'HVS08': '지역응급의료기관'
};

// 등급별 우선순위 가중치
export const HOSPITAL_LEVEL_PRIORITY: Record<HospitalLevel, number> = {
  '권역응급의료센터': 100,
  '지역응급의료센터': 80,
  '전문응급의료센터': 60,
  '지역응급의료기관': 40,
  '기타': 0
};

// 등급별 배지 스타일
export const HOSPITAL_LEVEL_BADGE: Record<HospitalLevel, { bg: string; text: string; short: string }> = {
  '권역응급의료센터': { bg: 'bg-red-100', text: 'text-red-700', short: '권역' },
  '지역응급의료센터': { bg: 'bg-orange-100', text: 'text-orange-700', short: '지역센터' },
  '전문응급의료센터': { bg: 'bg-purple-100', text: 'text-purple-700', short: '전문' },
  '지역응급의료기관': { bg: 'bg-blue-100', text: 'text-blue-700', short: '기관' },
  '기타': { bg: 'bg-gray-100', text: 'text-gray-600', short: '기타' }
};

/**
 * 병원 등급 판별
 */
export function getHospitalLevel(hospital: {
  hpbd?: string;
  hpbdCode?: string;
  typeName?: string;
  category?: string;
  dutyEmclsName?: string;
  dutyEmcls?: string;
}): HospitalLevel {
  const raw = hospital.hpbd || hospital.hpbdCode || hospital.typeName ||
              hospital.category || hospital.dutyEmclsName || hospital.dutyEmcls || '';
  const v = String(raw).trim();

  // 코드(HVSxx) 케이스
  if (v === 'HVS05') return '권역응급의료센터';
  if (v === 'HVS06') return '지역응급의료센터';
  if (v === 'HVS07') return '전문응급의료센터';
  if (v === 'HVS08') return '지역응급의료기관';

  // 라벨(한글) 케이스
  if (v.includes('권역응급의료센터') || v.includes('권역')) return '권역응급의료센터';
  if (v.includes('지역응급의료센터')) return '지역응급의료센터';
  if (v.includes('전문응급의료센터')) return '전문응급의료센터';
  if (v.includes('지역응급의료기관') || v.includes('기관')) return '지역응급의료기관';

  return '기타';
}

/**
 * 센터급 여부 (권역/지역/전문 센터)
 */
export function isCenterHospital(hospital: Parameters<typeof getHospitalLevel>[0]): boolean {
  const level = getHospitalLevel(hospital);
  return ['권역응급의료센터', '지역응급의료센터', '전문응급의료센터'].includes(level);
}

/**
 * 기관급 여부 (지역응급의료기관)
 */
export function isInstitutionHospital(hospital: Parameters<typeof getHospitalLevel>[0]): boolean {
  return getHospitalLevel(hospital) === '지역응급의료기관';
}

// ===== 병상 관련 인터페이스 =====
export interface HospitalBedFields {
  // 일반병상
  hvs01?: string | number;  // 기준
  hvec?: string | number;   // 잔여

  // 코호트 격리
  HVS59?: string | number;  // 기준
  hv27?: string | number;   // 잔여

  // 응급실 음압격리 (통합: HVS03 + HVS46)
  HVS03?: string | number;  // 응급실 음압격리 기준
  HVS46?: string | number;  // 응급실 음압격리 추가 기준
  hv29?: string | number;   // 응급실 음압격리 잔여
  hv13?: string | number;   // 응급실 음압격리 추가 잔여

  // 응급실 일반격리 (통합: HVS04 + HVS47)
  HVS04?: string | number;  // 응급실 일반격리 기준
  HVS47?: string | number;  // 응급실 일반격리 추가 기준
  hv30?: string | number;   // 응급실 일반격리 잔여
  hv14?: string | number;   // 응급실 일반격리 추가 잔여

  // 소아응급실
  HVS02?: string | number;  // 기준
  hv28?: string | number;   // 잔여

  // 소아 음압격리
  HVS48?: string | number;  // 기준
  hv15?: string | number;   // 잔여

  // 소아 일반격리
  HVS49?: string | number;  // 기준
  hv16?: string | number;   // 잔여

  // 병원 식별 정보
  name?: string;
  dutyName?: string;
  hpid?: string;
}

/**
 * 각 병상 유형별로 사용 중인 병상 수 계산
 */
export function calculateOccupied(total: string | number | undefined, available: string | number | undefined): number {
  const totalBeds = parseInt(String(total || 0));
  const availableBeds = parseInt(String(available || 0));
  return Math.max(0, totalBeds - availableBeds);
}

/**
 * 전체 재실인원 계산 (통합 필드 처리 포함)
 */
export function calculateTotalOccupancy(hospital: HospitalBedFields): number {
  // 일반병상
  const generalOccupied = calculateOccupied(hospital.hvs01, hospital.hvec);

  // 코호트 격리
  const cohortOccupied = calculateOccupied(hospital.HVS59, hospital.hv27);

  // 응급실 음압격리 (통합 처리: HVS03 + HVS46 기준, hv29 + hv13 잔여)
  const erNegativeTotal = parseInt(String(hospital.HVS03 || 0)) + parseInt(String(hospital.HVS46 || 0));
  const erNegativeAvailable = parseInt(String(hospital.hv29 || 0)) + parseInt(String(hospital.hv13 || 0));
  const erNegativeOccupied = Math.max(0, erNegativeTotal - erNegativeAvailable);

  // 응급실 일반격리 (통합 처리: HVS04 + HVS47 기준, hv30 + hv14 잔여)
  const erGeneralTotal = parseInt(String(hospital.HVS04 || 0)) + parseInt(String(hospital.HVS47 || 0));
  const erGeneralAvailable = parseInt(String(hospital.hv30 || 0)) + parseInt(String(hospital.hv14 || 0));
  const erGeneralOccupied = Math.max(0, erGeneralTotal - erGeneralAvailable);

  // 소아응급실
  const pediatricOccupied = calculateOccupied(hospital.HVS02, hospital.hv28);

  // 소아 음압격리
  const pediatricNegativeOccupied = calculateOccupied(hospital.HVS48, hospital.hv15);

  // 소아 일반격리
  const pediatricGeneralOccupied = calculateOccupied(hospital.HVS49, hospital.hv16);

  return (
    generalOccupied +
    cohortOccupied +
    erNegativeOccupied +
    erGeneralOccupied +
    pediatricOccupied +
    pediatricNegativeOccupied +
    pediatricGeneralOccupied
  );
}

/**
 * 병상 상세 정보 계산 (디버깅/표시용)
 */
export function calculateOccupancyDetails(hospital: HospitalBedFields): {
  general: number;
  cohort: number;
  erNegative: number;
  erGeneral: number;
  pediatric: number;
  pediatricNegative: number;
  pediatricGeneral: number;
  total: number;
} {
  const general = calculateOccupied(hospital.hvs01, hospital.hvec);
  const cohort = calculateOccupied(hospital.HVS59, hospital.hv27);

  const erNegativeTotal = parseInt(String(hospital.HVS03 || 0)) + parseInt(String(hospital.HVS46 || 0));
  const erNegativeAvailable = parseInt(String(hospital.hv29 || 0)) + parseInt(String(hospital.hv13 || 0));
  const erNegative = Math.max(0, erNegativeTotal - erNegativeAvailable);

  const erGeneralTotal = parseInt(String(hospital.HVS04 || 0)) + parseInt(String(hospital.HVS47 || 0));
  const erGeneralAvailable = parseInt(String(hospital.hv30 || 0)) + parseInt(String(hospital.hv14 || 0));
  const erGeneral = Math.max(0, erGeneralTotal - erGeneralAvailable);

  const pediatric = calculateOccupied(hospital.HVS02, hospital.hv28);
  const pediatricNegative = calculateOccupied(hospital.HVS48, hospital.hv15);
  const pediatricGeneral = calculateOccupied(hospital.HVS49, hospital.hv16);

  return {
    general,
    cohort,
    erNegative,
    erGeneral,
    pediatric,
    pediatricNegative,
    pediatricGeneral,
    total: general + cohort + erNegative + erGeneral + pediatric + pediatricNegative + pediatricGeneral
  };
}

/**
 * 병원 정렬 함수 - 센터급 우선, 재실인원 내림차순
 */
export function sortHospitals<T extends HospitalBedFields & Parameters<typeof getHospitalLevel>[0]>(
  hospitals: T[]
): T[] {
  return [...hospitals].sort((a, b) => {
    // 1. 센터급 병원 우선
    const aIsCenter = isCenterHospital(a);
    const bIsCenter = isCenterHospital(b);

    if (aIsCenter && !bIsCenter) return -1;
    if (!aIsCenter && bIsCenter) return 1;

    // 2. 센터급 내에서 등급 순서 (권역 > 지역 > 전문)
    if (aIsCenter && bIsCenter) {
      const levelOrder: Record<HospitalLevel, number> = {
        '권역응급의료센터': 0,
        '지역응급의료센터': 1,
        '전문응급의료센터': 2,
        '지역응급의료기관': 3,
        '기타': 4
      };
      const aLevel = getHospitalLevel(a);
      const bLevel = getHospitalLevel(b);

      if (levelOrder[aLevel] !== levelOrder[bLevel]) {
        return levelOrder[aLevel] - levelOrder[bLevel];
      }
    }

    // 3. 같은 급수 내에서 재실인원 내림차순
    const aOccupancy = calculateTotalOccupancy(a);
    const bOccupancy = calculateTotalOccupancy(b);
    return bOccupancy - aOccupancy;
  });
}

/**
 * 정렬 검증 함수 (개발 환경용)
 */
export function validateSorting<T extends HospitalBedFields & Parameters<typeof getHospitalLevel>[0]>(
  hospitals: T[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (let i = 0; i < hospitals.length - 1; i++) {
    const current = hospitals[i];
    const next = hospitals[i + 1];

    const currentIsCenter = isCenterHospital(current);
    const nextIsCenter = isCenterHospital(next);

    // 센터급이 기관급보다 먼저 와야 함
    if (!currentIsCenter && nextIsCenter) {
      errors.push(
        `정렬 오류: 기관급(${current.name || current.dutyName})이 센터급(${next.name || next.dutyName})보다 먼저 배치됨`
      );
    }

    // 같은 급수 내에서 재실인원 내림차순 확인
    if (currentIsCenter === nextIsCenter) {
      const currentOccupancy = calculateTotalOccupancy(current);
      const nextOccupancy = calculateTotalOccupancy(next);

      if (currentOccupancy < nextOccupancy) {
        errors.push(
          `정렬 오류: ${current.name || current.dutyName}(${currentOccupancy})이 ${next.name || next.dutyName}(${nextOccupancy})보다 재실인원이 적음`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 병상 상태 클래스 결정
 */
export type BedStatusType = 'safe' | 'warning' | 'danger' | 'na';

export function getBedStatusType(available: string | number | undefined, total: string | number | undefined): BedStatusType {
  const availableNum = parseInt(String(available || 0));
  const totalNum = parseInt(String(total || 0));

  if (totalNum === 0) return 'na';

  const percentage = (availableNum / totalNum) * 100;

  if (percentage <= 5) return 'danger';
  if (percentage <= 40) return 'warning';
  return 'safe';
}

/**
 * 병상 상태 Tailwind 클래스
 */
export function getBedStatusClasses(status: BedStatusType): { bg: string; text: string; border: string } {
  switch (status) {
    case 'danger':
      return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' };
    case 'warning':
      return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' };
    case 'safe':
      return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300' };
  }
}

/**
 * 병원 우선순위 점수 계산 (등급 + 재실인원 기반)
 */
export function calculateHospitalPriority(hospital: HospitalBedFields & Parameters<typeof getHospitalLevel>[0]): number {
  const level = getHospitalLevel(hospital);
  const levelPriority = HOSPITAL_LEVEL_PRIORITY[level];
  const occupancy = calculateTotalOccupancy(hospital);

  // 등급 점수 * 100 + 재실인원 (등급이 주요 정렬 기준)
  return levelPriority * 100 + occupancy;
}

/**
 * 병원 등급 배지 정보 가져오기
 */
export function getHospitalLevelBadge(hospital: Parameters<typeof getHospitalLevel>[0]): {
  level: HospitalLevel;
  bg: string;
  text: string;
  short: string;
} {
  const level = getHospitalLevel(hospital);
  const badge = HOSPITAL_LEVEL_BADGE[level];
  return { level, ...badge };
}

/**
 * HPBD 코드로 등급 가져오기
 */
export function getHospitalLevelByCode(code: string): HospitalLevel {
  return HPBD_CODE_MAP[code] || '기타';
}

/**
 * 병원 정보 요약 생성
 */
export function getHospitalSummary(hospital: HospitalBedFields & Parameters<typeof getHospitalLevel>[0]): {
  name: string;
  shortName: string;
  level: HospitalLevel;
  levelShort: string;
  occupancy: number;
  priority: number;
} {
  const name = hospital.name || hospital.dutyName || '-';
  const shortName = shortenHospitalName(name);
  const level = getHospitalLevel(hospital);
  const levelShort = HOSPITAL_LEVEL_BADGE[level].short;
  const occupancy = calculateTotalOccupancy(hospital);
  const priority = calculateHospitalPriority(hospital);

  return {
    name,
    shortName,
    level,
    levelShort,
    occupancy,
    priority
  };
}

/**
 * 병원 목록 필터링 (등급별)
 */
export function filterHospitalsByLevel<T extends Parameters<typeof getHospitalLevel>[0]>(
  hospitals: T[],
  levels: HospitalLevel[]
): T[] {
  return hospitals.filter(h => levels.includes(getHospitalLevel(h)));
}

/**
 * 센터급 병원만 필터링
 */
export function filterCenterHospitals<T extends Parameters<typeof getHospitalLevel>[0]>(
  hospitals: T[]
): T[] {
  return filterHospitalsByLevel(hospitals, ['권역응급의료센터', '지역응급의료센터', '전문응급의료센터']);
}

/**
 * 기관급 병원만 필터링
 */
export function filterInstitutionHospitals<T extends Parameters<typeof getHospitalLevel>[0]>(
  hospitals: T[]
): T[] {
  return filterHospitalsByLevel(hospitals, ['지역응급의료기관']);
}

/**
 * 병원 등급별 통계 생성
 */
export function getHospitalLevelStats(hospitals: Parameters<typeof getHospitalLevel>[0][]): Record<HospitalLevel, number> {
  const stats: Record<HospitalLevel, number> = {
    '권역응급의료센터': 0,
    '지역응급의료센터': 0,
    '전문응급의료센터': 0,
    '지역응급의료기관': 0,
    '기타': 0
  };

  for (const hospital of hospitals) {
    const level = getHospitalLevel(hospital);
    stats[level]++;
  }

  return stats;
}
