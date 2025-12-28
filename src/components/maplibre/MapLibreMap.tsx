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
import '@/styles/popup.css';
import { getStyleUrl, getRegionView, MAPTILER_CONFIG } from '@/lib/maplibre/config';
import { useTheme } from '@/lib/contexts/ThemeContext';
import { parseMessage, getStatusColorClasses } from '@/lib/utils/messageClassifier';
import { createMarkerElement } from '@/lib/utils/markerRenderer';
import { SEVERE_TYPES } from '@/lib/constants/dger';
import type { Hospital } from '@/types';
import type { HospitalBedData } from '@/lib/hooks/useBedData';
import type { HospitalSevereData } from '@/lib/hooks/useSevereData';
import type { ClassifiedMessages } from '@/lib/utils/messageClassifier';

interface MapLibreMapProps {
  hospitals: Hospital[];
  bedDataMap?: Map<string, HospitalBedData>;
  severeDataMap?: Map<string, HospitalSevereData>;
  emergencyMessages?: Map<string, ClassifiedMessages>;
  selectedRegion: string;
  selectedSevereType?: string | null;
  selectedClassifications: string[];
  hoveredHospitalCode: string | null;
  onHospitalHover?: (code: string | null) => void;
  onHospitalClick?: (hospital: Hospital) => void;
  onSwitchToLeaflet?: () => void;
}

