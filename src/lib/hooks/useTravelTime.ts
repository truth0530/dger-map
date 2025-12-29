'use client';

/**
 * 소요시간 계산 훅
 * 사용자 위치에서 병원까지의 이동 시간을 계산
 *
 * @description
 * 1. 사용자 위치 권한 요청 및 좌표 획득
 * 2. 카카오모빌리티 API를 통한 이동 시간 계산
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// 위치 정보
export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number; // 미터 단위
  timestamp: number;
}

// 병원별 소요시간
export interface HospitalTravelTime {
  hpid: string;
  duration: number | null; // 초 단위
  distance: number | null; // 미터 단위
}

// 위치 권한 상태
export type LocationPermissionState = 'prompt' | 'granted' | 'denied' | 'unavailable';

// 병원 좌표 인터페이스
export interface HospitalCoordinate {
  code: string;
  lat: number;
  lng: number;
}

export function useTravelTime() {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [permissionState, setPermissionState] = useState<LocationPermissionState>('prompt');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [travelTimes, setTravelTimes] = useState<Map<string, HospitalTravelTime>>(new Map());
  const [travelTimeLoading, setTravelTimeLoading] = useState(false);
  const [travelTimeError, setTravelTimeError] = useState<string | null>(null);

  const lastFetchRef = useRef<number>(0);

  // Geolocation 권한 상태 확인
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setPermissionState('unavailable');
      return;
    }

    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        setPermissionState(result.state as LocationPermissionState);
        result.onchange = () => {
          setPermissionState(result.state as LocationPermissionState);
        };
      }).catch(() => {
        // 권한 API 미지원 시 prompt 상태로 유지
        setPermissionState('prompt');
      });
    }
  }, []);

  // 사용자 위치 획득
  const requestLocation = useCallback((): Promise<UserLocation | null> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        setLocationError('이 브라우저는 위치 서비스를 지원하지 않습니다.');
        setPermissionState('unavailable');
        resolve(null);
        return;
      }

      setLocationLoading(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: UserLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };
          setUserLocation(location);
          setPermissionState('granted');
          setLocationLoading(false);
          resolve(location);
        },
        (error) => {
          setLocationLoading(false);
          switch (error.code) {
            case error.PERMISSION_DENIED:
              setLocationError('위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.');
              setPermissionState('denied');
              break;
            case error.POSITION_UNAVAILABLE:
              setLocationError('위치 정보를 사용할 수 없습니다.');
              break;
            case error.TIMEOUT:
              setLocationError('위치 요청 시간이 초과되었습니다.');
              break;
            default:
              setLocationError('위치를 가져오는 중 오류가 발생했습니다.');
          }
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000 // 1분간 캐시
        }
      );
    });
  }, []);

  // 소요시간 계산 (병원 좌표를 직접 전달받음)
  const fetchTravelTimes = useCallback(async (
    hospitals: HospitalCoordinate[],
    locationOverride?: UserLocation
  ): Promise<Map<string, HospitalTravelTime>> => {
    // 중복 요청 방지 (5초 내)
    const now = Date.now();
    if (now - lastFetchRef.current < 5000) {
      return travelTimes;
    }

    // locationOverride가 있으면 사용, 없으면 userLocation 사용
    let location = locationOverride || userLocation;

    if (!location) {
      location = await requestLocation();
      if (!location) {
        return new Map();
      }
    }

    if (!hospitals || hospitals.length === 0) {
      console.warn('[useTravelTime] 병원 목록이 비어있습니다.');
      return new Map();
    }

    setTravelTimeLoading(true);
    setTravelTimeError(null);
    lastFetchRef.current = now;

    try {
      console.log('[useTravelTime] API 호출:', { origin: location, destinations: hospitals.length });

      const response = await fetch('/api/travel-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          origin: {
            lat: location.lat,
            lng: location.lng
          },
          destinations: hospitals.map(h => ({
            code: h.code,
            lat: h.lat,
            lng: h.lng
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[useTravelTime] API 응답:', data);

      if (!data.success) {
        throw new Error(data.error || '소요시간 조회 실패');
      }

      const newTravelTimes = new Map<string, HospitalTravelTime>();
      data.results.forEach((result: { code: string; duration: number | null; distance: number | null }) => {
        newTravelTimes.set(result.code, {
          hpid: result.code,
          duration: result.duration,
          distance: result.distance
        });
      });

      console.log('[useTravelTime] 결과:', newTravelTimes.size, '개 병원');
      setTravelTimes(newTravelTimes);
      return newTravelTimes;
    } catch (err) {
      const message = err instanceof Error ? err.message : '소요시간 조회 실패';
      console.error('[useTravelTime] 오류:', message);
      setTravelTimeError(message);
      return new Map();
    } finally {
      setTravelTimeLoading(false);
    }
  }, [userLocation, requestLocation, travelTimes]);

  // 특정 병원의 소요시간 조회
  const getTravelTime = useCallback((hpid: string): HospitalTravelTime | undefined => {
    return travelTimes.get(hpid);
  }, [travelTimes]);

  // 소요시간 포맷팅 (초 -> "X분" 또는 "X시간 Y분")
  const formatDuration = useCallback((seconds: number | null): string => {
    if (seconds === null) return '-';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes}분`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours}시간`;
    }
    return `${hours}시간 ${remainingMinutes}분`;
  }, []);

  // 거리 포맷팅 (미터 -> "X.Xkm" 또는 "Xm")
  const formatDistance = useCallback((meters: number | null): string => {
    if (meters === null) return '-';
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }, []);

  // 위치 초기화
  const clearLocation = useCallback(() => {
    setUserLocation(null);
    setTravelTimes(new Map());
    setLocationError(null);
    setTravelTimeError(null);
  }, []);

  return {
    // 위치 관련
    userLocation,
    permissionState,
    locationLoading,
    locationError,
    requestLocation,
    clearLocation,

    // 소요시간 관련
    travelTimes,
    travelTimeLoading,
    travelTimeError,
    fetchTravelTimes,
    getTravelTime,

    // 유틸리티
    formatDuration,
    formatDistance,
  };
}
