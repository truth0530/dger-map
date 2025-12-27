/**
 * 마커 색상 유틸 함수
 * 병상 데이터 기반으로 마커 색상을 결정
 */

import type { Hospital } from '@/types';
import type { HospitalBedData } from '@/lib/hooks/useBedData';

// 색상 상수
export const MARKER_COLOR_VALUES = {
  available: '#22c55e',   // 녹색 - 여유있음 (hvec > 5)
  moderate: '#3b82f6',    // 파랑 - 적정수준 (0 < hvec <= 5)
  shortage: '#ef4444',    // 빨강 - 부족 (hvec = 0)
  default: '#22c55e',     // 기본값 (데이터 있음) - 녹색
  unknown: '#6b7280',     // 회색 - 정보없음
};

/**
 * 병상 데이터를 기반으로 마커 색상 반환
 * @param hospital - 병원 정보
 * @param bedDataMap - 병상 데이터 맵
 * @returns 마커 색상 (hex code)
 */
export function getMarkerColorByBedStatus(
  hospital: Hospital,
  bedDataMap?: Map<string, HospitalBedData>
): string {
  // 병상 데이터 기반 색상
  if (bedDataMap) {
    const bedData = bedDataMap.get(hospital.code);
    if (bedData && bedData.hvec !== undefined) {
      if (bedData.hvec > 5) return MARKER_COLOR_VALUES.available;   // 녹색 - 여유있음
      if (bedData.hvec > 0) return MARKER_COLOR_VALUES.moderate;    // 파랑 - 적정수준
      return MARKER_COLOR_VALUES.shortage;                          // 빨강 - 부족
    }
  }

  // 기본값: 데이터 있으면 녹색, 없으면 회색
  return hospital.hasDiseaseData ? MARKER_COLOR_VALUES.default : MARKER_COLOR_VALUES.unknown;
}
