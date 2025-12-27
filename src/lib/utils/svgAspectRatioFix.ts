/**
 * SVG 종횡비 보정 유틸리티
 * SVG viewBox에 맞게 좌표 범위를 조정
 */

interface RegionBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// 시도별 SVG viewBox 비율 (width:height)
const SVG_ASPECT_RATIOS: Record<string, number> = {
  "서울특별시": 1.2,
  "부산광역시": 0.9,
  "대구광역시": 1.1,
  "인천광역시": 0.7,
  "광주광역시": 1.0,
  "대전광역시": 1.0,
  "울산광역시": 0.9,
  "세종특별자치시": 0.8,
  "경기도": 1.0,
  "강원특별자치도": 1.2,
  "충청북도": 0.8,
  "충청남도": 1.1,
  "전북특별자치도": 1.3,
  "전라남도": 1.2,
  "경상북도": 0.9,
  "경상남도": 1.3,
  "제주특별자치도": 1.5,
};

/**
 * SVG 종횡비에 맞게 좌표 범위 정규화
 */
export function calculateNormalizedBoundsForSvg(
  bounds: RegionBounds,
  selectedRegion: string
): RegionBounds {
  const targetRatio = SVG_ASPECT_RATIOS[selectedRegion] || 1.0;

  const latRange = bounds.maxLat - bounds.minLat;
  const lngRange = bounds.maxLng - bounds.minLng;
  const currentRatio = lngRange / latRange;

  if (currentRatio > targetRatio) {
    // 경도 범위가 더 넓음 - 위도 범위 확장
    const newLatRange = lngRange / targetRatio;
    const latPadding = (newLatRange - latRange) / 2;
    return {
      minLat: bounds.minLat - latPadding,
      maxLat: bounds.maxLat + latPadding,
      minLng: bounds.minLng,
      maxLng: bounds.maxLng,
    };
  } else {
    // 위도 범위가 더 넓음 - 경도 범위 확장
    const newLngRange = latRange * targetRatio;
    const lngPadding = (newLngRange - lngRange) / 2;
    return {
      minLat: bounds.minLat,
      maxLat: bounds.maxLat,
      minLng: bounds.minLng - lngPadding,
      maxLng: bounds.maxLng + lngPadding,
    };
  }
}
