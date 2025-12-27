/**
 * 좌표 보정 유틸리티
 * SVG 지도와 실제 지리 좌표 간의 변환을 위한 함수들
 */

import type { Hospital } from "@/types";

interface RegionBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// 보정된 지역별 좌표 경계
export const CALIBRATED_REGION_BOUNDS: Record<string, RegionBounds> = {
  "서울특별시": { minLat: 37.41, maxLat: 37.72, minLng: 126.75, maxLng: 127.21 },
  "부산광역시": { minLat: 34.87, maxLat: 35.39, minLng: 128.76, maxLng: 129.34 },
  "대구광역시": { minLat: 35.68, maxLat: 36.22, minLng: 128.24, maxLng: 129.01 },
  "인천광역시": { minLat: 37.13, maxLat: 37.80, minLng: 126.00, maxLng: 126.82 },
  "광주광역시": { minLat: 35.02, maxLat: 35.29, minLng: 126.62, maxLng: 127.03 },
  "대전광역시": { minLat: 36.17, maxLat: 36.51, minLng: 127.22, maxLng: 127.57 },
  "울산광역시": { minLat: 35.35, maxLat: 35.75, minLng: 128.93, maxLng: 129.51 },
  "세종특별자치시": { minLat: 36.40, maxLat: 36.72, minLng: 127.01, maxLng: 127.43 },
  "경기도": { minLat: 36.85, maxLat: 38.32, minLng: 126.33, maxLng: 127.88 },
  "강원특별자치도": { minLat: 37.00, maxLat: 38.62, minLng: 127.05, maxLng: 129.40 },
  "충청북도": { minLat: 35.97, maxLat: 37.30, minLng: 127.21, maxLng: 128.44 },
  "충청남도": { minLat: 35.94, maxLat: 37.08, minLng: 125.89, maxLng: 127.37 },
  "전북특별자치도": { minLat: 35.24, maxLat: 36.17, minLng: 126.32, maxLng: 127.94 },
  "전라남도": { minLat: 33.91, maxLat: 35.55, minLng: 125.01, maxLng: 127.92 },
  "경상북도": { minLat: 35.56, maxLat: 37.30, minLng: 128.24, maxLng: 130.97 },
  "경상남도": { minLat: 34.52, maxLat: 35.94, minLng: 127.52, maxLng: 129.27 },
  "제주특별자치도": { minLat: 33.05, maxLat: 34.24, minLng: 126.08, maxLng: 127.02 },
};

/**
 * 위도/경도를 SVG 좌표로 변환 (Affine 변환)
 */
export function latLngToSvgAffine(
  lat: number,
  lng: number,
  bounds: RegionBounds,
  width: number,
  height: number
): { x: number; y: number } {
  const { minLat, maxLat, minLng, maxLng } = bounds;

  // 정규화된 좌표 계산 (0~1 범위)
  const normalizedLng = (lng - minLng) / (maxLng - minLng);
  const normalizedLat = (lat - minLat) / (maxLat - minLat);

  // SVG 좌표로 변환 (y축은 반전)
  const x = normalizedLng * width;
  const y = (1 - normalizedLat) * height;

  return { x, y };
}

/**
 * 병원 목록에서 좌표 경계 계산
 */
export function calculateBoundsFromHospitals(
  hospitals: Hospital[],
  selectedRegion: string
): RegionBounds | null {
  if (!hospitals || hospitals.length === 0) return null;

  const validHospitals = hospitals.filter(
    (h) => h.lat !== null && h.lng !== null &&
           !isNaN(h.lat) && !isNaN(h.lng) &&
           h.lat !== 0 && h.lng !== 0
  );

  if (validHospitals.length < 2) return null;

  const lats = validHospitals.map((h) => h.lat as number);
  const lngs = validHospitals.map((h) => h.lng as number);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // 패딩 추가 (10%)
  const latPadding = (maxLat - minLat) * 0.1;
  const lngPadding = (maxLng - minLng) * 0.1;

  return {
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
    minLng: minLng - lngPadding,
    maxLng: maxLng + lngPadding,
  };
}
