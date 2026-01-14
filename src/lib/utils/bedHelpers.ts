/**
 * 병상 상태 관련 헬퍼 함수
 */

/**
 * 병상 가용률에 따른 색상 클래스 반환
 * @param available 가용 병상 수
 * @param total 총 병상 수
 * @param isDark 다크모드 여부
 */
export const getBedStatusClass = (available: number, total: number, isDark: boolean = true): string => {
  if (total === 0) return isDark ? 'text-gray-500' : 'text-gray-400';
  const percentage = (available / total) * 100;
  if (percentage <= 5) return isDark ? 'text-red-400' : 'text-red-600';
  if (percentage <= 40) return isDark ? 'text-yellow-400' : 'text-yellow-600';
  return isDark ? 'text-green-400' : 'text-green-600';
};

/**
 * 병상 값 렌더링 (가용/총계, 총계가 0이면 -)
 * @param available 가용 병상 수
 * @param total 총 병상 수
 */
export const renderBedValue = (available: number, total: number): string => {
  if (total === 0) return '-';
  return `${available}/${total}`;
};
