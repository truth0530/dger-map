'use client';

/**
 * 중증응급질환 수용가능 현황 페이지
 * 원본: dger-api/public/27severe.html
 * 완전히 동일하게 구현
 */

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/lib/contexts/ThemeContext';
import { SEVERE_CONSTRAINTS } from '@/lib/constants/severeDefinitions';
import { shortenHospitalName } from '@/lib/utils/hospitalUtils';

// 중증질환 코드 목록 (dger-api와 동일)
const SEVERE_CODES = [
  { qn: 1,  label: '[재관류중재술] 심근경색', field: 'MKioskTy1' },
  { qn: 2,  label: '[재관류중재술] 뇌경색', field: 'MKioskTy2' },
  { qn: 3,  label: '[뇌출혈수술] 거미막하출혈', field: 'MKioskTy3' },
  { qn: 4,  label: '[뇌출혈수술] 거미막하출혈 외', field: 'MKioskTy4' },
  { qn: 5,  label: '[대동맥응급] 흉부', field: 'MKioskTy5' },
  { qn: 6,  label: '[대동맥응급] 복부', field: 'MKioskTy6' },
  { qn: 7,  label: '[담낭담관질환] 담낭질환', field: 'MKioskTy7' },
  { qn: 8,  label: '[담낭담관질환] 담도포함질환', field: 'MKioskTy8' },
  { qn: 9,  label: '[복부응급수술] 비외상', field: 'MKioskTy9' },
  { qn: 10, label: '[장중첩/폐색] 영유아', field: 'MKioskTy10' },
  { qn: 11, label: '[응급내시경] 성인 위장관', field: 'MKioskTy11' },
  { qn: 12, label: '[응급내시경] 영유아 위장관', field: 'MKioskTy12' },
  { qn: 13, label: '[응급내시경] 성인 기관지', field: 'MKioskTy13' },
  { qn: 14, label: '[응급내시경] 영유아 기관지', field: 'MKioskTy14' },
  { qn: 15, label: '[저체중출생아] 집중치료', field: 'MKioskTy15' },
  { qn: 16, label: '[산부인과응급] 분만', field: 'MKioskTy16' },
  { qn: 17, label: '[산부인과응급] 산과수술', field: 'MKioskTy17' },
  { qn: 18, label: '[산부인과응급] 부인과수술', field: 'MKioskTy18' },
  { qn: 19, label: '[중증화상] 전문치료', field: 'MKioskTy19' },
  { qn: 20, label: '[사지접합] 수족지접합', field: 'MKioskTy20' },
  { qn: 21, label: '[사지접합] 수족지접합 외', field: 'MKioskTy21' },
  { qn: 22, label: '[응급투석] HD', field: 'MKioskTy22' },
  { qn: 23, label: '[응급투석] CRRT', field: 'MKioskTy23' },
  { qn: 24, label: '[정신과적응급] 폐쇄병동입원', field: 'MKioskTy24' },
  { qn: 25, label: '[안과적수술] 응급', field: 'MKioskTy25' },
  { qn: 26, label: '[영상의학혈관중재] 성인', field: 'MKioskTy26' },
  { qn: 27, label: '[영상의학혈관중재] 영유아', field: 'MKioskTy27' }
];

// 연령/체중 제한 정보 가져오기
function getConstraintInfo(field: string): { ageLimit?: string; weightLimit?: string; note?: string } | null {
  const constraint = SEVERE_CONSTRAINTS[field];
  if (!constraint) return null;
  return {
    ageLimit: constraint.ageLimit,
    weightLimit: constraint.weightLimit,
    note: constraint.note
  };
}

// 시도명 매핑
const REGION_OPTIONS = [
  { value: '대구', label: '대구' },
  { value: '서울특별시', label: '서울' },
  { value: '부산광역시', label: '부산' },
  { value: '인천광역시', label: '인천' },
  { value: '광주광역시', label: '광주' },
  { value: '대전광역시', label: '대전' },
  { value: '울산광역시', label: '울산' },
  { value: '경기도', label: '경기' },
  { value: '강원특별자치도', label: '강원' },
  { value: '충청북도', label: '충북' },
  { value: '충청남도', label: '충남' },
  { value: '전북특별자치도', label: '전북' },
  { value: '전라남도', label: '전남' },
  { value: '경상북도', label: '경북' },
  { value: '경상남도', label: '경남' },
  { value: '제주특별자치도', label: '제주' },
  { value: '세종특별자치시', label: '세종' }
];

