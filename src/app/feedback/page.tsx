'use client';

/**
 * 피드백 및 릴리즈 노트 페이지
 * - 릴리즈 노트 탭
 * - 피드백 게시판 탭 (Google Sheets 연동)
 */

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/lib/contexts/ThemeContext';

// 릴리즈 노트 타입
interface ReleaseNote {
  date: string;
  content: string;
}

// 피드백 게시글 타입
interface FeedbackPost {
  id: string;
  createdAt: string;
  author: string;
  category: string;
  content: string;
  isPublic: boolean;
  contact?: string;
  hasPassword: boolean;
  replyAt?: string;
  replyContent?: string;
}

// 릴리즈 노트 데이터
const RELEASE_NOTES: ReleaseNote[] = [
  { date: '2025.11.01', content: '공공데이터 복구완료, 응급실메시지 진료과목 등 세부 라벨 표기 구현' },
  { date: '2025.10.08', content: 'DGER 자체서버 구축완료, 임시 가동 시작(병상만 구현완료)' },
  { date: '2025.09.26', content: '국가정보자원관리원 화재로 공공데이터 포털 사용중단, 내손안의 응급실 임시 연결' },
  { date: '2025.09.13', content: '응급실 연락처 제거, 병상포화도 추가' },
  { date: '2025.09.10', content: '중증질환 항목 오류 긴급 수정' },
  { date: '2025.09.08', content: '새로운 DGER로 이전완료' },
  { date: '2025.06.27', content: 'DGER 디자인과 속도 개편' },
  { date: '2025.06.27', content: '속도개선 (5분 간격 업데이트)' },
  { date: '2025.06.27', content: '버튼사이즈 확대, 소아병상/격리병상 표출' },
  { date: '2025.06.27', content: '불가능 메시지 개선 (줄바꿈처리, 폰트사이즈 확대)' },
  { date: '2022.12.06', content: '쌍방향 시스템 초안 구축 (CPR 알림/해제)' },
  { date: '2022.10.10', content: '종합상황판 리뉴얼에 따른 재배치 부분완료' },
  { date: '2022.06.11', content: '대구동산병원 반영완료' },
  { date: '2022.02.15', content: '포화신호등 반영: 95% 이상(위험) 60~94%(주의) 60% 미만(안전)' },
  { date: '2021.11.26', content: 'DGER 최초 배포 - 대구지역 구급대원을 위한 응급실 병상 정보 시스템' }
];

// 카테고리 목록
const CATEGORIES = ['전체', '버그', '건의', '기타'] as const;
type Category = typeof CATEGORIES[number];

