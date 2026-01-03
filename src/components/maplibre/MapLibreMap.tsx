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
import '@/styles/marker.css';
import { getStyleUrl, getRegionView, MAPTILER_CONFIG } from '@/lib/maplibre/config';
import { useTheme } from '@/lib/contexts/ThemeContext';
import { parseMessage, getStatusColorClasses, renderHighlightedMessage, normalizeMessageForDisplay, renderTooltipMessage } from '@/lib/utils/messageClassifier';
import { createMarkerElement } from '@/lib/utils/markerRenderer';
import { shortenHospitalName } from '@/lib/utils/hospitalUtils';
import { SEVERE_TYPES } from '@/lib/constants/dger';
import { getCategoryByKey, getMatchedSevereKeys } from '@/lib/constants/diseaseCategories';
import type { Hospital, AvailabilityStatus } from '@/types';
import type { HospitalBedData } from '@/lib/hooks/useBedData';
import type { HospitalSevereData } from '@/lib/hooks/useSevereData';
import type { ClassifiedMessages } from '@/lib/utils/messageClassifier';

const escapeHtmlAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

interface UserLocation {
  lat: number;
  lng: number;
}

interface MapLibreMapProps {
  hospitals: Hospital[];
  bedDataMap?: Map<string, HospitalBedData>;
  severeDataMap?: Map<string, HospitalSevereData>;
  emergencyMessages?: Map<string, ClassifiedMessages>;
  selectedRegion: string;
  selectedSevereType?: string | null;
  selectedDiseaseCategory?: string | null;  // 42개 중증자원조사 대분류 선택
  selectedDiseases?: Set<string>;  // 선택된 소분류 질환명들
  diseaseStatusMap?: Map<string, AvailabilityStatus>;  // 42개 자원조사 가용상태 맵
  selectedClassifications: string[];
  hoveredHospitalCode: string | null;
  onHospitalHover?: (code: string | null) => void;
  onHospitalClick?: (hospital: Hospital) => void;
  onSwitchToLeaflet?: () => void;
  onSwitchToKakao?: () => void;
  // 사용자 위치 및 10km 반경 표시
  userLocation?: UserLocation | null;
  showLocationRadius?: boolean;
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
  diseaseStatusMap,
  selectedClassifications,
  hoveredHospitalCode,
  onHospitalHover,
  onHospitalClick,
  onSwitchToLeaflet,
  onSwitchToKakao,
  userLocation,
  showLocationRadius,
}: MapLibreMapProps) {
  const { isDark } = useTheme();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const pinnedPopupCodeRef = useRef<string | null>(null);
  const prevHoveredCodeRef = useRef<string | null>(null);  // 이전 호버된 마커 코드 (최적화용)
  const batchRenderIdRef = useRef<number>(0);  // 배치 렌더링 취소용 ID
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

  const maxOccupancy = useMemo(() => {
    if (!bedDataMap) return 0;
    let max = 0;
    filteredHospitals.forEach((hospital) => {
      const bedData = bedDataMap.get(hospital.code);
      if (!bedData) return;
      const occupancy = typeof bedData.occupancy === 'number'
        ? bedData.occupancy
        : Math.max(0, (bedData.hvs01 ?? 0) - (bedData.hvec ?? 0));
      if (occupancy > max) max = occupancy;
    });
    return max;
  }, [filteredHospitals, bedDataMap]);

  // 마커 HTML 생성 (공통 유틸 사용)
  const createMarkerElementCallback = useCallback((hospital: Hospital, isHovered: boolean): HTMLElement => {
    return createMarkerElement(hospital, bedDataMap, isHovered, diseaseStatusMap?.get(hospital.code), true, maxOccupancy);
  }, [bedDataMap, diseaseStatusMap, maxOccupancy]);

  // 병상 상태 색상 결정
  const getBedStatusColor = (available: number, total: number): string => {
    if (total === 0) return '#6b7280';
    const rate = available / total;
    if (rate > 0.3) return '#4ade80';
    if (rate > 0) return '#fbbf24';
    return '#f87171';
  };

  // 기관분류 설명 (2글자 약어)
  const getClassificationInfo = (classification?: string): { name: string; desc: string; color: string } => {
    switch (classification) {
      case '권역응급의료센터':
        return { name: '권역', desc: '광역 권역의 응급의료 허브', color: '#d97706' };
      case '지역응급의료센터':
        return { name: '센터', desc: '지역 응급의료 중심기관', color: '#0891b2' };
      case '지역응급의료기관':
        return { name: '기관', desc: '지역 응급의료 시설', color: '#059669' };
      default:
        return { name: '기관', desc: '응급의료기관', color: '#6b7280' };
    }
  };

  // 배터리 SVG 생성 함수
  const createBatterySvg = (rate: number, isDarkMode: boolean) => {
    const fillWidth = Math.min(Math.max(rate, 0), 100) * 0.2; // 20px max width
    const fillColor = rate >= 95 ? '#ef4444' : rate >= 60 ? '#eab308' : '#22c55e';
    const bgColor = isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
    return `<svg width="26" height="12" viewBox="0 0 26 12" style="vertical-align:middle;">
      <rect x="0" y="1" width="22" height="10" rx="2" fill="${bgColor}" stroke="${isDarkMode ? '#6b7280' : '#9ca3af'}" stroke-width="1"/>
      <rect x="22" y="3.5" width="3" height="5" rx="1" fill="${isDarkMode ? '#6b7280' : '#9ca3af'}"/>
      <rect x="1" y="2" width="${fillWidth}" height="8" rx="1" fill="${fillColor}"/>
    </svg>`;
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
    const occColor = occupancy >= 95 ? '#ef4444' : occupancy >= 60 ? '#eab308' : '#22c55e';
    const erAvail = bedData?.hvec ?? 0;
    const erTotal = bedData?.hvs01 ?? 0;
    const occupied = erTotal - erAvail;  // 재실환자수

    // 약어 병원명
    const shortName = shortenHospitalName(hospital.name);

    let content = `<div class="popup-content" style="min-width:200px;max-width:280px;">`;

    // 헤더: 기관분류(2글자) + 병원명(약어) + 재실환자수 + 배터리
    content += `
      <div style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:${isDarkMode ? 'linear-gradient(135deg,#374151 0%,#1f2937 100%)' : 'linear-gradient(135deg,#f3f4f6 0%,#e5e7eb 100%)'};border-bottom:1px solid ${c.border};">
        <span style="font-size:10px;font-weight:600;color:${classInfo.color};background:${isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)'};padding:1px 4px;border-radius:3px;">${classInfo.name}</span>
        <span style="font-size:12px;font-weight:600;color:${c.text};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${hospital.name}">${shortName}</span>
        <span style="font-size:10px;color:${c.muted};">${occupied}명</span>
        ${createBatterySvg(occupancy, isDarkMode)}
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

        // 42개 자원조사 가용상태 가져오기
        const diseaseStatus = diseaseStatusMap?.get(hospital.code);
        const statusColor = diseaseStatus === '24시간' ? (isDarkMode ? '#6ee7b7' : '#16a34a')
          : diseaseStatus === '주간' ? (isDarkMode ? '#93c5fd' : '#2563eb')
          : diseaseStatus === '야간' ? (isDarkMode ? '#c4b5fd' : '#7c3aed')
          : '#6b7280';
        const statusBadge = diseaseStatus
          ? `<span style="font-size:10px;font-weight:600;color:${statusColor};background:${isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)'};padding:2px 6px;border-radius:3px;">${diseaseStatus}</span>`
          : '';

        content += `
          <div style="padding:6px 12px;background:${isDarkMode ? 'rgba(59,130,246,0.15)' : 'rgba(219,234,254,0.8)'};border-bottom:1px solid ${c.border};">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:11px;font-weight:600;color:${isDarkMode ? '#60a5fa' : '#2563eb'};">${category.label}</span>
              ${statusBadge}
            </div>
            <div style="font-size:9px;color:${c.muted};margin-top:2px;line-height:1.4;">${subcategoryLabels}</div>
            <div style="font-size:8px;color:${c.muted};text-align:right;margin-top:2px;opacity:0.7;">25년 9월말 DGEMS 자원조사 기준</div>
          </div>
        `;
      }
    } else {
      // 42개 자원조사 필터 미선택 시 안내 메시지
      content += `
        <div style="padding:8px 12px;background:${isDarkMode ? 'rgba(100,116,139,0.1)' : 'rgba(148,163,184,0.15)'};border-bottom:1px solid ${c.border};">
          <div style="font-size:10px;color:${c.muted};text-align:center;">좌측 패널에서 42개 자원조사 항목을 선택해주세요</div>
        </div>
      `;
    }

    // [핵심] 선택된 질환 가용 여부 (최상단 강조)
    if (selectedDiseaseStatus) {
      const statusBg = selectedDiseaseStatus.available
        ? (isDarkMode ? 'rgba(34,197,94,0.15)' : 'rgba(220,252,231,0.8)')
        : (isDarkMode ? 'rgba(248,113,113,0.1)' : 'rgba(254,202,202,0.8)');
      const statusColor = selectedDiseaseStatus.available ? (isDarkMode ? '#6ee7b7' : '#16a34a') : (isDarkMode ? '#fca5a5' : '#dc2626');
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

    // [통합 섹션] 실시간 중증질환 (27개)
    if (severeData?.severeStatus) {
      const matchedSevereKeys = selectedDiseaseCategory ? getMatchedSevereKeys(selectedDiseaseCategory) : [];
      const hasMatchedFilter = matchedSevereKeys.length > 0;

      // 연관 질환 중 가용/불가 분리
      const matchedAvailable: typeof SEVERE_TYPES[number][] = [];
      const matchedUnavailable: typeof SEVERE_TYPES[number][] = [];

      if (hasMatchedFilter) {
        matchedSevereKeys.forEach(key => {
          const disease = SEVERE_TYPES.find(t => t.key === key);
          if (disease) {
            const status = severeData.severeStatus[key];
            if (status === 'Y') {
              matchedAvailable.push(disease);
            } else {
              matchedUnavailable.push(disease);
            }
          }
        });
      }

      // 연관 질환 제외한 가용 질환
      const otherAvailableDiseases = Object.entries(severeData.severeStatus)
        .filter(([key, status]) => status === 'Y' && key !== selectedSevereType && !matchedSevereKeys.includes(key))
        .map(([key]) => SEVERE_TYPES.find(t => t.key === key))
        .filter((t): t is typeof SEVERE_TYPES[0] => !!t);

      // 연관 질환이나 수용가능 질환이 있을 때만 카드 표시
      const hasMatchedContent = matchedAvailable.length > 0 || matchedUnavailable.length > 0;
      const hasOtherContent = otherAvailableDiseases.length > 0;

      // 전체 가용 개수 계산
      const totalAvailable = matchedAvailable.length + otherAvailableDiseases.length;

      if (hasMatchedContent || hasOtherContent) {
        content += `<div style="padding:8px 12px;border-bottom:1px solid ${c.border};">`;

        // 통합 타이틀: 실시간 중증질환
        content += `<div style="font-size:10px;color:${c.muted};margin-bottom:6px;">실시간 중증질환 (${totalAvailable}/${SEVERE_TYPES.length})</div>`;

        // 연관 질환 섹션 (상위 배치)
        if (hasMatchedContent) {
          // 가용 질환
          if (matchedAvailable.length > 0) {
            const availableLabels = matchedAvailable.map(d => d.label.replace(/\[.*?\]\s*/, '')).join(', ');
            content += `
              <div style="display:flex;align-items:baseline;gap:4px;margin-bottom:${matchedUnavailable.length > 0 ? '4px' : '0'};">
                <span style="font-size:10px;color:${isDarkMode ? '#6ee7b7' : '#22c55e'};">○</span>
                <span style="font-size:10px;color:${isDarkMode ? '#a7f3d0' : '#16a34a'};line-height:1.4;">${availableLabels}</span>
              </div>
            `;
          }

          // 불가 질환
          if (matchedUnavailable.length > 0) {
            const unavailableLabels = matchedUnavailable.map(d => d.label.replace(/\[.*?\]\s*/, '')).join(', ');
            content += `
              <div style="display:flex;align-items:baseline;gap:4px;">
                <span style="font-size:10px;color:${isDarkMode ? '#fca5a5' : '#ef4444'};">✕</span>
                <span style="font-size:10px;color:${isDarkMode ? '#fecaca' : '#dc2626'};line-height:1.4;">${unavailableLabels}</span>
              </div>
            `;
          }
        }

        // 기타 가용 질환 (연관 없는 질환) - 시각적 구분
        if (hasOtherContent) {
          if (hasMatchedContent) {
            content += `<div style="border-top:1px dashed ${c.border};margin:6px 0;"></div>`;
          }

          const displayCount = Math.min(6, otherAvailableDiseases.length);
          const labels = otherAvailableDiseases.slice(0, displayCount).map(d => d.label.replace(/\[.*?\]\s*/, '')).join(', ');
          const more = otherAvailableDiseases.length > displayCount ? ` +${otherAvailableDiseases.length - displayCount}` : '';
          content += `
            <div style="display:flex;align-items:baseline;gap:4px;">
              <span style="font-size:10px;color:${isDarkMode ? '#6ee7b7' : '#22c55e'};">○</span>
              <span style="font-size:10px;color:${isDarkMode ? '#a7f3d0' : '#16a34a'};line-height:1.4;">${labels}${more}</span>
            </div>
          `;
        }

        content += `</div>`;
      }
    }

    // 긴급 알림 (진료불가/제한 실제 내용 표시) - 하이라이트 정책 적용 + X 대체 정책
    if (urgentItems.length > 0) {
      content += `
        <div style="padding:8px 12px;background:${isDarkMode ? 'rgba(248,113,113,0.08)' : 'rgba(254,202,202,0.5)'};border-bottom:1px solid ${c.border};">
          ${urgentItems.slice(0, 3).map(item => `
            <div style="font-size:10px;line-height:1.5;">
              <span style="font-weight:600;color:${isDarkMode ? '#fca5a5' : '#ef4444'};">${item.label} </span><span class="dger-tooltip" style="color:${c.muted};"><span>${renderHighlightedMessage(normalizeMessageForDisplay(item.content), isDarkMode)}</span><span class="dger-tooltip-content ${isDarkMode ? 'is-dark' : 'is-light'}">${renderTooltipMessage(item.content, isDarkMode)}</span></span>
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
  }, [bedDataMap, severeDataMap, emergencyMessages, selectedSevereType, selectedDiseaseCategory, selectedDiseases, diseaseStatusMap, isDark]);

  const showPopup = useCallback((hospital: Hospital) => {
    if (!map.current || !hospital.lat || !hospital.lng) return;
    if (popupRef.current) {
      popupRef.current.remove();
    }
    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 15,
      className: `maplibre-popup-custom ${isDark ? 'popup-dark' : 'popup-light'}`,
    })
      .setLngLat([hospital.lng, hospital.lat])
      .setHTML(createPopupContent(hospital, isDark))
      .addTo(map.current);
  }, [createPopupContent, isDark]);

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
  // 최적화: requestAnimationFrame으로 배치 렌더링하여 TBT 감소
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    // 기존 배치 작업 취소
    batchRenderIdRef.current += 1;
    const currentBatchId = batchRenderIdRef.current;

    // 기존 마커 제거
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    // 마커 생성 함수 (단일 마커)
    const createSingleMarker = (hospital: Hospital) => {
      if (!hospital.lat || !hospital.lng || !map.current) return;

      const el = createMarkerElementCallback(hospital, false);

      // 호버 이벤트
      el.addEventListener('mouseenter', () => {
        el.classList.add('marker-hovered');
        onHospitalHover?.(hospital.code);
        if (!pinnedPopupCodeRef.current) {
          showPopup(hospital);
        }
      });

      el.addEventListener('mouseleave', () => {
        el.classList.remove('marker-hovered');
        onHospitalHover?.(null);
        if (!pinnedPopupCodeRef.current) {
          popupRef.current?.remove();
        }
      });

      el.addEventListener('click', (event) => {
        event.stopPropagation();
        if (pinnedPopupCodeRef.current === hospital.code) {
          pinnedPopupCodeRef.current = null;
          popupRef.current?.remove();
          popupRef.current = null;
          return;
        }
        pinnedPopupCodeRef.current = hospital.code;
        showPopup(hospital);
        onHospitalClick?.(hospital);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([hospital.lng!, hospital.lat!])
        .addTo(map.current!);

      markersRef.current.set(hospital.code, marker);
    };

    // 배치 렌더링 (청크 단위로 분할)
    const BATCH_SIZE = 25;  // 프레임당 처리할 마커 수
    let currentIndex = 0;

    const renderBatch = () => {
      // 배치 ID가 변경되었으면 중단 (새 배치 작업이 시작됨)
      if (batchRenderIdRef.current !== currentBatchId) return;

      const endIndex = Math.min(currentIndex + BATCH_SIZE, filteredHospitals.length);

      for (let i = currentIndex; i < endIndex; i++) {
        createSingleMarker(filteredHospitals[i]);
      }

      currentIndex = endIndex;

      // 아직 처리할 마커가 남아있으면 다음 프레임에 계속
      if (currentIndex < filteredHospitals.length) {
        requestAnimationFrame(renderBatch);
      }
    };

    // 첫 배치 시작 (다음 프레임에)
    requestAnimationFrame(renderBatch);
  }, [filteredHospitals, isLoaded, createMarkerElementCallback, showPopup, onHospitalHover, onHospitalClick]);

  useEffect(() => {
    if (!map.current || !isLoaded) return;
    const handleMapClick = () => {
      pinnedPopupCodeRef.current = null;
      popupRef.current?.remove();
      popupRef.current = null;
      onHospitalHover?.(null);
    };
    map.current.on('click', handleMapClick);
    return () => {
      map.current?.off('click', handleMapClick);
    };
  }, [isLoaded, onHospitalHover]);

  // 10km 반경 원 표시/숨김
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    const sourceId = 'user-location-radius';
    const fillLayerId = 'user-location-radius-fill';
    const lineLayerId = 'user-location-radius-line';

    // 기존 레이어 및 소스 제거
    if (map.current.getLayer(lineLayerId)) {
      map.current.removeLayer(lineLayerId);
    }
    if (map.current.getLayer(fillLayerId)) {
      map.current.removeLayer(fillLayerId);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }

    // 내위치순이 활성화되고 위치가 있을 때만 10km 반경 원 표시
    if (showLocationRadius && userLocation) {
      // 10km 반경 원을 GeoJSON 폴리곤으로 생성
      const center = [userLocation.lng, userLocation.lat];
      const radiusKm = 10;
      const points = 64;
      const coords = [];

      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * 360;
        const rad = (angle * Math.PI) / 180;
        // 위도/경도 기반 거리 계산 (근사값)
        const lat = userLocation.lat + (radiusKm / 111) * Math.sin(rad);
        const lng = userLocation.lng + (radiusKm / (111 * Math.cos(userLocation.lat * Math.PI / 180))) * Math.cos(rad);
        coords.push([lng, lat]);
      }

      map.current.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [coords]
          }
        }
      });

      // 채우기 레이어
      map.current.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': 'rgba(34, 197, 94, 0.1)',
          'fill-opacity': isDark ? 0.8 : 1
        }
      });

      // 테두리 레이어
      map.current.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': isDark ? 'rgba(34, 197, 94, 0.5)' : 'rgba(34, 197, 94, 0.6)',
          'line-width': 1.5,
          'line-dasharray': [6, 4]
        }
      });
    }
  }, [isLoaded, showLocationRadius, userLocation, isDark]);

  // 마커에 이벤트 리스너 연결 헬퍼 함수
  const attachMarkerEventListeners = useCallback((el: HTMLElement, hospital: Hospital) => {
    el.addEventListener('mouseenter', () => {
      el.classList.add('marker-hovered');
      onHospitalHover?.(hospital.code);

      // 팝업 표시
      if (!pinnedPopupCodeRef.current) {
        showPopup(hospital);
      }
    });

    el.addEventListener('mouseleave', () => {
      el.classList.remove('marker-hovered');
      onHospitalHover?.(null);
      if (!pinnedPopupCodeRef.current) {
        popupRef.current?.remove();
      }
    });

    el.addEventListener('click', (event) => {
      event.stopPropagation();
      if (pinnedPopupCodeRef.current === hospital.code) {
        pinnedPopupCodeRef.current = null;
        popupRef.current?.remove();
        popupRef.current = null;
        return;
      }
      pinnedPopupCodeRef.current = hospital.code;
      showPopup(hospital);
      onHospitalClick?.(hospital);
    });
  }, [onHospitalHover, onHospitalClick, showPopup]);

  // 외부 호버 상태 변경 시 마커 스타일 + 팝업 표시
  // 최적화: DOM 재생성 대신 CSS 클래스 토글만 수행
  useEffect(() => {
    if (!isLoaded || !map.current) return;

    if (pinnedPopupCodeRef.current) {
      return;
    }

    const prevCode = prevHoveredCodeRef.current;
    const newCode = hoveredHospitalCode;

    // 동일한 마커면 아무것도 하지 않음
    if (prevCode === newCode) return;

    // 이전 호버 마커에서 클래스 제거
    if (prevCode) {
      const prevMarker = markersRef.current.get(prevCode);
      if (prevMarker) {
        const el = prevMarker.getElement();
        el.classList.remove('marker-hovered');
      }
      // 이전 팝업 제거
      popupRef.current?.remove();
    }

    // 새 호버 마커에 클래스 추가 + 팝업 표시
    if (newCode) {
      const newMarker = markersRef.current.get(newCode);
      const hospital = filteredHospitals.find(h => h.code === newCode);

      if (newMarker && hospital) {
        const el = newMarker.getElement();
        el.classList.add('marker-hovered');

        // 팝업 표시
        showPopup(hospital);
      }
    }

    // 현재 호버 코드 저장
    prevHoveredCodeRef.current = newCode;
  }, [hoveredHospitalCode, filteredHospitals, isLoaded, showPopup]);

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
          <div className={`absolute top-full right-0 mt-2 px-2 py-1 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 ${isDark ? 'text-white bg-gray-900' : 'text-gray-900 bg-white'}`}>
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
