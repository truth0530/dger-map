'use client';

/**
 * 멀티 지역 병상 정보 데이터 조회 훅
 * 여러 지역의 데이터를 병렬로 가져와 병합
 */

import { useState, useCallback, useRef } from 'react';
import { HospitalBedData, HospitalOrgType } from './useBedData';
import { BedStatus } from '@/lib/constants/dger';
import { mapSidoName } from '@/lib/utils/regionMapping';

// API 응답 타입
interface BedInfoApiResponse {
  success: boolean;
  code: string;
  message: string;
  items: Array<{
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
    hvidate: string;
    occupancy: number;
    occupancyRate: number;
    generalStatus: BedStatus;
  }>;
  totalCount: number;
  usedSample: boolean;
}

// 지역 정보가 포함된 병원 데이터
export interface HospitalBedDataWithRegion extends HospitalBedData {
  region: string;  // 소속 지역 (예: '대구', '경북')
}

const CACHE_TTL = 2 * 60 * 1000; // 2분

interface CacheEntry {
  data: HospitalBedDataWithRegion[];
  timestamp: number;
}

export function useMultiRegionBedData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HospitalBedDataWithRegion[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [loadedRegions, setLoadedRegions] = useState<string[]>([]);

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  /**
   * 단일 지역 데이터 fetch (내부용)
   */
  const fetchSingleRegion = useCallback(async (
    region: string,
    forceRefresh: boolean
  ): Promise<HospitalBedDataWithRegion[]> => {
    const mappedRegion = mapSidoName(region);
    const cacheKey = `bed_${mappedRegion}`;
    const now = Date.now();

    // 캐시 확인
    if (!forceRefresh) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
    }

    const params = new URLSearchParams({ region: mappedRegion });
    const response = await fetch(`/api/bed-info?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} (${region})`);
    }

    const json: BedInfoApiResponse = await response.json();

    if (!json.success) {
      throw new Error(json.message || `API 오류: ${json.code}`);
    }

    // API 응답을 클라이언트 인터페이스로 매핑 + 지역 정보 추가
    const hospitalData: HospitalBedDataWithRegion[] = json.items.map(item => ({
      hpid: item.hpid,
      dutyName: item.dutyName,
      dutyEmclsName: item.dutyEmclsName,
      hpbd: item.hpbd,
      dutyAddr: item.dutyAddr,
      dutyTel3: item.dutyTel3,
      hvec: item.hvec,
      hvs01: item.hvs01,
      hv27: item.hv27,
      HVS59: item.hvs59,
      hv29: item.hv29,
      HVS03: item.hvs03,
      hv13: item.hv13,
      HVS46: item.hvs46,
      hv30: item.hv30,
      HVS04: item.hvs04,
      hv14: item.hv14,
      HVS47: item.hvs47,
      hv28: item.hv28,
      HVS02: item.hvs02,
      hv15: item.hv15,
      HVS48: item.hvs48,
      hv16: item.hv16,
      HVS49: item.hvs49,
      hvidate: item.hvidate,
      occupancy: item.occupancy,
      occupancyRate: item.occupancyRate,
      generalStatus: item.generalStatus,
      region: region  // 원본 지역명 유지 (예: '대구')
    }));

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
  ): Promise<HospitalBedDataWithRegion[]> => {
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
      const mergedMap = new Map<string, HospitalBedDataWithRegion>();
      results.flat().forEach(hospital => {
        // 동일 병원이 여러 지역에 있을 경우 첫 번째 것 유지
        if (!mergedMap.has(hospital.hpid)) {
          mergedMap.set(hospital.hpid, hospital);
        }
      });

      const mergedData = Array.from(mergedMap.values());

      setData(mergedData);
      setLastUpdate(new Date());
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

  /**
   * 특정 병원 ID 목록으로 필터링하여 fetch
   * 모든 지역에서 해당 병원들을 찾아 반환
   */
  const fetchByHospitalIds = useCallback(async (
    hospitalIds: string[],
    forceRefresh = false
  ): Promise<HospitalBedDataWithRegion[]> => {
    if (hospitalIds.length === 0) {
      setData([]);
      setLoadedRegions([]);
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      // 캐시된 모든 지역 데이터에서 먼저 찾기
      const foundInCache = new Set<string>();
      const result: HospitalBedDataWithRegion[] = [];

      cacheRef.current.forEach((entry) => {
        entry.data.forEach(hospital => {
          if (hospitalIds.includes(hospital.hpid) && !foundInCache.has(hospital.hpid)) {
            foundInCache.add(hospital.hpid);
            result.push(hospital);
          }
        });
      });

      // 모든 병원을 찾았으면 바로 반환
      if (foundInCache.size === hospitalIds.length && !forceRefresh) {
        setData(result);
        setLastUpdate(new Date());
        return result;
      }

      // 캐시에서 못 찾은 병원이 있으면 전체 지역 fetch 필요
      // (어느 지역에 속한지 모르므로)
      // TODO: 병원 ID → 지역 매핑 테이블이 있으면 최적화 가능
      const allRegions = ['대구', '경북', '부산', '울산', '경남', '서울', '인천',
        '경기', '강원', '대전', '세종', '충북', '충남', '광주', '전북', '전남', '제주'];

      const allData = await fetchMultiRegions(allRegions, forceRefresh);

      // 요청된 병원만 필터링
      const filtered = allData.filter(h => hospitalIds.includes(h.hpid));

      setData(filtered);
      setLastUpdate(new Date());
      setLoadedRegions(['커스텀']);

      return filtered;
    } catch (err) {
      const message = err instanceof Error ? err.message : '데이터 조회 실패';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [fetchMultiRegions]);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    loading,
    error,
    data,
    lastUpdate,
    loadedRegions,
    fetchMultiRegions,
    fetchByHospitalIds,
    clearCache
  };
}
