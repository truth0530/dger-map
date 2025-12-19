'use client';

/**
 * 피드백 및 릴리즈 노트 페이지
 * 원본: dger-api/public/feed.html
 */

import { useState, useEffect } from 'react';
import RatingWidget from '@/components/RatingWidget';

interface ReleaseNote {
  date: string;
  content: string;
}

const RELEASE_NOTES: ReleaseNote[] = [
  { date: '2025.12.19', content: 'DGEMS-map: 지도 기반 대시보드 통합, 응급 메시지 페이지, 피드백 페이지, 평점 시스템 추가' },
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
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">DGER Release & Feedback</h1>
              <p className="text-sm text-gray-500 mt-1">대구맞춤형 응급실 병상정보 시스템</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://forms.gle/DbxJDroieoZvxKeU9"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
              >
                피드백 제출
              </a>
              <a
                href="https://dger.netlify.app"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded hover:bg-gray-200 transition-colors border"
              >
                구버전 (dger.netlify.app)
              </a>
            </div>
          </div>
        </div>

        {/* 페이지 평점 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">페이지 평점</h2>
          <div className="space-y-4">
            <RatingWidget page="map" label="지도 대시보드" />
            <RatingWidget page="bed" label="병상 현황" />
            <RatingWidget page="severe" label="중증질환 현황" />
            <RatingWidget page="messages" label="응급 메시지" />
          </div>
        </div>

        {/* 소개 */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            안녕하세요, 중앙응급의료센터(대구응급의료지원센터) 이광성입니다.
          </h2>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              2021년 11월 26일부터 대구지역 구급대원을 위해 DGER을 제작하여 배포하였고,
              인천, 광주, 세종, 경남지역으로 확대하여 시범사업을 진행하였으며,
              2022년 3월 16일부터 내 손안의 응급실이 복지부를 통해 정식 출시되었습니다.
            </p>
            <p>
              현재는 내손안의 응급실의 보조적 수단으로 서버를 유지중이며,
              향후 개선방향을 제시하기 위해 지속적인 피드백을 받도록 하겠습니다.
            </p>
          </div>
        </div>

        {/* 릴리즈 노트 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-3 border-b">
            Release Notes
          </h2>
          <ul className="space-y-2">
            {RELEASE_NOTES.map((note, index) => (
              <li
                key={index}
                className="flex items-baseline py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-xs text-gray-500 font-mono w-24 flex-shrink-0">
                  {note.date}
                </span>
                <span className="text-sm text-gray-700">
                  {note.content}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* 관련 링크 */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-3 border-b">
            관련 링크
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <a
              href="https://www.e-gen.or.kr/egen/search_hospital.do"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-800">응급의료포털</p>
                <p className="text-xs text-gray-500">응급실 검색</p>
              </div>
            </a>
            <a
              href="https://e-gen.or.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-800">내 손안의 응급실</p>
                <p className="text-xs text-gray-500">복지부 공식 서비스</p>
              </div>
            </a>
            <a
              href="https://www.data.go.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-800">공공데이터 포털</p>
                <p className="text-xs text-gray-500">응급의료정보 API</p>
              </div>
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-800">GitHub</p>
                <p className="text-xs text-gray-500">소스 코드</p>
              </div>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
