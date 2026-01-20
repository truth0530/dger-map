'use client';

/**
 * 피드백 및 릴리즈 노트 페이지
 * - 릴리즈 노트 탭
 * - 피드백 게시판 탭 (Google Sheets 연동)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@/lib/contexts/ThemeContext';
import HospitalNamesContent from '@/components/HospitalNamesContent';

// 릴리즈 노트 타입
interface ReleaseNote {
  date: string;
  content: string;
  type?: 'major' | 'minor' | 'fix' | 'init' | 'version';
  version?: string;
  tech?: string;
}

type ReleaseNoteType = NonNullable<ReleaseNote['type']>;

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
  replyPublic?: boolean; // 답변공개여부 - true면 답변 공개
}

/**
 * ========================================
 * 📊 COMMIT COUNT - 릴리즈 노트 업데이트 시 함께 갱신 필요!
 * ========================================
 * 계산법: DGER_API_COMMITS (고정) + DGER_MAP_COMMITS (갱신)
 *
 * dger-map 커밋 수 확인: git rev-list --count HEAD
 * ========================================
 */
const DGER_API_COMMITS = 334;  // 고정값 (2026.01.20 기준, 더 이상 증가하지 않음)
const DGER_MAP_COMMITS = 117;  // 🔄 릴리즈 노트 추가 시 업데이트 필요!
const TOTAL_COMMITS = DGER_API_COMMITS + DGER_MAP_COMMITS;  // 현재: 451

// 릴리즈 노트 데이터
const RELEASE_NOTES: ReleaseNote[] = [
  // DGER 3.0 - React 프레임워크 기반
  { date: '2026.01.20', content: '테이블 정렬 기능 추가, 병상 목록 스크롤 버그 수정, 전국 416개 병원 약어 목록 적용, 외상진료구역 및 외상소생실 추가(요청기능 반영)', type: 'minor' },
  { date: '2026.01.15', content: '17개 시도 단위에서 광역 단위와 즐겨찾기 추가(병원명 ☆ 버튼으로 즐겨찾기 자동생성), 즐겨찾기 공유 기능 신설: URL 복사 버튼으로 원하는 병원 목록 링크로 공유 가능', type: 'minor' },
  { date: '2026.01.14', content: '업데이트 30분 초과기관 주황표시, 응급메시지 AND 조건 검색 구현 (예: 소아 장중첩 → 공백으로 여러 단어 조합 검색)', type: 'minor' },
  { date: '2026.01.03', content: '응급메시지 가독성 정책 고도화(이송 전 확인/참고바람/불가 통일) 및 하이라이트 색상 규칙 정비, 원문 툴팁 표시 강화\n중증질환 [███가능███|█불가█|░미참여░] 스택 바 차트로 가독성 개선', type: 'minor' },
  { date: '2025.12.31', content: '지도 마커 크기를 재실인원 기준으로 자동 조절하고, 포화도에 따라 색상/투명도 그라데이션을 적용', type: 'minor' },
  { date: '2025.12.30', content: 'DGER 3.0', type: 'version', version: '3.0', tech: 'Next.js 16 (React 프레임워크 기반)' },
  { date: '2025.12.30', content: 'Next.js 16 기반 DGER 이송지도 개발, 피드백 게시판 신설, 방문자 통계 페이지 신설', type: 'init' },

  // DGER 2.0 - Node.js 서버 기반
  { date: '2025.09.13', content: '병상 포화도 계산 로직 수정, 응급실 포화도 기능 추가', type: 'minor' },
  { date: '2025.09.12', content: 'React2 버전 정식 서비스 전환, 품질 안정화', type: 'major' },
  { date: '2025.09.11', content: '전체화면 모드 UX 전면 개선(우측 여백 제거, 컬럼 잘림 해결, 고해상도 최적화, ESC 지원)', type: 'major' },
  { date: '2025.09.10', content: '메시지/질환 표기 정확도 개선, 질환 코드 매핑 오류 수정', type: 'fix' },
  { date: '2025.09.09', content: '병원명 별칭/표기 로직 개선', type: 'minor' },
  { date: '2025.09.08', content: 'React 기반 화면 리뉴얼(레이아웃/카드뷰/테이블), 메시지/질환 필터 안정화 작업 완료', type: 'major' },
  { date: '2025.11.01', content: '공공데이터 복구완료, 응급실메시지 진료과목 등 세부 라벨 표기 구현', type: 'major' },
  { date: '2025.10.08', content: 'DGER 자체서버 구축완료, 임시 가동 시작(병상만 구현완료)', type: 'major' },
  { date: '2025.09.26', content: '국가정보자원관리원 화재로 공공데이터 포털 사용중단, 내손안의 응급실 임시 연결', type: 'fix' },
  { date: '2025.09.13', content: '응급실 연락처 제거, 병상포화도 추가', type: 'minor' },
  { date: '2025.09.10', content: '중증질환 항목 오류 긴급 수정', type: 'fix' },
  { date: '2025.09.08', content: 'DGER 2.0', type: 'version', version: '2.0', tech: 'Node.js Express (서버 기반)' },
  { date: '2025.09.08', content: '새로운 DGER로 이전완료', type: 'major' },

  // DGER 1.0 - 스프레드시트 기반
  { date: '2025. 08. 01~31', content: '중증질환(severe) 페이지 조회 안정화(Q0+QN 기본화/폴백), UI 1줄 정책 강화\n드롭다운 포탈/클리핑 이슈 근본 해결 및 전 페이지 적용\nsystommsg 안정화(병원 분류 hpbd 매핑 정비, 메시지 렌더 안정화)\n네비/헤더/검색/체크박스 스타일 통일 및 반응형 1줄 최적화\n카드뷰 타이포 개선(재실/병원명), 비대구 병원명 축소 및 줄바꿈 방지\n병원 유형 자동 매칭(hosp_list.json 연동) 및 색상 스타일 분화', type: 'major' },
  { date: '2025. 06. 01~26', content: '27개 중증질환 대시보드 및 index4.html UI 구축/개선\n병원 리스트 정렬/재실환자 수 표기 기능 추가 및 계산 오류 수정\n질환 선택/필터링 로직 보정, 선택 질환명 헤더 표시\n중증질환 필드명 대소문자(MKioskTy) 수정 및 API 오류 개선', type: 'major' },
  { date: '2025.06.27', content: 'DGER 디자인과 속도 개편', type: 'major' },
  { date: '2025.06.27', content: '속도개선 (5분 간격 업데이트)', type: 'minor' },
  { date: '2025.06.27', content: '버튼사이즈 확대, 소아병상/격리병상 표출', type: 'minor' },
  { date: '2025.06.27', content: '불가능 메시지 개선 (줄바꿈처리, 폰트사이즈 확대)', type: 'minor' },
  { date: '2022.12.06', content: '쌍방향 시스템 초안 구축 (CPR 알림/해제)', type: 'major' },
  { date: '2022.10.10', content: '종합상황판 리뉴얼에 따른 재배치 부분완료', type: 'minor' },
  { date: '2022.06.11', content: '대구동산병원 반영완료', type: 'minor' },
  { date: '2022.02.15', content: '포화신호등 반영: 95% 이상(위험) 60~94%(주의) 60% 미만(안전)', type: 'major' },
  { date: '2021.11.26', content: 'DGER 1.0', type: 'version', version: '1.0', tech: 'Google Sheets (스프레드시트 기반)' },
  { date: '2021.11.26', content: 'DGER 최초 배포 - 대구지역 구급대원을 위한 응급실 병상 정보 시스템', type: 'init' }
];

