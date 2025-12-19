/**
 * 병상 정보 조회 API
 * 원본: dger-api/api/get-bed-info.js
 *
 * - 서버 측 캐싱 (5분 TTL)
 * - API 장애 시 샘플 데이터 폴백
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestErmctXml, mapSidoName } from '@/lib/ermctClient';
import { bedInfoCache } from '@/lib/cache/SimpleCache';
import { SAMPLE_BED_DATA } from '@/lib/sampleData';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const region = searchParams.get('region') || '';
  const hospId = searchParams.get('hospId') || '';

  // 캐시 키 생성
  const cacheKey = `bed:${region}:${hospId}`;

  // 캐시 확인
  const cachedData = bedInfoCache.get(cacheKey);
  if (cachedData) {
    console.log(`[bed-info] 캐시 히트: ${cacheKey}`);
    return new NextResponse(cachedData, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'HIT'
      }
    });
  }

  try {
    const mappedRegion = mapSidoName(region);

    const params: Record<string, string> = {
      STAGE1: mappedRegion,
      numOfRows: '100',
      pageNo: '1',
      _type: 'xml'
    };

    if (hospId) {
      params.STAGE2 = hospId;
    }

    const result = await requestErmctXml({
      endpoint: 'getEmrrmRltmUsefulSckbdInfoInqire',
      params,
      fallbackXml: SAMPLE_BED_DATA,
      description: '병상 정보 조회(API)'
    });

    // 캐시에 저장 (샘플 데이터가 아닌 경우만)
    if (!result.usedSample) {
      bedInfoCache.set(cacheKey, result.xml);
    }

    return new NextResponse(result.xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS',
        'X-Sample-Data': result.usedSample ? 'true' : 'false'
      }
    });
  } catch (error) {
    console.error('[bed-info] API 호출 오류:', error);

    // 에러 시 샘플 데이터 반환
    return new NextResponse(SAMPLE_BED_DATA, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'ERROR',
        'X-Sample-Data': 'true',
        'X-Error': error instanceof Error ? error.message : 'Unknown error'
      }
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
