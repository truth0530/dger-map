/**
 * DGER 관련 상수 정의
 * 원본: dger-api/public/js/bed-definitions.js, severe-definitions.js, diseasePatterns.js
 */

// ===== 병상 정의 =====
export const BED_DEFINITIONS = {
  general: {
    total: 'hvs01',
    available: 'hvec',
    description: '일반병상',
    displayName: '일반병상'
  },
  cohort: {
    total: 'HVS59',
    available: 'hv27',
    description: '코호트 격리',
    displayName: '코호트'
  },
  erNegative: {
    total: 'HVS03',
    available: 'hv29',
    description: '응급실 음압격리',
    displayName: '응급실 음압격리'
  },
  erGeneral: {
    total: 'HVS04',
    available: 'hv30',
    description: '응급실 일반격리',
    displayName: '응급실 일반격리'
  },
  pediatric: {
    total: 'HVS02',
    available: 'hv28',
    description: '소아 응급실',
    displayName: '소아 응급실'
  },
  pediatricNegative: {
    total: 'HVS48',
    available: 'hv15',
    description: '소아 음압격리',
    displayName: '소아 음압격리'
  },
  pediatricGeneral: {
    total: 'HVS49',
    available: 'hv16',
    description: '소아 일반격리',
    displayName: '소아 일반격리'
  }
} as const;

