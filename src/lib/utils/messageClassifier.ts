/**
 * 메시지 분류 및 상태 감지 유틸리티
 * 원본: dger-api/public/js/messageClassifier.js
 *
 * 응급실 메시지와 중증질환별 메시지를 구분하여 처리
 */

import {
  SYMPTOM_CODE_TO_DISEASE_MAP,
  DISEASE_DISPLAY_PATTERNS
} from '@/lib/constants/diseasePatterns';

export type MessageStatusColor = 'red' | 'orange' | 'green' | 'gray';

export interface MessageStatus {
  label: string;
  color: MessageStatusColor;
}

export interface ParsedMessage {
  department: string;
  status: MessageStatus;
  details: string;
  diseaseLabel: string;
}

export interface DiseaseInfo {
  qn?: number;
  category: string;
  subcategory: string;
  content: string;
  displayName: string;
}

export interface ClassifiedMessages {
  emergency: Array<{ msg: string; symTypCod: string }>;
  disease: DiseaseInfo | null;
  allDiseases: DiseaseInfo[];
}

// 상태 색상 맵핑
export const STATUS_COLOR_MAP: Record<MessageStatusColor, { text: string; bg: string }> = {
  red: { text: '#d32f2f', bg: '#fff1f1' },
  orange: { text: '#f57c00', bg: '#fff3e0' },
  green: { text: '#2e7d32', bg: '#f1f8f4' },
  gray: { text: '#666666', bg: '#f5f5f5' }
};

/**
 * 상태 분류 함수
 */
export function classifyStatus(text: string): MessageStatus {
  if (!text) return { label: '기타', color: 'gray' };

  const lowerText = text.toLowerCase();

  if (lowerText.includes('의료진') && (lowerText.includes('부족') || lowerText.includes('부재'))) {
    return { label: '의료진 부족/부재', color: 'red' };
  }
  if (lowerText.includes('신환') && lowerText.includes('불가')) {
    return { label: '신환 수용불가', color: 'orange' };
  }
  if (lowerText.includes('불가')) {
    return { label: '진료불가', color: 'orange' };
  }
  if (lowerText.includes('정상')) {
    return { label: '정상 운영', color: 'green' };
  }

  return { label: '기타', color: 'gray' };
}

/**
 * 질환 번호로 질환 라벨 가져오기
 */
export function getDiseaseLabel(qn: string | number): string {
  const num = typeof qn === 'string' ? parseInt(qn) : qn;
  const pattern = DISEASE_DISPLAY_PATTERNS[num];
  if (pattern) {
    // [카테고리] 세부명 형식에서 카테고리만 추출
    const match = pattern.original.match(/\[([^\]]+)\]/);
    return match ? match[1] : pattern.original;
  }
  return `질환 ${qn}`;
}

/**
 * 메시지 파싱 함수
 */
export function parseMessage(message: string, symTypCod: string = ''): ParsedMessage {
  if (!message) {
    return {
      department: '기타',
      status: { label: '기타', color: 'gray' },
      details: '',
      diseaseLabel: ''
    };
  }

  // 질환 라벨 추출 (symTypCod가 있으면)
  let diseaseLabel = '';
  if (symTypCod) {
    const diseaseNum = SYMPTOM_CODE_TO_DISEASE_MAP[symTypCod];
    if (diseaseNum && DISEASE_DISPLAY_PATTERNS[diseaseNum]) {
      const pattern = DISEASE_DISPLAY_PATTERNS[diseaseNum];
      // 원본 형식에서 첫 번째 대괄호 안의 내용 추출
      const match = pattern.original.match(/\[([^\]]+)\]/);
      if (match) {
        diseaseLabel = match[1];
      }
    }
  }

  // 패턴 1: [진료과목] 상태 내용
  const pattern1 = /^\[([^\]]+)\]\s*(.*)$/;
  const match1 = message.match(pattern1);

  if (match1) {
    const dept = match1[1].trim();
    const rest = match1[2].trim();
    const status = classifyStatus(rest);
    const details = rest.replace(status.label, '').trim();

    return {
      department: dept,
      status,
      details: details || rest,
      diseaseLabel
    };
  }

  // 패턴 2: 진료과목 상태 내용 (구분자 없음)
  const statusPattern = /(의료진\s*부(?:족|재)|신환\s*수용\s*불가|진료\s*불가|정상\s*운영)/;
  const statusMatch = message.match(statusPattern);

  if (statusMatch) {
    const statusText = statusMatch[0];
    const status = classifyStatus(statusText);
    const parts = message.split(statusPattern);
    const dept = parts[0].trim() || '응급실';
    const details = parts.slice(1).join('').trim();

    return {
      department: dept,
      status,
      details: details || message,
      diseaseLabel
    };
  }

  // 매칭 실패 시 원본 메시지
  return {
    department: '응급실',
    status: { label: '기타', color: 'gray' },
    details: message,
    diseaseLabel
  };
}

