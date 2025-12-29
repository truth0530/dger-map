/**
 * 42개 자원조사 대분류/소분류 분류 체계
 * - JSON 데이터(daegu-data.json)의 질환명과 정확히 일치
 */

export interface DiseaseSubCategory {
  key: string;      // 질환명 (JSON 데이터와 일치)
  label: string;    // 표시명
}

export interface DiseaseCategory {
  key: string;                      // 대분류 키
  label: string;                    // 대분류 표시명
  subcategories: DiseaseSubCategory[];  // 소분류 목록 (없으면 빈 배열)
}

/**
 * 42개 자원조사 대분류/소분류 구조
 * - 대분류만 있는 경우: subcategories가 빈 배열, 대분류 label이 질환명
 * - 대분류 + 소분류가 있는 경우: subcategories에 세부 질환 목록
 */
export const DISEASE_CATEGORIES: DiseaseCategory[] = [
  {
    key: 'obstetrics',
    label: '산부인과 응급',
    subcategories: [
      { key: '응급분만', label: '응급분만' },
      { key: '응급제왕절개', label: '응급제왕절개' },
      { key: '자궁손상 및 출혈', label: '자궁손상 및 출혈' },
    ],
  },
  {
    key: 'pediatric_surgery',
    label: '소아외과(복부) 응급수술',
    subcategories: [],  // 대분류만 존재
  },
  {
    key: 'psychiatric',
    label: '정신과적 응급 입원',
    subcategories: [],  // 대분류만 존재
  },
  {
    key: 'brain',
    label: '응급 뇌질환/수술',
    subcategories: [
      { key: '자발성 뇌내출혈', label: '자발성 뇌내출혈' },
      { key: '자발성 지주막하출혈', label: '자발성 지주막하출혈' },
      { key: '동정맥 기형', label: '동정맥 기형' },
      { key: '뇌혈관중재술', label: '뇌혈관중재술' },
    ],
  },
  {
    key: 'facial_neck',
    label: '응급 안면부·경부 질환',
    subcategories: [
      { key: '치아골절 및 탈구', label: '치아골절 및 탈구' },
      { key: '안면골 골절', label: '안면골 골절' },
      { key: '안면열상', label: '안면열상' },
      { key: '경부혈관 손상', label: '경부혈관 손상' },
      { key: '기관손상', label: '기관손상' },
    ],
  },
  {
    key: 'eye',
    label: '수술이 필요한 응급 안질환',
    subcategories: [
      { key: '응급망막질환', label: '응급망막질환' },
      { key: '안구손상', label: '안구손상' },
      { key: '안와 및 안와주위손상', label: '안와 및 안와주위손상' },
    ],
  },
  {
    key: 'ecmo',
    label: '체외막산소화장치(ECMO)',
    subcategories: [],  // 대분류만 존재
  },
  {
    key: 'bronchoscopy',
    label: '응급 기관지내시경',
    subcategories: [
      { key: '성인 기관지내시경', label: '성인 기관지내시경' },
      { key: '소아 기관지내시경', label: '소아 기관지내시경' },
    ],
  },
  {
    key: 'cardiovascular',
    label: '응급 심혈관수술/시술',
    subcategories: [
      { key: '관동맥치환술', label: '관동맥치환술' },
      { key: '대동맥질환', label: '대동맥질환' },
      { key: '말초동맥질환', label: '말초동맥질환' },
      { key: '응급 심혈관 중재술', label: '응급 심혈관 중재술' },
    ],
  },
  {
    key: 'spine',
    label: '응급 척추손상 수술',
    subcategories: [],  // 대분류만 존재
  },
  {
    key: 'gi_endoscopy',
    label: '응급 내시경(위장관)',
    subcategories: [
      { key: '성인 위장관내시경', label: '성인 위장관내시경' },
      { key: '소아 위장관내시경', label: '소아 위장관내시경' },
    ],
  },
  {
    key: 'digestive_surgery',
    label: '응급 소화기계 수술/시술',
    subcategories: [
      { key: '응급식도질환 수술', label: '응급식도질환 수술' },
      { key: '소화관 응급수술', label: '소화관 응급수술' },
      { key: '소아장중첩증 수술', label: '소아장중첩증 수술' },
      { key: '소아장중첩증 비관혈적 정복술', label: '소아장중첩증 비관혈적 정복술' },
      { key: '급성 담낭담관질환(ERCP)', label: '급성 담낭담관질환(ERCP)' },
      { key: '응급 간담췌질환(PTBD, PTGBD)', label: '응급 간담췌질환(PTBD, PTGBD)' },
    ],
  },
  {
    key: 'urogenital',
    label: '비뇨생식기 응급',
    subcategories: [
      { key: '신장손상 수술', label: '신장손상 수술' },
      { key: '방광 및 요도손상 수술', label: '방광 및 요도손상 수술' },
      { key: '외음부 및 음경손상 수술', label: '외음부 및 음경손상 수술' },
    ],
  },
  {
    key: 'crrt',
    label: '지속적 신대체요법(CRRT)',
    subcategories: [],  // 대분류만 존재
  },
  {
    key: 'hemodialysis',
    label: '혈액투석(HD)',
    subcategories: [],  // 대분류만 존재
  },
  {
    key: 'low_birth_weight',
    label: '저체중출생아',  // JSON 데이터와 일치
    subcategories: [],  // 대분류만 존재
  },
  {
    key: 'microsurgery',
    label: '응급 미세수술',
    subcategories: [
      { key: '사지접합 수술', label: '사지접합 수술' },
      { key: '수족지접합', label: '수족지접합' },  // JSON 데이터와 일치
    ],
  },
  {
    key: 'hypothermia',
    label: '저체온요법',
    subcategories: [],  // 대분류만 존재
  },
];

