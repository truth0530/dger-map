'use client';

/**
 * 카카오 지도 컴포넌트
 * - 카카오맵 SDK 기반
 * - 병원 마커 표시
 * - 지역별 확대/축소
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import '@/styles/popup.css';
import type { Hospital } from '@/types';
import type { HospitalBedData } from '@/lib/hooks/useBedData';
import type { HospitalSevereData } from '@/lib/hooks/useSevereData';
import type { ClassifiedMessages } from '@/lib/utils/messageClassifier';
import { SEVERE_TYPES } from '@/lib/constants/dger';
import { getCategoryByKey, getMatchedSevereKeys } from '@/lib/constants/diseaseCategories';
import { parseMessage } from '@/lib/utils/messageClassifier';
import { useTheme } from '@/lib/contexts/ThemeContext';

// 카카오맵 타입 선언
declare global {
  interface Window {
    kakao: any;
  }
}

type SevereTypeKey = typeof SEVERE_TYPES[number]['key'];

interface KakaoMapProps {
  hospitals: Hospital[];
  bedDataMap?: Map<string, HospitalBedData>;
  severeDataMap?: Map<string, HospitalSevereData>;
  emergencyMessages?: Map<string, ClassifiedMessages>;
  selectedRegion: string;
  selectedSevereType?: SevereTypeKey | null;
  selectedDiseaseCategory?: string | null;
  selectedDiseases?: Set<string>;
  selectedClassifications: string[];
  hoveredHospitalCode: string | null;
  onHospitalHover?: (code: string | null) => void;
  onHospitalClick?: (hospital: Hospital) => void;
  onSwitchToMaptiler?: () => void;
  onSwitchToLeaflet?: () => void;
}

// 지역별 중심 좌표 및 확대 레벨
const REGION_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  'all': { lat: 36.5, lng: 127.5, zoom: 7 },
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

// 카카오맵 타입 (일반, 스카이뷰, 하이브리드)
type KakaoMapType = 'roadmap' | 'skyview' | 'hybrid';

export default function KakaoMap({
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
  onSwitchToMaptiler,
  onSwitchToLeaflet,
}: KakaoMapProps) {
  const { isDark } = useTheme();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const overlayRef = useRef<any>(null);
  const [kakaoLoaded, setKakaoLoaded] = useState(false);
  const [mapType, setMapType] = useState<KakaoMapType>('roadmap');

  // 카카오맵 SDK 동적 로드
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.kakao?.maps) {
      const kakaoApiKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;

      if (!kakaoApiKey) {
        console.error('[KakaoMap] NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY 환경변수가 설정되지 않았습니다.');
        return;
      }

      const script = document.createElement('script');
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoApiKey}&autoload=false`;
      script.async = true;

      script.onload = () => {
        window.kakao.maps.load(() => {
          setKakaoLoaded(true);
        });
      };

      script.onerror = () => {
        console.error('[KakaoMap] 카카오맵 SDK 로드 실패');
      };

      document.head.appendChild(script);

      return () => {
        if (script.parentNode) script.parentNode.removeChild(script);
      };
    } else if (window.kakao?.maps) {
      setKakaoLoaded(true);
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

  // 팝업 내용 생성
  const createPopupContent = useCallback((hospital: Hospital): string => {
    const bedData = bedDataMap?.get(hospital.code);
    const severeData = severeDataMap?.get(hospital.code);
    const classInfo = getClassificationInfo(hospital.classification);

    const c = {
      text: isDark ? '#f1f5f9' : '#1f2937',
      subtext: isDark ? '#94a3b8' : '#6b7280',
      bg: isDark ? '#1f2937' : '#F5F0E8',
      border: isDark ? '#374151' : '#d4cdc4',
    };

    let html = `
      <div style="font-family: 'Pretendard', sans-serif; min-width: 200px; max-width: 280px; padding: 12px; background: ${c.bg}; border-radius: 8px; border: 1px solid ${c.border};">
        <div style="font-size: 14px; font-weight: 600; color: ${c.text}; margin-bottom: 6px;">${hospital.name}</div>
        <div style="font-size: 11px; color: ${c.subtext}; margin-bottom: 8px;">${classInfo.name} · ${hospital.address || ''}</div>
    `;

    // 병상 정보
    if (bedData) {
      const available = bedData.hvec || 0;
      const total = bedData.hvs01 || 0;
      const color = getBedStatusColor(available, total);
      html += `
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
          <span style="font-size: 11px; color: ${c.subtext};">응급실</span>
          <span style="font-size: 12px; font-weight: 500; color: ${color};">${available}/${total}</span>
        </div>
      `;
    }

    // 중증질환 정보
    if (severeData && selectedSevereType) {
      const value = (severeData as any)[selectedSevereType];
      if (value !== undefined) {
        const severeType = SEVERE_TYPES.find(s => s.key === selectedSevereType);
        html += `
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 11px; color: ${c.subtext};">${severeType?.label || selectedSevereType}</span>
            <span style="font-size: 12px; font-weight: 500; color: ${value === 'Y' ? '#4ade80' : '#f87171'};">${value === 'Y' ? '가능' : '불가'}</span>
          </div>
        `;
      }
    }

    html += `</div>`;
    return html;
  }, [bedDataMap, severeDataMap, selectedSevereType, isDark]);

  // 마커 이미지 생성
  const getMarkerImage = useCallback((hospital: Hospital) => {
    if (!window.kakao?.maps) return null;

    const bedData = bedDataMap?.get(hospital.code);
    let color = '#6b7280'; // 기본 회색

    if (bedData) {
      const available = bedData.hvec || 0;
      const total = bedData.hvs01 || 0;
      color = getBedStatusColor(available, total);
    }

    // 기관분류에 따른 크기
    let size = 24;
    if (hospital.classification === '권역응급의료센터') size = 32;
    else if (hospital.classification === '지역응급의료센터') size = 28;

    const isHovered = hoveredHospitalCode === hospital.code;
    if (isHovered) size = size * 1.3;

    // SVG 마커
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 1.3}" viewBox="0 0 24 32">
        <path fill="${color}" stroke="${isHovered ? '#fff' : '#000'}" stroke-width="1" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12zm0 18c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/>
        <circle fill="#fff" cx="12" cy="12" r="4"/>
      </svg>
    `;

    const imageSize = new window.kakao.maps.Size(size, size * 1.3);
    const imageOption = { offset: new window.kakao.maps.Point(size / 2, size * 1.3) };

    return new window.kakao.maps.MarkerImage(
      'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
      imageSize,
      imageOption
    );
  }, [bedDataMap, hoveredHospitalCode]);

  // 지도 초기화
  useEffect(() => {
    if (!kakaoLoaded || !mapContainer.current || mapInstance.current) return;

    const { kakao } = window;
    const regionCenter = REGION_CENTERS[selectedRegion] || REGION_CENTERS['all'];

    const options = {
      center: new kakao.maps.LatLng(regionCenter.lat, regionCenter.lng),
      level: 14 - regionCenter.zoom, // 카카오맵 level은 작을수록 확대
    };

    mapInstance.current = new kakao.maps.Map(mapContainer.current, options);

    // 줌 컨트롤 제거 (커스텀 컨트롤 사용)
    // 지도 타입 컨트롤 제거 (커스텀 컨트롤 사용)

    console.log('[KakaoMap] 지도 초기화 완료');
  }, [kakaoLoaded, selectedRegion]);

  // 지역 변경 시 지도 이동
  useEffect(() => {
    if (!mapInstance.current || !kakaoLoaded) return;

    const { kakao } = window;
    const regionCenter = REGION_CENTERS[selectedRegion] || REGION_CENTERS['all'];

    const moveLatLng = new kakao.maps.LatLng(regionCenter.lat, regionCenter.lng);
    mapInstance.current.setCenter(moveLatLng);
    mapInstance.current.setLevel(14 - regionCenter.zoom);
  }, [selectedRegion, kakaoLoaded]);

  // 지도 타입 변경
  useEffect(() => {
    if (!mapInstance.current || !kakaoLoaded) return;

    const { kakao } = window;

    switch (mapType) {
      case 'roadmap':
        mapInstance.current.setMapTypeId(kakao.maps.MapTypeId.ROADMAP);
        break;
      case 'skyview':
        mapInstance.current.setMapTypeId(kakao.maps.MapTypeId.SKYVIEW);
        break;
      case 'hybrid':
        mapInstance.current.setMapTypeId(kakao.maps.MapTypeId.HYBRID);
        break;
    }
  }, [mapType, kakaoLoaded]);

  // 마커 업데이트
  useEffect(() => {
    if (!mapInstance.current || !kakaoLoaded) return;

    const { kakao } = window;

    // 기존 마커 제거
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current.clear();

    // 새 마커 추가
    hospitals.forEach(hospital => {
      if (!hospital.lat || !hospital.lng) return;

      const position = new kakao.maps.LatLng(hospital.lat, hospital.lng);
      const markerImage = getMarkerImage(hospital);

      const marker = new kakao.maps.Marker({
        position,
        image: markerImage,
        map: mapInstance.current,
      });

      // 클릭 이벤트
      kakao.maps.event.addListener(marker, 'click', () => {
        onHospitalClick?.(hospital);
      });

      // 마우스오버 이벤트
      kakao.maps.event.addListener(marker, 'mouseover', () => {
        onHospitalHover?.(hospital.code);

        // 인포윈도우 표시
        if (overlayRef.current) {
          overlayRef.current.setMap(null);
        }

        const content = createPopupContent(hospital);
        overlayRef.current = new kakao.maps.CustomOverlay({
          content: `<div style="transform: translateY(-100%); margin-bottom: 10px;">${content}</div>`,
          position,
          yAnchor: 1,
        });
        overlayRef.current.setMap(mapInstance.current);
      });

      // 마우스아웃 이벤트
      kakao.maps.event.addListener(marker, 'mouseout', () => {
        onHospitalHover?.(null);
        if (overlayRef.current) {
          overlayRef.current.setMap(null);
          overlayRef.current = null;
        }
      });

      markersRef.current.set(hospital.code, marker);
    });
  }, [hospitals, kakaoLoaded, getMarkerImage, createPopupContent, onHospitalClick, onHospitalHover]);

  // 호버 상태 변경 시 마커 업데이트
  useEffect(() => {
    if (!kakaoLoaded) return;

    markersRef.current.forEach((marker, code) => {
      const hospital = hospitals.find(h => h.code === code);
      if (hospital) {
        const newImage = getMarkerImage(hospital);
        if (newImage) {
          marker.setImage(newImage);
        }
      }
    });
  }, [hoveredHospitalCode, hospitals, kakaoLoaded, getMarkerImage]);

  // API 키 없음 경고
  if (!process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-yellow-400 text-lg mb-2">카카오맵 API 키 필요</div>
          <div className="text-gray-400 text-sm">NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY 환경변수를 설정해주세요.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* 로딩 표시 */}
      {!kakaoLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-gray-400 text-sm">카카오맵 로딩 중...</div>
        </div>
      )}

      {/* 지도 컨테이너 */}
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: '100%',
          pointerEvents: 'auto',
        }}
      />

      {/* 지도 컨트롤 그룹 */}
      <div className={`absolute top-4 right-4 z-50 flex items-center gap-2 rounded-lg shadow-lg border p-1.5 pointer-events-auto ${isDark ? 'bg-gray-800/90 border-gray-700/50' : 'bg-white/90 border-gray-300/50'}`}>
        {/* 지도 전환 버튼들 */}
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
          {onSwitchToLeaflet && (
            <button
              onClick={onSwitchToLeaflet}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${isDark ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200/80'}`}
              title="Leaflet으로 전환"
            >
              Leaflet
            </button>
          )}
          <button
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${isDark ? 'bg-yellow-600 text-white' : 'bg-yellow-500 text-white'}`}
            title="현재: 카카오맵"
          >
            카카오
          </button>
        </div>

        {/* 구분선 */}
        <div className={`w-px h-5 ${isDark ? 'bg-gray-700/50' : 'bg-gray-400/50'}`} />

        {/* 지도 타입 선택 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMapType('roadmap')}
            className={`px-2 py-1 text-xs font-medium rounded transition-all ${
              mapType === 'roadmap'
                ? 'bg-yellow-500 text-white'
                : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
            title="일반 지도"
          >
            일반
          </button>
          <button
            onClick={() => setMapType('skyview')}
            className={`px-2 py-1 text-xs font-medium rounded transition-all ${
              mapType === 'skyview'
                ? 'bg-yellow-500 text-white'
                : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
            title="스카이뷰"
          >
            스카이뷰
          </button>
          <button
            onClick={() => setMapType('hybrid')}
            className={`px-2 py-1 text-xs font-medium rounded transition-all ${
              mapType === 'hybrid'
                ? 'bg-yellow-500 text-white'
                : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
            title="하이브리드"
          >
            하이브리드
          </button>
        </div>

        {/* 구분선 */}
        <div className={`w-px h-5 ${isDark ? 'bg-gray-700/50' : 'bg-gray-400/50'}`} />

        {/* 줌 컨트롤 */}
        <button
          onClick={() => mapInstance.current?.setLevel(mapInstance.current.getLevel() - 1)}
          className={`w-9 h-9 rounded-md transition-all flex items-center justify-center font-bold ${isDark ? 'hover:bg-gray-700/80 text-white' : 'hover:bg-gray-200/80 text-gray-900'}`}
          title="확대"
        >
          +
        </button>
        <button
          onClick={() => mapInstance.current?.setLevel(mapInstance.current.getLevel() + 1)}
          className={`w-9 h-9 rounded-md transition-all flex items-center justify-center font-bold ${isDark ? 'hover:bg-gray-700/80 text-white' : 'hover:bg-gray-200/80 text-gray-900'}`}
          title="축소"
        >
          −
        </button>
      </div>
    </div>
  );
}
