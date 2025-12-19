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
 */
export function getMessageSeverity(message: string): 'critical' | 'warning' | 'info' | 'normal' {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('의료진') && (lowerMessage.includes('부족') || lowerMessage.includes('부재'))) {
    return 'critical';
  }
  if (lowerMessage.includes('신환') && lowerMessage.includes('불가')) {
    return 'critical';
  }
  if (lowerMessage.includes('불가')) {
    return 'warning';
  }
  if (lowerMessage.includes('제한') || lowerMessage.includes('지연')) {
    return 'warning';
  }
  if (lowerMessage.includes('정상')) {
    return 'normal';
  }

  return 'info';
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
      return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40' };
    case 'normal':
      return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40' };
    default:
      return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40' };
  }
}
