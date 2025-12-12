/**
 * 응급 메시지 조회 API
 * 원본: dger-api/api/get-emergency-messages.js
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestErmctXml } from '@/lib/ermctClient';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const hpid = searchParams.get('hpid') || '';

  if (!hpid) {
    return NextResponse.json(
      { error: 'hpid 파라미터가 필요합니다.' },
      { status: 400 }
    );
  }

  try {
    const params: Record<string, string> = {
      HPID: hpid,
      numOfRows: '1000',
      _type: 'xml'
    };

    const result = await requestErmctXml({
      endpoint: 'getEmrrmSrsillDissMsgInqire',
      params,
      description: '응급 메시지 조회(API)'
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
        error: '메시지를 가져오는 중 오류가 발생했습니다.',
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
