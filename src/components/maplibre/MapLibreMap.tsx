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
import { getCategoryByKey, getMatchedSevereKeys } from '@/lib/constants/diseaseCategories';
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
  selectedDiseaseCategory?: string | null;  // 42개 중증자원조사 대분류 선택
  selectedDiseases?: Set<string>;  // 선택된 소분류 질환명들
  selectedClassifications: string[];
  hoveredHospitalCode: string | null;
  onHospitalHover?: (code: string | null) => void;
  onHospitalClick?: (hospital: Hospital) => void;
  onSwitchToLeaflet?: () => void;
  onSwitchToKakao?: () => void;
}

export default function MapLibreMap({
  hospitals,
  bedDataMap,
  severeDataMap,
  emergencyMessages,
  selectedRegion,
  selectedSevereType,
  selectedDiseaseCategory,
  selectedDiseases,
  selectedClassifications,
  hoveredHospitalCode,
  onHospitalHover,
  onHospitalClick,
  onSwitchToLeaflet,
  onSwitchToKakao,
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

  // 팝업 내용 생성 (컴팩트 버전 - B옵션)
  // 핵심: 선택된 42개 질환 정보 우선, 아이콘 없음, 줄바꿈 최소화
  const createPopupContent = useCallback((hospital: Hospital, isDarkMode: boolean = true): string => {
    const bedData = bedDataMap?.get(hospital.code);
    const severeData = severeDataMap?.get(hospital.code);
    const msgData = emergencyMessages?.get(hospital.code);
    const classInfo = getClassificationInfo(hospital.classification);

    // 색상 설정
    const c = {
      text: isDarkMode ? '#f1f5f9' : '#1f2937',
      muted: isDarkMode ? '#9ca3af' : '#6b7280',
      border: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      bg: isDarkMode ? 'rgba(30,41,59,0.6)' : 'rgba(243,244,246,0.9)',
    };

    // 선택된 질환의 가용 여부 확인
    let selectedDiseaseStatus: { available: boolean; label: string } | null = null;
    if (selectedSevereType && severeData?.severeStatus) {
      const status = severeData.severeStatus[selectedSevereType];
      const diseaseType = SEVERE_TYPES.find(t => t.key === selectedSevereType);
      if (diseaseType) {
        selectedDiseaseStatus = {
          available: status === 'Y',
          label: diseaseType.label.replace(/\[.*?\]\s*/, ''),
        };
      }
    }

    // 긴급 메시지 수집 (진료불가/제한) - 실제 내용 포함
    const urgentItems: { label: string; content: string }[] = [];
    if (msgData?.emergency) {
      msgData.emergency.forEach(item => {
        const parsed = parseMessage(item.msg, item.symTypCod);
        if (parsed.status.color === 'red') {
          urgentItems.push({ label: parsed.department, content: parsed.details || '진료불가' });
        }
      });
    }
    if (msgData?.allDiseases) {
      msgData.allDiseases.forEach(disease => {
        if (disease.content.includes('불가') || disease.content.includes('중단')) {
          const displayName = disease.displayName.replace(/\[.*?\]\s*/, '');
          urgentItems.push({ label: displayName, content: disease.content });
        }
      });
    }

    // 병상 정보
    const occupancy = bedData?.occupancyRate ?? 0;
    const occColor = occupancy >= 95 ? '#ef4444' : occupancy >= 60 ? '#f59e0b' : '#22c55e';
    const erAvail = bedData?.hvec ?? 0;
    const erTotal = bedData?.hvs01 ?? 0;

    let content = `<div class="popup-content" style="min-width:200px;max-width:280px;">`;

    // 헤더: 기관분류 + 병원명
    content += `
      <div style="display:flex;align-items:center;gap:6px;padding:10px 12px;background:${isDarkMode ? 'linear-gradient(135deg,#374151 0%,#1f2937 100%)' : 'linear-gradient(135deg,#f3f4f6 0%,#e5e7eb 100%)'};border-bottom:1px solid ${c.border};">
        <span style="font-size:10px;font-weight:600;color:${c.muted};background:${isDarkMode ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.12)'};padding:2px 6px;border-radius:4px;">${classInfo.name}</span>
        <span style="font-size:13px;font-weight:600;color:${c.text};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${hospital.name}</span>
      </div>
    `;

    // [핵심] 선택된 42개 중증자원조사 대분류 헤더 (병원명 바로 아래)
    // TODO: 추후 하드코딩 변경필요 - '25년 9월말 기준 날짜
    if (selectedDiseaseCategory) {
      const category = getCategoryByKey(selectedDiseaseCategory);
      if (category) {
        // 소분류 목록 (선택된 소분류만 표시, 대분류만 있는 경우 대분류 label 사용)
        const subcategoryLabels = category.subcategories.length > 0
          ? (selectedDiseases && selectedDiseases.size > 0
              ? category.subcategories
                  .filter(sub => selectedDiseases.has(sub.key))
                  .map(sub => sub.label).join(', ')
              : category.subcategories.map(sub => sub.label).join(', '))
          : category.label;

        content += `
          <div style="padding:6px 12px;background:${isDarkMode ? 'rgba(59,130,246,0.15)' : 'rgba(219,234,254,0.8)'};border-bottom:1px solid ${c.border};">
            <div style="font-size:11px;font-weight:600;color:${isDarkMode ? '#60a5fa' : '#2563eb'};">${category.label}</div>
            <div style="font-size:9px;color:${c.muted};margin-top:2px;line-height:1.4;">${subcategoryLabels}</div>
            <div style="font-size:8px;color:${c.muted};text-align:right;margin-top:2px;opacity:0.7;">25년 9월말 DGEMS 자원조사 기준</div>
          </div>
        `;
      }
    }

    // [핵심] 선택된 질환 가용 여부 (최상단 강조)
    if (selectedDiseaseStatus) {
      const statusBg = selectedDiseaseStatus.available
        ? (isDarkMode ? 'rgba(34,197,94,0.2)' : 'rgba(220,252,231,0.8)')
        : (isDarkMode ? 'rgba(239,68,68,0.2)' : 'rgba(254,202,202,0.8)');
      const statusColor = selectedDiseaseStatus.available ? '#22c55e' : '#ef4444';
      const statusText = selectedDiseaseStatus.available ? '진료가능' : '진료불가';

      content += `
        <div style="padding:10px 12px;background:${statusBg};border-left:3px solid ${statusColor};">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:12px;font-weight:600;color:${c.text};">${selectedDiseaseStatus.label}</span>
            <span style="font-size:11px;font-weight:700;color:${statusColor};background:${isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)'};padding:2px 8px;border-radius:4px;">${statusText}</span>
          </div>
        </div>
      `;
    }

    // 병상 현황 (컴팩트 1줄 + 배터리 표시)
    if (bedData) {
      // 배터리 fill width (최대 100%로 제한하되, 값은 그대로 표시)
      const batteryFill = Math.min(100, Math.max(0, occupancy));
      const batteryBorder = isDarkMode ? '#6b7280' : '#9ca3af';

      content += `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:${c.bg};border-bottom:1px solid ${c.border};">
          <span style="font-size:10px;color:${c.muted};font-weight:500;">응급실</span>
          <span style="font-size:14px;font-weight:700;color:${getBedStatusColor(erAvail, erTotal)};">${erAvail}</span>
          <span style="font-size:10px;color:${c.muted};">/ ${erTotal}</span>
          <span style="flex:1;"></span>
          <div style="display:inline-flex;align-items:center;">
            <div style="position:relative;width:36px;height:18px;border:1px solid ${batteryBorder};border-radius:3px;background:transparent;">
              <div style="position:absolute;top:2px;left:2px;bottom:2px;width:calc(${batteryFill}% - 4px);background:${occColor};border-radius:2px;"></div>
              <span style="position:relative;z-index:1;display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:9px;font-weight:700;color:${occupancy >= 50 ? '#fff' : c.text};">${occupancy}%</span>
            </div>
            <div style="width:2px;height:8px;background:${batteryBorder};border-radius:0 1px 1px 0;margin-left:-1px;"></div>
          </div>
        </div>
      `;
    }

    // 진료 가능 질환 (선택된 질환 외 다른 질환들)
    if (severeData?.severeStatus) {
      const availableDiseases = Object.entries(severeData.severeStatus)
        .filter(([key, status]) => status === 'Y' && key !== selectedSevereType)
        .map(([key]) => SEVERE_TYPES.find(t => t.key === key))
        .filter((t): t is typeof SEVERE_TYPES[0] => !!t);

      if (availableDiseases.length > 0) {
        // 42개 대분류가 선택된 경우 매칭된 질환과 나머지를 구분
        const matchedSevereKeys = selectedDiseaseCategory ? getMatchedSevereKeys(selectedDiseaseCategory) : [];
        const hasMatchedFilter = matchedSevereKeys.length > 0;

        // 매칭된 질환과 나머지 분리
        const matchedDiseases = hasMatchedFilter
          ? availableDiseases.filter(d => matchedSevereKeys.includes(d.key))
          : [];
        const otherDiseases = hasMatchedFilter
          ? availableDiseases.filter(d => !matchedSevereKeys.includes(d.key))
          : availableDiseases;

        content += `<div style="padding:8px 12px;border-bottom:1px solid ${c.border};">`;
        content += `<div style="font-size:10px;color:${c.muted};margin-bottom:4px;">수용가능(실시간) (${availableDiseases.length})</div>`;

        // 매칭된 질환 (하이라이트 표시)
        if (matchedDiseases.length > 0) {
          const matchedLabels = matchedDiseases.map(d => d.label.replace(/\[.*?\]\s*/, '')).join(', ');
          content += `
            <div style="display:flex;align-items:baseline;gap:4px;margin-bottom:4px;">
              <span style="font-size:9px;font-weight:600;color:${isDarkMode ? '#60a5fa' : '#2563eb'};background:${isDarkMode ? 'rgba(59,130,246,0.2)' : 'rgba(219,234,254,0.9)'};padding:2px 5px;border-radius:3px;flex-shrink:0;line-height:1;">연관</span>
              <span style="font-size:10px;color:${isDarkMode ? '#93c5fd' : '#1d4ed8'};font-weight:500;line-height:1.4;">${matchedLabels}</span>
            </div>
          `;
        }

        // 나머지 질환
        if (otherDiseases.length > 0) {
          const displayCount = Math.min(hasMatchedFilter ? 4 : 6, otherDiseases.length);
          const labels = otherDiseases.slice(0, displayCount).map(d => d.label.replace(/\[.*?\]\s*/, '')).join(', ');
          const more = otherDiseases.length > displayCount ? ` +${otherDiseases.length - displayCount}` : '';
          content += `<div style="font-size:10px;color:${isDarkMode ? '#86efac' : '#16a34a'};line-height:1.4;">${labels}${more}</div>`;
        }

        content += `</div>`;
      }
    }

    // 긴급 알림 (진료불가/제한 실제 내용 표시) - 맨 아래로 이동
    if (urgentItems.length > 0) {
      content += `
        <div style="padding:8px 12px;background:${isDarkMode ? 'rgba(239,68,68,0.12)' : 'rgba(254,202,202,0.5)'};border-bottom:1px solid ${c.border};">
          ${urgentItems.slice(0, 3).map(item => `
            <div style="display:flex;gap:6px;font-size:10px;line-height:1.5;">
              <span style="font-weight:600;color:#ef4444;flex-shrink:0;">${item.label}</span>
              <span style="color:${c.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.content}</span>
            </div>
          `).join('')}
          ${urgentItems.length > 3 ? `<div style="font-size:9px;color:${c.muted};margin-top:2px;">+${urgentItems.length - 3}건 더</div>` : ''}
        </div>
      `;
    }

    // 업데이트 시간
    if (bedData?.hvidate) {
      const y = bedData.hvidate.slice(0, 4);
      const m = bedData.hvidate.slice(4, 6);
      const d = bedData.hvidate.slice(6, 8);
      const hh = bedData.hvidate.slice(8, 10);
      const mm = bedData.hvidate.slice(10, 12);
      content += `
        <div style="padding:6px 12px;font-size:10px;color:${c.muted};text-align:right;background:${isDarkMode ? 'rgba(15,23,42,0.5)' : 'rgba(249,250,251,0.8)'};">
          ${y}-${m}-${d} ${hh}:${mm} 기준
        </div>
      `;
    }

    content += '</div>';
    return content;
  }, [bedDataMap, severeDataMap, emergencyMessages, selectedSevereType, selectedDiseaseCategory, selectedDiseases, isDark]);

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
        {/* 지도 전환 */}
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
          {onSwitchToKakao && (
            <button
              onClick={onSwitchToKakao}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${isDark ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200/80'}`}
              title="카카오맵으로 전환"
            >
              카카오
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
