/**
 * CORS 유틸리티 (Fail-open 방식)
 *
 * 원칙:
 * - Origin 헤더가 있으면 (브라우저 요청) → 화이트리스트 검사
 * - Origin 헤더가 없으면 (서버/curl/직접접속) → 허용 (CORS 미적용 대상)
 * - 개발 환경에서는 localhost 허용
 */

const ALLOWED_ORIGINS = [
  'https://www.dger.kr',
  'https://dger.kr',
  'https://dger-map.vercel.app',
];

const DEFAULT_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';
const DEFAULT_HEADERS = 'Content-Type, x-dger-key';

/**
 * Origin이 허용되는지 확인
 * - Origin이 없으면 true (서버간 통신, curl 등은 CORS 대상이 아님)
 * - Origin이 있으면 화이트리스트 검사
 */
export function isAllowedOrigin(origin?: string | null): boolean {
  // Origin 헤더가 없는 요청은 허용 (서버간 통신, curl, 직접 접속 등)
  // 브라우저의 cross-origin 요청만 Origin 헤더를 포함함
  if (!origin) {
    return true;
  }

  // 프로덕션 허용 목록
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // 개발 환경에서 localhost 허용
  if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost')) {
    return true;
  }

  return false;
}

/**
 * CORS 응답 헤더 생성
 */
export function getCorsHeaders(origin?: string | null): Record<string, string> {
  // 기본값: 첫 번째 허용 Origin
  let allowOrigin = ALLOWED_ORIGINS[0];

  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      allowOrigin = origin;
    } else if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost')) {
      allowOrigin = origin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': DEFAULT_METHODS,
    'Access-Control-Allow-Headers': DEFAULT_HEADERS,
    'Vary': 'Origin',
  };
}

/**
 * CORS 검사 실패 시 403 응답 생성
 */
export function corsErrorResponse(origin?: string | null) {
  const corsHeaders = getCorsHeaders(origin);
  return new Response(
    JSON.stringify({ error: '허용되지 않은 Origin입니다.' }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}
