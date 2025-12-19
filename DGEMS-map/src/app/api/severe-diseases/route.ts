/**
 * 중증질환 수용 가능 정보 API
 * 원본: dger-api/api/get-severe-diseases.js
 *
 * - 서버 측 캐싱 (5분 TTL)
 * - API 장애 시 샘플 데이터 폴백
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestErmctXml, mapSidoName } from '@/lib/ermctClient';
import { severeDiseasesCache } from '@/lib/cache/SimpleCache';
import { SAMPLE_SEVERE_DATA } from '@/lib/sampleData';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const STAGE1 = searchParams.get('STAGE1') || searchParams.get('region') || '';
  const STAGE2 = searchParams.get('STAGE2') || '';
  const numOfRows = searchParams.get('numOfRows') || '1000';
  const pageNo = searchParams.get('pageNo') || '1';

  // 캐시 키 생성
  const cacheKey = `severe:${STAGE1}:${STAGE2}:${numOfRows}:${pageNo}`;

  // 캐시 확인
  const cachedData = severeDiseasesCache.get(cacheKey);
  if (cachedData) {
    console.log(`[severe-diseases] 캐시 히트: ${cacheKey}`);
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
    const mappedStage1 = mapSidoName(STAGE1);

    console.log('[severe-diseases] 요청 파라미터 - STAGE1:', mappedStage1, 'STAGE2:', STAGE2);

    const params: Record<string, string> = {
      numOfRows,
      pageNo,
      _type: 'xml'
    };

    if (mappedStage1) params.STAGE1 = mappedStage1;
    if (STAGE2) params.STAGE2 = STAGE2;

    const result = await requestErmctXml({
      endpoint: 'getSrsillDissAceptncPosblInfoInqire',
      params,
      fallbackXml: SAMPLE_SEVERE_DATA,
      description: '[severe-diseases] 수용가능 정보'
    });

    const text = result.xml;

    console.log('[severe-diseases] 응답 길이:', text.length);

    // 캐시에 저장 (샘플 데이터가 아닌 경우만)
    if (!result.usedSample) {
      severeDiseasesCache.set(cacheKey, text);
    }

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS',
        'X-Sample-Data': result.usedSample ? 'true' : 'false'
      }
    });
  } catch (error) {
    console.error('[severe-diseases] API 오류:', error);

    // 에러 시 샘플 데이터 반환
    return new NextResponse(SAMPLE_SEVERE_DATA, {
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