/**
 * 상태 색상별 Tailwind 클래스
 */
export function getStatusColorClasses(color: MessageStatusColor): {
  bg: string;
  text: string;
  border: string;
} {
  switch (color) {
    case 'red':
      return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' };
    case 'orange':
      return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40' };
    case 'green':
      return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40' };
    default:
      return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/40' };
  }
}

/**
 * 메시지를 응급실/중증질환별로 분류하는 함수
 */
export function classifyMessages(
  diseaseMessage: string | null,
  emergencyMessages: Array<{ msg: string; symTypCod: string }> | string[] | null,
  selectedDisease: number | string | null,
  severeAcceptanceMap?: Map<string, { status: string; message: string }>,
  hpid?: string
): ClassifiedMessages {
  const result: ClassifiedMessages = {
    emergency: [],
    disease: null,
    allDiseases: []
  };

  // 응급 메시지 정규화
  if (emergencyMessages) {
    result.emergency = emergencyMessages.map(msg => {
      if (typeof msg === 'string') {
        return { msg, symTypCod: '' };
      }
      return msg;
    });
  }

  const diseaseNum = selectedDisease
    ? (typeof selectedDisease === 'string' ? parseInt(selectedDisease) : selectedDisease)
    : null;

  // 1. 질환이 선택된 경우: 해당 질환의 상태 확인
  if (diseaseNum && severeAcceptanceMap && hpid) {
    const acceptance = severeAcceptanceMap.get(hpid);
    if (acceptance && acceptance.status === 'N') {
      const pattern = DISEASE_DISPLAY_PATTERNS[diseaseNum];
      if (pattern) {
        result.disease = {
          category: pattern.displayFormat.split(']')[0] + ']',
          subcategory: pattern.displayFormat.split('] ')[1] || '',
          content: acceptance.message || `${pattern.displayFormat} - 수용불가`,
          displayName: pattern.displayFormat
        };
      }
    }
  }

  // 2. 질환이 선택되지 않은 경우: 해당 병원의 모든 불가능 질환 수집
  else if (!diseaseNum && severeAcceptanceMap && hpid) {
    const hospitalDiseases: DiseaseInfo[] = [];

    // 모든 27개 질환에 대해 확인
    for (let qn = 1; qn <= 27; qn++) {
      const mapKey = `${hpid}_${qn}`;

      // Map을 순회하며 해당 병원과 질환의 데이터 찾기
      for (const [key, value] of severeAcceptanceMap) {
        if (key === mapKey && value.status === 'N') {
          const pattern = DISEASE_DISPLAY_PATTERNS[qn];
          if (pattern) {
            hospitalDiseases.push({
              qn,
              category: pattern.displayFormat.split(']')[0] + ']',
              subcategory: pattern.displayFormat.split('] ')[1] || '',
              content: value.message || `${pattern.displayFormat} - 수용불가`,
              displayName: pattern.displayFormat
            });
          }
          break;
        }
      }
    }

    if (hospitalDiseases.length > 0) {
      result.allDiseases = hospitalDiseases;
    }
  }

  // 3. diseaseMessage가 있는 경우 (messageField 기반)
  else if (diseaseMessage) {
    result.disease = {
      category: '[중증질환]',
      subcategory: '',
      content: diseaseMessage,
      displayName: '[중증질환] 수용불가'
    };
  }

  return result;
}

