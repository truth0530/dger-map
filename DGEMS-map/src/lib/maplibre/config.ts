/**
 * MapLibre GL JS + Maptiler 설정
 */

export const MAPTILER_CONFIG = {
  // Maptiler API 키 (환경변수에서 로드)
  apiKey: process.env.NEXT_PUBLIC_MAPTILER_API_KEY || '',

  // 지도 스타일 URL
  styles: {
    dark: 'https://api.maptiler.com/maps/dataviz-dark/style.json',
    light: 'https://api.maptiler.com/maps/dataviz/style.json',
    streets: 'https://api.maptiler.com/maps/streets-v2/style.json',
    basic: 'https://api.maptiler.com/maps/basic-v2/style.json',
  },

  // 한국 전체 뷰
  korea: {
    center: [127.7669, 35.9078] as [number, number], // [lng, lat]
    zoom: 6.5,
    bounds: [
      [124.0, 33.0],  // SW corner [lng, lat]
      [132.0, 39.0],  // NE corner [lng, lat]
    ] as [[number, number], [number, number]],
  },

  // 대구 중심 뷰
  daegu: {
    center: [128.6014, 35.8714] as [number, number],
    zoom: 11,
  },

  // 시도별 중심 좌표
  regionCenters: {
    '서울특별시': { center: [126.9780, 37.5665] as [number, number], zoom: 11 },
    '부산광역시': { center: [129.0756, 35.1796] as [number, number], zoom: 11 },
    '대구광역시': { center: [128.6014, 35.8714] as [number, number], zoom: 11 },
    '인천광역시': { center: [126.7052, 37.4563] as [number, number], zoom: 10 },
    '광주광역시': { center: [126.8526, 35.1595] as [number, number], zoom: 11 },
    '대전광역시': { center: [127.3845, 36.3504] as [number, number], zoom: 11 },
    '울산광역시': { center: [129.3114, 35.5384] as [number, number], zoom: 11 },
    '세종특별자치시': { center: [127.2494, 36.4800] as [number, number], zoom: 11 },
    '경기도': { center: [127.0000, 37.2750] as [number, number], zoom: 9 },
    '강원특별자치도': { center: [128.2093, 37.8228] as [number, number], zoom: 8 },
    '충청북도': { center: [127.9295, 36.6358] as [number, number], zoom: 9 },
    '충청남도': { center: [126.8000, 36.5184] as [number, number], zoom: 9 },
    '전북특별자치도': { center: [127.1530, 35.7175] as [number, number], zoom: 9 },
    '전라남도': { center: [126.9910, 34.8679] as [number, number], zoom: 9 },
    '경상북도': { center: [128.8889, 36.4919] as [number, number], zoom: 8 },
    '경상남도': { center: [128.6921, 35.4606] as [number, number], zoom: 9 },
    '제주특별자치도': { center: [126.5312, 33.4996] as [number, number], zoom: 10 },
  } as Record<string, { center: [number, number]; zoom: number }>,
};

// 마커 색상
export const MARKER_COLORS = {
  available24h: '#22c55e',   // 녹색 - 24시간 가능
  availableDay: '#3b82f6',   // 파랑 - 주간 가능
  availableNight: '#a855f7', // 보라 - 야간 가능
  unavailable: '#ef4444',    // 빨강 - 불가
  unknown: '#6b7280',        // 회색 - 정보없음
  default: '#60a5fa',        // 기본 파랑
};

// 기관분류별 마커 설정
export const CLASSIFICATION_MARKERS = {
  '권역응급의료센터': {
    shape: 'diamond',
    size: 12,
    strokeWidth: 2,
    priority: 1,
  },
  '지역응급의료센터': {
    shape: 'square',
    size: 10,
    strokeWidth: 2,
    priority: 2,
  },
  '지역응급의료기관': {
    shape: 'circle',
    size: 8,
    strokeWidth: 1,
    priority: 3,
  },
  '응급실운영신고기관': {
    shape: 'circle',
    size: 6,
    strokeWidth: 1,
    priority: 4,
  },
} as Record<string, { shape: string; size: number; strokeWidth: number; priority: number }>;

// 스타일 URL 생성 헬퍼
export function getStyleUrl(style: keyof typeof MAPTILER_CONFIG.styles = 'dark'): string {
  const baseUrl = MAPTILER_CONFIG.styles[style];
  const apiKey = MAPTILER_CONFIG.apiKey;

  if (!apiKey) {
    console.warn('[MapLibre] Maptiler API 키가 설정되지 않았습니다.');
    // 폴백: OpenStreetMap 스타일 (무료)
    return 'https://demotiles.maplibre.org/style.json';
  }

  return `${baseUrl}?key=${apiKey}`;
}

// 지역 중심 좌표 가져오기
export function getRegionView(region: string): { center: [number, number]; zoom: number } {
  if (region === 'all' || !region) {
    return { center: MAPTILER_CONFIG.korea.center, zoom: MAPTILER_CONFIG.korea.zoom };
  }

  return MAPTILER_CONFIG.regionCenters[region] || {
    center: MAPTILER_CONFIG.korea.center,
    zoom: MAPTILER_CONFIG.korea.zoom
  };
}
