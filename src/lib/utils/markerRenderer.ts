/**
 * 마커 렌더링 공통 유틸
 * HTML 기반 마커 생성 (MapLibre와 SVG 맵에서 모두 사용)
 */

import type { Hospital } from '@/types';
import { getMarkerConfig, getMarkerSize } from './markerConfig';
import { getMarkerColorByBedStatus } from './markerColors';
import type { HospitalBedData } from '@/lib/hooks/useBedData';

export interface MarkerElementStyle {
  width: string;
  height: string;
  backgroundColor: string;
  borderRadius?: string;
  clipPath?: string;
  boxShadow: string;
  transform?: string;
  zIndex?: string;
  filter?: string;
}

/**
 * 마커 스타일 객체 생성
 * @param hospital 병원 정보
 * @param color 마커 색상
 * @param size 마커 크기
 * @param isHovered 호버 상태
 * @returns CSS 스타일 객체
 */
export function getMarkerStyle(
  hospital: Hospital,
  color: string,
  size: number,
  isHovered: boolean
): MarkerElementStyle {
  const config = getMarkerConfig(hospital);

  const baseStyle: MarkerElementStyle = {
    width: `${size}px`,
    height: `${size}px`,
    backgroundColor: color,
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
  };

  // 마커 모양별 추가 스타일
  switch (config.shape) {
    case 'square':
      baseStyle.borderRadius = '2px';
      break;
    case 'triangle':
      baseStyle.clipPath = 'polygon(50% 0%, 100% 100%, 0% 100%)';
      break;
    case 'circle':
    default:
      baseStyle.borderRadius = '50%';
      break;
  }

  // 호버 상태 스타일
  if (isHovered) {
    if (config.shape === 'triangle') {
      baseStyle.filter = 'drop-shadow(0 0 0 4px rgba(255,255,255,0.5)) drop-shadow(0 4px 8px rgba(0,0,0,0.4))';
    } else {
      baseStyle.boxShadow = '0 0 0 4px rgba(255,255,255,0.5), 0 4px 8px rgba(0,0,0,0.4)';
    }
    baseStyle.zIndex = '100';
  }

  return baseStyle;
}

/**
 * HTML 마커 요소 생성 (MapLibre용)
 * @param hospital 병원 정보
 * @param bedDataMap 병상 데이터 맵
 * @param isHovered 호버 상태
 * @returns HTML 요소
 */
export function createMarkerElement(
  hospital: Hospital,
  bedDataMap?: Map<string, HospitalBedData>,
  isHovered: boolean = false
): HTMLElement {
  const el = document.createElement('div');
  const color = getMarkerColorByBedStatus(hospital, bedDataMap);
  const size = getMarkerSize(hospital, isHovered);
  const style = getMarkerStyle(hospital, color, size, isHovered);

  el.className = 'maplibre-marker';
  el.style.cursor = 'pointer';
  el.style.transition = 'all 0.15s ease';

  // 모든 스타일 적용
  Object.entries(style).forEach(([key, value]) => {
    if (value !== undefined) {
      el.style[key as any] = value;
    }
  });

  return el;
}

/**
 * SVG 마커 정보 객체 생성 (SVG 지도용)
 * SVG 마커 렌더링에 필요한 정보 반환
 * @param hospital 병원 정보
 * @param bedDataMap 병상 데이터 맵
 * @param isHovered 호버 상태
 * @param isUnavailable 이용불가 상태
 * @returns SVG 마커 정보
 */
export interface SvgMarkerInfo {
  color: string;
  size: number;
  shape: 'diamond' | 'circle' | 'triangle' | 'square';
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
}

export function getSvgMarkerInfo(
  hospital: Hospital,
  bedDataMap?: Map<string, HospitalBedData>,
  isHovered: boolean = false,
  isUnavailable: boolean = false
): SvgMarkerInfo {
  const color = getMarkerColorByBedStatus(hospital, bedDataMap);
  const size = getMarkerSize(hospital, isHovered);
  const config = getMarkerConfig(hospital);

  return {
    color,
    size,
    shape: config.shape,
    strokeColor: isHovered ? '#ffffff' : '#1f2937',
    strokeWidth: isHovered ? 2 : 1,
    opacity: isUnavailable ? 0.5 : 0.9,
  };
}
