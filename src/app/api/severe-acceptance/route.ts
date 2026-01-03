/**
 * 중증질환 수용가능 정보 조회 API (개별 병원용)
 * 원본: dger-api/api/get-severe-acceptance.js
 *
 * 조회 방식:
 * 1. HPID + QN: 개별 병원의 특정 질환 수용가능 정보
 * 2. Q0 + QN: 지역(시도코드)의 특정 질환 수용가능 병원 목록
 *
 * - 서버 측 캐싱 (3분 TTL)
 * - HPID 실패시 Q0+QN으로 페일오버
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestErmctXml, mapSidoName } from '@/lib/ermctClient';
import { SimpleCache } from '@/lib/cache/SimpleCache';
import { getCorsHeaders, isAllowedOrigin } from '@/lib/utils/cors';

// 캐시 인스턴스 (3분 TTL)
const severeAcceptanceCache = new SimpleCache<string>(3 * 60 * 1000);

// 빈 응답 (데이터 없음)
const EMPTY_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
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
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json(
      { error: '허용되지 않은 Origin입니다.' },
      { status: 403, headers: corsHeaders }
    );
  }
  const searchParams = request.nextUrl.searchParams;
  const hpid = searchParams.get('hpid') || '';
  const qn = searchParams.get('qn') || '';
  const q0 = searchParams.get('q0') || '';

  if (process.env.NODE_ENV !== 'production') {
    console.log('[severe-acceptance] 요청 파라미터 - hpid:', hpid, 'qn:', qn, 'q0:', q0);
  }

  // 파라미터 검증
  if (!qn) {
    return NextResponse.json(
      { error: '필수 파라미터 누락 (qn 필요)' },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!hpid && !q0) {
    return NextResponse.json(
      { error: '필수 파라미터 누락 (hpid 또는 q0 필요)' },
      { status: 400, headers: corsHeaders }
    );
  }

  // 캐시 키 생성
  const cacheKey = `acceptance:${hpid || q0}:${qn}`;

  // 캐시 확인
  const cachedData = severeAcceptanceCache.get(cacheKey);
  if (cachedData) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[severe-acceptance] 캐시 히트: ${cacheKey}`);
    }
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
    const endpoint = 'getSrsillDissAceptncPosblInfoInqire';
    const baseParams = {
      numOfRows: '1000',
      pageNo: '1',
      _type: 'xml'
    };

    let resultXml: string;

    if (q0 && qn && !hpid) {
      // Q0 + QN 방식 (지역 + 질환번호)
      const mappedQ0 = mapSidoName(q0);
      const params = { ...baseParams, Q0: mappedQ0, QN: qn };

      const result = await requestErmctXml({
        endpoint,
        params,
        fallbackXml: EMPTY_RESPONSE,
        description: '[severe-acceptance] Q0+QN 요청'
      });

      resultXml = result.xml;
      if (process.env.NODE_ENV !== 'production') {
        console.log('[severe-acceptance] Q0+QN 응답 길이:', resultXml.length);
      }

    } else if (hpid && qn) {
      // HPID + QN 방식 (개별 병원 + 질환번호)
      const params = { ...baseParams, HPID: hpid, QN: qn };

      try {
        const result = await requestErmctXml({
          endpoint,
          params,
          fallbackXml: EMPTY_RESPONSE,
          description: '[severe-acceptance] HPID+QN 요청'
        });

        resultXml = result.xml;
        if (process.env.NODE_ENV !== 'production') {
          console.log('[severe-acceptance] HPID+QN 응답 길이:', resultXml.length);
        }

        // SOAP Fault 감지시 Q0+QN으로 재시도
        if (resultXml.includes('<soapenv:Fault') && q0) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[severe-acceptance] HPID+QN 응답에서 Fault 감지 → Q0+QN 재시도');
          }
          const mappedQ0 = mapSidoName(q0);
          const retryParams = { ...baseParams, Q0: mappedQ0, QN: qn };

          const retryResult = await requestErmctXml({
            endpoint,
            params: retryParams,
            fallbackXml: EMPTY_RESPONSE,
            description: '[severe-acceptance] HPID 실패 → Q0+QN 재시도'
          });

          resultXml = retryResult.xml;
        }
      } catch (error) {
        console.error('[severe-acceptance] HPID+QN 요청 실패:', error);

        // Q0이 있으면 대체 조회
        if (q0) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[severe-acceptance] HPID 실패 → Q0+QN 대체 조회 실행');
          }
          const mappedQ0 = mapSidoName(q0);
          const retryParams = { ...baseParams, Q0: mappedQ0, QN: qn };

          const retryResult = await requestErmctXml({
            endpoint,
            params: retryParams,
            fallbackXml: EMPTY_RESPONSE,
            description: '[severe-acceptance] HPID 실패 → Q0+QN 재시도'
          });

          resultXml = retryResult.xml;
        } else {
          throw error;
        }
      }
    } else {
      // Q0 + QN 기본 경로
      const mappedQ0 = mapSidoName(q0);
      const params = { ...baseParams, Q0: mappedQ0, QN: qn };

      const result = await requestErmctXml({
        endpoint,
        params,
        fallbackXml: EMPTY_RESPONSE,
        description: '[severe-acceptance] Q0+QN 요청'
      });

      resultXml = result.xml;
      if (process.env.NODE_ENV !== 'production') {
        console.log('[severe-acceptance] Q0+QN 응답 길이:', resultXml.length);
      }
    }

    // 캐시에 저장
    severeAcceptanceCache.set(cacheKey, resultXml);

    return new NextResponse(resultXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        ...corsHeaders,
        'X-Cache': 'MISS'
      }
    });

  } catch (error) {
    console.error('[severe-acceptance] API 오류:', error);

    return new NextResponse(EMPTY_RESPONSE, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        ...corsHeaders,
        'X-Cache': 'ERROR',
        'X-Error': error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(request.headers.get('origin'))
  });
}
