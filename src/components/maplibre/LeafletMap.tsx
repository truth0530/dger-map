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
import type { Hospital } from '@/types';
import type { HospitalBedData } from '@/lib/hooks/useBedData';
import type { HospitalSevereData } from '@/lib/hooks/useSevereData';
import type { ClassifiedMessages } from '@/lib/utils/messageClassifier';
import { SEVERE_TYPES } from '@/lib/constants/dger';
import { createMarkerElement } from '@/lib/utils/markerRenderer';
import { parseMessage } from '@/lib/utils/messageClassifier';
import { useTheme } from '@/lib/contexts/ThemeContext';

type SevereTypeKey = typeof SEVERE_TYPES[number]['key'];

interface LeafletMapProps {
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
  selectedClassifications,
  hoveredHospitalCode,
  onHospitalHover,
  onHospitalClick,
}: LeafletMapProps) {
  const { isDark } = useTheme();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const popupRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [tileLayer, setTileLayer] = useState<'osm' | 'light' | 'dark' | 'neutral' | 'minimal' | 'pure_dark'>('light');

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

  // 팝업 내용 생성 (MapLibreMap과 동일)
  const createPopupContent = useCallback((hospital: Hospital, isDarkMode: boolean = true): string => {
    const bedData = bedDataMap?.get(hospital.code);
    const severeData = severeDataMap?.get(hospital.code);
    const msgData = emergencyMessages?.get(hospital.code);
    const classInfo = getClassificationInfo(hospital.classification);

    let content = `
      <div class="popup-content ${isDarkMode ? '' : 'popup-light'}">
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
  }, [bedDataMap, severeDataMap, emergencyMessages, isDark]);

  // 타일 레이어 URL 및 설정
  const getTileLayerConfig = (layer: 'osm' | 'light' | 'dark' | 'neutral' | 'minimal' | 'pure_dark') => {
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
      case 'minimal':
        return {
          url: 'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png',
          attribution:
            '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 20,
        };
      case 'pure_dark':
        return {
          url: 'https://tiles.stadiamaps.com/tiles/stamen_toner_background/{z}/{x}/{y}.png',
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

      // 팝업 표시/숨김 함수
      const showPopup = () => {
        if (popupRef.current) {
          popupRef.current.remove();
        }

        const popupElement = window.L.popup({
          closeButton: false,
          closeOnClick: false,
          offset: [15, 0],
          className: 'leaflet-popup-custom',
        })
          .setLatLng([hospital.lat!, hospital.lng!])
          .setContent(createPopupContent(hospital, isDark))
          .addTo(mapInstance.current);

        popupRef.current = popupElement;
      };

      const hidePopup = () => {
        popupRef.current?.remove();
        popupRef.current = null;
      };

      // 호버 이벤트 - MapLibreMap과 동일하게 처리
      customMarker.on('mouseover', () => {
        if (onHospitalHover) {
          onHospitalHover(hospital.code);
        }
        showPopup();
      });

      customMarker.on('mouseleave', () => {
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

  // hoveredHospitalCode 변경 시 팝업 표시/숨김
  useEffect(() => {
    if (!mapInstance.current || !leafletLoaded) return;

    // 이전 팝업 닫기
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    // 새로운 병원 팝업 표시
    if (hoveredHospitalCode) {
      const hospital = hospitals.find(h => h.code === hoveredHospitalCode);
      if (hospital && hospital.lat && hospital.lng) {
        const popupElement = window.L.popup({
          closeButton: false,
          closeOnClick: false,
          offset: [15, 0],
          className: 'leaflet-popup-custom',
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

      {/* 타일 레이어 선택 버튼 */}
      <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2 rounded-lg shadow-lg border bg-white/95 dark:bg-gray-800/90 border-gray-300/50 dark:border-gray-700/50 p-2 pointer-events-auto">
        <button
          onClick={() => setTileLayer('light')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
            tileLayer === 'light'
              ? 'bg-blue-500 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="심플 밝은 스타일 (라벨 없음)"
        >
          Light
        </button>
        <button
          onClick={() => setTileLayer('neutral')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
            tileLayer === 'neutral'
              ? 'bg-blue-500 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="중립적 심플 스타일"
        >
          Neutral
        </button>
        <button
          onClick={() => setTileLayer('minimal')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
            tileLayer === 'minimal'
              ? 'bg-blue-500 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="극도로 심플한 스타일"
        >
          Minimal
        </button>
        <button
          onClick={() => setTileLayer('dark')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
            tileLayer === 'dark'
              ? 'bg-blue-500 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="어두운 스타일"
        >
          다크
        </button>
        <button
          onClick={() => setTileLayer('pure_dark')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
            tileLayer === 'pure_dark'
              ? 'bg-blue-500 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="검은 배경에 경계선만 (극도로 심플)"
        >
          Pure Dark
        </button>
        <button
          onClick={() => setTileLayer('osm')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
            tileLayer === 'osm'
              ? 'bg-blue-500 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="기본 OpenStreetMap"
        >
          기본
        </button>
      </div>

    </div>
  );
}
