/**
 * 페이지 평점 API
 * 원본: dger-api/api/ratings.js
 *
 * GET: 특정 페이지 또는 전체 평점 조회
 * POST: 평점 투표
 */

import { NextRequest, NextResponse } from 'next/server';

// 메모리 저장소 (서버 재시작 시 초기화됨)
// 프로덕션에서는 Redis나 DB 사용 권장
interface RatingsData {
  votes: Record<string, Record<number, number>>;
  ipVotes: Record<string, Record<string, number>>;
}

// 전역 변수로 메모리에 저장 (개발/데모용)
const globalForRatings = global as unknown as { ratingsData: RatingsData };

if (!globalForRatings.ratingsData) {
  globalForRatings.ratingsData = { votes: {}, ipVotes: {} };
}

const ratingsData = globalForRatings.ratingsData;

// IP 주소 추출
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page');
    const clientIP = getClientIP(request);

    if (page) {
      // 특정 페이지의 평점 반환
      const pageRatings = ratingsData.votes[page] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const userVote = ratingsData.ipVotes[clientIP]?.[page] || null;

      return NextResponse.json({
        ratings: pageRatings,
        userVote: userVote,
        total: Object.values(pageRatings).reduce((a, b) => a + b, 0)
      });
    } else {
      // 전체 평점 반환
      const allRatings: Record<string, { ratings: Record<number, number>; total: number }> = {};

      for (const pageName in ratingsData.votes) {
        const ratings = ratingsData.votes[pageName];
        allRatings[pageName] = {
          ratings: ratings,
          total: Object.values(ratings).reduce((a, b) => a + b, 0)
        };
      }

      return NextResponse.json(allRatings);
    }
  } catch (error) {
    console.error('평점 조회 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { page, rating } = body;

    if (!page || !rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: '유효하지 않은 요청입니다. page와 rating(1-5)이 필요합니다.' },
        { status: 400 }
      );
    }

    const clientIP = getClientIP(request);

    // 페이지별 평점 초기화
    if (!ratingsData.votes[page]) {
      ratingsData.votes[page] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    }
    if (!ratingsData.ipVotes[clientIP]) {
      ratingsData.ipVotes[clientIP] = {};
    }

    // 이전 투표가 있으면 취소
    const previousVote = ratingsData.ipVotes[clientIP][page];
    if (previousVote) {
      ratingsData.votes[page][previousVote]--;
    }

    // 새 투표 등록
    ratingsData.votes[page][rating]++;
    ratingsData.ipVotes[clientIP][page] = rating;

    // 업데이트된 평점 반환
    const pageRatings = ratingsData.votes[page];

    return NextResponse.json({
      ratings: pageRatings,
      userVote: rating,
      total: Object.values(pageRatings).reduce((a, b) => a + b, 0),
      message: '평점이 등록되었습니다.'
    });
  } catch (error) {
    console.error('평점 등록 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
