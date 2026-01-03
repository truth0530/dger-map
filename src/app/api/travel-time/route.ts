/**
 * 다중 목적지 소요시간 API
 * 카카오모빌리티 다중 목적지 길찾기 API를 사용하여
 * 사용자 위치에서 여러 병원까지의 이동 시간을 계산
 *
 * @see https://developers.kakaomobility.com/docs/navi-api/destinations/
 */

import { NextRequest, NextResponse } from 'next/server';

// 카카오모빌리티 API 응답 타입
interface KakaoRouteResult {
  result_code: number;
  result_msg: string;
  key: string;
  summary?: {
    distance: number; // 미터 단위
    duration: number; // 초 단위
  };
}

interface KakaoApiResponse {
  routes: KakaoRouteResult[];
}

// 요청 타입
interface TravelTimeRequest {
  origin: {
    lat: number;
    lng: number;
  };
  destinations: {
    code: string;
    lat: number;
    lng: number;
  }[];
}

// 응답 타입
interface TravelTimeResult {
  code: string;
  duration: number | null; // 초 단위, 도달 불가 시 null
  distance: number | null; // 미터 단위, 도달 불가 시 null
}

const KAKAO_API_URL = 'https://apis-navi.kakaomobility.com/v1/destinations/directions';
const MAX_DESTINATIONS = 30; // 카카오 API 최대 목적지 수
const RADIUS = 10000; // 반경 10km (필수 파라미터)

export async function POST(request: NextRequest) {
  try {
    const body: TravelTimeRequest = await request.json();
    const { origin, destinations } = body;

    // 입력 검증
    if (!origin || typeof origin.lat !== 'number' || typeof origin.lng !== 'number') {
      return NextResponse.json(
        { error: '유효한 출발지 좌표가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!destinations || !Array.isArray(destinations) || destinations.length === 0) {
      return NextResponse.json(
        { error: '목적지 목록이 필요합니다.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.KAKAO_REST_API_KEY;
    if (!apiKey) {
      console.error('[travel-time] KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.');
      return NextResponse.json(
        { error: '서버 설정 오류' },
        { status: 500 }
      );
    }

    // 유효한 좌표가 있는 목적지만 필터링
    const validDestinations = destinations.filter(dest =>
      dest.lat && dest.lng &&
      typeof dest.lat === 'number' &&
      typeof dest.lng === 'number' &&
      !isNaN(dest.lat) && !isNaN(dest.lng)
    );

    if (validDestinations.length === 0) {
      return NextResponse.json(
        { error: '유효한 목적지가 없습니다.' },
        { status: 400 }
      );
    }

    // 최대 30개씩 배치 처리
    const results: TravelTimeResult[] = [];
    const batches = chunkArray(validDestinations, MAX_DESTINATIONS);

    for (const batch of batches) {
      const kakaoDestinations = batch.map(dest => ({
        x: dest.lng.toString(), // 경도
        y: dest.lat.toString(), // 위도
        key: dest.code
      }));

      const requestBody = {
        origin: {
          x: origin.lng.toString(),
          y: origin.lat.toString()
        },
        destinations: kakaoDestinations,
        radius: RADIUS
      };

      try {
        const response = await fetch(KAKAO_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `KakaoAK ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[travel-time] 카카오 API 오류: ${response.status}`, errorText);

          // API 오류 시 해당 배치의 모든 목적지는 null로 처리
          batch.forEach(dest => {
            results.push({
              code: dest.code,
              duration: null,
              distance: null
            });
          });
          continue;
        }

        const data: KakaoApiResponse = await response.json();
        console.log('[travel-time] 카카오 API 응답:', JSON.stringify(data, null, 2).slice(0, 2000));
        console.log('[travel-time] 요청 origin:', origin, '목적지 수:', batch.length);

        // 결과 매핑 - routes 배열의 각 요소가 개별 목적지 결과
        if (data.routes && data.routes.length > 0) {
          data.routes.forEach(route => {
            if (route.result_code === 0 && route.summary && route.summary.duration > 0) {
              results.push({
                code: route.key,
                duration: route.summary.duration,
                distance: route.summary.distance
              });
            } else {
              // 경로를 찾을 수 없는 경우
              results.push({
                code: route.key,
                duration: null,
                distance: null
              });
            }
          });
        } else {
          // 응답에 결과가 없는 경우
          batch.forEach(dest => {
            results.push({
              code: dest.code,
              duration: null,
              distance: null
            });
          });
        }
      } catch (batchError) {
        console.error('[travel-time] 배치 처리 오류:', batchError);
        batch.forEach(dest => {
          results.push({
            code: dest.code,
            duration: null,
            distance: null
          });
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      origin,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[travel-time] 요청 처리 오류:', error);
    return NextResponse.json(
      { error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 배열을 지정된 크기로 분할
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
