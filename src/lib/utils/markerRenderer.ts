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
  '불가': '#9ca3af',
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

function getScaledMarkerSize(baseSize: number, occupancy: number, maxOccupancy?: number): number {
  if (!maxOccupancy || maxOccupancy <= 0) return baseSize;
  const clamped = Math.max(0, occupancy);
  if (clamped === 0) return Math.max(12, baseSize - 4);
  const ratio = Math.min(1, clamped / maxOccupancy);
  const eased = Math.sqrt(ratio);
  const maxExtra = 20;
  return Math.round(baseSize + eased * maxExtra);
}

function getScaledRingSize(markerSize: number, occupancy: number, maxOccupancy?: number): number {
  if (!maxOccupancy || maxOccupancy <= 0) return markerSize;
  const clamped = Math.max(0, occupancy);
  if (clamped === 0) return Math.max(12, markerSize - 4);
  // 상한 1.5: maxOccupancy의 150%까지 계속 커짐 (17명 기준 25명까지)
  const ratio = Math.min(1.5, clamped / maxOccupancy);
  // pow(1.5): 낮은 값에서 작게, 높은 값에서 크게 (sqrt 반대)
  const eased = Math.pow(ratio, 1.5);
  const maxExtra = 40;
  return Math.round(markerSize + eased * maxExtra);
}

function getHospitalOccupancy(hospital: Hospital, bedDataMap?: Map<string, HospitalBedData>): number {
  const bedData = bedDataMap?.get(hospital.code);
  if (!bedData) return 0;
  if (typeof bedData.occupancy === 'number') {
    return Math.max(0, bedData.occupancy);
  }
  const total = typeof bedData.hvs01 === 'number' ? bedData.hvs01 : 0;
  const available = typeof bedData.hvec === 'number' ? bedData.hvec : 0;
  return Math.max(0, total - available);
}

function getHospitalOccupancyRate(hospital: Hospital, bedDataMap?: Map<string, HospitalBedData>): number {
  const bedData = bedDataMap?.get(hospital.code);
  if (!bedData) return 0;
  if (typeof bedData.occupancyRate === 'number') {
    return Math.max(0, bedData.occupancyRate);
  }
  const total = typeof bedData.hvs01 === 'number' ? bedData.hvs01 : 0;
  const available = typeof bedData.hvec === 'number' ? bedData.hvec : 0;
  const occupied = Math.max(0, total - available);
  return total > 0 ? Math.round((occupied / total) * 100) : 0;
}

type BedStatusTone = 'available' | 'moderate' | 'shortage' | 'unknown';

