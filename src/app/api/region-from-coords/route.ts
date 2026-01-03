import { NextRequest, NextResponse } from 'next/server';
import { mapSidoName } from '@/lib/utils/regionMapping';
import { getCorsHeaders, isAllowedOrigin } from '@/lib/utils/cors';

const KAKAO_REGION_API_URL = 'https://dapi.kakao.com/v2/local/geo/coord2regioncode.json';

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json(
      { success: false, error: '허용되지 않은 Origin입니다.' },
      { status: 403, headers: corsHeaders }
    );
  }
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json(
      { success: false, error: 'lat/lng 파라미터가 필요합니다.' },
      { status: 400, headers: corsHeaders }
    );
  }

  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'KAKAO_REST_API_KEY 환경변수가 필요합니다.' },
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const url = `${KAKAO_REGION_API_URL}?x=${encodeURIComponent(lng)}&y=${encodeURIComponent(lat)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${apiKey}`
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `지역 조회 실패 (${response.status})` },
        { status: 500, headers: corsHeaders }
      );
    }

    const data = await response.json();
    const documents = data?.documents || [];
    const doc = documents.find((item: { region_type?: string }) => item.region_type === 'H') || documents[0];
    const region = doc?.region_1depth_name ? mapSidoName(doc.region_1depth_name) : null;

    if (!region) {
      return NextResponse.json(
        { success: false, error: '지역 정보를 찾지 못했습니다.' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json({ success: true, region }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(request.headers.get('origin')),
  });
}
