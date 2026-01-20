'use client';

import { useState, useEffect } from 'react';
import { shortenHospitalName } from '@/lib/utils/hospitalUtils';
import { useTheme } from '@/lib/contexts/ThemeContext';

// 시도별 그룹 정의
const REGION_GROUPS = [
  { id: 'seoul', name: '서울', fullName: '서울특별시' },
  { id: 'busan', name: '부산', fullName: '부산광역시' },
  { id: 'daegu', name: '대구', fullName: '대구광역시' },
  { id: 'incheon', name: '인천', fullName: '인천광역시' },
  { id: 'gwangju', name: '광주', fullName: '광주광역시' },
  { id: 'daejeon', name: '대전', fullName: '대전광역시' },
  { id: 'ulsan', name: '울산', fullName: '울산광역시' },
  { id: 'sejong', name: '세종', fullName: '세종특별자치시' },
  { id: 'gyeonggi', name: '경기', fullName: '경기도' },
  { id: 'gangwon', name: '강원', fullName: '강원특별자치도' },
  { id: 'chungbuk', name: '충북', fullName: '충청북도' },
  { id: 'chungnam', name: '충남', fullName: '충청남도' },
  { id: 'jeonbuk', name: '전북', fullName: '전북특별자치도' },
  { id: 'jeonnam', name: '전남', fullName: '전라남도' },
  { id: 'gyeongbuk', name: '경북', fullName: '경상북도' },
  { id: 'gyeongnam', name: '경남', fullName: '경상남도' },
  { id: 'jeju', name: '제주', fullName: '제주특별자치도' },
];

// hosp_list.json 병원 데이터 인터페이스
interface HospitalListRow {
  '__EMPTY'?: string;      // 기관명
  '__EMPTY_3'?: string;    // 의료기관분류 (권역/지역센터/기관)
  '__EMPTY_4'?: string;    // 지역
  [key: string]: string | number | undefined;
}

// hosp_list.json에서 병원 목록 파싱 (지역별 분류 포함)
function parseHospitalList(data: HospitalListRow[]): {
  categorized: Record<string, { original: string; shortened: string; category: string }[]>;
} {
  const categorized: Record<string, { original: string; shortened: string; category: string }[]> = {};

  // 초기화
  REGION_GROUPS.forEach(group => {
    categorized[group.id] = [];
  });

  // 첫 2개 행은 메타/헤더
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    const name = row['__EMPTY'];
    const region = row['__EMPTY_4'];
    const category = row['__EMPTY_3'] || '';

    if (name && region) {
      // 지역명으로 그룹 ID 찾기
      const group = REGION_GROUPS.find(g => g.fullName === region);
      if (group) {
        categorized[group.id].push({
          original: name,
          shortened: shortenHospitalName(name),
          category: category as string
        });
      }
    }
  }

  // 각 지역별로 센터급 우선 정렬
  const categoryOrder: Record<string, number> = {
    '권역응급의료센터': 0,
    '지역응급의료센터': 1,
    '전문응급의료센터': 2,
    '지역응급의료기관': 3,
  };

  Object.keys(categorized).forEach(regionId => {
    categorized[regionId].sort((a, b) => {
      const orderA = categoryOrder[a.category] ?? 99;
      const orderB = categoryOrder[b.category] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.original.localeCompare(b.original, 'ko');
    });
  });

  return { categorized };
}

interface HospitalNamesContentProps {
  embedded?: boolean;  // 피드백 페이지에 임베드될 때 true
}

export default function HospitalNamesContent({ embedded = false }: HospitalNamesContentProps) {
  const { isDark } = useTheme();
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [categorized, setCategorized] = useState<Record<string, { original: string; shortened: string; category: string }[]>>({});
  const [loading, setLoading] = useState(true);

  // 병원 목록 데이터 로드
  useEffect(() => {
    fetch('/data/hosp_list.json')
      .then(res => res.json())
      .then(data => {
        const { categorized: parsed } = parseHospitalList(data);
        setCategorized(parsed);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load hospital list:', err);
        setLoading(false);
      });
  }, []);

  const toggleRegion = (regionId: string) => {
    setExpandedRegions(prev => {
      const next = new Set(prev);
      if (next.has(regionId)) {
        next.delete(regionId);
      } else {
        next.add(regionId);
      }
      return next;
    });
  };

  return (
    <div className={embedded ? '' : `min-h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* 본문 */}
      <div className={embedded ? '' : 'max-w-4xl mx-auto px-1 sm:px-4 py-1 sm:py-4'}>

        {/* 로딩 상태 */}
        {loading && (
          <div className="text-center py-8 text-sm">
            <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>로딩 중...</span>
          </div>
        )}

        {/* 지역별 목록 */}
        {!loading && <div className="space-y-1">
          {REGION_GROUPS.map(group => {
            const items = categorized[group.id] || [];
            if (items.length === 0) return null;

            const isExpanded = expandedRegions.has(group.id);

            return (
              <div
                key={group.id}
                className={`rounded overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
              >
                <button
                  onClick={() => toggleRegion(group.id)}
                  className={`w-full px-2 py-1 flex items-center gap-1.5 text-sm ${
                    isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`text-sm transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                  <span className="font-medium">{group.name}</span>
                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    ({items.length})
                  </span>
                </button>

                {isExpanded && items.length > 0 && (
                  <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <table className="w-full text-xs sm:text-sm">
                      <thead className={isDark ? 'bg-gray-750' : 'bg-gray-50'}>
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">약어</th>
                          <th className="px-2 py-1.5 text-left font-medium">원본</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(({ original, shortened }, idx) => (
                          <tr
                            key={original}
                            className={isDark
                              ? idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'
                              : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                            }
                          >
                            <td className="px-2 py-1 font-medium whitespace-nowrap">
                              {shortened}
                            </td>
                            <td className={`px-2 py-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                              {original}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {isExpanded && items.length === 0 && (
                  <div className={`px-2 py-2 text-center text-xs border-t ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
                    데이터 없음
                  </div>
                )}
              </div>
            );
          })}
        </div>}
      </div>
    </div>
  );
}
