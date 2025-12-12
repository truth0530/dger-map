/**
 * 메시지 분류 및 파싱 유틸리티
 * 원본: dger-api/public/js/messageClassifier.js
 */

import { SEVERE_TYPES } from '@/lib/constants/dger';

// 증상 코드 → 질환 번호 매핑
const SYMPTOM_CODE_TO_DISEASE_MAP: Record<string, string> = {
  'S001': '1', 'S002': '2', 'S003': '3', 'S004': '4', 'S005': '5',
  'S006': '6', 'S007': '7', 'S008': '8', 'S009': '9', 'S010': '10',
  'S011': '11', 'S012': '12', 'S013': '13', 'S014': '14', 'S015': '15',
  'S016': '16', 'S017': '17', 'S018': '18', 'S019': '19', 'S020': '20',
  'S021': '21', 'S022': '22', 'S023': '23', 'S024': '24', 'S025': '25',
  'S026': '26', 'S027': '27',
};

export interface MessageStatus {
  label: string;
  color: 'red' | 'orange' | 'green' | 'gray';
}

export interface ParsedMessage {
  department: string;
  status: MessageStatus;
  details: string;
  diseaseLabel: string;
}

export interface ClassifiedMessages {
  emergency: Array<{ msg: string; symTypCod: string }>;
  disease: { displayName: string; content: string } | null;
  allDiseases: Array<{ displayName: string; content: string }>;
}

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
export function getDiseaseLabel(qn: string): string {
  const found = SEVERE_TYPES.find((t) => t.key === `MKioskTy${qn}`);
  if (found) {
    // [카테고리] 세부명 형식에서 카테고리만 추출
    const match = found.label.match(/\[([^\]]+)\]/);
    return match ? match[1] : found.label;
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

  // 질환 라벨 추출
  let diseaseLabel = '';
  if (symTypCod) {
    const diseaseNum = SYMPTOM_CODE_TO_DISEASE_MAP[symTypCod];
    if (diseaseNum) {
      diseaseLabel = getDiseaseLabel(diseaseNum);
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
      status: status,
      details: details || rest,
      diseaseLabel: diseaseLabel
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
      status: status,
      details: details || message,
      diseaseLabel: diseaseLabel
    };
  }

  // 매칭 실패 시 원본 메시지
  return {
    department: '응급실',
    status: { label: '기타', color: 'gray' },
    details: message,
    diseaseLabel: diseaseLabel
  };
}

/**
 * 상태 색상별 Tailwind 클래스
 */
export function getStatusColorClasses(color: MessageStatus['color']): {
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