// 병상 상태별 색상
export const BED_STATUS_COLORS = {
  safe: {
    color: '#10b981',
    backgroundColor: '#d1fae5',
    description: '여유'
  },
  warning: {
    color: '#f59e0b',
    backgroundColor: '#fef3c7',
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
} as const;

export type BedStatus = keyof typeof BED_STATUS_COLORS;

// 병상 상태 판별 함수
export function getBedStatus(available: number | string, total: number | string): BedStatus {
  const availableNum = parseInt(String(available || 0));
  const totalNum = parseInt(String(total || 0));

  if (totalNum === 0) return 'na';

  const percentage = (availableNum / totalNum) * 100;

  if (percentage <= 5) return 'danger';
  if (percentage <= 40) return 'warning';
  return 'safe';
}

// ===== 27개 중증질환 정의 =====
export const SEVERE_TYPES = [
  { key: 'MKioskTy1', qn: '1', label: '[재관류중재술] 심근경색' },
  { key: 'MKioskTy2', qn: '2', label: '[재관류중재술] 뇌경색' },
  { key: 'MKioskTy3', qn: '3', label: '[뇌출혈수술] 거미막하출혈' },
  { key: 'MKioskTy4', qn: '4', label: '[뇌출혈수술] 거미막하출혈 외' },
  { key: 'MKioskTy5', qn: '5', label: '[대동맥응급] 흉부' },
  { key: 'MKioskTy6', qn: '6', label: '[대동맥응급] 복부' },
  { key: 'MKioskTy7', qn: '7', label: '[담낭담관질환] 담낭질환' },
  { key: 'MKioskTy8', qn: '8', label: '[담낭담관질환] 담도포함질환' },
  { key: 'MKioskTy9', qn: '9', label: '[복부응급수술] 비외상' },
  { key: 'MKioskTy10', qn: '10', label: '[장중첩/폐색] 영유아' },
  { key: 'MKioskTy11', qn: '11', label: '[응급내시경] 성인 위장관' },
  { key: 'MKioskTy12', qn: '12', label: '[응급내시경] 영유아 위장관' },
  { key: 'MKioskTy13', qn: '13', label: '[응급내시경] 성인 기관지' },
  { key: 'MKioskTy14', qn: '14', label: '[응급내시경] 영유아 기관지' },
  { key: 'MKioskTy15', qn: '15', label: '[저체중출생아] 집중치료' },
  { key: 'MKioskTy16', qn: '16', label: '[산부인과응급] 분만' },
  { key: 'MKioskTy17', qn: '17', label: '[산부인과응급] 산과수술' },
  { key: 'MKioskTy18', qn: '18', label: '[산부인과응급] 부인과수술' },
  { key: 'MKioskTy19', qn: '19', label: '[중증화상] 전문치료' },
  { key: 'MKioskTy20', qn: '20', label: '[사지접합] 수족지접합' },
  { key: 'MKioskTy21', qn: '21', label: '[사지접합] 수족지접합 외' },
  { key: 'MKioskTy22', qn: '22', label: '[응급투석] HD' },
  { key: 'MKioskTy23', qn: '23', label: '[응급투석] CRRT' },
  { key: 'MKioskTy24', qn: '24', label: '[정신과적응급] 폐쇄병동입원' },
  { key: 'MKioskTy25', qn: '25', label: '[안과적수술] 응급' },
  { key: 'MKioskTy26', qn: '26', label: '[영상의학혈관중재] 성인' },
  { key: 'MKioskTy27', qn: '27', label: '[영상의학혈관중재] 영유아' }
] as const;

// symTypCod를 질환 번호로 매핑
export const SYMPTOM_CODE_TO_DISEASE_MAP: Record<string, number> = {
  'Y0010': 1,  // [재관류중재술] 심근경색
  'Y0020': 2,  // [재관류중재술] 뇌경색
  'Y0031': 3,  // [뇌출혈수술] 거미막하출혈
  'Y0032': 4,  // [뇌출혈수술] 거미막하출혈 외
  'Y0041': 5,  // [대동맥응급] 흉부
  'Y0042': 6,  // [대동맥응급] 복부
  'Y0051': 7,  // [담낭담관질환] 담낭질환
  'Y0052': 8,  // [담낭담관질환] 담도포함질환
  'Y0060': 9,  // [복부응급수술] 비외상
  'Y0070': 10, // [장중첩/폐색] 영유아
  'Y0081': 11, // [응급내시경] 성인 위장관
  'Y0082': 12, // [응급내시경] 영유아 위장관
  'Y0091': 13, // [응급내시경] 성인 기관지
  'Y0092': 14, // [응급내시경] 영유아 기관지
  'Y0100': 15, // [저체중출생아] 집중치료
  'Y0111': 16, // [산부인과응급] 분만
  'Y0112': 17, // [산부인과응급] 산과수술
  'Y0113': 18, // [산부인과응급] 부인과수술
  'Y0120': 19, // [중증화상] 전문치료
  'Y0131': 20, // [사지접합] 수족지접합
  'Y0132': 21, // [사지접합] 수족지접합 외
  'Y0141': 22, // [응급투석] HD
  'Y0142': 23, // [응급투석] CRRT
  'Y0150': 24, // [정신과적응급] 폐쇄병동입원
  'Y0160': 25, // [안과적수술] 응급
  'Y0171': 26, // [영상의학혈관중재] 성인
  'Y0172': 27  // [영상의학혈관중재] 영유아
};

// 질환 표시 패턴
export interface DiseaseDisplayPattern {
  original: string;
  displayFormat: string;
  category: string;
}

export const DISEASE_DISPLAY_PATTERNS: Record<number, DiseaseDisplayPattern> = {
  1: { original: '[재관류중재술] 심근경색', displayFormat: '[심근경색] 재관류중재술', category: '심근경색' },
  2: { original: '[재관류중재술] 뇌경색', displayFormat: '[뇌경색] 재관류중재술', category: '뇌경색' },
  3: { original: '[뇌출혈수술] 거미막하출혈', displayFormat: '[뇌출혈] 거미막하출혈', category: '뇌출혈' },
  4: { original: '[뇌출혈수술] 거미막하출혈 외', displayFormat: '[뇌출혈] 거미막하출혈 외', category: '뇌출혈' },
  5: { original: '[대동맥응급] 흉부', displayFormat: '[대동맥응급] 흉부', category: '대동맥응급' },
  6: { original: '[대동맥응급] 복부', displayFormat: '[대동맥응급] 복부', category: '대동맥응급' },
  7: { original: '[담낭담관질환] 담낭질환', displayFormat: '[담낭질환] 담낭질환', category: '담낭질환' },
  8: { original: '[담낭담관질환] 담도포함질환', displayFormat: '[담낭질환] 담도포함질환', category: '담낭질환' },
  9: { original: '[복부응급수술] 비외상', displayFormat: '[복부응급] 비외상', category: '복부응급' },
  10: { original: '[장중첩/폐색] 영유아', displayFormat: '[장중첩] 영유아', category: '장중첩' },
  11: { original: '[응급내시경] 성인 위장관', displayFormat: '[응급내시경] 성인 위장관', category: '응급내시경' },
  12: { original: '[응급내시경] 영유아 위장관', displayFormat: '[응급내시경] 영유아 위장관', category: '응급내시경' },
  13: { original: '[응급내시경] 성인 기관지', displayFormat: '[응급내시경] 성인 기관지', category: '응급내시경' },
  14: { original: '[응급내시경] 영유아 기관지', displayFormat: '[응급내시경] 영유아 기관지', category: '응급내시경' },
  15: { original: '[저체중출생아] 집중치료', displayFormat: '[저체중출생아] 집중치료', category: '저체중출생아' },
  16: { original: '[산부인과응급] 분만', displayFormat: '[산부인과] 분만', category: '산부인과' },
  17: { original: '[산부인과응급] 산과수술', displayFormat: '[산부인과] 산과수술', category: '산부인과' },
  18: { original: '[산부인과응급] 부인과수술', displayFormat: '[산부인과] 부인과수술', category: '산부인과' },
  19: { original: '[중증화상] 전문치료', displayFormat: '[중증화상] 전문치료', category: '중증화상' },
  20: { original: '[사지접합] 수족지접합', displayFormat: '[사지접합] 수족지접합', category: '사지접합' },
  21: { original: '[사지접합] 수족지접합 외', displayFormat: '[사지접합] 수족지접합 외', category: '사지접합' },
  22: { original: '[응급투석] HD', displayFormat: '[응급투석] HD', category: '응급투석' },
  23: { original: '[응급투석] CRRT', displayFormat: '[응급투석] CRRT', category: '응급투석' },
  24: { original: '[정신과적응급] 폐쇄병동입원', displayFormat: '[정신과응급] 폐쇄병동입원', category: '정신과응급' },
  25: { original: '[안과적수술] 응급', displayFormat: '[안과응급] 응급수술', category: '안과응급' },
  26: { original: '[영상의학혈관중재] 성인', displayFormat: '[영상의학] 성인 혈관중재', category: '영상의학' },
  27: { original: '[영상의학혈관중재] 영유아', displayFormat: '[영상의학] 영유아 혈관중재', category: '영상의학' }
};

// 지역 목록
export const REGIONS = [
  { value: '서울', label: '서울특별시' },
  { value: '부산', label: '부산광역시' },
  { value: '대구', label: '대구광역시' },
  { value: '인천', label: '인천광역시' },
  { value: '광주', label: '광주광역시' },
  { value: '대전', label: '대전광역시' },
  { value: '울산', label: '울산광역시' },
  { value: '세종', label: '세종특별자치시' },
  { value: '경기', label: '경기도' },
  { value: '강원', label: '강원특별자치도' },
  { value: '충북', label: '충청북도' },
  { value: '충남', label: '충청남도' },
  { value: '전북', label: '전북특별자치도' },
  { value: '전남', label: '전라남도' },
  { value: '경북', label: '경상북도' },
  { value: '경남', label: '경상남도' },
  { value: '제주', label: '제주특별자치도' }
] as const;
