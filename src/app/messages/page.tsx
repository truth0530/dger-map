'use client';

/**
 * 응급 메시지 페이지
 * 원본: dger-api/public/systommsg2.html
 *
 * dger-api와 동일한 구조, Next.js에 맞게 변환
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from '@/lib/contexts/ThemeContext';

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
  { value: '', label: '전체' },
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

// 기관분류 필터 옵션
const ORG_TYPE_OPTIONS = [
  { value: '권역응급의료센터', label: '권역', shortLabel: '권' },
  { value: '지역응급의료센터', label: '센터', shortLabel: '센' },
  { value: '지역응급의료기관', label: '기관', shortLabel: '기' }
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
}

interface HospitalWithMessages extends Hospital {
  messages: MessageItem[];
}

// 유틸리티 함수
const normalizeKey = (value: string) => (value || '').replace(/\s+/g, '').toLowerCase();

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

// 날짜 포맷팅
const formatPeriod = (startStr: string, endStr: string): string => {
  if (!startStr || startStr.length < 14) return '-';

  const startMonth = startStr.substring(4, 6);
  const startDay = startStr.substring(6, 8);
  const startHour = startStr.substring(8, 10);
  const startMin = startStr.substring(10, 12);
  const start = `${startMonth}/${startDay} ${startHour}:${startMin}`;

  if (!endStr || endStr.length < 14) {
    return start;
  }

  const endMonth = endStr.substring(4, 6);
  const endDay = endStr.substring(6, 8);
  const endHour = endStr.substring(8, 10);
  const endMin = endStr.substring(10, 12);
  const end = `${endMonth}/${endDay} ${endHour}:${endMin}`;

  return `${start} ~ ${end}`;
};

const formatDateNoYear = (dateStr: string): string => {
  if (!dateStr || dateStr.length < 14) return '-';
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  const hour = dateStr.substring(8, 10);
  const minute = dateStr.substring(10, 12);
  return `${month}/${day} ${hour}:${minute}`;
};

export default function MessagesPage() {
  const { isDark } = useTheme();
  const [selectedRegion, setSelectedRegion] = useState('대구');
  const [selectedOrgTypes, setSelectedOrgTypes] = useState(['권역응급의료센터', '지역응급의료센터', '지역응급의료기관']);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [selectedSevereType, setSelectedSevereType] = useState('');
  const [allMessages, setAllMessages] = useState<HospitalWithMessages[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
  const [hospitalTypeMap, setHospitalTypeMap] = useState<Record<string, string>>({});

  // 화면 크기 감지
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  // 지역별 병원 목록 가져오기
  const fetchHospitalsForRegion = useCallback(async (region: string): Promise<Hospital[]> => {
    try {
      const params = new URLSearchParams({
        STAGE1: region,
        numOfRows: '1000',
        pageNo: '1'
      });

      const res = await fetch(`/api/severe-diseases?${params}`);
      if (!res.ok) return [];

      const text = await res.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');

      const items = xml.getElementsByTagName('item');
      const hospitalSet = new Map<string, Hospital>();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const hpid = item.getElementsByTagName('hpid')[0]?.textContent || '';
        const name = item.getElementsByTagName('dutyName')[0]?.textContent || '';
        const tel = item.getElementsByTagName('dutyTel3')[0]?.textContent || '';

        if (hpid && name && !hospitalSet.has(hpid)) {
          hospitalSet.set(hpid, { id: hpid, name, tel });
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

    return {
      ...message,
      diseasePattern: pattern || undefined,
      standardizedSymptom,
      isDisease: !!pattern
    };
  }, [resolveDiseasePattern]);

  // 병원 레벨 계산
  const getHospitalLevel = useCallback((hospital: Hospital): string => {
    const hpbd = hospitalTypeMap[hospital.id] || hospital.hpbd || '';
    switch (hpbd) {
      case '권역응급의료센터': return '권역응급의료센터';
      case '지역응급의료센터': return '지역응급의료센터';
      case '전문응급의료센터': return '전문응급의료센터';
      case '지역응급의료기관': return '지역응급의료기관';
      default: return '기타';
    }
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

  // 로딩 표시
  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className="flex flex-col justify-center items-center min-h-[400px]">
          <div className={`w-10 h-10 border-4 ${isDark ? 'border-gray-700 border-t-blue-500' : 'border-gray-200 border-t-[#0a3a82]'} rounded-full animate-spin mb-4`}></div>
          <div className={isDark ? 'text-gray-400' : 'text-gray-600'}>데이터를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <main className="flex-1 p-4 max-w-[1800px] mx-auto w-full">
        {/* 컨트롤 섹션 - dger-api와 동일한 스타일 */}
        <div
          className="flex flex-nowrap items-center gap-2 mb-4 p-2 overflow-x-auto whitespace-nowrap"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* 지역 선택 */}
          <select
            className={`flex-shrink-0 px-2.5 border-2 rounded text-xs min-w-14 max-w-20 ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300'
            }`}
            style={{ height: '32px', lineHeight: '32px' }}
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
          >
            <option value="대구">대구</option>
            <option value="서울">서울</option>
            <option value="부산">부산</option>
            <option value="광주">광주</option>
            <option value="대전">대전</option>
            <option value="울산">울산</option>
            <option value="세종">세종</option>
            <option value="경기">경기</option>
            <option value="강원">강원</option>
            <option value="충북">충북</option>
            <option value="충남">충남</option>
            <option value="전북">전북</option>
            <option value="전남">전남</option>
            <option value="경북">경북</option>
            <option value="경남">경남</option>
            <option value="제주">제주</option>
          </select>

          {/* 기관분류 체크박스 */}
          <div className="flex-shrink-0 flex items-center gap-1">
            {ORG_TYPE_OPTIONS.map(option => {
              const isSelected = selectedOrgTypes.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={`inline-flex items-center gap-1 px-2.5 text-xs font-medium cursor-pointer border-2 rounded transition-colors ${
                    isSelected
                      ? isDark
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-[#0a3a82] text-white border-[#0a3a82]'
                      : isDark
                        ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                        : 'bg-white text-gray-800 border-gray-400 hover:bg-gray-100'
                  }`}
                  style={{ height: '32px', lineHeight: '28px' }}
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
            className={`flex-shrink-0 px-2 border-2 rounded text-xs min-w-14 max-w-28 ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                : 'bg-white border-gray-300'
            }`}
            style={{ height: '32px' }}
            value={hospitalSearch}
            onChange={(e) => setHospitalSearch(e.target.value)}
          />

          <input
            type="text"
            placeholder="메시지 검색"
            className={`flex-shrink-0 px-2 border-2 rounded text-xs min-w-14 max-w-28 ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                : 'bg-white border-gray-300'
            }`}
            style={{ height: '32px' }}
            value={messageSearch}
            onChange={(e) => setMessageSearch(e.target.value)}
          />

          {/* 질환 필터 */}
          <select
            className={`flex-shrink-0 px-2 border-2 rounded text-xs min-w-14 max-w-40 ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300'
            }`}
            style={{ height: '32px' }}
            value={selectedSevereType}
            onChange={(e) => setSelectedSevereType(e.target.value)}
          >
            {SEVERE_TYPE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <button
            onClick={loadAllHospitalData}
            className={`flex-shrink-0 px-2.5 text-xs rounded whitespace-nowrap ${
              isDark
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-[#0a3a82] text-white hover:bg-[#0c4b9a]'
            }`}
            style={{ height: '32px' }}
          >
            검색
          </button>
        </div>

        {/* 데스크탑 테이블 뷰 */}
        {!isMobile && (
          <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg shadow-sm overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-fixed">
                <thead className={isDark ? 'bg-blue-700' : 'bg-[#0056b3]'}>
                  <tr>
                    <th className="px-4 py-3 text-center text-white font-bold text-sm w-20">구분</th>
                    <th className="px-4 py-3 text-center text-white font-bold text-sm w-56">중증</th>
                    <th className="px-4 py-3 text-center text-white font-bold text-sm">메시지</th>
                    <th className="px-4 py-3 text-center text-white font-bold text-sm w-48">기간</th>
                  </tr>
                </thead>
                {filteredMessages.length === 0 ? (
                  <tbody>
                    <tr>
                      <td colSpan={4} className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        현재 선택한 지역의 불가능 메시지가 없습니다.
                      </td>
                    </tr>
                  </tbody>
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
                      const emergencyMsgs = hospital.messages.filter(m => !m.isDisease);
                      const diseaseMsgs = hospital.messages.filter(m => m.isDisease);
                      const orderedMsgs = [...emergencyMsgs, ...diseaseMsgs];

                      return (
                        <tbody key={hospital.id} className="hospital-group">
                          <tr
                            className={`cursor-pointer transition-colors ${
                              isCollapsed
                                ? isDark ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-500 hover:bg-gray-400'
                                : isDark ? 'bg-blue-700 hover:bg-blue-600' : 'bg-[#0056b3] hover:bg-[#0069d9]'
                            }`}
                            onClick={() => toggleHospitalGroup(hospital.name)}
                          >
                            <td colSpan={4} className="px-4 py-2 text-white font-bold text-left relative pl-12">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-white">
                                {isCollapsed ? '▶' : '▼'}
                              </span>
                              {hospital.name}
                              <span className="font-normal text-sm text-gray-200 ml-2">({level})</span>
                              {hospital.tel && <span className="font-normal text-sm text-gray-200 ml-2">{hospital.tel}</span>}
                            </td>
                          </tr>
                          {!isCollapsed && orderedMsgs.map((msg, idx) => (
                            <tr key={idx} className={`border-b ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                              <td className={`px-4 py-3 text-center text-sm ${msg.isDisease ? (isDark ? 'text-red-400 font-bold' : 'text-red-600 font-bold') : (isDark ? 'text-gray-300' : 'text-gray-700')}`}>
                                {msg.isDisease ? '질환' : '응급실'}
                              </td>
                              <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                {msg.standardizedSymptom}
                              </td>
                              <td className={`px-4 py-3 text-sm break-words ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                {msg.msg}
                              </td>
                              <td className={`px-4 py-3 text-center text-sm whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {formatPeriod(msg.symBlkSttDtm, msg.symBlkEndDtm)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      );
                    })
                )}
              </table>
            </div>
          </div>
        )}

        {/* 모바일 카드 뷰 */}
        {isMobile && (
          <div className="space-y-4">
            {filteredMessages.length === 0 ? (
              <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
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
                  const emergencyMsgs = hospital.messages.filter(m => !m.isDisease);
                  const diseaseMsgs = hospital.messages.filter(m => m.isDisease);

                  return (
                    <div
                      key={hospital.id}
                      className={`rounded-lg overflow-hidden shadow-sm ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border`}
                    >
                      {/* 병원 헤더 */}
                      <div
                        className={`px-4 py-3 cursor-pointer font-bold text-sm text-center text-white ${
                          isCollapsed
                            ? isDark ? 'bg-gray-600' : 'bg-gray-500'
                            : isDark ? 'bg-blue-700' : 'bg-[#0056b3]'
                        }`}
                        onClick={() => toggleHospitalGroup(hospital.name)}
                      >
                        {hospital.name}
                        <span className="font-normal text-xs text-gray-200 ml-2">({level})</span>
                        {hospital.tel && <span className="font-normal text-xs text-gray-200 ml-2">{hospital.tel}</span>}
                      </div>

                      {/* 병원 콘텐츠 */}
                      {!isCollapsed && (
                        <div className="p-3">
                          {/* 응급실 메시지 */}
                          {emergencyMsgs.length > 0 && (
                            <div className={`mb-3 p-3 rounded-md ${isDark ? 'bg-gray-900 border-green-700' : 'bg-green-50 border-green-500'} border-l-4`}>
                              <div className={`font-semibold text-xs mb-2 ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                [응급실] 운영 정보
                              </div>
                              {emergencyMsgs.map((msg, idx) => (
                                <div key={idx} className={`py-1 text-xs border-b last:border-b-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                  {msg.standardizedSymptom !== '응급실' && (
                                    <span className={`font-bold mr-2 ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                      {msg.standardizedSymptom}
                                    </span>
                                  )}
                                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{msg.msg}</span>
                                  <span className={`ml-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {formatDateNoYear(msg.symBlkSttDtm)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 중증질환 메시지 */}
                          {diseaseMsgs.length > 0 && (
                            <div className={`p-3 rounded-md ${isDark ? 'bg-gray-900 border-red-700' : 'bg-red-50 border-red-500'} border-l-4`}>
                              <div className={`font-semibold text-xs mb-2 ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                                [중증질환] 수용불가 정보
                              </div>
                              {diseaseMsgs.map((msg, idx) => (
                                <div key={idx} className={`py-1 text-xs border-b last:border-b-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                  <span className={`font-bold mr-2 ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                                    {msg.diseasePattern?.displayFormat || msg.standardizedSymptom}
                                  </span>
                                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{msg.msg}</span>
                                  <span className={`ml-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
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
