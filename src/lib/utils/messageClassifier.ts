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
export type HighlightType = 'department' | 'staff' | 'equipment' | 'disease' | 'unavailable' | 'guidance' | 'none';

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

const UNAVAILABLE_REPLACE_PATTERNS: RegExp[] = [
  /수용\s*및\s*입원\s*불가능/gi,
  /환자\s*수용\s*불가능/gi,
  /환자\s*수용\s*불가/gi,
  /수용\s*불가능/gi,
  /수용\s*불가/gi,
  /진료\s*불가능/gi,
  /진료\s*불가/gi,
  /불가능/gi,
  /불가/gi
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

export function decodeHtmlEntities(message: string): string {
  if (!message) return '';
  return message
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

const CONTACT_WORD_BOUNDARY = '(?:^|[\\s_\\-.,(/])(?:문의|연락|협의|상의|전화|유선|핫라인)(?=$|[\\s_\\-.,)/])';
const CONTACT_TOOLTIP_REGEX = new RegExp(`(사전\\s*문의|사전\\s*연락|수용\\s*여부\\s*확인|수용여부|수용\\s*전\\s*(?:문의|연락|확인|협의|상의)|이송\\s*(?:전|시)\\s*(?:문의|연락|확인|협의|상의)|전원\\s*전\\s*(?:문의|연락|확인|협의|상의)|내원\\s*전\\s*(?:문의|연락|확인|협의|상의)|확인\\s*(?:부탁|바람|필요|요청|요망)|${CONTACT_WORD_BOUNDARY})`, 'gi');
const NOTICE_TOOLTIP_REGEX = /(참고바람|참고|유의|주의|권고)/gi;
const UNAVAILABLE_EXCEPTION_PATTERNS: RegExp[] = [
  /불가능메시지등록/gi,
  /불가능메세지등록/gi,
  /불가능메시지/gi,
  /불가능메세지/gi
];

function protectUnavailableExceptions(message: string): { text: string; restore: (input: string) => string } {
  let index = 0;
  const tokens: string[] = [];

  const text = UNAVAILABLE_EXCEPTION_PATTERNS.reduce((acc, pattern) => {
    return acc.replace(pattern, (match) => {
      const token = `__UNAVAILABLE_EXCEPTION_${index}__`;
      tokens.push(match);
      index += 1;
      return token;
    });
  }, message);

  const restore = (input: string) => {
    let output = input;
    tokens.forEach((value, idx) => {
      output = output.replaceAll(`__UNAVAILABLE_EXCEPTION_${idx}__`, value);
    });
    return output;
  };

  return { text, restore };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSegments(message: string, patterns: Array<{ regex: RegExp; type: HighlightType }>): HighlightedSegment[] {
  if (!message) return [];

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

  allMatches.sort((a, b) => a.start - b.start);

  const filteredMatches: Match[] = [];
  let lastEnd = 0;
  for (const match of allMatches) {
    if (match.start >= lastEnd) {
      filteredMatches.push(match);
      lastEnd = match.end;
    }
  }

  const segments: HighlightedSegment[] = [];
  let currentIndex = 0;
  for (const match of filteredMatches) {
    if (match.start > currentIndex) {
      segments.push({
        text: message.substring(currentIndex, match.start),
        type: 'none'
      });
    }
    segments.push({
      text: match.text,
      type: match.type
    });
    currentIndex = match.end;
  }

  if (currentIndex < message.length) {
    segments.push({
      text: message.substring(currentIndex),
      type: 'none'
    });
  }

  return segments;
}

/**
 * 메시지를 하이라이트 세그먼트로 분리
 */
export function parseMessageWithHighlights(message: string): HighlightedSegment[] {
  if (!message) return [];

  const decodedMessage = decodeHtmlEntities(message);
  const { text: protectedMessage, restore } = protectUnavailableExceptions(decodedMessage);

  // 불가능 패턴을 동적으로 생성 (긴 것부터 매칭하도록 정렬됨)
  const unavailablePattern = UNAVAILABLE_PHRASES
    .map(phrase => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))  // 특수문자 이스케이프
    .join('|');

  // 패턴 정의: 진료과목, 의료진, 장비, 질환명, 불가능
  const patterns = [
    { regex: /\[([^\]]+)\]/g, type: 'department' as HighlightType },  // [진료과목] 대괄호 형태
    // 대괄호 없는 진료과목 (문장 시작 또는 콤마/공백 뒤)
    { regex: /(감염내과|혈액\s*종양내과|영상의학과|비뇨의학과|비뇨기과|신경과|치과|산부인과|산과|부인과|신경외과|피부과|소아청소년과|소아신경과|내분비내과|정형외과|흉부외과|심장내과|호흡기내과|소화기내과|신장내과|류마티스내과|재활의학과|마취통증의학과|응급의학과|이비인후과|안과|정신건강의학과|가정의학과|외과|내과|구강악면외과|대장항문외과|성형외과|비뇨의학과)/g, type: 'department' as HighlightType },
    { regex: /(의료진|교수님?|교수진|인력|전문의)/g, type: 'staff' as HighlightType },           // 의료진/인력
    { regex: /(장비|기기|기계|CT|MRI|X-ray|초음파|내시경|인공호흡기|호흡기|ECMO|투석|혈액투석|산소|모니터|sono)/gi, type: 'equipment' as HighlightType }, // 장비 관련
    { regex: /(뇌출혈|뇌경색|심근경색|대동맥|중환자실|골절|출혈|경색|수술|acute\s*stroke|acute\s*storke|stroke|storke|급성|중증|패혈증|쇼크|외상|화상|간질환|담낭|담도|폐색|장중첩|장충첩증|정복술|복부손상|사지접합|저체중출생아|중증외상|epilepsy|seizure|spine|두경부|심경부감염|급성후두개염|상기도\s*폐쇄|목통증|후두개염|식도\s*응급질환|식도|척추|경련|소아응급|산모|객혈|BAE|의식저하|약물중독|자해|DI\s*환자|Appendicitis|열상환자|단순봉합|안면\s*열상|안면\s*골절|안와\s*골절|자살\s*사고|자살\s*중독|자살환자|담관\s*질환|안구\s*적출|간이식수술|간\s*이식|간이식|간\\(Liver\\)|가스중독|조영술|발열|뇌척수|토혈|객혈|궤사성|췌장염|심부전|신부전|관상동맥|소아경련|이물질흡인|이물\s*흡인|소아내시경|소아위장관|요로감염|신우신염|폐렴|봉와직염|intubation|심부열상|개방성\s*골절|BOF)/gi, type: 'disease' as HighlightType }, // 질환명 관련
    { regex: new RegExp(`(${unavailablePattern})`, 'gi'), type: 'unavailable' as HighlightType },  // 불가능 관련
    { regex: /(이송\s*전\s*확인|참고바람|참고)/gi, type: 'guidance' as HighlightType },  // 안내/확인 통일 문구
  ];

  const built = buildSegments(protectedMessage, patterns);
  return built.map((segment) => ({
    ...segment,
    text: restore(segment.text)
  }));
}

/**
 * 툴팁용 메시지 하이라이트 (연락/확인/참고/불가 위주)
 */
export function parseMessageWithTooltipHighlights(message: string): HighlightedSegment[] {
  if (!message) return [];

  const decodedMessage = decodeHtmlEntities(message);
  const { text: protectedMessage, restore } = protectUnavailableExceptions(decodedMessage);

  const unavailablePattern = UNAVAILABLE_PHRASES
    .map(phrase => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  const patterns = [
    { regex: CONTACT_TOOLTIP_REGEX, type: 'guidance' as HighlightType },
    { regex: NOTICE_TOOLTIP_REGEX, type: 'guidance' as HighlightType },
    { regex: new RegExp(`(${unavailablePattern})`, 'gi'), type: 'unavailable' as HighlightType }
  ];

  const built = buildSegments(protectedMessage, patterns);
  return built.map((segment) => ({
    ...segment,
    text: restore(segment.text)
  }));
}

/**
 * 툴팁용 하이라이트된 HTML
 */
export function renderTooltipMessage(message: string, isDark: boolean): string {
  const segments = parseMessageWithTooltipHighlights(decodeHtmlEntities(message));
  return segments.map(seg => {
    const text = escapeHtml(seg.text);
    if (seg.type === 'none') {
      return text;
    }
    const color = getHighlightColor(seg.type, isDark);
    const fontWeight = seg.type !== 'unavailable' && seg.type !== 'guidance' ? 'font-weight:600;' : 'opacity:0.8;';
    return `<span style="color:${color};${fontWeight}">${text}</span>`;
  }).join('');
}

/**
 * 하이라이트 타입별 CSS 클래스 (다크모드 기본)
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
    case 'guidance':    // 안내 문구 - 회색
      return 'text-gray-400 opacity-80';
    default:
      return '';
  }
}

/**
 * 하이라이트 타입별 CSS 클래스 (라이트/다크모드 지원)
 */
export function getHighlightClassWithTheme(type: HighlightType, isDark: boolean): string {
  if (isDark) {
    return getHighlightClass(type);
  }

  // 라이트모드
  switch (type) {
    case 'department':  // 진료과목 - 파란색
      return 'text-blue-600 font-semibold';
    case 'staff':       // 의료진 - 빨간색
      return 'text-red-600 font-semibold';
    case 'equipment':   // 장비 - 초록색
      return 'text-green-600 font-semibold';
    case 'disease':     // 질환명 - 보라색
      return 'text-purple-600 font-semibold';
    case 'unavailable': // 불가능 문구 - 회색 (연하게)
      return 'text-gray-500 opacity-70';
    case 'guidance':    // 안내 문구 - 회색
      return 'text-gray-500 opacity-80';
    default:
      return '';
  }
}

/**
 * 하이라이트 타입별 인라인 스타일 색상 (팝업용)
 */
export function getHighlightColor(type: HighlightType, isDark: boolean): string {
  if (isDark) {
    switch (type) {
      case 'department': return '#60a5fa';  // blue-400
      case 'staff': return '#f87171';       // red-400
      case 'equipment': return '#4ade80';   // green-400
      case 'disease': return '#c084fc';     // purple-400
      case 'unavailable': return '#9ca3af'; // gray-400
      case 'guidance': return '#9ca3af';    // gray-400
      default: return 'inherit';
    }
  } else {
    switch (type) {
      case 'department': return '#2563eb';  // blue-600
      case 'staff': return '#dc2626';       // red-600
      case 'equipment': return '#16a34a';   // green-600
      case 'disease': return '#9333ea';     // purple-600
      case 'unavailable': return '#6b7280'; // gray-500
      case 'guidance': return '#6b7280';    // gray-500
      default: return 'inherit';
    }
  }
}

/**
 * 메시지를 하이라이트된 HTML로 변환 (팝업용)
 */
export function renderHighlightedMessage(message: string, isDark: boolean): string {
  const segments = parseMessageWithHighlights(message);
  return segments.map(seg => {
    if (seg.type === 'none') {
      return seg.text;
    }
    const color = getHighlightColor(seg.type, isDark);
    const fontWeight = seg.type !== 'unavailable' ? 'font-weight:600;' : 'opacity:0.7;';
    return `<span style="color:${color};${fontWeight}">${seg.text}</span>`;
  }).join('');
}

/**
 * 불가능 문구를 "X"로 대체 (모바일용)
 * @param message 원본 메시지
 * @returns X로 대체된 메시지
 */
export function replaceUnavailableWithX(message: string): string {
  if (!message) return '';

  const { text, restore } = protectUnavailableExceptions(message);
  let result = text;

  // 긴 것부터 매칭하도록 정렬된 UNAVAILABLE_PHRASES 순서대로 처리
  for (const phrase of UNAVAILABLE_PHRASES) {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, 'X');
  }

  // 연속된 X를 하나로 통합
  result = result.replace(/X\s*X+/g, 'X');

  return restore(result);
}

const CONTACT_KEYWORD_REGEX = new RegExp(`(사전\\s*문의|사전\\s*연락|수용\\s*여부\\s*확인|수용여부|수용\\s*전\\s*(?:문의|연락|확인|협의|상의)|이송\\s*(?:전|시)\\s*(?:문의|연락|확인|협의|상의)|전원\\s*전\\s*(?:문의|연락|확인|협의|상의)|내원\\s*전\\s*(?:문의|연락|확인|협의|상의)|확인\\s*(?:부탁|바람|필요|요청|요망)|${CONTACT_WORD_BOUNDARY})`, 'i');
const NOTICE_KEYWORD_REGEX = /(참고바람|참고|유의|주의|권고)/i;
const DEPARTMENT_HINT_REGEX = /(\[[^\]]+\]|감염내과|혈액\s*종양내과|영상의학과|비뇨의학과|비뇨기과|신경과|치과|산부인과|산과|부인과|신경외과|피부과|소아청소년과|소아신경과|내분비내과|정형외과|흉부외과|심장내과|호흡기내과|소화기내과|신장내과|류마티스내과|재활의학과|마취통증의학과|응급의학과|이비인후과|안과|정신건강의학과|가정의학과|외과|내과|구강악면외과|대장항문외과|성형외과)/i;
const CONDITION_HINT_REGEX = /(정규시간|시간\s*외|시간외|야간|주말|공휴일|평일|주중|당직|교수|병실|병상|중환자실|마취|수술|검사|전문의|가용|지원|부재|부족|제한|부분\s*수용|수용\s*가능|진료\s*불가|수용\s*불가|불가|가능|대상|환자|외상|이외|이외환자|\d{1,2}:\d{2}|\d{1,2}시)/i;

