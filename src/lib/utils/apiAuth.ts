/**
 * API 인증 유틸리티 (Fail-open 방식)
 *
 * 원칙:
 * - DGER_INTERNAL_API_KEY가 설정됨 → 키 검증 필수
 * - DGER_INTERNAL_API_KEY가 미설정 → 모든 요청 허용 (경고 로그만)
 */

let warnedMissingKey = false;

/**
 * API 키가 설정되어 있는지 확인
 */
export function isApiKeyRequired() {
  return Boolean(process.env.DGER_INTERNAL_API_KEY);
}

/**
 * 쓰기 요청 인증 검사 (Fail-open)
 * - 키 미설정 → 허용 (경고만)
 * - 키 설정됨 → 헤더 검증
 */
export function isAuthorizedRequest(headerValue?: string | null) {
  const requiredKey = process.env.DGER_INTERNAL_API_KEY;

  // API 키가 설정되지 않은 경우 → 모든 요청 허용 (Fail-open)
  if (!requiredKey) {
    if (process.env.NODE_ENV === 'production' && !warnedMissingKey) {
      console.warn('[api-auth] DGER_INTERNAL_API_KEY 미설정. 쓰기 API가 보호되지 않습니다.');
      warnedMissingKey = true;
    }
    return true; // ← Fail-open: 키 없으면 허용
  }

  // API 키가 설정된 경우 → 헤더 검증
  if (!headerValue) return false;
  return headerValue === requiredKey;
}
