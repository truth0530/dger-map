/**
 * 응급 메시지 조회 API
 * 원본: dger-api/api/get-emergency-messages.js
 *
 * - 서버 측 캐싱 (3분 TTL)
 * - API 장애 시 샘플 데이터 폴백
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestErmctXml } from '@/lib/ermctClient';
import { emergencyMessageCache } from '@/lib/cache/SimpleCache';
import { SAMPLE_MESSAGE_DATA } from '@/lib/sampleData';

// 빈 메시지 응답 (정상적으로 메시지가 없는 경우)
const EMPTY_MESSAGE_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header>
    <resultCode>00</resultCode>
    <resultMsg>NORMAL SERVICE.</resultMsg>
  </header>
  <body>
    <items/>
    <numOfRows>1000</numOfRows>
    <pageNo>1</pageNo>
    <totalCount>0</totalCount>
  </body>
</response>`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const hpid = searchParams.get('hpid') || '';

  if (!hpid) {
    return NextResponse.json(
      { error: 'hpid 파라미터가 필요합니다.' },
      { status: 400 }
    );
  }

  // 캐시 키 생성
  const cacheKey = `message:${hpid}`;

  // 캐시 확인
  const cachedData = emergencyMessageCache.get(cacheKey);
  if (cachedData) {
    console.log(`[emergency-messages] 캐시 히트: ${cacheKey}`);
    return new NextResponse(cachedData, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
        'X-Cache': 'HIT'
      }
    });
  }

  try {
    const params: Record<string, string> = {
      HPID: hpid,
      numOfRows: '1000',
      _type: 'xml'
    };

    const result = await requestErmctXml({
      endpoint: 'getEmrrmSrsillDissMsgInqire',
      params,
      fallbackXml: EMPTY_MESSAGE_RESPONSE,
      description: '응급 메시지 조회(API)'
    });

    // 캐시에 저장 (샘플 데이터가 아닌 경우만)
    if (!result.usedSample) {
      emergencyMessageCache.set(cacheKey, result.xml);
    }

    return new NextResponse(result.xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
        'X-Cache': 'MISS',
        'X-Sample-Data': result.usedSample ? 'true' : 'false'
      }
    });
  } catch (error) {
    console.error('[emergency-messages] API 호출 오류:', error);

    // 에러 시에도 빈 메시지로 응답 (graceful degradation)
    return new NextResponse(EMPTY_MESSAGE_RESPONSE, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=30, stale-while-revalidate=120',
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
