/**
 * 27개 중증질환 정의 및 제약조건
 * 원본: dger-api/public/js/severe-definitions.js, severe-codes.js
 */

export interface SevereType {
  key: string;       // MKioskTy1~27
  qn: string;        // 질환 번호 1~27
  label: string;     // 라벨
  category: string;  // 카테고리
}

export interface SevereConstraint {
  label: string;
  note: string;
  ageLimit?: string;
  weightLimit?: string;
}

// MKioskTy 코드와 QN, 라벨 매핑
export const SEVERE_TYPES: SevereType[] = [
  { key: 'MKioskTy1',  qn: '1',  label: '[재관류중재술] 심근경색', category: '심근경색' },
  { key: 'MKioskTy2',  qn: '2',  label: '[재관류중재술] 뇌경색', category: '뇌경색' },
  { key: 'MKioskTy3',  qn: '3',  label: '[뇌출혈수술] 거미막하출혈', category: '뇌출혈' },
  { key: 'MKioskTy4',  qn: '4',  label: '[뇌출혈수술] 거미막하출혈 외', category: '뇌출혈' },
  { key: 'MKioskTy5',  qn: '5',  label: '[대동맥응급] 흉부', category: '대동맥응급' },
  { key: 'MKioskTy6',  qn: '6',  label: '[대동맥응급] 복부', category: '대동맥응급' },
  { key: 'MKioskTy7',  qn: '7',  label: '[담낭담관질환] 담낭질환', category: '담낭질환' },
  { key: 'MKioskTy8',  qn: '8',  label: '[담낭담관질환] 담도포함질환', category: '담낭질환' },
  { key: 'MKioskTy9',  qn: '9',  label: '[복부응급수술] 비외상', category: '복부응급' },
  { key: 'MKioskTy10', qn: '10', label: '[장중첩/폐색] 영유아', category: '장중첩' },
  { key: 'MKioskTy11', qn: '11', label: '[응급내시경] 성인 위장관', category: '응급내시경' },
  { key: 'MKioskTy12', qn: '12', label: '[응급내시경] 영유아 위장관', category: '응급내시경' },
  { key: 'MKioskTy13', qn: '13', label: '[응급내시경] 성인 기관지', category: '응급내시경' },
  { key: 'MKioskTy14', qn: '14', label: '[응급내시경] 영유아 기관지', category: '응급내시경' },
  { key: 'MKioskTy15', qn: '15', label: '[저체중출생아] 집중치료', category: '저체중출생아' },
  { key: 'MKioskTy16', qn: '16', label: '[산부인과응급] 분만', category: '산부인과' },
  { key: 'MKioskTy17', qn: '17', label: '[산부인과응급] 산과수술', category: '산부인과' },
  { key: 'MKioskTy18', qn: '18', label: '[산부인과응급] 부인과수술', category: '산부인과' },
  { key: 'MKioskTy19', qn: '19', label: '[중증화상] 전문치료', category: '중증화상' },
  { key: 'MKioskTy20', qn: '20', label: '[사지접합] 수족지접합', category: '사지접합' },
  { key: 'MKioskTy21', qn: '21', label: '[사지접합] 수족지접합 외', category: '사지접합' },
  { key: 'MKioskTy22', qn: '22', label: '[응급투석] HD', category: '응급투석' },
  { key: 'MKioskTy23', qn: '23', label: '[응급투석] CRRT', category: '응급투석' },
  { key: 'MKioskTy24', qn: '24', label: '[정신과적응급] 폐쇄병동입원', category: '정신과응급' },
  { key: 'MKioskTy25', qn: '25', label: '[안과적수술] 응급', category: '안과응급' },
  { key: 'MKioskTy26', qn: '26', label: '[영상의학혈관중재] 성인', category: '영상의학' },
  { key: 'MKioskTy27', qn: '27', label: '[영상의학혈관중재] 영유아', category: '영상의학' }
];

// 특이조건(영유아 가능연령 등) 가이드 발췌
export const SEVERE_CONSTRAINTS: Record<string, SevereConstraint> = {
  MKioskTy10: {
    label: '장중첩/폐색 영유아',
    note: '영유아 가능연령 관련 조건',
    ageLimit: '영유아'
  },
  MKioskTy12: {
    label: '응급내시경 영유아 위장관',
    note: '재태 23주 이상 또는 400g 이상',
    ageLimit: '재태 23주 이상',
    weightLimit: '400g 이상'
  },
  MKioskTy14: {
    label: '응급내시경 영유아 기관지',
    note: '최저연령 5세',
    ageLimit: '5세 이상'
  },
  MKioskTy15: {
    label: '저체중출생아 집중치료',
    note: '저체중 출생아 진료 가능 조건',
    weightLimit: '저체중 출생아'
  },
  MKioskTy27: {
    label: '영상의학혈관중재 영유아',
    note: '생후 1개월 이상',
    ageLimit: '생후 1개월 이상'
  }
};

/**
 * QN 번호로 질환 라벨 가져오기
 */
export function getSevereLabelByQn(qn: string | number): string {
  const found = SEVERE_TYPES.find(c => String(c.qn) === String(qn));
  return found ? found.label : `질환 ${qn || ''}`.trim();
}

/**
 * MKioskTy 키로 질환 정보 가져오기
 */
export function getSevereByKey(key: string): SevereType | undefined {
  return SEVERE_TYPES.find(c => c.key === key);
}

/**
 * QN 번호로 질환 정보 가져오기
 */
export function getSevereByQn(qn: string | number): SevereType | undefined {
  return SEVERE_TYPES.find(c => String(c.qn) === String(qn));
}

/**
 * 카테고리별 질환 목록 가져오기
 */
export function getSeveresByCategory(category: string): SevereType[] {
  return SEVERE_TYPES.filter(c => c.category === category);
}

/**
 * 제약조건 가져오기
 */
export function getSevereConstraint(key: string): SevereConstraint | undefined {
  return SEVERE_CONSTRAINTS[key];
}

/**
 * 영유아 관련 질환인지 확인
 */
export function isPediatricSevere(qn: string | number): boolean {
  const pediatricQns = ['10', '12', '14', '15', '27'];
  return pediatricQns.includes(String(qn));
}

/**
 * 카테고리 목록 가져오기 (중복 제거)
 */
export function getSevereCategories(): string[] {
  return [...new Set(SEVERE_TYPES.map(c => c.category))];
}