// 카테고리 목록
const CATEGORIES = ['전체', '버그', '건의', '기타'] as const;
type Category = typeof CATEGORIES[number];

const REGION_NAME_MAP: Record<string, string> = {
  Seoul: '서울',
  'Seoul Special City': '서울',
  Busan: '부산',
  'Busan Metropolitan City': '부산',
  Daegu: '대구',
  'Daegu Metropolitan City': '대구',
  Incheon: '인천',
  'Incheon Metropolitan City': '인천',
  Gwangju: '광주',
  'Gwangju Metropolitan City': '광주',
  Daejeon: '대전',
  'Daejeon Metropolitan City': '대전',
  Ulsan: '울산',
  'Ulsan Metropolitan City': '울산',
  Sejong: '세종',
  'Sejong Special Self-Governing City': '세종',
  'Gyeonggi-do': '경기',
  'Gangwon-do': '강원도',
  'Chungcheongbuk-do': '충북',
  'Chungcheongnam-do': '충남',
  'Jeollabuk-do': '전북',
  'Jeonbuk-do': '전북',
  'Jeonbuk State': '전북',
  Jeonbuk: '전북',
  'Jeollanam-do': '전남',
  'Gyeongsangbuk-do': '경북',
  'Gyeongsangnam-do': '경남도',
  'Jeju-do': '제주',
  Jeju: '제주',
  California: '캘리포니아',
  Berlin: '베를린',
  Hessen: '헤센',
  Hokkaido: '홋카이도',
  Fukuoka: '후쿠오카',
  Fukui: '후쿠이',
  Tokyo: '도쿄',
  'North Rhine-Westphalia': '노르트라인-베스트팔렌',
  'Rhineland-Palatinate': '라인란트-팔츠',
  Iowa: '아이오와',
  '(not set)': '미설정',
};

const getRegionLabel = (region: string) => REGION_NAME_MAP[region] || region;

// 릴리즈 타입별 스타일
const getReleaseTypeStyle = (type: ReleaseNote['type'], isDark: boolean) => {
  switch (type) {
    case 'version':
      return isDark
        ? 'bg-purple-500/20 border-purple-500 text-purple-400'
        : 'bg-purple-100 border-purple-400 text-purple-700';
    case 'major':
      return isDark
        ? 'bg-blue-500/20 border-blue-500 text-blue-400'
        : 'bg-blue-100 border-blue-400 text-blue-700';
    case 'fix':
      return isDark
        ? 'bg-red-500/20 border-red-500 text-red-400'
        : 'bg-red-100 border-red-400 text-red-700';
    case 'init':
      return isDark
        ? 'bg-green-500/20 border-green-500 text-green-400'
        : 'bg-green-100 border-green-400 text-green-700';
    default:
      return isDark
        ? 'bg-gray-500/20 border-gray-500 text-gray-400'
        : 'bg-gray-200 border-gray-400 text-gray-700';
  }
};

const getReleaseTypeLabel = (type: ReleaseNote['type']) => {
  switch (type) {
    case 'version': return '버전';
    case 'major': return '주요 업데이트';
    case 'fix': return '버그 수정';
    case 'init': return '최초 배포';
    default: return '개선';
  }
};

