/**
 * Rate Limiting 미들웨어
 * API 요청 빈도 제한
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;    // 시간 윈도우 (밀리초)
  maxRequests: number; // 최대 요청 수
}

// 글로벌 rate limit 저장소
const globalForRateLimit = globalThis as unknown as {
  _rateLimitStore: Map<string, RateLimitEntry>;
};

if (!globalForRateLimit._rateLimitStore) {
  globalForRateLimit._rateLimitStore = new Map();
}

// 기본 설정
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,  // 1분
  maxRequests: 60,      // 분당 60회
};

// API별 설정
export const API_RATE_LIMITS: Record<string, RateLimitConfig> = {
  'bed-info': { windowMs: 60 * 1000, maxRequests: 30 },
  'hospital-list': { windowMs: 60 * 1000, maxRequests: 30 },
  'severe-diseases': { windowMs: 60 * 1000, maxRequests: 30 },
  'emergency-messages': { windowMs: 60 * 1000, maxRequests: 60 },
  'ratings': { windowMs: 60 * 1000, maxRequests: 20 },
  'cache-status': { windowMs: 60 * 1000, maxRequests: 10 },
};

/**
 * IP 주소 추출
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfIp = request.headers.get('cf-connecting-ip');

  if (cfIp) return cfIp;
  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIp) return realIp;

  return 'unknown';
}

/**
 * Rate Limit 체크
 */
export function checkRateLimit(
  identifier: string,
  apiName: string
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
} {
  const config = API_RATE_LIMITS[apiName] || DEFAULT_CONFIG;
  const key = `${apiName}:${identifier}`;
  const now = Date.now();

  let entry = globalForRateLimit._rateLimitStore.get(key);

  // 새 윈도우 시작 또는 첫 요청
  if (!entry || now >= entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    globalForRateLimit._rateLimitStore.set(key, entry);

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: entry.resetTime,
    };
  }

  // 기존 윈도우 내 요청
  entry.count++;
  globalForRateLimit._rateLimitStore.set(key, entry);

  if (entry.count > config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Rate Limit 헤더 생성
 */
export function getRateLimitHeaders(
  result: ReturnType<typeof checkRateLimit>,
  apiName: string
): Record<string, string> {
  const config = API_RATE_LIMITS[apiName] || DEFAULT_CONFIG;

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(Math.floor(result.resetTime / 1000)),
  };

  if (result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}

/**
 * Rate Limit 정리 (오래된 엔트리 제거)
 */
export function cleanupRateLimitStore(): number {
  const now = Date.now();
  let removed = 0;

  globalForRateLimit._rateLimitStore.forEach((entry, key) => {
    if (now >= entry.resetTime) {
      globalForRateLimit._rateLimitStore.delete(key);
      removed++;
    }
  });

  return removed;
}

/**
 * Rate Limit 통계
 */
export function getRateLimitStats(): {
  totalEntries: number;
  byApi: Record<string, number>;
} {
  const byApi: Record<string, number> = {};

  globalForRateLimit._rateLimitStore.forEach((_, key) => {
    const apiName = key.split(':')[0];
    byApi[apiName] = (byApi[apiName] || 0) + 1;
  });

  return {
    totalEntries: globalForRateLimit._rateLimitStore.size,
    byApi,
  };
}

// 주기적 정리 (5분마다)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupRateLimitStore();
  }, 5 * 60 * 1000);
}
