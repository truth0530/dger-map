'use client';

/**
 * 응급 메시지 전용 페이지
 * 병원별 응급실 및 중증질환 메시지 조회
 * 원본: dger-api/public/systommsg.html
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { REGIONS, SEVERE_TYPES } from '@/lib/constants/dger';
import { parseMessage, getStatusColorClasses } from '@/lib/utils/messageClassifier';
import { mapSidoName } from '@/lib/utils/regionMapping';

interface HospitalMessage {
  hpid: string;
  dutyName: string;
  dutyAddr: string;
  dutyEmcls: string;
  dutyEmclsName: string;
  messages: MessageItem[];
}

interface MessageItem {
  msg: string;
  symTypCod: string;
  rnum?: string;
}

// 기관분류 필터 옵션
const FACILITY_TYPES = [
  { value: 'all', label: '전체' },
  { value: 'regional', label: '권역응급의료센터' },
  { value: 'local', label: '지역응급의료센터' },
  { value: 'facility', label: '지역응급의료기관' }
];

// 메시지 상태별 필터
const STATUS_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'red', label: '의료진 부족/부재' },
  { value: 'orange', label: '진료불가' },
  { value: 'green', label: '정상 운영' }
];

export default function MessagesPage() {
  const [region, setRegion] = useState('대구');
  const [facilityType, setFacilityType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [hospitals, setHospitals] = useState<HospitalMessage[]>([]);
  const [loading, setLoading] = useState(true); // 초기 로딩 true
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedHospitals, setExpandedHospitals] = useState<Set<string>>(new Set());
  const [loadProgress, setLoadProgress] = useState({ current: 0, total: 0 });
  const isMountedRef = useRef(true);

  // 병원 목록 조회
  const fetchHospitalList = useCallback(async () => {
    try {
      const response = await fetch(`/api/hospital-list?region=${encodeURIComponent(region)}`);
      if (!response.ok) throw new Error('병원 목록 조회 실패');

      const xmlText = await response.text();
      const hospitals = parseHospitalList(xmlText);
      return hospitals;
    } catch (error) {
      console.error('병원 목록 조회 오류:', error);
      return [];
    }
  }, [region]);

  // 메시지 조회
  const fetchMessages = useCallback(async (hpid: string): Promise<MessageItem[]> => {
    try {
      const response = await fetch(`/api/emergency-messages?hpid=${encodeURIComponent(hpid)}`);
      if (!response.ok) return [];

      const xmlText = await response.text();
      return parseMessages(xmlText);
    } catch (error) {
      console.error(`메시지 조회 오류 (${hpid}):`, error);
      return [];
    }
  }, []);

  // 전체 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const hospitalList = await fetchHospitalList();

      // 병렬로 모든 병원의 메시지 조회
      const hospitalsWithMessages = await Promise.all(
        hospitalList.map(async (hospital) => {
          const messages = await fetchMessages(hospital.hpid);
          return { ...hospital, messages };
        })
      );

      // 메시지가 있는 병원만 필터링 (또는 전체 표시)
      setHospitals(hospitalsWithMessages);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchHospitalList, fetchMessages]);

  // 초기 로드 및 자동 새로고침
  useEffect(() => {
    loadData();

    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(loadData, 3 * 60 * 1000); // 3분
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [region, autoRefresh, loadData]);

  // 병원 목록 XML 파싱
  function parseHospitalList(xmlText: string): Omit<HospitalMessage, 'messages'>[] {
    const items: Omit<HospitalMessage, 'messages'>[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemXml = match[1];
      const hpid = itemXml.match(/<hpid>([^<]*)<\/hpid>/i)?.[1] || '';
      const dutyName = itemXml.match(/<dutyName>([^<]*)<\/dutyName>/i)?.[1] || '';
      const dutyAddr = itemXml.match(/<dutyAddr>([^<]*)<\/dutyAddr>/i)?.[1] || '';
      const dutyEmcls = itemXml.match(/<dutyEmcls>([^<]*)<\/dutyEmcls>/i)?.[1] || '';
      const dutyEmclsName = itemXml.match(/<dutyEmclsName>([^<]*)<\/dutyEmclsName>/i)?.[1] || '';

      if (hpid) {
        items.push({ hpid, dutyName, dutyAddr, dutyEmcls, dutyEmclsName });
      }
    }

    return items;
  }

  // 메시지 XML 파싱
  function parseMessages(xmlText: string): MessageItem[] {
    const items: MessageItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemXml = match[1];
      const msg = itemXml.match(/<symBlkMsg>([^<]*)<\/symBlkMsg>/i)?.[1] || '';
      const symTypCod = itemXml.match(/<symTypCod>([^<]*)<\/symTypCod>/i)?.[1] || '';
      const rnum = itemXml.match(/<rnum>([^<]*)<\/rnum>/i)?.[1] || '';

      if (msg) {
        items.push({ msg, symTypCod, rnum });
      }
    }

    return items;
  }

  // 기관분류 필터링
  function matchesFacilityType(hospital: HospitalMessage): boolean {
    if (facilityType === 'all') return true;

    const emcls = hospital.dutyEmcls || hospital.dutyEmclsName || '';

    switch (facilityType) {
      case 'regional':
        return emcls.includes('권역');
      case 'local':
        return emcls.includes('지역') && emcls.includes('센터');
      case 'facility':
        return emcls.includes('기관') || (!emcls.includes('권역') && !emcls.includes('센터'));
      default:
        return true;
    }
  }

  // 상태 필터링
  function matchesStatusFilter(hospital: HospitalMessage): boolean {
    if (statusFilter === 'all') return true;

    return hospital.messages.some(m => {
      const parsed = parseMessage(m.msg, m.symTypCod);
      return parsed.status.color === statusFilter;
    });
  }

  // 검색 필터링
  function matchesSearch(hospital: HospitalMessage): boolean {
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    return (
      hospital.dutyName.toLowerCase().includes(term) ||
      hospital.dutyAddr.toLowerCase().includes(term) ||
      hospital.messages.some(m => m.msg.toLowerCase().includes(term))
    );
  }

  // 필터링된 병원 목록
  const filteredHospitals = hospitals
    .filter(h => h.messages.length > 0) // 메시지가 있는 병원만
    .filter(matchesFacilityType)
    .filter(matchesStatusFilter)
    .filter(matchesSearch);

  // 병원 카드 확장/축소
  const toggleExpanded = (hpid: string) => {
    setExpandedHospitals(prev => {
      const next = new Set(prev);
      if (next.has(hpid)) {
        next.delete(hpid);
      } else {
        next.add(hpid);
      }
      return next;
    });
  };

  // 전체 확장/축소
  const expandAll = () => setExpandedHospitals(new Set(filteredHospitals.map(h => h.hpid)));
  const collapseAll = () => setExpandedHospitals(new Set());

  // 질환 라벨 가져오기
  function getDiseaseLabel(symTypCod: string): string {
    if (!symTypCod) return '';

    const diseaseNum = symTypCod.replace(/^S0?/, '');
    const found = SEVERE_TYPES.find(t => t.key === `MKioskTy${diseaseNum}`);
    return found ? found.label : '';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-14 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-800">응급 메시지</h1>
              <p className="text-xs text-gray-500">
                {lastUpdated && `마지막 업데이트: ${lastUpdated.toLocaleTimeString()}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                disabled={loading}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '로딩...' : '새로고침'}
              </button>
              <label className="flex items-center gap-1 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4"
                />
                자동 갱신 (3분)
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* 지역 선택 */}
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="px-3 py-1.5 border rounded text-sm"
            >
              {REGIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            {/* 기관분류 */}
            <select
              value={facilityType}
              onChange={(e) => setFacilityType(e.target.value)}
              className="px-3 py-1.5 border rounded text-sm"
            >
              {FACILITY_TYPES.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            {/* 상태 필터 */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border rounded text-sm"
            >
              {STATUS_FILTERS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            {/* 검색 */}
            <input
              type="text"
              placeholder="병원명 또는 메시지 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 border rounded text-sm flex-1 min-w-[200px]"
            />

            {/* 확장/축소 */}
            <div className="flex gap-1">
              <button
                onClick={expandAll}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                전체 펼치기
              </button>
              <button
                onClick={collapseAll}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                전체 접기
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 통계 요약 */}
      <div className="bg-gray-100 border-b">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-gray-600">
              메시지 보유 병원: <strong className="text-gray-800">{filteredHospitals.length}</strong>개
            </span>
            <span className="text-red-600">
              의료진 부족: <strong>{filteredHospitals.filter(h =>
                h.messages.some(m => parseMessage(m.msg).status.color === 'red')
              ).length}</strong>개
            </span>
            <span className="text-orange-600">
              진료불가: <strong>{filteredHospitals.filter(h =>
                h.messages.some(m => parseMessage(m.msg).status.color === 'orange')
              ).length}</strong>개
            </span>
          </div>
        </div>
      </div>

      {/* 병원 카드 목록 */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {loading && hospitals.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            데이터를 불러오는 중...
          </div>
        ) : filteredHospitals.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {hospitals.length === 0 ? '조회된 병원이 없습니다.' : '조건에 맞는 메시지가 없습니다.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHospitals.map(hospital => {
              const isExpanded = expandedHospitals.has(hospital.hpid);
              const emergencyMessages = hospital.messages.filter(m => !m.symTypCod);
              const diseaseMessages = hospital.messages.filter(m => m.symTypCod);

              // 가장 심각한 상태 찾기
              const worstStatus = hospital.messages.reduce((worst, m) => {
                const parsed = parseMessage(m.msg, m.symTypCod);
                if (parsed.status.color === 'red') return 'red';
                if (parsed.status.color === 'orange' && worst !== 'red') return 'orange';
                return worst;
              }, 'gray' as 'red' | 'orange' | 'green' | 'gray');

              const borderColor = {
                red: 'border-l-red-500',
                orange: 'border-l-orange-500',
                green: 'border-l-green-500',
                gray: 'border-l-gray-300'
              }[worstStatus];

              return (
                <div
                  key={hospital.hpid}
                  className={`bg-white rounded-lg shadow-sm border border-l-4 ${borderColor} overflow-hidden`}
                >
                  {/* 병원 헤더 */}
                  <button
                    onClick={() => toggleExpanded(hospital.hpid)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-800 truncate">
                          {hospital.dutyName}
                        </h3>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {hospital.dutyEmclsName || hospital.dutyEmcls}
                        </span>
                        <span className="text-xs text-blue-600 font-medium">
                          메시지 {hospital.messages.length}개
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {hospital.dutyAddr}
                      </p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* 메시지 목록 */}
                  {isExpanded && (
                    <div className="border-t px-4 py-3 bg-gray-50">
                      {/* 중증질환 메시지 */}
                      {diseaseMessages.length > 0 && (
                        <div className="mb-3">
                          <h4 className="text-xs font-semibold text-red-600 mb-2">
                            [중증질환] 수용불가 상태
                          </h4>
                          <div className="space-y-2">
                            {diseaseMessages.map((m, idx) => {
                              const parsed = parseMessage(m.msg, m.symTypCod);
                              const colorClasses = getStatusColorClasses(parsed.status.color);
                              const diseaseLabel = getDiseaseLabel(m.symTypCod);

                              return (
                                <div key={idx} className="bg-red-50 rounded p-2 text-sm">
                                  <div className="flex flex-wrap items-center gap-1 mb-1">
                                    {diseaseLabel && (
                                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">
                                        {diseaseLabel}
                                      </span>
                                    )}
                                    <span className={`px-2 py-0.5 ${colorClasses.bg} ${colorClasses.text} text-xs rounded`}>
                                      {parsed.status.label}
                                    </span>
                                  </div>
                                  <p className="text-gray-700">{m.msg}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 응급실 메시지 */}
                      {emergencyMessages.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-green-600 mb-2">
                            [응급실] 운영 정보
                          </h4>
                          <div className="space-y-2">
                            {emergencyMessages.map((m, idx) => {
                              const parsed = parseMessage(m.msg, m.symTypCod);
                              const colorClasses = getStatusColorClasses(parsed.status.color);

                              return (
                                <div key={idx} className="bg-green-50 rounded p-2 text-sm">
                                  <div className="flex flex-wrap items-center gap-1 mb-1">
                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-medium">
                                      {parsed.department}
                                    </span>
                                    <span className={`px-2 py-0.5 ${colorClasses.bg} ${colorClasses.text} text-xs rounded`}>
                                      {parsed.status.label}
                                    </span>
                                  </div>
                                  <p className="text-gray-700">{parsed.details || m.msg}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
