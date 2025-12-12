/**
 * 병원 목록 조회 API
 * 원본: dger-api/api/get-hospital-list.js
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestErmctXml, mapSidoName } from '@/lib/ermctClient';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const region = searchParams.get('region') || '';

  try {
    const mappedRegion = mapSidoName(region);

    const params: Record<string, string> = {
      numOfRows: '100',
      pageNo: '1',
      _type: 'xml'
    };

    if (mappedRegion) {
      params.Q0 = mappedRegion;
    }

    const result = await requestErmctXml({
      endpoint: 'getEgytListInfoInqire',
      params,
      description: '병원 목록 조회(API)'
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
        error: '병원 목록을 가져오는 중 오류가 발생했습니다.',
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