/**
 * 메시지 심각도 판별
 * 모든 메시지는 "불가" 상태이므로 정상 운영은 없음
 * - critical (빨간색): 의료진 부족/부재, 신환 수용불가 - 가장 심각
 * - warning (주황색): 일반적인 진료불가, 수용불가 - 일시적 상황
 * - info (파란색): 기타 안내 메시지
 */
export function getMessageSeverity(message: string): 'critical' | 'warning' | 'info' {
  const lowerMessage = message.toLowerCase();

  // Critical: 의료진 문제 (가장 심각 - 인력 부재)
  if (lowerMessage.includes('의료진') && (lowerMessage.includes('부족') || lowerMessage.includes('부재'))) {
    return 'critical';
  }

  // Critical: 신환 수용 완전 불가
  if (lowerMessage.includes('신환') && lowerMessage.includes('불가')) {
    return 'critical';
  }

  // Critical: 완전히 수용 불가능한 상태
  if (lowerMessage.includes('수용') && lowerMessage.includes('불가')) {
    return 'critical';
  }

  // Warning: 일반적인 진료불가, 제한, 지연 상태
  if (lowerMessage.includes('불가') || lowerMessage.includes('제한') || lowerMessage.includes('지연')) {
    return 'warning';
  }

  // Info: 기타 안내 메시지
  return 'info';
}

/**
 * 진료과목 추출
 */
export function extractDepartment(message: string): string {
  // [진료과목] 형식에서 추출
  const match = message.match(/^\[([^\]]+)\]/);
  if (match) {
    return match[1];
  }
  return '기타';
}

// 진료과목별 색상 타입
export type DepartmentColor =
  | 'neuro'      // 신경계 (신경외과, 신경과)
  | 'pediatric'  // 소아 (소아청소년과, 소아외과)
  | 'ortho'      // 정형외과
  | 'cardio'     // 심장/흉부 (심장내과, 흉부외과)
  | 'general'    // 일반외과/내과
  | 'obgyn'      // 산부인과
  | 'emergency'  // 응급의학과
  | 'other';     // 기타

/**
 * 진료과목 색상 분류
 */
export function getDepartmentColor(message: string): DepartmentColor {
  const dept = extractDepartment(message);

  // 신경계
  if (dept.includes('신경')) {
    return 'neuro';
  }

  // 소아
  if (dept.includes('소아') || dept.includes('청소년')) {
    return 'pediatric';
  }

  // 정형외과
  if (dept.includes('정형')) {
    return 'ortho';
  }

  // 심장/흉부
  if (dept.includes('심장') || dept.includes('흉부') || dept.includes('순환기')) {
    return 'cardio';
  }

  // 산부인과
  if (dept.includes('산부') || dept.includes('산과') || dept.includes('부인')) {
    return 'obgyn';
  }

  // 응급의학과
  if (dept.includes('응급')) {
    return 'emergency';
  }

  // 일반 외과/내과
  if (dept.includes('외과') || dept.includes('내과')) {
    return 'general';
  }

  return 'other';
}

/**
 * 진료과목별 Tailwind 클래스 (더 이상 사용하지 않음 - 단색 메시지로 변경)
 */
export function getDepartmentClasses(color: DepartmentColor): {
  bg: string;
  text: string;
  border: string;
} {
  // 모든 메시지는 단색 배경 사용
  return { bg: 'bg-slate-700/50', text: 'text-gray-200', border: 'border-slate-600' };
}

/**
 * 키워드 하이라이트 타입
 */
export type HighlightType = 'department' | 'staff' | 'equipment' | 'disease' | 'unavailable' | 'none';

/**
 * "불가능" 단어 사전
 * - PC에서는 회색으로 연하게 표시
 * - 모바일에서는 "X"로 대체
 * - 앞으로 추가 가능한 형태로 관리
 */