export default function FeedbackPage() {
  const { isDark } = useTheme();

  // 탭 상태
  const [activeTab, setActiveTab] = useState<'release' | 'board' | 'stats' | 'abbrev'>('release');
  const sortedReleaseNotes = useMemo(() => {
    const typeOrder: Record<ReleaseNoteType, number> = {
      init: 0,
      major: 1,
      minor: 2,
      fix: 3,
      version: 9,
    };
    const versionOrder: Record<string, number> = {
      '3.0': 0,
      '2.0': 1,
      '1.0': 2,
    };

    const getDateKey = (dateText: string) => {
      const cleaned = dateText.replace(/\s+/g, '');
      const match = cleaned.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
      if (match) {
        return `${match[1]}${match[2]}${match[3]}`;
      }
      return cleaned.replace(/\D/g, '');
    };

    const getVersionGroup = (note: ReleaseNote) => {
      if (note.version) return note.version;
      const dateKey = getDateKey(note.date);
      if (dateKey >= '20251230') return '3.0';
      if (dateKey >= '20250601') return '2.0';
      return '1.0';
    };

    return [...RELEASE_NOTES].sort((a, b) => {
      const aGroup = getVersionGroup(a);
      const bGroup = getVersionGroup(b);
      const aRank = versionOrder[aGroup] ?? 99;
      const bRank = versionOrder[bGroup] ?? 99;
      if (aRank !== bRank) return aRank - bRank;
      const aIsVersion = a.type === 'version';
      const bIsVersion = b.type === 'version';
      if (aIsVersion && !bIsVersion) return 1;
      if (!aIsVersion && bIsVersion) return -1;
      const aKey = getDateKey(a.date);
      const bKey = getDateKey(b.date);
      if (aKey !== bKey) {
        return bKey.localeCompare(aKey);
      }
      const aType = a.type ?? 'minor';
      const bType = b.type ?? 'minor';
      return (typeOrder[aType] ?? 99) - (typeOrder[bType] ?? 99);
    });
  }, []);

  // 통계 데이터 상태
  interface AnalyticsData {
    realtime: { activeUsers: number };
    today: { users: number; sessions: number };
    average: { dailyUsers: number };
    total: { users: number; sessions: number; pageViews: number; avgSessionDuration: number; since: string };
    dailyTrend: Array<{ date: string; users: number; sessions: number }>;
    regionStats: Array<{ region: string; users: number }>;
    deviceRatio: { desktop: number; mobile: number; tablet: number; total: number };
    topPages: Array<{ name: string; pageViews: number; users: number; avgEngagementTime: number }>;
  }
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

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
  const [contactError, setContactError] = useState<string | null>(null); // 연락처 유효성 오류
  const [formPassword, setFormPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 전화번호 포맷팅 (한국 전화번호)
  const formatPhoneNumber = (value: string): string => {
    // 숫자만 추출
    const numbers = value.replace(/[^0-9]/g, '');

    // 휴대폰 번호 (010, 011, 016, 017, 018, 019)
    if (numbers.startsWith('01')) {
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
    // 서울 지역번호 (02)
    if (numbers.startsWith('02')) {
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 5) return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
      if (numbers.length <= 9) return `${numbers.slice(0, 2)}-${numbers.slice(2, 5)}-${numbers.slice(5)}`;
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
    }
    // 기타 지역번호 (031, 032, 033, 041, 042, 043, 044, 051, 052, 053, 054, 055, 061, 062, 063, 064)
    if (numbers.startsWith('0') && numbers.length > 1) {
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
      if (numbers.length <= 10) return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
    return value;
  };

  // 이메일 유효성 검사
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 연락처가 전화번호인지 확인 (이메일이 아닌 경우에만)
  const isPhoneNumber = (value: string): boolean => {
    // @가 포함되어 있으면 이메일로 처리 (숫자로 시작해도)
    if (value.includes('@')) return false;

    const numbers = value.replace(/[^0-9]/g, '');
    // 숫자만 있고, 0으로 시작하고, 숫자가 전체 길이의 대부분을 차지하면 전화번호
    const nonNumbers = value.replace(/[0-9\-\s]/g, '');
    return numbers.length > 0 && numbers.startsWith('0') && nonNumbers.length === 0;
  };

  // 연락처 변경 핸들러
  const handleContactChange = (value: string) => {
    setContactError(null);

    // @가 포함되어 있으면 무조건 이메일로 처리
    if (value.includes('@')) {
      setFormContact(value);
      if (value.length > 3 && !validateEmail(value)) {
        setContactError('올바른 이메일 형식이 아닙니다');
      }
      return;
    }

    // 전화번호로 시작하면 포맷팅
    if (isPhoneNumber(value)) {
      setFormContact(formatPhoneNumber(value));
    } else {
      setFormContact(value);
    }
  };

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

  // 통계 데이터 조회
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);

    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();

      if (!res.ok) {
        setAnalyticsError(data.error || '통계 데이터를 불러오지 못했습니다.');
        return;
      }

      setAnalyticsData(data.data);
    } catch (err) {
      console.error('통계 조회 오류:', err);
      setAnalyticsError('네트워크 오류가 발생했습니다.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // 탭 변경 시 통계 조회
  useEffect(() => {
    if (activeTab === 'stats') {
      fetchAnalytics();
    }
  }, [activeTab, fetchAnalytics]);

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
        return isDark ? 'bg-emerald-900/50 text-emerald-300' : 'bg-[#4A5D5D]/20 text-[#4A5D5D]';
      default:
        return isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600';
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-b from-gray-900 to-gray-950' : 'bg-gradient-to-b from-[#F5F0E8] to-[#EDE7DD]'}`}>

      <main className="max-w-[900px] mx-auto px-6 py-4">
        {/* 탭 네비게이션 */}
        <div className={`inline-flex p-1 rounded-xl ${isDark ? 'bg-gray-800/80' : 'bg-gray-100'} mb-4`}>
          <button
            onClick={() => setActiveTab('release')}
            className={`px-2 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
              activeTab === 'release'
                ? isDark
                  ? 'bg-gray-700 text-white shadow-lg'
                  : 'bg-white text-gray-900 shadow-md'
                : isDark
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            릴리즈노트
          </button>
          <button
            onClick={() => setActiveTab('board')}
            className={`px-2 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
              activeTab === 'board'
                ? isDark
                  ? 'bg-gray-700 text-white shadow-lg'
                  : 'bg-white text-gray-900 shadow-md'
                : isDark
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            피드백
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-2 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
              activeTab === 'stats'
                ? isDark
                  ? 'bg-gray-700 text-white shadow-lg'
                  : 'bg-white text-gray-900 shadow-md'
                : isDark
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            방문자통계
          </button>
          <button
            onClick={() => setActiveTab('abbrev')}
            className={`px-2 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
              activeTab === 'abbrev'
                ? isDark
                  ? 'bg-gray-700 text-white shadow-lg'
                  : 'bg-white text-gray-900 shadow-md'
                : isDark
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            병원명 약어
          </button>
        </div>

        {/* 릴리즈 노트 탭 */}
        {activeTab === 'release' && (
          <div className="space-y-8">
            {/* 소개 섹션 - 카드 스타일 */}
            <div className={`relative overflow-hidden rounded-2xl p-6 ${
              isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-[#FAF7F2] border border-gray-300 shadow-sm'
            }`}>
              <div className="absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8">
                <div className={`w-full h-full rounded-full ${isDark ? 'bg-blue-500/10' : 'bg-blue-500/5'}`} />
              </div>
              <div className="relative">
                <div className={`text-sm leading-relaxed space-y-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  <p>
                    2021년 11월 26일부터 대구지역 구급대원을 위해 구글스프레드 기반 HTML 웹페이지로 DGER을 제작·배포하였고,
                    인천·광주·세종·경남으로 확대해 종합상황판 불가능 메시지 개선을 위한 시범사업을 진행하며 ICER, KJER, SJER, GNER을 제작하여 추가 배포했습니다. 이후 2022년 3월 16일부터 내 손안의 응급실이 복지부를 통해 정식 출시되었습니다.
                  </p>
                  <p>
                    현재는 내손안의 응급실의 보조적 수단으로 서버를 유지 중이며 대구지역 위주로 하루 100여명의 접속자가 이용하고 있습니다(2025년 12월 31일 기준 누적 페이지뷰 736,285건). 또한 Node.js Express 서버 기반의 2.0과 Next.js 기반의 3.0으로 지속 업데이트하고 있으며, 피드백 게시판을 통해 개선 의견을 주시면 최대한 반영하겠습니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 릴리즈 노트 - 타임라인 스타일 */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Release Timeline
                </h3>
                <span className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                  {TOTAL_COMMITS}+ commits
                </span>
              </div>

              <div className="relative">
                {/* 타임라인 세로선 */}
                <div className={`absolute left-[7px] top-3 bottom-3 w-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-400'}`} />

                <div className="space-y-1">
                  {sortedReleaseNotes.map((note, index) => (
                    note.type === 'version' ? (
                      // 버전 섹션 헤더
                      <div
                        key={index}
                        className={`relative pl-8 py-4 ${index !== 0 ? 'mt-6' : ''}`}
                      >
                        {/* 버전 마커 (큰 원) */}
                        <div className={`absolute left-0 top-[20px] w-[15px] h-[15px] rounded-full border-2 ${
                          isDark
                            ? 'bg-purple-500 border-purple-400'
                            : 'bg-purple-500 border-purple-400'
                        }`} />

                        <div className="flex items-center gap-3">
                          <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {note.content}
                          </span>
                          <span className={`text-xs px-2.5 py-1 rounded-full border ${getReleaseTypeStyle(note.type, isDark)}`}>
                            {note.tech}
                          </span>
                        </div>
                        <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {note.date} ~
                        </p>
                      </div>
                    ) : (
                      // 일반 릴리즈 노트 항목
                      <div
                        key={index}
                        className={`relative pl-8 py-3 group rounded-xl transition-colors ${
                          isDark ? 'hover:bg-gray-800/50' : 'hover:bg-[#E8E2D8]'
                        }`}
                      >
                        {/* 타임라인 점 */}
                        <div className={`absolute left-0 top-[18px] w-[15px] h-[15px] rounded-full border-2 transition-colors ${
                          note.type === 'major' || note.type === 'init'
                            ? isDark
                              ? 'bg-blue-500 border-blue-400'
                              : 'bg-blue-500 border-blue-300'
                            : note.type === 'fix'
                              ? isDark
                                ? 'bg-red-500 border-red-400'
                                : 'bg-red-500 border-red-300'
                              : isDark
                                ? 'bg-gray-600 border-gray-500 group-hover:bg-gray-500'
                                : 'bg-gray-400 border-gray-300 group-hover:bg-gray-500'
                        }`} />

                        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                          <span className={`text-xs font-mono font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            {note.date}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${getReleaseTypeStyle(note.type, isDark)}`}>
                            {getReleaseTypeLabel(note.type)}
                          </span>
                        </div>
                        <p className={`mt-1 text-sm leading-relaxed whitespace-pre-line ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          {note.content}
                        </p>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 피드백 게시판 탭 */}
        {activeTab === 'board' && (
          <div className="space-y-4">
            {/* 작성 폼 - 모던 카드 스타일 */}
            <form onSubmit={handleSubmit} className={`relative overflow-hidden rounded-2xl ${
              isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-[#FAF7F2] border border-gray-300 shadow-sm'
            }`}>
              {/* 폼 헤더 */}
              <div className={`px-4 py-2.5 border-b ${isDark ? 'border-gray-700/50 bg-gray-800/30' : 'border-gray-100 bg-gray-50/50'}`}>
                <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  버그 신고, 기능 건의 등을 남겨주세요
                </p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  그 외 시스템 운영과 무관한 수용불가, 부적절 이송에 대한 내용은 예고없이 삭제될 수 있습니다.
                </p>
              </div>

              <div className="p-3 space-y-2">
                {/* 1행: 분류 + 작성자 + 연락처 + 비공개 + 비밀번호 */}
                <div className="flex gap-2 items-end flex-wrap">
                  <div className="shrink-0">
                    <label className={`block text-[10px] font-medium mb-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      분류
                    </label>
                    <div className="flex">
                      {(['건의', '버그', '기타'] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFormCategory(cat)}
                          className={`px-1.5 py-1 text-[10px] font-medium border transition-all first:rounded-l last:rounded-r -ml-px first:ml-0 ${
                            formCategory === cat
                              ? cat === '버그'
                                ? isDark
                                  ? 'bg-red-500/20 border-red-500 text-red-400 z-10'
                                  : 'bg-red-50 border-red-500 text-red-600 z-10'
                                : isDark
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 z-10'
                                  : 'bg-[#4A5D5D]/10 border-[#4A5D5D] text-[#4A5D5D] z-10'
                              : isDark
                                ? 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="w-20">
                    <label className={`block text-[10px] font-medium mb-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      작성자
                    </label>
                    <input
                      type="text"
                      value={formAuthor}
                      onChange={(e) => setFormAuthor(e.target.value)}
                      placeholder="익명"
                      maxLength={20}
                      className={`w-full px-2 py-1 rounded border text-xs transition-colors focus:outline-none focus:ring-1 ${
                        isDark
                          ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:ring-emerald-500/50 focus:border-emerald-500'
                          : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-[#4A5D5D]/30 focus:border-[#4A5D5D]'
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-[100px] relative">
                    <label className={`block text-[10px] font-medium mb-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      연락처
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formContact}
                        onChange={(e) => handleContactChange(e.target.value)}
                        placeholder="이메일/전화번호"
                        maxLength={50}
                        className={`w-full px-2 py-1 rounded border text-xs transition-colors focus:outline-none focus:ring-1 ${
                          contactError
                            ? isDark
                              ? 'bg-gray-800 border-red-500 text-white placeholder-gray-500 focus:ring-red-500/50 focus:border-red-500'
                              : 'bg-white border-red-400 text-gray-800 placeholder-gray-400 focus:ring-red-300 focus:border-red-400'
                            : isDark
                              ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:ring-emerald-500/50 focus:border-emerald-500'
                              : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-[#4A5D5D]/30 focus:border-[#4A5D5D]'
                        }`}
                      />
                      {contactError && (
                        <div className={`absolute -bottom-4 left-0 text-[9px] ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                          {contactError}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center shrink-0">
                    <label className={`flex items-center gap-1.5 cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={formIsPublic}
                          onChange={(e) => setFormIsPublic(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-7 h-4 rounded-full transition-colors ${
                          formIsPublic
                            ? isDark ? 'bg-emerald-500' : 'bg-[#4A5D5D]'
                            : isDark ? 'bg-gray-600' : 'bg-gray-300'
                        }`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                            formIsPublic ? 'translate-x-3.5' : 'translate-x-0.5'
                          }`} />
                        </div>
                      </div>
                      <span className="text-[10px]">
                        {formIsPublic ? '공개' : '비공개'}
                      </span>
                    </label>
                  </div>

                  <div className="w-24">
                    <label className={`block text-[10px] font-medium mb-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      비밀번호
                    </label>
                    <input
                      type="password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="4~20자"
                      maxLength={20}
                      className={`w-full px-2 py-1 rounded border text-xs transition-colors focus:outline-none focus:ring-1 ${
                        isDark
                          ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:ring-emerald-500/50 focus:border-emerald-500'
                          : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-[#4A5D5D]/30 focus:border-[#4A5D5D]'
                      }`}
                    />
                  </div>
                </div>

                {/* 2행: 내용 */}
                <div>
                  <textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="피드백 내용을 입력해주세요..."
                    maxLength={1000}
                    rows={2}
                    className={`w-full px-2 py-1.5 rounded border text-sm resize-none transition-colors focus:outline-none focus:ring-1 ${
                      isDark
                        ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:ring-emerald-500/50 focus:border-emerald-500'
                        : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-[#4A5D5D]/30 focus:border-[#4A5D5D]'
                    }`}
                  />
                  <div className={`text-[10px] mt-0.5 text-right ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {formContent.length}/1000
                  </div>
                </div>

                {/* 제출 메시지 */}
                {submitMessage && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                    submitMessage.type === 'success'
                      ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-600'
                      : isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600'
                  }`}>
                    {submitMessage.type === 'success' ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {submitMessage.text}
                  </div>
                )}

                {/* 제출 버튼 */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting || !isConfigured}
                    className={`px-6 py-1.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50 ${
                      isDark
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : 'bg-[#4A5D5D] hover:bg-[#3A4D4D] text-white shadow-lg shadow-[#4A5D5D]/30'
                    }`}
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        보내는 중...
                      </span>
                    ) : '보내기'}
                  </button>
                </div>
              </div>
            </form>

            {/* 카테고리 필터 + 게시글 목록 헤더 */}
            <div className="flex items-center justify-between">
              <div className={`inline-flex p-1 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setPage(1);
                    }}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                      selectedCategory === cat
                        ? isDark
                          ? 'bg-gray-700 text-white shadow'
                          : 'bg-white text-gray-900 shadow-sm'
                        : isDark
                          ? 'text-gray-400 hover:text-gray-200'
                          : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {posts.length > 0 && `${posts.length}개의 피드백`}
              </span>
            </div>

            {/* 게시글 목록 */}
            <div className="space-y-4">
              {loading ? (
                <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <svg className="animate-spin w-8 h-8 mb-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm">피드백을 불러오는 중...</span>
                </div>
              ) : error ? (
                <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                  <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm">{error}</span>
                </div>
              ) : posts.length === 0 ? (
                <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <span className="text-sm">등록된 피드백이 없습니다</span>
                  <span className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    첫 번째 피드백을 남겨보세요!
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map((post) => {
                    const isViewed = viewedContent[post.id];
                    const displayPost = isViewed || post;
                    const showContent = post.isPublic || isViewed;

                    return (
                      <div
                        key={post.id}
                        className={`rounded-xl p-5 transition-all ${
                          isDark
                            ? 'bg-gray-800/50 border border-gray-700/50 hover:border-gray-600/50'
                            : 'bg-[#FAF7F2] border border-gray-300 shadow-sm hover:shadow-md'
                        }`}
                      >
                        {/* 게시글 헤더 */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                              isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {post.author.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {post.author}
                              </span>
                              <span className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {formatDate(post.createdAt)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getCategoryColor(post.category)}`}>
                              {post.category}
                            </span>
                            {!post.isPublic && (
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                                isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                  비밀글
                                </span>
                              </span>
                            )}
                            {post.replyContent && post.replyPublic && (
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                                isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                              }`}>
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  답변완료
                                </span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 게시글 내용 */}
                        {showContent ? (
                          <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {displayPost.content}
                          </p>
                        ) : (
                          <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {viewingPostId === post.id ? (
                              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="password"
                                    value={viewPassword}
                                    onChange={(e) => setViewPassword(e.target.value)}
                                    placeholder="비밀번호 입력"
                                    className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                                      isDark
                                        ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500'
                                        : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400'
                                    }`}
                                    onKeyDown={(e) => e.key === 'Enter' && handleViewPrivate(post.id)}
                                  />
                                  <button
                                    onClick={() => handleViewPrivate(post.id)}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                      isDark
                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                        : 'bg-[#4A5D5D] hover:bg-[#3A4D4D] text-white'
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
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                      isDark ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                  >
                                    취소
                                  </button>
                                </div>
                                {viewError && (
                                  <p className={`text-xs mt-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
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
                                className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                                  isDark ? 'bg-gray-700/50 hover:bg-gray-700 text-gray-400' : 'bg-gray-50 hover:bg-gray-100 text-gray-500'
                                }`}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                비밀번호를 입력하면 내용을 볼 수 있습니다
                              </button>
                            )}
                          </div>
                        )}

                        {/* 답변 표시 - replyPublic이 true인 경우 (비밀글이어도 K열이 Y면 답변만 공개) */}
                        {displayPost.replyContent && displayPost.replyPublic && (
                          <div className={`mt-4 p-4 rounded-xl ${
                            isDark
                              ? 'bg-green-500/10 border border-green-500/20'
                              : 'bg-green-50 border border-green-200'
                          }`}>
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                isDark ? 'bg-green-500/20' : 'bg-green-100'
                              }`}>
                                <svg className={`w-3 h-3 ${isDark ? 'text-green-400' : 'text-green-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:hover:bg-gray-800'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:hover:bg-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  이전
                </button>
                <div className={`flex items-center gap-1 px-4 py-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{page}</span>
                  <span>/</span>
                  <span>{totalPages}</span>
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:hover:bg-gray-800'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:hover:bg-white'
                  }`}
                >
                  다음
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 방문자 통계 탭 */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            {/* 헤더 섹션 */}
            <div className="flex items-center justify-end -mt-2">
              <button
                onClick={fetchAnalytics}
                disabled={analyticsLoading}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                }`}
              >
                <svg className={`w-4 h-4 ${analyticsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                새로고침
              </button>
            </div>

            {analyticsLoading && !analyticsData ? (
              <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <svg className="animate-spin w-8 h-8 mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">통계 데이터를 불러오는 중...</span>
              </div>
            ) : analyticsError ? (
              <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">{analyticsError}</span>
                <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  GA_PROPERTY_ID 환경변수 설정이 필요합니다
                </p>
              </div>
            ) : analyticsData && (
              <>
                {/* 주요 지표 카드 - 6개 카드를 3x2 그리드로 */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {/* 1. 30분 접속자 */}
                  <div className={`rounded-xl p-3 ${
                    isDark ? 'bg-slate-900/40 border border-slate-700/60' : 'bg-white border border-gray-200 shadow-sm'
                  }`}>
                    <div className={`text-[10px] tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      30분 접속자
                    </div>
                    <div className={`text-xl font-semibold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {analyticsData.realtime.activeUsers.toLocaleString()}
                    </div>
                  </div>

                  {/* 2. 오늘 방문자 */}
                  <div className={`rounded-xl p-3 ${
                    isDark ? 'bg-slate-900/40 border border-slate-700/60' : 'bg-white border border-gray-200 shadow-sm'
                  }`}>
                    <div className={`text-[10px] tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      오늘 방문자
                    </div>
                    <div className={`text-xl font-semibold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {analyticsData.today.users.toLocaleString()}
                    </div>
                  </div>

                  {/* 3. 평균 체류시간 */}
                  <div className={`rounded-xl p-3 ${
                    isDark ? 'bg-slate-900/40 border border-slate-700/60' : 'bg-white border border-gray-200 shadow-sm'
                  }`}>
                    <div className={`text-[10px] tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      평균 체류시간
                    </div>
                    <div className={`text-xl font-semibold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {(() => {
                        const seconds = analyticsData.total.avgSessionDuration || 0;
                        const mins = Math.floor(seconds / 60);
                        const secs = Math.round(seconds % 60);
                        return `${mins}:${secs.toString().padStart(2, '0')}`;
                      })()}
                    </div>
                  </div>

                  {/* 4. 누적 방문자 */}
                  <div className={`rounded-xl p-3 ${
                    isDark ? 'bg-slate-900/40 border border-slate-700/60' : 'bg-white border border-gray-200 shadow-sm'
                  }`}>
                    <div className={`text-[10px] tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      누적 방문자
                    </div>
                    <div className={`text-xl font-semibold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {analyticsData.total.users.toLocaleString()}
                    </div>
                  </div>

                  {/* 5. 누적 세션 */}
                  <div className={`rounded-xl p-3 ${
                    isDark ? 'bg-slate-900/40 border border-slate-700/60' : 'bg-white border border-gray-200 shadow-sm'
                  }`}>
                    <div className={`text-[10px] tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      누적 세션
                    </div>
                    <div className={`text-xl font-semibold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {analyticsData.total.sessions.toLocaleString()}
                    </div>
                  </div>

                  {/* 6. 누적 페이지뷰 */}
                  <div className={`rounded-xl p-3 ${
                    isDark ? 'bg-slate-900/40 border border-slate-700/60' : 'bg-white border border-gray-200 shadow-sm'
                  }`}>
                    <div className={`text-[10px] tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      누적 페이지뷰
                    </div>
                    <div className={`text-xl font-semibold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {analyticsData.total.pageViews?.toLocaleString() || '0'}
                    </div>
                  </div>
                </div>

                {/* 최근 30일 추이 */}
                <div className={`rounded-2xl p-6 ${
                  isDark ? 'bg-slate-900/40 border border-slate-700/60' : 'bg-white border border-gray-200 shadow-sm'
                }`}>
                  <h3 className={`text-sm font-medium mb-4 ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                    최근 30일 평균 {Math.round(analyticsData.dailyTrend.reduce((sum, d) => sum + d.users, 0) / analyticsData.dailyTrend.length)}명 방문
                  </h3>

                  {analyticsData.dailyTrend.length > 0 ? (
                    <div className="space-y-2">
                      {/* 꺾은선 차트 */}
                      <div className="relative" style={{ height: '120px' }}>
                        {/* 최고/최저 방문자 라벨 및 마커 (HTML로 렌더링하여 왜곡 방지) */}
                        {(() => {
                          const data = analyticsData.dailyTrend;
                          const maxData = data.reduce((max, d) => d.users > max.users ? d : max, data[0]);
                          const minData = data.reduce((min, d) => d.users < min.users ? d : min, data[0]);
                          const maxIndex = data.findIndex(d => d === maxData);
                          const minIndex = data.findIndex(d => d === minData);
                          const maxDateStr = maxData.date;
                          const minDateStr = minData.date;
                          const maxFormattedDate = `${maxDateStr.slice(4, 6)}/${maxDateStr.slice(6, 8)}`;
                          const minFormattedDate = `${minDateStr.slice(4, 6)}/${minDateStr.slice(6, 8)}`;

                          // SVG와 동일한 계산 (SVG viewBox: 800x120, padding: top:25, right:10, bottom:10, left:10)
                          const svgWidth = 800;
                          const svgHeight = 120;
                          const padding = { top: 25, right: 10, bottom: 10, left: 10 };
                          const graphWidth = svgWidth - padding.left - padding.right; // 780
                          const graphHeight = svgHeight - padding.top - padding.bottom; // 85

                          const maxUsers = Math.max(...data.map(d => d.users));
                          const minUsers = Math.min(...data.map(d => d.users));
                          const range = maxUsers - minUsers || 1;

                          // X 위치: SVG padding 고려 (padding.left/svgWidth ~ (svgWidth-padding.right)/svgWidth)
                          const leftStart = (padding.left / svgWidth) * 100; // 1.25%
                          const leftEnd = ((svgWidth - padding.right) / svgWidth) * 100; // 98.75%
                          const leftRange = leftEnd - leftStart; // 97.5%

                          const maxLeftPercent = leftStart + (maxIndex / (data.length - 1)) * leftRange;
                          const minLeftPercent = leftStart + (minIndex / (data.length - 1)) * leftRange;

                          // Y 위치: SVG와 동일한 계산
                          const maxTopPx = padding.top + graphHeight - ((maxData.users - minUsers) / range) * graphHeight;
                          const minTopPx = padding.top + graphHeight - ((minData.users - minUsers) / range) * graphHeight;

                          const markerColor = isDark ? '#94a3b8' : '#6B7280';

                          return (
                            <>
                              {/* 최고 방문자 마커 (원형) */}
                              <div
                                className="absolute rounded-full z-10"
                                style={{
                                  left: `${maxLeftPercent}%`,
                                  top: `${maxTopPx}px`,
                                  width: '8px',
                                  height: '8px',
                                  backgroundColor: markerColor,
                                  transform: 'translate(-50%, -50%)',
                                }}
                              />
                              {/* 최고 방문자 라벨 */}
                              <div
                                className={`absolute text-[11px] font-medium whitespace-nowrap z-10 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}
                                style={{
                                  left: `${Math.min(Math.max(maxLeftPercent, 8), 92)}%`,
                                  top: `${maxTopPx - 16}px`,
                                  transform: 'translateX(-50%)',
                                }}
                              >
                                {maxFormattedDate} {maxData.users}명
                              </div>
                              {/* 최저 방문자 마커 (원형) */}
                              <div
                                className="absolute rounded-full z-10"
                                style={{
                                  left: `${minLeftPercent}%`,
                                  top: `${minTopPx}px`,
                                  width: '8px',
                                  height: '8px',
                                  backgroundColor: markerColor,
                                  transform: 'translate(-50%, -50%)',
                                }}
                              />
                              {/* 최저 방문자 라벨 */}
                              <div
                                className={`absolute text-[11px] font-medium whitespace-nowrap z-10 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}
                                style={{
                                  left: `${Math.min(Math.max(minLeftPercent, 8), 92)}%`,
                                  top: `${minTopPx + 8}px`,
                                  transform: 'translateX(-50%)',
                                }}
                              >
                                {minFormattedDate} {minData.users}명
                              </div>
                            </>
                          );
                        })()}
                        {(() => {
                          const data = analyticsData.dailyTrend;
                          const maxUsers = Math.max(...data.map(d => d.users), 1);
                          const minUsers = Math.min(...data.map(d => d.users));
                          const range = maxUsers - minUsers || 1;
                          const padding = { top: 25, right: 10, bottom: 10, left: 10 };
                          const svgWidth = 800;
                          const svgHeight = 120;
                          const graphWidth = svgWidth - padding.left - padding.right;
                          const graphHeight = svgHeight - padding.top - padding.bottom;

                          // SVG 포인트 계산
                          const points = data.map((day, index) => {
                            const x = padding.left + (index / (data.length - 1)) * graphWidth;
                            const y = padding.top + graphHeight - ((day.users - minUsers) / range) * graphHeight;
                            return { x, y, users: day.users, date: day.date };
                          });

                          // 폴리라인 포인트 문자열
                          const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

                          // 영역 채우기를 위한 path
                          const areaPath = `M ${padding.left},${svgHeight - padding.bottom} ` +
                            points.map(p => `L ${p.x},${p.y}`).join(' ') +
                            ` L ${svgWidth - padding.right},${svgHeight - padding.bottom} Z`;

                          const gradientId = isDark ? 'areaGradientDark' : 'areaGradientLight';
                          // 페이지 테마에 맞는 색상 (라이트: 따뜻한 회색-틸, 다크: 슬레이트)
                          const lineColor = isDark ? '#94a3b8' : '#6B7280';
                          const gradientStart = isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(107, 114, 128, 0.15)';
                          const gradientEnd = isDark ? 'rgba(148, 163, 184, 0)' : 'rgba(107, 114, 128, 0)';

                          return (
                            <svg className="w-full h-full" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
                              <defs>
                                <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                                  <stop offset="0%" stopColor={gradientStart} />
                                  <stop offset="100%" stopColor={gradientEnd} />
                                </linearGradient>
                              </defs>

                              {/* 영역 채우기 (그라데이션) */}
                              <path
                                d={areaPath}
                                fill={`url(#${gradientId})`}
                              />

                              {/* 꺾은선 */}
                              <polyline
                                points={polylinePoints}
                                fill="none"
                                stroke={lineColor}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />

                              {/* 호버용 투명 원 (툴팁 표시) */}
                              {points.map((point, index) => {
                                const dateStr = point.date;
                                const formattedDate = `${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`;
                                return (
                                  <g key={index}>
                                    <circle
                                      cx={point.x}
                                      cy={point.y}
                                      r="12"
                                      fill="rgba(0,0,0,0.001)"
                                      className="cursor-pointer"
                                      style={{ pointerEvents: 'all' }}
                                    />
                                    <title>{formattedDate}: {point.users}명</title>
                                  </g>
                                );
                              })}

                            </svg>
                          );
                        })()}
                      </div>

                      {/* X축 라벨 */}
                      <div className={`flex justify-between text-xs px-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <span>30일 전</span>
                        <span>오늘</span>
                      </div>
                    </div>
                  ) : (
                    <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      <span className="text-sm">데이터가 없습니다</span>
                    </div>
                  )}
                </div>

                {/* 3개 카드 영역: 지역별, 디바이스별, 페이지별 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* 지역별 방문자 */}
                  <div className={`rounded-2xl p-4 ${
                    isDark ? 'bg-slate-900/40 border border-slate-700/60' : 'bg-white border border-gray-200 shadow-sm'
                  }`}>
                    <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                      지역별 방문자 <span className={`text-xs font-normal ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>(최근 30일)</span>
                    </h3>
                    {analyticsData.regionStats && analyticsData.regionStats.length > 0 ? (
                      <div className="space-y-2">
                        {analyticsData.regionStats.map((region, index) => {
                          const maxUsers = analyticsData.regionStats[0]?.users || 1;
                          const percentage = Math.round((region.users / maxUsers) * 100);
                          return (
                            <div key={index} className="flex items-center gap-2">
                              <span className={`text-xs w-16 truncate ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                                {getRegionLabel(region.region)}
                              </span>
                              <div className="flex-1 h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-slate-700">
                                <div
                                  className={`h-full rounded-full ${isDark ? 'bg-slate-500' : 'bg-gray-500'}`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className={`text-xs w-8 text-right ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                                {region.users}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={`text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <span className="text-xs">데이터 없음</span>
                      </div>
                    )}
                  </div>

                  {/* 디바이스별 비율 - 단일 세로 막대 3등분 */}
                  <div className={`rounded-2xl p-4 ${
                    isDark ? 'bg-slate-900/40 border border-slate-700/60' : 'bg-white border border-gray-200 shadow-sm'
                  }`}>
                    <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                      디바이스 비율 <span className={`text-xs font-normal ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>(최근 30일)</span>
                    </h3>
                    {analyticsData.deviceRatio && analyticsData.deviceRatio.total > 0 ? (
                      <div className="flex items-center gap-3">
                        {/* 단일 세로 막대 (3등분) */}
                        <div className="w-8 h-24 rounded-lg overflow-hidden flex flex-col-reverse bg-gray-200 dark:bg-slate-700">
                          {(() => {
                            const { mobile, desktop, tablet, total } = analyticsData.deviceRatio;
                            const mobilePercent = (mobile / total) * 100;
                            const desktopPercent = (desktop / total) * 100;
                            const tabletPercent = (tablet / total) * 100;
                            return (
                              <>
                                {mobilePercent > 0 && (
                                  <div className={`w-full ${isDark ? 'bg-blue-500' : 'bg-blue-500'}`} style={{ height: `${mobilePercent}%` }} />
                                )}
                                {desktopPercent > 0 && (
                                  <div className={`w-full ${isDark ? 'bg-slate-500' : 'bg-gray-500'}`} style={{ height: `${desktopPercent}%` }} />
                                )}
                                {tabletPercent > 0 && (
                                  <div className={`w-full ${isDark ? 'bg-emerald-500' : 'bg-emerald-500'}`} style={{ height: `${tabletPercent}%` }} />
                                )}
                              </>
                            );
                          })()}
                        </div>
                        {/* 범례 */}
                        <div className="flex flex-col gap-1.5 text-xs">
                          {(() => {
                            const { mobile, desktop, tablet, total } = analyticsData.deviceRatio;
                            const items = [
                              { label: '모바일', value: mobile, color: isDark ? 'bg-blue-500' : 'bg-blue-500' },
                              { label: '데스크탑', value: desktop, color: isDark ? 'bg-slate-500' : 'bg-gray-500' },
                              { label: '태블릿', value: tablet, color: isDark ? 'bg-emerald-500' : 'bg-emerald-500' },
                            ];
                            return items.map((item, i) => {
                              const percent = Math.round((item.value / total) * 100);
                              if (percent === 0) return null;
                              return (
                                <div key={i} className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-sm ${item.color}`} />
                                  <span className={isDark ? 'text-slate-400' : 'text-gray-600'}>{item.label}</span>
                                  <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>{percent}%</span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className={`text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <span className="text-xs">데이터 없음</span>
                      </div>
                    )}
                  </div>

                  {/* 페이지별 방문자 - 2열 너비 */}
                  <div className={`md:col-span-2 rounded-2xl p-4 ${
                    isDark ? 'bg-slate-900/40 border border-slate-700/60' : 'bg-white border border-gray-200 shadow-sm'
                  }`}>
                    <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                      페이지별 방문 <span className={`text-xs font-normal ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>(최근 30일)</span>
                    </h3>
                    {analyticsData.topPages && analyticsData.topPages.length > 0 ? (
                      <div className="space-y-1">
                        {/* 테이블 헤더 */}
                        <div className={`flex items-center text-[10px] mb-2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                          <span className="flex-1">페이지</span>
                          <span className="w-16 text-right">조회수</span>
                          <span className="w-14 text-right">사용자</span>
                          <span className="w-12 text-right">평균</span>
                        </div>
                        {analyticsData.topPages.map((page, index) => {
                          const avgTime = page.avgEngagementTime || 0;
                          const mins = Math.floor(avgTime / 60);
                          const secs = Math.round(avgTime % 60);
                          const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
                          return (
                            <div key={index} className="flex items-center py-0.5">
                              <span className={`text-xs flex-1 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                                {page.name}
                              </span>
                              <span className={`text-xs w-16 text-right tabular-nums font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                                {page.pageViews.toLocaleString()}
                              </span>
                              <span className={`text-xs w-14 text-right tabular-nums ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                                {page.users.toLocaleString()}
                              </span>
                              <span className={`text-xs w-12 text-right tabular-nums ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                                {timeStr}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={`text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <span className="text-xs">데이터 없음</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 추가 정보 */}
                <div className={`text-xs text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <p className="mt-1">DGER 방문 집계 시작일: {analyticsData.total.since}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* 병원명 약어 탭 */}
        {activeTab === 'abbrev' && (
          <HospitalNamesContent embedded />
        )}

      </main>
    </div>
  );
}
