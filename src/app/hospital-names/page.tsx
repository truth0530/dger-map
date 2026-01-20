'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { HOSPITAL_NAME_MAPPING } from '@/lib/utils/hospitalUtils';
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

// hosp_list.json 파싱 함수
function parseHospitalList(data: Record<string, string>[]): Map<string, string> {
  const nameToRegion = new Map<string, string>();

  // 첫 2개 행은 메타/헤더
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    const name = row['__EMPTY'];
    const region = row['__EMPTY_4'];
    if (name && region) {
      nameToRegion.set(name, region);
    }
  }

  return nameToRegion;
}

// 매핑을 지역별로 분류 (실제 병원 데이터 기반)
function categorizeMapping(
  mapping: Record<string, string>,
  hospitalRegionMap: Map<string, string>
) {
  const categorized: Record<string, { original: string; shortened: string }[]> = {};
  const uncategorized: { original: string; shortened: string }[] = [];

  // 초기화
  REGION_GROUPS.forEach(group => {
    categorized[group.id] = [];
  });

  Object.entries(mapping).forEach(([original, shortened]) => {
    // 병원 데이터에서 지역 찾기
    const region = hospitalRegionMap.get(original);

    if (region) {
      // 지역명으로 그룹 ID 찾기
      const group = REGION_GROUPS.find(g => g.fullName === region);
      if (group) {
        categorized[group.id].push({ original, shortened });
        return;
      }
    }

    uncategorized.push({ original, shortened });
  });

  return { categorized, uncategorized };
}

export default function HospitalNamesPage() {
  const { isDark } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set(REGION_GROUPS.map(g => g.id)));
  const [hospitalRegionMap, setHospitalRegionMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // 병원 목록 데이터 로드
  useEffect(() => {
    fetch('/data/hosp_list.json')
      .then(res => res.json())
      .then(data => {
        const map = parseHospitalList(data);
        setHospitalRegionMap(map);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load hospital list:', err);
        setLoading(false);
      });
  }, []);

  const { categorized, uncategorized } = useMemo(
    () => categorizeMapping(HOSPITAL_NAME_MAPPING, hospitalRegionMap),
    [hospitalRegionMap]
  );

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

  const expandAll = () => setExpandedRegions(new Set(REGION_GROUPS.map(g => g.id)));
  const collapseAll = () => setExpandedRegions(new Set());

  // 검색 필터링
  const filteredCategorized = useMemo(() => {
    if (!searchTerm) return categorized;
    const term = searchTerm.toLowerCase();
    const filtered: typeof categorized = {};
    Object.entries(categorized).forEach(([regionId, items]) => {
      filtered[regionId] = items.filter(
        item => item.original.toLowerCase().includes(term) || item.shortened.toLowerCase().includes(term)
      );
    });
    return filtered;
  }, [categorized, searchTerm]);

  const totalCount = Object.values(HOSPITAL_NAME_MAPPING).length;
  const filteredCount = Object.values(filteredCategorized).reduce((sum, items) => sum + items.length, 0);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* 컴팩트 헤더 - 한 줄 */}
      <header className={`sticky top-0 z-10 ${isDark ? 'bg-gray-800' : 'bg-white'} border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="max-w-4xl mx-auto px-2 py-1.5 flex items-center gap-1.5 text-xs">
          <Link href="/" className={`font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>←</Link>
          <span className="font-semibold">약어</span>
          <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{totalCount}</span>
          <input
            type="text"
            placeholder="검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`flex-1 min-w-[50px] max-w-[80px] sm:max-w-[150px] px-1.5 py-0.5 rounded border text-xs ${
              isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
            }`}
          />
          <button onClick={expandAll} className={`px-1.5 py-0.5 rounded border ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>+</button>
          <button onClick={collapseAll} className={`px-1.5 py-0.5 rounded border ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>−</button>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-4xl mx-auto px-1 sm:px-4 py-1 sm:py-4">

        {/* 로딩 상태 */}
        {loading && (
          <div className="text-center py-8 text-sm">
            <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>로딩 중...</span>
          </div>
        )}

        {/* 지역별 목록 */}
        {!loading && <div className="space-y-4">
          {REGION_GROUPS.map(group => {
            const items = filteredCategorized[group.id] || [];
            if (items.length === 0 && searchTerm) return null;

            const isExpanded = expandedRegions.has(group.id);

            return (
              <div
                key={group.id}
                className={`rounded-lg overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}
              >
                <button
                  onClick={() => toggleRegion(group.id)}
                  className={`w-full px-4 py-3 flex items-center justify-between ${
                    isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold">{group.name}</span>
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      ({items.length}개)
                    </span>
                  </div>
                  <span className="text-xl">{isExpanded ? '−' : '+'}</span>
                </button>

                {isExpanded && items.length > 0 && (
                  <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <table className="w-full text-xs sm:text-sm">
                      <thead className={isDark ? 'bg-gray-750' : 'bg-gray-50'}>
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">원본</th>
                          <th className="px-2 py-1.5 text-left font-medium">약어</th>
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
                            <td className={`px-2 py-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                              <span className="block truncate max-w-[180px] sm:max-w-none">{original}</span>
                            </td>
                            <td className="px-2 py-1 font-medium whitespace-nowrap">
                              {shortened}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {isExpanded && items.length === 0 && (
                  <div className={`px-4 py-6 text-center border-t ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
                    검색 결과 없음
                  </div>
                )}
              </div>
            );
          })}

          {/* 미분류 */}
          {uncategorized.length > 0 && (
            <div className={`rounded-lg overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
              <div className="px-2 py-2">
                <span className="text-sm font-semibold">기타</span>
                <span className={`ml-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  ({uncategorized.length})
                </span>
              </div>
              <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <table className="w-full text-xs sm:text-sm">
                  <tbody>
                    {uncategorized.map(({ original, shortened }, idx) => (
                      <tr
                        key={original}
                        className={isDark
                          ? idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'
                          : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }
                      >
                        <td className={`px-2 py-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          <span className="block truncate max-w-[180px] sm:max-w-none">{original}</span>
                        </td>
                        <td className="px-2 py-1 font-medium whitespace-nowrap">{shortened}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>}
      </main>
    </div>
  );
}
