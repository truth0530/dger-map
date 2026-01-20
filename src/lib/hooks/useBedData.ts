'use client';

/**
 * 병상 정보 데이터 조회 훅
 * - API가 JSON을 반환하므로 클라이언트에서 XML 파싱 불필요
 * - 병원 유형(hpbd)이 서버에서 포함되어 별도 로드 불필요
 */

import { useState, useCallback, useRef } from 'react';
import { BedStatus } from '@/lib/constants/dger';

// 병원 유형 (권역/센터/기관)
export type HospitalOrgType = '권역응급의료센터' | '지역응급의료센터' | '전문응급의료센터' | '지역응급의료기관' | '';

export interface HospitalBedData {
  hpid: string;
  dutyName: string;
  dutyEmclsName: string;
  hpbd: HospitalOrgType;
  dutyAddr: string;
  dutyTel3: string;
  hvec: number;
  hvs01: number;
  hv27: number;
  HVS59: number;
  hv29: number;
  HVS03: number;
  hv13: number;
  HVS46: number;
  hv30: number;
  HVS04: number;
  hv14: number;
  HVS47: number;
  hv28: number;
  HVS02: number;
  hv15: number;
  HVS48: number;
  hv16: number;
  HVS49: number;
  hv60: number;   // 외상소생실 가용
  HVS60: number;  // 외상소생실 총
  hv61: number;   // 외상환자진료구역 가용
  HVS61: number;  // 외상환자진료구역 총
  hvidate: string;
  occupancy: number;
  occupancyRate: number;
  generalStatus: BedStatus;
}

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
    hv60: number;
    hvs60: number;
    hv61: number;
    hvs61: number;
    hvidate: string;
    occupancy: number;
    occupancyRate: number;
    generalStatus: BedStatus;
  }>;
  totalCount: number;
  usedSample: boolean;
}

const CACHE_TTL = 2 * 60 * 1000; // 2분

interface CacheEntry {
  data: HospitalBedData[];
  timestamp: number;
}

export function useBedData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HospitalBedData[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  const fetchBedData = useCallback(async (region: string, forceRefresh = false) => {
    const cacheKey = `bed_${region}`;
    const now = Date.now();

    // 캐시 확인
    if (!forceRefresh) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_TTL) {
        setData(cached.data);
        setLastUpdate(new Date(cached.timestamp));
        return cached.data;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ region });
      const response = await fetch(`/api/bed-info?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json: BedInfoApiResponse = await response.json();

      if (!json.success) {
        throw new Error(json.message || `API 오류: ${json.code}`);
      }

      // API 응답의 소문자 필드를 클라이언트 인터페이스의 대문자 필드로 매핑
      const hospitalData: HospitalBedData[] = json.items.map(item => ({
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
        hv60: item.hv60,
        HVS60: item.hvs60,
        hv61: item.hv61,
        HVS61: item.hvs61,
        hvidate: item.hvidate,
        occupancy: item.occupancy,
        occupancyRate: item.occupancyRate,
        generalStatus: item.generalStatus,
      }));

      // 캐시 저장
      cacheRef.current.set(cacheKey, {
        data: hospitalData,
        timestamp: now
      });

      setData(hospitalData);
      setLastUpdate(new Date(now));

      return hospitalData;
    } catch (err) {
      const message = err instanceof Error ? err.message : '데이터 조회 실패';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    loading,
    error,
    data,
    lastUpdate,
    fetchBedData,
    clearCache,
    // 하위 호환성: 서버에서 병원 유형을 포함하므로 항상 true
    hospitalTypeMapReady: true
  };
}
