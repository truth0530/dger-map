/**
 * 페이지 평점 API
 * 원본: dger-api/api/ratings.js
 *
 * - Vercel KV 사용 시 영구 저장
 * - KV 미사용 시 메모리 폴백
 *
 * GET: 특정 페이지 또는 전체 평점 조회
 * POST: 평점 투표
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, isAllowedOrigin } from '@/lib/utils/cors';
import { isAuthorizedRequest } from '@/lib/utils/apiAuth';

// ===== 저장소 인터페이스 =====
interface RatingsData {
  votes: Record<string, Record<number, number>>;
  ipVotes: Record<string, Record<string, number>>;
}

// ===== Vercel KV 동적 로딩 =====
let kv: {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, options?: { ex?: number }) => Promise<void>;
  hget: <T>(key: string, field: string) => Promise<T | null>;
  hset: (key: string, fields: Record<string, unknown>) => Promise<void>;
  hgetall: <T>(key: string) => Promise<T | null>;
} | null = null;

let kvAvailable = false;

// KV 초기화 시도
async function initKV() {
  if (kv !== null) return kvAvailable;

  // 환경변수로 KV 활성화 여부 확인
  const kvEnabled = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

  if (!kvEnabled) {
    kvAvailable = false;
    console.log('[ratings] Vercel KV 환경변수 미설정, 메모리 저장소 사용');
    return false;
  }

  try {
    // 동적으로 @vercel/kv 로드 시도 (런타임에만 해석)
    const moduleName = '@vercel/kv';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const kvModule = await (Function('moduleName', 'return import(moduleName)')(moduleName) as Promise<{ kv: typeof kv }>);
    kv = kvModule.kv;
    kvAvailable = true;
    console.log('[ratings] Vercel KV 연결 성공');
  } catch (error) {
    kvAvailable = false;
    console.log('[ratings] Vercel KV 로드 실패, 메모리 저장소 사용:', error);
  }

  return kvAvailable;
}

// ===== 메모리 저장소 (폴백용) =====
const globalForRatings = global as unknown as { ratingsData: RatingsData };

if (!globalForRatings.ratingsData) {
  globalForRatings.ratingsData = { votes: {}, ipVotes: {} };
}

const memoryStore = globalForRatings.ratingsData;

// ===== KV 키 =====
const KV_KEYS = {
  VOTES: 'dgems:ratings:votes',
  IP_VOTES: 'dgems:ratings:ipVotes'
};

// ===== IP 주소 추출 =====
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

// ===== 저장소 함수 =====

// 페이지별 평점 가져오기
async function getPageRatings(page: string): Promise<Record<number, number>> {
  await initKV();

  if (kvAvailable && kv) {
    try {
      const ratings = await kv.hget<Record<number, number>>(KV_KEYS.VOTES, page);
      return ratings || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    } catch (error) {
      console.error('[ratings] KV 읽기 오류:', error);
    }
  }

  return memoryStore.votes[page] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

// 전체 평점 가져오기
async function getAllRatings(): Promise<Record<string, Record<number, number>>> {
  await initKV();

  if (kvAvailable && kv) {
    try {
      const allRatings = await kv.hgetall<Record<string, Record<number, number>>>(KV_KEYS.VOTES);
      return allRatings || {};
    } catch (error) {
      console.error('[ratings] KV 읽기 오류:', error);
    }
  }

  return memoryStore.votes;
}

// 사용자 투표 가져오기
async function getUserVote(clientIP: string, page: string): Promise<number | null> {
  await initKV();

  if (kvAvailable && kv) {
    try {
      const ipKey = `${KV_KEYS.IP_VOTES}:${clientIP}`;
      const vote = await kv.hget<number>(ipKey, page);
      return vote;
    } catch (error) {
      console.error('[ratings] KV 읽기 오류:', error);
    }
  }

  return memoryStore.ipVotes[clientIP]?.[page] || null;
}

// 평점 저장
async function saveRating(
  page: string,
  rating: number,
  clientIP: string,
  previousVote: number | null
): Promise<Record<number, number>> {
  await initKV();

  // 현재 평점 가져오기
  const pageRatings = await getPageRatings(page);

  // 이전 투표가 있으면 취소
  if (previousVote && pageRatings[previousVote]) {
    pageRatings[previousVote]--;
  }

  // 새 투표 등록
  pageRatings[rating] = (pageRatings[rating] || 0) + 1;

  if (kvAvailable && kv) {
    try {
      // KV에 저장
      await kv.hset(KV_KEYS.VOTES, { [page]: pageRatings });

      const ipKey = `${KV_KEYS.IP_VOTES}:${clientIP}`;
      await kv.hset(ipKey, { [page]: rating });

      console.log(`[ratings] KV 저장 성공: ${page} -> ${rating}`);
    } catch (error) {
      console.error('[ratings] KV 저장 오류:', error);
      // KV 실패 시 메모리에도 저장
      memoryStore.votes[page] = pageRatings;
      if (!memoryStore.ipVotes[clientIP]) memoryStore.ipVotes[clientIP] = {};
      memoryStore.ipVotes[clientIP][page] = rating;
    }
  } else {
    // 메모리에 저장
    memoryStore.votes[page] = pageRatings;
    if (!memoryStore.ipVotes[clientIP]) memoryStore.ipVotes[clientIP] = {};
    memoryStore.ipVotes[clientIP][page] = rating;
  }

  return pageRatings;
}

// ===== API 핸들러 =====

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json(
      { error: '허용되지 않은 Origin입니다.' },
      { status: 403, headers: corsHeaders }
    );
  }
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page');
    const clientIP = getClientIP(request);

    if (page) {
      // 특정 페이지의 평점 반환
      const pageRatings = await getPageRatings(page);
      const userVote = await getUserVote(clientIP, page);

      return NextResponse.json({
        ratings: pageRatings,
        userVote: userVote,
        total: Object.values(pageRatings).reduce((a, b) => a + b, 0),
        storage: kvAvailable ? 'kv' : 'memory'
      }, { headers: corsHeaders });
    } else {
      // 전체 평점 반환
      const allVotes = await getAllRatings();
      const allRatings: Record<string, { ratings: Record<number, number>; total: number }> = {};

      for (const pageName in allVotes) {
        const ratings = allVotes[pageName];
        allRatings[pageName] = {
          ratings: ratings,
          total: Object.values(ratings).reduce((a, b) => a + b, 0)
        };
      }

      return NextResponse.json({
        data: allRatings,
        storage: kvAvailable ? 'kv' : 'memory'
      }, { headers: corsHeaders });
    }
  } catch (error) {
    console.error('[ratings] 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json(
      { error: '허용되지 않은 Origin입니다.' },
      { status: 403, headers: corsHeaders }
    );
  }
  if (!isAuthorizedRequest(request.headers.get('x-dger-key'))) {
    return NextResponse.json(
      { error: '인증되지 않은 요청입니다.' },
      { status: 403, headers: corsHeaders }
    );
  }
  try {
    const body = await request.json();
    const { page, rating } = body;

    if (!page || !rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: '유효하지 않은 요청입니다. page와 rating(1-5)이 필요합니다.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const clientIP = getClientIP(request);
    const previousVote = await getUserVote(clientIP, page);

    // 평점 저장
    const pageRatings = await saveRating(page, rating, clientIP, previousVote);

    return NextResponse.json({
      ratings: pageRatings,
      userVote: rating,
      total: Object.values(pageRatings).reduce((a, b) => a + b, 0),
      message: previousVote ? '평점이 변경되었습니다.' : '평점이 등록되었습니다.',
      storage: kvAvailable ? 'kv' : 'memory'
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[ratings] 등록 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(request.headers.get('origin'))
  });
}
