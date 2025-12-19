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

  // 병상 상태 색상 결정
  const getBedStatusColor = (available: number, total: number): string => {
    if (total === 0) return '#6b7280';
    const rate = available / total;
    if (rate > 0.3) return '#4ade80';
    if (rate > 0) return '#fbbf24';
    return '#f87171';
  };

  // 팝업 내용 생성 (다크 모드)
  const createPopupContent = useCallback((hospital: Hospital): string => {
    const bedData = bedDataMap?.get(hospital.code);
    const severeData = severeDataMap?.get(hospital.code);

    // 기관분류 약어
    const classShort = hospital.classification === '권역응급의료센터' ? '권역'
      : hospital.classification === '지역응급의료센터' ? '센터'
      : hospital.classification === '지역응급의료기관' ? '기관' : '';

    let content = `
      <div class="popup-content">
        <div class="popup-header">
          <span class="popup-badge">${classShort}</span>
          <span class="popup-name">${hospital.name}</span>
        </div>
    `;

    // 병상 정보
    if (bedData) {
      // 점유율 계산
      const occupancyRate = bedData.occupancyRate ?? 0;
      const occupancyColor = occupancyRate > 80 ? '#f87171' : occupancyRate > 50 ? '#fbbf24' : '#4ade80';

      content += `
        <div class="popup-section">
          <div class="popup-section-title">병상 현황</div>
          <div class="popup-grid">
            <div class="popup-bed-item">
              <span class="popup-bed-label">응급실</span>
              <span class="popup-bed-value" style="color:${getBedStatusColor(bedData.hvec, bedData.hvs01)}">${bedData.hvec ?? 0}</span>
              <span class="popup-bed-total">/ ${bedData.hvs01 ?? 0}</span>
            </div>
            <div class="popup-bed-item">
              <span class="popup-bed-label">코호트</span>
              <span class="popup-bed-value" style="color:${getBedStatusColor(bedData.hv27, bedData.HVS59)}">${bedData.hv27 ?? 0}</span>
              <span class="popup-bed-total">/ ${bedData.HVS59 ?? 0}</span>
            </div>
            ${bedData.HVS02 > 0 ? `
            <div class="popup-bed-item">
              <span class="popup-bed-label">소아</span>
              <span class="popup-bed-value" style="color:${getBedStatusColor(bedData.hv28, bedData.HVS02)}">${bedData.hv28 ?? 0}</span>
              <span class="popup-bed-total">/ ${bedData.HVS02 ?? 0}</span>
            </div>` : ''}
            ${bedData.HVS03 > 0 ? `
            <div class="popup-bed-item">
              <span class="popup-bed-label">음압</span>
              <span class="popup-bed-value" style="color:${getBedStatusColor(bedData.hv29, bedData.HVS03)}">${bedData.hv29 ?? 0}</span>
              <span class="popup-bed-total">/ ${bedData.HVS03 ?? 0}</span>
            </div>` : ''}
            ${bedData.HVS04 > 0 ? `
            <div class="popup-bed-item">
              <span class="popup-bed-label">일반격리</span>
              <span class="popup-bed-value" style="color:${getBedStatusColor(bedData.hv30, bedData.HVS04)}">${bedData.hv30 ?? 0}</span>
              <span class="popup-bed-total">/ ${bedData.HVS04 ?? 0}</span>
            </div>` : ''}
          </div>
          <div class="popup-occupancy">
            <span class="popup-occupancy-label">점유율</span>
            <div class="popup-occupancy-bar">
              <div class="popup-occupancy-fill" style="width:${occupancyRate}%;background:${occupancyColor}"></div>
            </div>
            <span class="popup-occupancy-value" style="color:${occupancyColor}">${occupancyRate}%</span>
          </div>
        </div>
      `;
    }

    // 중증질환 정보
    if (severeData && selectedSevereType) {
      const status = severeData.severeStatus?.[selectedSevereType];
      const isAvailable = status === 'Y';
      content += `
        <div class="popup-status ${isAvailable ? 'available' : 'unavailable'}">
          ${isAvailable ? '● 진료 가능' : '○ 진료 불가'}
        </div>
      `;
    }

    // 업데이트 시간
    if (bedData?.hvidate) {
      const updateTime = bedData.hvidate.slice(8, 10) + ':' + bedData.hvidate.slice(10, 12);
      content += `<div class="popup-update">업데이트 ${updateTime}</div>`;
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

  // 외부 호버 상태 변경 시 마커 스타일 + 팝업 표시
  useEffect(() => {
    if (!isLoaded || !map.current) return;

    // 기존 팝업 제거
    popupRef.current?.remove();

    markersRef.current.forEach((marker, code) => {
      const hospital = filteredHospitals.find(h => h.code === code);
      if (!hospital) return;

      const isHovered = code === hoveredHospitalCode;
      const el = marker.getElement();
      const color = getMarkerColor(hospital);
      const size = getMarkerSize(hospital, isHovered);

      // 스타일 업데이트
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.backgroundColor = color;

      if (isHovered) {
        el.style.boxShadow = '0 0 0 4px rgba(255,255,255,0.5), 0 4px 8px rgba(0,0,0,0.4)';
        el.style.zIndex = '100';

        // 팝업 표시 (사이드바에서 호버한 경우)
        if (hospital.lng && hospital.lat) {
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 15,
            className: 'maplibre-popup-custom',
          })
            .setLngLat([hospital.lng, hospital.lat])
            .setHTML(createPopupContent(hospital))
            .addTo(map.current!);
        }
      } else {
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.style.zIndex = '';
      }
    });

    // 호버 해제 시 팝업 제거
    if (!hoveredHospitalCode) {
      popupRef.current?.remove();
    }
  }, [hoveredHospitalCode, filteredHospitals, getMarkerColor, getMarkerSize, isLoaded, createPopupContent]);

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
      <div className="absolute bottom-4 left-4 z-10 bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700/50 p-3 text-xs">
        <div className="font-medium mb-2 text-gray-400 text-[10px] uppercase tracking-wide">기관분류</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 bg-emerald-500 rotate-45 border-2 border-white/80 shadow-sm" />
            <span className="text-gray-300">권역센터</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm border-2 border-white/80 shadow-sm" />
            <span className="text-gray-300">지역센터</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 bg-emerald-500 rounded-full border border-white/80 shadow-sm" />
            <span className="text-gray-300">지역기관</span>
          </div>
        </div>
      </div>

      {/* 병원 수 표시 */}
      <div className="absolute top-4 left-4 z-10 bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700/50 px-3 py-2">
        <span className="text-gray-400 text-xs">병원 </span>
        <span className="font-semibold text-emerald-400 text-sm">{filteredHospitals.length}</span>
      </div>

      {/* 스타일 */}
      <style jsx global>{`
        /* 팝업 컨테이너 */
        .maplibre-popup-custom .maplibregl-popup-content {
          padding: 0;
          background: #1f2937;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.1);
          overflow: hidden;
        }
        .maplibre-popup-custom .maplibregl-popup-tip {
          border-top-color: #1f2937;
        }

        /* 팝업 내용 */
        .popup-content {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          min-width: 220px;
          max-width: 280px;
        }
        .popup-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .popup-badge {
          font-size: 10px;
          font-weight: 600;
          color: #94a3b8;
          background: rgba(148,163,184,0.15);
          padding: 2px 6px;
          border-radius: 4px;
          white-space: nowrap;
        }
        .popup-name {
          font-size: 13px;
          font-weight: 600;
          color: #f1f5f9;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .popup-section {
          padding: 10px 12px;
        }
        .popup-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
        }
        .popup-row:not(:last-child) {
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .popup-label {
          font-size: 11px;
          color: #9ca3af;
        }
        .popup-value {
          font-size: 12px;
          color: #e5e7eb;
          font-variant-numeric: tabular-nums;
        }
        .popup-status {
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 500;
          text-align: center;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .popup-status.available {
          color: #4ade80;
          background: rgba(74,222,128,0.1);
        }
        .popup-status.unavailable {
          color: #f87171;
          background: rgba(248,113,113,0.1);
        }

        /* 병상 섹션 */
        .popup-section-title {
          font-size: 10px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .popup-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
        }
        .popup-bed-item {
          display: flex;
          align-items: baseline;
          gap: 4px;
          background: rgba(255,255,255,0.03);
          padding: 6px 8px;
          border-radius: 6px;
        }
        .popup-bed-label {
          font-size: 10px;
          color: #9ca3af;
          min-width: 32px;
        }
        .popup-bed-value {
          font-size: 14px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .popup-bed-total {
          font-size: 10px;
          color: #6b7280;
          font-variant-numeric: tabular-nums;
        }

        /* 점유율 바 */
        .popup-occupancy {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .popup-occupancy-label {
          font-size: 10px;
          color: #9ca3af;
          min-width: 32px;
        }
        .popup-occupancy-bar {
          flex: 1;
          height: 6px;
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
          overflow: hidden;
        }
        .popup-occupancy-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s ease;
        }
        .popup-occupancy-value {
          font-size: 12px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          min-width: 36px;
          text-align: right;
        }

        /* 업데이트 시간 */
        .popup-update {
          font-size: 10px;
          color: #6b7280;
          text-align: right;
          padding: 6px 12px 8px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }

        /* 지도 컨트롤 */
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
    </div>
  );
}
