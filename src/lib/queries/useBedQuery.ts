'use client';

/**
 * 병상 데이터 React Query 훅
 * 캐싱, 자동 리페치, 에러 핸들링 포함
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/lib/stores/useAppStore';
import { mapSidoName } from '@/lib/utils/regionMapping';
import {
  sortHospitals,
  isCenterHospital,
  calculateTotalOccupancy,
  type HospitalBedFields
} from '@/lib/utils/hospitalUtils';

// ===== 타입 정의 =====

export interface HospitalBedData {
  hpid: string;
  dutyName: string;
  dutyAddr: string;
  dutyTel3: string;
  region: string;

  // 일반 병상
  hvec: number;   // 응급실 가용 병상
  hvs01: number;  // 응급실 총 병상

  // 중환자실
  hv27: number;   // 코호트 가용
  HVS59: number;  // 코호트 총

  // 음압격리 (통합)
  hv29: number;   // 응급실 음압 가용
  hv13: number;   // 음압격리 가용 (추가)
  HVS03: number;  // 응급실 음압 총
  HVS46: number;  // 음압격리 총 (추가)

  // 일반격리 (통합)
  hv30: number;   // 응급실 일반격리 가용
  hv14: number;   // 일반격리 가용 (추가)
  HVS04: number;  // 응급실 일반격리 총
  HVS47: number;  // 일반격리 총 (추가)

  // 소아
  hv28: number;   // 소아 가용
  HVS02: number;  // 소아 총
  hv15: number;   // 소아 음압 가용
  HVS48: number;  // 소아 음압 총
  hv16: number;   // 소아 일반 가용
  HVS49: number;  // 소아 일반 총

  // 기타 정보
  hvidate: string;
  dutyHayn: number;
  dutyHano: number;

  // 병원 분류
  dutyEmcls: string;
  dutyEmclsName: string;
}

interface BedQueryResult {
  data: HospitalBedData[];
  totalCount: number;
  centerCount: number;
  lastUpdated: string;
}

// ===== API 호출 함수 =====

async function fetchBedData(region: string): Promise<BedQueryResult> {
  const mappedRegion = mapSidoName(region);
  const response = await fetch(`/api/bed-info?region=${encodeURIComponent(mappedRegion)}`);

  if (!response.ok) {
    throw new Error(`병상 정보 조회 실패: ${response.status}`);
  }

  const xmlText = await response.text();
  const hospitals = parseBedXml(xmlText);
  const sortedHospitals = sortHospitals(hospitals);

  return {
    data: sortedHospitals,
    totalCount: sortedHospitals.length,
    centerCount: sortedHospitals.filter(h => isCenterHospital({ dutyEmclsName: h.dutyEmclsName, dutyEmcls: h.dutyEmcls })).length,
    lastUpdated: new Date().toISOString(),
  };
}

// ===== XML 파싱 =====

function parseBedXml(xmlText: string): HospitalBedData[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const items = doc.querySelectorAll('item');

  return Array.from(items).map((item) => ({
    hpid: item.querySelector('hpid')?.textContent || '',
    dutyName: item.querySelector('dutyName')?.textContent || '',
    dutyAddr: item.querySelector('dutyAddr')?.textContent || '',
    dutyTel3: item.querySelector('dutyTel3')?.textContent || '',
    region: item.querySelector('region')?.textContent || '',

    hvec: parseInt(item.querySelector('hvec')?.textContent || '0'),
    hvs01: parseInt(item.querySelector('hvs01')?.textContent || '0'),

    hv27: parseInt(item.querySelector('hv27')?.textContent || '0'),
    HVS59: parseInt(item.querySelector('hvs59')?.textContent || '0'),

    hv29: parseInt(item.querySelector('hv29')?.textContent || '0'),
    hv13: parseInt(item.querySelector('hv13')?.textContent || '0'),
    HVS03: parseInt(item.querySelector('hvs03')?.textContent || '0'),
    HVS46: parseInt(item.querySelector('hvs46')?.textContent || '0'),

    hv30: parseInt(item.querySelector('hv30')?.textContent || '0'),
    hv14: parseInt(item.querySelector('hv14')?.textContent || '0'),
    HVS04: parseInt(item.querySelector('hvs04')?.textContent || '0'),
    HVS47: parseInt(item.querySelector('hvs47')?.textContent || '0'),

    hv28: parseInt(item.querySelector('hv28')?.textContent || '0'),
    HVS02: parseInt(item.querySelector('hvs02')?.textContent || '0'),
    hv15: parseInt(item.querySelector('hv15')?.textContent || '0'),
    HVS48: parseInt(item.querySelector('hvs48')?.textContent || '0'),
    hv16: parseInt(item.querySelector('hv16')?.textContent || '0'),
    HVS49: parseInt(item.querySelector('hvs49')?.textContent || '0'),

    hvidate: item.querySelector('hvidate')?.textContent || '',
    dutyHayn: parseInt(item.querySelector('dutyHayn')?.textContent || '0'),
    dutyHano: parseInt(item.querySelector('dutyHano')?.textContent || '0'),

    dutyEmcls: item.querySelector('dutyEmcls')?.textContent || '',
    dutyEmclsName: item.querySelector('dutyEmclsName')?.textContent || '',
  }));
}

// ===== Query Key =====

export const bedQueryKeys = {
  all: ['bed'] as const,
  list: (region: string) => [...bedQueryKeys.all, 'list', region] as const,
};

// ===== React Query Hook =====

export function useBedQuery(region?: string) {
  const storeRegion = useAppStore((state) => state.filters.selectedRegion);
  const targetRegion = region || storeRegion;
  const { recordCacheHit, recordCacheMiss, updateLastRefresh } = useAppStore();

  return useQuery({
    queryKey: bedQueryKeys.list(targetRegion),
    queryFn: async () => {
      const result = await fetchBedData(targetRegion);
      updateLastRefresh(`bed-${targetRegion}`);
      return result;
    },
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 5 * 60 * 1000, // 5분
    refetchInterval: 2 * 60 * 1000, // 2분마다 자동 갱신
  });
}

// ===== 프리페치 함수 =====

export function usePrefetchBedData() {
  const queryClient = useQueryClient();

  return (region: string) => {
    queryClient.prefetchQuery({
      queryKey: bedQueryKeys.list(region),
      queryFn: () => fetchBedData(region),
      staleTime: 2 * 60 * 1000,
    });
  };
}

// ===== 캐시 무효화 =====

export function useInvalidateBedData() {
  const queryClient = useQueryClient();

  return (region?: string) => {
    if (region) {
      queryClient.invalidateQueries({ queryKey: bedQueryKeys.list(region) });
    } else {
      queryClient.invalidateQueries({ queryKey: bedQueryKeys.all });
    }
  };
}
