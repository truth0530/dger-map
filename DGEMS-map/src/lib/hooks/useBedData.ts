'use client';

/**
 * 병상 정보 데이터 조회 훅
 */

import { useState, useCallback, useRef } from 'react';
import { parseXml, getXmlText, getXmlNumber, getXmlItems, checkResultCode } from '@/lib/utils/xmlParser';
import { BED_DEFINITIONS, getBedStatus, BedStatus } from '@/lib/constants/dger';

export interface HospitalBedData {
  hpid: string;
  dutyName: string;
  dutyEmclsName: string;
  dutyAddr: string;
  dutyTel3: string;
  // 일반 병상
  hvec: number;  // 응급실 가용
  hvs01: number; // 응급실 총계
  // 코호트 격리
  hv27: number;  // 가용
  HVS59: number; // 총계
  // 응급실 음압격리
  hv29: number;  // 가용
  HVS03: number; // 총계
  // 응급실 일반격리
  hv30: number;  // 가용
  HVS04: number; // 총계
  // 소아 응급실
  hv28: number;  // 가용
  HVS02: number; // 총계
  // 소아 음압격리
  hv15: number;  // 가용
  HVS48: number; // 총계
  // 소아 일반격리
  hv16: number;  // 가용
  HVS49: number; // 총계
  // 메시지 정보
  hvidate: string; // 최종 업데이트 시간
  // 계산된 값
  occupancy: number; // 재실인원
  occupancyRate: number; // 점유율
  generalStatus: BedStatus;
}

const CACHE_TTL = 2 * 60 * 1000; // 2분 (병상 정보는 더 자주 갱신)

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

  const calculateOccupancy = (hospital: Partial<HospitalBedData>): number => {
    const total = hospital.hvs01 || 0;
    const available = hospital.hvec || 0;
    return Math.max(0, total - available);
  };

  const calculateOccupancyRate = (hospital: Partial<HospitalBedData>): number => {
    const total = hospital.hvs01 || 0;
    if (total === 0) return 0;
    const occupancy = calculateOccupancy(hospital);
    return Math.round((occupancy / total) * 100);
  };

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
      const params = new URLSearchParams({
        region: region
      });

      const response = await fetch(`/api/bed-info?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const xml = await response.text();
      const doc = parseXml(xml);

      const result = checkResultCode(doc);
      if (!result.success) {
        throw new Error(result.message || `API 오류: ${result.code}`);
      }

      const items = getXmlItems(doc);
      const hospitalData: HospitalBedData[] = items.map(item => {
        const bedData: Partial<HospitalBedData> = {
          hpid: getXmlText(item, 'hpid'),
          dutyName: getXmlText(item, 'dutyName'),
          dutyEmclsName: getXmlText(item, 'dutyEmclsName'),
          dutyAddr: getXmlText(item, 'dutyAddr'),
          dutyTel3: getXmlText(item, 'dutyTel3'),
          hvec: getXmlNumber(item, 'hvec'),
          hvs01: getXmlNumber(item, 'hvs01'),
          hv27: getXmlNumber(item, 'hv27'),
          HVS59: getXmlNumber(item, 'HVS59'),
          hv29: getXmlNumber(item, 'hv29'),
          HVS03: getXmlNumber(item, 'HVS03'),
          hv30: getXmlNumber(item, 'hv30'),
          HVS04: getXmlNumber(item, 'HVS04'),
          hv28: getXmlNumber(item, 'hv28'),
          HVS02: getXmlNumber(item, 'HVS02'),
          hv15: getXmlNumber(item, 'hv15'),
          HVS48: getXmlNumber(item, 'HVS48'),
          hv16: getXmlNumber(item, 'hv16'),
          HVS49: getXmlNumber(item, 'HVS49'),
          hvidate: getXmlText(item, 'hvidate')
        };

        return {
          ...bedData,
          occupancy: calculateOccupancy(bedData),
          occupancyRate: calculateOccupancyRate(bedData),
          generalStatus: getBedStatus(bedData.hvec || 0, bedData.hvs01 || 0)
        } as HospitalBedData;
      });

      // 센터급 우선, 재실인원 내림차순 정렬
      hospitalData.sort((a, b) => {
        const centerTypes = ['권역응급의료센터', '지역응급의료센터', '전문응급의료센터'];
        const aIsCenter = centerTypes.includes(a.dutyEmclsName);
        const bIsCenter = centerTypes.includes(b.dutyEmclsName);

        if (aIsCenter && !bIsCenter) return -1;
        if (!aIsCenter && bIsCenter) return 1;

        // 같은 급수 내에서는 재실인원 내림차순
        return b.occupancy - a.occupancy;
      });

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
    clearCache
  };
}
