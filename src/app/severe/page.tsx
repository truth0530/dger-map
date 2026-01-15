'use client';

/**
 * 중증응급질환 수용가능 현황 페이지
 * 원본: dger-api/public/27severe.html
 * 완전히 동일하게 구현
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '@/lib/contexts/ThemeContext';
import { SEVERE_CONSTRAINTS } from '@/lib/constants/severeDefinitions';
import { SYMPTOM_CODE_TO_DISEASE_MAP } from '@/lib/constants/diseasePatterns';
import { shortenHospitalName } from '@/lib/utils/hospitalUtils';
import { BedOccupancyInput, calculateTotalOccupancy, calculateOccupancyRate } from '@/lib/utils/bedOccupancy';
import { OccupancyBattery } from '@/components/ui/OccupancyBattery';
import { detectRegionFromLocation, getStoredRegion, isRegionLocked, setRegionLocked, setStoredRegion } from '@/lib/utils/locationRegion';
import { mapSidoName, mapSidoShort } from '@/lib/utils/regionMapping';

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
  occupancyRate: number;
}

// 메시지 인터페이스
interface MessageItem {
  msg: string;
  symTypCod: string;     // 질환 코드 (Y0010, Y0081 등)
  symTypCodMag: string;  // 질환명 텍스트 (장중첩/폐색(유아) 등)
  symBlkSttDtm: string;
  symBlkEndDtm: string;
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

interface BedInfo extends BedOccupancyInput {
  hpid?: string;
  dutyName: string;
  dutyEmclsName: string;
}

// 센터급 병원 판별
function isCenterHospital(dutyEmclsName?: string): boolean {
  const centerTypes = ['권역응급의료센터', '지역응급의료센터', '전문응급의료센터'];
  return centerTypes.includes(dutyEmclsName || '');
}

export default function SeverePage() {
  const { isDark } = useTheme();
  const [selectedRegion, setSelectedRegion] = useState('대구');
  const hasUserSelectedRegion = useRef(false);
  const [showLocationNotice, setShowLocationNotice] = useState(false);
  const [diseaseData, setDiseaseData] = useState<Record<number, DiseaseData>>({});
  const [loading, setLoading] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<number, string | null>>({});
  const [allExpanded, setAllExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // 불가 병원 메시지 관련 상태
  const [expandedHospitalRows, setExpandedHospitalRows] = useState<Record<string, boolean>>({});
  const [hospitalMessages, setHospitalMessages] = useState<Record<string, MessageItem[]>>({});
  const [loadingMessages, setLoadingMessages] = useState<Record<string, boolean>>({});

  // 화면 크기 감지
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let isActive = true;
    const locked = isRegionLocked();
    const storedRegion = getStoredRegion();
    if (locked && storedRegion) {
      const shortRegion = mapSidoShort(storedRegion);
      if (REGION_OPTIONS.some((opt) => opt.value === storedRegion)) {
        setSelectedRegion(storedRegion);
        return () => {
          isActive = false;
        };
      }
      if (REGION_OPTIONS.some((opt) => opt.value === shortRegion)) {
        setSelectedRegion(shortRegion);
        return () => {
          isActive = false;
        };
      }
    } else if (locked && !storedRegion) {
      setRegionLocked(false);
    }

    (async () => {
      const region = await detectRegionFromLocation();
      if (!isActive || !region || hasUserSelectedRegion.current) return;
      const nextRegion = region === '대구광역시' ? '대구' : region;
      if (REGION_OPTIONS.some((opt) => opt.value === nextRegion)) {
        setSelectedRegion(nextRegion);
        setShowLocationNotice(true);
        window.setTimeout(() => setShowLocationNotice(false), 2000);
      }
    })();

    return () => {
      isActive = false;
    };
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

      const severeJson = await severeResponse.json();
      if (!severeJson?.success || !severeJson.items) {
        throw new Error('중증질환 데이터 파싱 실패');
      }

      const bedInfoMap = new Map<string, BedInfo>();
      if (bedResponse.ok) {
        const bedJson = await bedResponse.json();
        if (bedJson?.success && bedJson.items) {
          bedJson.items.forEach((item: BedInfo) => {
            const hpid = item.hpid || '';
            if (hpid) {
              bedInfoMap.set(hpid, item);
            }
          });
        }
      }

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
      severeJson.items.forEach((item: { hpid: string; dutyName: string; dutyEmclsName: string; severeStatus: Record<string, string> }) => {
        const hpid = item.hpid || '';
        const dutyName = item.dutyName || '';
        const dutyEmclsName = item.dutyEmclsName || '';

        // 병상정보에서 재실인원과 포화도 가져오기
        const bedInfo = bedInfoMap.get(hpid);
        const occupancy = bedInfo ? calculateTotalOccupancy(bedInfo) : 0;
        const occupancyRate = bedInfo ? calculateOccupancyRate(bedInfo) : 0;

        SEVERE_CODES.forEach(disease => {
          const fieldValue = item.severeStatus?.[disease.field] || '';
          const yn = fieldValue?.trim().toUpperCase();

          const hospitalInfo: HospitalInfo = {
            name: bedInfo?.dutyName || dutyName,
            hpid,
            status: yn,
            dutyEmclsName: bedInfo?.dutyEmclsName || dutyEmclsName,
            occupancy,
            occupancyRate
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

  // 불가 병원 메시지 로드
  const loadHospitalMessages = useCallback(async (hpid: string) => {
    if (hospitalMessages[hpid] || loadingMessages[hpid]) return;

    setLoadingMessages(prev => ({ ...prev, [hpid]: true }));
    try {
      const res = await fetch(`/api/emergency-messages?hpid=${encodeURIComponent(hpid)}`);
      if (!res.ok) {
        setHospitalMessages(prev => ({ ...prev, [hpid]: [] }));
        return;
      }

      const text = await res.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      const items = xml.querySelectorAll('item');

      const messages: MessageItem[] = [];
      items.forEach(item => {
        const msg = item.querySelector('symBlkMsg')?.textContent || '';
        const symTypCod = item.querySelector('symTypCod')?.textContent || '';
        const symTypCodMag = item.querySelector('symTypCodMag')?.textContent || '';
        const symBlkSttDtm = item.querySelector('symBlkSttDtm')?.textContent || '';
        const symBlkEndDtm = item.querySelector('symBlkEndDtm')?.textContent || '';
        if (msg) {
          messages.push({ msg, symTypCod, symTypCodMag, symBlkSttDtm, symBlkEndDtm });
        }
      });

      setHospitalMessages(prev => ({ ...prev, [hpid]: messages }));
    } catch (error) {
      console.error('메시지 로드 실패:', error);
      setHospitalMessages(prev => ({ ...prev, [hpid]: [] }));
    } finally {
      setLoadingMessages(prev => ({ ...prev, [hpid]: false }));
    }
  }, [hospitalMessages, loadingMessages]);

  // 불가 병원 행 펼치기 토글 (qn + hpid 조합으로 독립적 관리)
  const toggleHospitalRow = useCallback((qn: number, hpid: string) => {
    const key = `${qn}-${hpid}`;
    setExpandedHospitalRows(prev => {
      const isExpanding = !prev[key];
      if (isExpanding) {
        loadHospitalMessages(hpid);
      }
      return { ...prev, [key]: isExpanding };
    });
  }, [loadHospitalMessages]);

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

  // symTypCod를 qn으로 변환하여 메시지 필터링
  const filterMessagesByDisease = (messages: MessageItem[], qn: number): MessageItem[] => {
    return messages.filter(msg => {
      // symTypCod (예: Y0010, Y0081)를 qn으로 변환
      const mappedQn = SYMPTOM_CODE_TO_DISEASE_MAP[msg.symTypCod];
      return mappedQn === qn;
    });
  };

  // 불가 병원 행 렌더링 (아코디언 포함, qn별 독립 관리)
  const renderUnavailableHospitalRow = (h: HospitalInfo, keyPrefix: string, qn: number) => {
    const rowKey = `${qn}-${h.hpid}`;
    const isExpanded = expandedHospitalRows[rowKey];
    const allMessages = hospitalMessages[h.hpid] || [];
    const filteredMessages = filterMessagesByDisease(allMessages, qn);
    const isLoadingMsg = loadingMessages[h.hpid];

    return (
      <div key={`${keyPrefix}-${h.hpid}`}>
        <div
          className={`flex justify-between items-center px-4 py-1.5 text-xs border-b cursor-pointer ${isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-100 hover:bg-gray-50'}`}
          onClick={() => toggleHospitalRow(qn, h.hpid)}
        >
          <span className={`flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <span className={`transition-transform text-[10px] ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
            {isMobile ? shortenHospitalName(h.name) : h.name}
            <span className={`font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{h.occupancy}명</span>
            <OccupancyBattery rate={h.occupancyRate} isDark={isDark} size="small" />
          </span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'}`}>불가</span>
        </div>
        {isExpanded && (
          <div className={`px-6 py-2 text-xs ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
            {isLoadingMsg ? (
              <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>메시지 로딩중...</span>
            ) : filteredMessages.length > 0 ? (
              <div className="space-y-1">
                {filteredMessages.map((msg, idx) => (
                  <div key={idx} className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {msg.symTypCodMag && (
                      <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        [{msg.symTypCodMag}]{' '}
                      </span>
                    )}
                    {msg.msg}
                  </div>
                ))}
              </div>
            ) : (
              <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                병원에서 등록한 불가 메시지가 없습니다.
              </span>
            )}
          </div>
        )}
      </div>
    );
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
    } else if (section === 'both') {
      // 가능+불가 함께 표시
      return (
        <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {data.availableHospitals.map((h, i) => (
            <div key={`a-${i}`} className={`flex justify-between items-center px-4 py-1.5 text-xs border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
              <span className={`flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {isMobile ? shortenHospitalName(h.name) : h.name}
                <span className={`font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{h.occupancy}명</span>
                <OccupancyBattery rate={h.occupancyRate} isDark={isDark} size="small" />
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'}`}>수용가능</span>
            </div>
          ))}
          {data.unavailableHospitals.map((h) => renderUnavailableHospitalRow(h, 'both-u', qn))}
        </div>
      );
    } else if (section === 'all') {
      // 전체 펼치기일 때 모든 병원 표시
      return (
        <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {data.availableHospitals.map((h, i) => (
            <div key={`a-${i}`} className={`flex justify-between items-center px-4 py-1.5 text-xs border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
              <span className={`flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {isMobile ? shortenHospitalName(h.name) : h.name}
                <span className={`font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{h.occupancy}명</span>
                <OccupancyBattery rate={h.occupancyRate} isDark={isDark} size="small" />
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'}`}>수용가능</span>
            </div>
          ))}
          {data.unavailableHospitals.map((h) => renderUnavailableHospitalRow(h, 'all-u', qn))}
          {data.noInfoHospitals.map((h, i) => (
            <div key={`n-${i}`} className={`flex justify-between items-center px-4 py-1.5 text-xs border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
              <span className={`flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {isMobile ? shortenHospitalName(h.name) : h.name}
                <span className={`font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{h.occupancy}명</span>
                <OccupancyBattery rate={h.occupancyRate} isDark={isDark} size="small" />
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>미참여</span>
            </div>
          ))}
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

    // 불가 섹션인 경우 아코디언 적용
    if (section === 'unavailable') {
      return (
        <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {hospitals.map((h) => renderUnavailableHospitalRow(h, 'single-u', qn))}
        </div>
      );
    }

    return (
      <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        {hospitals.map((h, i) => (
          <div key={i} className={`flex justify-between items-center px-4 py-1.5 text-xs border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
            <span className={`flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {isMobile ? shortenHospitalName(h.name) : h.name}
              <span className={`font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{h.occupancy}명</span>
              <OccupancyBattery rate={h.occupancyRate} isDark={isDark} size="small" />
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
      {showLocationNotice && (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-full border px-3 py-1 text-xs shadow-sm bg-white/90 text-gray-700 border-gray-300">
          현재 위치를 바탕으로 위치 정보가 설정되었습니다.
        </div>
      )}
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
            onChange={(e) => {
              hasUserSelectedRegion.current = true;
              const nextRegion = e.target.value;
              setSelectedRegion(nextRegion);
              setStoredRegion(mapSidoName(nextRegion));
              setRegionLocked(true);
            }}
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

                  {/* 통계 - 스택 바 차트 (내부 텍스트) */}
                  {(() => {
                    const total = data.available + data.unavailable + data.noInfo;
                    const availPct = total > 0 ? (data.available / total) * 100 : 0;
                    const unavailPct = total > 0 ? (data.unavailable / total) * 100 : 0;
                    const noInfoPct = total > 0 ? (data.noInfo / total) * 100 : 0;
                    // 텍스트 표시: 넓으면 라벨+숫자, 좁으면 숫자만, 더 좁으면 생략
                    const getLabel = (pct: number, label: string, count: number) => {
                      if (pct >= 35) return `${label}${count}`;
                      if (pct >= 12) return `${count}`;
                      return '';
                    };
                    // 불가능 세로 텍스트: 좁으면 세로로 "불/가", 넓으면 가로로 표시
                    const getUnavailLabel = (pct: number, count: number) => {
                      if (pct >= 35) return { text: `불가${count}`, vertical: false };
                      if (count >= 1) return { text: '불가', vertical: true };
                      return { text: '', vertical: false };
                    };
                    const unavailLabel = getUnavailLabel(unavailPct, data.unavailable);
                    return (
                      <div className="flex items-center flex-shrink-0">
                        <div className={`flex h-7 w-28 rounded-sm overflow-hidden text-[9px] font-medium shadow-sm ${isDark ? 'bg-gray-700/50' : 'bg-stone-200'}`}>
                          {availPct > 0 && (
                            <div
                              className={`h-full cursor-pointer transition-all hover:brightness-110 flex items-center justify-center overflow-hidden whitespace-nowrap ${isDark ? 'bg-teal-600 text-teal-50' : 'bg-teal-600 text-white'}`}
                              style={{ width: `${availPct}%` }}
                              onClick={() => toggleSection(disease.qn, 'both')}
                              title={`수용가능 ${data.available}개`}
                            >
                              {getLabel(availPct, '가능', data.available)}
                            </div>
                          )}
                          {data.unavailable > 0 && (
                            <div
                              className={`h-full cursor-pointer transition-all hover:brightness-110 flex items-center justify-center overflow-hidden ${isDark ? 'bg-rose-700 text-rose-50' : 'bg-rose-600 text-white'} ${unavailLabel.vertical ? 'flex-col leading-[1.1]' : 'whitespace-nowrap'}`}
                              style={{
                                width: `${unavailPct}%`,
                                minWidth: data.unavailable >= 1 ? '18px' : undefined
                              }}
                              onClick={() => toggleSection(disease.qn, 'both')}
                              title={`수용불가 ${data.unavailable}개`}
                            >
                              {unavailLabel.vertical ? (
                                <>
                                  <span>불</span>
                                  <span>가</span>
                                </>
                              ) : unavailLabel.text}
                            </div>
                          )}
                          {noInfoPct > 0 && (
                            <div
                              className={`h-full cursor-pointer transition-all hover:brightness-110 flex items-center justify-center overflow-hidden whitespace-nowrap ${isDark ? 'bg-gray-600 text-gray-300' : 'bg-stone-400 text-stone-50'}`}
                              style={{ width: `${noInfoPct}%` }}
                              onClick={() => toggleSection(disease.qn, 'noInfo')}
                              title={`미참여 ${data.noInfo}개`}
                            >
                              {getLabel(noInfoPct, '미참여', data.noInfo)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
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
