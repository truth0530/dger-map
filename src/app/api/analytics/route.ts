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
    const [realtimeResponse, todayResponse, last30DaysResponse, totalResponse, regionResponse, deviceResponse, pageResponse] = await Promise.all([
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

      // 5. 지역별 방문자 (최근 30일)
      analyticsData.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'region' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
          limit: '10',
        },
      }).catch((err) => {
        console.error('[Analytics] 지역별 방문자 조회 오류:', err.message || err);
        return null;
      }),

      // 6. 디바이스별 방문자 (최근 30일)
      analyticsData.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'deviceCategory' }],
          metrics: [{ name: 'activeUsers' }],
        },
      }).catch((err) => {
        console.error('[Analytics] 디바이스별 방문자 조회 오류:', err.message || err);
        return null;
      }),

      // 7. 페이지별 방문자 (최근 30일)
      analyticsData.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'pagePath' }],
          metrics: [
            { name: 'screenPageViews' },
            { name: 'activeUsers' },
            { name: 'userEngagementDuration' },
          ],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: '20',
        },
      }).catch((err) => {
        console.error('[Analytics] 페이지별 방문자 조회 오류:', err.message || err);
        return null;
      }),
    ]);

    // 디버깅: 응답 상태 로깅
    console.log('[Analytics] API 응답 상태:', {
      realtime: realtimeResponse ? 'OK' : 'NULL',
      today: todayResponse ? 'OK' : 'NULL',
      last30Days: last30DaysResponse ? 'OK' : 'NULL',
      total: totalResponse ? 'OK' : 'NULL',
      region: regionResponse ? 'OK' : 'NULL',
      device: deviceResponse ? 'OK' : 'NULL',
      page: pageResponse ? 'OK' : 'NULL',
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

    // 지역별 방문자
    const regionData = regionResponse?.data?.rows?.map(row => ({
      region: row.dimensionValues?.[0]?.value || '(unknown)',
      users: parseInt(row.metricValues?.[0]?.value || '0', 10),
    })).filter(r => r.region !== '(not set)') || [];

    // 디바이스별 방문자
    const deviceData = deviceResponse?.data?.rows?.map(row => ({
      device: row.dimensionValues?.[0]?.value || 'unknown',
      users: parseInt(row.metricValues?.[0]?.value || '0', 10),
    })) || [];

    // 디바이스 비율 계산
    const totalDeviceUsers = deviceData.reduce((sum, d) => sum + d.users, 0);
    const deviceRatio = {
      desktop: deviceData.find(d => d.device === 'desktop')?.users || 0,
      mobile: deviceData.find(d => d.device === 'mobile')?.users || 0,
      tablet: deviceData.find(d => d.device === 'tablet')?.users || 0,
      total: totalDeviceUsers,
    };

    // 페이지 경로 → 한글 이름 매핑 (DGER 3.0 + 2.0 통합)
    const pageNameMap: { [key: string]: string } = {
      // DGER 3.0 (Next.js) 경로
      '/': '병상현황',
      '/bed': '병상현황',
      '/map': '지도',
      '/message': '응급메시지',
      '/messages': '응급메시지',
      '/severe': '중증질환',
      '/feedback': '피드백',
      // DGER 2.0 (Node.js) 레거시 경로 - 같은 기능으로 통합 집계
      '/index.html': '병상현황',
      '/systommsg.html': '응급메시지',
      '/27severe.html': '중증질환',
    };

    // 시스템 경로 - 통계에서 제외
    const legacyPaths = ['/home', '/api/', '/_next/', '/favicon', '/temp.html', '/lab.html', '/feed.html', '/index3.html'];

    // 페이지별 방문자
    const pageData = pageResponse?.data?.rows?.map(row => {
      const path = row.dimensionValues?.[0]?.value || '/';
      // 쿼리스트링 제거 및 정규화
      const cleanPath = path.split('?')[0].split('#')[0];

      // 레거시/시스템 경로 제외
      if (legacyPaths.some(legacy => cleanPath.startsWith(legacy))) return null;

      const pageName = pageNameMap[cleanPath];
      // 매핑되지 않은 경로는 제외
      if (!pageName) return null;

      const pageViews = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const totalEngagementDuration = parseFloat(row.metricValues?.[2]?.value || '0');
      // 활성 사용자당 평균 참여 시간 (초)
      const avgEngagementTime = users > 0 ? totalEngagementDuration / users : 0;

      return {
        path: cleanPath,
        name: pageName,
        pageViews,
        users,
        avgEngagementTime,
      };
    }).filter((p): p is NonNullable<typeof p> => p !== null) || [];

    // 중복 페이지 통합 (같은 이름으로 매핑된 경로들)
    // 주의: users는 합산하면 중복 집계됨 → 가장 큰 값 사용
    const consolidatedPages = new Map<string, { name: string; pageViews: number; maxUsers: number; totalEngagement: number; totalEngagementUsers: number }>();
    pageData.forEach(p => {
      const existing = consolidatedPages.get(p.name);
      if (existing) {
        existing.pageViews += p.pageViews;
        // users는 중복될 수 있으므로 가장 큰 값만 사용 (합산하면 중복 집계됨)
        existing.maxUsers = Math.max(existing.maxUsers, p.users);
        // 참여시간 가중평균 계산용
        existing.totalEngagement += p.avgEngagementTime * p.users;
        existing.totalEngagementUsers += p.users;
      } else {
        consolidatedPages.set(p.name, {
          name: p.name,
          pageViews: p.pageViews,
          maxUsers: p.users,
          totalEngagement: p.avgEngagementTime * p.users,
          totalEngagementUsers: p.users,
        });
      }
    });

    // 상위 5개 페이지만 반환
    const topPages = Array.from(consolidatedPages.values())
      .sort((a, b) => b.pageViews - a.pageViews)
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        pageViews: p.pageViews,
        users: p.maxUsers, // 중복 방지를 위해 최대값 사용
        avgEngagementTime: p.totalEngagementUsers > 0 ? p.totalEngagement / p.totalEngagementUsers : 0,
      }));

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
        regionStats: regionData.slice(0, 8), // 상위 8개 지역
        deviceRatio,
        // 디버그: 지도 페이지 원본 데이터
        _debug_mapPageRaw: pageData.filter(p => p.name === '지도'),
        topPages,
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
