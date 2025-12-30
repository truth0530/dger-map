'use client';

/**
 * Leaflet 지도 컴포넌트
 * - OpenStreetMap 기반의 경량 지도
 * - 병원 마커 표시
 * - 지역별 확대/축소
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import '@/styles/popup.css';
import type { Hospital, AvailabilityStatus } from '@/types';
import type { HospitalBedData } from '@/lib/hooks/useBedData';
import type { HospitalSevereData } from '@/lib/hooks/useSevereData';
import type { ClassifiedMessages } from '@/lib/utils/messageClassifier';
import { SEVERE_TYPES } from '@/lib/constants/dger';
import { getCategoryByKey, getMatchedSevereKeys } from '@/lib/constants/diseaseCategories';
import { createMarkerElement } from '@/lib/utils/markerRenderer';
import { parseMessage, renderHighlightedMessage } from '@/lib/utils/messageClassifier';
import { useTheme } from '@/lib/contexts/ThemeContext';

type SevereTypeKey = typeof SEVERE_TYPES[number]['key'];

interface LeafletMapProps {
  hospitals: Hospital[];
  bedDataMap?: Map<string, HospitalBedData>;
  severeDataMap?: Map<string, HospitalSevereData>;
  emergencyMessages?: Map<string, ClassifiedMessages>;
  selectedRegion: string;
  selectedSevereType?: SevereTypeKey | null;
  selectedDiseaseCategory?: string | null;  // 42개 중증자원조사 대분류 선택
  selectedDiseases?: Set<string>;  // 선택된 소분류 질환명들
  diseaseStatusMap?: Map<string, AvailabilityStatus>;  // 42개 자원조사 가용상태 맵
  selectedClassifications: string[];
  hoveredHospitalCode: string | null;
  onHospitalHover?: (code: string | null) => void;
  onHospitalClick?: (hospital: Hospital) => void;
  onSwitchToMaptiler?: () => void;
  onSwitchToKakao?: () => void;
}

// 지역별 중심 좌표 및 확대 레벨
const REGION_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  'all': { lat: 36.5, lng: 127.5, zoom: 6 },
  '서울특별시': { lat: 37.57, lng: 126.98, zoom: 11 },
  '부산광역시': { lat: 35.18, lng: 129.07, zoom: 11 },
  '대구광역시': { lat: 35.87, lng: 128.60, zoom: 11 },
  '인천광역시': { lat: 37.45, lng: 126.71, zoom: 10 },
  '광주광역시': { lat: 35.16, lng: 126.89, zoom: 11 },
  '대전광역시': { lat: 36.33, lng: 127.39, zoom: 11 },
  '울산광역시': { lat: 35.54, lng: 129.31, zoom: 11 },
  '세종특별자치시': { lat: 36.64, lng: 127.29, zoom: 11 },
  '경기도': { lat: 37.27, lng: 127.01, zoom: 9 },
  '강원특별자치도': { lat: 37.25, lng: 128.30, zoom: 8 },
  '충청북도': { lat: 36.63, lng: 127.93, zoom: 9 },
  '충청남도': { lat: 36.56, lng: 126.80, zoom: 8 },
  '전북특별자치도': { lat: 35.82, lng: 127.11, zoom: 9 },
  '전라남도': { lat: 34.81, lng: 126.89, zoom: 8 },
  '경상북도': { lat: 36.48, lng: 129.09, zoom: 8 },
  '경상남도': { lat: 35.23, lng: 128.59, zoom: 8 },
  '제주특별자치도': { lat: 33.45, lng: 126.57, zoom: 9 },
};

export default function LeafletMap({
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
  onSwitchToMaptiler,
  onSwitchToKakao,
}: LeafletMapProps) {
  const { isDark } = useTheme();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const popupRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  // NOTE: 'minimal'과 'pure_dark' 테마는 지저분해서 사용 금지 (2024-12-28 제거)
  const [tileLayer, setTileLayer] = useState<'osm' | 'light' | 'dark' | 'neutral'>('light');

  // Leaflet 동적 로드
  useEffect(() => {
    // Leaflet 라이브러리 로드
    if (typeof window !== 'undefined' && !window.L) {
      const leafletScript = document.createElement('script');
      leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      leafletScript.async = true;

      const leafletLink = document.createElement('link');
      leafletLink.rel = 'stylesheet';
      leafletLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

      document.head.appendChild(leafletLink);

      leafletScript.onload = () => {
        setLeafletLoaded(true);
      };

      document.head.appendChild(leafletScript);

      return () => {
        if (leafletScript.parentNode) leafletScript.parentNode.removeChild(leafletScript);
        if (leafletLink.parentNode) leafletLink.parentNode.removeChild(leafletLink);
      };
    } else {
      setLeafletLoaded(true);
    }
  }, []);

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

        // 42개 자원조사 가용상태 가져오기
        const diseaseStatus = diseaseStatusMap?.get(hospital.code);
        const statusColor = diseaseStatus === '24시간' ? '#22c55e'
          : diseaseStatus === '주간' ? '#3b82f6'
          : diseaseStatus === '야간' ? '#a855f7'
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
                <span style="font-size:10px;color:#22c55e;">○</span>
                <span style="font-size:10px;color:${isDarkMode ? '#86efac' : '#16a34a'};line-height:1.4;">${availableLabels}</span>
              </div>
            `;
          }

          // 불가 질환
          if (matchedUnavailable.length > 0) {
            const unavailableLabels = matchedUnavailable.map(d => d.label.replace(/\[.*?\]\s*/, '')).join(', ');
            content += `
              <div style="display:flex;align-items:baseline;gap:4px;">
                <span style="font-size:10px;color:#ef4444;">✕</span>
                <span style="font-size:10px;color:${isDarkMode ? '#fca5a5' : '#dc2626'};line-height:1.4;">${unavailableLabels}</span>
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
              <span style="font-size:10px;color:#22c55e;">○</span>
              <span style="font-size:10px;color:${isDarkMode ? '#86efac' : '#16a34a'};line-height:1.4;">${labels}${more}</span>
            </div>
          `;
        }

        content += `</div>`;
      }
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

    // 긴급 알림 (진료불가/제한 실제 내용 표시) - 하이라이트 정책 적용
    if (urgentItems.length > 0) {
      content += `
        <div style="padding:8px 12px;background:${isDarkMode ? 'rgba(239,68,68,0.12)' : 'rgba(254,202,202,0.5)'};border-bottom:1px solid ${c.border};">
          ${urgentItems.slice(0, 3).map(item => `
            <div style="display:flex;gap:6px;font-size:10px;line-height:1.5;">
              <span style="font-weight:600;color:#ef4444;flex-shrink:0;">${item.label}</span>
              <span style="color:${c.muted};">${renderHighlightedMessage(item.content, isDarkMode)}</span>
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

  // 타일 레이어 URL 및 설정
  // NOTE: minimal, pure_dark 테마는 지저분하여 제거됨 (2024-12-28)
  const getTileLayerConfig = (layer: 'osm' | 'light' | 'dark' | 'neutral') => {
    switch (layer) {
      case 'light':
        return {
          url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19,
          subdomains: 'abcd',
        };
      case 'dark':
        return {
          url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19,
          subdomains: 'abcd',
        };
      case 'neutral':
        return {
          url: 'https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}.png',
          attribution:
            '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 20,
        };
      case 'osm':
      default:
        return {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        };
    }
  };

  // 지도 초기화 (1회만)
  useEffect(() => {
    if (!leafletLoaded || !mapContainer.current || !window.L) return;

    if (!mapInstance.current) {
      const centerPoint = REGION_CENTERS[selectedRegion] || REGION_CENTERS['all'];

      mapInstance.current = window.L.map(mapContainer.current).setView(
        [centerPoint.lat, centerPoint.lng],
        centerPoint.zoom
      );

      // 초기 타일 레이어 추가
      const tileConfig = getTileLayerConfig(tileLayer);
      tileLayerRef.current = window.L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: tileConfig.maxZoom,
        subdomains: tileConfig.subdomains || 'abc',
      }).addTo(mapInstance.current);
    }
  }, [leafletLoaded]);

  // 지역 변경 시 뷰 업데이트
  useEffect(() => {
    if (!mapInstance.current) return;
    const centerPoint = REGION_CENTERS[selectedRegion] || REGION_CENTERS['all'];
    mapInstance.current.setView([centerPoint.lat, centerPoint.lng], centerPoint.zoom);
  }, [selectedRegion]);

  // 타일 레이어 변경
  useEffect(() => {
    if (!mapInstance.current || !tileLayerRef.current) return;

    const tileConfig = getTileLayerConfig(tileLayer);

    // 기존 타일 레이어 제거
    mapInstance.current.removeLayer(tileLayerRef.current);

    // 새 타일 레이어 추가
    tileLayerRef.current = window.L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
      subdomains: tileConfig.subdomains || 'abc',
    }).addTo(mapInstance.current);
  }, [tileLayer]);

  // 마커 업데이트
  useEffect(() => {
    if (!leafletLoaded || !mapInstance.current) return;

    // 기존 마커 제거
    markersRef.current.forEach(marker => {
      mapInstance.current.removeLayer(marker);
    });
    markersRef.current.clear();

    // 새 마커 추가
    hospitals.forEach(hospital => {
      if (!hospital.lat || !hospital.lng) return;

      const markerElement = createMarkerElement(
        hospital,
        bedDataMap,
        hoveredHospitalCode === hospital.code
      );

      const customMarker = window.L.marker([hospital.lat, hospital.lng], {
        icon: window.L.divIcon({
          html: markerElement.outerHTML,
          className: 'leaflet-custom-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -16],
        }),
      }).addTo(mapInstance.current);

      // 마커 DOM 요소 참조
      const markerDom = customMarker.getElement();

      // 팝업 표시/숨김 함수
      const showPopup = () => {
        if (popupRef.current) {
          popupRef.current.remove();
        }

        // 마커 강조 효과
        if (markerDom) {
          markerDom.classList.add('marker-hovered');
        }

        const popupElement = window.L.popup({
          closeButton: false,
          closeOnClick: false,
          offset: [0, -40],  // 마커 위쪽으로 충분히 이동
          className: `leaflet-popup-custom ${isDark ? 'popup-dark' : 'popup-light'}`,
        })
          .setLatLng([hospital.lat!, hospital.lng!])
          .setContent(createPopupContent(hospital, isDark))
          .addTo(mapInstance.current);

        popupRef.current = popupElement;
      };

      const hidePopup = () => {
        popupRef.current?.remove();
        popupRef.current = null;
        // 마커 강조 효과 제거
        if (markerDom) {
          markerDom.classList.remove('marker-hovered');
        }
      };

      // 호버 이벤트 - MapLibreMap과 동일하게 처리
      customMarker.on('mouseover', () => {
        if (onHospitalHover) {
          onHospitalHover(hospital.code);
        }
        showPopup();
      });

      customMarker.on('mouseout', () => {
        if (onHospitalHover) {
          onHospitalHover(null);
        }
        hidePopup();
      });

      // 클릭 이벤트
      customMarker.on('click', () => {
        if (onHospitalClick) {
          onHospitalClick(hospital);
        }
      });

      markersRef.current.set(hospital.code, customMarker);
    });
  }, [leafletLoaded, hospitals, bedDataMap, onHospitalClick, onHospitalHover, isDark, createPopupContent]);

  // hoveredHospitalCode 변경 시 팝업 표시/숨김 및 마커 강조
  useEffect(() => {
    if (!mapInstance.current || !leafletLoaded) return;

    // 모든 마커에서 hover 클래스 제거
    markersRef.current.forEach((marker) => {
      const markerDom = marker.getElement?.();
      if (markerDom) {
        markerDom.classList.remove('marker-hovered');
      }
    });

    // 이전 팝업 닫기
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    // 새로운 병원 팝업 표시
    if (hoveredHospitalCode) {
      const hospital = hospitals.find(h => h.code === hoveredHospitalCode);
      const marker = markersRef.current.get(hoveredHospitalCode);

      // 마커 강조 효과 추가
      if (marker) {
        const markerDom = marker.getElement?.();
        if (markerDom) {
          markerDom.classList.add('marker-hovered');
        }
      }

      if (hospital && hospital.lat && hospital.lng) {
        const popupElement = window.L.popup({
          closeButton: false,
          closeOnClick: false,
          offset: [0, -40],  // 마커 위쪽으로 충분히 이동
          className: `leaflet-popup-custom ${isDark ? 'popup-dark' : 'popup-light'}`,
        })
          .setLatLng([hospital.lat, hospital.lng])
          .setContent(createPopupContent(hospital, isDark))
          .addTo(mapInstance.current);

        popupRef.current = popupElement;
      }
    }
  }, [hoveredHospitalCode, hospitals, isDark, createPopupContent, leafletLoaded]);

  if (!leafletLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div className="text-gray-400 text-sm">지도 로딩 중...</div>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none' }}>
      <div
        ref={mapContainer}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
          pointerEvents: 'auto',
        }}
      />

      {/* 지도 컨트롤 그룹 (맵 전환 + 타일 스타일) */}
      <div className={`absolute top-4 right-4 z-50 flex items-center gap-2 rounded-lg shadow-lg border p-1.5 pointer-events-auto ${isDark ? 'bg-gray-800/90 border-gray-700/50' : 'bg-white/90 border-gray-300/50'}`}>
        {/* MapTiler/Leaflet/Kakao 전환 */}
        <div className="flex items-center">
          {onSwitchToMaptiler && (
            <button
              onClick={onSwitchToMaptiler}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${isDark ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200/80'}`}
              title="MapTiler로 전환"
            >
              MapTiler
            </button>
          )}
          <button
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${isDark ? 'bg-green-600 text-white' : 'bg-green-500 text-white'}`}
            title="현재: Leaflet"
          >
            Leaflet
          </button>
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

        {/* 타일 레이어 선택 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTileLayer('light')}
            className={`px-2 py-1 text-xs font-medium rounded transition-all ${
              tileLayer === 'light'
                ? 'bg-green-500 text-white'
                : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
            title="밝은 스타일"
          >
            Light
          </button>
          <button
            onClick={() => setTileLayer('neutral')}
            className={`px-2 py-1 text-xs font-medium rounded transition-all ${
              tileLayer === 'neutral'
                ? 'bg-green-500 text-white'
                : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
            title="중립 스타일"
          >
            Neutral
          </button>
          <button
            onClick={() => setTileLayer('dark')}
            className={`px-2 py-1 text-xs font-medium rounded transition-all ${
              tileLayer === 'dark'
                ? 'bg-green-500 text-white'
                : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
            title="어두운 스타일"
          >
            Dark
          </button>
          <button
            onClick={() => setTileLayer('osm')}
            className={`px-2 py-1 text-xs font-medium rounded transition-all ${
              tileLayer === 'osm'
                ? 'bg-green-500 text-white'
                : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
            title="기본 OSM"
          >
            OSM
          </button>
        </div>
      </div>

    </div>
  );
}
