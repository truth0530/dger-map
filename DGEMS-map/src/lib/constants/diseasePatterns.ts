/**
 * 27개 중증질환 정규식 패턴 및 표시 형식 정의
 * 원본: dger-api/public/js/diseasePatterns.js
 */

export interface DiseasePattern {
  original: string;       // 원본 형식
  regex: RegExp;          // 정규식 패턴
  displayFormat: string;  // 표시 형식
  category: string;       // 카테고리
}

// symTypCod를 질환 번호로 매핑
export const SYMPTOM_CODE_TO_DISEASE_MAP: Record<string, number> = {
  'Y0010': 1,   // [재관류중재술] 심근경색
  'Y0020': 2,   // [재관류중재술] 뇌경색
  'Y0031': 3,   // [뇌출혈수술] 거미막하출혈
  'Y0032': 4,   // [뇌출혈수술] 거미막하출혈 외
  'Y0041': 5,   // [대동맥응급] 흉부
  'Y0042': 6,   // [대동맥응급] 복부
  'Y0051': 7,   // [담낭담관질환] 담낭질환
  'Y0052': 8,   // [담낭담관질환] 담도포함질환
  'Y0060': 9,   // [복부응급수술] 비외상
  'Y0070': 10,  // [장중첩/폐색] 영유아
  'Y0081': 11,  // [응급내시경] 성인 위장관
  'Y0082': 12,  // [응급내시경] 영유아 위장관
  'Y0091': 13,  // [응급내시경] 성인 기관지
  'Y0092': 14,  // [응급내시경] 영유아 기관지
  'Y0100': 15,  // [저체중출생아] 집중치료
  'Y0111': 16,  // [산부인과응급] 분만
  'Y0112': 17,  // [산부인과응급] 산과수술
  'Y0113': 18,  // [산부인과응급] 부인과수술
  'Y0120': 19,  // [중증화상] 전문치료
  'Y0131': 20,  // [사지접합] 수족지접합
  'Y0132': 21,  // [사지접합] 수족지접합 외
  'Y0141': 22,  // [응급투석] HD
  'Y0142': 23,  // [응급투석] CRRT
  'Y0150': 24,  // [정신과적응급] 폐쇄병동입원
  'Y0160': 25,  // [안과적수술] 응급
  'Y0171': 26,  // [영상의학혈관중재] 성인
  'Y0172': 27   // [영상의학혈관중재] 영유아
};