export default function FeedbackPage() {
  const { isDark } = useTheme();

  // 탭 상태
  const [activeTab, setActiveTab] = useState<'release' | 'board'>('release');

  // 게시판 상태
  const [posts, setPosts] = useState<FeedbackPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category>('전체');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isConfigured, setIsConfigured] = useState(true);

  // 작성 폼 상태
  const [formAuthor, setFormAuthor] = useState('');
  const [formCategory, setFormCategory] = useState<'버그' | '건의' | '기타'>('건의');
  const [formContent, setFormContent] = useState('');
  const [formIsPublic, setFormIsPublic] = useState(false); // 기본값: 비공개
  const [formContact, setFormContact] = useState(''); // 연락처 (선택)
  const [formPassword, setFormPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 비밀글 열람 상태
  const [viewingPostId, setViewingPostId] = useState<string | null>(null);
  const [viewPassword, setViewPassword] = useState('');
  const [viewedContent, setViewedContent] = useState<{ [key: string]: FeedbackPost }>({});
  const [viewError, setViewError] = useState<string | null>(null);

  // 게시글 목록 조회
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const categoryParam = selectedCategory === '전체' ? '' : `&category=${encodeURIComponent(selectedCategory)}`;
      const res = await fetch(`/api/feedback?page=${page}&limit=10${categoryParam}`);
      const data = await res.json();

      if (!res.ok) {
        if (data.configured === false) {
          setIsConfigured(false);
          setError('게시판 설정이 필요합니다.');
        } else {
          setError(data.error || '데이터를 불러오지 못했습니다.');
        }
        return;
      }

      setPosts(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setIsConfigured(true);
    } catch (err) {
      console.error('게시글 조회 오류:', err);
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, page]);

  // 탭 변경 시 게시글 조회
  useEffect(() => {
    if (activeTab === 'board') {
      fetchPosts();
    }
  }, [activeTab, fetchPosts]);

  // 게시글 작성
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) {
      setSubmitMessage({ type: 'error', text: '내용을 입력해주세요.' });
      return;
    }

    // 비밀번호 유효성 검사
    if (formPassword && (formPassword.length < 4 || formPassword.length > 20)) {
      setSubmitMessage({ type: 'error', text: '비밀번호는 4~20자로 입력해주세요.' });
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: formAuthor.trim() || '익명',
          category: formCategory,
          content: formContent.trim(),
          isPublic: formIsPublic,
          contact: formContact.trim() || undefined,
          password: formPassword || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitMessage({ type: 'error', text: data.error || '작성에 실패했습니다.' });
        return;
      }

      setSubmitMessage({ type: 'success', text: '피드백이 등록되었습니다.' });
      setFormAuthor('');
      setFormContent('');
      setFormContact('');
      setFormPassword('');
      setFormIsPublic(false);
      setPage(1);
      fetchPosts();
    } catch (err) {
      console.error('게시글 작성 오류:', err);
      setSubmitMessage({ type: 'error', text: '네트워크 오류가 발생했습니다.' });
    } finally {
      setSubmitting(false);
    }
  };

  // 비밀글 열람
  const handleViewPrivate = async (postId: string) => {
    if (!viewPassword) {
      setViewError('비밀번호를 입력해주세요.');
      return;
    }

    try {
      const res = await fetch('/api/feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, password: viewPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setViewError(data.error || '열람에 실패했습니다.');
        return;
      }

      setViewedContent((prev) => ({ ...prev, [postId]: data.data }));
      setViewingPostId(null);
      setViewPassword('');
      setViewError(null);
    } catch (err) {
      console.error('비밀글 열람 오류:', err);
      setViewError('네트워크 오류가 발생했습니다.');
    }
  };

  // 날짜 포맷팅 (ISO 형식 및 한국어 형식 지원) -> yyyy-mm-dd hh:mm
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';

    // ISO 형식 (새 게시글): "2024-12-29T10:30:00.000Z"
    if (dateStr.includes('T') || dateStr.includes('-')) {
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${year}-${month}-${day} ${hours}:${minutes}`;
        }
      } catch {
        // fallback
      }
    }

    // 한국어 형식 (기존 게시글): "2021. 10. 26 오후 1:32:58"
    const match = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\s*(오전|오후)?\s*(\d{1,2}):(\d{2})/);
    if (match) {
      const [, year, month, day, ampm, hour, min] = match;
      let h = parseInt(hour, 10);
      if (ampm === '오후' && h < 12) h += 12;
      if (ampm === '오전' && h === 12) h = 0;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${String(h).padStart(2, '0')}:${min}`;
    }

    // 시간 없는 한국어 형식: "2021. 10. 26"
    const dateOnlyMatch = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return dateStr;
  };

  // 카테고리 색상
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case '버그':
        return isDark ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700';
      case '건의':
        return isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700';
      default:
        return isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600';
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-[#fafbfc]'}`}>
      <main className={`max-w-[800px] mx-auto my-6 ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-md shadow-sm p-8`}
        style={{ margin: '1.5rem auto' }}>

        {/* 페이지 헤더 */}
        <div className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} pb-6 mb-6`}>
          <h1 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`} style={{ letterSpacing: '-0.3px' }}>
            DGER Release & Feedback
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            대구맞춤형 응급실 병상정보 시스템
          </p>
        </div>

        {/* 탭 네비게이션 */}
        <div className={`flex border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} mb-6`}>
          <button
            onClick={() => setActiveTab('release')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'release'
                ? isDark ? 'border-blue-500 text-blue-400' : 'border-blue-600 text-blue-600'
                : isDark ? 'border-transparent text-gray-400 hover:text-gray-200' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            릴리즈 노트
          </button>
          <button
            onClick={() => setActiveTab('board')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'board'
                ? isDark ? 'border-blue-500 text-blue-400' : 'border-blue-600 text-blue-600'
                : isDark ? 'border-transparent text-gray-400 hover:text-gray-200' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            피드백 게시판
          </button>
        </div>

        {/* 릴리즈 노트 탭 */}
        {activeTab === 'release' && (
          <>
            {/* 소개 섹션 */}
            <div className={`rounded p-5 mb-6 border ${
              isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
            }`}>
              <h3 className={`text-base font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                안녕하세요, 중앙응급의료센터(대구응급의료지원센터) 이광성입니다.
              </h3>
              <div className={`text-sm leading-relaxed space-y-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                <p>
                  2021년 11월 26일부터 대구지역 구급대원을 위해 DGER을 제작하여 배포하였고,<br />
                  인천, 광주, 세종, 경남지역으로 확대하여 시범사업을 진행하였으며,<br />
                  2022년 3월 16일부터 내 손안의 응급실이 복지부를 통해 정식 출시되었습니다.
                </p>
                <p>
                  현재는 내손안의 응급실의 보조적 수단으로 서버를 유지중이며,<br />
                  향후 개선방향을 제시하기 위해 지속적인 피드백을 받도록 하겠습니다.
                </p>
              </div>
            </div>

            {/* 릴리즈 노트 */}
            <div className="mb-6">
              <h3 className={`text-base font-semibold mb-4 pb-2 border-b ${
                isDark ? 'text-white border-gray-700' : 'text-gray-800 border-gray-200'
              }`}>
                Release Notes
              </h3>
              <ul className="space-y-0">
                {RELEASE_NOTES.map((note, index) => (
                  <li
                    key={index}
                    className={`flex items-baseline py-2 border-b ${
                      isDark ? 'border-gray-700' : 'border-gray-100'
                    } last:border-0`}
                  >
                    <span className={`text-xs font-mono font-medium w-[70px] flex-shrink-0 mr-4 ${
                      isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      {note.date}
                    </span>
                    <span className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {note.content}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* 피드백 게시판 탭 */}
        {activeTab === 'board' && (
          <>
            {/* 작성 폼 */}
            <form onSubmit={handleSubmit} className={`rounded p-5 mb-6 border ${
              isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
            }`}>
              <h3 className={`text-base font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                피드백 작성
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* 카테고리 */}
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    분류
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as typeof formCategory)}
                    className={`w-full px-3 py-2 rounded border text-sm ${
                      isDark
                        ? 'bg-gray-800 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-800'
                    }`}
                  >
                    <option value="건의">건의</option>
                    <option value="버그">버그</option>
                    <option value="기타">기타</option>
                  </select>
                </div>

                {/* 작성자 */}
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    작성자 (선택)
                  </label>
                  <input
                    type="text"
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder="익명"
                    maxLength={20}
                    className={`w-full px-3 py-2 rounded border text-sm ${
                      isDark
                        ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500'
                        : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
                    }`}
                  />
                </div>
              </div>

              {/* 내용 */}
              <div className="mb-4">
                <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  내용
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="피드백을 입력해주세요..."
                  maxLength={1000}
                  rows={4}
                  className={`w-full px-3 py-2 rounded border text-sm resize-none ${
                    isDark
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
                  }`}
                />
                <div className={`text-xs mt-1 text-right ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {formContent.length}/1000
                </div>
              </div>

              {/* 연락처, 공개여부, 비밀번호 */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                {/* 연락처 */}
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    연락처 (선택)
                  </label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    placeholder="이메일/전화번호"
                    maxLength={50}
                    className={`w-full px-3 py-2 rounded border text-sm ${
                      isDark
                        ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500'
                        : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
                    }`}
                  />
                </div>

                {/* 공개여부 체크박스 */}
                <div className="flex items-center whitespace-nowrap">
                  <label className={`flex items-center cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    <input
                      type="checkbox"
                      checked={formIsPublic}
                      onChange={(e) => setFormIsPublic(e.target.checked)}
                      className="mr-2 w-4 h-4 rounded"
                    />
                    <span className="text-sm">공개글로 작성 <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>(기본: 비밀글)</span></span>
                  </label>
                </div>

                {/* 비밀번호 */}
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    비밀번호 (본인 확인용)
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="4~20자"
                    maxLength={20}
                    className={`w-full px-3 py-2 rounded border text-sm ${
                      isDark
                        ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500'
                        : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
                    }`}
                  />
                </div>
              </div>

              {/* 제출 메시지 */}
              {submitMessage && (
                <div className={`text-sm mb-3 ${
                  submitMessage.type === 'success'
                    ? isDark ? 'text-green-400' : 'text-green-600'
                    : isDark ? 'text-red-400' : 'text-red-600'
                }`}>
                  {submitMessage.text}
                </div>
              )}

              {/* 제출 버튼 */}
              <button
                type="submit"
                disabled={submitting || !isConfigured}
                className={`px-5 py-2 text-sm font-medium rounded transition-colors disabled:opacity-50 ${
                  isDark
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {submitting ? '작성 중...' : '작성하기'}
              </button>
            </form>

            {/* 카테고리 필터 */}
            <div className="flex gap-2 mb-4">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    selectedCategory === cat
                      ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                      : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 게시글 목록 */}
            <div className="mb-6">
              {loading ? (
                <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  로딩 중...
                </div>
              ) : error ? (
                <div className={`text-center py-8 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  {error}
                </div>
              ) : posts.length === 0 ? (
                <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  등록된 피드백이 없습니다.
                </div>
              ) : (
                <ul className="space-y-0">
                  {posts.map((post) => {
                    const isViewed = viewedContent[post.id];
                    const displayPost = isViewed || post;
                    const showContent = post.isPublic || isViewed;

                    return (
                      <li
                        key={post.id}
                        className={`py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'} last:border-0`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {formatDate(post.createdAt)}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${getCategoryColor(post.category)}`}>
                            {post.category}
                          </span>
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {post.author}
                          </span>
                          {!post.isPublic && (
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              isDark ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              비밀글
                            </span>
                          )}
                          {post.replyContent && (
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              isDark ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
                            }`}>
                              답변완료
                            </span>
                          )}
                        </div>

                        {/* 게시글 내용 */}
                        {showContent ? (
                          <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {displayPost.content}
                          </p>
                        ) : (
                          <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {viewingPostId === post.id ? (
                              <div>
                                <div className="flex items-center gap-1.5 flex-nowrap">
                                  <input
                                    type="password"
                                    value={viewPassword}
                                    onChange={(e) => setViewPassword(e.target.value)}
                                    placeholder="비밀번호"
                                    className={`px-2 py-1 rounded border text-sm w-20 ${
                                      isDark
                                        ? 'bg-gray-800 border-gray-600 text-white'
                                        : 'bg-white border-gray-300 text-gray-800'
                                    }`}
                                    onKeyDown={(e) => e.key === 'Enter' && handleViewPrivate(post.id)}
                                  />
                                  <button
                                    onClick={() => handleViewPrivate(post.id)}
                                    className={`px-2 py-1 text-xs rounded flex-shrink-0 ${
                                      isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                                    }`}
                                  >
                                    확인
                                  </button>
                                  <button
                                    onClick={() => {
                                      setViewingPostId(null);
                                      setViewPassword('');
                                      setViewError(null);
                                    }}
                                    className={`px-2 py-1 text-xs rounded flex-shrink-0 ${
                                      isDark ? 'bg-gray-600 text-white' : 'bg-gray-300 text-gray-700'
                                    }`}
                                  >
                                    취소
                                  </button>
                                </div>
                                {viewError && (
                                  <p className={`text-xs mt-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                                    {viewError}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setViewingPostId(post.id);
                                  setViewError(null);
                                }}
                                className={`text-sm underline ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                              >
                                비밀글입니다. 클릭하여 열람
                              </button>
                            )}
                          </div>
                        )}

                        {/* 답변 표시 */}
                        {showContent && displayPost.replyContent && (
                          <div className={`mt-3 p-3 rounded border-l-4 ${
                            isDark
                              ? 'bg-green-900/20 border-green-600'
                              : 'bg-green-50 border-green-500'
                          }`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-semibold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                관리자 답변
                              </span>
                              {displayPost.replyAt && (
                                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {formatDate(displayPost.replyAt)}
                                </span>
                              )}
                            </div>
                            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                              {displayPost.replyContent}
                            </p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className={`px-3 py-1.5 text-xs rounded transition-colors disabled:opacity-50 ${
                    isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  이전
                </button>
                <span className={`px-3 py-1.5 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className={`px-3 py-1.5 text-xs rounded transition-colors disabled:opacity-50 ${
                    isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}

        {/* 외부 링크 */}
        <div className={`mt-8 pt-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} flex gap-3`}>
          <a
            href="https://dger.netlify.app"
            target="_blank"
            rel="noopener noreferrer"
            className={`px-4 py-2 text-sm font-medium rounded border transition-colors ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
            }`}
          >
            구버전 DGER
          </a>
        </div>
      </main>
    </div>
  );
}
