/**
 * 메시지 하이라이트 사전
 *
 * 응급 메시지에서 키워드를 색상으로 구분하기 위한 사전입니다.
 * messageClassifier.ts의 parseMessageWithHighlights 함수에서 사용됩니다.
 *
 * 색상 규칙:
 * - 진료과목 (department): 파란색 - text-blue-400/600
 * - 의료진 (staff): 빨간색 - text-red-400/600
 * - 장비 (equipment): 초록색 - text-green-400/600
 * - 질환명 (disease): 보라색 - text-purple-400/600
 */

/**
 * 진료과목 (Department) - 파란색
 * 대괄호 형태 [진료과목] 또는 대괄호 없이 사용
 */
export const DEPARTMENT_KEYWORDS = [
  // 내과 계열
  '감염내과',
  '혈액종양내과',
  '내분비내과',
  '심장내과',
  '호흡기내과',
  '소화기내과',
  '신장내과',
  '류마티스내과',
  '내과',

  // 외과 계열
  '신경외과',
  '정형외과',
  '흉부외과',
  '성형외과',
  '구강악면외과',
  '대장항문외과',
  '외과',

  // 전문 진료과
  '영상의학과',
  '비뇨의학과',
  '비뇨기과',
  '신경과',
  '치과',
  '산부인과',
  '산과',
  '부인과',
  '피부과',
  '소아청소년과',
  '소아신경과',
  '재활의학과',
  '마취통증의학과',
  '응급의학과',
  '이비인후과',
  '안과',
  '정신건강의학과',
  '가정의학과',
];

/**
 * 의료진 관련 (Staff) - 빨간색
 */
export const STAFF_KEYWORDS = [
  '의료진',
];

/**
 * 의료 장비 (Equipment) - 초록색
 */
export const EQUIPMENT_KEYWORDS = [
  // 영상 장비
  'CT',
  'MRI',
  'X-ray',
  '초음파',

  // 내시경/시술 장비
  '내시경',

  // 생명유지 장비
  '인공호흡기',
  '호흡기',
  'ECMO',
  '산소',
  '모니터',

  // 투석 장비
  '투석',
  '혈액투석',

  // 일반
  '장비',
  '기기',
  '기계',
  'sono',
];

/**
 * 질환명 (Disease) - 보라색
 */
export const DISEASE_KEYWORDS = [
  // 뇌혈관 질환
  '뇌출혈',
  '뇌경색',
  'stroke',
  'storke',  // typo 대응
  'acute stroke',
  'acute storke',  // typo 대응

  // 심혈관 질환
  '심근경색',
  '대동맥',
  '경색',

  // 외상/응급
  '골절',
  '출혈',
  '외상',
  '화상',
  '중증외상',
  '복부손상',
  '사지접합',

  // 감염/중환자
  '패혈증',
  '쇼크',
  '중환자실',

  // 소아 질환
  '장중첩',
  '장충첩증',  // typo 대응
  '정복술',
  '폐색',
  '저체중출생아',
  '소아응급',

  // 간담도 질환
  '간질환',
  '담낭',
  '담도',

  // 신경/척추 질환
  'epilepsy',
  'seizure',
  'spine',
  '척추',
  '경련',

  // 산모 관련
  '산모',

  // 두경부 질환
  '두경부',
  '심경부감염',
  '급성후두개염',
  '후두개염',
  '상기도 폐쇄',
  '목통증',

  // 식도 질환
  '식도 응급질환',
  '식도',

  // 호흡기/출혈 질환
  '객혈',
  'BAE',  // Bronchial Artery Embolization

  // 의식/정신 관련
  '의식저하',
  '약물중독',
  '자해',

  // 일반
  '수술',
  '급성',
  '중증',
];

/**
 * 전체 하이라이트 사전
 */
export const HIGHLIGHT_DICTIONARY = {
  department: DEPARTMENT_KEYWORDS,
  staff: STAFF_KEYWORDS,
  equipment: EQUIPMENT_KEYWORDS,
  disease: DISEASE_KEYWORDS,
};

/**
 * 색상 매핑 (다크모드/라이트모드)
 */
export const HIGHLIGHT_COLORS = {
  department: {
    dark: 'text-blue-400 font-semibold',
    light: 'text-blue-600 font-semibold',
    description: '진료과목',
  },
  staff: {
    dark: 'text-red-400 font-semibold',
    light: 'text-red-600 font-semibold',
    description: '의료진',
  },
  equipment: {
    dark: 'text-green-400 font-semibold',
    light: 'text-green-600 font-semibold',
    description: '장비',
  },
  disease: {
    dark: 'text-purple-400 font-semibold',
    light: 'text-purple-600 font-semibold',
    description: '질환명',
  },
};

export default HIGHLIGHT_DICTIONARY;