function getBedStatusTone(hospital: Hospital, bedDataMap?: Map<string, HospitalBedData>): BedStatusTone {
  const bedData = bedDataMap?.get(hospital.code);
  if (bedData && typeof bedData.hvec === 'number') {
    if (bedData.hvec > 5) return 'available';
    if (bedData.hvec > 0) return 'moderate';
    return 'shortage';
  }
  return hospital.hasDiseaseData ? 'available' : 'unknown';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getHaloColor(rate: number, tone: BedStatusTone): { rgb: string; alpha: number } {
  if (tone === 'moderate') {
    const t = Math.pow(clamp((rate - 60) / 34, 0, 1), 0.6);
    const alpha = 0.1 + 0.22 * t;
    return { rgb: '234, 179, 8', alpha };
  }
  if (tone === 'shortage') {
    const t = Math.pow(clamp((rate - 95) / 45, 0, 1), 0.6);
    const alpha = 0.12 + 0.24 * t;
    return { rgb: '239, 68, 68', alpha };
  }
  if (tone === 'unknown') {
    return { rgb: '148, 163, 184', alpha: 0.14 };
  }
  const t = Math.pow(clamp(rate / 60, 0, 1), 0.6);
  const alpha = 0.1 + 0.2 * t;
  return { rgb: '34, 197, 94', alpha };
}

function getHaloBackground(outerRadius: number, color: { rgb: string; alpha: number }): string {
  const outer = Math.max(1, Math.round(outerRadius * 10) / 10);
  const midAlpha = (color.alpha * 0.7).toFixed(3);
  const edgeAlpha = (color.alpha * 0.12).toFixed(3);
  const coreAlpha = (color.alpha * 3.2).toFixed(3);
  return `radial-gradient(circle, rgba(${color.rgb}, ${coreAlpha}) 0%, rgba(${color.rgb}, ${midAlpha}) 55%, rgba(${color.rgb}, ${edgeAlpha}) 100%)`;
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
  useAbsolutePosition: boolean = false,
  maxOccupancy?: number
): HTMLElement {
  const container = document.createElement('div');
  const color = getMarkerColorByBedStatus(hospital, bedDataMap);
  const baseSize = getMarkerSize(hospital, false);
  const containerSize = getContainerSize();
  const occupancy = getHospitalOccupancy(hospital, bedDataMap);
  const occupancyRate = getHospitalOccupancyRate(hospital, bedDataMap);
  const tone = getBedStatusTone(hospital, bedDataMap);
  const size = getScaledMarkerSize(baseSize, occupancy, maxOccupancy);
  const ringSize = getScaledRingSize(size, occupancy, maxOccupancy);
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

  const halo = document.createElement('div');
  halo.className = 'map-marker-halo';
  halo.style.position = 'absolute';
  halo.style.top = '50%';
  halo.style.left = '50%';
  halo.style.transform = 'translate(-50%, -50%)';
  halo.style.width = `${ringSize}px`;
  halo.style.height = `${ringSize}px`;
  halo.style.borderRadius = '9999px';
  halo.style.pointerEvents = 'none';
  halo.style.zIndex = '0';
  halo.style.background = getHaloBackground(ringSize / 2, getHaloColor(occupancyRate, tone));

  const ring = document.createElement('div');
  ring.className = 'map-marker-ring';
  ring.style.borderColor = ringStyle.color;
  ring.style.borderWidth = `${ringStyle.width}px`;
  ring.style.width = `${ringSize}px`;
  ring.style.height = `${ringSize}px`;
  // ringShape는 항상 'circle' - 원형 테두리
  ring.style.borderRadius = '9999px';
  ring.style.zIndex = '1';

  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  shape.setAttribute('viewBox', '0 0 24 24');
  shape.setAttribute('width', `${size}`);
  shape.setAttribute('height', `${size}`);
  shape.classList.add('map-marker-shape');
  shape.style.width = `${size}px`;
  shape.style.height = `${size}px`;
  shape.style.zIndex = '2';

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', getMarkerPath(getMarkerConfig(hospital).shape));
  path.setAttribute('fill', style.backgroundColor);
  path.setAttribute('stroke', 'none');
  path.setAttribute('stroke-width', '0');
  shape.appendChild(path);

  const labelEl = document.createElement('div');
  const fontScale = baseSize > 0 ? size / baseSize : 1;
  labelEl.className = 'map-marker-label';
  labelEl.textContent = label;
  labelEl.style.width = `${ringSize}px`;
  labelEl.style.height = `${ringSize}px`;
  labelEl.style.fontSize = `${Math.max(7, Math.round(9 * fontScale))}px`;
  labelEl.style.position = 'absolute';
  labelEl.style.top = '50%';
  labelEl.style.left = '50%';
  labelEl.style.transform = 'translate(-50%, -50%)';
  labelEl.style.display = 'flex';
  labelEl.style.alignItems = 'center';
  labelEl.style.justifyContent = 'center';
  labelEl.style.color = '#ffffff';
  labelEl.style.fontWeight = '600';
  labelEl.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';
  labelEl.style.pointerEvents = 'none';
  labelEl.style.zIndex = '3';

  container.appendChild(halo);
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
