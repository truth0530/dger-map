'use client';

/**
 * 응급 메시지 페이지
 * 원본: dger-api/public/systommsg2.html
 *
 * dger-api와 동일한 구조, Next.js에 맞게 변환
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from '@/lib/contexts/ThemeContext';
import { parseMessageWithHighlights, getHighlightClass, HighlightType, normalizeMessageForDisplay } from '@/lib/utils/messageClassifier';
import MessageTooltip from '@/components/ui/MessageTooltip';
import { OccupancyBattery, OrgTypeBadge } from '@/components/ui/OccupancyBattery';
import { calculateOccupancyRate, calculateTotalOccupancy } from '@/lib/utils/bedOccupancy';
import { detectRegionFromLocation, getStoredRegion, isRegionLocked, setRegionLocked, setStoredRegion } from '@/lib/utils/locationRegion';
import { mapSidoName, mapSidoShort } from '@/lib/utils/regionMapping';

// 질환 패턴 정의 (dger-api/public/js/diseasePatterns.js와 동일)
const SYMPTOM_CODE_TO_DISEASE_MAP: Record<string, number> = {
  'Y0010': 1,  'Y0020': 2,  'Y0031': 3,  'Y0032': 4,
  'Y0041': 5,  'Y0042': 6,  'Y0051': 7,  'Y0052': 8,
  'Y0060': 9,  'Y0070': 10, 'Y0081': 11, 'Y0082': 12,
  'Y0091': 13, 'Y0092': 14, 'Y0100': 15, 'Y0111': 16,
  'Y0112': 17, 'Y0113': 18, 'Y0120': 19, 'Y0131': 20,
  'Y0132': 21, 'Y0141': 22, 'Y0142': 23, 'Y0150': 24,
  'Y0160': 25, 'Y0171': 26, 'Y0172': 27
};

const DISEASE_DISPLAY_PATTERNS: Record<number, { original: string; displayFormat: string; category: string }> = {
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

// 질환 필터 옵션
const SEVERE_TYPE_OPTIONS = [
  { value: '', label: '27개중증질환 선택' },
  { value: '[재관류중재술] 심근경색', label: '[재관류중재술] 심근경색' },
  { value: '[재관류중재술] 뇌경색', label: '[재관류중재술] 뇌경색' },
  { value: '[뇌출혈수술] 거미막하출혈', label: '[뇌출혈수술] 거미막하출혈' },
  { value: '[뇌출혈수술] 거미막하출혈 외', label: '[뇌출혈수술] 거미막하출혈 외' },
  { value: '[대동맥응급] 흉부', label: '[대동맥응급] 흉부' },
  { value: '[대동맥응급] 복부', label: '[대동맥응급] 복부' },
  { value: '[담낭담관질환] 담낭질환', label: '[담낭담관질환] 담낭질환' },
  { value: '[담낭담관질환] 담도포함질환', label: '[담낭담관질환] 담도포함질환' },
  { value: '[복부응급수술] 비외상', label: '[복부응급수술] 비외상' },
  { value: '[장중첩/폐색] 영유아', label: '[장중첩/폐색] 영유아' },
  { value: '[사지접합] 수족지접합', label: '[사지접합] 수족지접합' },
  { value: '[사지접합] 수족지접합 외', label: '[사지접합] 수족지접합 외' },
  { value: '[응급내시경] 성인 위장관', label: '[응급내시경] 성인 위장관' },
  { value: '[응급내시경] 영유아 위장관', label: '[응급내시경] 영유아 위장관' },
  { value: '[응급내시경] 성인 기관지', label: '[응급내시경] 성인 기관지' },
  { value: '[응급내시경] 영유아 기관지', label: '[응급내시경] 영유아 기관지' },
  { value: '[산부인과응급] 분만', label: '[산부인과응급] 분만' },
  { value: '[산부인과응급] 산과수술', label: '[산부인과응급] 산과수술' },
  { value: '[산부인과응급] 부인과수술', label: '[산부인과응급] 부인과수술' },
  { value: '[저체중출생아] 집중치료', label: '[저체중출생아] 집중치료' },
  { value: '[응급투석] HD', label: '[응급투석] HD' },
  { value: '[응급투석] CRRT', label: '[응급투석] CRRT' },
  { value: '[영상의학혈관중재] 성인', label: '[영상의학혈관중재] 성인' },
  { value: '[영상의학혈관중재] 영유아', label: '[영상의학혈관중재] 영유아' },
  { value: '[정신과적응급] 폐쇄병동입원', label: '[정신과적응급] 폐쇄병동입원' },
  { value: '[중증화상] 전문치료', label: '[중증화상] 전문치료' },
  { value: '[안과적수술] 응급', label: '[안과적수술] 응급' }
];

const REGION_OPTIONS = [
  '대구', '서울', '부산', '광주', '대전', '울산', '세종', '경기',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'
];

// 기관분류 필터 옵션 (축약형)
const ORG_TYPE_OPTIONS = [
  { value: '권역', label: '권역', shortLabel: '권' },
  { value: '센터', label: '센터', shortLabel: '센' },
  { value: '기관', label: '기관', shortLabel: '기' }
];

// 메시지 인터페이스
interface MessageItem {
  msgGubun: string;
  symBpmgGubun: string;
  msg: string;
  symBlkSttDtm: string;
  symBlkEndDtm: string;
  standardizedSymptom?: string;
  isDisease?: boolean;
  diseasePattern?: { displayFormat: string };
}

interface Hospital {
  id: string;
  name: string;
  tel: string;
  hpbd?: string;
  // 포화도 계산용 필드
  hvec?: number;  // 응급실 가용 병상
  hvs01?: number; // 일반입원실 가용
  hv27?: number;  // 코호트 가용
  hv29?: number;  // 음압격리(성인)
  hv13?: number;  // 음압격리(소아)
  hv30?: number;  // 일반격리(성인)
  hv14?: number;  // 일반격리(소아)
  hv28?: number;  // 소아
  hv15?: number;  // 소아음압
  hv16?: number;  // 소아일반
  // 총병상
  hvs02?: number; // 일반입원실 총
  hvs59?: number; // 코호트 총
  hvs03?: number; // 음압격리(성인) 총
  hvs46?: number; // 음압격리(소아) 총
  hvs04?: number; // 일반격리(성인) 총
  hvs47?: number; // 일반격리(소아) 총
  hvs48?: number; // 소아음압 총
  hvs49?: number; // 소아일반 총
}

interface HospitalWithMessages extends Hospital {
  messages: MessageItem[];
}

// 유틸리티 함수
const normalizeKey = (value: string) => (value || '').replace(/\s+/g, '').toLowerCase();

// 병원 유형 축약
const getShortOrgType = (type: string): string => {
  if (type.includes('권역') || type.includes('전문')) return '권역';
  if (type.includes('지역응급의료센터')) return '센터';
  if (type.includes('지역응급의료기관')) return '기관';
  return '기관';
};

// 메시지 추출 함수
const extractMsgContentFromXml = (itemXml: string): string => {
  const possibleMsgTags = ['symBlkMsg', 'msg', 'hviMsg', 'dissMsg', 'symOutDspMsg'];
  for (const tag of possibleMsgTags) {
    const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
    const match = itemXml.match(regex);
    if (match && match[1]?.trim()) {
      return match[1].trim();
    }
  }
  return '';
};

// 날짜 포맷팅 (컴팩트 버전)
const formatPeriod = (startStr: string, endStr: string): string => {
  if (!startStr || startStr.length < 14) return '-';

  const startMonth = startStr.substring(4, 6);
  const startDay = startStr.substring(6, 8);
  const startHour = startStr.substring(8, 10);
  const startMin = startStr.substring(10, 12);

  if (!endStr || endStr.length < 14) {
    return `${startMonth}/${startDay} ${startHour}:${startMin}`;
  }

  const endMonth = endStr.substring(4, 6);
  const endDay = endStr.substring(6, 8);
  const endHour = endStr.substring(8, 10);
  const endMin = endStr.substring(10, 12);

  // 같은 월이면 종료일만 일/시간 표시
  if (startMonth === endMonth) {
    return `${startMonth}/${startDay} ${startHour}:${startMin}~${endDay} ${endHour}:${endMin}`;
  }
  return `${startMonth}/${startDay}~${endMonth}/${endDay}`;
};

const formatDateNoYear = (dateStr: string): string => {
  if (!dateStr || dateStr.length < 14) return '-';
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  const hour = dateStr.substring(8, 10);
  const minute = dateStr.substring(10, 12);
  return `${month}/${day} ${hour}:${minute}`;
};

// 하이라이트 타입별 색상 클래스 (라이트/다크 모드 지원)
const getHighlightColorClass = (type: HighlightType, isDark: boolean): string => {
  switch (type) {
    case 'department':  // 진료과목 - 파란색
      return isDark ? 'text-blue-400 font-semibold' : 'text-blue-600 font-semibold';
    case 'staff':       // 의료진 - 빨간색
      return isDark ? 'text-red-400 font-semibold' : 'text-red-600 font-semibold';
    case 'equipment':   // 장비 - 초록색
      return isDark ? 'text-green-400 font-semibold' : 'text-green-600 font-semibold';
    case 'disease':     // 질환명 - 보라색
      return isDark ? 'text-purple-400 font-semibold' : 'text-purple-600 font-semibold';
    case 'unavailable': // 불가능 문구 - 회색 (연하게)
      return isDark ? 'text-gray-500 opacity-70' : 'text-gray-400 opacity-70';
    case 'guidance':    // 안내 문구 - 회색
      return isDark ? 'text-gray-500 opacity-80' : 'text-gray-400 opacity-80';
    default:
      return '';
  }
};

// 하이라이트된 메시지 렌더링 컴포넌트
// isMobile=true: 불가능 문구를 "X"로 대체
// isMobile=false: 불가능 문구를 회색으로 표시
const HighlightedMessage = ({ message, isDark, isMobile = false }: { message: string; isDark: boolean; isMobile?: boolean }) => {
  // 모바일에서는 불가능 문구를 "X"로 대체
  const normalizedMessage = normalizeMessageForDisplay(message);
  const processedMessage = normalizedMessage;
  const segments = parseMessageWithHighlights(processedMessage);

  return (
    <MessageTooltip message={message} isDark={isDark}>
      <span>
        {segments.map((segment, idx) => (
          <span
            key={idx}
            className={segment.type !== 'none' ? getHighlightColorClass(segment.type, isDark) : ''}
          >
            {segment.text}
          </span>
        ))}
      </span>
    </MessageTooltip>
  );
};

export default function MessagesPage() {
  const { isDark } = useTheme();
  const [selectedRegion, setSelectedRegion] = useState('대구');
  const [selectedOrgTypes, setSelectedOrgTypes] = useState(['권역', '센터', '기관']);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [selectedSevereType, setSelectedSevereType] = useState('');
  const [allMessages, setAllMessages] = useState<HospitalWithMessages[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(true); // 기본: 전체 펼침
  const [isMobile, setIsMobile] = useState(false);
  const [hospitalTypeMap, setHospitalTypeMap] = useState<Record<string, string>>({});
  const [showLocationNotice, setShowLocationNotice] = useState(false);
  const hasUserSelectedRegion = useRef(false);

  // 화면 크기 감지
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let isActive = true;
    const locked = isRegionLocked();
    const storedRegion = getStoredRegion();
    if (locked && storedRegion) {
      const shortRegion = mapSidoShort(storedRegion);
      if (REGION_OPTIONS.includes(shortRegion)) {
        setSelectedRegion(shortRegion);
        return () => {
          isActive = false;
        };
      }
    } else if (locked && !storedRegion) {
      setRegionLocked(false);
    }

    (async () => {
      const region = await detectRegionFromLocation();
      if (!isActive || !region || hasUserSelectedRegion.current) return;
      const shortRegion = mapSidoShort(region);
      if (REGION_OPTIONS.includes(shortRegion)) {
        setSelectedRegion(shortRegion);
        setShowLocationNotice(true);
        window.setTimeout(() => setShowLocationNotice(false), 2000);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  // 병원 타입 매핑 로드
  useEffect(() => {
    const loadHospitalTypeMap = async () => {
      try {
        const res = await fetch('/data/hosp_list.json');
        const data = await res.json();
        const typeMap: Record<string, string> = {};
        data.forEach((row: Record<string, string>) => {
          const keys = Object.keys(row);
          const hpid = row[keys[0]];
          const hpbd = row['HOS_KIND'] || row['__EMPTY_3'] || '';
          if (hpid && hpbd) typeMap[hpid] = hpbd;
        });
        setHospitalTypeMap(typeMap);
      } catch (e) {
        console.warn('병원 유형 매핑 로드 실패:', e);
      }
    };
    loadHospitalTypeMap();
  }, []);

  // 병원 메시지 가져오기
  const fetchMessages = useCallback(async (hpid: string): Promise<MessageItem[]> => {
    const url = `/api/emergency-messages?hpid=${encodeURIComponent(hpid)}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');

    const resultCode = xml.querySelector('resultCode')?.textContent;
    if (resultCode !== '00') return [];

    const items = xml.getElementsByTagName('item');
    const messages: MessageItem[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const symBpmgGubunValue = item.getElementsByTagName('symTypCodMag')[0]?.textContent || '-';
      messages.push({
        msgGubun: item.getElementsByTagName('symBlkMsgTyp')[0]?.textContent || '-',
        symBpmgGubun: symBpmgGubunValue,
        msg: extractMsgContentFromXml(item.outerHTML || new XMLSerializer().serializeToString(item)),
        symBlkSttDtm: item.getElementsByTagName('symBlkSttDtm')[0]?.textContent || '',
        symBlkEndDtm: item.getElementsByTagName('symBlkEndDtm')[0]?.textContent || ''
      });
    }

    return messages;
  }, []);

  // 지역별 병원 목록 가져오기 (bed-info API 사용 - JSON 형식)
  const fetchHospitalsForRegion = useCallback(async (region: string): Promise<Hospital[]> => {
    try {
      // 시도명 매핑
      const regionMap: Record<string, string> = {
        '대구': '대구광역시',
        '서울': '서울특별시',
        '부산': '부산광역시',
        '인천': '인천광역시',
        '광주': '광주광역시',
        '대전': '대전광역시',
        '울산': '울산광역시',
        '세종': '세종특별자치시',
        '경기': '경기도',
        '강원': '강원특별자치도',
        '충북': '충청북도',
        '충남': '충청남도',
        '전북': '전북특별자치도',
        '전남': '전라남도',
        '경북': '경상북도',
        '경남': '경상남도',
        '제주': '제주특별자치도'
      };
      const mappedRegion = regionMap[region] || region;

      const res = await fetch(`/api/bed-info?region=${encodeURIComponent(mappedRegion)}`);
      if (!res.ok) return [];

      // JSON 형식으로 파싱 (API가 JSON 반환)
      const data = await res.json();
      if (!data.success || !data.items) return [];

      const hospitalSet = new Map<string, Hospital>();

      for (const item of data.items) {
        const hpid = item.hpid || '';
        const name = item.dutyName || '';
        const tel = item.dutyTel3 || '';

        if (hpid && name && !hospitalSet.has(hpid)) {
          hospitalSet.set(hpid, {
            id: hpid,
            name,
            tel,
            hpbd: item.hpbd || '',
            // 가용 병상
            hvec: item.hvec || 0,
            hvs01: item.hvs01 || 0,
            hv27: item.hv27 || 0,
            hv29: item.hv29 || 0,
            hv13: item.hv13 || 0,
            hv30: item.hv30 || 0,
            hv14: item.hv14 || 0,
            hv28: item.hv28 || 0,
            hv15: item.hv15 || 0,
            hv16: item.hv16 || 0,
            // 총 병상
            hvs02: item.hvs02 || 0,
            hvs59: item.hvs59 || 0,
            hvs03: item.hvs03 || 0,
            hvs46: item.hvs46 || 0,
            hvs04: item.hvs04 || 0,
            hvs47: item.hvs47 || 0,
            hvs48: item.hvs48 || 0,
            hvs49: item.hvs49 || 0,
          });
        }
      }

      return Array.from(hospitalSet.values());
    } catch (error) {
      console.error('병원 목록 로드 실패:', error);
      return [];
    }
  }, []);

  // 질환 패턴 해석
  const resolveDiseasePattern = useCallback((symText: string, messageText: string) => {
    const normalizedSym = normalizeKey(symText);

    // 숫자만 있는 경우
    if (/^\d+$/.test(normalizedSym)) {
      const num = parseInt(normalizedSym, 10);
      if (DISEASE_DISPLAY_PATTERNS[num]) {
        return DISEASE_DISPLAY_PATTERNS[num];
      }
    }

    // Y코드인 경우
    if (/^y\d{4}$/i.test(normalizedSym)) {
      const mapped = SYMPTOM_CODE_TO_DISEASE_MAP[normalizedSym.toUpperCase()];
      if (mapped && DISEASE_DISPLAY_PATTERNS[mapped]) {
        return DISEASE_DISPLAY_PATTERNS[mapped];
      }
    }

    // 텍스트 매칭
    for (const [, pattern] of Object.entries(DISEASE_DISPLAY_PATTERNS)) {
      const originalNorm = normalizeKey(pattern.original);
      const displayNorm = normalizeKey(pattern.displayFormat);
      if (normalizedSym.includes(originalNorm) || normalizedSym.includes(displayNorm)) {
        return pattern;
      }
    }

    return null;
  }, []);

  // 메시지 풍부화
  const enrichMessage = useCallback((message: MessageItem): MessageItem => {
    const pattern = resolveDiseasePattern(message.symBpmgGubun, message.msg);
    const standardizedSymptom = pattern
      ? pattern.displayFormat
      : (message.symBpmgGubun && message.symBpmgGubun !== '-' ? message.symBpmgGubun
        : (message.msgGubun && message.msgGubun !== '-' ? message.msgGubun : '응급실'));

    // isDisease 판단 로직 개선:
    // 1. 패턴 매칭 성공
    // 2. msgGubun(symBlkMsgTyp)이 "중증"인 경우
    // 3. symBpmgGubun(symTypCodMag)이 "응급실"이 아닌 구체적인 질환명인 경우
    const isDiseaseByMsgGubun = message.msgGubun === '중증';
    const isDiseaseBySymptom = !!(message.symBpmgGubun &&
      message.symBpmgGubun !== '-' &&
      message.symBpmgGubun !== '응급실' &&
      message.symBpmgGubun !== '응급');
    const isDisease = !!pattern || isDiseaseByMsgGubun || isDiseaseBySymptom;

    return {
      ...message,
      diseasePattern: pattern || undefined,
      standardizedSymptom,
      isDisease
    };
  }, [resolveDiseasePattern]);

  // 병원 레벨 계산
  const getHospitalLevel = useCallback((hospital: Hospital): string => {
    const hpbd = hospitalTypeMap[hospital.id] || hospital.hpbd || '';
    return getShortOrgType(hpbd);
  }, [hospitalTypeMap]);

  // 데이터 로딩
  const loadAllHospitalData = useCallback(async () => {
    setLoading(true);
    try {
      const hospitalList = await fetchHospitalsForRegion(selectedRegion);

      if (hospitalList.length === 0) {
        setAllMessages([]);
        return;
      }

      const fetchPromises = hospitalList.map(async (hospital) => {
        try {
          const messages = await fetchMessages(hospital.id);
          const mappedHpbd = hospitalTypeMap[hospital.id];
          const hospitalWithType = mappedHpbd ? { ...hospital, hpbd: mappedHpbd } : hospital;
          const enrichedMessages = messages.map(enrichMessage);
          return { ...hospitalWithType, messages: enrichedMessages };
        } catch {
          return { ...hospital, messages: [] };
        }
      });

      const results = await Promise.all(fetchPromises);
      setAllMessages(results.filter(h => h.messages.length > 0));
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      setAllMessages([]);
    } finally {
      setLoading(false);
    }
  }, [selectedRegion, hospitalTypeMap, fetchHospitalsForRegion, fetchMessages, enrichMessage]);

  // 초기 데이터 로드
  useEffect(() => {
    if (Object.keys(hospitalTypeMap).length > 0) {
      loadAllHospitalData();
    }
  }, [selectedRegion, hospitalTypeMap, loadAllHospitalData]);

  // 필터링된 메시지 - 개별 메시지 단위로 필터링
  const filteredMessages = useMemo(() => {
    const hospitalSearchLower = hospitalSearch.toLowerCase();
    const messageSearchLower = messageSearch.toLowerCase();

    return allMessages
      .map(hospital => {
        // 병원명 필터
        if (hospitalSearchLower && !hospital.name.toLowerCase().includes(hospitalSearchLower)) {
          return null;
        }

        // 기관분류 필터
        const hospitalType = getHospitalLevel(hospital);
        if (!selectedOrgTypes.includes(hospitalType)) {
          return null;
        }

        // 개별 메시지 필터링
        const filteredMsgs = hospital.messages.filter(msg => {
          // 메시지 검색 - 메시지 내용 또는 증상명에서 검색
          if (messageSearchLower) {
            const msgLower = msg.msg.toLowerCase();
            const symptomLower = (msg.standardizedSymptom || '').toLowerCase();
            if (!msgLower.includes(messageSearchLower) && !symptomLower.includes(messageSearchLower)) {
              return false;
            }
          }

          // 질환 필터
          if (selectedSevereType) {
            const keywords = selectedSevereType
              .replace(/[\[\]]/g, '')
              .split(/\s+/)
              .filter(word => word.length > 1);

            const symptomLower = (msg.standardizedSymptom || '').toLowerCase();
            if (!keywords.every(keyword => symptomLower.includes(keyword.toLowerCase()))) {
              return false;
            }
          }

          return true;
        });

        // 필터링된 메시지가 있는 경우에만 병원 반환
        if (filteredMsgs.length > 0) {
          return { ...hospital, messages: filteredMsgs };
        }
        return null;
      })
      .filter((h): h is HospitalWithMessages => h !== null);
  }, [allMessages, hospitalSearch, messageSearch, selectedSevereType, selectedOrgTypes, getHospitalLevel]);

  // 병원 그룹 토글
  const toggleHospitalGroup = (hospitalName: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(hospitalName)) {
        newSet.delete(hospitalName);
      } else {
        newSet.add(hospitalName);
      }
      return newSet;
    });
  };

  // 전체 펼치기/접기
  const toggleAllHospitals = () => {
    if (allExpanded) {
      // 전체 접기: 모든 병원명을 collapsedGroups에 추가
      const allHospitalNames = new Set(filteredMessages.map(h => h.name));
      setCollapsedGroups(allHospitalNames);
      setAllExpanded(false);
    } else {
      // 전체 펼치기: collapsedGroups 비우기
      setCollapsedGroups(new Set());
      setAllExpanded(true);
    }
  };

  // 로딩 표시
  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: isDark ? '#1E3A3A' : '#F5F0E8' }}>
        <div className="flex flex-col justify-center items-center min-h-[400px]">
          <div className={`w-10 h-10 border-4 ${isDark ? 'border-teal-700 border-t-teal-400' : 'border-orange-200 border-t-[#E85C4A]'} rounded-full animate-spin mb-4`}></div>
          <div className={isDark ? 'text-gray-300' : 'text-gray-700'}>데이터를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: isDark ? '#1E3A3A' : '#F5F0E8' }}>
      {showLocationNotice && (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-full border px-3 py-1 text-xs shadow-sm bg-white/90 text-gray-700 border-gray-300">
          현재 위치를 바탕으로 위치 정보가 설정되었습니다.
        </div>
      )}
      <main className="flex-1 p-4 max-w-[1800px] mx-auto w-full">
        {/* 컨트롤 섹션 - dger-api와 동일한 스타일 */}
        <div
          className="flex flex-nowrap items-center gap-2 mb-4 p-2 overflow-x-auto whitespace-nowrap"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* 지역 선택 */}
          <select
            className={`flex-shrink-0 px-2.5 border rounded-lg text-xs min-w-14 max-w-20 transition-colors ${
              isDark
                ? 'bg-[#1a2f2f] border-teal-700 text-teal-100'
                : 'bg-white border-gray-300 text-gray-800'
            }`}
            style={{ height: '32px', lineHeight: '30px', paddingTop: '0', paddingBottom: '0' }}
            value={selectedRegion}
            onChange={(e) => {
              hasUserSelectedRegion.current = true;
              const nextRegion = e.target.value;
              setSelectedRegion(nextRegion);
              setStoredRegion(mapSidoName(nextRegion));
              setRegionLocked(true);
            }}
          >
            {REGION_OPTIONS.map((region) => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>

          {/* 기관분류 체크박스 */}
          <div className="flex-shrink-0 flex items-center gap-1">
            {ORG_TYPE_OPTIONS.map(option => {
              const isSelected = selectedOrgTypes.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="inline-flex items-center gap-1 px-2.5 text-xs font-medium cursor-pointer border rounded-lg transition-colors"
                  style={{
                    height: '32px',
                    lineHeight: '28px',
                    backgroundColor: isSelected
                      ? (isDark ? '#c75a4a' : '#E85C4A')
                      : (isDark ? '#1a2f2f' : '#ffffff'),
                    borderColor: isSelected
                      ? (isDark ? '#d96a5a' : '#E85C4A')
                      : (isDark ? '#2d4a4a' : '#d1d5db'),
                    color: isSelected
                      ? '#ffffff'
                      : (isDark ? '#a0b0b0' : '#374151')
                  }}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOrgTypes([...selectedOrgTypes, option.value]);
                      } else {
                        setSelectedOrgTypes(selectedOrgTypes.filter(t => t !== option.value));
                      }
                    }}
                  />
                  <span className="hidden sm:inline">{option.label}</span>
                  <span className="sm:hidden">{option.shortLabel}</span>
                </label>
              );
            })}
          </div>

          {/* 검색 입력 */}
          <input
            type="text"
            placeholder="병원명 검색"
            className={`flex-shrink-0 px-3 border rounded-lg text-xs min-w-14 max-w-28 transition-colors ${
              isDark
                ? 'bg-[#1a2f2f] border-teal-700 text-teal-100 placeholder-teal-600'
                : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
            }`}
            style={{ height: '32px' }}
            value={hospitalSearch}
            onChange={(e) => setHospitalSearch(e.target.value)}
          />

          <input
            type="text"
            placeholder="메시지 검색"
            className={`flex-shrink-0 px-3 border rounded-lg text-xs min-w-14 max-w-28 transition-colors ${
              isDark
                ? 'bg-[#1a2f2f] border-teal-700 text-teal-100 placeholder-teal-600'
                : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
            }`}
            style={{ height: '32px' }}
            value={messageSearch}
            onChange={(e) => setMessageSearch(e.target.value)}
          />

          {/* 질환 필터 */}
          <select
            className={`flex-shrink-0 px-2 border rounded-lg text-xs min-w-14 max-w-40 transition-colors ${
              isDark
                ? 'bg-[#1a2f2f] border-teal-700 text-teal-100'
                : 'bg-white border-gray-300 text-gray-800'
            }`}
            style={{ height: '32px', lineHeight: '30px', paddingTop: '0', paddingBottom: '0' }}
            value={selectedSevereType}
            onChange={(e) => setSelectedSevereType(e.target.value)}
          >
            {SEVERE_TYPE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          {/* 전체 펼치기/접기 버튼 */}
          <button
            onClick={toggleAllHospitals}
            className="flex-shrink-0 px-3 text-xs rounded-lg whitespace-nowrap font-medium transition-colors border"
            style={{
              height: '32px',
              backgroundColor: isDark ? '#1a2f2f' : '#ffffff',
              borderColor: isDark ? '#2d4a4a' : '#d1d5db',
              color: isDark ? '#a0b0b0' : '#374151',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? '#2d4a4a' : '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? '#1a2f2f' : '#ffffff';
            }}
          >
            {allExpanded ? '전체 접기' : '전체 펼치기'}
          </button>
        </div>

        {/* 데스크탑 테이블 뷰 */}
        {!isMobile && (
          <div className="border rounded-2xl shadow-sm overflow-hidden" style={{
            backgroundColor: isDark ? '#1a2f2f' : '#ffffff',
            borderColor: isDark ? '#2d4a4a' : '#e5e7eb'
          }}>
            <div className="overflow-x-auto">
              {filteredMessages.length === 0 ? (
                <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  현재 선택한 지역의 불가능 메시지가 없습니다.
                </div>
              ) : (
                filteredMessages
                  .sort((a, b) => {
                    const aType = hospitalTypeMap[a.id] || '';
                    const bType = hospitalTypeMap[b.id] || '';
                    const aIsCenter = aType.includes('권역') || aType.includes('지역응급의료센터') || aType.includes('전문');
                    const bIsCenter = bType.includes('권역') || bType.includes('지역응급의료센터') || bType.includes('전문');
                    if (aIsCenter && !bIsCenter) return -1;
                    if (!aIsCenter && bIsCenter) return 1;
                    return a.name.localeCompare(b.name);
                  })
                  .map(hospital => {
                    const isCollapsed = collapsedGroups.has(hospital.name);
                    const level = getHospitalLevel(hospital);
                    const rate = calculateOccupancyRate(hospital);
                    const occupied = calculateTotalOccupancy(hospital);
                    const emergencyMsgs = hospital.messages.filter(m => !m.isDisease);
                    const diseaseMsgs = hospital.messages.filter(m => m.isDisease);

                    return (
                      <div key={hospital.id} className="hospital-group">
                        {/* 병원 헤더 */}
                        <div
                          className="cursor-pointer transition-colors px-3 py-1.5 text-white font-bold text-left relative pl-10 flex items-center"
                          style={{
                            backgroundColor: isCollapsed
                              ? (isDark ? '#1a2f2f' : '#9A9590')
                              : (isDark ? '#2d5050' : '#C97A6A')
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isCollapsed
                            ? (isDark ? '#243a3a' : '#7A7570')
                            : (isDark ? '#3d6060' : '#B56A5A')}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isCollapsed
                            ? (isDark ? '#1a2f2f' : '#9A9590')
                            : (isDark ? '#2d5050' : '#C97A6A')}
                          onClick={() => toggleHospitalGroup(hospital.name)}
                        >
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-white">
                            {isCollapsed ? '▶' : '▼'}
                          </span>
                          <span className="mr-2 inline-flex items-center"><OrgTypeBadge type={level} isDark={isDark} /></span>
                          <span>{hospital.name}</span>
                          <span className="font-normal text-sm text-gray-200 ml-3 hidden min-[900px]:inline">재실환자 {occupied}명</span>
                          <span className="font-normal text-sm text-gray-200 ml-3 inline min-[900px]:hidden">재실 {occupied}</span>
                          <span className="font-normal text-sm text-gray-200 ml-2 hidden min-[900px]:inline">병상 포화도</span>
                          <span className="ml-1 inline-flex items-center"><OccupancyBattery rate={rate} isDark={isDark} size="small" /></span>
                        </div>

                        {/* 펼쳐진 내용 */}
                        {!isCollapsed && (
                          <div>
                            {/* 응급실 메시지 섹션 */}
                            {emergencyMsgs.length > 0 && (
                              <div className={`border-l-4 ${isDark ? 'border-l-emerald-500' : 'border-l-green-500'}`}>
                                <table className="w-full border-collapse table-fixed">
                                  <thead>
                                    <tr style={{ backgroundColor: isDark ? '#1a3535' : '#4A5D5D' }}>
                                      <th className="px-3 py-1.5 text-left text-white font-bold text-xs">[{hospital.name}] 응급실 메시지 {emergencyMsgs.length}건</th>
                                      <th className="px-2 py-1.5 pr-4 text-center text-white font-bold text-xs w-28">기간</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {emergencyMsgs.map((msg, idx) => (
                                      <tr
                                        key={idx}
                                        className="border-b last:border-b-0 transition-colors"
                                        style={{ borderColor: isDark ? '#2d4a4a' : '#e5e7eb' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? '#1e3838' : '#faf5f0'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                      >
                                        <td
                                          className={`px-3 py-1.5 text-sm break-words ${isDark ? 'text-gray-200' : 'text-gray-700'}`}
                                          title={msg.msg}
                                        >
                                          <HighlightedMessage message={msg.msg} isDark={isDark} />
                                        </td>
                                        <td className={`px-2 py-1.5 pr-4 text-center text-xs whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                          {formatPeriod(msg.symBlkSttDtm, msg.symBlkEndDtm)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* 중증질환 메시지 섹션 */}
                            {diseaseMsgs.length > 0 && (
                              <div className={`border-l-4 ${isDark ? 'border-l-red-500' : 'border-l-[#E85C4A]'}`}>
                                <table className="w-full border-collapse table-fixed">
                                  <thead>
                                    <tr style={{ backgroundColor: isDark ? '#2d2525' : '#5D4A4A' }}>
                                      <th className="px-2 py-1.5 text-left text-white font-bold text-xs w-48"></th>
                                      <th className="px-3 py-1.5 text-left text-white font-bold text-xs">[{hospital.name}] 중증응급질환 불가능 메시지 {diseaseMsgs.length}건</th>
                                      <th className="px-2 py-1.5 pr-4 text-center text-white font-bold text-xs w-28">기간</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {diseaseMsgs.map((msg, idx) => (
                                      <tr
                                        key={idx}
                                        className="border-b last:border-b-0 transition-colors"
                                        style={{ borderColor: isDark ? '#2d4a4a' : '#e5e7eb' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? '#1e3838' : '#faf5f0'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                      >
                                        <td
                                          className={`px-2 py-1.5 text-left text-sm truncate ${isDark ? 'text-gray-200' : 'text-gray-700'} w-48`}
                                          title={msg.standardizedSymptom}
                                        >
                                          {msg.standardizedSymptom}
                                        </td>
                                        <td
                                          className={`px-3 py-1.5 text-sm break-words ${isDark ? 'text-gray-200' : 'text-gray-700'}`}
                                          title={msg.msg}
                                        >
                                          <HighlightedMessage message={msg.msg} isDark={isDark} />
                                        </td>
                                        <td className={`px-2 py-1.5 pr-4 text-center text-xs whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                          {formatPeriod(msg.symBlkSttDtm, msg.symBlkEndDtm)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {/* 모바일 카드 뷰 - 단순화된 디자인 */}
        {isMobile && (
          <div className="space-y-3">
            {filteredMessages.length === 0 ? (
              <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                현재 대구지역의 불가능 메시지가 없습니다.
              </div>
            ) : (
              filteredMessages
                .sort((a, b) => {
                  const aType = hospitalTypeMap[a.id] || '';
                  const bType = hospitalTypeMap[b.id] || '';
                  const aIsCenter = aType.includes('권역') || aType.includes('지역응급의료센터') || aType.includes('전문');
                  const bIsCenter = bType.includes('권역') || bType.includes('지역응급의료센터') || bType.includes('전문');
                  if (aIsCenter && !bIsCenter) return -1;
                  if (!aIsCenter && bIsCenter) return 1;
                  return a.name.localeCompare(b.name);
                })
                .map(hospital => {
                  const isCollapsed = collapsedGroups.has(hospital.name);
                  const level = getHospitalLevel(hospital);
                  const rate = calculateOccupancyRate(hospital);
                  const occupied = calculateTotalOccupancy(hospital);
                  const emergencyMsgs = hospital.messages.filter(m => !m.isDisease);
                  const diseaseMsgs = hospital.messages.filter(m => m.isDisease);

                  return (
                    <div
                      key={hospital.id}
                      className="rounded-lg overflow-hidden shadow-sm"
                      style={{
                        backgroundColor: isDark ? '#1a2f2f' : '#ffffff',
                        border: `1px solid ${isDark ? '#2d4a4a' : '#d1d5db'}`
                      }}
                    >
                      {/* 병원 헤더 */}
                      <div
                        className="px-3 py-2 cursor-pointer font-bold text-sm text-white flex items-center justify-center"
                        style={{
                          backgroundColor: isCollapsed
                            ? (isDark ? '#1a2f2f' : '#9A9590')
                            : (isDark ? '#2d5050' : '#C97A6A')
                        }}
                        onClick={() => toggleHospitalGroup(hospital.name)}
                      >
                        <span className="mr-2 inline-flex items-center"><OrgTypeBadge type={level} isDark={isDark} /></span>
                        <span>{hospital.name}</span>
                        <span className="font-normal text-xs text-gray-200 ml-2">재실 {occupied}</span>
                        <span className="ml-1 inline-flex items-center"><OccupancyBattery rate={rate} isDark={isDark} size="small" /></span>
                      </div>

                      {/* 병원 콘텐츠 - 플랫 디자인 */}
                      {!isCollapsed && (
                        <div>
                          {/* 응급실 메시지 */}
                          {emergencyMsgs.length > 0 && (
                            <div className={`border-l-4 ${isDark ? 'border-l-emerald-500' : 'border-l-green-500'}`}>
                              <div className={`px-3 py-1.5 text-xs font-semibold ${isDark ? 'bg-emerald-900/30 text-emerald-400' : 'bg-green-50 text-green-700'}`}>
                                [{hospital.name}] 응급실 메시지 {emergencyMsgs.length}건
                              </div>
                              {emergencyMsgs.map((msg, idx) => (
                                <div
                                  key={idx}
                                  className={`px-3 py-2 text-xs border-b last:border-b-0 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}
                                >
                                  {msg.standardizedSymptom !== '응급실' && (
                                    <span className={`font-bold mr-1 ${isDark ? 'text-emerald-400' : 'text-green-600'}`}>
                                      {msg.standardizedSymptom}
                                    </span>
                                  )}
                                  <span className={isDark ? 'text-gray-200' : 'text-gray-700'}><HighlightedMessage message={msg.msg} isDark={isDark} isMobile={true} /></span>
                                  <span className={`ml-2 text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {formatDateNoYear(msg.symBlkSttDtm)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 중증질환 메시지 */}
                          {diseaseMsgs.length > 0 && (
                            <div className={`border-l-4 ${isDark ? 'border-l-red-500' : 'border-l-[#E85C4A]'}`}>
                              <div className={`px-3 py-1.5 text-xs font-semibold ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-[#E85C4A]'}`}>
                                [{hospital.name}] 중증응급질환 불가능 메시지 {diseaseMsgs.length}건
                              </div>
                              {diseaseMsgs.map((msg, idx) => (
                                <div
                                  key={idx}
                                  className={`px-3 py-2 text-xs border-b last:border-b-0 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}
                                  title={`${msg.diseasePattern?.displayFormat || msg.standardizedSymptom}: ${msg.msg}`}
                                >
                                  <span className={`font-bold mr-1 ${isDark ? 'text-amber-400' : 'text-[#E85C4A]'}`}>
                                    {msg.diseasePattern?.displayFormat || msg.standardizedSymptom}
                                  </span>
                                  <span className={isDark ? 'text-gray-200' : 'text-gray-700'}><HighlightedMessage message={msg.msg} isDark={isDark} isMobile={true} /></span>
                                  <span className={`ml-2 text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {formatDateNoYear(msg.symBlkSttDtm)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
