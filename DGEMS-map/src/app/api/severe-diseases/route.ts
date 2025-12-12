/**
 * 중증질환 수용 가능 정보 API
 * 원본: dger-api/api/get-severe-diseases.js
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestErmctXml, mapSidoName } from '@/lib/ermctClient';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const STAGE1 = searchParams.get('STAGE1') || searchParams.get('region') || '';
  const STAGE2 = searchParams.get('STAGE2') || '';
  const numOfRows = searchParams.get('numOfRows') || '1000';
  const pageNo = searchParams.get('pageNo') || '1';

  try {
    const mappedStage1 = mapSidoName(STAGE1);

    console.log('[SEVERE-DISEASES] 요청 파라미터 - STAGE1:', mappedStage1, 'STAGE2:', STAGE2);

    const params: Record<string, string> = {
      numOfRows,
      pageNo,
      _type: 'xml'
    };

    if (mappedStage1) params.STAGE1 = mappedStage1;
    if (STAGE2) params.STAGE2 = STAGE2;

    const result = await requestErmctXml({
      endpoint: 'getSrsillDissAceptncPosblInfoInqire',
      params,
      description: '[SEVERE-DISEASES] 수용가능 정보'
    });

    const text = result.xml;

    console.log('[SEVERE-DISEASES] 응답 길이:', text.length);

    // 디버깅: MKioskTy 필드 확인
    if (text.includes('MKioskTy')) {
      console.log('[SEVERE-DISEASES] MKioskTy 필드 발견됨');
    }

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('[SEVERE-DISEASES] API 오류:', error);
    return NextResponse.json(
      {
        error: '중증질환 수용가능 정보 API 실패',
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
