/**
 * 공공데이터 응급의료정보 API 클라이언트
 * 원본: dger-api/js/ermctClient.js
 */

const DEFAULT_BASE_URL = 'https://apis.data.go.kr/B552657/ErmctInfoInqireService/';

// 환경변수에서 API 키 로드
function getApiKeys(): string[] {
  const rawKeys = [
    process.env.ERMCT_API_KEY,
    process.env.ERMCT_API_KEY_ALT,
    process.env.ERMCT_API_KEY2,
    process.env.ERMCT_API_KEY_2,
    process.env.ERMCT_API_KEY3,
    process.env.ERMCT_API_KEY_3,
    process.env.ERMCT_API_KEY_SECONDARY,
    process.env.ERMCT_API_KEY_THIRD,
    process.env.ERMCT_API_KEY_BACKUP
  ]
    .map((key) => (typeof key === 'string' ? key.trim() : ''))
    .filter(Boolean);

  return Array.from(new Set(rawKeys));
}

let activeApiKeyIndex = 0;

export function hasErmctApiKey(): boolean {
  return getApiKeys().length > 0;
}

export function getApiKeyStats(): { total: number; activeIndex: number } {
  const keys = getApiKeys();
  return {
    total: keys.length,
    activeIndex: keys.length ? activeApiKeyIndex : -1
  };
}

function safeDecodeServiceKey(key: string): string {
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

interface ResultMeta {
  code: string | null;
  message: string | null;
}

export function extractResultMeta(xmlText: string): ResultMeta {
  if (!xmlText) {
    return { code: null, message: null };
  }

  const codeMatch = xmlText.match(/<resultCode>([^<]*)<\/resultCode>/i);
  const messageMatch = xmlText.match(/<resultMsg>([^<]*)<\/resultMsg>/i);

  return {
    code: codeMatch ? codeMatch[1].trim() : null,
    message: messageMatch ? messageMatch[1].trim() : null
  };
}

function buildAttemptOrder(): number[] {
  const keys = getApiKeys();
  if (!keys.length) return [];
  return Array.from({ length: keys.length }, (_, offset) => (activeApiKeyIndex + offset) % keys.length);
}

function formatKeyLabel(index: number): string {
  const keys = getApiKeys();
  const key = keys[index] || '';
  const suffix = key.length >= 4 ? key.slice(-4) : '----';
  return `#${index + 1}(...${suffix})`;
}

export interface RequestErmctXmlOptions {
  endpoint: string;
  params?: Record<string, string | number | undefined>;
  fallbackXml?: string;
  description?: string;
}

export interface RequestErmctXmlResult {
  xml: string;
  usedSample: boolean;
  meta: ResultMeta | null;
  keyIndex: number;
  errors?: Array<{ index: number; reason: string }>;
}

export async function requestErmctXml(options: RequestErmctXmlOptions): Promise<RequestErmctXmlResult> {
  const { endpoint, params = {}, fallbackXml, description } = options;
  const label = description || endpoint || 'unknown-endpoint';
  const API_KEYS = getApiKeys();

  if (!hasErmctApiKey()) {
    if (fallbackXml !== undefined) {
      console.warn(`[ERMCT] ${label} - API 키가 설정되지 않아 샘플 데이터를 반환합니다.`);
      return { xml: fallbackXml, usedSample: true, meta: null, keyIndex: -1 };
    }
    throw new Error('ERMCT API 키가 설정되지 않았습니다.');
  }

  const attemptOrder = buildAttemptOrder();
  const attemptErrors: Array<{ index: number; reason: string }> = [];

  for (const keyIndex of attemptOrder) {
    const rawKey = API_KEYS[keyIndex];
    const searchParams = new URLSearchParams();

    // params를 URLSearchParams로 변환
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    searchParams.set('serviceKey', safeDecodeServiceKey(rawKey));
    const url = `${DEFAULT_BASE_URL}${endpoint}?${searchParams.toString()}`;

    try {
      const response = await fetch(url);
      const text = await response.text();

      if (!response.ok) {
        const reason = `HTTP ${response.status}`;
        attemptErrors.push({ index: keyIndex, reason });
        console.warn(`[ERMCT] ${label} - ${formatKeyLabel(keyIndex)} 응답 오류: ${reason}`);
        continue;
      }

      const meta = extractResultMeta(text);

      if (meta.code && meta.code !== '00') {
        const reason = `resultCode=${meta.code}${meta.message ? ` (${meta.message})` : ''}`;
        attemptErrors.push({ index: keyIndex, reason });
        console.warn(`[ERMCT] ${label} - ${formatKeyLabel(keyIndex)} 결과 코드 오류: ${reason}`);
        continue;
      }

      if (keyIndex !== activeApiKeyIndex) {
        console.warn(`[ERMCT] ${label} - ${formatKeyLabel(keyIndex)} 키로 전환되었습니다.`);
        activeApiKeyIndex = keyIndex;
      }

      return { xml: text, usedSample: false, meta, keyIndex };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      attemptErrors.push({ index: keyIndex, reason });
      console.warn(`[ERMCT] ${label} - ${formatKeyLabel(keyIndex)} 호출 오류: ${reason}`);
    }
  }

  console.error(`[ERMCT] ${label} - 모든 API 키 시도 실패`, attemptErrors);

  if (fallbackXml !== undefined) {
    return { xml: fallbackXml, usedSample: true, meta: null, keyIndex: -1, errors: attemptErrors };
  }

  const error = new Error(`[ERMCT] ${label} - 모든 API 키 시도 실패`);
  (error as Error & { attempts?: typeof attemptErrors }).attempts = attemptErrors;
  throw error;
}

// 시도명 매핑
export const SIDO_MAPPING: Record<string, string> = {
  "서울": "서울특별시",
  "서울특별시": "서울특별시",
  "부산": "부산광역시",
  "부산광역시": "부산광역시",
  "대구": "대구광역시",
  "대구광역시": "대구광역시",
  "인천": "인천광역시",
  "인천광역시": "인천광역시",
  "광주": "광주광역시",
  "광주광역시": "광주광역시",
  "대전": "대전광역시",
  "대전광역시": "대전광역시",
  "울산": "울산광역시",
  "울산광역시": "울산광역시",
  "세종": "세종특별자치시",
  "세종특별자치시": "세종특별자치시",
  "경기": "경기도",
  "경기도": "경기도",
  "강원": "강원특별자치도",
  "강원도": "강원특별자치도",
  "강원특별자치도": "강원특별자치도",
  "충북": "충청북도",
  "충청북도": "충청북도",
  "충남": "충청남도",
  "충청남도": "충청남도",
  "전북": "전북특별자치도",
  "전라북도": "전북특별자치도",
  "전북특별자치도": "전북특별자치도",
  "전남": "전라남도",
  "전라남도": "전라남도",
  "경북": "경상북도",
  "경상북도": "경상북도",
  "경남": "경상남도",
  "경상남도": "경상남도",
  "제주": "제주특별자치도",
  "제주특별자치도": "제주특별자치도"
};

export function mapSidoName(region: string): string {
  return SIDO_MAPPING[region] || region;
}
