'use client';

/**
 * 병원 즐겨찾기 관리 훅
 * localStorage를 사용하여 즐겨찾기 병원 저장/관리
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

const STORAGE_KEY = 'dger-favorite-hospitals';
const MAX_FAVORITES = 20;

export interface FavoriteHospital {
  hpid: string;
  dutyName: string;
  region: string;      // 소속 지역 (데이터 조회 최적화용)
  addedAt: number;
}

/**
 * localStorage에서 즐겨찾기 로드
 */
function loadFavorites(): FavoriteHospital[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed;
  } catch (error) {
    console.error('[favorites] 즐겨찾기 로드 실패:', error);
    return [];
  }
}

/**
 * localStorage에 즐겨찾기 저장
 */
function saveFavorites(favorites: FavoriteHospital[]): boolean {
  if (typeof window === 'undefined') return false;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    return true;
  } catch (error) {
    console.error('[favorites] 즐겨찾기 저장 실패:', error);
    return false;
  }
}

/**
 * 즐겨찾기 병원 관리 훅
 */
export function useFavoriteHospitals() {
  const [favorites, setFavorites] = useState<FavoriteHospital[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // 초기 로드
  useEffect(() => {
    setFavorites(loadFavorites());
    setIsLoaded(true);
  }, []);

  /**
   * 즐겨찾기 여부 확인
   */
  const isFavorite = useCallback((hpid: string): boolean => {
    return favorites.some(f => f.hpid === hpid);
  }, [favorites]);

  /**
   * 즐겨찾기 추가
   */
  const addFavorite = useCallback((hospital: {
    hpid: string;
    dutyName: string;
    region: string;
  }): boolean => {
    if (favorites.length >= MAX_FAVORITES) {
      console.warn('[favorites] 최대 즐겨찾기 개수 초과');
      return false;
    }

    if (isFavorite(hospital.hpid)) {
      return false;
    }

    const newFavorite: FavoriteHospital = {
      ...hospital,
      addedAt: Date.now()
    };

    const newFavorites = [...favorites, newFavorite];
    if (saveFavorites(newFavorites)) {
      setFavorites(newFavorites);
      return true;
    }
    return false;
  }, [favorites, isFavorite]);

  /**
   * 즐겨찾기 제거
   */
  const removeFavorite = useCallback((hpid: string): boolean => {
    const newFavorites = favorites.filter(f => f.hpid !== hpid);
    if (saveFavorites(newFavorites)) {
      setFavorites(newFavorites);
      return true;
    }
    return false;
  }, [favorites]);

  /**
   * 즐겨찾기 토글
   */
  const toggleFavorite = useCallback((hospital: {
    hpid: string;
    dutyName: string;
    region: string;
  }): boolean => {
    if (isFavorite(hospital.hpid)) {
      return removeFavorite(hospital.hpid);
    } else {
      return addFavorite(hospital);
    }
  }, [isFavorite, addFavorite, removeFavorite]);

  /**
   * 즐겨찾기 전체 삭제
   */
  const clearFavorites = useCallback((): boolean => {
    if (saveFavorites([])) {
      setFavorites([]);
      return true;
    }
    return false;
  }, []);

  /**
   * 즐겨찾기 병원 ID 목록 (메모이제이션)
   */
  const favoriteIds = useMemo(() => {
    return favorites.map(f => f.hpid);
  }, [favorites]);

  /**
   * 즐겨찾기 병원들의 지역 목록 (중복 제거, 메모이제이션)
   */
  const favoriteRegions = useMemo(() => {
    return [...new Set(favorites.map(f => f.region))];
  }, [favorites]);

  /**
   * URL 공유용 문자열 생성
   * 형식: hpid1:region1,hpid2:region2,...
   * 지역 정보를 포함하여 공유 URL에서 효율적인 데이터 조회 가능
   */
  const toShareString = useCallback((): string => {
    return favorites.map(f => `${f.hpid}:${f.region}`).join(',');
  }, [favorites]);

  /**
   * URL 파라미터에서 즐겨찾기 정보 파싱
   * @returns { hpid, region }[] - 병원 ID와 지역 정보 배열
   */
  const parseShareString = useCallback((shareString: string): { hpid: string; region: string }[] => {
    if (!shareString) return [];
    return shareString
      .split(',')
      .map(item => {
        const [hpid, region] = item.split(':');
        return { hpid: hpid?.trim() || '', region: region?.trim() || '' };
      })
      .filter(item => item.hpid && item.region);
  }, []);

  /**
   * URL 공유용 문자열에서 지역 목록만 추출 (중복 제거)
   */
  const getRegionsFromShareString = useCallback((shareString: string): string[] => {
    const parsed = parseShareString(shareString);
    return [...new Set(parsed.map(p => p.region))];
  }, [parseShareString]);

  /**
   * URL 공유용 문자열에서 병원 ID 목록만 추출
   */
  const getIdsFromShareString = useCallback((shareString: string): string[] => {
    const parsed = parseShareString(shareString);
    return parsed.map(p => p.hpid);
  }, [parseShareString]);

  return {
    favorites,
    favoriteIds,
    favoriteRegions,
    isLoaded,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    clearFavorites,
    toShareString,
    parseShareString,
    getRegionsFromShareString,
    getIdsFromShareString,
    count: favorites.length,
    maxCount: MAX_FAVORITES
  };
}
