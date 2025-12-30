/**
 * 마커 렌더링 공통 유틸
 * HTML 기반 마커 생성 (MapLibre와 SVG 맵에서 모두 사용)
 */

import type { Hospital } from '@/types';
import { getMarkerConfig, getMarkerSize, type MarkerShape } from './markerConfig';
import { getMarkerColorByBedStatus } from './markerColors';
import type { HospitalBedData } from '@/lib/hooks/useBedData';
import type { AvailabilityStatus } from '@/types';
import { shortenHospitalName } from './hospitalUtils';

export interface MarkerElementStyle {
  width: string;
  height: string;
  backgroundColor: string;
  boxShadow: string;
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

const AVAILABILITY_RING_COLORS: Record<AvailabilityStatus, string> = {
  '24시간': '#22c55e',
  '주간': '#3b82f6',
  '야간': '#ef4444',
  '불가': '#cbd5e1',
};

function getAvailabilityRingStyle(status?: AvailabilityStatus): { color: string; width: number } {
  if (!status) return { color: 'transparent', width: 0 };
  return {
    color: AVAILABILITY_RING_COLORS[status] || 'transparent',
    width: 2,
  };
}

function getMarkerLabel(hospital: Hospital): string {
  const shortName = shortenHospitalName(hospital.name || '');
  const compact = shortName.replace(/\s+/g, '');
  return Array.from(compact).slice(0, 1).join('') || '';
}

function getContainerSize(): number {
  return 32;
}

function getRingSize(baseSize: number): number {
  return Math.min(Math.max(baseSize + 10, 18), 26);
}


export function getMarkerPath(shape: MarkerShape): string {
  switch (shape) {
    case 'diamond':
      return 'M12 2l8 10-8 10-8-10 8-10z';
    case 'square':
      return 'M5 5h14v14H5z';
    case 'triangle':
      return 'M12 4l8 16H4l8-16z';
    case 'circle':
    default:
      return 'M12 4a8 8 0 110 16 8 8 0 010-16z';
  }
}

/**
 * HTML 마커 요소 생성 (MapLibre용)
 * @param hospital 병원 정보
 * @param bedDataMap 병상 데이터 맵
 * @param isHovered 호버 상태
 * @param diseaseStatus 42개 자원조사 가용상태
 * @returns HTML 요소
 */
export function createMarkerElement(
  hospital: Hospital,
  bedDataMap?: Map<string, HospitalBedData>,
  isHovered: boolean = false,
  diseaseStatus?: AvailabilityStatus,
  useAbsolutePosition: boolean = false
): HTMLElement {
  const container = document.createElement('div');
  const color = getMarkerColorByBedStatus(hospital, bedDataMap);
  const size = getMarkerSize(hospital, false);
  const containerSize = getContainerSize();
  const ringSize = getRingSize(size);
  const style = getMarkerStyle(hospital, color, size, isHovered);
  const ringStyle = getAvailabilityRingStyle(diseaseStatus);
  const label = getMarkerLabel(hospital);

  container.className = 'map-marker-root';
  if (isHovered) {
    container.classList.add('marker-hovered');
  }
  container.style.cursor = 'pointer';
  container.style.width = `${containerSize}px`;
  container.style.height = `${containerSize}px`;
  if (useAbsolutePosition) {
    container.classList.add('maplibregl-marker');
    container.style.position = 'absolute';
  } else {
    container.style.position = 'relative';
  }
  container.style.overflow = 'visible';

  const ring = document.createElement('div');
  ring.className = 'map-marker-ring';
  ring.style.borderColor = ringStyle.color;
  ring.style.borderWidth = `${ringStyle.width}px`;
  ring.style.width = `${ringSize}px`;
  ring.style.height = `${ringSize}px`;
  // ringShape는 항상 'circle' - 원형 테두리
  ring.style.borderRadius = '9999px';

  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  shape.setAttribute('viewBox', '0 0 24 24');
  shape.setAttribute('width', `${size}`);
  shape.setAttribute('height', `${size}`);
  shape.classList.add('map-marker-shape');
  shape.style.width = `${size}px`;
  shape.style.height = `${size}px`;

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', getMarkerPath(getMarkerConfig(hospital).shape));
  path.setAttribute('fill', style.backgroundColor);
  path.setAttribute('stroke', 'rgba(0,0,0,0.2)');
  path.setAttribute('stroke-width', '1');
  shape.appendChild(path);

  const labelEl = document.createElement('div');
  labelEl.className = 'map-marker-label';
  labelEl.textContent = label;
  labelEl.style.width = `${ringSize}px`;
  labelEl.style.height = `${ringSize}px`;

  container.appendChild(ring);
  container.appendChild(shape);
  container.appendChild(labelEl);

  return container;
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
  shape: MarkerShape;
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