const CONTACT_REPLACE_PATTERNS: RegExp[] = [
  /문의\s*후\s*이송/gi,
  /확인\s*후\s*이송/gi,
  /이송\s*(?:전|시)\s*(?:문의|연락|확인|협의|상의)/gi,
  /전원\s*전\s*(?:문의|연락|확인|협의|상의)/gi,
  /내원\s*전\s*(?:문의|연락|확인|협의|상의)/gi,
  /수용\s*전\s*(?:문의|연락|확인|협의|상의)/gi,
  /수용\s*여부\s*확인/gi,
  /사전\s*문의\s*바람/gi,
  /사전\s*연락\s*바람/gi,
  /사전\s*문의\s*필요/gi,
  /사전\s*연락\s*필요/gi,
  /사전\s*문의\s*요망/gi,
  /사전\s*연락\s*요망/gi,
  /사전\s*문의/gi,
  /사전\s*연락/gi,
  /문의\s*바람/gi,
  /문의\s*바랍니다/gi,
  /문의\s*필요/gi,
  /문의\s*요망/gi,
  /연락\s*바람/gi,
  /연락\s*바랍니다/gi,
  /연락\s*필요/gi,
  /연락\s*요망/gi,
  /확인\s*부탁/gi,
  /확인\s*바람/gi,
  /확인\s*바랍니다/gi,
  /확인\s*필요/gi,
  /확인\s*요청/gi,
  /확인\s*요망/gi,
  /(?:전화|유선|핫라인)\s*문의/gi,
  /(^|[\s_\-.,(/])문의(?=$|[\s_\-.,)])/gi,
  /(^|[\s_\-.,(/])연락(?=$|[\s_\-.,)])/gi,
  /(^|[\s_\-.,(/])협의(?=$|[\s_\-.,)])/gi,
  /(^|[\s_\-.,(/])상의(?=$|[\s_\-.,)])/gi,
  /(^|[\s_\-.,(/])전화(?=$|[\s_\-.,)])/gi,
  /(^|[\s_\-.,(/])유선(?=$|[\s_\-.,)])/gi,
  /(^|[\s_\-.,(/])핫라인(?=$|[\s_\-.,)])/gi
];

