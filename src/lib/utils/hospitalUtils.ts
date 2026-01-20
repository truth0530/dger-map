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

  // 서울 지역 (긴 이름 병원 추가)
  "서울대학교병원": "서울대병원",
  "재단법인아산사회복지재단서울아산병원": "서울아산",
  "서울아산병원": "서울아산",
  "삼성서울병원": "삼성서울",
  "연세대학교의과대학세브란스병원": "세브란스",
  "세브란스병원": "세브란스",
  "학교법인가톨릭학원가톨릭대학교서울성모병원": "서울성모",
  "연세대학교의과대학강남세브란스병원": "강남세브란스",
  "가톨릭대학교은평성모병원": "은평성모",
  "고려대학교의과대학부속구로병원": "고대구로",
  "고려대학교안암병원": "고대안암",
  "고려대학교구로병원": "고대구로",
  "서울성모병원": "서울성모",
  "이화여자대학교의과대학부속서울병원": "이대서울",
  "순천향대학교 부속 서울병원": "순천향서울",
  "이화여자대학교의과대학부속목동병원": "이대목동",
  "서울특별시보라매병원": "보라매",
  "성심의료재단강동성심병원": "강동성심",
  "의료법인서울효천의료재단에이치플러스양지병원": "H+양지",
  "가톨릭대학교여의도성모병원": "여의도성모",
  "한림대학교강남성심병원": "강남성심",
  "강동경희대학교의대병원": "강동경희대",
  "인제대학교상계백병원": "상계백",
  "노원을지대학교병원": "노원을지대",
  "서울특별시서남병원": "서남병원",
  "한국원자력의학원원자력병원": "원자력",
  "서울특별시동부병원": "동부병원",
  "서울적십자병원": "적십자",
  "의료법인풍산의료재단동부제일병원": "동부제일",
  "학교법인고려중앙학원고려대학교의과대학부속병원(안암병원)": "고대안암",
  "서울특별시서울의료원": "서울의료원",
  "한림대학교한강성심병원": "한강성심",

  // 부산 지역
  "부산대학교병원": "부산대병원",
  "인제대학교 해운대백병원": "해운대백",
  "고신대학교복음병원": "고신복음",
  "의료법인 은성의료재단 좋은삼선병원": "좋은삼선",
  "비에이치에스한서병원": "BHS한서",
  "인제대학교부산백병원": "부산백",
  "의료법인 온그룹의료재단 온병원": "온병원",
  "의료법인 광혜의료재단 광혜병원": "광혜",
  "의료법인 은성의료재단 좋은강안병원": "좋은강안",
  "부산성모병원(재단법인 천주교부산교구유지재단)": "부산성모",
  "부산광역시의료원": "부산의료원",
  "동남권원자력의학원원자력병원": "동남원자력",
  "의료법인 인당의료재단 해운대부민병원": "해운대부민",
  "재단법인천주교부산교구유지재단 메리놀병원": "메리놀",

  // 인천 지역
  "인하대학교병원": "인하대병원",
  "가톨릭관동대학교국제성모병원": "국제성모",
  "가톨릭대학교 인천성모병원": "인천성모",
  "의료법인 나사렛의료재단 나사렛국제병원": "나사렛국제",
  "인천광역시의료원": "인천의료원",
  "인천광역시의료원백령병원": "백령병원",

  // 대전 지역
  "학교법인가톨릭학원가톨릭대학교대전성모병원": "대전성모",
  "학교법인을지학원대전을지대학교병원": "대전을지대",
  "충남대학교병원": "충남대병원",

  // 울산 지역
  "학교법인울산공업학원울산대학교병원": "울산대병원",
  "울산대학교병원": "울산대병원",

  // 세종 지역
  "의료법인 영제 의료재단 엔케이세종병원": "NK세종",

  // 경기 지역
  "아주대학교병원": "아주대병원",
  "가톨릭대학교의정부성모병원": "의정부성모",
  "차의과학대학교분당차병원": "분당차",
  "가톨릭대학교성빈센트병원": "성빈센트",
  "국민건강보험공단일산병원": "일산병원",
  "순천향대학교부속부천병원": "순천향부천",
  "가톨릭대학교부천성모병원": "부천성모",
  "연세대학교의과대학용인세브란스병원": "용인세브란스",
  "학교법인을지학원의정부을지대학교병원": "의정부을지대",
  "경기도의료원이천병원": "이천의료원",
  "경기도의료원파주병원": "파주의료원",
  "경기도의료원포천병원": "포천의료원",
  "경기도의료원안성병원": "안성의료원",
  "의료법인자인의료재단(더자인병원)": "더자인",
  "경기도의료원수원병원": "수원의료원",
  "근로복지공단안산병원": "안산근로복지",
  "경기도의료원의정부병원": "의정부의료원",
  "의료법인은혜와감사의료재단화성중앙종합병원": "화성중앙",
  "연천군보건의료원": "연천의료원",

  // 강원 지역
  "강원대학교병원": "강원대병원",
  "연세대학교원주세브란스기독병원": "원주세브란스",
  "강원특별자치도삼척의료원": "삼척의료원",
  "강원특별자치도속초의료원": "속초의료원",
  "강원특별자치도원주의료원": "원주의료원",
  "근로복지공단태백병원": "태백근로복지",
  "강원특별자치도영월의료원": "영월의료원",
  "근로복지공단정선병원": "정선근로복지",
  "강원특별자치도강릉의료원": "강릉의료원",
  "화천군보건의료원": "화천의료원",
  "평창군보건의료원": "평창의료원",

  // 충북 지역
  "충북대학교병원": "충북대병원",
  "충청북도청주의료원": "청주의료원",
  "충청북도충주의료원": "충주의료원",
  "단양군보건의료원": "단양의료원",

  // 충남 지역
  "학교법인동은학원순천향대학교부속천안병원": "순천향천안",
  "충청남도서산의료원": "서산의료원",
  "충청남도홍성의료원": "홍성의료원",
  "재단법인아산사회복지재단보령아산병원": "보령아산",
  "충청남도공주의료원": "공주의료원",
  "학교법인건양교육재단건양대학교부여병원": "건양대부여",
  "충청남도천안의료원": "천안의료원",
  "청양군보건의료원": "청양의료원",
  "태안군보건의료원": "태안의료원",

  // 전북 지역
  "전북대학교병원": "전북대병원",
  "원광대학교병원": "원광대병원",
  "재단법인예수병원유지재단예수병원": "예수병원",
  "전북특별자치도군산의료원": "군산의료원",
  "전북특별자치도남원의료원": "남원의료원",
  "재단법인 아산사회복지재단 정읍아산병원": "정읍아산",
  "무주군보건의료원": "무주의료원",
  "순창군보건의료원": "순창의료원",
  "임실군보건의료원": "임실의료원",
  "장수군보건의료원": "장수의료원",

  // 전남 지역
  "전남대학교병원": "전남대병원",
  "조선대학교병원": "조선대병원",
  "의료법인목포구암의료재단목포중앙병원": "목포중앙",
  "전라남도강진의료원": "강진의료원",
  "전라남도순천의료원": "순천의료원",

  // 경북 지역
  "경상국립대학교병원": "경상대병원",
  "차의과학대학교부속구미차병원": "구미차",
  "동국대학교의과대학경주병원": "동국대경주",
  "순천향대학교부속구미병원": "순천향구미",
  "경상북도김천의료원": "김천의료원",
  "의)근원의료재단경산중앙병원": "경산중앙",
  "경상북도포항의료원": "포항의료원",
  "경상북도안동의료원": "안동의료원",
  "울릉군보건의료원": "울릉의료원",
  "청송군보건의료원": "청송의료원",

  // 경남 지역
  "의료법인합포의료재단에스엠지연세병원": "SMG연세",
  "학교법인성균관대학삼성창원병원": "삼성창원",
  "경상남도마산의료원": "마산의료원",
  "의료법인 문병욱의료재단 진주고려병원": "진주고려",
  "의료법인승연의료재단 삼천포서울병원": "삼천포서울",
  "산청군보건의료원": "산청의료원",

  // 제주 지역
  "제주대학교병원": "제주대병원",
  "제주특별자치도서귀포의료원": "서귀포의료원"
};