export const UNAVAILABLE_PHRASES = [
  '관련 환자 수용 불가(사전 연락 바랍니다)',
  '관련환자 수용 불가(사전 연락 바랍니다)',
  '사전 연락 바랍니다',
  '수용 및 입원 불가능',
  '환자 수용 불가능',   // 추가: 환자 수용 불가능 (띄어쓰기 포함)
  '환자 수용불가능',    // 추가: 환자 수용불가능 (띄어쓰기 없음)
  '수용불가능',
  '수용 불가능',
  '환자 수용불가',
  '환자 수용 불가',
  '수용불가',
  '수용 불가',
  '진료불가능',
  '진료 불가능',
  '진료불가',
  '진료 불가',
  '불가능',
  '불가',
];

/**
 * 메시지에서 하이라이트할 키워드 패턴
 * - department (파란색): 진료과목 [xxx]
 * - staff (빨간색): 의료진 관련
 * - equipment (초록색): 장비 관련
 * - disease (보라색): 질환명 관련
 */
export interface HighlightedSegment {
  text: string;
  type: HighlightType;
}

/**
 * 메시지를 하이라이트 세그먼트로 분리
 */
export function parseMessageWithHighlights(message: string): HighlightedSegment[] {
  if (!message) return [];

  const segments: HighlightedSegment[] = [];
  let remaining = message;

  // 불가능 패턴을 동적으로 생성 (긴 것부터 매칭하도록 정렬됨)
  const unavailablePattern = UNAVAILABLE_PHRASES
    .map(phrase => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))  // 특수문자 이스케이프
    .join('|');

  // 패턴 정의: 진료과목, 의료진, 장비, 질환명, 불가능
  const patterns = [
    { regex: /\[([^\]]+)\]/g, type: 'department' as HighlightType },  // [진료과목] 대괄호 형태
    // 대괄호 없는 진료과목 (문장 시작 또는 콤마/공백 뒤)
    { regex: /(감염내과|혈액\s*종양내과|영상의학과|비뇨의학과|비뇨기과|신경과|치과|산부인과|산과|부인과|신경외과|피부과|소아청소년과|소아신경과|내분비내과|정형외과|흉부외과|심장내과|호흡기내과|소화기내과|신장내과|류마티스내과|재활의학과|마취통증의학과|응급의학과|이비인후과|안과|정신건강의학과|가정의학과|외과|내과|구강악면외과|대장항문외과|성형외과|비뇨의학과)/g, type: 'department' as HighlightType },
    { regex: /(의료진)/g, type: 'staff' as HighlightType },           // 의료진
    { regex: /(장비|기기|기계|CT|MRI|X-ray|초음파|내시경|인공호흡기|호흡기|ECMO|투석|혈액투석|산소|모니터|sono)/gi, type: 'equipment' as HighlightType }, // 장비 관련
    { regex: /(뇌출혈|뇌경색|심근경색|대동맥|중환자실|골절|출혈|경색|수술|acute\s*stroke|acute\s*storke|stroke|storke|급성|중증|패혈증|쇼크|외상|화상|간질환|담낭|담도|폐색|장중첩|장충첩증|정복술|복부손상|사지접합|저체중출생아|중증외상|epilepsy|seizure|spine|두경부|심경부감염|급성후두개염|상기도\s*폐쇄|목통증|후두개염|식도\s*응급질환|식도|척추|경련|소아응급|산모|객혈|BAE|의식저하|약물중독|자해)/gi, type: 'disease' as HighlightType }, // 질환명 관련
    { regex: new RegExp(`(${unavailablePattern})`, 'gi'), type: 'unavailable' as HighlightType },  // 불가능 관련
  ];

  // 모든 매치를 찾아서 위치와 함께 저장
  interface Match {
    start: number;
    end: number;
    text: string;
    type: HighlightType;
  }

  const allMatches: Match[] = [];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regex.source, 'gi');
    let match;
    while ((match = regex.exec(message)) !== null) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        type: pattern.type
      });
    }
  }

  // 위치순 정렬
  allMatches.sort((a, b) => a.start - b.start);

  // 겹치는 매치 제거 (먼저 나온 것 우선)
  const filteredMatches: Match[] = [];
  let lastEnd = 0;
  for (const match of allMatches) {
    if (match.start >= lastEnd) {
      filteredMatches.push(match);
      lastEnd = match.end;
    }
  }

  // 세그먼트 생성
  let currentIndex = 0;
  for (const match of filteredMatches) {
    // 매치 전 일반 텍스트
    if (match.start > currentIndex) {
      segments.push({
        text: message.substring(currentIndex, match.start),
        type: 'none'
      });
    }
    // 매치된 텍스트
    segments.push({
      text: match.text,
      type: match.type
    });
    currentIndex = match.end;
  }

  // 남은 텍스트
  if (currentIndex < message.length) {
    segments.push({
      text: message.substring(currentIndex),
      type: 'none'
    });
  }

  return segments;
}

