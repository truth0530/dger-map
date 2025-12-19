'use client';

/**
 * 중증질환 데이터 React Query 훅
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/lib/stores/useAppStore';
import { mapSidoName } from '@/lib/utils/regionMapping';
import { SEVERE_TYPES } from '@/lib/constants/dger';

// ===== 타입 정의 =====

export interface HospitalSevereData {
  hpid: string;
  dutyName: string;
  dutyAddr: string;
  dutyTel3: string;
  [key: string]: string | boolean | number | null;
}

export interface DiseaseStats {
  key: string;
  label: string;
  available: number;
  unavailable: number;
  unknown: number;
  total: number;
  hospitals: Array<{
    hpid: string;
    name: string;
    addr: string;
    isAvailable: boolean | null;
  }>;
}

interface SevereQueryResult {
  hospitals: HospitalSevereData[];
  diseaseStats: DiseaseStats[];
  lastUpdated: string;
}

// ===== API 호출 함수 =====

async function fetchSevereData(region: string): Promise<SevereQueryResult> {
  const mappedRegion = mapSidoName(region);
  const response = await fetch(`/api/severe-diseases?region=${encodeURIComponent(mappedRegion)}`);

  if (!response.ok) {
    throw new Error(`중증질환 정보 조회 실패: ${response.status}`);
  }

  const xmlText = await response.text();
  const hospitals = parseSevereXml(xmlText);
  const diseaseStats = calculateDiseaseStats(hospitals);

  return {
    hospitals,
    diseaseStats,
    lastUpdated: new Date().toISOString(),
  };
}

// ===== XML 파싱 =====

function parseSevereXml(xmlText: string): HospitalSevereData[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const items = doc.querySelectorAll('item');

  return Array.from(items).map((item) => {
    const hospital: HospitalSevereData = {
      hpid: item.querySelector('hpid')?.textContent || '',
      dutyName: item.querySelector('dutyName')?.textContent || '',
      dutyAddr: item.querySelector('dutyAddr')?.textContent || '',
      dutyTel3: item.querySelector('dutyTel3')?.textContent || '',
    };

    // 27개 중증질환 필드 파싱
    SEVERE_TYPES.forEach((type) => {
      const value = item.querySelector(type.key.toLowerCase())?.textContent;
      if (value === 'Y') {
        hospital[type.key] = true;
      } else if (value === 'N') {
        hospital[type.key] = false;
      } else {
        hospital[type.key] = null;
      }
    });

    return hospital;
  });
}

// ===== 질환별 통계 계산 =====

function calculateDiseaseStats(hospitals: HospitalSevereData[]): DiseaseStats[] {
  return SEVERE_TYPES.map((type) => {
    const hospitalStats = hospitals.map((h) => ({
      hpid: h.hpid,
      name: h.dutyName,
      addr: h.dutyAddr,
      isAvailable: h[type.key] as boolean | null,
    }));

    const available = hospitalStats.filter((h) => h.isAvailable === true).length;
    const unavailable = hospitalStats.filter((h) => h.isAvailable === false).length;
    const unknown = hospitalStats.filter((h) => h.isAvailable === null).length;

    return {
      key: type.key,
      label: type.label,
      available,
      unavailable,
      unknown,
      total: hospitals.length,
      hospitals: hospitalStats,
    };
  });
}

// ===== Query Key =====

export const severeQueryKeys = {
  all: ['severe'] as const,
  list: (region: string) => [...severeQueryKeys.all, 'list', region] as const,
};

// ===== React Query Hook =====

export function useSevereQuery(region?: string) {
  const storeRegion = useAppStore((state) => state.filters.selectedRegion);
  const targetRegion = region || storeRegion;
  const { updateLastRefresh } = useAppStore();

  return useQuery({
    queryKey: severeQueryKeys.list(targetRegion),
    queryFn: async () => {
      const result = await fetchSevereData(targetRegion);
      updateLastRefresh(`severe-${targetRegion}`);
      return result;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}

// ===== 프리페치 =====

export function usePrefetchSevereData() {
  const queryClient = useQueryClient();

  return (region: string) => {
    queryClient.prefetchQuery({
      queryKey: severeQueryKeys.list(region),
      queryFn: () => fetchSevereData(region),
      staleTime: 2 * 60 * 1000,
    });
  };
}

// ===== 캐시 무효화 =====

export function useInvalidateSevereData() {
  const queryClient = useQueryClient();

  return (region?: string) => {
    if (region) {
      queryClient.invalidateQueries({ queryKey: severeQueryKeys.list(region) });
    } else {
      queryClient.invalidateQueries({ queryKey: severeQueryKeys.all });
    }
  };
}
