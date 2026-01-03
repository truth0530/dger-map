/**
 * 중증질환 수용 가능 정보 API
 * 원본: dger-api/api/get-severe-diseases.js
 *
 * - 서버 측 캐싱 (5분 TTL)
 * - XML → JSON 변환 (클라이언트 파싱 비용 제거)
 * - API 장애 시 샘플 데이터 폴백
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestErmctXml, mapSidoName } from '@/lib/ermctClient';
import { severeDiseasesCache } from '@/lib/cache/SimpleCache';
import { SAMPLE_SEVERE_DATA } from '@/lib/sampleData';
import { parseXmlToJson, getItemText, getItemNumber } from '@/lib/utils/serverXmlParser';
import { SEVERE_TYPES } from '@/lib/constants/dger';

// JSON 응답 타입
export interface SevereDataItem {
  hpid: string;
  dutyName: string;
  dutyEmclsName: string;
  hvec: number;
  hvs01: number;
  hv27: number;
  hv28: number;
  hv29: number;
  hv30: number;
  hv15: number;
  hv16: number;
  severeStatus: Record<string, string>;
}

interface SevereDataResponse {
  success: boolean;
  code: string;
  message: string;
  items: SevereDataItem[];
  totalCount: number;
  usedSample: boolean;
}

/**
 * XML을 파싱하여 SevereDataItem 배열로 변환
 */
function parseXmlToSevereData(xml: string, usedSample: boolean): SevereDataResponse {
  const parsed = parseXmlToJson(xml);

  if (!parsed.success) {
    return {
      success: false,
      code: parsed.code,
      message: parsed.message,
      items: [],
      totalCount: 0,
      usedSample,
    };
  }

  const items: SevereDataItem[] = parsed.items.map((item) => {
    // MKioskTy1 ~ MKioskTy27 추출
    const severeStatus: Record<string, string> = {};
    SEVERE_TYPES.forEach(type => {
      severeStatus[type.key] = getItemText(item, type.key);
    });

    return {
      hpid: getItemText(item, 'hpid'),
      dutyName: getItemText(item, 'dutyName'),
      dutyEmclsName: getItemText(item, 'dutyEmclsName'),
      hvec: getItemNumber(item, 'hvec'),
      hvs01: getItemNumber(item, 'hvs01'),
      hv27: getItemNumber(item, 'hv27'),
      hv28: getItemNumber(item, 'hv28'),
      hv29: getItemNumber(item, 'hv29'),
      hv30: getItemNumber(item, 'hv30'),
      hv15: getItemNumber(item, 'hv15'),
      hv16: getItemNumber(item, 'hv16'),
      severeStatus,
    };
  });

  return {
    success: true,
    code: parsed.code,
    message: parsed.message,
    items,
    totalCount: items.length,
    usedSample,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const STAGE1 = searchParams.get('STAGE1') || searchParams.get('region') || '';
  const STAGE2 = searchParams.get('STAGE2') || '';
  const numOfRows = searchParams.get('numOfRows') || '1000';
  const pageNo = searchParams.get('pageNo') || '1';

  // 캐시 키 생성 (JSON 버전)
  const cacheKey = `severe-json:${STAGE1}:${STAGE2}:${numOfRows}:${pageNo}`;

  // 캐시 확인
  const cachedData = severeDiseasesCache.get(cacheKey);
  if (cachedData) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[severe-diseases] 캐시 히트: ${cacheKey}`);
    }
    return new NextResponse(cachedData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=120, stale-while-revalidate=600',
        'X-Cache': 'HIT'
      }
    });
  }

  try {
    const mappedStage1 = mapSidoName(STAGE1);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[severe-diseases] 요청 파라미터 - STAGE1:', mappedStage1, 'STAGE2:', STAGE2);
    }

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

    // XML → JSON 변환
    const jsonResponse = parseXmlToSevereData(result.xml, result.usedSample);
    const jsonString = JSON.stringify(jsonResponse);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[severe-diseases] 응답 항목 수:', jsonResponse.items.length);
    }

    // 캐시에 저장 (샘플 데이터가 아닌 경우만)
    if (!result.usedSample) {
      severeDiseasesCache.set(cacheKey, jsonString);
    }

    // 샘플 데이터일 경우 CDN 캐시하지 않음
    const cacheControl = result.usedSample
      ? 'no-store, must-revalidate'
      : 's-maxage=120, stale-while-revalidate=600';

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': cacheControl,
        'X-Cache': 'MISS',
        'X-Sample-Data': result.usedSample ? 'true' : 'false'
      }
    });
  } catch (error) {
    console.error('[severe-diseases] API 오류:', error);

    // 에러 시 샘플 데이터로 JSON 반환
    const jsonResponse = parseXmlToSevereData(SAMPLE_SEVERE_DATA, true);
    const jsonString = JSON.stringify(jsonResponse);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        // 에러/샘플 응답은 CDN 캐시하지 않음 - 장애 복구 후 즉시 정상 응답 제공
        'Cache-Control': 'no-store, must-revalidate',
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
