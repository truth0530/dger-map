/**
 * 간단하고 안전한 메모리 캐시 구현
 * 원본: dger-api/js/simple-cache.js
 *
 * - TTL 기반 자동 만료
 * - 메모리 사용량 제한 (LRU)
 * - 통계 수집
 */

interface CacheItem<T> {
  data: T;
  expires: number;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
}

export class SimpleCache<T = unknown> {
  private cache: Map<string, CacheItem<T>>;
  private maxSize: number;
  private defaultTTL: number;
  private stats: CacheStats;
  private name: string;

  constructor(maxSize: number = 100, defaultTTL: number = 300000, name: string = 'cache') {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.name = name;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };

    console.log(`[${this.name}] SimpleCache 초기화: 최대크기=${maxSize}, 기본TTL=${defaultTTL}ms`);
  }

  /**
   * 캐시에서 값 조회
   */
  get(key: string): T | null {
    const item = this.cache.get(key);

    // 캐시 항목이 없는 경우
    if (!item) {
      this.stats.misses++;
      return null;
    }

    // 만료 확인
    if (item.expires && item.expires <= Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      console.log(`[${this.name}] 캐시 만료: ${key}`);
      return null;
    }

    // 캐시 히트
    this.stats.hits++;
    console.log(`[${this.name}] 캐시 히트: ${key}`);
    return item.data;
  }

  /**
   * 캐시에 값 저장
   */
  set(key: string, data: T, ttl: number | null = null): void {
    // TTL 계산
    const expires = Date.now() + (ttl ?? this.defaultTTL);

    // 메모리 관리: 최대 크기 초과시 오래된 항목 제거 (LRU)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
        console.log(`[${this.name}] 캐시 제거 (LRU): ${firstKey}`);
      }
    }

    // 데이터 저장
    this.cache.set(key, {
      data,
      expires,
      createdAt: Date.now()
    });

    this.stats.sets++;
    console.log(`[${this.name}] 캐시 저장: ${key} (TTL: ${ttl ?? this.defaultTTL}ms)`);
  }

  /**
   * 특정 키 삭제
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`[${this.name}] 캐시 수동 삭제: ${key}`);
    }
    return deleted;
  }

  /**
   * 모든 캐시 삭제
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[${this.name}] 전체 캐시 삭제: ${size}개 항목`);
  }

  /**
   * 만료된 항목들 정리
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache.entries()) {
      if (item.expires && item.expires <= now) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[${this.name}] 만료된 캐시 정리: ${cleaned}개 항목`);
    }

    return cleaned;
  }

  /**
   * 캐시 통계 조회
   */
  getStats(): {
    hits: number;
    misses: number;
    sets: number;
    evictions: number;
    hitRate: number;
    size: number;
    maxSize: number;
    memoryUsageKB: number;
    efficiency: 'excellent' | 'good' | 'needs_improvement';
  } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? Math.round((this.stats.hits / total) * 100) : 0;

    // 메모리 사용량 추정 (대략적)
    const avgItemSize = 1000; // 평균 1KB로 가정
    const memoryUsageKB = Math.round((this.cache.size * avgItemSize) / 1024);

    return {
      ...this.stats,
      hitRate,
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsageKB,
      efficiency: hitRate > 70 ? 'excellent' : hitRate > 50 ? 'good' : 'needs_improvement'
    };
  }

  /**
   * 캐시 상태 요약
   */
  getSummary(): string {
    const stats = this.getStats();
    return `[${this.name}] 캐시 현황: ${stats.size}/${stats.maxSize} 항목, 히트율 ${stats.hitRate}%, 메모리 ${stats.memoryUsageKB}KB`;
  }

  /**
   * 캐시 키 존재 여부 확인 (만료 포함)
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    if (item.expires && item.expires <= Date.now()) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }
}

// 전역 캐시 인스턴스들 (싱글톤)
const globalForCache = global as unknown as {
  bedInfoCache: SimpleCache<string>;
  hospitalListCache: SimpleCache<string>;
  emergencyMessageCache: SimpleCache<string>;
  severeDiseasesCache: SimpleCache<string>;
};

export const bedInfoCache = globalForCache.bedInfoCache ?? new SimpleCache<string>(100, 300000, 'bedInfo'); // 5분
export const hospitalListCache = globalForCache.hospitalListCache ?? new SimpleCache<string>(100, 600000, 'hospitalList'); // 10분
export const emergencyMessageCache = globalForCache.emergencyMessageCache ?? new SimpleCache<string>(500, 180000, 'emergencyMessage'); // 3분
export const severeDiseasesCache = globalForCache.severeDiseasesCache ?? new SimpleCache<string>(100, 300000, 'severeDiseases'); // 5분

if (process.env.NODE_ENV !== 'production') {
  globalForCache.bedInfoCache = bedInfoCache;
  globalForCache.hospitalListCache = hospitalListCache;
  globalForCache.emergencyMessageCache = emergencyMessageCache;
  globalForCache.severeDiseasesCache = severeDiseasesCache;
}
