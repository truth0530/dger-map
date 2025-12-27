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
import { REGIONS, SEVERE_TYPES } from '@/lib/constants/dger';
import { mapSidoName } from '@/lib/utils/regionMapping';
import { isCenterHospital, shortenHospitalName } from '@/lib/utils/hospitalUtils';
import { formatDateWithDay, formatUpdateTime } from '@/lib/utils/dateUtils';
import { useEmergencyMessages } from '@/lib/hooks/useEmergencyMessages';
import { ClassifiedMessages, parseMessageWithHighlights, getHighlightClass, HighlightedSegment } from '@/lib/utils/messageClassifier';

// 하이라이트된 메시지 렌더링 컴포넌트
function HighlightedMessage({ message }: { message: string }) {
  const segments = parseMessageWithHighlights(message);
  return (
    <>
      {segments.map((segment, idx) => (
        <span key={idx} className={getHighlightClass(segment.type)}>
          {segment.text}
        </span>
      ))}
    </>
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

// 병상 값 계산 헬퍼
function getBedValues(hospital: HospitalBedData) {
  return {
    // 일반병상
    general: {
      available: hospital.hvec || 0,
      total: hospital.hvs01 || 0
    },
    // 코호트
    cohort: {
      available: hospital.hv27 || 0,
      total: hospital.HVS59 || 0
    },
    // 음압격리 (통합: hv29 + hv13 / HVS03 + HVS46)
    erNegative: {
      available: (hospital.hv29 || 0) + (hospital.hv13 || 0),
      total: (hospital.HVS03 || 0) + (hospital.HVS46 || 0)
    },
    // 일반격리 (통합: hv30 + hv14 / HVS04 + HVS47)
    erGeneral: {
      available: (hospital.hv30 || 0) + (hospital.hv14 || 0),
      total: (hospital.HVS04 || 0) + (hospital.HVS47 || 0)
    },
    // 소아
    pediatric: {
      available: hospital.hv28 || 0,
      total: hospital.HVS02 || 0
    },
    // 소아음압
    pediatricNegative: {
      available: hospital.hv15 || 0,
      total: hospital.HVS48 || 0
    },
    // 소아일반
    pediatricGeneral: {
      available: hospital.hv16 || 0,
      total: hospital.HVS49 || 0
    }
  };
}

// 재실인원 계산 (dger-api와 동일)
function calculateTotalOccupancy(hospital: HospitalBedData): number {
  const beds = getBedValues(hospital);

  const generalOccupied = Math.max(0, beds.general.total - beds.general.available);
  const cohortOccupied = Math.max(0, beds.cohort.total - beds.cohort.available);
  const erNegativeOccupied = Math.max(0, beds.erNegative.total - beds.erNegative.available);
  const erGeneralOccupied = Math.max(0, beds.erGeneral.total - beds.erGeneral.available);
  const pediatricOccupied = Math.max(0, beds.pediatric.total - beds.pediatric.available);
  const pediatricNegativeOccupied = Math.max(0, beds.pediatricNegative.total - beds.pediatricNegative.available);
  const pediatricGeneralOccupied = Math.max(0, beds.pediatricGeneral.total - beds.pediatricGeneral.available);

  return generalOccupied + cohortOccupied + erNegativeOccupied + erGeneralOccupied +
         pediatricOccupied + pediatricNegativeOccupied + pediatricGeneralOccupied;
}

// 병상포화도 계산 (dger-api와 동일)
function calculateOccupancyRate(hospital: HospitalBedData): number {
  const beds = getBedValues(hospital);

  const totalBeds = beds.general.total + beds.cohort.total + beds.erNegative.total +
                    beds.erGeneral.total + beds.pediatric.total +
                    beds.pediatricNegative.total + beds.pediatricGeneral.total;

  if (totalBeds === 0) return 0;

  const totalOccupied = calculateTotalOccupancy(hospital);
  return Math.round((totalOccupied / totalBeds) * 100);
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
    const savedRegion = localStorage.getItem('bed_region');
    if (savedRegion) {
      setSelectedRegion(savedRegion);
    }
  }, []);

  useEffect(() => {
    // hospitalTypeMapReady가 true가 되면 데이터를 다시 가져옴
    if (hospitalTypeMapReady) {
      const mappedRegion = mapSidoName(selectedRegion);
      fetchBedData(mappedRegion);
    }
  }, [selectedRegion, fetchBedData, hospitalTypeMapReady]);

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
    localStorage.setItem('bed_region', region);
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

    // 정렬: 센터급 우선, 재실인원 내림차순
    return [...filtered].sort((a, b) => {
      const centerTypes = ['권역응급의료센터', '지역응급의료센터', '전문응급의료센터'];
      const aIsCenter = centerTypes.includes(a.dutyEmclsName);
      const bIsCenter = centerTypes.includes(b.dutyEmclsName);

      if (aIsCenter && !bIsCenter) return -1;
      if (!aIsCenter && bIsCenter) return 1;

      // 같은 급수 내에서는 재실인원 내림차순
      return calculateTotalOccupancy(b) - calculateTotalOccupancy(a);
    });
  }, [data, searchTerm, orgTypes]);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-full mx-auto px-2 py-2">
        {/* 컨트롤 섹션 - dger-api와 동일 */}
        <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1 flex-nowrap">
          {/* 테이블/카드 보기 탭 */}
          <div className="flex items-center flex-shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm rounded-l border h-9 transition-colors whitespace-nowrap ${
                viewMode === 'table'
                  ? 'bg-[#0a3a82] text-white border-[#0a3a82]'
                  : isDark
                    ? 'bg-gray-800 text-gray-300 border-gray-600'
                    : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              테이블 보기
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 text-sm rounded-r border-t border-r border-b h-9 transition-colors whitespace-nowrap ${
                viewMode === 'cards'
                  ? 'bg-[#0a3a82] text-white border-[#0a3a82]'
                  : isDark
                    ? 'bg-gray-800 text-gray-300 border-gray-600'
                    : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              카드 보기
            </button>
          </div>

          {/* 지역 선택 */}
          <select
            value={selectedRegion}
            onChange={(e) => handleRegionChange(e.target.value)}
            className={`px-2 py-1.5 border rounded text-sm h-9 flex-shrink-0 ${
              isDark
                ? 'bg-gray-800 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
            style={{ width: '104px' }}
          >
            {REGIONS.map(region => (
              <option key={region.value} value={region.value}>
                {region.value}
              </option>
            ))}
          </select>

          {/* 병원 유형 필터 - 체크박스 그룹 */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {(Object.keys(orgTypes) as (keyof OrgTypes)[]).map((key) => (
              <label
                key={key}
                className={`px-2.5 py-1.5 text-xs font-medium rounded border-2 cursor-pointer transition-colors flex items-center whitespace-nowrap ${
                  orgTypes[key]
                    ? isDark
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-[#0a3a82] text-white border-[#0a3a82]'
                    : isDark
                      ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                      : 'bg-white text-gray-800 border-gray-400 hover:bg-gray-100'
                }`}
                style={{ height: '32px' }}
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
                {key}
              </label>
            ))}
          </div>

          {/* 검색 */}
          <input
            type="text"
            placeholder="검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`px-2 py-1.5 border rounded text-sm h-9 flex-shrink-0 ${
              isDark
                ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
            style={{ width: '60px' }}
          />

          {/* 27개 중증질환 드롭다운 */}
          <select
            value={selectedDisease}
            onChange={(e) => setSelectedDisease(e.target.value)}
            className={`px-1 py-1.5 border rounded text-sm h-9 min-w-20 max-w-36 flex-shrink ${
              isDark
                ? 'bg-gray-800 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="">질환</option>
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
            {expandedMessages.size > 0 ? '접기' : '펼치기'}
          </button>

          {/* 마지막 업데이트 시간 */}
          {lastUpdate && (() => {
            const updateInfo = formatUpdateTime(lastUpdate.toISOString());
            return (
              <span className={`text-xs ml-auto whitespace-nowrap ${updateInfo.color}`}>
                {updateInfo.text}
              </span>
            );
          })()}
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className={`fixed inset-0 flex items-center justify-center z-50 ${isDark ? 'bg-gray-900/90' : 'bg-white/90'}`}>
            <div className={`w-12 h-12 border-4 border-t-[#0a3a82] rounded-full animate-spin ${isDark ? 'border-gray-700' : 'border-gray-200'}`}></div>
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
            <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
              <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                <thead className={`sticky top-0 z-10 ${isDark ? 'bg-[#111827]' : 'bg-[#0a3a82]'}`}>
                  <tr>
                    <th style={{ width: columnWidths.hospital }} className="px-3 py-2 text-left text-white font-semibold text-sm whitespace-nowrap relative">
                      병원명
                      {selectedDisease && (
                        <span className="ml-2 font-normal text-xs text-orange-300">
                          ({SEVERE_TYPES.find(d => d.qn === selectedDisease)?.label})
                        </span>
                      )}
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30" onMouseDown={(e) => startResize('hospital', e)} />
                    </th>
                    <th style={{ width: columnWidths.occupancy }} className="px-3 py-2 text-center text-white font-semibold text-sm whitespace-nowrap relative">
                      병상포화도
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30" onMouseDown={(e) => startResize('occupancy', e)} />
                    </th>
                    <th style={{ width: columnWidths.count }} className="px-3 py-2 text-center text-white font-semibold text-sm whitespace-nowrap relative">
                      재실인원
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30" onMouseDown={(e) => startResize('count', e)} />
                    </th>
                    <th style={{ width: columnWidths.general }} className="px-3 py-2 text-center text-white font-semibold text-sm whitespace-nowrap relative">
                      일반병상
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30" onMouseDown={(e) => startResize('general', e)} />
                    </th>
                    <th style={{ width: columnWidths.cohort }} className="px-3 py-2 text-center text-white font-semibold text-sm whitespace-nowrap relative">
                      코호트
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30" onMouseDown={(e) => startResize('cohort', e)} />
                    </th>
                    <th style={{ width: columnWidths.negative }} className="px-3 py-2 text-center text-white font-semibold text-sm whitespace-nowrap relative">
                      음압격리
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30" onMouseDown={(e) => startResize('negative', e)} />
                    </th>
                    <th style={{ width: columnWidths.isolation }} className="px-3 py-2 text-center text-white font-semibold text-sm whitespace-nowrap relative">
                      일반격리
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30" onMouseDown={(e) => startResize('isolation', e)} />
                    </th>
                    <th style={{ width: columnWidths.pediatric }} className="px-3 py-2 text-center text-white font-semibold text-sm whitespace-nowrap relative">
                      소아
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30" onMouseDown={(e) => startResize('pediatric', e)} />
                    </th>
                    <th style={{ width: columnWidths.pedNegative }} className="px-3 py-2 text-center text-white font-semibold text-sm whitespace-nowrap relative">
                      소아음압
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30" onMouseDown={(e) => startResize('pedNegative', e)} />
                    </th>
                    <th style={{ width: columnWidths.pedIsolation }} className="px-3 py-2 text-center text-white font-semibold text-sm whitespace-nowrap relative">
                      소아일반
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/30" onMouseDown={(e) => startResize('pedIsolation', e)} />
                    </th>
                    <th style={{ width: columnWidths.update }} className="px-3 py-2 text-center text-white font-semibold text-sm whitespace-nowrap">
                      업데이트
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map(hospital => (
                    <HospitalRow
                      key={hospital.hpid}
                      hospital={hospital}
                      isDark={isDark}
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
            {filteredData.map(hospital => (
              <HospitalCard
                key={hospital.hpid}
                hospital={hospital}
                isDark={isDark}
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
  isExpanded: boolean;
  onToggle: () => void;
  messages?: ClassifiedMessages | null;
  messageLoading?: boolean;
  onFetchMessages?: (hpid: string) => void;
  columnWidths?: ColumnWidths;
}

function HospitalRow({ hospital, isDark, isExpanded, onToggle, messages, messageLoading, onFetchMessages, columnWidths }: HospitalRowProps) {
  const isCenter = isCenterHospital({ dutyEmclsName: hospital.dutyEmclsName });
  const beds = getBedValues(hospital);

  // 확장될 때 메시지 조회
  useEffect(() => {
    if (isExpanded && !messages && !messageLoading && onFetchMessages) {
      onFetchMessages(hospital.hpid);
    }
  }, [isExpanded, messages, messageLoading, onFetchMessages, hospital.hpid]);
  const totalOccupancy = calculateTotalOccupancy(hospital);
  const occupancyRate = calculateOccupancyRate(hospital);

  // 병상 상태 색상 (dger-api와 동일)
  const getBedStatusClass = (available: number, total: number) => {
    if (total === 0) return isDark ? 'text-gray-500' : 'text-gray-400';
    const percentage = (available / total) * 100;
    if (percentage <= 5) return isDark ? 'text-red-400' : 'text-red-600';
    if (percentage <= 40) return isDark ? 'text-yellow-400' : 'text-yellow-600';
    return isDark ? 'text-green-400' : 'text-green-600';
  };

  // 병상 값 렌더링 (가용/총계, 총계가 0이면 -)
  const renderBedValue = (available: number, total: number) => {
    if (total === 0) return '-';
    return `${available}/${total}`;
  };

  return (
    <>
      <tr className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} ${
        isCenter
          ? isDark ? 'bg-amber-900/30 hover:bg-amber-900/50' : 'bg-amber-50 hover:bg-amber-100'
          : isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
      }`}>
        {/* 병원명 + 펼치기/접기 버튼 */}
        <td style={columnWidths ? { width: columnWidths.hospital } : undefined} className={`px-3 py-2 text-sm overflow-hidden text-ellipsis ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggle}
              className={`px-1 text-xs flex-shrink-0 ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
              title={isExpanded ? '접기' : '펼치기'}
            >
              {isExpanded ? '⌄' : '›'}
            </button>
            <span className="font-medium truncate">{hospital.dutyName}</span>
          </div>
        </td>

        {/* 병상포화도 */}
        <td style={columnWidths ? { width: columnWidths.occupancy } : undefined} className="px-3 py-2 text-center whitespace-nowrap">
          <OccupancyBattery rate={occupancyRate} isDark={isDark} />
        </td>

        {/* 재실인원 */}
        <td style={columnWidths ? { width: columnWidths.count } : undefined} className={`px-3 py-2 text-center text-sm font-medium whitespace-nowrap ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {totalOccupancy}
        </td>

        {/* 일반병상 */}
        <td style={columnWidths ? { width: columnWidths.general } : undefined} className={`px-3 py-2 text-center text-sm whitespace-nowrap font-medium ${getBedStatusClass(beds.general.available, beds.general.total)}`}>
          {renderBedValue(beds.general.available, beds.general.total)}
        </td>

        {/* 코호트 */}
        <td style={columnWidths ? { width: columnWidths.cohort } : undefined} className={`px-3 py-2 text-center text-sm whitespace-nowrap font-medium ${getBedStatusClass(beds.cohort.available, beds.cohort.total)}`}>
          {renderBedValue(beds.cohort.available, beds.cohort.total)}
        </td>

        {/* 음압격리 */}
        <td style={columnWidths ? { width: columnWidths.negative } : undefined} className={`px-3 py-2 text-center text-sm whitespace-nowrap font-medium ${getBedStatusClass(beds.erNegative.available, beds.erNegative.total)}`}>
          {renderBedValue(beds.erNegative.available, beds.erNegative.total)}
        </td>

        {/* 일반격리 */}
        <td style={columnWidths ? { width: columnWidths.isolation } : undefined} className={`px-3 py-2 text-center text-sm whitespace-nowrap font-medium ${getBedStatusClass(beds.erGeneral.available, beds.erGeneral.total)}`}>
          {renderBedValue(beds.erGeneral.available, beds.erGeneral.total)}
        </td>

        {/* 소아 */}
        <td style={columnWidths ? { width: columnWidths.pediatric } : undefined} className={`px-3 py-2 text-center text-sm whitespace-nowrap font-medium ${getBedStatusClass(beds.pediatric.available, beds.pediatric.total)}`}>
          {renderBedValue(beds.pediatric.available, beds.pediatric.total)}
        </td>

        {/* 소아음압 */}
        <td style={columnWidths ? { width: columnWidths.pedNegative } : undefined} className={`px-3 py-2 text-center text-sm whitespace-nowrap font-medium ${getBedStatusClass(beds.pediatricNegative.available, beds.pediatricNegative.total)}`}>
          {renderBedValue(beds.pediatricNegative.available, beds.pediatricNegative.total)}
        </td>

        {/* 소아일반 */}
        <td style={columnWidths ? { width: columnWidths.pedIsolation } : undefined} className={`px-3 py-2 text-center text-sm whitespace-nowrap font-medium ${getBedStatusClass(beds.pediatricGeneral.available, beds.pediatricGeneral.total)}`}>
          {renderBedValue(beds.pediatricGeneral.available, beds.pediatricGeneral.total)}
        </td>

        {/* 업데이트 시간 */}
        <td style={columnWidths ? { width: columnWidths.update } : undefined} className={`px-3 py-2 text-center text-xs whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
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
  isExpanded: boolean;
  onToggle: () => void;
  messages?: ClassifiedMessages | null;
  messageLoading?: boolean;
  onFetchMessages?: (hpid: string) => void;
}

function HospitalCard({ hospital, isDark, isExpanded, onToggle, messages, messageLoading, onFetchMessages }: HospitalCardProps) {
  const isCenter = isCenterHospital({ dutyEmclsName: hospital.dutyEmclsName });
  const beds = getBedValues(hospital);
  const totalOccupancy = calculateTotalOccupancy(hospital);
  const occupancyRate = calculateOccupancyRate(hospital);

  // 확장될 때 메시지 조회
  useEffect(() => {
    if (isExpanded && !messages && !messageLoading && onFetchMessages) {
      onFetchMessages(hospital.hpid);
    }
  }, [isExpanded, messages, messageLoading, onFetchMessages, hospital.hpid]);

  const getBedStatusClass = (available: number, total: number) => {
    if (total === 0) return isDark ? 'text-gray-500' : 'text-gray-400';
    const percentage = (available / total) * 100;
    if (percentage <= 5) return isDark ? 'text-red-400' : 'text-red-600';
    if (percentage <= 40) return isDark ? 'text-yellow-400' : 'text-yellow-600';
    return isDark ? 'text-green-400' : 'text-green-600';
  };

  const renderBedValue = (available: number, total: number) => {
    if (total === 0) return '-';
    return `${available}/${total}`;
  };

  return (
    <div className={`border rounded-lg overflow-hidden shadow-sm ${
      isCenter
        ? isDark ? 'bg-amber-900/30 border-amber-700' : 'bg-amber-50 border-amber-200 border-l-4 border-l-[#0a3a82]'
        : isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
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
            <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {hospital.dutyName}
            </h3>
          </div>
          <OccupancyBattery rate={occupancyRate} isDark={isDark} />
        </div>
        {isCenter && (
          <span className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
            {hospital.dutyEmclsName}
          </span>
        )}
      </div>

      {/* 병상 정보 */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>재실</div>
            <div className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{totalOccupancy}</div>
          </div>
          <div className="text-center">
            <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>일반</div>
            <div className={`font-semibold ${getBedStatusClass(beds.general.available, beds.general.total)}`}>
              {renderBedValue(beds.general.available, beds.general.total)}
            </div>
          </div>
          <div className="text-center">
            <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>코호트</div>
            <div className={`font-semibold ${getBedStatusClass(beds.cohort.available, beds.cohort.total)}`}>
              {renderBedValue(beds.cohort.available, beds.cohort.total)}
            </div>
          </div>
          <div className="text-center">
            <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>음압</div>
            <div className={`font-semibold ${getBedStatusClass(beds.erNegative.available, beds.erNegative.total)}`}>
              {renderBedValue(beds.erNegative.available, beds.erNegative.total)}
            </div>
          </div>
          <div className="text-center">
            <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>일반격리</div>
            <div className={`font-semibold ${getBedStatusClass(beds.erGeneral.available, beds.erGeneral.total)}`}>
              {renderBedValue(beds.erGeneral.available, beds.erGeneral.total)}
            </div>
          </div>
          <div className="text-center">
            <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>소아</div>
            <div className={`font-semibold ${getBedStatusClass(beds.pediatric.available, beds.pediatric.total)}`}>
              {renderBedValue(beds.pediatric.available, beds.pediatric.total)}
            </div>
          </div>
        </div>
      </div>

      {/* 업데이트 시간 */}
      <div className={`px-4 py-2 text-xs ${isDark ? 'bg-gray-900 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
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

interface OccupancyBatteryProps {
  rate: number;
  isDark: boolean;
}

function OccupancyBattery({ rate, isDark }: OccupancyBatteryProps) {
  const fillWidth = Math.min(100, Math.max(0, rate));
  const fillClass = rate >= 95 ? 'bg-red-500' : rate >= 60 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="inline-flex items-center justify-center">
      <div className={`relative w-12 h-6 border-2 rounded bg-transparent flex items-center justify-center ${isDark ? 'border-gray-400' : 'border-gray-300'}`}>
        <div
          className={`absolute top-0.5 left-0.5 bottom-0.5 transition-all ${fillClass}`}
          style={{ width: `calc(${fillWidth}% - 4px)`, borderRadius: '2px' }}
        />
        <span className={`relative z-10 text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {rate}%
        </span>
        <div className={`absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-2 ${isDark ? 'bg-gray-500' : 'bg-gray-300'}`} style={{ borderRadius: '1px' }} />
      </div>
    </div>
  );
}