/**
 * 대분류 키로 카테고리 찾기
 */
export function getCategoryByKey(key: string): DiseaseCategory | undefined {
  return DISEASE_CATEGORIES.find(cat => cat.key === key);
}

/**
 * 소분류 키(질환명)로 해당 대분류 찾기
 */
export function getCategoryByDiseaseName(diseaseName: string): DiseaseCategory | undefined {
  return DISEASE_CATEGORIES.find(cat =>
    cat.subcategories.some(sub => sub.key === diseaseName) ||
    (cat.subcategories.length === 0 && cat.label === diseaseName)
  );
}

/**
 * 특정 대분류의 모든 질환명 목록 가져오기
 * - 소분류가 있으면: 소분류 key 목록
 * - 소분류가 없으면: [대분류 label]
 */
export function getDiseaseNamesByCategory(categoryKey: string): string[] {
  const category = getCategoryByKey(categoryKey);
  if (!category) return [];

  if (category.subcategories.length === 0) {
    return [category.label];
  }
  return category.subcategories.map(sub => sub.key);
}

/**
 * 전체 질환명 목록 (플랫 리스트)
 */
export function getAllDiseaseNames(): string[] {
  const names: string[] = [];

  DISEASE_CATEGORIES.forEach(cat => {
    if (cat.subcategories.length === 0) {
      names.push(cat.label);
    } else {
      cat.subcategories.forEach(sub => {
        names.push(sub.key);
      });
    }
  });

  return names;
}

/**
 * 통계 정보
 */
export const DISEASE_STATS = {
  totalCategories: DISEASE_CATEGORIES.length,  // 18개 대분류
  totalDiseases: getAllDiseaseNames().length,   // 42개 질환
  categoriesWithSubcategories: DISEASE_CATEGORIES.filter(c => c.subcategories.length > 0).length,
  categoriesOnlyMajor: DISEASE_CATEGORIES.filter(c => c.subcategories.length === 0).length,
};

/**
 * 42개 대분류 → 27개 실시간 중증질환 매핑
 * - 각 42개 대분류 key에 대응되는 27개 MKioskTy 키 목록
 * - 매칭되는 질환이 없으면 빈 배열
 */
export const CATEGORY_TO_SEVERE_MAPPING: Record<string, string[]> = {
  // 산부인과 응급 → 분만, 산과수술, 부인과수술
  obstetrics: ['MKioskTy16', 'MKioskTy17', 'MKioskTy18'],

  // 소아외과(복부) 응급수술 - 27개에 없음
  pediatric_surgery: [],

  // 정신과적 응급 입원 → 폐쇄병동입원
  psychiatric: ['MKioskTy24'],

  // 응급 뇌질환/수술 → 뇌경색, 거미막하출혈, 거미막하출혈 외
  brain: ['MKioskTy2', 'MKioskTy3', 'MKioskTy4'],

  // 응급 안면부·경부 질환 - 27개에 없음
  facial_neck: [],

  // 수술이 필요한 응급 안질환 → 안과적수술 응급
  eye: ['MKioskTy25'],

  // 체외막산소화장치(ECMO) - 27개에 없음
  ecmo: [],

  // 응급 기관지내시경 → 성인/영유아 기관지
  bronchoscopy: ['MKioskTy13', 'MKioskTy14'],

  // 응급 심혈관수술/시술 → 심근경색, 대동맥 흉부/복부
  cardiovascular: ['MKioskTy1', 'MKioskTy5', 'MKioskTy6'],

  // 응급 척추손상 수술 - 27개에 없음
  spine: [],

  // 응급 내시경(위장관) → 성인/영유아 위장관
  gi_endoscopy: ['MKioskTy11', 'MKioskTy12'],

  // 응급 소화기계 수술/시술 → 복부응급, 장중첩, 담낭담관
  digestive_surgery: ['MKioskTy7', 'MKioskTy8', 'MKioskTy9', 'MKioskTy10'],

  // 비뇨생식기 응급 - 27개에 없음
  urogenital: [],

  // 지속적 신대체요법(CRRT) → 응급투석 CRRT
  crrt: ['MKioskTy23'],

  // 혈액투석(HD) → 응급투석 HD
  hemodialysis: ['MKioskTy22'],

  // 저체중출생아 → 저체중출생아 집중치료
  low_birth_weight: ['MKioskTy15'],

  // 응급 미세수술 → 수족지접합, 수족지접합 외
  microsurgery: ['MKioskTy20', 'MKioskTy21'],

  // 저체온요법 - 27개에 없음
  hypothermia: [],
};

/**
 * 특정 42개 대분류에 매칭되는 27개 실시간 질환 키 목록 반환
 */
export function getMatchedSevereKeys(categoryKey: string): string[] {
  return CATEGORY_TO_SEVERE_MAPPING[categoryKey] || [];
}

/**
 * 특정 27개 질환 키가 42개 대분류에 매칭되는지 확인
 */
export function isSevereKeyMatchedToCategory(severeKey: string, categoryKey: string): boolean {
  const matchedKeys = CATEGORY_TO_SEVERE_MAPPING[categoryKey];
  return matchedKeys ? matchedKeys.includes(severeKey) : false;
}
