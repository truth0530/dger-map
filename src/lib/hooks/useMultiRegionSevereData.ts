'use client';

/**
 * 멀티 지역 중증질환 데이터 조회 훅
 * 여러 지역의 중증질환 데이터를 병렬로 가져와 병합
 */

import { useState, useCallback, useRef } from 'react';
import { HospitalSevereData } from './useSevereData';
import { mapSidoName } from '@/lib/utils/regionMapping';

// API 응답 타입
interface SevereDataApiResponse {
  success: boolean;
  code: string;
  message: string;
  items: HospitalSevereData[];
  totalCount: number;
  usedSample: boolean;
}

const CACHE_TTL = 5 * 60 * 1000; // 5분

interface CacheEntry {
  data: HospitalSevereData[];
  timestamp: number;
}

export function useMultiRegionSevereData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HospitalSevereData[]>([]);
  const [loadedRegions, setLoadedRegions] = useState<string[]>([]);

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  /**
   * 단일 지역 데이터 fetch (내부용)
   */
  const fetchSingleRegion = useCallback(async (
    region: string,
    forceRefresh: boolean
  ): Promise<HospitalSevereData[]> => {
    const mappedRegion = mapSidoName(region);
    const cacheKey = `severe_${mappedRegion}`;
    const now = Date.now();

    // 캐시 확인
    if (!forceRefresh) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
    }

    const params = new URLSearchParams({
      STAGE1: mappedRegion,
      numOfRows: '1000',
      pageNo: '1'
    });

    const response = await fetch(`/api/severe-diseases?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} (${region})`);
    }

    const json: SevereDataApiResponse = await response.json();

    if (!json.success) {
      throw new Error(json.message || `API 오류: ${json.code}`);
    }

    const hospitalData = json.items;

    // 캐시 저장
    cacheRef.current.set(cacheKey, {
      data: hospitalData,
      timestamp: now
    });

    return hospitalData;
  }, []);

  /**
   * 여러 지역 데이터를 병렬로 fetch
   */
  const fetchMultiRegions = useCallback(async (
    regions: string[],
    forceRefresh = false
  ): Promise<HospitalSevereData[]> => {
    if (regions.length === 0) {
      setData([]);
      setLoadedRegions([]);
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      // 모든 지역 병렬 fetch
      const results = await Promise.all(
        regions.map(region => fetchSingleRegion(region, forceRefresh))
      );

      // 결과 병합 (중복 제거 - hpid 기준)
      const mergedMap = new Map<string, HospitalSevereData>();
      results.flat().forEach(hospital => {
        // 동일 병원이 여러 지역에 있을 경우 첫 번째 것 유지
        if (!mergedMap.has(hospital.hpid)) {
          mergedMap.set(hospital.hpid, hospital);
        }
      });

      const mergedData = Array.from(mergedMap.values());

      setData(mergedData);
      setLoadedRegions(regions);

      return mergedData;
    } catch (err) {
      const message = err instanceof Error ? err.message : '데이터 조회 실패';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [fetchSingleRegion]);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    loading,
    error,
    data,
    loadedRegions,
    fetchMultiRegions,
    clearCache
  };
}
