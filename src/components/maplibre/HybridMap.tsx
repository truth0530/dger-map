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
import { SEVERE_TYPES } from '@/lib/constants/dger';
import { getCategoryByKey } from '@/lib/constants/diseaseCategories';
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
  selectedDiseaseCategory?: string | null;  // 42개 중증자원조사 대분류 선택
  selectedClassifications: string[];
  hoveredHospitalCode: string | null;
  onHospitalHover?: (code: string | null) => void;
  onHospitalClick?: (hospital: Hospital) => void;
  // SVG 맵 추가 props
  diseaseData: HospitalDiseaseData[];
  selectedDiseases: Set<string>;  // 선택된 소분류 질환명들 (OR 조건)
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
  selectedDiseaseCategory,
  selectedClassifications,
  hoveredHospitalCode,
  onHospitalHover,
  onHospitalClick,
  diseaseData,
  selectedDiseases,
  selectedDay,
  selectedStatus,
  selectedBedTypes,
  onBackToNational,
}: HybridMapProps) {
  const { isDark } = useTheme();
  const [mapLayer, setMapLayer] = useState<MapLayerType>('maptiler');

  // 필터링된 병원 목록 (두 지도에서 공유)
  // NOTE: MapDashboard에서 이미 selectedClassifications로 필터링됨
  // 여기서는 좌표가 있는 병원만 추가로 필터링
  const filteredHospitals = useMemo(() => {
    return hospitals.filter(h => {
      if (!h.lat || !h.lng) return false;
      return true;
    });
  }, [hospitals]);

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
          selectedDiseaseCategory={selectedDiseaseCategory}
          selectedClassifications={selectedClassifications}
          hoveredHospitalCode={hoveredHospitalCode}
          onHospitalHover={onHospitalHover}
          onHospitalClick={onHospitalClick}
          onSwitchToLeaflet={() => setMapLayer('leaflet')}
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
          selectedDiseaseCategory={selectedDiseaseCategory}
          selectedClassifications={selectedClassifications}
          hoveredHospitalCode={hoveredHospitalCode}
          onHospitalHover={onHospitalHover}
          onHospitalClick={onHospitalClick}
          onSwitchToMaptiler={() => setMapLayer('maptiler')}
        />
      )}


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
