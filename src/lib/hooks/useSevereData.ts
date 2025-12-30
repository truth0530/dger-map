'use client';

/**
 * 중증질환 데이터 조회 훅
 * - API가 JSON을 반환하므로 클라이언트에서 XML 파싱 불필요
 */

import { useState, useCallback, useRef } from 'react';
import { SEVERE_TYPES } from '@/lib/constants/dger';

export interface HospitalSevereData {
  hpid: string;
  dutyName: string;
  dutyEmclsName: string;
  hvec: number;
  hvs01: number;
  hv27: number;
  hv28: number;
  hv29: number;
  hv30: number;
  hv15: number;
  hv16: number;
  severeStatus: Record<string, string>;
}

export interface DiseaseStats {
  qn: number;
  key: string;
  label: string;
  available: number;
  unavailable: number;
  noInfo: number;
  total: number;
  availableHospitals: HospitalSevereData[];
  unavailableHospitals: HospitalSevereData[];
  noInfoHospitals: HospitalSevereData[];
}

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

export function useSevereData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HospitalSevereData[]>([]);
  const [diseaseStats, setDiseaseStats] = useState<DiseaseStats[]>([]);

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  const fetchSevereData = useCallback(async (region: string) => {
    const cacheKey = `severe_${region}`;
    const now = Date.now();

    // 캐시 확인
    const cached = cacheRef.current.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL) {
      setData(cached.data);
      calculateStats(cached.data);
      return cached.data;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        STAGE1: region,
        numOfRows: '1000',
        pageNo: '1'
      });

      const response = await fetch(`/api/severe-diseases?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
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

      setData(hospitalData);
      calculateStats(hospitalData);

      return hospitalData;
    } catch (err) {
      const message = err instanceof Error ? err.message : '데이터 조회 실패';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateStats = useCallback((hospitals: HospitalSevereData[]) => {
    const stats: DiseaseStats[] = SEVERE_TYPES.map((type, index) => {
      const availableHospitals: HospitalSevereData[] = [];
      const unavailableHospitals: HospitalSevereData[] = [];
      const noInfoHospitals: HospitalSevereData[] = [];

      hospitals.forEach(hospital => {
        const status = (hospital.severeStatus[type.key] || '').trim().toUpperCase();

        if (status === 'Y') {
          availableHospitals.push(hospital);
        } else if (status === 'N' || status === '불가능') {
          unavailableHospitals.push(hospital);
        } else {
          noInfoHospitals.push(hospital);
        }
      });

      // 센터급 우선 정렬
      const sortHospitals = (a: HospitalSevereData, b: HospitalSevereData) => {
        const centerTypes = ['권역응급의료센터', '지역응급의료센터', '전문응급의료센터'];
        const aIsCenter = centerTypes.includes(a.dutyEmclsName);
        const bIsCenter = centerTypes.includes(b.dutyEmclsName);

        if (aIsCenter && !bIsCenter) return -1;
        if (!aIsCenter && bIsCenter) return 1;
        return 0;
      };

      availableHospitals.sort(sortHospitals);
      unavailableHospitals.sort(sortHospitals);
      noInfoHospitals.sort(sortHospitals);

      return {
        qn: index + 1,
        key: type.key,
        label: type.label,
        available: availableHospitals.length,
        unavailable: unavailableHospitals.length,
        noInfo: noInfoHospitals.length,
        total: hospitals.length,
        availableHospitals,
        unavailableHospitals,
        noInfoHospitals
      };
    });

    setDiseaseStats(stats);
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    loading,
    error,
    data,
    diseaseStats,
    fetchSevereData,
    clearCache
  };
}
