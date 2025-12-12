'use client';

/**
 * 병상 현황 페이지
 * 원본: dger-api/public/index.html
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useBedData, HospitalBedData } from '@/lib/hooks/useBedData';
import { REGIONS } from '@/lib/constants/dger';
import { mapSidoName } from '@/lib/utils/regionMapping';

type BedType = 'general' | 'cohort' | 'erNegative' | 'erGeneral' | 'pediatric' | 'pediatricNegative' | 'pediatricGeneral';

const BED_TYPE_CONFIG: Record<BedType, { label: string; availableKey: keyof HospitalBedData; totalKey: keyof HospitalBedData }> = {
  general: { label: '일반', availableKey: 'hvec', totalKey: 'hvs01' },
  cohort: { label: '코호트', availableKey: 'hv27', totalKey: 'HVS59' },
  erNegative: { label: '음압격리', availableKey: 'hv29', totalKey: 'HVS03' },
  erGeneral: { label: '일반격리', availableKey: 'hv30', totalKey: 'HVS04' },
  pediatric: { label: '소아', availableKey: 'hv28', totalKey: 'HVS02' },
  pediatricNegative: { label: '소아음압', availableKey: 'hv15', totalKey: 'HVS48' },
  pediatricGeneral: { label: '소아격리', availableKey: 'hv16', totalKey: 'HVS49' }
};

export default function BedPage() {
  const [selectedRegion, setSelectedRegion] = useState('대구');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCenterOnly, setShowCenterOnly] = useState(false);
  const [selectedBedTypes, setSelectedBedTypes] = useState<Set<BedType>>(new Set(['general']));

  const { loading, error, data, lastUpdate, fetchBedData, clearCache } = useBedData();

  useEffect(() => {
    const savedRegion = localStorage.getItem('bed_region');
    if (savedRegion) {
      setSelectedRegion(savedRegion);
    }
  }, []);

  useEffect(() => {
    const mappedRegion = mapSidoName(selectedRegion);
    fetchBedData(mappedRegion);
  }, [selectedRegion, fetchBedData]);

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

  const handleRefresh = useCallback(() => {
    clearCache();
    const mappedRegion = mapSidoName(selectedRegion);
    fetchBedData(mappedRegion, true);
  }, [selectedRegion, clearCache, fetchBedData]);

  const toggleBedType = useCallback((type: BedType) => {
    setSelectedBedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) {
          next.delete(type);
        }
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const filteredData = useMemo(() => {
    let filtered = data;

    // 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(h => h.dutyName.toLowerCase().includes(term));
    }

    // 센터급만 필터
    if (showCenterOnly) {
      const centerTypes = ['권역응급의료센터', '지역응급의료센터', '전문응급의료센터'];
      filtered = filtered.filter(h => centerTypes.includes(h.dutyEmclsName));
    }

    return filtered;
  }, [data, searchTerm, showCenterOnly]);

  const summary = useMemo(() => {
    const total = filteredData.reduce((sum, h) => sum + h.hvs01, 0);
    const available = filteredData.reduce((sum, h) => sum + h.hvec, 0);
    const occupancy = total - available;
    const rate = total > 0 ? Math.round((occupancy / total) * 100) : 0;

    return { total, available, occupancy, rate };
  }, [filteredData]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto px-4 py-4">
        {/* 컨트롤 섹션 */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          {/* 지역 선택 */}
          <div className="flex items-center gap-2">
            <label htmlFor="regionSelect" className="text-sm text-gray-600 font-medium">지역</label>
            <select
              id="regionSelect"
              value={selectedRegion}
              onChange={(e) => handleRegionChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0a3a82] h-9"
            >
              {REGIONS.map(region => (
                <option key={region.value} value={region.value}>
                  {region.label}
                </option>
              ))}
            </select>
          </div>

          {/* 병상 유형 선택 */}
          <div className="flex items-center gap-1">
            {Object.entries(BED_TYPE_CONFIG).map(([type, config]) => (
              <button
                key={type}
                onClick={() => toggleBedType(type as BedType)}
                className={`px-3 py-2 text-sm rounded-md border transition-colors h-9 ${
                  selectedBedTypes.has(type as BedType)
                    ? 'bg-[#0a3a82] text-white border-[#0a3a82]'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-[#0a3a82]'
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>

          {/* 센터급만 필터 */}
          <button
            onClick={() => setShowCenterOnly(!showCenterOnly)}
            className={`px-3 py-2 text-sm rounded-md border transition-colors h-9 ${
              showCenterOnly
                ? 'bg-[#0a3a82] text-white border-[#0a3a82]'
                : 'bg-white text-gray-700 border-gray-300 hover:border-[#0a3a82]'
            }`}
          >
            센터급만
          </button>

          {/* 검색 */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="병원명 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0a3a82] h-9 w-40"
            />
          </div>

          {/* 새로고침 버튼 */}
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-[#0a3a82] text-white rounded-md text-sm hover:bg-[#0c4ba0] transition-colors h-9"
          >
            새로고침
          </button>

          {/* 마지막 업데이트 시간 */}
          {lastUpdate && (
            <span className="text-xs text-gray-500 ml-auto">
              {lastUpdate.toLocaleTimeString('ko-KR')} 기준
            </span>
          )}
        </div>

        {/* 요약 정보 */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{filteredData.length}</div>
            <div className="text-sm text-gray-500">병원 수</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
            <div className="text-sm text-gray-500">총 병상</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{summary.available}</div>
            <div className="text-sm text-gray-500">가용 병상</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className={`text-2xl font-bold ${
              summary.rate > 90 ? 'text-red-600' : summary.rate > 70 ? 'text-amber-600' : 'text-green-600'
            }`}>
              {summary.rate}%
            </div>
            <div className="text-sm text-gray-500">점유율</div>
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="fixed inset-0 bg-white/90 flex items-center justify-center z-50">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-[#0a3a82] rounded-full animate-spin"></div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
        )}

        {/* 병상 테이블 */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-[#0a3a82]">
                <tr>
                  <th className="px-3 py-3 text-left text-white font-semibold text-sm whitespace-nowrap">병원명</th>
                  <th className="px-3 py-3 text-left text-white font-semibold text-sm whitespace-nowrap">유형</th>
                  {Array.from(selectedBedTypes).map(type => (
                    <th key={type} className="px-3 py-3 text-center text-white font-semibold text-sm whitespace-nowrap">
                      {BED_TYPE_CONFIG[type].label}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-white font-semibold text-sm whitespace-nowrap">재실</th>
                  <th className="px-3 py-3 text-center text-white font-semibold text-sm whitespace-nowrap">점유율</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(hospital => (
                  <HospitalRow
                    key={hospital.hpid}
                    hospital={hospital}
                    selectedBedTypes={selectedBedTypes}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 데이터 없음 */}
        {!loading && filteredData.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            데이터가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

interface HospitalRowProps {
  hospital: HospitalBedData;
  selectedBedTypes: Set<BedType>;
}

function HospitalRow({ hospital, selectedBedTypes }: HospitalRowProps) {
  const centerTypes = ['권역응급의료센터', '지역응급의료센터', '전문응급의료센터'];
  const isCenter = centerTypes.includes(hospital.dutyEmclsName);

  const getStatusColor = (available: number, total: number) => {
    if (total === 0) return 'text-gray-400';
    const rate = (available / total) * 100;
    if (rate <= 5) return 'text-red-600 font-bold';
    if (rate <= 40) return 'text-amber-600 font-bold';
    return 'text-green-600 font-bold';
  };

  return (
    <tr className={`border-t border-gray-200 hover:bg-gray-50 ${isCenter ? 'bg-amber-50 hover:bg-amber-100' : ''}`}>
      <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
        {hospital.dutyName}
      </td>
      <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">
        {hospital.dutyEmclsName}
      </td>
      {Array.from(selectedBedTypes).map(type => {
        const config = BED_TYPE_CONFIG[type];
        const available = hospital[config.availableKey] as number;
        const total = hospital[config.totalKey] as number;

        return (
          <td key={type} className="px-3 py-2 text-center whitespace-nowrap">
            <span className={`text-sm ${getStatusColor(available, total)}`}>
              {available}
            </span>
            <span className="text-gray-400 text-xs">/{total}</span>
          </td>
        );
      })}
      <td className="px-3 py-2 text-center text-sm font-medium text-gray-900 whitespace-nowrap">
        {hospital.occupancy}명
      </td>
      <td className="px-3 py-2 text-center whitespace-nowrap">
        <OccupancyBattery rate={hospital.occupancyRate} />
      </td>
    </tr>
  );
}

interface OccupancyBatteryProps {
  rate: number;
}

function OccupancyBattery({ rate }: OccupancyBatteryProps) {
  const fillWidth = Math.min(100, Math.max(0, rate));
  const fillClass = rate > 90 ? 'bg-red-500' : rate > 70 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="inline-flex items-center justify-center">
      <div className="relative w-12 h-6 border-2 border-gray-300 rounded bg-transparent flex items-center justify-center">
        <div
          className={`absolute top-0.5 left-0.5 bottom-0.5 rounded-sm transition-all ${fillClass}`}
          style={{ width: `calc(${fillWidth}% - 4px)` }}
        />
        <span className="relative z-10 text-xs font-semibold text-gray-900">
          {rate}%
        </span>
        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-3 bg-gray-300 rounded-r" />
      </div>
    </div>
  );
}
