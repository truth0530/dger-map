/**
 * 공공데이터 응급의료정보 API 클라이언트
 * 원본: dger-api/js/ermctClient.js
 *
 * 기능:
 * - 다중 API 키 관리 (최대 9개)
 * - 키별 상태 추적 및 cooldown
 * - 자동 failover
 * - SOAP Fault 처리
 */

const DEFAULT_BASE_URL = 'https://apis.data.go.kr/B552657/ErmctInfoInqireService/';

// ===== 키 상태 관리 =====
interface KeyStatus {
  index: number;
  lastUsed: number;
  lastError: number;
  errorCount: number;
  successCount: number;
  inCooldown: boolean;
}

// 키별 상태 저장
const keyStatusMap: Map<number, KeyStatus> = new Map();

// Cooldown 시간 (5분)
const KEY_COOLDOWN_MS = 5 * 60 * 1000;

// 최대 연속 에러 횟수 (이후 cooldown)
const MAX_CONSECUTIVE_ERRORS = 3;

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

// 키 상태 초기화
function initKeyStatus(index: number): KeyStatus {
  const status: KeyStatus = {
    index,
    lastUsed: 0,
    lastError: 0,
    errorCount: 0,
    successCount: 0,
    inCooldown: false
  };
  keyStatusMap.set(index, status);
  return status;
}

// 키 상태 가져오기
function getKeyStatus(index: number): KeyStatus {
  return keyStatusMap.get(index) || initKeyStatus(index);
}

// 키 사용 가능 여부 확인
function isKeyAvailable(index: number): boolean {
  const status = getKeyStatus(index);

  // Cooldown 중인지 확인
  if (status.inCooldown) {
    const elapsed = Date.now() - status.lastError;
    if (elapsed < KEY_COOLDOWN_MS) {
      return false;
    }
    // Cooldown 종료
    status.inCooldown = false;
    status.errorCount = 0;
  }

  return true;
}

// 키 성공 기록
function recordKeySuccess(index: number): void {
  const status = getKeyStatus(index);
  status.lastUsed = Date.now();
  status.successCount++;
  status.errorCount = 0;
  status.inCooldown = false;
}

// 키 실패 기록
function recordKeyError(index: number): void {
  const status = getKeyStatus(index);
  status.lastError = Date.now();
  status.errorCount++;

  if (status.errorCount >= MAX_CONSECUTIVE_ERRORS) {
    status.inCooldown = true;
    console.warn(`[ERMCT] API 키 #${index + 1} cooldown 진입 (연속 ${status.errorCount}회 실패)`);
  }
}

export function hasErmctApiKey(): boolean {
  return getApiKeys().length > 0;
}