const NOTICE_REPLACE_PATTERNS: RegExp[] = [
  /참고\s*바랍니다/gi,
  /참고\s*바람/gi,
  /참고(?:해)?\s*(?:주(?:시)?(?:기|길)?\s*)?(?:바랍니다|바람|해주십시오|해주세요|요망합니다|요청드립니다|부탁드립니다)?/gi,
  /유의\s*바랍니다/gi,
  /유의/gi,
  /주의\s*바랍니다/gi,
  /주의/gi,
  /권고/gi
];

const NOTICE_TARGET = '참고바람';
const EQUIPMENT_KEYWORDS = '(CT|MRI|X-?ray|초음파|내시경|인공호흡기|ECMO|투석|혈액투석|산소|모니터)';
const GENDER_KEYWORDS = '(남자|여자|남성|여성)';
const POLITE_TAIL = '(?:드립니다|합니다|해요|해드립니다|부탁드립니다|요청드립니다|바랍니다|바람|요망합니다|해주세요|해주십시오)';

function collapseIfStandalone(result: string, target: string): string {
  const stripped = result.replace(/[.,!?*()［］\[\]<>~"'\s]/g, '');
  const targetStripped = target.replace(/\s/g, '');
  if (stripped === '' || stripped === targetStripped) {
    return target;
  }
  return result;
}

function simplifyExpressions(message: string): string {
  const { text, restore } = protectUnavailableExceptions(message);
  let result = text;

  result = result.replace(/\s+/g, ' ').trim();
  result = result.replace(/정규\s*시간/gi, '정규시간');
  result = result.replace(/수용\s*가능/gi, '수용가능');
  result = result.replace(/수용\s*불가/gi, '수용불가');

  const unavailableTemplate = new RegExp(`불가능\\s*(?:하(?:니|오니|다|요)?|함|합(?:니다|니까)|했(?:음)?)?`, 'gi');
  result = result.replace(unavailableTemplate, '불가');

  const availabilityTemplate = new RegExp(`정규시간\\s*에만\\s*수용가능(?:\\s*${POLITE_TAIL})?`, 'gi');
  result = result.replace(availabilityTemplate, '정규시간에만 수용가능');

  const equipmentTemplate = new RegExp(`${EQUIPMENT_KEYWORDS}\\s*(?:가|이)?\\s*고장(?:났|남|됨)?(?:습니다|임|입니다|해요)?`, 'gi');
  result = result.replace(equipmentTemplate, '$1 고장');

  const genderRoomTemplate = new RegExp(`${GENDER_KEYWORDS}\\s*병실\\s*(?:이|가)?\\s*없(?:습니다|음|어요|임)?`, 'gi');
  result = result.replace(genderRoomTemplate, '$1 병실 없음');

  const roomTemplate = /(?:병실|병상)\s*(?:이|가)?\s*없(?:습니다|음|어요|임)?/gi;
  result = result.replace(roomTemplate, (match) => (match.includes('병상') ? '병상 없음' : '병실 없음'));

  const noticeTemplate = new RegExp(`참고(?:해)?\\s*(?:주(?:시)?(?:기|길)?\\s*)?(?:${POLITE_TAIL})?`, 'gi');
  result = result.replace(noticeTemplate, NOTICE_TARGET);

  const degradeNoticeTemplate = /(?:유의|주의|권고)(?:\s*(?:해)?(?:주(?:시)?(?:기|길)?\s*)?(?:바랍니다|바람|해주십시오|해주세요|요망합니다|요청드립니다|부탁드립니다)?)?/gi;
  result = result.replace(degradeNoticeTemplate, NOTICE_TARGET);

  result = result.replace(/불가\s*(?:이므로|이니|하니|하오니)?\s*(?:참고바람|참고|양해바람|양해|부탁|부탁드립니다)?/gi, '불가');
  result = result.replace(/\s+/g, ' ').trim();

  return restore(result);
}

function normalizeUnavailablePhrases(message: string): string {
  const { text, restore } = protectUnavailableExceptions(message);
  let result = text;
  for (const pattern of UNAVAILABLE_REPLACE_PATTERNS) {
    result = result.replace(pattern, '불가');
  }
  result = result.replace(/불가\s*불가+/g, '불가');
  result = collapseIfStandalone(result.trim(), '불가');
  return restore(result);
}

/**
 * 연락/확인 안내 문구를 간단한 표현으로 정규화
 * - 연락/확인 요청 → "이송 전 확인"
 * - 참고/주의 안내 → "참고"
 */
export function normalizeMessageForDisplay(message: string): string {
  if (!message) return '';

  let result = simplifyExpressions(decodeHtmlEntities(message.trim()));
  const hasContact = CONTACT_KEYWORD_REGEX.test(result);
  const hasNotice = NOTICE_KEYWORD_REGEX.test(result);

  if (hasContact) {
    const shouldCollapse = !CONDITION_HINT_REGEX.test(result) && !DEPARTMENT_HINT_REGEX.test(result);
    if (shouldCollapse) {
      return '이송 전 확인';
    }

    for (const pattern of CONTACT_REPLACE_PATTERNS) {
      result = result.replace(pattern, (match, leading) => {
        if (typeof leading === 'string') {
          return `${leading}이송 전 확인`;
        }
        return '이송 전 확인';
      });
    }
    result = result.replace(/이송 전 확인\s*(?:후|전)?/g, '이송 전 확인');
    result = normalizeUnavailablePhrases(result);
    return collapseIfStandalone(result.trim(), '이송 전 확인');
  }

  if (hasNotice) {
    for (const pattern of NOTICE_REPLACE_PATTERNS) {
      result = result.replace(pattern, NOTICE_TARGET);
    }
    result = normalizeUnavailablePhrases(result);
    return collapseIfStandalone(result.trim(), NOTICE_TARGET);
  }

  return normalizeUnavailablePhrases(result);
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