interface HospitalInfo {
  name: string;
  hpid: string;
  status: string;
  dutyEmclsName?: string;
  occupancy: number;
}

interface DiseaseData {
  name: string;
  available: number;
  unavailable: number;
  noInfo: number;
  availableHospitals: HospitalInfo[];
  unavailableHospitals: HospitalInfo[];
  noInfoHospitals: HospitalInfo[];
}

interface BedInfo {
  dutyName: string;
  dutyEmclsName: string;
  hvec: number;
  hvs01: number;
  hv27: number;
  HVS59: number;
  hv29: number;
  HVS03: number;
  hv30: number;
  HVS04: number;
  hv28: number;
  HVS02: number;
  hv15: number;
  HVS48: number;
  hv16: number;
  HVS49: number;
}

// 재실인원 계산 함수 (dger-api/js/utils.js와 동일)
function calculateTotalOccupancy(bedInfo: BedInfo): number {
  // 응급실 + 중환자실 재실인원
  const hvs01 = bedInfo.hvs01 || 0; // 응급실 재실
  const HVS59 = bedInfo.HVS59 || 0; // 응급전용 중환자실 재실
  const HVS03 = bedInfo.HVS03 || 0; // 신경과 중환자실 재실
  const HVS04 = bedInfo.HVS04 || 0; // 신생아 중환자실 재실
  const HVS02 = bedInfo.HVS02 || 0; // 일반 중환자실 재실
  const HVS48 = bedInfo.HVS48 || 0; // 외과 중환자실 재실
  const HVS49 = bedInfo.HVS49 || 0; // 심장내과 중환자실 재실

  return hvs01 + HVS59 + HVS03 + HVS04 + HVS02 + HVS48 + HVS49;
}

// 센터급 병원 판별
function isCenterHospital(dutyEmclsName?: string): boolean {
  const centerTypes = ['권역응급의료센터', '지역응급의료센터', '전문응급의료센터'];
  return centerTypes.includes(dutyEmclsName || '');
}

