'use client';

/**
 * 중증응급질환 수용가능 현황 페이지
 * 원본: dger-api/public/27severe-react2.html
 *
 * dger-api와 동일한 구조, Next.js에 맞게 변환
 */

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/lib/contexts/ThemeContext';

// 중증질환 코드 목록 (dger-api와 동일)
const SEVERE_CODES = [
  { qn: '1',  label: '[재관류중재술] 심근경색', field: 'MKioskTy1' },
  { qn: '2',  label: '[재관류중재술] 뇌경색', field: 'MKioskTy2' },
  { qn: '3',  label: '[뇌출혈수술] 거미막하출혈', field: 'MKioskTy3' },
  { qn: '4',  label: '[뇌출혈수술] 거미막하출혈 외', field: 'MKioskTy4' },
  { qn: '5',  label: '[대동맥응급] 흉부', field: 'MKioskTy5' },
  { qn: '6',  label: '[대동맥응급] 복부', field: 'MKioskTy6' },
  { qn: '7',  label: '[담낭담관질환] 담낭질환', field: 'MKioskTy7' },
  { qn: '8',  label: '[담낭담관질환] 담도포함질환', field: 'MKioskTy8' },
  { qn: '9',  label: '[복부응급수술] 비외상', field: 'MKioskTy9' },
  { qn: '10', label: '[장중첩/폐색] 영유아', field: 'MKioskTy10' },
  { qn: '11', label: '[응급내시경] 성인 위장관', field: 'MKioskTy11' },
  { qn: '12', label: '[응급내시경] 영유아 위장관', field: 'MKioskTy12' },
  { qn: '13', label: '[응급내시경] 성인 기관지', field: 'MKioskTy13' },
  { qn: '14', label: '[응급내시경] 영유아 기관지', field: 'MKioskTy14' },
  { qn: '15', label: '[저체중출생아] 집중치료', field: 'MKioskTy15' },
  { qn: '16', label: '[산부인과응급] 분만', field: 'MKioskTy16' },
  { qn: '17', label: '[산부인과응급] 산과수술', field: 'MKioskTy17' },
  { qn: '18', label: '[산부인과응급] 부인과수술', field: 'MKioskTy18' },
  { qn: '19', label: '[중증화상] 전문치료', field: 'MKioskTy19' },
  { qn: '20', label: '[사지접합] 수족지접합', field: 'MKioskTy20' },
  { qn: '21', label: '[사지접합] 수족지접합 외', field: 'MKioskTy21' },
  { qn: '22', label: '[응급투석] HD', field: 'MKioskTy22' },
  { qn: '23', label: '[응급투석] CRRT', field: 'MKioskTy23' },
  { qn: '24', label: '[정신과적응급] 폐쇄병동입원', field: 'MKioskTy24' },
  { qn: '25', label: '[안과적수술] 응급', field: 'MKioskTy25' },
  { qn: '26', label: '[영상의학혈관중재] 성인', field: 'MKioskTy26' },
  { qn: '27', label: '[영상의학혈관중재] 영유아', field: 'MKioskTy27' }
];

interface DiseaseStats {
  name: string;
  available: number;
  unavailable: number;
  unknown: number;
  rate: number;
}

