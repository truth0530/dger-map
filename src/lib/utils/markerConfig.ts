/**
 * 마커 설정 공통 유틸
 * 병원 분류에 따른 마커 모양과 크기를 통일
 */

import type { Hospital } from '@/types';

export type MarkerShape = 'diamond' | 'circle' | 'triangle' | 'square';

export interface MarkerConfig {
  shape: MarkerShape;
  size: number;
  strokeWidth: number;
  priority: number;
}

/**
 * 병원 분류별 마커 설정
 * - 권역응급의료센터: 사각형 (square)
 * - 지역응급의료센터: 원형 (동그라미)
 * - 지역응급의료기관: 삼각형
 */
export const MARKER_CONFIG_BY_CLASSIFICATION: Record<string, MarkerConfig> = {
  '권역응급의료센터': {
    shape: 'square',
    size: 12,
    strokeWidth: 2,
    priority: 1,
  },
  '지역응급의료센터': {
    shape: 'circle',
    size: 10,
    strokeWidth: 2,
    priority: 2,
  },
  '지역응급의료기관': {
    shape: 'triangle',
    size: 8,
    strokeWidth: 1,
    priority: 3,
  },
  '응급실운영신고기관': {
    shape: 'square',
    size: 8,
    strokeWidth: 1,
    priority: 4,
  },
};

/**
 * 병원의 마커 설정 반환
 * @param hospital - 병원 정보
 * @returns 마커 설정 (모양, 크기, 선 굵기, 우선순위)
 */
export function getMarkerConfig(hospital: Hospital): MarkerConfig {
  const classification = hospital.classification || '지역응급의료기관';
  return (
    MARKER_CONFIG_BY_CLASSIFICATION[classification] ||
    MARKER_CONFIG_BY_CLASSIFICATION['지역응급의료기관']
  );
}

/**
 * 병원의 마커 모양만 반환
 * @param hospital - 병원 정보
 * @returns 마커 모양
 */
export function getMarkerShape(hospital: Hospital): MarkerShape {
  return getMarkerConfig(hospital).shape;
}

/**
 * 병원의 마커 크기 반환 (호버 상태 반영)
 * @param hospital - 병원 정보
 * @param isHovered - 호버 여부
 * @returns 마커 크기
 */
export function getMarkerSize(hospital: Hospital, isHovered: boolean): number {
  const baseSize = getMarkerConfig(hospital).size;
  return isHovered ? baseSize * 1.5 : baseSize;
}
