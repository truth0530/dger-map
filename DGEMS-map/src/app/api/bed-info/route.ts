/**
 * 병상 정보 조회 API
 * 원본: dger-api/api/get-bed-info.js
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestErmctXml, mapSidoName } from '@/lib/ermctClient';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const region = searchParams.get('region') || '';
  const hospId = searchParams.get('hospId') || '';

  try {
    const mappedRegion = mapSidoName(region);

    const params: Record<string, string> = {
      STAGE1: mappedRegion,
      numOfRows: '100',
      pageNo: '1',
      _type: 'xml'
    };

    if (hospId) {
      params.STAGE2 = hospId;
    }

    const result = await requestErmctXml({
      endpoint: 'getEmrrmRltmUsefulSckbdInfoInqire',
      params,
      description: '병상 정보 조회(API)'
    });

    return new NextResponse(result.xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('API 호출 오류:', error);
    return NextResponse.json(
      {
        error: '병상 데이터를 가져오는 중 오류가 발생했습니다.',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
