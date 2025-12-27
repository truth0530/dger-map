'use client';

/**
 * 피드백 및 릴리즈 노트 페이지
 * 원본: dger-api/public/feed.html
 * 완전히 동일하게 구현 (다크모드 지원)
 */

import { useTheme } from '@/lib/contexts/ThemeContext';

interface ReleaseNote {
  date: string;
  content: string;
}

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

export default function FeedbackPage() {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-[#fafbfc]'}`}>
      <main className={`max-w-[800px] mx-auto my-6 ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-md shadow-sm p-8`}
        style={{ margin: '1.5rem auto' }}>

        {/* 페이지 헤더 */}
        <div className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} pb-6 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
          <div>
            <h1 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`} style={{ letterSpacing: '-0.3px' }}>
              DGER Release & Feedback
            </h1>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              대구맞춤형 응급실 병상정보 시스템
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <a
              href="https://forms.gle/DbxJDroieoZvxKeU9"
              target="_blank"
              rel="noopener noreferrer"
              className={`px-5 py-2.5 text-sm font-medium rounded transition-colors ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600'
                  : 'bg-[#1976d2] hover:bg-[#1565c0] text-white'
              }`}
            >
              피드백 제출
            </a>
            <a
              href="https://dger.netlify.app"
              target="_blank"
              rel="noopener noreferrer"
              className={`px-5 py-2.5 text-sm font-medium rounded border transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
              }`}
            >
              구버전
            </a>
          </div>
        </div>

        {/* 소개 섹션 */}
        <div className={`rounded p-5 mb-6 border ${
          isDark
            ? 'bg-gray-700/50 border-gray-600'
            : 'bg-gray-50 border-gray-200'
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
      </main>
    </div>
  );
}