// 질환 번호별 표시 패턴
export const DISEASE_DISPLAY_PATTERNS: Record<number, DiseasePattern> = {
  1: {
    original: '[재관류중재술] 심근경색',
    regex: /\[재관류중재술\]\s*심근경색/g,
    displayFormat: '[심근경색] 재관류중재술',
    category: '심근경색'
  },
  2: {
    original: '[재관류중재술] 뇌경색',
    regex: /\[재관류중재술\]\s*뇌경색/g,
    displayFormat: '[뇌경색] 재관류중재술',
    category: '뇌경색'
  },
  3: {
    original: '[뇌출혈수술] 거미막하출혈',
    regex: /\[뇌출혈수술\]\s*거미막하출혈/g,
    displayFormat: '[뇌출혈] 거미막하출혈',
    category: '뇌출혈'
  },
  4: {
    original: '[뇌출혈수술] 거미막하출혈 외',
    regex: /\[뇌출혈수술\]\s*거미막하출혈\s*외/g,
    displayFormat: '[뇌출혈] 거미막하출혈 외',
    category: '뇌출혈'
  },
  5: {
    original: '[대동맥응급] 흉부',
    regex: /\[대동맥응급\]\s*흉부/g,
    displayFormat: '[대동맥응급] 흉부',
    category: '대동맥응급'
  },
  6: {
    original: '[대동맥응급] 복부',
    regex: /\[대동맥응급\]\s*복부/g,
    displayFormat: '[대동맥응급] 복부',
    category: '대동맥응급'
  },
  7: {
    original: '[담낭담관질환] 담낭질환',
    regex: /\[담낭담관질환\]\s*담낭질환/g,
    displayFormat: '[담낭질환] 담낭질환',
    category: '담낭질환'
  },
  8: {
    original: '[담낭담관질환] 담도포함질환',
    regex: /\[담낭담관질환\]\s*담도포함질환/g,
    displayFormat: '[담낭질환] 담도포함질환',
    category: '담낭질환'
  },
  9: {
    original: '[복부응급수술] 비외상',
    regex: /\[복부응급수술\]\s*비외상/g,
    displayFormat: '[복부응급] 비외상',
    category: '복부응급'
  },
  10: {
    original: '[장중첩/폐색] 영유아',
    regex: /\[장중첩\/폐색\]\s*영유아/g,
    displayFormat: '[장중첩] 영유아',
    category: '장중첩'
  },
  11: {
    original: '[응급내시경] 성인 위장관',
    regex: /\[응급내시경\]\s*성인\s*위장관/g,
    displayFormat: '[응급내시경] 성인 위장관',
    category: '응급내시경'
  },
  12: {
    original: '[응급내시경] 영유아 위장관',
    regex: /\[응급내시경\]\s*영유아\s*위장관/g,
    displayFormat: '[응급내시경] 영유아 위장관',
    category: '응급내시경'
  },
  13: {
    original: '[응급내시경] 성인 기관지',
    regex: /\[응급내시경\]\s*성인\s*기관지/g,
    displayFormat: '[응급내시경] 성인 기관지',
    category: '응급내시경'
  },
  14: {
    original: '[응급내시경] 영유아 기관지',
    regex: /\[응급내시경\]\s*영유아\s*기관지/g,
    displayFormat: '[응급내시경] 영유아 기관지',
    category: '응급내시경'
  },
  15: {
    original: '[저체중출생아] 집중치료',
    regex: /\[저체중출생아\]\s*집중치료/g,
    displayFormat: '[저체중출생아] 집중치료',
    category: '저체중출생아'
  },
  16: {
    original: '[산부인과응급] 분만',
    regex: /\[산부인과응급\]\s*분만/g,
    displayFormat: '[산부인과] 분만',
    category: '산부인과'
  },
  17: {
    original: '[산부인과응급] 산과수술',
    regex: /\[산부인과응급\]\s*산과수술/g,
    displayFormat: '[산부인과] 산과수술',
    category: '산부인과'
  },
  18: {
    original: '[산부인과응급] 부인과수술',
    regex: /\[산부인과응급\]\s*부인과수술/g,
    displayFormat: '[산부인과] 부인과수술',
    category: '산부인과'
  },
  19: {
    original: '[중증화상] 전문치료',
    regex: /\[중증화상\]\s*전문치료/g,
    displayFormat: '[중증화상] 전문치료',
    category: '중증화상'
  },
  20: {
    original: '[사지접합] 수족지접합',
    regex: /\[사지접합\]\s*수족지접합/g,
    displayFormat: '[사지접합] 수족지접합',
    category: '사지접합'
  },
  21: {
    original: '[사지접합] 수족지접합 외',
    regex: /\[사지접합\]\s*수족지접합\s*외/g,
    displayFormat: '[사지접합] 수족지접합 외',
    category: '사지접합'
  },
  22: {
    original: '[응급투석] HD',
    regex: /\[응급투석\]\s*HD/g,
    displayFormat: '[응급투석] HD',
    category: '응급투석'
  },
  23: {
    original: '[응급투석] CRRT',
    regex: /\[응급투석\]\s*CRRT/g,
    displayFormat: '[응급투석] CRRT',
    category: '응급투석'
  },
  24: {
    original: '[정신과적응급] 폐쇄병동입원',
    regex: /\[정신과적응급\]\s*폐쇄병동입원/g,
    displayFormat: '[정신과응급] 폐쇄병동입원',
    category: '정신과응급'
  },
  25: {
    original: '[안과적수술] 응급',
    regex: /\[안과적수술\]\s*응급/g,
    displayFormat: '[안과응급] 응급수술',
    category: '안과응급'
  },
  26: {
    original: '[영상의학혈관중재] 성인',
    regex: /\[영상의학혈관중재\]\s*성인/g,
    displayFormat: '[영상의학] 성인 혈관중재',
    category: '영상의학'
  },
  27: {
    original: '[영상의학혈관중재] 영유아',
    regex: /\[영상의학혈관중재\]\s*영유아/g,
    displayFormat: '[영상의학] 영유아 혈관중재',
    category: '영상의학'
  }
};

/**
 * symTypCod로 질환 번호 가져오기
 */
export function getDiseaseNumberBySymptomCode(symTypCod: string): number | null {
  return SYMPTOM_CODE_TO_DISEASE_MAP[symTypCod] || null;
}

/**
 * 질환 번호로 패턴 가져오기
 */
export function getDiseasePattern(diseaseNumber: number): DiseasePattern | null {
  return DISEASE_DISPLAY_PATTERNS[diseaseNumber] || null;
}

/**
 * 질환별 메시지 포맷팅
 */
export function formatDiseaseMessage(
  message: string,
  selectedDisease: number | string
): {
  category: string;
  subcategory: string;
  content: string;
  displayName: string;
} | null {
  const diseaseNum = typeof selectedDisease === 'string'
    ? parseInt(selectedDisease)
    : selectedDisease;

  if (!message || !diseaseNum || !DISEASE_DISPLAY_PATTERNS[diseaseNum]) {
    return null;
  }

  const pattern = DISEASE_DISPLAY_PATTERNS[diseaseNum];

  return {
    category: pattern.displayFormat.split(']')[0] + ']',
    subcategory: pattern.displayFormat.split('] ')[1] || '',
    content: message,
    displayName: pattern.displayFormat
  };
}

/**
 * 카테고리별 질환 목록 가져오기
 */
export function getDiseasesByCategory(category: string): number[] {
  return Object.entries(DISEASE_DISPLAY_PATTERNS)
    .filter(([, pattern]) => pattern.category === category)
    .map(([num]) => parseInt(num));
}

/**
 * 모든 카테고리 목록 가져오기
 */
export function getDiseaseCategories(): string[] {
  const categories = Object.values(DISEASE_DISPLAY_PATTERNS).map(p => p.category);
  return [...new Set(categories)];
}

/**
 * symTypCod로 질환 라벨 가져오기
 */
export function getDiseaseLabelBySymptomCode(symTypCod: string): string | null {
  const diseaseNum = SYMPTOM_CODE_TO_DISEASE_MAP[symTypCod];
  if (!diseaseNum) return null;

  const pattern = DISEASE_DISPLAY_PATTERNS[diseaseNum];
  if (!pattern) return null;

  // 원본 형식에서 첫 번째 대괄호 안의 내용 추출
  const match = pattern.original.match(/\[([^\]]+)\]/);
  return match ? match[1] : null;
}
