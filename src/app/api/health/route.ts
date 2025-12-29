/**
 * Health Check API
 *
 * 용도:
 * - 배포 후 서버 상태 즉시 확인
 * - 모니터링 시스템 연동 (uptime 체크)
 * - 외부 의존성 상태 확인
 *
 * GET /api/health
 * 응답: { status: 'ok' | 'degraded' | 'error', ... }
 */

import { NextResponse } from 'next/server';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    name: string;
    status: 'ok' | 'warn' | 'error';
    message?: string;
  }[];
}

// 서버 시작 시간 (cold start 감지용)
const startTime = Date.now();

export async function GET() {
  const checks: HealthStatus['checks'] = [];

  // 1. 환경 변수 체크
  const apiKeyExists = !!process.env.ERMCT_API_KEY;
  checks.push({
    name: 'ERMCT_API_KEY',
    status: apiKeyExists ? 'ok' : 'error',
    message: apiKeyExists ? undefined : '환경 변수 미설정',
  });

  const mapTilerKeyExists = !!process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
  checks.push({
    name: 'MAPTILER_API_KEY',
    status: mapTilerKeyExists ? 'ok' : 'error',
    message: mapTilerKeyExists ? undefined : '지도 렌더링 불가',
  });

  // 2. Google Sheets 설정 체크
  const googleSheetsConfigured = !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_SPREADSHEET_ID
  );
  checks.push({
    name: 'GOOGLE_SHEETS',
    status: googleSheetsConfigured ? 'ok' : 'warn',
    message: googleSheetsConfigured ? undefined : '피드백 기능 제한됨',
  });

  // 3. Vercel KV 설정 체크
  const kvConfigured = !!(
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN
  );
  checks.push({
    name: 'VERCEL_KV',
    status: kvConfigured ? 'ok' : 'warn',
    message: kvConfigured ? undefined : '평점 데이터 휘발성',
  });

  // 전체 상태 결정
  const hasError = checks.some(c => c.status === 'error');
  const hasWarn = checks.some(c => c.status === 'warn');

  let overallStatus: HealthStatus['status'] = 'ok';
  if (hasError) {
    overallStatus = 'error';
  } else if (hasWarn) {
    overallStatus = 'degraded';
  }

  const response: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };

  // 에러 상태면 503 반환
  const httpStatus = hasError ? 503 : 200;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
