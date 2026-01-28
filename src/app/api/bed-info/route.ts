/**
 * 병상 정보 조회 API
 * 원본: dger-api/api/get-bed-info.js
 *
 * - 서버 측 캐싱 (5분 TTL)
 * - XML → JSON 변환 (클라이언트 파싱 비용 제거)
 * - 병원 유형 매핑 포함 (hosp_list.json 별도 로드 불필요)
 * - API 장애 시 샘플 데이터 폴백
 * - Rate Limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestErmctXml, mapSidoName } from '@/lib/ermctClient';
import { bedInfoCache } from '@/lib/cache/SimpleCache';
import { SAMPLE_BED_DATA } from '@/lib/sampleData';
import { createLogger } from '@/lib/utils/logger';
import { checkRateLimit, getClientIP, getRateLimitHeaders } from '@/lib/middleware/rateLimit';
import { parseXmlToJson, getItemText, getItemNumber } from '@/lib/utils/serverXmlParser';
import { getHospitalOrgType, HospitalOrgType } from '@/lib/data/hospitalTypeMap';
import { getBedStatus, BedStatus } from '@/lib/constants/dger';
import { calculateOccupancyRate, calculateTotalOccupancy } from '@/lib/utils/bedOccupancy';
import { getCorsHeaders } from '@/lib/utils/cors';
import { slackNotifier } from '@/lib/slack/SlackNotifier';

const logger = createLogger('api:bed-info');
const API_NAME = 'bed-info';

// JSON 응답 타입
export interface BedInfoItem {
  hpid: string;
  dutyName: string;
  dutyEmclsName: string;
  hpbd: HospitalOrgType;
  dutyAddr: string;
  dutyTel3: string;
  hvec: number;
  hvs01: number;
  hv27: number;
  hvs59: number;
  hv29: number;
  hvs03: number;
  hv13: number;
  hvs46: number;
  hv30: number;
  hvs04: number;
  hv14: number;
  hvs47: number;
  hv28: number;
  hvs02: number;
  hv15: number;
  hvs48: number;
  hv16: number;
  hvs49: number;
  hv60: number;   // 외상소생실 가용
  hvs60: number;  // 외상소생실 총
  hv61: number;   // 외상환자진료구역 가용
  hvs61: number;  // 외상환자진료구역 총
  hvidate: string;
  occupancy: number;
  occupancyRate: number;
  generalStatus: BedStatus;
}

interface BedInfoResponse {
  success: boolean;
  code: string;
  message: string;
  items: BedInfoItem[];
  totalCount: number;
  usedSample: boolean;
}

/**
 * XML을 파싱하여 BedInfoItem 배열로 변환
 */
