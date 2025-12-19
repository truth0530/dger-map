/**
 * 캐시 상태 모니터링 API
 * 서버 캐시 통계 및 성능 메트릭 조회
 */

import { NextResponse } from 'next/server';
import { getLogHistory, getPerformanceMetrics, getAveragePerformance } from '@/lib/utils/logger';

// ===== 캐시 인스턴스 참조 =====
// 각 API 라우트의 캐시 인스턴스에서 통계 가져오기

interface CacheStats {
  name: string;
  size: number;
  maxSize: number;
  ttl: number;
  hits: number;
  misses: number;
  hitRate: string;
  evictions: number;
}

// 글로벌 캐시 레지스트리
const globalForCache = globalThis as unknown as {
  _cacheRegistry: Map<string, {
    getStats: () => { hits: number; misses: number; size: number; sets: number; evictions: number };
    maxSize: number;
    ttl: number;
  }>;
};

if (!globalForCache._cacheRegistry) {
  globalForCache._cacheRegistry = new Map();
}

// 캐시 등록 함수 (SimpleCache에서 호출)
export function registerCache(
  name: string,
  cache: {
    getStats: () => { hits: number; misses: number; size: number; sets: number; evictions: number };
    maxSize: number;
    ttl: number;
  }
): void {
  globalForCache._cacheRegistry.set(name, cache);
}

export async function GET() {
  try {
    // 캐시 통계 수집
    const cacheStats: CacheStats[] = [];

    globalForCache._cacheRegistry.forEach((cache, name) => {
      const stats = cache.getStats();
      const totalRequests = stats.hits + stats.misses;
      const hitRate = totalRequests > 0
        ? ((stats.hits / totalRequests) * 100).toFixed(2) + '%'
        : 'N/A';

      cacheStats.push({
        name,
        size: stats.size,
        maxSize: cache.maxSize,
        ttl: cache.ttl,
        hits: stats.hits,
        misses: stats.misses,
        hitRate,
        evictions: stats.evictions,
      });
    });

    // 성능 메트릭
    const recentMetrics = getPerformanceMetrics({ limit: 20 });
    const avgApiResponse = getAveragePerformance('api');
    const avgXmlParse = getAveragePerformance('xml');

    // 최근 에러 로그
    const recentErrors = getLogHistory({ level: 'error', limit: 10 });

    // 전체 요약
    const summary = {
      totalCaches: cacheStats.length,
      totalCacheSize: cacheStats.reduce((sum, c) => sum + c.size, 0),
      totalHits: cacheStats.reduce((sum, c) => sum + c.hits, 0),
      totalMisses: cacheStats.reduce((sum, c) => sum + c.misses, 0),
      avgApiResponseTime: avgApiResponse ? `${avgApiResponse.toFixed(2)}ms` : 'N/A',
      avgXmlParseTime: avgXmlParse ? `${avgXmlParse.toFixed(2)}ms` : 'N/A',
      errorCount: recentErrors.length,
    };

    // 히트율 계산
    const totalRequests = summary.totalHits + summary.totalMisses;
    const overallHitRate = totalRequests > 0
      ? ((summary.totalHits / totalRequests) * 100).toFixed(2) + '%'
      : 'N/A';

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        ...summary,
        overallHitRate,
      },
      caches: cacheStats,
      performance: {
        recent: recentMetrics.map((m) => ({
          name: m.name,
          duration: m.duration ? `${m.duration.toFixed(2)}ms` : 'pending',
          metadata: m.metadata,
        })),
        averages: {
          apiResponse: avgApiResponse ? `${avgApiResponse.toFixed(2)}ms` : 'N/A',
          xmlParse: avgXmlParse ? `${avgXmlParse.toFixed(2)}ms` : 'N/A',
        },
      },
      errors: recentErrors.map((e) => ({
        timestamp: e.timestamp,
        context: e.context,
        message: e.message,
        error: e.error,
      })),
    });
  } catch (error) {
    console.error('[cache-status] 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '캐시 상태 조회 실패',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