export default function SeverePage() {
  const { isDark } = useTheme();
  const [selectedRegion, setSelectedRegion] = useState('대구');
  const [diseaseStats, setDiseaseStats] = useState<Record<string, DiseaseStats>>({});
  const [loading, setLoading] = useState(false);

  // 질환 통계 로드 (dger-api와 동일)
  const loadDiseaseStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        STAGE1: selectedRegion,
        numOfRows: '1000',
        pageNo: '1'
      });

      const response = await fetch(`/api/severe-diseases?${params}`);
      if (!response.ok) throw new Error('통계 로드 실패');

      const xml = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const items = doc.querySelectorAll('item');

      const stats: Record<string, DiseaseStats> = {};
      SEVERE_CODES.forEach(disease => {
        stats[disease.qn] = {
          name: disease.label,
          available: 0,
          unavailable: 0,
          unknown: 0,
          rate: 0
        };
      });

      Array.from(items).forEach(item => {
        SEVERE_CODES.forEach(disease => {
          const fieldValue = item.querySelector(disease.field)?.textContent || '';
          const yn = fieldValue?.trim();

          if (yn === 'Y') {
            stats[disease.qn].available++;
          } else if (yn === 'N' || yn === '불가능') {
            stats[disease.qn].unavailable++;
          } else {
            stats[disease.qn].unknown++;
          }
        });
      });

      // 수용가능률 계산
      Object.values(stats).forEach(stat => {
        const total = stat.available + stat.unavailable;
        stat.rate = total > 0 ? Math.round((stat.available / total) * 100) : 0;
      });

      setDiseaseStats(stats);
    } catch (error) {
      console.error('통계 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedRegion]);

  useEffect(() => {
    loadDiseaseStats();
  }, [loadDiseaseStats]);

  // 렌더링 (dger-api와 동일한 스타일)
  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className="flex justify-center items-center min-h-[400px]">
          <div className={`w-10 h-10 border-4 ${isDark ? 'border-gray-700 border-t-blue-500' : 'border-gray-200 border-t-[#0a3a82]'} rounded-full animate-spin`}></div>
        </div>
      </div>
    );
  }

  const totalHospitals = Object.values(diseaseStats)[0]
    ? Object.values(diseaseStats)[0].available +
      Object.values(diseaseStats)[0].unavailable +
      Object.values(diseaseStats)[0].unknown
    : 0;

  const avgRate = Object.values(diseaseStats).length > 0
    ? Math.round(
        Object.values(diseaseStats).reduce((sum, stat) => sum + stat.rate, 0) /
        Object.values(diseaseStats).length
      )
    : 0;

  const bestDisease = Object.values(diseaseStats).reduce(
    (max, stat) => (stat.rate > (max?.rate || 0) ? stat : max),
    { name: '-', rate: 0 } as DiseaseStats
  );

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <main className="flex-1 p-4 max-w-[1800px] mx-auto w-full">
        {/* 지역 선택 - dger-api와 동일한 스타일 */}
        <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-2 mb-4 shadow-sm flex justify-center items-center gap-2`}>
          <select
            className={`px-2.5 border-2 rounded text-xs cursor-pointer transition-colors ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white hover:border-gray-500 focus:border-blue-500'
                : 'bg-white border-gray-300 hover:border-gray-400 focus:border-[#0a3a82]'
            } focus:outline-none`}
            style={{ height: '32px', lineHeight: '32px' }}
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
          >
            <option value="대구">대구</option>
            <option value="서울">서울</option>
            <option value="부산">부산</option>
            <option value="인천">인천</option>
            <option value="광주">광주</option>
            <option value="대전">대전</option>
            <option value="울산">울산</option>
            <option value="세종">세종</option>
            <option value="경기">경기</option>
            <option value="강원">강원</option>
            <option value="충북">충북</option>
            <option value="충남">충남</option>
            <option value="전북">전북</option>
            <option value="전남">전남</option>
            <option value="경북">경북</option>
            <option value="경남">경남</option>
            <option value="제주">제주</option>
          </select>
        </div>

        {/* 대시보드 */}
        <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl p-6 shadow-lg border`}>
          <div className={`flex justify-between items-center mb-6 pb-4 border-b-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
              {selectedRegion} 전체 중증질환 현황
            </h2>
          </div>

          {/* 요약 섹션 */}
          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 p-4 ${isDark ? 'bg-gray-900' : 'bg-gray-50'} rounded-lg`}>
            <div className={`text-center p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border`}>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>총 병원 수</div>
              <div className={`text-3xl font-bold ${isDark ? 'text-blue-400' : 'text-[#0a3a82]'}`}>{totalHospitals}</div>
            </div>
            <div className={`text-center p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border`}>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>평균 수용가능률</div>
              <div className={`text-3xl font-bold ${isDark ? 'text-blue-400' : 'text-[#0a3a82]'}`}>{avgRate}%</div>
            </div>
            <div className={`text-center p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border`}>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>최고 수용가능 질환</div>
              <div className={`text-base font-bold ${isDark ? 'text-blue-400' : 'text-[#0a3a82]'}`}>{bestDisease.name}</div>
            </div>
          </div>

          {/* 질환 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Object.entries(diseaseStats).map(([qn, stat]) => (
              <div
                key={qn}
                className={`${isDark ? 'bg-gray-900 border-gray-700 hover:bg-gray-800' : 'bg-white border-gray-200 hover:shadow-lg'} border rounded-lg p-4 cursor-pointer transition-all hover:-translate-y-0.5`}
              >
                <div className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'} mb-4 pb-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} text-sm`}>
                  {qn}. {stat.name}
                </div>
                <div className="flex justify-around mb-4">
                  <div className="text-center flex-1">
                    <span className={`block text-2xl font-bold mb-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                      {stat.available}
                    </span>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>수용가능</span>
                  </div>
                  <div className="text-center flex-1">
                    <span className={`block text-2xl font-bold mb-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                      {stat.unavailable}
                    </span>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>불가</span>
                  </div>
                  <div className="text-center flex-1">
                    <span className={`block text-2xl font-bold mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {stat.unknown}
                    </span>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>미참여</span>
                  </div>
                </div>
                <div className={`text-center p-2 ${isDark ? 'bg-gray-800' : 'bg-gray-50'} rounded-md text-sm`}>
                  수용가능률:{' '}
                  <strong
                    style={{
                      color:
                        stat.rate >= 50
                          ? isDark ? '#4ade80' : '#059669'
                          : stat.rate >= 20
                          ? isDark ? '#fbbf24' : '#d97706'
                          : isDark ? '#f87171' : '#dc2626'
                    }}
                  >
                    {stat.rate}%
                  </strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
