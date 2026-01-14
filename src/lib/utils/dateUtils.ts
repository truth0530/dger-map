/**
 * 날짜 포맷팅 유틸리티
 * 원본: dger-api/public/js/utils.js
 *
 * - PC용: yyyy-MM-dd HH:mm:ss
 * - 모바일용: "n분 전", "n시간 전" 등 상대적 시간
 */

/**
 * 날짜 문자열 파싱 (14자리 숫자 또는 ISO 문자열)
 */
function parseDateString(dateString: string): Date | null {
  if (!dateString || typeof dateString !== 'string') return null;

  // 14자리 숫자 형식: 20240101120000
  if (/^\d{14}$/.test(dateString)) {
    const formatted = `${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}T${dateString.slice(8, 10)}:${dateString.slice(10, 12)}:${dateString.slice(12, 14)}`;
    const d = new Date(formatted);
    return isNaN(d.getTime()) ? null : d;
  }

  // ISO 문자열 또는 기타 파싱 가능한 형식
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 숫자를 2자리로 패딩
 */
function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * 날짜를 yyyy-MM-dd HH:mm:ss 형식(PC용)으로 반환
 */
export function formatDateFull(dateString: string): string {
  const d = parseDateString(dateString);
  if (!d) return '-';

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 날짜를 MM-dd HH:mm 형식(간략)으로 반환
 */
export function formatDateShort(dateString: string): string {
  const d = parseDateString(dateString);
  if (!d) return '-';

  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 날짜를 MM/DD(요일) HH:mm 형식으로 반환
 * 예: 12/27(금) 22:25
 */
export function formatDateWithDay(dateString: string): string {
  const d = parseDateString(dateString);
  if (!d) return '-';

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[d.getDay()];

  return `${d.getMonth() + 1}/${pad(d.getDate())}(${dayName}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 날짜를 'n분 전', 'n시간 전', '방금 전' 등 상대적 시간(모바일용)으로 반환
 */
export function formatDateRelative(dateString: string): string {
  const d = parseDateString(dateString);
  if (!d) return '-';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();

  // 미래 시간인 경우
  if (diffMs < 0) {
    return formatDateShort(dateString);
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHr < 24) return `${diffHr}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;

  // 7일 이상은 날짜로 표시
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 날짜를 HH:mm 형식(시간만)으로 반환
 */
export function formatTimeOnly(dateString: string): string {
  const d = parseDateString(dateString);
  if (!d) return '-';

  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 업데이트 시간 표시 (신선도 강조)
 * - 5분 이내: 방금 업데이트
 * - 30분 이내: n분 전
 * - 1시간 이상: 주의 필요
 */
export function formatUpdateTime(dateString: string): {
  text: string;
  status: 'fresh' | 'recent' | 'stale' | 'unknown';
  color: string;
} {
  const d = parseDateString(dateString);
  if (!d) {
    return { text: '-', status: 'unknown', color: 'text-gray-400' };
  }

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));

  if (diffMin < 5) {
    return { text: '방금 업데이트', status: 'fresh', color: 'text-green-600' };
  }

  if (diffMin < 30) {
    return { text: `${diffMin}분 전`, status: 'recent', color: 'text-blue-600' };
  }

  if (diffMin < 60) {
    return { text: `${diffMin}분 전`, status: 'stale', color: 'text-orange-600' };
  }

  const diffHr = Math.floor(diffMin / 60);
  return { text: `${diffHr}시간 전`, status: 'stale', color: 'text-red-600' };
}

/**
 * Date 객체를 상대 시간으로 변환
 */
export function formatDateObjectRelative(date: Date | null): string {
  if (!date) return '-';
  return formatDateRelative(date.toISOString());
}

/**
 * 현재 시간을 yyyy-MM-dd HH:mm:ss 형식으로 반환
 */
export function getCurrentTimeFormatted(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

/**
 * 업데이트 시간이 지정된 분(기본 30분)보다 오래되었는지 확인
 */
export function isUpdateStale(dateString: string, thresholdMinutes: number = 30): boolean {
  const d = parseDateString(dateString);
  if (!d) return false;

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));

  return diffMin > thresholdMinutes;
}