export default function SeverePage() {
  const { isDark } = useTheme();
  const [selectedRegion, setSelectedRegion] = useState('대구');
  const [diseaseData, setDiseaseData] = useState<Record<number, DiseaseData>>({});
  const [loading, setLoading] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<number, string | null>>({});
  const [allExpanded, setAllExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 화면 크기 감지
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 질환 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 시도명 매핑
      const mappedRegion = selectedRegion === '대구' ? '대구광역시' : selectedRegion;

      // 중증질환 API와 병상정보 API 병렬 호출
      const [severeResponse, bedResponse] = await Promise.all([
        fetch(`/api/severe-diseases?STAGE1=${encodeURIComponent(mappedRegion)}&numOfRows=1000&pageNo=1`),
        fetch(`/api/bed-info?region=${encodeURIComponent(mappedRegion)}`)
      ]);

      if (!severeResponse.ok) throw new Error('중증질환 데이터 로드 실패');

      // 병상정보 파싱
      const bedInfoMap = new Map<string, BedInfo>();
      if (bedResponse.ok) {
        const bedXml = await bedResponse.text();
        const bedParser = new DOMParser();
        const bedDoc = bedParser.parseFromString(bedXml, 'text/xml');
        const bedItems = bedDoc.querySelectorAll('item');

        Array.from(bedItems).forEach(item => {
          const hpid = item.querySelector('hpid')?.textContent || '';
          if (hpid) {
            const info: BedInfo = {
              dutyName: item.querySelector('dutyName')?.textContent || '',
              dutyEmclsName: item.querySelector('dutyEmclsName')?.textContent || '',
              hvec: parseInt(item.querySelector('hvec')?.textContent || '0'),
              hvs01: parseInt(item.querySelector('hvs01')?.textContent || '0'),
              hv27: parseInt(item.querySelector('hv27')?.textContent || '0'),
              HVS59: parseInt(item.querySelector('HVS59')?.textContent || '0'),
              hv29: parseInt(item.querySelector('hv29')?.textContent || '0'),
              HVS03: parseInt(item.querySelector('HVS03')?.textContent || '0'),
              hv30: parseInt(item.querySelector('hv30')?.textContent || '0'),
              HVS04: parseInt(item.querySelector('HVS04')?.textContent || '0'),
              hv28: parseInt(item.querySelector('hv28')?.textContent || '0'),
              HVS02: parseInt(item.querySelector('HVS02')?.textContent || '0'),
              hv15: parseInt(item.querySelector('hv15')?.textContent || '0'),
              HVS48: parseInt(item.querySelector('HVS48')?.textContent || '0'),
              hv16: parseInt(item.querySelector('hv16')?.textContent || '0'),
              HVS49: parseInt(item.querySelector('HVS49')?.textContent || '0')
            };
            bedInfoMap.set(hpid, info);
          }
        });
      }

      // 중증질환 데이터 파싱
      const severeXml = await severeResponse.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(severeXml, 'text/xml');
      const items = doc.querySelectorAll('item');

      const data: Record<number, DiseaseData> = {};

      // 초기화
      SEVERE_CODES.forEach(disease => {
        data[disease.qn] = {
          name: disease.label,
          available: 0,
          unavailable: 0,
          noInfo: 0,
          availableHospitals: [],
          unavailableHospitals: [],
          noInfoHospitals: []
        };
      });

      // 데이터 수집
      Array.from(items).forEach(item => {
        const hpid = item.querySelector('hpid')?.textContent || '';
        const dutyName = item.querySelector('dutyName')?.textContent || '';
        const dutyEmclsName = item.querySelector('dutyEmclsName')?.textContent || '';

        // 병상정보에서 재실인원 가져오기
        const bedInfo = bedInfoMap.get(hpid);
        const occupancy = bedInfo ? calculateTotalOccupancy(bedInfo) : 0;

        SEVERE_CODES.forEach(disease => {
          const fieldValue = item.querySelector(disease.field)?.textContent || '';
          const yn = fieldValue?.trim().toUpperCase();

          const hospitalInfo: HospitalInfo = {
            name: bedInfo?.dutyName || dutyName,
            hpid,
            status: yn,
            dutyEmclsName: bedInfo?.dutyEmclsName || dutyEmclsName,
            occupancy
          };

          if (yn === 'Y') {
            data[disease.qn].available++;
            data[disease.qn].availableHospitals.push(hospitalInfo);
          } else if (yn === 'N' || yn === '불가능') {
            data[disease.qn].unavailable++;
            data[disease.qn].unavailableHospitals.push(hospitalInfo);
          } else {
            data[disease.qn].noInfo++;
            data[disease.qn].noInfoHospitals.push(hospitalInfo);
          }
        });
      });

      // 병원 정렬 (센터급 우선, 재실인원 내림차순)
      const sortHospitals = (hospitals: HospitalInfo[]) => {
        return hospitals.sort((a, b) => {
          const aIsCenter = isCenterHospital(a.dutyEmclsName);
          const bIsCenter = isCenterHospital(b.dutyEmclsName);
          if (aIsCenter && !bIsCenter) return -1;
          if (!aIsCenter && bIsCenter) return 1;
          // 같은 급수 내에서는 재실인원 내림차순
          return b.occupancy - a.occupancy;
        });
      };

      Object.values(data).forEach(d => {
        d.availableHospitals = sortHospitals(d.availableHospitals);
        d.unavailableHospitals = sortHospitals(d.unavailableHospitals);
        d.noInfoHospitals = sortHospitals(d.noInfoHospitals);
      });

      setDiseaseData(data);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedRegion]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 섹션 토글
  const toggleSection = (qn: number, section: string) => {
    setExpandedCards(prev => {
      const current = prev[qn];
      if (current === section) {
        return { ...prev, [qn]: null };
      }
      return { ...prev, [qn]: section };
    });
  };

  // 전체 펼치기/접기
  const toggleAll = () => {
    if (allExpanded) {
      setExpandedCards({});
      setAllExpanded(false);
    } else {
      const newExpanded: Record<number, string> = {};
      SEVERE_CODES.forEach(d => {
        newExpanded[d.qn] = 'all';
      });
      setExpandedCards(newExpanded);
      setAllExpanded(true);
    }
  };

  // 새로고침
  const handleRefresh = () => {
    loadData();
  };

  // 병원 리스트 렌더링
  const renderHospitalList = (qn: number, section: string | null) => {
    if (!section) return null;

    const data = diseaseData[qn];
    if (!data) return null;

    let hospitals: HospitalInfo[] = [];
    let title = '';
    let statusClass = '';
    let statusText = '';

    if (section === 'available') {
      hospitals = data.availableHospitals;
      title = '수용가능 병원';
      statusClass = isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700';
      statusText = '수용가능';
    } else if (section === 'unavailable') {
      hospitals = data.unavailableHospitals;
      title = '수용불가 병원';
      statusClass = isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700';
      statusText = '불가';
    } else if (section === 'noInfo') {
      hospitals = data.noInfoHospitals;
      title = '미참여 병원';
      statusClass = isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600';
      statusText = '미참여';
    } else if (section === 'all') {
      // 전체 펼치기일 때 모든 병원 표시
      return (
        <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} max-h-[250px] overflow-y-auto`}>
          {data.availableHospitals.length > 0 && (
            <>
              <div className={`px-4 py-2 text-xs font-semibold sticky top-0 ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                수용가능 병원
              </div>
              {data.availableHospitals.map((h, i) => (
                <div key={`a-${i}`} className={`flex justify-between items-center px-4 py-1.5 text-xs border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    {isMobile ? shortenHospitalName(h.name) : h.name} <span className={`font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{h.occupancy}명</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'}`}>수용가능</span>
                </div>
              ))}
            </>
          )}
          {data.unavailableHospitals.length > 0 && (
            <>
              <div className={`px-4 py-2 text-xs font-semibold sticky top-0 ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                수용불가 병원
              </div>
              {data.unavailableHospitals.map((h, i) => (
                <div key={`u-${i}`} className={`flex justify-between items-center px-4 py-1.5 text-xs border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    {isMobile ? shortenHospitalName(h.name) : h.name} <span className={`font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{h.occupancy}명</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'}`}>불가</span>
                </div>
              ))}
            </>
          )}
          {data.noInfoHospitals.length > 0 && (
            <>
              <div className={`px-4 py-2 text-xs font-semibold sticky top-0 ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                미참여 병원
              </div>
              {data.noInfoHospitals.map((h, i) => (
                <div key={`n-${i}`} className={`flex justify-between items-center px-4 py-1.5 text-xs border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    {isMobile ? shortenHospitalName(h.name) : h.name} <span className={`font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{h.occupancy}명</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>미참여</span>
                </div>
              ))}
            </>
          )}
        </div>
      );
    }

    if (hospitals.length === 0) {
      return (
        <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} p-4 text-center text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          병원 정보가 없습니다.
        </div>
      );
    }

    return (
      <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} max-h-[250px] overflow-y-auto`}>
        <div className={`px-4 py-2 text-xs font-semibold sticky top-0 z-10 ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
          {title}
        </div>
        {hospitals.map((h, i) => (
          <div key={i} className={`flex justify-between items-center px-4 py-1.5 text-xs border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
              {isMobile ? shortenHospitalName(h.name) : h.name} <span className={`font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{h.occupancy}명</span>
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}>{statusText}</span>
          </div>
        ))}
      </div>
    );
  };

  // 로딩 화면
  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-[#F5F0E8]'}`}>
        <div className={`fixed inset-0 flex justify-center items-center z-50 ${isDark ? 'bg-gray-900/90' : 'bg-[#F5F0E8]/90'}`}>
          <div className={`w-12 h-12 border-4 ${isDark ? 'border-gray-700 border-t-blue-500' : 'border-gray-200 border-t-[#4A5D5D]'} rounded-full animate-spin`}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-[#F5F0E8]'}`}>
      <main className="p-2 sm:p-4 max-w-[1800px] mx-auto">
        {/* 컨트롤 섹션 - 좌측 정렬 */}
        <div className="flex items-center justify-start gap-2 mb-2 px-2 overflow-x-auto">
          <select
            className={`px-2 border rounded text-sm cursor-pointer transition-colors ${
              isDark
                ? 'bg-gray-800 border-gray-600 text-white hover:border-gray-500'
                : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
            } focus:outline-none`}
            style={{ height: '36px', width: '80px' }}
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
          >
            {REGION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button
            onClick={toggleAll}
            className={`px-3 text-sm font-medium rounded cursor-pointer transition-colors whitespace-nowrap ${
              isDark
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600'
                : 'bg-[#4A5D5D] hover:bg-[#3A4D4D] text-white'
            }`}
            style={{ height: '36px' }}
          >
            {allExpanded ? '전체 접기' : '전체 펼치기'}
          </button>

          <button
            onClick={handleRefresh}
            className={`px-3 text-sm font-medium rounded cursor-pointer transition-colors whitespace-nowrap ${
              isDark
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600'
                : 'bg-[#4A5D5D] hover:bg-[#3A4D4D] text-white'
            }`}
            style={{ height: '36px' }}
          >
            새로고침
          </button>
        </div>

        {/* 질환 그리드 - 컴팩트 간격, 넓은 카드 */}
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))' }}>
          {SEVERE_CODES.map(disease => {
            const data = diseaseData[disease.qn];
            if (!data) return null;

            return (
              <div
                key={disease.qn}
                className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg overflow-hidden transition-shadow hover:shadow-md`}
              >
                {/* 카드 컨텐츠 - 컴팩트 레이아웃 (줄바꿈 방지) */}
                <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                  {/* 질환명 - 툴팁 포함 */}
                  <div
                    className="flex items-center gap-1.5 flex-1 min-w-0 cursor-default"
                    title={`${data.name}${(() => {
                      const constraint = getConstraintInfo(disease.field);
                      return constraint?.note ? `\n${constraint.note}` : '';
                    })()}`}
                  >
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border flex-shrink-0 ${isDark ? 'bg-gray-700 border-gray-600 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                      {disease.qn}
                    </span>
                    <span className={`font-semibold text-sm whitespace-nowrap ${isDark ? 'text-white' : 'text-gray-800'}`}>
                      {data.name}
                    </span>
                    {/* 연령/체중 제한 표시 */}
                    {(() => {
                      const constraint = getConstraintInfo(disease.field);
                      if (!constraint) return null;
                      const limitText = constraint.ageLimit || constraint.weightLimit || '';
                      return limitText ? (
                        <span
                          className={`text-[10px] px-1 py-0.5 rounded border whitespace-nowrap flex-shrink-0 ${
                            isDark
                              ? 'bg-amber-900/50 border-amber-700 text-amber-400'
                              : 'bg-amber-50 border-amber-200 text-amber-700'
                          }`}
                        >
                          {limitText}
                        </span>
                      ) : null;
                    })()}
                  </div>

                  {/* 통계 - 최대한 컴팩트 */}
                  <div className="flex flex-shrink-0">
                    <div
                      className={`flex items-center text-[11px] cursor-pointer px-1 py-0.5 rounded transition-colors ${
                        isDark ? 'hover:bg-gray-700 text-green-400' : 'hover:bg-gray-100 text-green-700'
                      }`}
                      onClick={() => toggleSection(disease.qn, 'available')}
                      title="수용가능 병원 목록 보기"
                    >
                      <span className="font-medium">가능</span>
                      <span className="font-bold ml-0.5">{data.available}</span>
                    </div>
                    <div
                      className={`flex items-center text-[11px] cursor-pointer px-1 py-0.5 rounded transition-colors ${
                        isDark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-100 text-red-700'
                      }`}
                      onClick={() => toggleSection(disease.qn, 'unavailable')}
                      title="수용불가 병원 목록 보기"
                    >
                      <span className="font-medium">불가</span>
                      <span className="font-bold ml-0.5">{data.unavailable}</span>
                    </div>
                    <div
                      className={`flex items-center text-[11px] cursor-pointer px-1 py-0.5 rounded transition-colors ${
                        isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                      }`}
                      onClick={() => toggleSection(disease.qn, 'noInfo')}
                      title="미참여 병원 목록 보기"
                    >
                      <span className="font-medium">미참여</span>
                      <span className="font-bold ml-0.5">{data.noInfo}</span>
                    </div>
                  </div>
                </div>

                {/* 병원 리스트 */}
                {expandedCards[disease.qn] && renderHospitalList(disease.qn, expandedCards[disease.qn])}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
