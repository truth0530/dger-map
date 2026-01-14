/**
 * 병원 목록 조회 API
 * 원본: dger-api/api/get-hospital-list.js
 *
 * - 서버 측 캐싱 (10분 TTL)
 * - API 장애 시 샘플 데이터 폴백
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestErmctXml, mapSidoName } from '@/lib/ermctClient';
import { hospitalListCache } from '@/lib/cache/SimpleCache';
import { SAMPLE_HOSPITAL_LIST } from '@/lib/sampleData';
import { getCorsHeaders } from '@/lib/utils/cors';

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const searchParams = request.nextUrl.searchParams;
  const region = searchParams.get('region') || '';

  // 캐시 키 생성
  const cacheKey = `hospital-list:${region}`;

  // 캐시 확인
  const cachedData = hospitalListCache.get(cacheKey);
  if (cachedData) {
    console.log(`[hospital-list] 캐시 히트: ${cacheKey}`);
    return new NextResponse(cachedData, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        ...corsHeaders,
        'X-Cache': 'HIT'
      }
    });
  }

  try {
    const mappedRegion = mapSidoName(region);

    const params: Record<string, string> = {
      numOfRows: '100',
      pageNo: '1',
      _type: 'xml'
    };

    if (mappedRegion) {
      params.Q0 = mappedRegion;
    }

    const result = await requestErmctXml({
      endpoint: 'getEgytListInfoInqire',
      params,
      fallbackXml: SAMPLE_HOSPITAL_LIST,
      description: '병원 목록 조회(API)'
    });

    // 캐시에 저장 (샘플 데이터가 아닌 경우만)
    if (!result.usedSample) {
      hospitalListCache.set(cacheKey, result.xml);
    }

    return new NextResponse(result.xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        ...corsHeaders,
        'X-Cache': 'MISS',
        'X-Sample-Data': result.usedSample ? 'true' : 'false'
      }
    });
  } catch (error) {
    console.error('[hospital-list] API 호출 오류:', error);

    // 에러 시 샘플 데이터 반환
    return new NextResponse(SAMPLE_HOSPITAL_LIST, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        ...corsHeaders,
        'X-Cache': 'ERROR',
        'X-Sample-Data': 'true',
        'X-Error': error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  return new NextResponse(null, {
    status: 200,
    headers: {
      ...corsHeaders,
    }
  });
}
