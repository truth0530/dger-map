/**
 * Google Sheets API 유틸리티
 * - 피드백 게시판 데이터 CRUD
 * - 서비스 계정 인증 사용
 */

import { google, sheets_v4 } from 'googleapis';

// 피드백 게시글 타입
export interface FeedbackPost {
  id: string;           // 타임스탬프 기반 ID
  createdAt: string;    // 작성일시
  author: string;       // 작성자 (익명 가능)
  category: string;     // 분류: 버그, 건의, 기타
  content: string;      // 내용
  isPublic: boolean;    // 공개여부 (기본: 비공개)
  contact?: string;     // 연락처 (선택)
  hasPassword: boolean; // 비밀번호 설정 여부 (실제 비밀번호는 노출 안함)
  replyAt?: string;     // 답변일시 (관리자가 구글시트에서 직접 작성)
  replyContent?: string; // 답변내용
}

// Google Sheets 인증
function getGoogleSheetsClient(): sheets_v4.Sheets | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !privateKey) {
    console.error('[GoogleSheets] 서비스 계정 환경변수 미설정');
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

// 스프레드시트 ID 가져오기
function getSpreadsheetId(): string | null {
  const id = process.env.GOOGLE_SPREADSHEET_ID;
  if (!id) {
    console.error('[GoogleSheets] GOOGLE_SPREADSHEET_ID 환경변수 미설정');
    return null;
  }
  return id;
}

/**
 * 피드백 목록 조회
 * @param category 카테고리 필터 (선택)
 * @param page 페이지 번호 (1부터 시작)
 * @param limit 페이지당 항목 수
 */
export async function getFeedbackList(
  category?: string,
  page: number = 1,
  limit: number = 20
): Promise<{ posts: FeedbackPost[]; total: number }> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  if (!sheets || !spreadsheetId) {
    return { posts: [], total: 0 };
  }

  try {
    // 시트 데이터 조회 (A:J 컬럼: ID, 작성일시, 작성자, 카테고리, 내용, 공개여부, 연락처, 비밀번호, 답변일시, 답변내용)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:J',  // 시트명은 필요시 조정
    });

    const rows = response.data.values || [];

    // 첫 행은 헤더로 가정
    const dataRows = rows.slice(1);

    // FeedbackPost로 변환 (ID가 없으면 인덱스 기반으로 생성)
    let posts: FeedbackPost[] = dataRows.map((row, index) => ({
      id: row[0] || `legacy-${index + 1}`,  // ID가 없으면 legacy-N 형식으로 생성
      createdAt: row[1] || '',
      author: row[2] || '익명',
      category: row[3] || '기타',
      content: row[4] || '',
      isPublic: row[5] === 'Y' || row[5] === 'true' || row[5] === '공개',
      contact: row[6] || undefined,
      hasPassword: !!(row[7] && row[7].length > 0),
      replyAt: row[8] || undefined,
      replyContent: row[9] || undefined,
    })).filter(post => post.content);  // 내용이 있는 것만 필터링

    // 카테고리 필터
    if (category && category !== '전체') {
      posts = posts.filter(post => post.category === category);
    }

    // 최신순 정렬 (한국어 날짜 형식 지원)
    posts.sort((a, b) => {
      const parseKoreanDate = (dateStr: string): number => {
        if (!dateStr) return 0;

        // ISO 형식 (새 게시글)
        if (dateStr.includes('T') || dateStr.includes('-')) {
          return new Date(dateStr).getTime() || 0;
        }

        // 한국어 형식: "2021. 10. 26 오후 1:32:58"
        const match = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\s*(오전|오후)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (match) {
          const [, year, month, day, ampm, hour, min, sec = '0'] = match;
          let h = parseInt(hour, 10);
          if (ampm === '오후' && h < 12) h += 12;
          if (ampm === '오전' && h === 12) h = 0;
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), h, parseInt(min), parseInt(sec)).getTime();
        }

        return 0;
      };

      const dateA = parseKoreanDate(a.createdAt);
      const dateB = parseKoreanDate(b.createdAt);
      return dateB - dateA;
    });

    const total = posts.length;

    // 페이지네이션
    const startIndex = (page - 1) * limit;
    const paginatedPosts = posts.slice(startIndex, startIndex + limit);

    // 목록 조회 시 연락처는 노출하지 않음 (관리자만 구글시트에서 확인 가능)
    const sanitizedPosts = paginatedPosts.map(post => ({
      ...post,
      contact: undefined, // 연락처는 목록에서 숨김
    }));

    return { posts: sanitizedPosts, total };
  } catch (error) {
    console.error('[GoogleSheets] 데이터 조회 오류:', error);
    return { posts: [], total: 0 };
  }
}