/**
 * 규칙 기반 병원명 자동 단축
 * 1. 법인/재단 관련 전체 패턴 제거
 * 2. 대학명 축약 (○○대학교 → ○○대)
 * 3. 공공기관 접두어 축약
 */
function autoShortenHospitalName(name: string): string {
  let result = name;

  // 1. 법인/재단 관련 전체 패턴 제거 (긴 것부터)
  // 예: "의료법인XXX의료재단" → 제거, "재단법인XXX재단" → 제거, "학교법인XXX학원" → 제거
  const legalEntityPatterns = [
    // 학교법인 + 학원 패턴 (예: "학교법인가톨릭학원", "학교법인고려중앙학원")
    /학교법인[가-힣]+학원/g,
    // 재단법인 + 재단 패턴 (예: "재단법인아산사회복지재단", "재단법인예수병원유지재단")
    /재단법인[가-힣\s]+재단/g,
    // 의료법인 + 의료재단 패턴 (예: "의료법인XXX의료재단")
    /의료법인\s*[가-힣]+의료재단/g,
    // 단순 접두어들
    /^사회복지법인\s*/,
    /^의료법인\s*/,
    /^재단법인\s*/,
    /^학교법인\)?\s*/,
    /^사단법인\s*/,
    /^\(재\)\s*/,
    /^\(의\)\s*/,
    /^의\)\s*/,
    /^\(사\)\s*/,
    /^\(학\)\s*/,
    // 공공기관 접두어
    /^한국보훈복지의료공단\s*/,
    /^근로복지공단\s*/,
    /^국민건강보험공단\s*/,
    /^한국원자력의학원\s*/,
    /^동남권원자력의학원\s*/,
  ];
  for (const pattern of legalEntityPatterns) {
    result = result.replace(pattern, '').trim();
  }

  // 2. 남은 법인/재단 관련 단어 제거
  const remainingPatterns = [
    /[가-힣]+의료재단\s*/g,    // "XXX의료재단" 제거
    /[가-힣]+재단\s*/g,        // "XXX재단" 제거 (단, 병원명에 포함된 경우 주의)
  ];
  // 주의: 병원명 자체가 재단인 경우 보호 (예: "예수병원")
  for (const pattern of remainingPatterns) {
    // 병원명 끝에 붙은 경우만 보존
    if (!result.endsWith('병원') && !result.endsWith('의료원')) {
      result = result.replace(pattern, '').trim();
    } else {
      // 병원명 전까지만 제거
      const hospitalIdx = Math.max(result.lastIndexOf('병원'), result.lastIndexOf('의료원'));
      if (hospitalIdx > 0) {
        const prefix = result.substring(0, hospitalIdx);
        const suffix = result.substring(hospitalIdx);
        const cleanedPrefix = prefix.replace(pattern, '').trim();
        result = cleanedPrefix + suffix;
      }
    }
  }

  // 3. 지역명 + 특별(자치)시/도 축약
  const regionPatterns = [
    /^서울특별시/,
    /^부산광역시/,
    /^인천광역시/,
    /^대구광역시/,
    /^광주광역시/,
    /^대전광역시/,
    /^울산광역시/,
    /^세종특별자치시/,
    /^경기도/,
    /^강원특별자치도/,
    /^충청북도/,
    /^충청남도/,
    /^전북특별자치도/,
    /^전라남도/,
    /^경상북도/,
    /^경상남도/,
    /^제주특별자치도/,
  ];
  for (const pattern of regionPatterns) {
    result = result.replace(pattern, '').trim();
  }

  // 4. 대학명 축약
  result = result
    .replace(/의과대학부속/g, '')           // 의과대학부속 제거
    .replace(/의과대학/g, '')               // 의과대학 제거
    .replace(/대학교병원$/, '대병원')        // "○○대학교병원" → "○○대병원"
    .replace(/대학교\s*부속\s*/, '대')       // "대학교 부속" → "대"
    .replace(/대학교(\s*)/, '대$1');         // "대학교" → "대"

  // 5. 괄호 안 부가정보 정리 (단, 병원명인 경우 보존)
  // 예: "(재단법인 천주교부산교구유지재단)" 제거, but "(안암병원)" 보존
  result = result.replace(/\([^)]*법인[^)]*\)/g, '').trim();
  result = result.replace(/\([^)]*재단[^)]*\)/g, '').trim();

  // 6. 연속 공백 제거
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

/**
 * 병원명을 약어로 변환
 * 1. 먼저 하드코딩된 매핑 확인
 * 2. 없으면 규칙 기반 자동 단축 적용
 */
export function shortenHospitalName(name: string): string {
  if (!name) return '-';

  // 하드코딩된 매핑 우선
  if (HOSPITAL_NAME_MAPPING[name]) {
    return HOSPITAL_NAME_MAPPING[name];
  }

  // 규칙 기반 자동 단축
  return autoShortenHospitalName(name);
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
