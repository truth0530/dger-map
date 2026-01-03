'use client';

const REGION_STORAGE_KEY = 'dger_region_value';
const REGION_LOCK_KEY = 'dger_region_locked';

export function getStoredRegion(): string | null {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(REGION_STORAGE_KEY);
  return value && value.length > 0 ? value : null;
}

export function setStoredRegion(region: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REGION_STORAGE_KEY, region);
}

export function clearStoredRegion(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REGION_STORAGE_KEY);
}

export function isRegionLocked(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(REGION_LOCK_KEY) === 'true';
}

export function setRegionLocked(locked: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REGION_LOCK_KEY, locked ? 'true' : 'false');
  if (!locked) {
    clearStoredRegion();
  }
}

export async function detectRegionFromLocation(): Promise<string | null> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const response = await fetch(`/api/region-from-coords?lat=${lat}&lng=${lng}`);
          if (!response.ok) {
            resolve(null);
            return;
          }
          const data = await response.json();
          resolve(data?.region || null);
        } catch {
          resolve(null);
        }
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60000
      }
    );
  });
}
