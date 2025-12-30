/**
 * Google Analytics Data API 라우트
 * - 실시간 접속자 수
 * - 일별/월별 방문자 통계
 * - 누적 방문자 수
 */

import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// 환경변수
const GA_PROPERTY_ID = process.env.GA_PROPERTY_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

// GA4 Data API 클라이언트 생성
async function getAnalyticsDataClient() {
  if (!SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY || !GA_PROPERTY_ID) {
    throw new Error('Google Analytics 설정이 필요합니다');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: SERVICE_ACCOUNT_EMAIL,
      private_key: PRIVATE_KEY,
    },
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });

  return google.analyticsdata({ version: 'v1beta', auth });
}

export async function GET() {
  try {
    if (!GA_PROPERTY_ID) {
      return NextResponse.json({
        success: false,
        configured: false,
        error: 'GA_PROPERTY_ID 환경변수가 설정되지 않았습니다',
      }, { status: 500 });
    }

    const analyticsData = await getAnalyticsDataClient();
    const propertyId = `properties/${GA_PROPERTY_ID}`;

    // 병렬로 데이터 조회
    const [realtimeResponse, todayResponse, last30DaysResponse, totalResponse] = await Promise.all([
      // 1. 실시간 접속자 수
      analyticsData.properties.runRealtimeReport({
        property: propertyId,
        requestBody: {
          metrics: [{ name: 'activeUsers' }],
        },
      }).catch((err) => {
        console.error('[Analytics] 실시간 접속자 조회 오류:', err.message || err);
        return null;
      }),

      // 2. 오늘 방문자 수
      analyticsData.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate: 'today', endDate: 'today' }],
          metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        },
      }).catch((err) => {
        console.error('[Analytics] 오늘 방문자 조회 오류:', err.message || err);
        return null;
      }),

      // 3. 최근 30일 일별 방문자 추이
      analyticsData.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        },
      }).catch((err) => {
        console.error('[Analytics] 30일 추이 조회 오류:', err.message || err);
        return null;
      }),

      // 4. 전체 기간 누적 방문자 수 (서비스 시작일부터)
      analyticsData.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate: '2021-11-26', endDate: 'today' }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'averageSessionDuration' },
          ],
        },
      }).catch((err) => {
        console.error('[Analytics] 누적 방문자 조회 오류:', err.message || err);
        return null;
      }),
    ]);

    // 디버깅: 응답 상태 로깅
    console.log('[Analytics] API 응답 상태:', {
      realtime: realtimeResponse ? 'OK' : 'NULL',
      today: todayResponse ? 'OK' : 'NULL',
      last30Days: last30DaysResponse ? 'OK' : 'NULL',
      total: totalResponse ? 'OK' : 'NULL',
    });

    // 실시간 접속자
    const realtimeUsers = realtimeResponse?.data?.rows?.[0]?.metricValues?.[0]?.value || '0';

    // 오늘 방문자
    const todayUsers = todayResponse?.data?.rows?.[0]?.metricValues?.[0]?.value || '0';
    const todaySessions = todayResponse?.data?.rows?.[0]?.metricValues?.[1]?.value || '0';

    // 30일 일별 추이
    const dailyData = last30DaysResponse?.data?.rows?.map(row => ({
      date: row.dimensionValues?.[0]?.value || '',
      users: parseInt(row.metricValues?.[0]?.value || '0', 10),
      sessions: parseInt(row.metricValues?.[1]?.value || '0', 10),
    })) || [];

    // 30일 평균
    const totalUsersLast30Days = dailyData.reduce((sum, d) => sum + d.users, 0);
    const avgDailyUsers = dailyData.length > 0 ? Math.round(totalUsersLast30Days / dailyData.length) : 0;

    // 누적 방문자
    const totalUsers = totalResponse?.data?.rows?.[0]?.metricValues?.[0]?.value || '0';
    const totalSessions = totalResponse?.data?.rows?.[0]?.metricValues?.[1]?.value || '0';
    const totalPageViews = totalResponse?.data?.rows?.[0]?.metricValues?.[2]?.value || '0';
    const avgSessionDuration = totalResponse?.data?.rows?.[0]?.metricValues?.[3]?.value || '0';

    return NextResponse.json({
      success: true,
      data: {
        realtime: {
          activeUsers: parseInt(realtimeUsers, 10),
        },
        today: {
          users: parseInt(todayUsers, 10),
          sessions: parseInt(todaySessions, 10),
        },
        average: {
          dailyUsers: avgDailyUsers,
        },
        total: {
          users: parseInt(totalUsers, 10),
          sessions: parseInt(totalSessions, 10),
          pageViews: parseInt(totalPageViews, 10),
          avgSessionDuration: parseFloat(avgSessionDuration),
          since: '2021-11-26',
        },
        dailyTrend: dailyData,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Analytics API 오류:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // 권한 오류 체크
    if (errorMessage.includes('permission') || errorMessage.includes('403')) {
      return NextResponse.json({
        success: false,
        error: 'Google Analytics 접근 권한이 없습니다. 서비스 계정에 GA4 속성 접근 권한을 부여해주세요.',
      }, { status: 403 });
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