function parseXmlToBedInfo(xml: string, usedSample: boolean): BedInfoResponse {
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

  const items: BedInfoItem[] = parsed.items.map((item) => {
    const hpid = getItemText(item, 'hpid');
    const hvec = getItemNumber(item, 'hvec');
    const hvs01 = getItemNumber(item, 'hvs01');
    const hv27 = getItemNumber(item, 'hv27');
    const hvs59 = getItemNumber(item, 'hvs59');
    const hv29 = getItemNumber(item, 'hv29');
    const hvs03 = getItemNumber(item, 'hvs03');
    const hv13 = getItemNumber(item, 'hv13');
    const hvs46 = getItemNumber(item, 'hvs46');
    const hv30 = getItemNumber(item, 'hv30');
    const hvs04 = getItemNumber(item, 'hvs04');
    const hv14 = getItemNumber(item, 'hv14');
    const hvs47 = getItemNumber(item, 'hvs47');
    const hv28 = getItemNumber(item, 'hv28');
    const hvs02 = getItemNumber(item, 'hvs02');
    const hv15 = getItemNumber(item, 'hv15');
    const hvs48 = getItemNumber(item, 'hvs48');
    const hv16 = getItemNumber(item, 'hv16');
    const hvs49 = getItemNumber(item, 'hvs49');
    const hv60 = getItemNumber(item, 'hv60');
    const hvs60 = getItemNumber(item, 'hvs60');
    const hv61 = getItemNumber(item, 'hv61');
    const hvs61 = getItemNumber(item, 'hvs61');

    // 재실인원 및 점유율 계산
    const occupancy = calculateTotalOccupancy({
      hvec,
      hvs01,
      hv27,
      hvs59,
      hv29,
      hvs03,
      hv13,
      hvs46,
      hv30,
      hvs04,
      hv14,
      hvs47,
      hv28,
      hvs02,
      hv15,
      hvs48,
      hv16,
      hvs49
    });
    const occupancyRate = calculateOccupancyRate({
      hvec,
      hvs01,
      hv27,
      hvs59,
      hv29,
      hvs03,
      hv13,
      hvs46,
      hv30,
      hvs04,
      hv14,
      hvs47,
      hv28,
      hvs02,
      hv15,
      hvs48,
      hv16,
      hvs49
    });

    return {
      hpid,
      dutyName: getItemText(item, 'dutyName'),
      dutyEmclsName: getItemText(item, 'dutyEmclsName'),
      hpbd: getHospitalOrgType(hpid),
      dutyAddr: getItemText(item, 'dutyAddr'),
      dutyTel3: getItemText(item, 'dutyTel3'),
      hvec,
      hvs01,
      hv27,
      hvs59,
      hv29,
      hvs03,
      hv13,
      hvs46,
      hv30,
      hvs04,
      hv14,
      hvs47,
      hv28,
      hvs02,
      hv15,
      hvs48,
      hv16,
      hvs49,
      hv60,
      hvs60,
      hv61,
      hvs61,
      hvidate: getItemText(item, 'hvidate'),
      occupancy,
      occupancyRate,
      generalStatus: getBedStatus(hvec, hvs01),
    };
  });

  // 센터급 우선, 재실인원 내림차순 정렬
  items.sort((a, b) => {
    const centerTypes = ['권역응급의료센터', '지역응급의료센터', '전문응급의료센터'];
    const aIsCenter = centerTypes.includes(a.hpbd) || centerTypes.includes(a.dutyEmclsName);
    const bIsCenter = centerTypes.includes(b.hpbd) || centerTypes.includes(b.dutyEmclsName);

    if (aIsCenter && !bIsCenter) return -1;
    if (!aIsCenter && bIsCenter) return 1;
    return b.occupancy - a.occupancy;
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
  const startTime = performance.now();
  const clientIP = getClientIP(request);
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Rate Limit 체크
  const rateLimitResult = checkRateLimit(clientIP, API_NAME);
  const rateLimitHeaders = getRateLimitHeaders(rateLimitResult, API_NAME);

  if (!rateLimitResult.allowed) {
    logger.warn('Rate limit exceeded', { clientIP, retryAfter: rateLimitResult.retryAfter });
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: rateLimitResult.retryAfter },
      {
        status: 429,
        headers: {
          ...corsHeaders,
          ...rateLimitHeaders,
        },
      }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const region = searchParams.get('region') || '';
  const hospId = searchParams.get('hospId') || '';

  logger.logApiRequest('GET', '/api/bed-info', { region, hospId, clientIP });

  // 캐시 키 생성 (JSON 버전)
  const cacheKey = `bed-json:${region}:${hospId}`;

  // 캐시 확인
  const cachedData = bedInfoCache.get(cacheKey);
  if (cachedData) {
    const duration = performance.now() - startTime;
    logger.logCacheEvent('hit', cacheKey);
    logger.logApiResponse('GET', '/api/bed-info', 200, duration);

    return new NextResponse(cachedData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
        'Cache-Control': 's-maxage=120, stale-while-revalidate=600',
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

    // XML → JSON 변환
    const jsonResponse = parseXmlToBedInfo(result.xml, result.usedSample);
    const jsonString = JSON.stringify(jsonResponse);

    // Slack 알림: 장애/복구 감지 (샘플 데이터가 아닌 실제 API 응답 기준)
    if (!result.usedSample) {
      if (jsonResponse.items.length === 0) {
        // 데이터가 비어있으면 장애로 판단
        slackNotifier.notifyFailure({
          apiName: '공공데이터 포털 (병상정보)',
          errorMessage: 'API가 빈 데이터를 반환함 (totalCount: 0)',
          region: region || '전체',
          timestamp: new Date()
        }).catch(err => logger.error('Slack 알림 실패', err));
      } else {
        // 데이터가 있으면 복구 알림 (이전에 장애였다면)
        slackNotifier.notifyRecovery({
          apiName: '공공데이터 포털 (병상정보)',
          itemCount: jsonResponse.items.length,
          region: region || '전체',
          timestamp: new Date()
        }).catch(err => logger.error('Slack 복구 알림 실패', err));
      }
    }

    // 캐시에 저장 (샘플 데이터가 아닌 경우만)
    if (!result.usedSample) {
      bedInfoCache.set(cacheKey, jsonString);
      logger.logCacheEvent('set', cacheKey);
    }

    const duration = performance.now() - startTime;
    logger.logApiResponse('GET', '/api/bed-info', 200, duration);

    // 샘플 데이터일 경우 CDN 캐시하지 않음
    const cacheControl = result.usedSample
      ? 'no-store, must-revalidate'
      : 's-maxage=120, stale-while-revalidate=600';

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
        'Cache-Control': cacheControl,
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

    // Slack 알림: API 오류
    slackNotifier.notifyFailure({
      apiName: '공공데이터 포털 (병상정보)',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      region: region || '전체',
      timestamp: new Date()
    }).catch(err => logger.error('Slack 알림 실패', err));

    // 에러 시 샘플 데이터로 JSON 반환
    const jsonResponse = parseXmlToBedInfo(SAMPLE_BED_DATA, true);
    const jsonString = JSON.stringify(jsonResponse);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
        // 에러/샘플 응답은 CDN 캐시하지 않음 - 장애 복구 후 즉시 정상 응답 제공
        'Cache-Control': 'no-store, must-revalidate',
        'X-Cache': 'ERROR',
        'X-Sample-Data': 'true',
        'X-Error': error instanceof Error ? error.message : 'Unknown error',
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        ...rateLimitHeaders,
      },
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