export function getApiKeyStats(): {
  total: number;
  activeIndex: number;
  available: number;
  inCooldown: number;
  stats: Array<{ index: number; success: number; errors: number; available: boolean }>;
} {
  const keys = getApiKeys();
  const stats = keys.map((_, index) => {
    const status = getKeyStatus(index);
    return {
      index,
      success: status.successCount,
      errors: status.errorCount,
      available: isKeyAvailable(index)
    };
  });

  return {
    total: keys.length,
    activeIndex: keys.length ? activeApiKeyIndex : -1,
    available: stats.filter(s => s.available).length,
    inCooldown: stats.filter(s => !s.available).length,
    stats
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
  isSoapFault?: boolean;
}

export function extractResultMeta(xmlText: string): ResultMeta {
  if (!xmlText) {
    return { code: null, message: null };
  }

  // SOAP Fault 체크
  if (xmlText.includes('SOAP-ENV:Fault') || xmlText.includes('soap:Fault')) {
    const faultMatch = xmlText.match(/<faultstring>([^<]*)<\/faultstring>/i);
    return {
      code: '500',
      message: faultMatch ? faultMatch[1].trim() : 'SOAP Fault',
      isSoapFault: true
    };
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

  // 사용 가능한 키만 필터링하고, 활성 키부터 순서대로 시도
  const availableIndices: number[] = [];
  const cooldownIndices: number[] = [];

  for (let offset = 0; offset < keys.length; offset++) {
    const index = (activeApiKeyIndex + offset) % keys.length;
    if (isKeyAvailable(index)) {
      availableIndices.push(index);
    } else {
      cooldownIndices.push(index);
    }
  }

  // 사용 가능한 키 우선, cooldown 키는 마지막에
  return [...availableIndices, ...cooldownIndices];
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
  retryOnSoapFault?: boolean;
}

export interface RequestErmctXmlResult {
  xml: string;
  usedSample: boolean;
  meta: ResultMeta | null;
  keyIndex: number;
  errors?: Array<{ index: number; reason: string }>;
  attemptCount?: number;
}

export async function requestErmctXml(options: RequestErmctXmlOptions): Promise<RequestErmctXmlResult> {
  const { endpoint, params = {}, fallbackXml, description, retryOnSoapFault = true } = options;
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
  let attemptCount = 0;

  for (const keyIndex of attemptOrder) {
    attemptCount++;
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      const text = await response.text();

      if (!response.ok) {
        const reason = `HTTP ${response.status}`;
        attemptErrors.push({ index: keyIndex, reason });
        recordKeyError(keyIndex);
        console.warn(`[ERMCT] ${label} - ${formatKeyLabel(keyIndex)} 응답 오류: ${reason}`);
        continue;
      }

      const meta = extractResultMeta(text);

      // SOAP Fault 처리
      if (meta.isSoapFault) {
        const reason = `SOAP Fault: ${meta.message}`;
        attemptErrors.push({ index: keyIndex, reason });
        recordKeyError(keyIndex);
        console.warn(`[ERMCT] ${label} - ${formatKeyLabel(keyIndex)} SOAP Fault: ${meta.message}`);

        if (retryOnSoapFault) {
          continue;
        }
      }

      if (meta.code && meta.code !== '00') {
        const reason = `resultCode=${meta.code}${meta.message ? ` (${meta.message})` : ''}`;
        attemptErrors.push({ index: keyIndex, reason });

        // 특정 에러 코드는 키 문제가 아님
        const keyRelatedErrors = ['SERVICE_KEY', 'LIMITED', 'EXPIRED'];
        if (keyRelatedErrors.some(e => (meta.message || '').includes(e))) {
          recordKeyError(keyIndex);
        }

        console.warn(`[ERMCT] ${label} - ${formatKeyLabel(keyIndex)} 결과 코드 오류: ${reason}`);
        continue;
      }

      // 성공
      recordKeySuccess(keyIndex);

      if (keyIndex !== activeApiKeyIndex) {
        console.log(`[ERMCT] ${label} - ${formatKeyLabel(keyIndex)} 키로 전환되었습니다.`);
        activeApiKeyIndex = keyIndex;
      }

      return {
        xml: text,
        usedSample: false,
        meta,
        keyIndex,
        attemptCount
      };
    } catch (error) {
      const reason = error instanceof Error
        ? (error.name === 'AbortError' ? 'Timeout (30s)' : error.message)
        : String(error);
      attemptErrors.push({ index: keyIndex, reason });
      recordKeyError(keyIndex);
      console.warn(`[ERMCT] ${label} - ${formatKeyLabel(keyIndex)} 호출 오류: ${reason}`);
    }
  }

  console.error(`[ERMCT] ${label} - 모든 API 키 시도 실패 (${attemptCount}회 시도)`, attemptErrors);

  if (fallbackXml !== undefined) {
    return {
      xml: fallbackXml,
      usedSample: true,
      meta: null,
      keyIndex: -1,
      errors: attemptErrors,
      attemptCount
    };
  }

  const error = new Error(`[ERMCT] ${label} - 모든 API 키 시도 실패`);
  (error as Error & { attempts?: typeof attemptErrors }).attempts = attemptErrors;
  throw error;
}

// ===== 시도명 매핑 =====
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

// ===== 진단/상태 API =====
export function getClientStatus(): {
  baseUrl: string;
  keyStats: ReturnType<typeof getApiKeyStats>;
  activeKey: string;
} {
  const stats = getApiKeyStats();
  return {
    baseUrl: DEFAULT_BASE_URL,
    keyStats: stats,
    activeKey: formatKeyLabel(stats.activeIndex)
  };
}

// Cooldown 강제 해제 (관리용)
export function resetKeyCooldowns(): void {
  keyStatusMap.forEach(status => {
    status.inCooldown = false;
    status.errorCount = 0;
  });
  console.log('[ERMCT] 모든 API 키 cooldown 해제');
}