/**
 * 새 피드백 작성
 */
export async function createFeedback(
  author: string,
  category: string,
  content: string,
  isPublic: boolean = false,
  contact?: string,
  password?: string
): Promise<FeedbackPost | null> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  if (!sheets || !spreadsheetId) {
    return null;
  }

  try {
    const id = Date.now().toString();
    const createdAt = new Date().toISOString();
    const authorName = author.trim() || '익명';
    const publicValue = isPublic ? 'Y' : 'N';
    const contactValue = contact || '';
    const passwordValue = password || '';

    // 새 행 추가 (A:H 컬럼: ID, 작성일시, 작성자, 카테고리, 내용, 공개여부, 연락처, 비밀번호)
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[id, createdAt, authorName, category, content, publicValue, contactValue, passwordValue]],
      },
    });

    return {
      id,
      createdAt,
      author: authorName,
      category,
      content,
      isPublic,
      contact: contact || undefined,
      hasPassword: !!password,
    };
  } catch (error) {
    console.error('[GoogleSheets] 데이터 추가 오류:', error);
    return null;
  }
}

/**
 * 피드백 삭제 (관리자 전용)
 * @param postId 삭제할 게시글 ID
 */
export async function deleteFeedback(postId: string): Promise<boolean> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  if (!sheets || !spreadsheetId) {
    return false;
  }

  try {
    // 먼저 해당 ID의 행 번호 찾기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:A',
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === postId) {
        rowIndex = i + 1; // 1-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      console.error('[GoogleSheets] 삭제할 게시글을 찾을 수 없음:', postId);
      return false;
    }

    // 시트 ID 조회
    const sheetMetadata = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheet = sheetMetadata.data.sheets?.[0];
    const sheetId = sheet?.properties?.sheetId || 0;

    // 행 삭제
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // 0-indexed
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    });

    return true;
  } catch (error) {
    console.error('[GoogleSheets] 데이터 삭제 오류:', error);
    return false;
  }
}

/**
 * 비밀글 내용 조회 (비밀번호 확인)
 * @param postId 게시글 ID
 * @param password 비밀번호
 */
export async function getPostWithPassword(
  postId: string,
  password: string
): Promise<{ success: boolean; post?: FeedbackPost; error?: string }> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  if (!sheets || !spreadsheetId) {
    return { success: false, error: '시스템 설정 오류' };
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:H',  // A:H (ID, 작성일시, 작성자, 카테고리, 내용, 공개여부, 연락처, 비밀번호)
    });

    const rows = response.data.values || [];
    const dataRows = rows.slice(1);

    // 해당 ID의 게시글 찾기
    const row = dataRows.find((r) => r[0] === postId);
    if (!row) {
      return { success: false, error: '게시글을 찾을 수 없습니다.' };
    }

    const storedPassword = row[7] || '';  // H열 (인덱스 7)

    // 비밀번호가 없는 글
    if (!storedPassword) {
      return { success: false, error: '비밀번호가 설정되지 않은 글입니다.' };
    }

    // 비밀번호 확인
    if (storedPassword !== password) {
      return { success: false, error: '비밀번호가 일치하지 않습니다.' };
    }

    return {
      success: true,
      post: {
        id: row[0] || '',
        createdAt: row[1] || '',
        author: row[2] || '익명',
        category: row[3] || '기타',
        content: row[4] || '',
        isPublic: row[5] === 'Y' || row[5] === 'true' || row[5] === '공개',
        contact: undefined, // 연락처는 관리자만 구글시트에서 확인 가능
        hasPassword: true,
      },
    };
  } catch (error) {
    console.error('[GoogleSheets] 비밀글 조회 오류:', error);
    return { success: false, error: '서버 오류가 발생했습니다.' };
  }
}

/**
 * 환경변수 설정 확인
 */
export function isGoogleSheetsConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_SPREADSHEET_ID
  );
}
