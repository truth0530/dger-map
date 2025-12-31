'use client';

/**
 * Leaflet 지도 컴포넌트
 * - OpenStreetMap 기반의 경량 지도
 * - 병원 마커 표시
 * - 지역별 확대/축소
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import '@/styles/popup.css';
import '@/styles/marker.css';
import type { Hospital, AvailabilityStatus } from '@/types';
import type { HospitalBedData } from '@/lib/hooks/useBedData';
import type { HospitalSevereData } from '@/lib/hooks/useSevereData';
import type { ClassifiedMessages } from '@/lib/utils/messageClassifier';
import { SEVERE_TYPES } from '@/lib/constants/dger';
import { getCategoryByKey, getMatchedSevereKeys } from '@/lib/constants/diseaseCategories';
import { createMarkerElement } from '@/lib/utils/markerRenderer';
import { shortenHospitalName } from '@/lib/utils/hospitalUtils';
import { parseMessage, renderHighlightedMessage, replaceUnavailableWithX } from '@/lib/utils/messageClassifier';
import { useTheme } from '@/lib/contexts/ThemeContext';

type SevereTypeKey = typeof SEVERE_TYPES[number]['key'];

interface UserLocation {
  lat: number;
  lng: number;
}

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
  // 사용자 위치 및 10km 반경 표시
  userLocation?: UserLocation | null;
  showLocationRadius?: boolean;
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
  userLocation,
  showLocationRadius,
}: LeafletMapProps) {
  const { isDark } = useTheme();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const popupRef = useRef<any>(null);
  const pinnedPopupCodeRef = useRef<string | null>(null);
  const radiusCircleRef = useRef<any>(null);
  // 콜백 ref - 의존성 배열에서 제거하여 불필요한 마커 재생성 방지
  const onHospitalHoverRef = useRef(onHospitalHover);
  const onHospitalClickRef = useRef(onHospitalClick);
  // createPopupContent ref - 의존성 배열에서 제거하여 불필요한 마커 재생성 방지
  const createPopupContentRef = useRef<((hospital: Hospital, isDarkMode?: boolean) => string) | null>(null);
  // 이전 호버 마커 추적 - 외부(리스트) 호버 처리용
  const prevHoveredCodeRef = useRef<string | null>(null);
  const batchRenderIdRef = useRef<number>(0);  // 배치 렌더링 취소용 ID
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  const filteredHospitals = useMemo(() => {
    return hospitals.filter(h => {
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

  // 콜백 ref 업데이트
  useEffect(() => {
    onHospitalHoverRef.current = onHospitalHover;
    onHospitalClickRef.current = onHospitalClick;
  }, [onHospitalHover, onHospitalClick]);

  // NOTE: 'minimal', 'pure_dark', 'neutral', 'osm' 테마는 지저분해서 사용 금지
  const [tileStyle, setTileStyle] = useState<'clean' | 'classic'>('clean');

  // Leaflet 동적 로드 (npm 패키지에서 - CDN 대신 번들 사용으로 로딩 속도 개선)
  useEffect(() => {
    const loadLeaflet = async () => {
      if (typeof window !== 'undefined') {
        // 이미 로드된 경우 스킵
        if (window.L) {
          setLeafletLoaded(true);
          return;
        }

        // npm 패키지에서 dynamic import (번들에 포함되어 CDN보다 빠름)
        const L = (await import('leaflet')).default;
        window.L = L;
        setLeafletLoaded(true);
      }
    };

    loadLeaflet();
  }, []);

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
        // 다크모드: 차분한 색상, 라이트모드: 선명한 색상
        const statusColor = diseaseStatus === '24시간' ? (isDarkMode ? '#6ee7b7' : '#16a34a')
          : diseaseStatus === '주간' ? (isDarkMode ? '#93c5fd' : '#2563eb')
          : diseaseStatus === '야간' ? (isDarkMode ? '#c4b5fd' : '#7c3aed')
          : '#6b7280';
        const statusBadge = diseaseStatus
          ? `<span style="font-size:10px;font-weight:600;color:${statusColor};background:${isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)'};padding:2px 6px;border-radius:3px;">${diseaseStatus}</span>`
          : '';

        content += `
          <div style="padding:6px 12px;background:${isDarkMode ? 'rgba(147,197,253,0.08)' : 'rgba(219,234,254,0.8)'};border-bottom:1px solid ${c.border};">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:11px;font-weight:600;color:${isDarkMode ? '#93c5fd' : '#2563eb'};">${category.label}</span>
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
        ? (isDarkMode ? 'rgba(110,231,183,0.12)' : 'rgba(220,252,231,0.8)')
        : (isDarkMode ? 'rgba(248,113,113,0.12)' : 'rgba(254,202,202,0.8)');
      // 다크모드: 차분한 색상
      const statusColor = selectedDiseaseStatus.available
        ? (isDarkMode ? '#6ee7b7' : '#16a34a')
        : (isDarkMode ? '#fca5a5' : '#dc2626');
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
          // 가용 질환 - 다크모드에서 차분한 민트 그린
          if (matchedAvailable.length > 0) {
            const availableLabels = matchedAvailable.map(d => d.label.replace(/\[.*?\]\s*/, '')).join(', ');
            content += `
              <div style="display:flex;align-items:baseline;gap:4px;margin-bottom:${matchedUnavailable.length > 0 ? '4px' : '0'};">
                <span style="font-size:10px;color:${isDarkMode ? '#6ee7b7' : '#22c55e'};">○</span>
                <span style="font-size:10px;color:${isDarkMode ? '#a7f3d0' : '#16a34a'};line-height:1.4;">${availableLabels}</span>
              </div>
            `;
          }

          // 불가 질환 - 다크모드에서 차분한 산호색
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
      // 다크모드: 차분한 배경과 텍스트 색상
      const urgentLabelColor = isDarkMode ? '#fca5a5' : '#dc2626';
      content += `
        <div style="padding:8px 12px;background:${isDarkMode ? 'rgba(248,113,113,0.08)' : 'rgba(254,202,202,0.5)'};border-bottom:1px solid ${c.border};">
          ${urgentItems.slice(0, 3).map(item => `
            <div style="font-size:10px;line-height:1.5;">
              <span style="font-weight:600;color:${urgentLabelColor};">${item.label} </span><span style="color:${c.muted};">${renderHighlightedMessage(replaceUnavailableWithX(item.content), isDarkMode)}</span>
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

  // createPopupContent ref 업데이트 - 마커 재생성 없이 최신 함수 참조 유지
  useEffect(() => {
    createPopupContentRef.current = createPopupContent;
  }, [createPopupContent]);

  const showPopup = useCallback((hospital: Hospital) => {
    if (!mapInstance.current || !hospital.lat || !hospital.lng) return;
    if (popupRef.current) {
      popupRef.current.remove();
    }
    popupRef.current = window.L.popup({
      closeButton: false,
      closeOnClick: false,
      autoPan: false,
      offset: [0, -40],
      className: `leaflet-popup-custom ${isDark ? 'popup-dark' : 'popup-light'}`,
    })
      .setLatLng([hospital.lat, hospital.lng])
      .setContent(createPopupContentRef.current?.(hospital, isDark) || '')
      .addTo(mapInstance.current);
  }, [isDark]);

  // 타일 레이어 URL 및 설정
  // NOTE: minimal, pure_dark 테마는 지저분하여 제거됨 (2024-12-28)
  const getTileLayerConfig = (style: 'clean' | 'classic', darkMode: boolean) => {
    if (style === 'classic') {
      return {
        url: darkMode
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        subdomains: 'abcd',
      };
    }

    return {
      url: darkMode
        ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      subdomains: 'abcd',
    };
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
      const tileConfig = getTileLayerConfig(tileStyle, isDark);
      tileLayerRef.current = window.L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: tileConfig.maxZoom,
        subdomains: tileConfig.subdomains || 'abc',
      }).addTo(mapInstance.current);
    }
  }, [leafletLoaded, tileStyle, isDark]);

  // 지역 변경 시 뷰 업데이트
  useEffect(() => {
    if (!mapInstance.current) return;
    const centerPoint = REGION_CENTERS[selectedRegion] || REGION_CENTERS['all'];
    mapInstance.current.setView([centerPoint.lat, centerPoint.lng], centerPoint.zoom);
  }, [selectedRegion]);

  // 타일 레이어 변경
  useEffect(() => {
    if (!mapInstance.current || !tileLayerRef.current) return;

    const tileConfig = getTileLayerConfig(tileStyle, isDark);

    // 기존 타일 레이어 제거
    mapInstance.current.removeLayer(tileLayerRef.current);

    // 새 타일 레이어 추가
    tileLayerRef.current = window.L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
      subdomains: tileConfig.subdomains || 'abc',
    }).addTo(mapInstance.current);
  }, [tileStyle, isDark]);

  // 마커 업데이트
  // 최적화: requestAnimationFrame으로 배치 렌더링하여 TBT 감소
  useEffect(() => {
    if (!leafletLoaded || !mapInstance.current) return;

    // 기존 배치 작업 취소
    batchRenderIdRef.current += 1;
    const currentBatchId = batchRenderIdRef.current;

    // 기존 마커 제거
    markersRef.current.forEach(marker => {
      mapInstance.current.removeLayer(marker);
    });
    markersRef.current.clear();

    // 단일 마커 생성 함수
    const createSingleMarker = (hospital: Hospital) => {
      if (!hospital.lat || !hospital.lng || !mapInstance.current) return;

      const markerElement = createMarkerElement(
        hospital,
        bedDataMap,
        false,  // 초기 생성 시 호버 상태 없음
        diseaseStatusMap?.get(hospital.code),
        false,
        maxOccupancy
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

      // 네이티브 DOM 이벤트 사용 (mouseenter/mouseleave)
      if (markerDom) {
        markerDom.addEventListener('mouseenter', () => {
          markerDom.classList.add('marker-hovered');
          if (!pinnedPopupCodeRef.current) {
            showPopup(hospital);
          }

          onHospitalHoverRef.current?.(hospital.code);
        });

        markerDom.addEventListener('mouseleave', () => {
          markerDom.classList.remove('marker-hovered');
          if (!pinnedPopupCodeRef.current) {
            if (popupRef.current) {
              popupRef.current.remove();
              popupRef.current = null;
            }
          }
          onHospitalHoverRef.current?.(null);
        });
      }

      customMarker.on('click', (event: any) => {
        window.L.DomEvent.stopPropagation(event);
        if (pinnedPopupCodeRef.current === hospital.code) {
          pinnedPopupCodeRef.current = null;
          if (popupRef.current) {
            popupRef.current.remove();
            popupRef.current = null;
          }
          return;
        }
        pinnedPopupCodeRef.current = hospital.code;
        showPopup(hospital);
        if (onHospitalClickRef.current) {
          onHospitalClickRef.current(hospital);
        }
      });

      markersRef.current.set(hospital.code, customMarker);
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
  }, [leafletLoaded, filteredHospitals, bedDataMap, diseaseStatusMap, isDark, maxOccupancy, showPopup]);

  // 10km 반경 원 표시/숨김
  useEffect(() => {
    if (!mapInstance.current || !leafletLoaded) return;

    // 기존 반경 원 제거
    if (radiusCircleRef.current) {
      mapInstance.current.removeLayer(radiusCircleRef.current);
      radiusCircleRef.current = null;
    }

    // 내위치순이 활성화되고 위치가 있을 때만 10km 반경 원 표시
    if (showLocationRadius && userLocation) {
      radiusCircleRef.current = window.L.circle([userLocation.lat, userLocation.lng], {
        radius: 10000, // 10km in meters
        color: isDark ? 'rgba(34, 197, 94, 0.5)' : 'rgba(34, 197, 94, 0.6)',
        fillColor: isDark ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.1)',
        fillOpacity: 1,
        weight: 1.5,
        dashArray: '6, 4',
      }).addTo(mapInstance.current);
    }
  }, [leafletLoaded, showLocationRadius, userLocation, isDark]);

  useEffect(() => {
    if (!mapInstance.current || !leafletLoaded) return;
    const handleMapClick = () => {
      pinnedPopupCodeRef.current = null;
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      onHospitalHoverRef.current?.(null);
    };
    mapInstance.current.on('click', handleMapClick);
    return () => {
      mapInstance.current?.off('click', handleMapClick);
    };
  }, [leafletLoaded]);

  // hoveredHospitalCode 변경 시 팝업 표시/숨김 및 마커 강조
  useEffect(() => {
    if (!mapInstance.current || !leafletLoaded) return;

    if (pinnedPopupCodeRef.current) {
      return;
    }

    // 같은 마커인 경우 무시 (중복 실행 방지)
    if (prevHoveredCodeRef.current === hoveredHospitalCode) {
      return;
    }

    // 이전 호버 마커에서만 hover 클래스 제거 (모든 마커 순회 대신)
    if (prevHoveredCodeRef.current) {
      const prevMarker = markersRef.current.get(prevHoveredCodeRef.current);
      if (prevMarker) {
        const markerDom = prevMarker.getElement?.();
        if (markerDom) {
          markerDom.classList.remove('marker-hovered');
        }
      }
    }

    // 이전 팝업만 제거
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
        showPopup(hospital);
      }
    }

    // 현재 호버 코드 저장
    prevHoveredCodeRef.current = hoveredHospitalCode;
  }, [hoveredHospitalCode, hospitals, isDark, leafletLoaded, showPopup]);

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

      {/* 지도 컨트롤 그룹 (맵 전환 + 타일 스타일 + 줌 + 전체화면) */}
      <div className={`absolute top-4 right-4 z-20 flex items-center gap-2 rounded-lg shadow-lg border p-1.5 pointer-events-auto ${isDark ? 'bg-gray-800/90 border-gray-700/50' : 'bg-white/90 border-gray-300/50'}`}>
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
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${isDark ? 'bg-cyan-600 text-white' : 'bg-cyan-500 text-white'}`}
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

        <div className="relative group">
          <button
            onClick={() => setTileStyle(tileStyle === 'clean' ? 'classic' : 'clean')}
            className={`w-9 h-9 rounded-md transition-all flex items-center justify-center ${isDark ? 'hover:bg-gray-700/80 text-white' : 'hover:bg-gray-200/80 text-gray-900'}`}
          >
            <svg className={`w-4 h-4 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          </button>
          <div className={`absolute top-full right-0 mt-2 px-2 py-1 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 ${isDark ? 'text-white bg-gray-900' : 'text-gray-900 bg-white'}`}>
            {tileStyle === 'clean' ? '지도 스타일 변경' : '데이터 시각화 보기'}
          </div>
        </div>

        {/* 구분선 */}
        <div className={`w-px h-5 ${isDark ? 'bg-gray-700/50' : 'bg-gray-400/50'}`} />

        {/* 줌 인 버튼 */}
        <button
          onClick={() => mapInstance.current?.zoomIn()}
          className={`w-9 h-9 rounded-md transition-all flex items-center justify-center font-bold ${isDark ? 'hover:bg-gray-700/80 text-white' : 'hover:bg-gray-200/80 text-gray-900'}`}
          title="확대"
        >
          +
        </button>

        {/* 줌 아웃 버튼 */}
        <button
          onClick={() => mapInstance.current?.zoomOut()}
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

    </div>
  );
}
