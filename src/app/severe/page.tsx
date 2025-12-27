'use client';

/**
 * 중증응급질환 수용가능 현황 페이지
 * 원본: dger-api/public/27severe.html
 */

import { useState, useEffect, useCallback } from 'react';
import { useSevereData, DiseaseStats, HospitalSevereData } from '@/lib/hooks/useSevereData';
import { REGIONS } from '@/lib/constants/dger';
import { mapSidoName } from '@/lib/utils/regionMapping';

export default function SeverePage() {
  const [selectedRegion, setSelectedRegion] = useState('대구');
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [expandedSection, setExpandedSection] = useState<Record<number, string>>({});

  const { loading, error, diseaseStats, fetchSevereData, clearCache } = useSevereData();

  useEffect(() => {
    // 저장된 지역 설정 불러오기
    const savedRegion = localStorage.getItem('severe_region');
    if (savedRegion) {
      setSelectedRegion(savedRegion);
    }
  }, []);

  useEffect(() => {
    const mappedRegion = mapSidoName(selectedRegion);
    fetchSevereData(mappedRegion);
  }, [selectedRegion, fetchSevereData]);

  const handleRegionChange = useCallback((region: string) => {
    setSelectedRegion(region);
    localStorage.setItem('severe_region', region);
    setExpandedCards(new Set());
    setExpandedSection({});
  }, []);

  const handleRefresh = useCallback(() => {
    clearCache();
    const mappedRegion = mapSidoName(selectedRegion);
    fetchSevereData(mappedRegion);
  }, [selectedRegion, clearCache, fetchSevereData]);

  const toggleAllCards = useCallback(() => {
    if (expandedCards.size === diseaseStats.length) {
      setExpandedCards(new Set());
      setExpandedSection({});
    } else {
      setExpandedCards(new Set(diseaseStats.map(s => s.qn)));
    }
  }, [expandedCards.size, diseaseStats]);

  const toggleSection = useCallback((qn: number, section: string) => {
    setExpandedSection(prev => {
      if (prev[qn] === section) {
        const next = { ...prev };
        delete next[qn];
        return next;
      }
      return { ...prev, [qn]: section };
    });

    setExpandedCards(prev => {
      const next = new Set(prev);
      if (expandedSection[qn] === section) {
        next.delete(qn);
      } else {
        next.add(qn);
      }
      return next;
    });
  }, [expandedSection]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* 컨트롤 섹션 */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="regionSelect" className="sr-only">지역 선택</label>
            <select
              id="regionSelect"
              value={selectedRegion}
              onChange={(e) => handleRegionChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0a3a82]"
            >
              {REGIONS.map(region => (
                <option key={region.value} value={region.value}>
                  {region.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleAllCards}
              className="px-4 py-2 bg-[#0a3a82] text-white rounded-md text-sm hover:bg-[#0c4ba0] transition-colors"
            >
              {expandedCards.size === diseaseStats.length ? '전체 접기' : '전체 펼치기'}
            </button>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-[#0a3a82] text-white rounded-md text-sm hover:bg-[#0c4ba0] transition-colors"
            >
              새로고침
            </button>
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

        {/* 질환별 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {diseaseStats.map(stat => (
            <DiseaseCard
              key={stat.qn}
              stat={stat}
              isExpanded={expandedCards.has(stat.qn)}
              expandedSection={expandedSection[stat.qn]}
              onToggleSection={(section) => toggleSection(stat.qn, section)}
            />
          ))}
        </div>

        {/* 데이터 없음 */}
        {!loading && diseaseStats.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            데이터가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

interface DiseaseCardProps {
  stat: DiseaseStats;
  isExpanded: boolean;
  expandedSection?: string;
  onToggleSection: (section: string) => void;
}

function DiseaseCard({ stat, isExpanded, expandedSection, onToggleSection }: DiseaseCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200 flex-shrink-0">
            {stat.qn}
          </span>
          <span className="font-semibold text-sm text-gray-900 truncate" title={stat.label}>
            {stat.label}
          </span>
        </div>

        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={() => onToggleSection('available')}
            className={`flex items-center gap-1 text-sm px-2 py-1 rounded transition-colors ${
              expandedSection === 'available' ? 'bg-green-100' : 'hover:bg-gray-100'
            } text-green-700`}
          >
            <span className="font-medium text-xs">가능</span>
            <span className="font-bold">{stat.available}</span>
          </button>
          <button
            onClick={() => onToggleSection('unavailable')}
            className={`flex items-center gap-1 text-sm px-2 py-1 rounded transition-colors ${
              expandedSection === 'unavailable' ? 'bg-red-100' : 'hover:bg-gray-100'
            } text-red-700`}
          >
            <span className="font-medium text-xs">불가</span>
            <span className="font-bold">{stat.unavailable}</span>
          </button>
          <button
            onClick={() => onToggleSection('noInfo')}
            className={`flex items-center gap-1 text-sm px-2 py-1 rounded transition-colors ${
              expandedSection === 'noInfo' ? 'bg-gray-200' : 'hover:bg-gray-100'
            } text-gray-600`}
          >
            <span className="font-medium text-xs">미참여</span>
            <span className="font-bold">{stat.noInfo}</span>
          </button>
        </div>
      </div>

      {/* 병원 리스트 */}
      {isExpanded && expandedSection && (
        <HospitalList
          section={expandedSection}
          availableHospitals={stat.availableHospitals}
          unavailableHospitals={stat.unavailableHospitals}
          noInfoHospitals={stat.noInfoHospitals}
        />
      )}
    </div>
  );
}

interface HospitalListProps {
  section: string;
  availableHospitals: HospitalSevereData[];
  unavailableHospitals: HospitalSevereData[];
  noInfoHospitals: HospitalSevereData[];
}

function HospitalList({ section, availableHospitals, unavailableHospitals, noInfoHospitals }: HospitalListProps) {
  let hospitals: HospitalSevereData[] = [];
  let title = '';
  let statusClass = '';
  let statusText = '';

  switch (section) {
    case 'available':
      hospitals = availableHospitals;
      title = '수용가능 병원';
      statusClass = 'bg-green-50 text-green-700';
      statusText = '수용가능';
      break;
    case 'unavailable':
      hospitals = unavailableHospitals;
      title = '수용불가 병원';
      statusClass = 'bg-red-50 text-red-700';
      statusText = '불가';
      break;
    case 'noInfo':
      hospitals = noInfoHospitals;
      title = '미참여 병원';
      statusClass = 'bg-gray-50 text-gray-600';
      statusText = '미참여';
      break;
  }

  if (hospitals.length === 0) {
    return (
      <div className="border-t border-gray-200 p-4 text-center text-gray-500 text-sm">
        병원 정보가 없습니다.
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 max-h-64 overflow-y-auto">
      <div className="sticky top-0 bg-gray-50 px-4 py-2 border-b border-gray-200 font-semibold text-sm text-gray-700">
        {title}
      </div>
      {hospitals.map(hospital => (
        <div
          key={hospital.hpid}
          className="flex justify-between items-center px-4 py-2 border-b border-gray-100 last:border-b-0 text-sm"
        >
          <span className="text-gray-700 flex-1">
            {hospital.dutyName}
            <span className="text-gray-400 ml-2">
              {hospital.hvec > 0 ? `${hospital.hvec}명` : ''}
            </span>
          </span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}>
            {statusText}
          </span>
        </div>
      ))}
    </div>
  );
}
