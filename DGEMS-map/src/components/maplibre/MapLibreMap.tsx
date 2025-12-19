'use client';

/**
 * MapLibre GL JS 기반 지도 컴포넌트
 * - Maptiler 타일 서버 사용
 * - 실제 WGS84 좌표로 병원 위치 표시
 * - 브랜딩 로고 없음
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getStyleUrl, getRegionView, MARKER_COLORS, CLASSIFICATION_MARKERS, MAPTILER_CONFIG } from '@/lib/maplibre/config';
import type { Hospital } from '@/types';
import type { HospitalBedData } from '@/lib/hooks/useBedData';
import type { HospitalSevereData } from '@/lib/hooks/useSevereData';

interface MapLibreMapProps {
  hospitals: Hospital[];
  bedDataMap?: Map<string, HospitalBedData>;
  severeDataMap?: Map<string, HospitalSevereData>;
  selectedRegion: string;
  selectedSevereType?: string | null;
  selectedClassifications: string[];
  hoveredHospitalCode: string | null;
  onHospitalHover?: (code: string | null) => void;
  onHospitalClick?: (hospital: Hospital) => void;
}

export default function MapLibreMap({
  hospitals,
  bedDataMap,
  severeDataMap,
  selectedRegion,
  selectedSevereType,
  selectedClassifications,
  hoveredHospitalCode,
  onHospitalHover,
  onHospitalClick,
}: MapLibreMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // 필터링된 병원 목록
  const filteredHospitals = useMemo(() => {
    return hospitals.filter(h => {
      // 좌표가 없는 병원 제외
      if (!h.lat || !h.lng) return false;

      // 지역 필터
      if (selectedRegion !== 'all' && h.region !== selectedRegion) return false;

      // 기관분류 필터
      if (selectedClassifications.length > 0 && h.classification) {
        if (!selectedClassifications.includes(h.classification)) return false;
      }

      return true;
    });
  }, [hospitals, selectedRegion, selectedClassifications]);

  // 마커 색상 결정
  const getMarkerColor = useCallback((hospital: Hospital): string => {
    // 27개 중증질환 선택 시
    if (selectedSevereType && severeDataMap) {
      const severeData = severeDataMap.get(hospital.code);
      if (severeData) {
        const status = (severeData.severeStatus?.[selectedSevereType] || '').toUpperCase();
        if (status === 'Y') return MARKER_COLORS.available24h;
        if (status === 'N' || status === '불가능') return MARKER_COLORS.unavailable;
      }
      return MARKER_COLORS.unknown;
    }

    // 병상 데이터 기반 색상
    if (bedDataMap) {
      const bedData = bedDataMap.get(hospital.code);
      if (bedData && bedData.hvec !== undefined) {
        if (bedData.hvec > 5) return MARKER_COLORS.available24h;
        if (bedData.hvec > 0) return MARKER_COLORS.availableDay;
        return MARKER_COLORS.unavailable;
      }
    }

    // 기본 색상
    return hospital.hasDiseaseData ? MARKER_COLORS.default : MARKER_COLORS.unknown;
  }, [selectedSevereType, severeDataMap, bedDataMap]);

  // 마커 크기 결정
  const getMarkerSize = useCallback((hospital: Hospital, isHovered: boolean): number => {
    const baseConfig = CLASSIFICATION_MARKERS[hospital.classification || '지역응급의료기관']
      || CLASSIFICATION_MARKERS['지역응급의료기관'];

    return isHovered ? baseConfig.size * 1.5 : baseConfig.size;
  }, []);

  // 마커 HTML 생성
  const createMarkerElement = useCallback((hospital: Hospital, isHovered: boolean): HTMLElement => {
    const el = document.createElement('div');
    const color = getMarkerColor(hospital);
    const size = getMarkerSize(hospital, isHovered);
    const config = CLASSIFICATION_MARKERS[hospital.classification || '지역응급의료기관']
      || CLASSIFICATION_MARKERS['지역응급의료기관'];

    el.className = 'maplibre-marker';
    el.style.cursor = 'pointer';
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transition = 'all 0.15s ease';

    if (config.shape === 'diamond') {
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.backgroundColor = color;
      el.style.border = `${config.strokeWidth}px solid white`;
      el.style.transform = 'rotate(45deg)';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    } else if (config.shape === 'square') {
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.backgroundColor = color;
      el.style.border = `${config.strokeWidth}px solid white`;
      el.style.borderRadius = '2px';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    } else {
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.backgroundColor = color;
      el.style.border = `${config.strokeWidth}px solid white`;
      el.style.borderRadius = '50%';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    }

    if (isHovered) {
      el.style.boxShadow = '0 0 0 4px rgba(255,255,255,0.5), 0 4px 8px rgba(0,0,0,0.4)';
      el.style.zIndex = '100';
    }

    return el;
  }, [getMarkerColor, getMarkerSize]);

  // 팝업 내용 생성
  const createPopupContent = useCallback((hospital: Hospital): string => {
    const bedData = bedDataMap?.get(hospital.code);
    const severeData = severeDataMap?.get(hospital.code);

    let content = `
      <div style="min-width: 200px; font-family: system-ui, sans-serif;">
        <div style="font-weight: 600; font-size: 14px; color: #1f2937; margin-bottom: 4px;">
          ${hospital.name}
        </div>
        <div style="font-size: 11px; color: #6b7280; margin-bottom: 8px;">
          <span style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; margin-right: 4px;">
            ${hospital.classification || '응급의료기관'}
          </span>
          ${hospital.region || ''}
        </div>
    `;

    // 병상 정보
    if (bedData) {
      content += `
        <div style="background: #f3f4f6; padding: 8px; border-radius: 6px; margin-bottom: 8px;">
          <div style="font-size: 11px; font-weight: 500; color: #374151; margin-bottom: 4px;">응급실 현황</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 12px;">
            <div>응급실: <strong style="color: ${bedData.hvec > 0 ? '#22c55e' : '#ef4444'}">${bedData.hvec ?? '-'}</strong>/${bedData.hvs01 ?? '-'}</div>
            <div>중환자: <strong>${bedData.hv27 ?? '-'}</strong>/${bedData.HVS59 ?? '-'}</div>
          </div>
        </div>
      `;
    }

    // 중증질환 정보
    if (severeData && selectedSevereType) {
      const status = severeData.severeStatus?.[selectedSevereType];
      const statusText = status === 'Y' ? '가능' : status === 'N' ? '불가' : '정보없음';
      const statusColor = status === 'Y' ? '#22c55e' : status === 'N' ? '#ef4444' : '#6b7280';

      content += `
        <div style="font-size: 12px; color: ${statusColor}; font-weight: 500;">
          중증질환 진료: ${statusText}
        </div>
      `;
    }

    content += '</div>';
    return content;
  }, [bedDataMap, severeDataMap, selectedSevereType]);

  // 지도 초기화
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const styleUrl = getStyleUrl('dark');
    const initialView = getRegionView(selectedRegion);

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: initialView.center,
      zoom: initialView.zoom,
      attributionControl: false,
      maxBounds: MAPTILER_CONFIG.korea.bounds,
    });

    // 네비게이션 컨트롤 추가
    map.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right'
    );

    // 전체화면 컨트롤 추가
    map.current.addControl(new maplibregl.FullscreenControl(), 'top-right');

    map.current.on('load', () => {
      setIsLoaded(true);
    });

    return () => {
      // 마커 정리
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();

      // 팝업 정리
      popupRef.current?.remove();

      // 지도 정리
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // 지역 변경 시 지도 이동
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    const view = getRegionView(selectedRegion);
    map.current.flyTo({
      center: view.center,
      zoom: view.zoom,
      duration: 1000,
    });
  }, [selectedRegion, isLoaded]);

  // 마커 업데이트 (병원 목록 변경 시에만)
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    // 기존 마커 제거
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    // 새 마커 추가
    filteredHospitals.forEach(hospital => {
      if (!hospital.lat || !hospital.lng) return;

      const el = createMarkerElement(hospital, false); // 초기 생성 시 호버 상태 없음

      // 호버 이벤트
      el.addEventListener('mouseenter', () => {
        onHospitalHover?.(hospital.code);

        // 팝업 표시
        if (popupRef.current) {
          popupRef.current.remove();
        }

        popupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 15,
          className: 'maplibre-popup-custom',
        })
          .setLngLat([hospital.lng!, hospital.lat!])
          .setHTML(createPopupContent(hospital))
          .addTo(map.current!);
      });

      el.addEventListener('mouseleave', () => {
        onHospitalHover?.(null);
        popupRef.current?.remove();
      });

      // 클릭 이벤트
      el.addEventListener('click', () => {
        onHospitalClick?.(hospital);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([hospital.lng!, hospital.lat!])
        .addTo(map.current!);

      markersRef.current.set(hospital.code, marker);
    });
  }, [filteredHospitals, isLoaded, createMarkerElement, createPopupContent, onHospitalHover, onHospitalClick]);

  // 외부 호버 상태 변경 시 마커 스타일만 업데이트 (요소 교체 없음)
  useEffect(() => {
    if (!isLoaded) return;

    markersRef.current.forEach((marker, code) => {
      const hospital = filteredHospitals.find(h => h.code === code);
      if (!hospital) return;

      const isHovered = code === hoveredHospitalCode;
      const el = marker.getElement();
      const color = getMarkerColor(hospital);
      const size = getMarkerSize(hospital, isHovered);
      const config = CLASSIFICATION_MARKERS[hospital.classification || '지역응급의료기관']
        || CLASSIFICATION_MARKERS['지역응급의료기관'];

      // 스타일만 업데이트
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.backgroundColor = color;

      if (isHovered) {
        el.style.boxShadow = '0 0 0 4px rgba(255,255,255,0.5), 0 4px 8px rgba(0,0,0,0.4)';
        el.style.zIndex = '100';
      } else {
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.style.zIndex = '';
      }
    });
  }, [hoveredHospitalCode, filteredHospitals, getMarkerColor, getMarkerSize, isLoaded]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* 로딩 표시 */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
          <div className="text-white text-sm">지도 로딩 중...</div>
        </div>
      )}

      {/* API 키 경고 */}
      {!MAPTILER_CONFIG.apiKey && (
        <div className="absolute top-2 left-2 bg-yellow-100 text-yellow-800 text-xs px-3 py-1.5 rounded-lg shadow">
          Maptiler API 키가 필요합니다
        </div>
      )}

      {/* 범례 */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 text-xs">
        <div className="font-semibold mb-2 text-gray-700">기관분류</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rotate-45 border border-white shadow-sm" />
            <span>권역응급의료센터</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm border border-white shadow-sm" />
            <span>지역응급의료센터</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full border border-white shadow-sm" />
            <span>지역응급의료기관</span>
          </div>
        </div>
      </div>

      {/* 병원 수 표시 */}
      <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 text-sm">
        <span className="text-gray-600">표시된 병원: </span>
        <span className="font-bold text-blue-600">{filteredHospitals.length}</span>
        <span className="text-gray-600">개</span>
      </div>

      {/* 스타일 */}
      <style jsx global>{`
        .maplibre-popup-custom .maplibregl-popup-content {
          padding: 0;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .maplibre-popup-custom .maplibregl-popup-tip {
          border-top-color: white;
        }
        .maplibregl-ctrl-group {
          background: rgba(255,255,255,0.9) !important;
          backdrop-filter: blur(4px);
        }
      `}</style>
    </div>
  );
}