export default function MapLibreMap({
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
  onSwitchToLeaflet,
}: MapLibreMapProps) {
  const { isDark } = useTheme();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapStyleMode, setMapStyleMode] = useState<'dataviz' | 'voyager'>('dataviz'); // 'dataviz' 또는 'voyager'

  // 현재 앱의 라이트/다크 모드를 고려한 실제 지도 스타일 생성
  const getCurrentMapStyle = useCallback((): 'datavizDark' | 'datavizLight' | 'voyagerDark' | 'voyagerLight' => {
    if (mapStyleMode === 'dataviz') {
      return isDark ? 'datavizDark' : 'datavizLight';
    } else {
      return isDark ? 'voyagerDark' : 'voyagerLight';
    }
  }, [mapStyleMode, isDark]);

  // 지도 스타일 변경 핸들러 (사용자가 지도 내부 버튼으로 dataviz/voyager 전환)
  const handleStyleChange = useCallback((newMode: 'dataviz' | 'voyager') => {
    if (map.current && newMode !== mapStyleMode) {
      setMapStyleMode(newMode);
      const actualStyle = newMode === 'dataviz'
        ? (isDark ? 'datavizDark' : 'datavizLight')
        : (isDark ? 'voyagerDark' : 'voyagerLight');
      const styleUrl = getStyleUrl(actualStyle);
      map.current.setStyle(styleUrl);
    }
  }, [mapStyleMode, isDark]);

  // 필터링된 병원 목록
  // NOTE: MapDashboard에서 이미 selectedRegion과 selectedClassifications로 필터링됨
  // 여기서는 좌표가 있는 병원만 추가로 필터링
  const filteredHospitals = useMemo(() => {
    return hospitals.filter(h => {
      // 좌표가 없는 병원 제외
      if (!h.lat || !h.lng) return false;
      return true;
    });
  }, [hospitals]);

  // 마커 HTML 생성 (공통 유틸 사용)
  const createMarkerElementCallback = useCallback((hospital: Hospital, isHovered: boolean): HTMLElement => {
    return createMarkerElement(hospital, bedDataMap, isHovered);
  }, [bedDataMap]);

  // 병상 상태 색상 결정
  const getBedStatusColor = (available: number, total: number): string => {
    if (total === 0) return '#6b7280';
    const rate = available / total;
    if (rate > 0.3) return '#4ade80';
    if (rate > 0) return '#fbbf24';
    return '#f87171';
  };

  // 기관분류 설명
  const getClassificationInfo = (classification?: string): { name: string; desc: string } => {
    switch (classification) {
      case '권역응급의료센터':
        return { name: '권역센터', desc: '광역 권역의 응급의료 허브' };
      case '지역응급의료센터':
        return { name: '지역센터', desc: '지역 응급의료 중심기관' };
      case '지역응급의료기관':
        return { name: '지역기관', desc: '지역 응급의료 시설' };
      default:
        return { name: '기관', desc: '응급의료기관' };
    }
  };

  // 팝업 내용 생성 (라이트/다크 모드 지원)
  const createPopupContent = useCallback((hospital: Hospital, isDarkMode: boolean = true): string => {
    const bedData = bedDataMap?.get(hospital.code);
    const severeData = severeDataMap?.get(hospital.code);
    const msgData = emergencyMessages?.get(hospital.code);
    const classInfo = getClassificationInfo(hospital.classification);

    let content = `
      <div class="popup-content ${isDarkMode ? 'popup-dark' : 'popup-light'}">
        <div class="popup-header">
          <span class="popup-badge" title="${classInfo.desc}">${classInfo.name}</span>
          <span class="popup-name">${hospital.name}</span>
        </div>
    `;

    // 위치 정보 (주소)
    content += `<div class="popup-info-section">`;
    if (bedData?.dutyAddr) {
      content += `
        <div class="popup-info-row">
          <span class="popup-info-icon">📍</span>
          <span class="popup-info-text">${bedData.dutyAddr}</span>
        </div>
      `;
    }
    content += `</div>`;

    // 병상 정보
    if (bedData) {
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
            ${bedData.HVS48 > 0 ? `
            <div class="popup-bed-item">
              <span class="popup-bed-label">소아음압</span>
              <span class="popup-bed-value" style="color:${getBedStatusColor(bedData.hv15, bedData.HVS48)}">${bedData.hv15 ?? 0}</span>
              <span class="popup-bed-total">/ ${bedData.HVS48 ?? 0}</span>
            </div>` : ''}
            ${bedData.HVS49 > 0 ? `
            <div class="popup-bed-item">
              <span class="popup-bed-label">소아격리</span>
              <span class="popup-bed-value" style="color:${getBedStatusColor(bedData.hv16, bedData.HVS49)}">${bedData.hv16 ?? 0}</span>
              <span class="popup-bed-total">/ ${bedData.HVS49 ?? 0}</span>
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

    // 중증질환 진료 가능 정보
    if (severeData && severeData.severeStatus) {
      const availableDiseases = Object.entries(severeData.severeStatus)
        .filter(([_, status]) => status === 'Y')
        .map(([key, _]) => {
          const diseaseType = SEVERE_TYPES.find(t => t.key === key);
          return diseaseType;
        })
        .filter((type): type is typeof SEVERE_TYPES[0] => !!type);

      if (availableDiseases.length > 0) {
        const bgColor = isDarkMode ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.1)';
        const borderColor = isDarkMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.2)';

        content += `
          <div class="popup-section" style="background:${bgColor};border:1px solid ${borderColor};">
            <div class="popup-section-title" style="color:#22c55e;">중증질환 진료 가능</div>
            <div style="display:flex;flex-wrap:wrap;gap:0.25rem;">
        `;

        availableDiseases.slice(0, 8).forEach(disease => {
          const label = disease.label.replace(/\[.*?\]\s*/, '');
          content += `
            <span style="font-size:0.75rem;background:rgba(34, 197, 94, 0.15);color:#22c55e;padding:0.375rem 0.5rem;border-radius:0.375rem;border:1px solid rgba(34, 197, 94, 0.2);">
              ${label}
            </span>
          `;
        });

        if (availableDiseases.length > 8) {
          content += `<span style="font-size:0.75rem;color:#999;padding:0.375rem 0.5rem;">+${availableDiseases.length - 8}</span>`;
        }

        content += `</div></div>`;
      }
    }

    // 중증질환 메시지 섹션
    if (msgData && msgData.allDiseases && msgData.allDiseases.length > 0) {
      const bgColor = isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.1)';
      const borderColor = isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.2)';

      content += `
        <div class="popup-section" style="background:${bgColor};border:1px solid ${borderColor};">
          <div class="popup-section-title" style="color:#ef4444;">중증질환 메시지</div>
      `;

      msgData.allDiseases.slice(0, 3).forEach(disease => {
        const displayName = disease.displayName.replace(/\[.*?\]\s*/, '');
        content += `
          <div style="font-size:0.75rem;margin-bottom:0.5rem;">
            <span style="color:#fca5a5;font-weight:bold;">${displayName}:</span>
            <span style="color:#999;margin-left:0.25rem;">${disease.content}</span>
          </div>
        `;
      });

      if (msgData.allDiseases.length > 3) {
        content += `<div style="font-size:0.75rem;color:#999;">+${msgData.allDiseases.length - 3}개 메시지</div>`;
      }

      content += `</div>`;
    }

    // 응급실 운영 정보 섹션
    if (msgData && msgData.emergency && msgData.emergency.length > 0) {
      const bgColor = isDarkMode ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.1)';
      const borderColor = isDarkMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.2)';

      content += `
        <div class="popup-section" style="background:${bgColor};border:1px solid ${borderColor};">
          <div class="popup-section-title" style="color:#22c55e;">응급실 운영 정보</div>
      `;

      msgData.emergency.slice(0, 3).forEach(item => {
        const parsed = parseMessage(item.msg, item.symTypCod);
        const statusColor = parsed.status.color === 'red' ? '#ef4444' :
                           parsed.status.color === 'orange' ? '#f97316' :
                           parsed.status.color === 'green' ? '#22c55e' : '#999';

        content += `
          <div style="font-size:0.75rem;margin-bottom:0.5rem;background:${isDarkMode ? 'rgba(55,65,81,0.5)' : 'rgba(229,231,235,0.5)'};padding:0.375rem;border-radius:0.25rem;">
            <div style="display:flex;gap:0.25rem;margin-bottom:0.25rem;flex-wrap:wrap;">
              <span style="background:${isDarkMode ? 'rgba(249, 115, 22, 0.2)' : 'rgba(249, 115, 22, 0.2)'};color:#fb923c;padding:0.125rem 0.375rem;border-radius:0.125rem;font-size:0.7rem;">
                ${parsed.department}
              </span>
              <span style="background:${isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.2)'};color:${statusColor};padding:0.125rem 0.375rem;border-radius:0.125rem;font-size:0.7rem;">
                ${parsed.status.label}
              </span>
            </div>
            <div style="color:#bfdbfe;word-break:break-word;">${parsed.details}</div>
          </div>
        `;
      });

      if (msgData.emergency.length > 3) {
        content += `<div style="font-size:0.75rem;color:#999;">+${msgData.emergency.length - 3}개 메시지</div>`;
      }

      content += `</div>`;
    }

    // 업데이트 시간
    if (bedData?.hvidate) {
      const updateTime = bedData.hvidate.slice(8, 10) + ':' + bedData.hvidate.slice(10, 12);
      content += `<div class="popup-update">업데이트 ${updateTime}</div>`;
    }

    content += '</div>';
    return content;
  }, [bedDataMap, severeDataMap, emergencyMessages, selectedSevereType, isDark]);

  // 지도 초기화
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const actualStyle = getCurrentMapStyle();
    const styleUrl = getStyleUrl(actualStyle);
    const initialView = getRegionView(selectedRegion);

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: initialView.center,
      zoom: initialView.zoom,
      attributionControl: false,
      maxBounds: MAPTILER_CONFIG.korea.bounds,
    });

    // 주: 지도 컨트롤은 커스텀 UI에서 구현되므로 기본 컨트롤은 추가하지 않음
    // - 네비게이션 컨트롤 (줌 +/-)
    // - 전체화면 컨트롤
    // - 둘 다 하단 JSX에서 커스텀으로 구현됨

    map.current.on('load', () => {
      // 행정경계 레이어 강화 (시도/구군 구분)
      // Maptiler 기본 스타일에는 이미 행정경계 레이어가 포함되어 있으므로,
      // 해당 레이어의 스타일을 강화하여 시도/구군 경계를 더 뚜렷하게 표시
      const layers = map.current!.getStyle().layers || [];

      // 행정경계 레이어 찾기 및 강조
      layers.forEach(layer => {
        // 국가 경계, 시도 경계, 구군 경계 등의 레이어 강화
        if (layer.id && (
          layer.id.includes('boundary') ||
          layer.id.includes('admin') ||
          layer.id.includes('border')
        )) {
          try {
            // 경계선 가시성 증대
            map.current!.setPaintProperty(layer.id, 'line-opacity', 0.8);
            map.current!.setPaintProperty(layer.id, 'line-width', 1.5);
          } catch (e) {
            // 레이어가 없거나 속성이 없는 경우 무시
          }
        }
      });

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

  // 라이트/다크 모드 변경 시 지도 스타일 자동 변경
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    const actualStyle = getCurrentMapStyle();
    const styleUrl = getStyleUrl(actualStyle);
    map.current.setStyle(styleUrl);
  }, [isDark, mapStyleMode, isLoaded, getCurrentMapStyle]);

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

      const el = createMarkerElementCallback(hospital, false); // 초기 생성 시 호버 상태 없음

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
          .setHTML(createPopupContent(hospital, isDark))
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

      // 호버 상태에 따라 마커 재생성
      if (isHovered) {
        // 새 마커로 교체
        marker.remove();
        const newEl = createMarkerElementCallback(hospital, true);
        const newMarker = new maplibregl.Marker({ element: newEl })
          .setLngLat([hospital.lng!, hospital.lat!])
          .addTo(map.current!);

        markersRef.current.set(code, newMarker);

        // 팝업 표시 (사이드바에서 호버한 경우)
        if (hospital.lng && hospital.lat) {
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 15,
            className: 'maplibre-popup-custom',
          })
            .setLngLat([hospital.lng, hospital.lat])
            .setHTML(createPopupContent(hospital, isDark))
            .addTo(map.current!);
        }
      } else {
        // 호버 해제 시 원래 마커로 교체
        marker.remove();
        const newEl = createMarkerElementCallback(hospital, false);
        const newMarker = new maplibregl.Marker({ element: newEl })
          .setLngLat([hospital.lng!, hospital.lat!])
          .addTo(map.current!);

        markersRef.current.set(code, newMarker);
      }
    });

    // 호버 해제 시 팝업 제거
    if (!hoveredHospitalCode) {
      popupRef.current?.remove();
    }
  }, [hoveredHospitalCode, filteredHospitals, createMarkerElementCallback, isLoaded, createPopupContent]);

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

      {/* 지도 컨트롤 그룹 (맵 전환 + 스타일 토글 + 줌 + 전체화면) */}
      <div className={`absolute top-4 right-4 z-20 flex items-center gap-2 rounded-lg shadow-lg border p-1.5 ${isDark ? 'bg-gray-800/90 border-gray-700/50' : 'bg-white/90 border-gray-300/50'}`}>
        {/* MapTiler/Leaflet 전환 */}
        <div className="flex items-center">
          <button
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${isDark ? 'bg-cyan-600 text-white' : 'bg-cyan-500 text-white'}`}
            title="현재: MapTiler"
          >
            MapTiler
          </button>
          {onSwitchToLeaflet && (
            <button
              onClick={onSwitchToLeaflet}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${isDark ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200/80'}`}
              title="Leaflet으로 전환"
            >
              Leaflet
            </button>
          )}
        </div>

        {/* 구분선 */}
        <div className={`w-px h-5 ${isDark ? 'bg-gray-700/50' : 'bg-gray-400/50'}`} />

        {/* 스타일 토글 버튼 */}
        <div className="relative group">
          <button
            onClick={() => handleStyleChange(mapStyleMode === 'dataviz' ? 'voyager' : 'dataviz')}
            className={`w-9 h-9 rounded-md transition-all flex items-center justify-center ${isDark ? 'hover:bg-gray-700/80 text-white' : 'hover:bg-gray-200/80 text-gray-900'}`}
          >
            {/* 달 모양 아이콘 고정 */}
            <svg className={`w-4 h-4 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          </button>

          {/* 마우스 오버시 표시되는 텍스트 */}
          <div className={`absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 ${isDark ? 'text-white bg-gray-900' : 'text-gray-900 bg-white'}`}>
            {mapStyleMode === 'dataviz' ? '지도 스타일 변경' : '데이터 시각화 보기'}
          </div>
        </div>

        {/* 구분선 */}
        <div className={`w-px h-5 ${isDark ? 'bg-gray-700/50' : 'bg-gray-400/50'}`} />

        {/* 줌 인 버튼 */}
        <button
          onClick={() => map.current?.zoomIn()}
          className={`w-9 h-9 rounded-md transition-all flex items-center justify-center font-bold ${isDark ? 'hover:bg-gray-700/80 text-white' : 'hover:bg-gray-200/80 text-gray-900'}`}
          title="확대"
        >
          +
        </button>

        {/* 줌 아웃 버튼 */}
        <button
          onClick={() => map.current?.zoomOut()}
          className={`w-9 h-9 rounded-md transition-all flex items-center justify-center font-bold ${isDark ? 'hover:bg-gray-700/80 text-white' : 'hover:bg-gray-200/80 text-gray-900'}`}
          title="축소"
        >
          −
        </button>

        {/* 구분선 */}
        <div className={`w-px h-5 ${isDark ? 'bg-gray-700/50' : 'bg-gray-400/50'}`} />

        {/* 전체화면 버튼 */}
        <button
          onClick={() => {
            if (!mapContainer.current) return;

            const elem = mapContainer.current;
            const isFullscreen = document.fullscreenElement || (document as any).webkitFullscreenElement;

            try {
              if (isFullscreen) {
                if (document.exitFullscreen) {
                  document.exitFullscreen();
                } else if ((document as any).webkitExitFullscreen) {
                  (document as any).webkitExitFullscreen();
                }
              } else {
                if (elem.requestFullscreen) {
                  elem.requestFullscreen();
                } else if ((elem as any).webkitRequestFullscreen) {
                  (elem as any).webkitRequestFullscreen();
                } else if ((elem as any).mozRequestFullScreen) {
                  (elem as any).mozRequestFullScreen();
                } else if ((elem as any).msRequestFullscreen) {
                  (elem as any).msRequestFullscreen();
                }
              }
            } catch (e) {
              console.warn('전체화면 요청 실패:', e);
            }
          }}
          className={`w-9 h-9 rounded-md transition-all flex items-center justify-center text-lg font-bold ${isDark ? 'hover:bg-gray-700/80 text-white' : 'hover:bg-gray-200/80 text-gray-900'}`}
          title="전체화면"
        >
          ⛶
        </button>
      </div>

      {/* 병원 수 표시 */}
      <div className={`absolute top-4 left-4 z-10 backdrop-blur-sm rounded-lg shadow-lg border px-3 py-2 ${isDark ? 'bg-gray-900/95 border-gray-700/50' : 'bg-white/95 border-gray-300/50'}`}>
        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>병원 </span>
        <span className={`font-semibold text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{filteredHospitals.length}</span>
      </div>

      {/* 스타일 */}
      <style jsx global>{`
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
