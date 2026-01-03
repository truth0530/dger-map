'use client';

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
