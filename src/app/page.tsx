'use client';

/**
 * 병상 현황 페이지 (메인 페이지)
 * 원본: dger-api/public/index.html
 *
 * 테이블 구조: dger-api와 동일
 * - 병원명, 병상포화도, 재실인원, 일반병상, 코호트, 음압격리, 일반격리, 소아, 소아음압, 소아일반, 업데이트 시간
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from '@/lib/contexts/ThemeContext';
import { useBedData, HospitalBedData } from '@/lib/hooks/useBedData';
import { useSevereData } from '@/lib/hooks/useSevereData';
import { REGIONS, SEVERE_TYPES } from '@/lib/constants/dger';
import { mapSidoName, mapSidoShort } from '@/lib/utils/regionMapping';
import { detectRegionFromLocation, getStoredRegion, isRegionLocked, setRegionLocked, setStoredRegion } from '@/lib/utils/locationRegion';
import { isCenterHospital, shortenHospitalName } from '@/lib/utils/hospitalUtils';
import { formatDateWithDay, isUpdateStale } from '@/lib/utils/dateUtils';
import { useEmergencyMessages } from '@/lib/hooks/useEmergencyMessages';
import { ClassifiedMessages, parseMessageWithHighlights, getHighlightClass, HighlightedSegment, normalizeMessageForDisplay } from '@/lib/utils/messageClassifier';
import MessageTooltip from '@/components/ui/MessageTooltip';
import { calculateOccupancyRate, calculateTotalOccupancy, getBedValues } from '@/lib/utils/bedOccupancy';
import { getBedStatusClass, renderBedValue } from '@/lib/utils/bedHelpers';
import { OccupancyBattery, OrgTypeBadge } from '@/components/ui/OccupancyBattery';

// 하이라이트된 메시지 렌더링 컴포넌트
function HighlightedMessage({ message }: { message: string }) {
  const normalizedMessage = normalizeMessageForDisplay(message);
  const segments = parseMessageWithHighlights(normalizedMessage);
  return (
    <MessageTooltip message={message} isDark={true}>
      <span>
        {segments.map((segment, idx) => (
          <span key={idx} className={getHighlightClass(segment.type)}>
            {segment.text}
          </span>
        ))}
      </span>
    </MessageTooltip>
  );
}

// 뷰 모드 타입
type ViewMode = 'table' | 'cards';

// 병원 유형 필터
interface OrgTypes {
  권역: boolean;
  센터: boolean;
  기관: boolean;
}

// 병원 유형 판별 (hpbd 우선, 없으면 dutyEmclsName 사용)
function getHospitalOrgType(hospital: HospitalBedData): '권역' | '센터' | '기관' {
  // hpbd (hosp_list.json에서 매핑된 유형) 우선 사용
  const type = hospital.hpbd || hospital.dutyEmclsName || '';
  if (type.includes('권역') || type.includes('전문')) return '권역';
  if (type.includes('지역응급의료센터')) return '센터';
  if (type.includes('지역응급의료기관')) return '기관';
  return '기관'; // 기본값
}

export default function HomePage() {
  const { isDark } = useTheme();
  const [selectedRegion, setSelectedRegion] = useState('대구');
  const [searchTerm, setSearchTerm] = useState('');
  const [orgTypes, setOrgTypes] = useState<OrgTypes>({
    권역: true,
    센터: true,
    기관: true
  });
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedDisease, setSelectedDisease] = useState('');
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [showLocationNotice, setShowLocationNotice] = useState(false);

  // 테이블 칼럼 너비 상태
  const [columnWidths, setColumnWidths] = useState({
    hospital: 200,
    occupancy: 90,
    count: 70,
    general: 80,
    cohort: 70,
    negative: 75,
    isolation: 75,
    pediatric: 60,
    pedNegative: 75,
    pedIsolation: 75,
    update: 110
  });
  const resizingRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null);

  // 칼럼 리사이즈 시작
  const startResize = useCallback((column: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = {
      column,
      startX: e.clientX,
      startWidth: columnWidths[column as keyof typeof columnWidths]
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const diff = e.clientX - resizingRef.current.startX;
      const newWidth = Math.max(50, resizingRef.current.startWidth + diff);
      setColumnWidths(prev => ({
        ...prev,
        [resizingRef.current!.column]: newWidth
      }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths]);

  const { loading, error, data, lastUpdate, fetchBedData, clearCache, hospitalTypeMapReady } = useBedData();
  const { data: severeData, fetchSevereData } = useSevereData();
  const { messages: emergencyMessages, loading: messageLoading, fetchMessages } = useEmergencyMessages();

  // 메시지 토글
  const toggleMessage = useCallback((hpid: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(hpid)) {
        newSet.delete(hpid);
      } else {
        newSet.add(hpid);
      }
      return newSet;
    });
  }, []);

  // 모든 메시지 토글
  const toggleAllMessages = useCallback(() => {
    if (expandedMessages.size > 0) {
      setExpandedMessages(new Set());
    } else {
      const allHpids = new Set(data.map(h => h.hpid));
      setExpandedMessages(allHpids);
    }
  }, [expandedMessages.size, data]);

  useEffect(() => {
    let isActive = true;
    const locked = isRegionLocked();
    const storedRegion = getStoredRegion();
    if (locked && storedRegion) {
      const shortRegion = mapSidoShort(storedRegion);
      if (REGIONS.some((r) => r.value === shortRegion)) {
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
      if (!isActive || !region) return;
      const shortRegion = mapSidoShort(region);
      if (REGIONS.some((r) => r.value === shortRegion)) {
        setSelectedRegion(shortRegion);
        setShowLocationNotice(true);
        window.setTimeout(() => setShowLocationNotice(false), 2000);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    // hospitalTypeMapReady가 true가 되면 데이터를 다시 가져옴
    if (hospitalTypeMapReady) {
      const mappedRegion = mapSidoName(selectedRegion);
      fetchBedData(mappedRegion);
      fetchSevereData(mappedRegion);
    }
  }, [selectedRegion, fetchBedData, fetchSevereData, hospitalTypeMapReady]);

  // 자동 새로고침 (2분마다)
  useEffect(() => {
    const interval = setInterval(() => {
      const mappedRegion = mapSidoName(selectedRegion);
      fetchBedData(mappedRegion, true);
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [selectedRegion, fetchBedData]);

  const handleRegionChange = useCallback((region: string) => {
    setSelectedRegion(region);
    setStoredRegion(mapSidoName(region));
    setRegionLocked(true);
  }, []);

  const filteredData = useMemo(() => {
    let filtered = data;

    // 검색어 필터 (약어도 검색 가능)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(h => {
        const fullName = h.dutyName.toLowerCase();
        const shortName = shortenHospitalName(h.dutyName).toLowerCase();
        return fullName.includes(term) || shortName.includes(term);
      });
    }

    // 병원 유형 필터
    filtered = filtered.filter(h => {
      const orgType = getHospitalOrgType(h);
      return orgTypes[orgType];
    });

    // 중증질환 필터 - 선택된 질환을 수용 가능한 병원만
    if (selectedDisease && severeData.length > 0) {
      const diseaseType = SEVERE_TYPES.find(d => d.qn === selectedDisease);
      if (diseaseType) {
        // severeData에서 해당 질환이 'Y'인 병원의 hpid 목록
        const availableHpids = new Set(
          severeData
            .filter(h => (h.severeStatus[diseaseType.key] || '').trim().toUpperCase() === 'Y')
            .map(h => h.hpid)
        );
        filtered = filtered.filter(h => availableHpids.has(h.hpid));
      }
    }

    // 정렬: 센터급 우선 → 재실인원 내림차순 → 포화도 내림차순
    return [...filtered].sort((a, b) => {
      const aIsCenter = isCenterHospital({ hpbd: a.hpbd, dutyEmclsName: a.dutyEmclsName });
      const bIsCenter = isCenterHospital({ hpbd: b.hpbd, dutyEmclsName: b.dutyEmclsName });

      if (aIsCenter && !bIsCenter) return -1;
      if (!aIsCenter && bIsCenter) return 1;

      const occupancyDiff = calculateTotalOccupancy(b) - calculateTotalOccupancy(a);
      if (occupancyDiff !== 0) return occupancyDiff;

      return calculateOccupancyRate(b) - calculateOccupancyRate(a);
    });
  }, [data, searchTerm, orgTypes, selectedDisease, severeData]);

  const firstNonCenterIndex = useMemo(
    () => filteredData.findIndex(h => !isCenterHospital({ hpbd: h.hpbd, dutyEmclsName: h.dutyEmclsName })),
    [filteredData]
  );


  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-[#F5F0E8]'}`}>
      {showLocationNotice && (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-full border px-3 py-1 text-xs shadow-sm bg-white/90 text-gray-700 border-gray-300">
          현재 위치를 바탕으로 위치 정보가 설정되었습니다.
        </div>
      )}
      <div className="max-w-full mx-auto px-2 py-2">
        {/* 컨트롤 섹션 - dger-api와 동일 */}
        <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1 flex-nowrap">
          {/* 테이블/카드 보기 탭 - 모바일에서 숨김, 데스크탑에서만 표시 */}
          <div className="hidden sm:flex items-center flex-shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className="px-3 py-1.5 text-sm rounded-l border h-9 transition-colors whitespace-nowrap"
              style={{
                backgroundColor: viewMode === 'table'
                  ? (isDark ? '#4b5563' : '#4A5D5D')
                  : (isDark ? '#1f2937' : '#f3f4f6'),
                borderColor: viewMode === 'table'
                  ? (isDark ? '#6b7280' : '#4A5D5D')
                  : (isDark ? '#4b5563' : '#d1d5db'),
                color: viewMode === 'table'
                  ? '#ffffff'
                  : (isDark ? '#d1d5db' : '#374151')
              }}
            >
              테이블
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className="px-3 py-1.5 text-sm rounded-r border-t border-r border-b h-9 transition-colors whitespace-nowrap"
              style={{
                backgroundColor: viewMode === 'cards'
                  ? (isDark ? '#4b5563' : '#4A5D5D')
                  : (isDark ? '#1f2937' : '#f3f4f6'),
                borderColor: viewMode === 'cards'
                  ? (isDark ? '#6b7280' : '#4A5D5D')
                  : (isDark ? '#4b5563' : '#d1d5db'),
                color: viewMode === 'cards'
                  ? '#ffffff'
                  : (isDark ? '#d1d5db' : '#374151')
              }}
            >
              카드
            </button>
          </div>

          {/* 지역 선택 */}
          <select
            value={selectedRegion}
            onChange={(e) => handleRegionChange(e.target.value)}
            className={`px-1 sm:px-2 py-1.5 border rounded text-sm h-9 flex-shrink-0 ${
              isDark
                ? 'bg-gray-800 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
            style={{ width: 'auto', minWidth: '52px', maxWidth: '104px' }}
          >
            {REGIONS.map(region => (
              <option key={region.value} value={region.value}>
                {region.value}
              </option>
            ))}
          </select>

          {/* 병원 유형 필터 - 체크박스 그룹 */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {(Object.keys(orgTypes) as (keyof OrgTypes)[]).map((key) => {
              const shortLabel = key === '권역' ? '권' : key === '센터' ? '센' : '기';
              return (
                <label
                  key={key}
                  className="px-2.5 py-1.5 text-xs font-medium rounded border-2 cursor-pointer transition-colors flex items-center whitespace-nowrap"
                  style={{
                    height: '32px',
                    backgroundColor: orgTypes[key]
                      ? (isDark ? '#4b5563' : '#4A5D5D')
                      : (isDark ? '#374151' : '#f3f4f6'),
                    borderColor: orgTypes[key]
                      ? (isDark ? '#6b7280' : '#4A5D5D')
                      : (isDark ? '#4b5563' : '#d1d5db'),
                    color: orgTypes[key]
                      ? '#ffffff'
                      : (isDark ? '#d1d5db' : '#374151')
                  }}
                >
                  <input
                    type="checkbox"
                    checked={orgTypes[key]}
                    onChange={(e) => setOrgTypes({
                      ...orgTypes,
                      [key]: e.target.checked
                    })}
                    className="hidden"
                  />
                  <span className="sm:hidden">{shortLabel}</span>
                  <span className="hidden sm:inline">{key}</span>
                </label>
              );
            })}
          </div>

          {/* 검색 - 모바일 */}
          <input
            type="text"
            placeholder="병원명"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`sm:hidden px-2 py-1.5 border rounded text-sm h-9 flex-shrink-0 ${
              isDark
                ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
            style={{ width: '70px' }}
          />
          {/* 검색 - PC */}
          <input
            type="text"
            placeholder="병원명 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`hidden sm:inline-flex px-2 py-1.5 border rounded text-sm h-9 flex-shrink-0 ${
              isDark
                ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
            style={{ width: '100px' }}
          />

          {/* 27개 중증질환 드롭다운 */}
          <select
            value={selectedDisease}
            onChange={(e) => setSelectedDisease(e.target.value)}
            className={`sm:hidden px-1 py-1.5 border rounded text-sm h-9 w-20 flex-shrink-0 ${
              isDark
                ? 'bg-gray-800 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="">가능질환</option>
            {SEVERE_TYPES.map(disease => (
              <option key={disease.qn} value={disease.qn}>
                {disease.qn}. {disease.label}
              </option>
            ))}
          </select>
          <select
            value={selectedDisease}
            onChange={(e) => setSelectedDisease(e.target.value)}
            className={`hidden sm:inline-flex px-2 py-1.5 border rounded text-sm h-9 min-w-[180px] max-w-[210px] flex-shrink-0 ${
              isDark
                ? 'bg-gray-800 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="">가능한 27개중증질환 선택</option>
            {SEVERE_TYPES.map(disease => (
              <option key={disease.qn} value={disease.qn}>
                {disease.qn}. {disease.label}
              </option>
            ))}
          </select>

          {/* 메시지 모두 펼치기/접기 버튼 */}
          <button
            onClick={toggleAllMessages}
            className={`px-2 py-1.5 text-sm rounded border h-9 transition-colors whitespace-nowrap flex-shrink-0 ${
              isDark
                ? 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {expandedMessages.size > 0 ? (
              <>
                <span className="sm:hidden">접기</span>
                <span className="hidden sm:inline">메시지 접기</span>
              </>
            ) : (
              <>
                <span className="sm:hidden">펼치기</span>
                <span className="hidden sm:inline">메시지 펼치기</span>
              </>
            )}
          </button>

        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className={`fixed inset-0 flex items-center justify-center z-50 ${isDark ? 'bg-gray-900/90' : 'bg-[#F5F0E8]/90'}`}>
            <div className={`w-12 h-12 border-4 border-t-[#4A5D5D] rounded-full animate-spin ${isDark ? 'border-gray-700' : 'border-gray-200'}`}></div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className={`border px-4 py-3 rounded-md mb-2 ${isDark ? 'bg-red-900/50 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {error}
          </div>
        )}

        {/* 테이블 뷰 */}
        {viewMode === 'table' && (
          <div className={`border rounded-lg overflow-hidden shadow-sm ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="sm:overflow-x-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
              <table className="w-full border-collapse">
                {/* 칼럼 너비 정의: 병원명 넓게, 코호트 좁게, 업데이트 유지 */}
                <colgroup>
                  <col className="w-[100px] sm:w-[180px] lg:w-[220px] min-w-[100px]" />
                  <col className="w-[60px] sm:w-[80px]" />
                  <col className="w-[50px] sm:w-[70px]" />
                  <col className="w-[50px] sm:w-[70px]" />
                  <col className="hidden sm:table-column w-[50px] lg:w-[60px]" />
                  <col className="hidden sm:table-column w-[60px] lg:w-[70px]" />
                  <col className="hidden sm:table-column w-[60px] lg:w-[70px]" />
                  <col className="hidden sm:table-column w-[45px] lg:w-[55px]" />
                  <col className="hidden sm:table-column w-[60px] lg:w-[70px]" />
                  <col className="hidden sm:table-column w-[60px] lg:w-[70px]" />
                  <col className="w-[85px] sm:w-[100px] lg:w-[115px]" />
                </colgroup>
                <thead className={`sticky top-0 z-20 ${isDark ? 'bg-[#111827]' : 'bg-[#4A5D5D]'}`}>
                  <tr>
                    <th className="px-1 sm:px-2 py-1 text-center text-white font-semibold text-xs whitespace-nowrap relative">
                      <span className="lg:hidden">병원</span>
                      <span className="hidden lg:inline">병원명</span>
                      {selectedDisease && (
                        <span className="ml-2 font-normal text-xs text-orange-300 hidden lg:inline">
                          ({SEVERE_TYPES.find(d => d.qn === selectedDisease)?.label})
                        </span>
                      )}
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30 hidden sm:block" onMouseDown={(e) => startResize('hospital', e)} />
                    </th>
                    <th className="px-1 sm:px-2 py-1 text-center text-white font-semibold text-xs whitespace-nowrap relative">
                      <span className="lg:hidden">포화도</span>
                      <span className="hidden lg:inline">병상포화도</span>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30 hidden sm:block" onMouseDown={(e) => startResize('occupancy', e)} />
                    </th>
                    <th className="px-1 sm:px-2 py-1 text-center text-white font-semibold text-xs whitespace-nowrap relative">
                      <span className="lg:hidden">재실</span>
                      <span className="hidden lg:inline">재실인원</span>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30 hidden sm:block" onMouseDown={(e) => startResize('count', e)} />
                    </th>
                    <th className="px-1 sm:px-2 py-1 text-center text-white font-semibold text-xs whitespace-nowrap relative">
                      <span className="lg:hidden">일반</span>
                      <span className="hidden lg:inline">일반병상</span>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30 hidden sm:block" onMouseDown={(e) => startResize('general', e)} />
                    </th>
                    <th className="hidden sm:table-cell px-1 lg:px-2 py-1 text-center text-white font-semibold text-xs whitespace-nowrap relative">
                      <span className="lg:hidden">코</span>
                      <span className="hidden lg:inline">코호트</span>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30" onMouseDown={(e) => startResize('cohort', e)} />
                    </th>
                    <th className="hidden sm:table-cell px-1 lg:px-2 py-1 text-center text-white font-semibold text-xs whitespace-nowrap relative">
                      <span className="lg:hidden">음압</span>
                      <span className="hidden lg:inline">음압격리</span>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30" onMouseDown={(e) => startResize('negative', e)} />
                    </th>
                    <th className="hidden sm:table-cell px-1 lg:px-2 py-1 text-center text-white font-semibold text-xs whitespace-nowrap relative">
                      <span className="lg:hidden">일격</span>
                      <span className="hidden lg:inline">일반격리</span>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30" onMouseDown={(e) => startResize('isolation', e)} />
                    </th>
                    <th className="hidden sm:table-cell px-1 lg:px-2 py-1 text-center text-white font-semibold text-xs whitespace-nowrap relative">
                      소아
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30" onMouseDown={(e) => startResize('pediatric', e)} />
                    </th>
                    <th className="hidden sm:table-cell px-1 lg:px-2 py-1 text-center text-white font-semibold text-xs whitespace-nowrap relative">
                      <span className="lg:hidden">소음</span>
                      <span className="hidden lg:inline">소아음압</span>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30" onMouseDown={(e) => startResize('pedNegative', e)} />
                    </th>
                    <th className="hidden sm:table-cell px-1 lg:px-2 py-1 text-center text-white font-semibold text-xs whitespace-nowrap relative">
                      <span className="lg:hidden">소일</span>
                      <span className="hidden lg:inline">소아일반</span>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30" onMouseDown={(e) => startResize('pedIsolation', e)} />
                    </th>
                    <th className="px-1 sm:px-2 pr-4 sm:pr-5 py-1 text-center text-white font-semibold text-xs whitespace-nowrap">
                      <span className="lg:hidden">갱신</span>
                      <span className="hidden lg:inline">업데이트</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((hospital, index) => (
                    <HospitalRow
                      key={hospital.hpid}
                      hospital={hospital}
                      isDark={isDark}
                      showGroupDivider={firstNonCenterIndex !== -1 && index === firstNonCenterIndex}
                      isExpanded={expandedMessages.has(hospital.hpid)}
                      onToggle={() => toggleMessage(hospital.hpid)}
                      messages={emergencyMessages.get(hospital.hpid)}
                      messageLoading={messageLoading.get(hospital.hpid)}
                      onFetchMessages={fetchMessages}
                      columnWidths={columnWidths}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 카드 뷰 */}
        {viewMode === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredData.map((hospital, index) => (
              <HospitalCard
                key={hospital.hpid}
                hospital={hospital}
                isDark={isDark}
                showGroupDivider={firstNonCenterIndex !== -1 && index === firstNonCenterIndex}
                isExpanded={expandedMessages.has(hospital.hpid)}
                onToggle={() => toggleMessage(hospital.hpid)}
                messages={emergencyMessages.get(hospital.hpid)}
                messageLoading={messageLoading.get(hospital.hpid)}
                onFetchMessages={fetchMessages}
              />
            ))}
          </div>
        )}

        {/* 데이터 없음 */}
        {!loading && filteredData.length === 0 && (
          <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

// 칼럼 너비 타입
type ColumnWidths = {
  hospital: number;
  occupancy: number;
  count: number;
  general: number;
  cohort: number;
  negative: number;
  isolation: number;
  pediatric: number;
  pedNegative: number;
  pedIsolation: number;
  update: number;
};

interface HospitalRowProps {
  hospital: HospitalBedData;
  isDark: boolean;
  showGroupDivider?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  messages?: ClassifiedMessages | null;
  messageLoading?: boolean;
  onFetchMessages?: (hpid: string) => void;
  columnWidths?: ColumnWidths;
}

function HospitalRow({ hospital, isDark, showGroupDivider = false, isExpanded, onToggle, messages, messageLoading, onFetchMessages, columnWidths }: HospitalRowProps) {
  const isCenter = isCenterHospital({ hpbd: hospital.hpbd, dutyEmclsName: hospital.dutyEmclsName });
  const beds = getBedValues(hospital);
  const orgType = getHospitalOrgType(hospital);
  const shortOrgLabel = orgType === '권역' ? '권' : orgType === '센터' ? '센' : '기';

  // 확장될 때 메시지 조회
  useEffect(() => {
    if (isExpanded && !messages && !messageLoading && onFetchMessages) {
      onFetchMessages(hospital.hpid);
    }
  }, [isExpanded, messages, messageLoading, onFetchMessages, hospital.hpid]);
  const totalOccupancy = calculateTotalOccupancy(hospital);
  const occupancyRate = calculateOccupancyRate(hospital);

  return (
    <>
      <tr
        className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} ${
          isCenter
            ? isDark ? 'bg-amber-900/30 hover:bg-amber-900/50' : 'bg-amber-50 hover:bg-amber-100'
            : isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
        }`}
        style={{
          ...(showGroupDivider ? {
            boxShadow: isDark
              ? 'inset 0 1px 0 rgba(148,163,184,0.35)'
              : 'inset 0 1px 0 rgba(107,114,128,0.35)'
          } : {}),
          ...(hospital.hvidate && isUpdateStale(hospital.hvidate) ? {
            backgroundColor: isDark ? 'rgba(194, 65, 12, 0.4)' : 'rgb(255, 237, 213)',
            borderLeft: '4px solid rgb(249, 115, 22)'
          } : {})
        }}
      >
        {/* 병원명 + 펼치기/접기 버튼 - 좌측 정렬 */}
        <td className={`px-1 sm:px-2 py-1.5 text-sm text-left ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggle}
              className={`px-0.5 text-xs flex-shrink-0 ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
              title={isExpanded ? '접기' : '펼치기'}
            >
              {isExpanded ? '⌄' : '›'}
            </button>
            <OrgTypeBadge
              type={orgType}
              isDark={isDark}
              className="leading-none"
            />
            {/* lg 이하에서 약어 표시, lg 이상에서 전체 이름 */}
            <span className="font-medium whitespace-nowrap lg:hidden" title={hospital.dutyName}>{shortenHospitalName(hospital.dutyName)}</span>
            <span className="font-medium whitespace-nowrap hidden lg:inline" title={hospital.dutyName}>{hospital.dutyName}</span>
          </div>
        </td>

        {/* 병상포화도 */}
        <td className="px-1 sm:px-2 py-1.5 text-center whitespace-nowrap">
          <OccupancyBattery rate={occupancyRate} isDark={isDark} size="large" />
        </td>

        {/* 재실인원 */}
        <td className={`px-1 sm:px-2 py-1.5 text-center text-sm font-medium whitespace-nowrap ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {totalOccupancy}
        </td>

        {/* 일반병상 */}
        <td className={`px-1 sm:px-2 py-1.5 text-center text-sm whitespace-nowrap font-medium ${getBedStatusClass(beds.general.available, beds.general.total, isDark)}`}>
          {renderBedValue(beds.general.available, beds.general.total)}
        </td>

        {/* 코호트 - 모바일 숨김, 좁은 패딩 */}
        <td className={`hidden sm:table-cell px-1 lg:px-2 py-1.5 text-center text-sm whitespace-nowrap font-medium ${getBedStatusClass(beds.cohort.available, beds.cohort.total, isDark)}`}>
          {renderBedValue(beds.cohort.available, beds.cohort.total)}
        </td>

        {/* 음압격리 - 모바일 숨김 */}
        <td className={`hidden sm:table-cell px-1 lg:px-2 py-1.5 text-center text-sm whitespace-nowrap font-medium ${getBedStatusClass(beds.erNegative.available, beds.erNegative.total, isDark)}`}>
          {renderBedValue(beds.erNegative.available, beds.erNegative.total)}
        </td>

        {/* 일반격리 - 모바일 숨김 */}
        <td className={`hidden sm:table-cell px-1 lg:px-2 py-1.5 text-center text-sm whitespace-nowrap font-medium ${getBedStatusClass(beds.erGeneral.available, beds.erGeneral.total, isDark)}`}>
          {renderBedValue(beds.erGeneral.available, beds.erGeneral.total)}
        </td>

        {/* 소아 - 모바일 숨김 */}
        <td className={`hidden sm:table-cell px-1 lg:px-2 py-1.5 text-center text-sm whitespace-nowrap font-medium ${getBedStatusClass(beds.pediatric.available, beds.pediatric.total, isDark)}`}>
          {renderBedValue(beds.pediatric.available, beds.pediatric.total)}
        </td>

        {/* 소아음압 - 모바일 숨김 */}
        <td className={`hidden sm:table-cell px-1 lg:px-2 py-1.5 text-center text-sm whitespace-nowrap font-medium ${getBedStatusClass(beds.pediatricNegative.available, beds.pediatricNegative.total, isDark)}`}>
          {renderBedValue(beds.pediatricNegative.available, beds.pediatricNegative.total)}
        </td>

        {/* 소아일반 - 모바일 숨김 */}
        <td className={`hidden sm:table-cell px-1 lg:px-2 py-1.5 text-center text-sm whitespace-nowrap font-medium ${getBedStatusClass(beds.pediatricGeneral.available, beds.pediatricGeneral.total, isDark)}`}>
          {renderBedValue(beds.pediatricGeneral.available, beds.pediatricGeneral.total)}
        </td>

        {/* 업데이트 시간 - 너비 유지, 30분 초과시 강조 */}
        <td className={`px-1 sm:px-2 pr-4 sm:pr-5 py-1.5 text-center text-[10px] whitespace-nowrap ${
          hospital.hvidate && isUpdateStale(hospital.hvidate)
            ? 'text-orange-500 font-medium'
            : isDark ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {hospital.hvidate ? formatDateWithDay(hospital.hvidate) : '-'}
        </td>
      </tr>
      {/* 메시지 행 */}
      {isExpanded && (
        <tr className={isDark ? 'bg-gray-900' : 'bg-gray-100'}>
          <td colSpan={11} className={`px-4 py-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            <div className="space-y-1">
              {/* 메시지 로딩 */}
              {messageLoading && (
                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  메시지 로드 중...
                </div>
              )}

              {/* 응급실 메시지 - 키워드 하이라이트 */}
              {messages && messages.emergency.length > 0 && (
                <div className="space-y-1">
                  {messages.emergency.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-slate-700/50 text-gray-200 border-slate-600' : 'bg-gray-100 text-gray-700 border-gray-300'} border`}
                    >
                      <HighlightedMessage message={msg.msg} />
                    </div>
                  ))}
                </div>
              )}

              {/* 중증질환 메시지 - 키워드 하이라이트 */}
              {messages && messages.allDiseases.length > 0 && (
                <div className="space-y-1">
                  {messages.allDiseases.map((disease, idx) => (
                    <div
                      key={idx}
                      className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-slate-700/50 text-gray-200 border-slate-600' : 'bg-gray-100 text-gray-700 border-gray-300'} border`}
                    >
                      <span className="text-orange-400 font-semibold">{disease.displayName}:</span>
                      <span className="ml-1"><HighlightedMessage message={disease.content} /></span>
                    </div>
                  ))}
                </div>
              )}

              {/* 메시지 없음 */}
              {messages && messages.emergency.length === 0 && messages.allDiseases.length === 0 && (
                <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  등록된 메시지가 없습니다.
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// 카드 뷰 컴포넌트
interface HospitalCardProps {
  hospital: HospitalBedData;
  isDark: boolean;
  showGroupDivider?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  messages?: ClassifiedMessages | null;
  messageLoading?: boolean;
  onFetchMessages?: (hpid: string) => void;
}

function HospitalCard({ hospital, isDark, showGroupDivider = false, isExpanded, onToggle, messages, messageLoading, onFetchMessages }: HospitalCardProps) {
  const isCenter = isCenterHospital({ hpbd: hospital.hpbd, dutyEmclsName: hospital.dutyEmclsName });
  const beds = getBedValues(hospital);
  const totalOccupancy = calculateTotalOccupancy(hospital);
  const occupancyRate = calculateOccupancyRate(hospital);
  const orgType = getHospitalOrgType(hospital);
  const shortOrgLabel = orgType === '권역' ? '권' : orgType === '센터' ? '센' : '기';

  // 확장될 때 메시지 조회
  useEffect(() => {
    if (isExpanded && !messages && !messageLoading && onFetchMessages) {
      onFetchMessages(hospital.hpid);
    }
  }, [isExpanded, messages, messageLoading, onFetchMessages, hospital.hpid]);

  return (
    <div
      className={`border rounded-lg overflow-hidden shadow-sm ${
        isCenter
          ? isDark ? 'bg-amber-900/30 border-amber-700' : 'bg-amber-50 border-amber-200 border-l-4 border-l-[#4A5D5D]'
          : isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}
      style={{
        ...(showGroupDivider ? {
          boxShadow: isDark
            ? 'inset 0 1px 0 rgba(148,163,184,0.35)'
            : 'inset 0 1px 0 rgba(107,114,128,0.35)'
        } : {}),
        ...(hospital.hvidate && isUpdateStale(hospital.hvidate) ? {
          backgroundColor: isDark ? 'rgba(194, 65, 12, 0.4)' : 'rgb(255, 237, 213)',
          borderLeft: '4px solid rgb(249, 115, 22)'
        } : {})
      }}
    >
      {/* 헤더 */}
      <div className={`px-4 py-3 ${isDark ? 'border-gray-700' : 'border-gray-200'} border-b`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className={`text-xs ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {isExpanded ? '⌄' : '›'}
            </button>
            <OrgTypeBadge
              type={orgType}
              isDark={isDark}
              className="leading-none"
            />
            <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <span className="sm:hidden">{shortenHospitalName(hospital.dutyName)}</span>
              <span className="hidden sm:inline">{hospital.dutyName}</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{totalOccupancy}명</span>
            <OccupancyBattery rate={occupancyRate} isDark={isDark} size="large" />
          </div>
        </div>
        {isCenter && (
          <span className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
            {hospital.dutyEmclsName}
          </span>
        )}
      </div>

      {/* 병상 정보 */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-5 gap-2 text-xs">
          <div className="text-center">
            <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>일반</div>
            <div className={`font-semibold ${getBedStatusClass(beds.general.available, beds.general.total, isDark)}`}>
              {renderBedValue(beds.general.available, beds.general.total)}
            </div>
          </div>
          <div className="text-center">
            <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>코호트</div>
            <div className={`font-semibold ${getBedStatusClass(beds.cohort.available, beds.cohort.total, isDark)}`}>
              {renderBedValue(beds.cohort.available, beds.cohort.total)}
            </div>
          </div>
          <div className="text-center">
            <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>음압</div>
            <div className={`font-semibold ${getBedStatusClass(beds.erNegative.available, beds.erNegative.total, isDark)}`}>
              {renderBedValue(beds.erNegative.available, beds.erNegative.total)}
            </div>
          </div>
          <div className="text-center">
            <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>일반격리</div>
            <div className={`font-semibold ${getBedStatusClass(beds.erGeneral.available, beds.erGeneral.total, isDark)}`}>
              {renderBedValue(beds.erGeneral.available, beds.erGeneral.total)}
            </div>
          </div>
          <div className="text-center">
            <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>소아</div>
            <div className={`font-semibold ${getBedStatusClass(beds.pediatric.available, beds.pediatric.total, isDark)}`}>
              {renderBedValue(beds.pediatric.available, beds.pediatric.total)}
            </div>
          </div>
        </div>
      </div>

      {/* 업데이트 시간 - 30분 초과시 강조 */}
      <div className={`px-4 py-2 text-xs ${
        hospital.hvidate && isUpdateStale(hospital.hvidate)
          ? (isDark ? 'bg-gray-900 text-orange-500 font-medium' : 'bg-gray-50 text-orange-600 font-medium')
          : (isDark ? 'bg-gray-900 text-gray-400' : 'bg-gray-50 text-gray-500')
      }`}>
        업데이트: {hospital.hvidate ? formatDateWithDay(hospital.hvidate) : '-'}
      </div>

      {/* 확장 정보 */}
      {isExpanded && (
        <div className={`px-4 py-2 text-xs space-y-1 ${isDark ? 'bg-gray-900 border-t border-gray-700' : 'bg-gray-100 border-t border-gray-200'}`}>
          {/* 메시지 로딩 */}
          {messageLoading && (
            <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>
              메시지 로드 중...
            </div>
          )}

          {/* 응급실 메시지 - 키워드 하이라이트 */}
          {messages && messages.emergency.length > 0 && (
            <div className="space-y-1">
              {messages.emergency.map((msg, idx) => (
                <div
                  key={idx}
                  className={`px-2 py-1 rounded ${isDark ? 'bg-slate-700/50 text-gray-200 border-slate-600' : 'bg-gray-100 text-gray-700 border-gray-300'} border`}
                >
                  <HighlightedMessage message={msg.msg} />
                </div>
              ))}
            </div>
          )}

          {/* 중증질환 메시지 - 키워드 하이라이트 */}
          {messages && messages.allDiseases.length > 0 && (
            <div className="space-y-1">
              {messages.allDiseases.map((disease, idx) => (
                <div
                  key={idx}
                  className={`px-2 py-1 rounded ${isDark ? 'bg-slate-700/50 text-gray-200 border-slate-600' : 'bg-gray-100 text-gray-700 border-gray-300'} border`}
                >
                  <span className="text-orange-400 font-semibold">{disease.displayName}:</span>
                  <span className="ml-1"><HighlightedMessage message={disease.content} /></span>
                </div>
              ))}
            </div>
          )}

          {/* 메시지 없음 */}
          {messages && messages.emergency.length === 0 && messages.allDiseases.length === 0 && (
            <div className={isDark ? 'text-gray-500' : 'text-gray-400'}>
              등록된 메시지가 없습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
