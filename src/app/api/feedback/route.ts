/**
 * 피드백 게시판 API
 * - GET: 게시글 목록 조회
 * - POST: 새 게시글 작성
 * - DELETE: 게시글 삭제 (관리자)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getFeedbackList,
  createFeedback,
  deleteFeedback,
  getPostWithPassword,
  isGoogleSheetsConfigured,
} from '@/lib/googleSheets';
import { sendFeedbackNotification } from '@/lib/slack/feedback-notification';

// CORS 헤더
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * GET /api/feedback
 * 게시글 목록 조회
 * Query: ?page=1&limit=20&category=버그
 */
export async function GET(request: NextRequest) {
  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        { error: 'Google Sheets 설정이 필요합니다.', configured: false },
        { status: 503, headers: corsHeaders }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const category = searchParams.get('category') || undefined;

    const { posts, total, status, errorMessage } = await getFeedbackList(category, page, limit);

    return NextResponse.json(
      {
        success: true,
        data: posts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        warning: status === 'error'
          ? (process.env.NODE_ENV === 'production'
              ? 'Google Sheets 조회 실패'
              : `Google Sheets 조회 실패: ${errorMessage || 'Unknown error'}`)
          : undefined,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[feedback API] GET 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/feedback
 * 새 게시글 작성
 * Body: { author?, content, category, isPublic?, password? }
 */
export async function POST(request: NextRequest) {
  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        { error: 'Google Sheets 설정이 필요합니다.', configured: false },
        { status: 503, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { author, content, category, isPublic, contact, password } = body;

    // 유효성 검사
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: '내용을 입력해주세요.' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!category || !['버그', '건의', '기타'].includes(category)) {
      return NextResponse.json(
        { error: '올바른 카테고리를 선택해주세요.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 내용 길이 제한 (1000자)
    if (content.length > 1000) {
      return NextResponse.json(
        { error: '내용은 1000자 이내로 입력해주세요.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 비밀번호 길이 제한 (4~20자)
    if (password && (password.length < 4 || password.length > 20)) {
      return NextResponse.json(
        { error: '비밀번호는 4~20자로 입력해주세요.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const post = await createFeedback(
      author || '익명',
      category,
      content.trim(),
      isPublic === true,
      contact || undefined,
      password || undefined
    );

    if (!post) {
      return NextResponse.json(
        { error: '게시글 작성에 실패했습니다.' },
        { status: 500, headers: corsHeaders }
      );
    }

    // 슬랙 알림 전송 (비동기, 실패해도 응답에 영향 없음)
    sendFeedbackNotification({
      id: post.id,
      author: post.author,
      category: category as '버그' | '건의' | '기타',
      content: content.trim(),
      isPublic: isPublic === true,
      contact: contact || undefined,
      createdAt: post.createdAt,
    }).catch((err) => {
      console.error('[feedback API] 슬랙 알림 전송 실패:', err);
    });

    return NextResponse.json(
      {
        success: true,
        data: post,
        message: '피드백이 등록되었습니다.',
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[feedback API] POST 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PUT /api/feedback
 * 비밀글 열람 (비밀번호 확인)
 * Body: { postId, password }
 */
export async function PUT(request: NextRequest) {
  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        { error: 'Google Sheets 설정이 필요합니다.', configured: false },
        { status: 503, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { postId, password } = body;

    if (!postId || !password) {
      return NextResponse.json(
        { error: '게시글 ID와 비밀번호가 필요합니다.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await getPostWithPassword(postId, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 403, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.post,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[feedback API] PUT 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/feedback?id=xxx&secret=xxx
 * 게시글 삭제 (관리자 전용)
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        { error: 'Google Sheets 설정이 필요합니다.', configured: false },
        { status: 503, headers: corsHeaders }
      );
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('id');
    const secret = searchParams.get('secret');

    // 관리자 비밀키 확인
    const adminSecret = process.env.FEEDBACK_ADMIN_SECRET;
    if (!adminSecret || secret !== adminSecret) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403, headers: corsHeaders }
      );
    }

    if (!postId) {
      return NextResponse.json(
        { error: '삭제할 게시글 ID가 필요합니다.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const success = await deleteFeedback(postId);

    if (!success) {
      return NextResponse.json(
        { error: '게시글 삭제에 실패했습니다.' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: '게시글이 삭제되었습니다.',
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[feedback API] DELETE 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}
