'use client';

/**
 * MapLibre + Leaflet 하이브리드 지도
 * - MapLibre 레이어 (벡터 타일 기반)
 * - Leaflet 레이어 (OpenStreetMap 기반)
 * - 공유 마커 레이어 (항상 표시)
 * - 토글로 MapLibre/Leaflet 전환
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from '@/lib/contexts/ThemeContext';
import { createMarkerElement } from '@/lib/utils/markerRenderer';
import { Legend } from '@/components/Legend';
import { SEVERE_TYPES } from '@/lib/constants/dger';
import type { Hospital, HospitalDiseaseData, DayOfWeek, AvailabilityStatus } from '@/types';
import type { HospitalBedData } from '@/lib/hooks/useBedData';
import type { HospitalSevereData } from '@/lib/hooks/useSevereData';
import type { ClassifiedMessages } from '@/lib/utils/messageClassifier';
import type { BedType } from '@/lib/constants/bedTypes';

// MapLibre는 클라이언트에서만 로드
const MapLibreMap = dynamic(() => import('@/components/maplibre/MapLibreMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-900">
      <div className="text-gray-400 text-sm">지도 로딩 중...</div>
    </div>
  ),
});

const LeafletMap = dynamic(() => import('@/components/maplibre/LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-900">
      <div className="text-gray-400 text-sm">지도 로딩 중...</div>
    </div>
  ),
});

type SevereTypeKey = typeof SEVERE_TYPES[number]['key'];

interface HybridMapProps {
  hospitals: Hospital[];
  bedDataMap?: Map<string, HospitalBedData>;
  severeDataMap?: Map<string, HospitalSevereData>;
  emergencyMessages?: Map<string, ClassifiedMessages>;
  selectedRegion: string;
  selectedSevereType?: SevereTypeKey | null;
  selectedClassifications: string[];
  hoveredHospitalCode: string | null;
  onHospitalHover?: (code: string | null) => void;
  onHospitalClick?: (hospital: Hospital) => void;
  // SVG 맵 추가 props
  diseaseData: HospitalDiseaseData[];
  selectedDisease: string | null;
  selectedDay: DayOfWeek;
  selectedStatus: AvailabilityStatus[];
  selectedBedTypes?: Set<BedType>;
  onBackToNational: () => void;
}

type MapLayerType = 'maptiler' | 'leaflet';

export default function HybridMap({
  hospitals,
  bedDataMap,
  severeDataMap,
  emergencyMessages,
  selectedRegion,
  selectedSevereType,
  selectedClassifications,
  hoveredHospitalCode,
  onHospitalHover,
  onHospitalClick,
  diseaseData,
  selectedDisease,
  selectedDay,
  selectedStatus,
  selectedBedTypes,
  onBackToNational,
}: HybridMapProps) {
  const { isDark } = useTheme();
  const [mapLayer, setMapLayer] = useState<MapLayerType>('maptiler');

  // 필터링된 병원 목록 (두 지도에서 공유)
  const filteredHospitals = useMemo(() => {
    return hospitals.filter(h => {
      if (!h.lat || !h.lng) return false;
      if (selectedRegion !== 'all' && h.region !== selectedRegion) return false;
      if (selectedClassifications.length > 0 && h.classification) {
        if (!selectedClassifications.includes(h.classification)) return false;
      }
      return true;
    });
  }, [hospitals, selectedRegion, selectedClassifications]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {/* MapLibre 레이어 */}
      {mapLayer === 'maptiler' && (
        <MapLibreMap
          hospitals={filteredHospitals}
          bedDataMap={bedDataMap}
          severeDataMap={severeDataMap}
          emergencyMessages={emergencyMessages}
          selectedRegion={selectedRegion}
          selectedSevereType={selectedSevereType}
          selectedClassifications={selectedClassifications}
          hoveredHospitalCode={hoveredHospitalCode}
          onHospitalHover={onHospitalHover}
          onHospitalClick={onHospitalClick}
        />
      )}

      {/* Leaflet 지도 레이어 */}
      {mapLayer === 'leaflet' && (
        <LeafletMap
          hospitals={filteredHospitals}
          bedDataMap={bedDataMap}
          severeDataMap={severeDataMap}
          emergencyMessages={emergencyMessages}
          selectedRegion={selectedRegion}
          selectedSevereType={selectedSevereType}
          selectedClassifications={selectedClassifications}
          hoveredHospitalCode={hoveredHospitalCode}
          onHospitalHover={onHospitalHover}
          onHospitalClick={onHospitalClick}
        />
      )}

      {/* 범례 - 공통 Legend 컴포넌트 사용 */}
      <div className="absolute bottom-4 left-4 z-50 pointer-events-auto">
        <Legend position="bottom-left" />
      </div>

      {/* 병원 수 표시 */}
      <div className={`absolute top-4 left-4 z-50 backdrop-blur-sm rounded-lg shadow-lg border px-3 py-2 pointer-events-auto ${isDark ? 'bg-gray-900/95 border-gray-700/50' : 'bg-white/95 border-gray-300/50'}`} style={{ top: '1rem', left: '1rem' }}>
        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>병원 </span>
        <span className={`font-semibold text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{filteredHospitals.length}</span>
      </div>

      {/* 레이어 토글 버튼 */}
      <div className={`absolute top-4 right-4 z-50 flex items-center gap-1 rounded-lg shadow-lg border p-1.5 pointer-events-auto ${isDark ? 'bg-gray-800/90 border-gray-700/50' : 'bg-white/90 border-gray-300/50'}`}>
        <button
          onClick={() => setMapLayer('maptiler')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            mapLayer === 'maptiler'
              ? isDark ? 'bg-cyan-600 text-white' : 'bg-cyan-500 text-white'
              : isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-500'
          }`}
          title="MapTiler 지도 보기"
        >
          MapTiler
        </button>
        <div className={`w-px h-5 ${isDark ? 'bg-gray-700/50' : 'bg-gray-400/50'}`} />
        <button
          onClick={() => setMapLayer('leaflet')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            mapLayer === 'leaflet'
              ? isDark ? 'bg-green-600 text-white' : 'bg-green-500 text-white'
              : isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-500'
          }`}
          title="Leaflet 지도 보기"
        >
          Leaflet
        </button>
      </div>

      {/* MapLibre 내부 컨트롤 (Maptiler 레이어일 때만 표시) */}
      {mapLayer === 'maptiler' && (
        <style jsx global>{`
          .maplibregl-ctrl-group {
            background: rgba(31,41,55,0.95) !important;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.1) !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
          }
          .maplibregl-ctrl-group button {
            width: 32px !important;
            height: 32px !important;
          }
          .maplibregl-ctrl-group button + button {
            border-top: 1px solid rgba(255,255,255,0.1) !important;
          }
          .maplibregl-ctrl-icon {
            filter: invert(1) brightness(0.8);
          }
        `}</style>
      )}
    </div>
  );
}
