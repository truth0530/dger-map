/**
 * 병상 정보 조회 API
 * 원본: dger-api/api/get-bed-info.js
 *
 * - 서버 측 캐싱 (5분 TTL)
 * - API 장애 시 샘플 데이터 폴백
 * - Rate Limiting
 * - 구조화된 로깅
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestErmctXml, mapSidoName } from '@/lib/ermctClient';
import { bedInfoCache } from '@/lib/cache/SimpleCache';
import { SAMPLE_BED_DATA } from '@/lib/sampleData';
import { createLogger } from '@/lib/utils/logger';
import { checkRateLimit, getClientIP, getRateLimitHeaders } from '@/lib/middleware/rateLimit';

const logger = createLogger('api:bed-info');
const API_NAME = 'bed-info';

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  const clientIP = getClientIP(request);

  // Rate Limit 체크
  const rateLimitResult = checkRateLimit(clientIP, API_NAME);
  const rateLimitHeaders = getRateLimitHeaders(rateLimitResult, API_NAME);

  if (!rateLimitResult.allowed) {
    logger.warn('Rate limit exceeded', { clientIP, retryAfter: rateLimitResult.retryAfter });
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests', retryAfter: rateLimitResult.retryAfter }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          ...rateLimitHeaders,
        },
      }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const region = searchParams.get('region') || '';
  const hospId = searchParams.get('hospId') || '';

  logger.logApiRequest('GET', '/api/bed-info', { region, hospId, clientIP });

  // 캐시 키 생성
  const cacheKey = `bed:${region}:${hospId}`;

  // 캐시 확인
  const cachedData = bedInfoCache.get(cacheKey);
  if (cachedData) {
    const duration = performance.now() - startTime;
    logger.logCacheEvent('hit', cacheKey);
    logger.logApiResponse('GET', '/api/bed-info', 200, duration);

    return new NextResponse(cachedData, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'HIT',
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        ...rateLimitHeaders,
      },
    });
  }

  logger.logCacheEvent('miss', cacheKey);

  try {
    const mappedRegion = mapSidoName(region);

    const params: Record<string, string> = {
      STAGE1: mappedRegion,
      numOfRows: '100',
      pageNo: '1',
      _type: 'xml',
    };

    if (hospId) {
      params.STAGE2 = hospId;
    }

    const result = await requestErmctXml({
      endpoint: 'getEmrrmRltmUsefulSckbdInfoInqire',
      params,
      fallbackXml: SAMPLE_BED_DATA,
      description: '병상 정보 조회(API)',
    });

    // 캐시에 저장 (샘플 데이터가 아닌 경우만)
    if (!result.usedSample) {
      bedInfoCache.set(cacheKey, result.xml);
      logger.logCacheEvent('set', cacheKey);
    }

    const duration = performance.now() - startTime;
    logger.logApiResponse('GET', '/api/bed-info', 200, duration);

    return new NextResponse(result.xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS',
        'X-Sample-Data': result.usedSample ? 'true' : 'false',
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        ...rateLimitHeaders,
      },
    });
  } catch (error) {
    const duration = performance.now() - startTime;
    logger.error('API call failed', error instanceof Error ? error : undefined, { region, hospId });
    logger.logApiResponse('GET', '/api/bed-info', 500, duration);

    // 에러 시 샘플 데이터 반환
    return new NextResponse(SAMPLE_BED_DATA, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'ERROR',
        'X-Sample-Data': 'true',
        'X-Error': error instanceof Error ? error.message : 'Unknown error',
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        ...rateLimitHeaders,
      },
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