/**
 * 하이라이트 타입별 CSS 클래스
 */
export function getHighlightClass(type: HighlightType): string {
  switch (type) {
    case 'department':  // 진료과목 - 파란색
      return 'text-blue-400 font-semibold';
    case 'staff':       // 의료진 - 빨간색
      return 'text-red-400 font-semibold';
    case 'equipment':   // 장비 - 초록색
      return 'text-green-400 font-semibold';
    case 'disease':     // 질환명 - 보라색
      return 'text-purple-400 font-semibold';
    case 'unavailable': // 불가능 문구 - 회색 (연하게)
      return 'text-gray-400 opacity-70';
    default:
      return '';
  }
}

/**
 * 불가능 문구를 "X"로 대체 (모바일용)
 * @param message 원본 메시지
 * @returns X로 대체된 메시지
 */
export function replaceUnavailableWithX(message: string): string {
  if (!message) return '';

  let result = message;

  // 긴 것부터 매칭하도록 정렬된 UNAVAILABLE_PHRASES 순서대로 처리
  for (const phrase of UNAVAILABLE_PHRASES) {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, 'X');
  }

  // 연속된 X를 하나로 통합
  result = result.replace(/X\s*X+/g, 'X');

  return result;
}

/**
 * 메시지 유형 판별 (응급실 vs 중증질환)
 */
export function getMessageType(symTypCod: string): 'emergency' | 'disease' {
  if (!symTypCod || symTypCod === '' || symTypCod === 'ER') {
    return 'emergency';
  }
  return 'disease';
}

/**
 * 메시지에서 키워드 추출
 */
export function extractKeywords(message: string): string[] {
  const keywords: string[] = [];

  const patterns = [
    { regex: /의료진\s*부(?:족|재)/, keyword: '의료진부족' },
    { regex: /신환\s*수용\s*불가/, keyword: '신환수용불가' },
    { regex: /진료\s*불가/, keyword: '진료불가' },
    { regex: /정상\s*운영/, keyword: '정상운영' },
    { regex: /수술\s*(?:중|진행)/, keyword: '수술중' },
    { regex: /(?:환자|병상)\s*(?:포화|만원)/, keyword: '병상포화' },
    { regex: /대기\s*(?:시간|환자)\s*(?:많|다수)/, keyword: '대기시간증가' }
  ];

  for (const { regex, keyword } of patterns) {
    if (regex.test(message)) {
      keywords.push(keyword);
    }
  }

  return keywords;
}

/**
 * 메시지 요약 생성
 */
export function summarizeMessage(message: string, maxLength: number = 50): string {
  if (!message) return '';
  if (message.length <= maxLength) return message;

  return message.substring(0, maxLength - 3) + '...';
}

/**
 * 심각도별 Tailwind 클래스
 * - critical (빨간색): 의료진 부족/부재, 수용불가 - 가장 심각
 * - warning (주황색): 일반 진료불가 - 일시적 상황
 * - info (파란색): 기타 안내
 */
export function getSeverityClasses(severity: ReturnType<typeof getMessageSeverity>): {
  bg: string;
  text: string;
  border: string;
} {
  switch (severity) {
    case 'critical':
      return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' };
    case 'warning':
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40' };
    case 'info':
    default:
      return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40' };
  }
}
