/**
 * 외부 API 헬스체크 및 Slack 알림 API
 *
 * 용도:
 * - 공공데이터 포털 API 상태 모니터링
 * - Slack 상태 리포트 발송 (cron 연동)
 * - 장애/복구 감지
 *
 * GET /api/health-check
 * GET /api/health-check?report=true  (Slack 상태 리포트 발송)
 *
 * Vercel Cron 설정 예시 (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/health-check?report=true",
 *     "schedule": "0 9 * * *"  // 매일 오전 9시
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestErmctXml, mapSidoName } from '@/lib/ermctClient';
import { slackNotifier } from '@/lib/slack/SlackNotifier';
import { createLogger } from '@/lib/utils/logger';
import { parseXmlToJson } from '@/lib/utils/serverXmlParser';

const logger = createLogger('api:health-check');

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  checks: {
    name: string;
    status: 'ok' | 'warn' | 'error';
    responseTime?: number;
    itemCount?: number;
    message?: string;
  }[];
  slackNotified?: boolean;
}

// 테스트용 지역 목록 (빠른 체크용)
const TEST_REGIONS = ['서울', '경기'];

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  const searchParams = request.nextUrl.searchParams;
  const sendReport = searchParams.get('report') === 'true';

  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: [],
  };

  // 공공데이터 포털 API 테스트
  for (const region of TEST_REGIONS) {
    const checkStart = performance.now();
    try {
      const mappedRegion = mapSidoName(region);
      const apiResult = await requestErmctXml({
        endpoint: 'getEmrrmRltmUsefulSckbdInfoInqire',
        params: {
          STAGE1: mappedRegion,
          numOfRows: '10',
          pageNo: '1',
          _type: 'xml',
        },
        description: `헬스체크 (${region})`,
      });

      const checkDuration = performance.now() - checkStart;
      const parsed = parseXmlToJson(apiResult.xml);

      if (!parsed.success) {
        result.checks.push({
          name: `공공데이터포털 (${region})`,
          status: 'error',
          responseTime: Math.round(checkDuration),
          message: `파싱 오류: ${parsed.message}`,
        });
        result.status = 'down';
      } else if (parsed.items.length === 0) {
        result.checks.push({
          name: `공공데이터포털 (${region})`,
          status: 'warn',
          responseTime: Math.round(checkDuration),
          itemCount: 0,
          message: '빈 데이터 반환 (API 장애 가능성)',
        });
        if (result.status === 'healthy') {
          result.status = 'degraded';
        }
      } else {
        result.checks.push({
          name: `공공데이터포털 (${region})`,
          status: 'ok',
          responseTime: Math.round(checkDuration),
          itemCount: parsed.items.length,
        });
      }
    } catch (error) {
      const checkDuration = performance.now() - checkStart;
      result.checks.push({
        name: `공공데이터포털 (${region})`,
        status: 'error',
        responseTime: Math.round(checkDuration),
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      result.status = 'down';
    }
  }

  // Slack 알림 처리
  const hasIssue = result.checks.some(c => c.status !== 'ok');

  if (hasIssue) {
    // 장애 감지 시 알림
    const errorMessages = result.checks
      .filter(c => c.status !== 'ok')
      .map(c => `${c.name}: ${c.message || '데이터 없음'}`)
      .join('\n');

    await slackNotifier.notifyFailure({
      apiName: '공공데이터 포털 (병상정보)',
      errorMessage: errorMessages,
      region: TEST_REGIONS.join(', '),
      timestamp: new Date(),
    });
    result.slackNotified = true;
  } else {
    // 정상일 때 복구 알림 (이전에 장애였다면)
    const totalItems = result.checks.reduce((sum, c) => sum + (c.itemCount || 0), 0);
    const notified = await slackNotifier.notifyRecovery({
      apiName: '공공데이터 포털 (병상정보)',
      itemCount: totalItems,
      region: TEST_REGIONS.join(', '),
      timestamp: new Date(),
    });
    result.slackNotified = notified;
  }

  // 상태 리포트 발송 (report=true 일 때)
  if (sendReport) {
    const avgResponseTime = result.checks.reduce((sum, c) => sum + (c.responseTime || 0), 0) / result.checks.length;
    const totalItems = result.checks.reduce((sum, c) => sum + (c.itemCount || 0), 0);

    await slackNotifier.sendStatusReport({
      apiName: '공공데이터 포털 (병상정보)',
      status: result.status,
      lastCheck: new Date(),
      details: `평균 응답시간: ${Math.round(avgResponseTime)}ms, 데이터 건수: ${totalItems}건`,
    });
    result.slackNotified = true;
  }

  const duration = performance.now() - startTime;
  logger.info('Health check completed', {
    status: result.status,
    duration: `${duration.toFixed(0)}ms`,
    slackNotified: result.slackNotified,
  });

  return NextResponse.json(result, {
    status: result.status === 'down' ? 503 : 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Response-Time': `${duration.toFixed(2)}ms`,
    },
  });
}
