"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAllData, getHospitals, getDiseases, getMeta } from "@/lib/data";
import { DAYS_OF_WEEK } from "@/lib/constants";
import type { DayOfWeek, AvailabilityStatus, Hospital } from "@/types";
import { KoreaSidoMap } from "@/components/map/KoreaSidoMap";
import { KoreaGugunMap } from "@/components/map/KoreaGugunMap";
import { useBedData, HospitalBedData } from "@/lib/hooks/useBedData";
import { useSevereData, HospitalSevereData } from "@/lib/hooks/useSevereData";
import { mapSidoName } from "@/lib/utils/regionMapping";
import { BedType, BED_TYPE_CONFIG } from "@/lib/constants/bedTypes";

type EmergencyClassification = "권역응급의료센터" | "지역응급의료센터" | "지역응급의료기관";

const REGIONS = [
  { value: "all", label: "전국" },
  { value: "서울특별시", label: "서울" },
  { value: "부산광역시", label: "부산" },
  { value: "대구광역시", label: "대구" },
  { value: "인천광역시", label: "인천" },
  { value: "광주광역시", label: "광주" },
  { value: "대전광역시", label: "대전" },
  { value: "울산광역시", label: "울산" },
  { value: "세종특별자치시", label: "세종" },
  { value: "경기도", label: "경기" },
  { value: "강원특별자치도", label: "강원" },
  { value: "충청북도", label: "충북" },
  { value: "충청남도", label: "충남" },
  { value: "전북특별자치도", label: "전북" },
  { value: "전라남도", label: "전남" },
  { value: "경상북도", label: "경북" },
  { value: "경상남도", label: "경남" },
  { value: "제주특별자치도", label: "제주" },
];

// 한국 시간 기준 오늘 요일 가져오기
const getTodayDayOfWeek = (): DayOfWeek => {
  const koreaTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" });
  const koreaDate = new Date(koreaTime);
  const dayIndex = koreaDate.getDay(); // 0: 일, 1: 월, ..., 6: 토
  const days: DayOfWeek[] = ["일", "월", "화", "수", "목", "금", "토"];
  return days[dayIndex];
};

export function MapDashboard() {
  const [selectedDisease, setSelectedDisease] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getTodayDayOfWeek());
  const [selectedStatus, setSelectedStatus] = useState<AvailabilityStatus[]>(["24시간", "주간", "야간"]);
  const [selectedClassifications, setSelectedClassifications] = useState<EmergencyClassification[]>([
    "권역응급의료센터", "지역응급의료센터", "지역응급의료기관"
  ]);
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [hoveredHospitalCode, setHoveredHospitalCode] = useState<string | null>(null);
  const [showDetailMap, setShowDetailMap] = useState(false);  // 상세 지도 표시 여부
  const [selectedBedTypes, setSelectedBedTypes] = useState<Set<BedType>>(new Set(['general']));

  const hospitalListRef = useRef<HTMLDivElement>(null);

  const hospitals = getHospitals();
  const diseases = getDiseases();
  const allData = getAllData();
  const meta = getMeta();

  // 병상 데이터 훅
  const { data: bedData, fetchBedData, loading: bedLoading } = useBedData();
  // 중증질환 데이터 훅
  const { data: severeData, fetchSevereData, loading: severeLoading } = useSevereData();

  // 지역 변경 시 병상 및 중증질환 데이터 로드
  useEffect(() => {
    const regionToFetch = selectedRegion === "all" ? "대구" : selectedRegion;
    const mappedRegion = mapSidoName(regionToFetch);
    fetchBedData(mappedRegion);
    fetchSevereData(mappedRegion);
  }, [selectedRegion, fetchBedData, fetchSevereData]);

  // 병상 데이터를 병원 코드로 매핑
  const bedDataMap = useMemo(() => {
    const map = new Map<string, HospitalBedData>();
    bedData.forEach((bed) => {
      map.set(bed.hpid, bed);
    });
    return map;
  }, [bedData]);

  // 중증질환 데이터를 병원 코드로 매핑
  const severeDataMap = useMemo(() => {
    const map = new Map<string, HospitalSevereData>();
    severeData.forEach((severe) => {
      map.set(severe.hpid, severe);
    });
    return map;
  }, [severeData]);

  const stats = useMemo(() => {
    if (!selectedDisease) return null;
    const diseaseData = allData.filter((d) => d.질환명 === selectedDisease);
    const result = { h24: 0, day: 0, night: 0, no: 0, total: diseaseData.length };
    diseaseData.forEach((item) => {
      const status = item[selectedDay] as AvailabilityStatus;
      if (status === "24시간") result.h24++;
      else if (status === "주간") result.day++;
      else if (status === "야간") result.night++;
      else result.no++;
    });
    return result;
  }, [allData, selectedDisease, selectedDay]);

  // 선택된 지역의 병원 목록 (사이드바용)
  const filteredHospitals = useMemo(() => {
    // 전국 선택 시 대구 병원만 표시 (진료정보 있음), 그 외는 해당 지역 병원 전체
    const targetRegion = selectedRegion === "all" ? "대구광역시" : selectedRegion;
    const isDaeguRegion = selectedRegion === "all" || selectedRegion === "대구광역시";

    return hospitals.filter((hospital) => {
      if (hospital.region !== targetRegion) return false;

      // 전국 보기 또는 대구 선택 시에는 진료정보 있는 병원만
      if (isDaeguRegion && !hospital.hasDiseaseData) return false;

      // 기관 종류 필터
      if (
        selectedClassifications.length > 0 &&
        hospital.classification &&
        !selectedClassifications.includes(hospital.classification as EmergencyClassification)
      ) {
        return false;
      }

      // 대구 지역이고 질환이 선택된 경우 가용성 필터 적용
      if (isDaeguRegion && selectedDisease) {
        const data = allData.find(
          (d) => d.소속기관코드 === hospital.code && d.질환명 === selectedDisease
        );
        if (!data) return false;
        const status = data[selectedDay] as AvailabilityStatus;
        return selectedStatus.includes(status);
      }

      return true;
    });
  }, [hospitals, allData, selectedRegion, selectedDisease, selectedDay, selectedStatus, selectedClassifications]);

  // 호버된 병원이 리스트에 있으면 스크롤
  useEffect(() => {
    if (hoveredHospitalCode && hospitalListRef.current) {
      const element = hospitalListRef.current.querySelector(`[data-hospital-code="${hoveredHospitalCode}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [hoveredHospitalCode]);

  const toggleStatus = (status: AvailabilityStatus) => {
    setSelectedStatus((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const toggleClassification = (classification: string) => {
    const cls = classification as EmergencyClassification;
    setSelectedClassifications((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  };

  const toggleBedType = useCallback((type: BedType) => {
    setSelectedBedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) {
          next.delete(type);
        }
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // 병원별 해당 질환 가용성 상태
  const getHospitalStatus = (hospital: Hospital): AvailabilityStatus | null => {
    if (!selectedDisease) return null;
    const data = allData.find(
      (d) => d.소속기관코드 === hospital.code && d.질환명 === selectedDisease
    );
    if (!data) return null;
    return data[selectedDay] as AvailabilityStatus;
  };

  // 상태별 색상
  const getStatusColor = (status: AvailabilityStatus | null): string => {
    switch (status) {
      case "24시간": return "text-green-400";
      case "주간": return "text-blue-400";
      case "야간": return "text-purple-400";
      case "불가": return "text-gray-500";
      default: return "text-gray-400";
    }
  };

  const getStatusBgColor = (status: AvailabilityStatus | null, isHovered: boolean): string => {
    if (isHovered) {
      switch (status) {
        case "24시간": return "bg-green-500/30 border-green-400";
        case "주간": return "bg-blue-500/30 border-blue-400";
        case "야간": return "bg-purple-500/30 border-purple-400";
        case "불가": return "bg-gray-500/30 border-gray-400";
        default: return "bg-gray-700 border-gray-500";
      }
    }
    switch (status) {
      case "24시간": return "bg-green-500/20 border-green-500/40";
      case "주간": return "bg-blue-500/20 border-blue-500/40";
      case "야간": return "bg-purple-500/20 border-purple-500/40";
      case "불가": return "bg-gray-500/20 border-gray-500/40";
      default: return "bg-gray-800 border-gray-700";
    }
  };

  // 지역 선택 핸들러 (지도에서 클릭 시)
  const handleRegionSelect = (region: string) => {
    setSelectedRegion(region);
    setShowDetailMap(true);
  };

  // 전국 지도로 돌아가기
  const handleBackToNational = () => {
    setSelectedRegion("all");
    setShowDetailMap(false);
  };

  // 사이드바 지역 Select 변경 핸들러
  const handleSidebarRegionChange = (region: string) => {
    setSelectedRegion(region);
    if (region === "all") {
      setShowDetailMap(false);
    } else {
      setShowDetailMap(true);
    }
  };

  // 병원 호버 핸들러
  const handleHospitalHover = (code: string | null) => {
    setHoveredHospitalCode(code);
  };

  // 사이드바에 표시할 지역명
  const getSidebarRegionLabel = (): string => {
    if (selectedRegion === "all") return "대구";  // 전국 선택 시 대구 병원만 표시
    const region = REGIONS.find((r) => r.value === selectedRegion);
    return region?.label || selectedRegion;
  };

  // 기관종류 약어 변환
  const getClassificationShort = (classification: string | undefined): string => {
    switch (classification) {
      case "권역응급의료센터": return "권역";
      case "지역응급의료센터": return "센터";
      case "지역응급의료기관": return "기관";
      default: return "";
    }
  };

  // 사이드바 병원 목록 표시 여부 (항상 표시)
  const showHospitalList = true;

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">중증응급질환 진료 현황</h1>
          <span className="text-xs text-gray-500">
            전국 {meta.totalHospitals}개 응급의료기관 | 대구 {meta.daeguHospitals}개 진료정보
          </span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 좌측 사이드바: 필터 + 범례 */}
        <aside className="w-52 bg-gray-900 border-r border-gray-800 flex flex-col p-3 space-y-2 overflow-y-auto">
          {/* 지역 & 요일 선택 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-gray-400 mb-1 block">지역</label>
              <Select value={selectedRegion} onValueChange={handleSidebarRegionChange}>
                <SelectTrigger className="h-7 text-xs bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {REGIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value} className="text-xs text-white hover:bg-gray-700">
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-400 mb-1 block">요일</label>
              <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)}>
                <SelectTrigger className="h-7 text-xs bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day} value={day} className="text-xs text-white hover:bg-gray-700">
                      {day}요일
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 질환 선택 + 통계 통합 */}
          <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
            <Select
              value={selectedDisease || "none"}
              onValueChange={(v) => setSelectedDisease(v === "none" ? null : v)}
            >
              <SelectTrigger className="h-7 text-xs bg-gray-700 border-gray-600 text-white mb-1.5">
                <SelectValue placeholder="질환 선택..." />
              </SelectTrigger>
              <SelectContent className="max-h-64 bg-gray-800 border-gray-700">
                <SelectItem value="none" className="text-xs text-gray-400 hover:bg-gray-700">전체 질환</SelectItem>
                {diseases.map((d) => (
                  <SelectItem key={d.id} value={d.name} className="text-xs text-white hover:bg-gray-700">
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {stats ? (
              <div className="grid grid-cols-4 gap-1 text-center">
                <div className="bg-gray-900 rounded p-1 border border-gray-700">
                  <div className="text-sm font-bold text-green-400">{stats.h24}</div>
                  <div className="text-[9px] text-gray-500">24h</div>
                </div>
                <div className="bg-gray-900 rounded p-1 border border-gray-700">
                  <div className="text-sm font-bold text-blue-400">{stats.day}</div>
                  <div className="text-[9px] text-gray-500">주간</div>
                </div>
                <div className="bg-gray-900 rounded p-1 border border-gray-700">
                  <div className="text-sm font-bold text-purple-400">{stats.night}</div>
                  <div className="text-[9px] text-gray-500">야간</div>
                </div>
                <div className="bg-gray-900 rounded p-1 border border-gray-700">
                  <div className="text-sm font-bold text-gray-500">{stats.no}</div>
                  <div className="text-[9px] text-gray-500">불가</div>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-gray-500 text-center py-1">
                질환 선택 시 통계 표시
              </div>
            )}
          </div>

          {/* 병상 유형 필터 */}
          <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
            <div className="text-[10px] text-gray-400 mb-1.5 flex items-center justify-between">
              <span>병상 유형</span>
              {bedLoading && <span className="text-orange-400">로딩중...</span>}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {(Object.entries(BED_TYPE_CONFIG) as [BedType, typeof BED_TYPE_CONFIG[BedType]][]).map(([type, config]) => (
                <button
                  key={type}
                  onClick={() => toggleBedType(type)}
                  className={`flex items-center justify-center text-[10px] px-1.5 py-1 rounded transition-all ${
                    selectedBedTypes.has(type)
                      ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/50"
                      : "bg-gray-700/50 text-gray-500 border border-gray-600 hover:border-gray-500"
                  }`}
                >
                  {config.shortLabel}
                </button>
              ))}
            </div>
          </div>

          {/* 범례: 기관종류 */}
          <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
            <div className="text-[10px] text-gray-400 mb-1.5">기관종류 (모양)</div>
            <div className="flex gap-1">
              <button
                onClick={() => toggleClassification("권역응급의료센터")}
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-all flex-1 justify-center ${
                  selectedClassifications.includes("권역응급의료센터")
                    ? "bg-gray-700/50"
                    : "opacity-40 hover:opacity-70"
                }`}
              >
                <svg width="10" height="10" viewBox="0 0 12 12">
                  <polygon points="6,1 11,6 6,11 1,6" fill={selectedClassifications.includes("권역응급의료센터") ? "#9ca3af" : "#4b5563"} stroke="#374151" strokeWidth="0.5" />
                </svg>
                <span className={selectedClassifications.includes("권역응급의료센터") ? "text-gray-300" : "text-gray-500"}>권역</span>
              </button>
              <button
                onClick={() => toggleClassification("지역응급의료센터")}
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-all flex-1 justify-center ${
                  selectedClassifications.includes("지역응급의료센터")
                    ? "bg-gray-700/50"
                    : "opacity-40 hover:opacity-70"
                }`}
              >
                <svg width="10" height="10" viewBox="0 0 12 12">
                  <rect x="2" y="2" width="8" height="8" fill={selectedClassifications.includes("지역응급의료센터") ? "#9ca3af" : "#4b5563"} stroke="#374151" strokeWidth="0.5" rx="0.5" />
                </svg>
                <span className={selectedClassifications.includes("지역응급의료센터") ? "text-gray-300" : "text-gray-500"}>센터</span>
              </button>
              <button
                onClick={() => toggleClassification("지역응급의료기관")}
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-all flex-1 justify-center ${
                  selectedClassifications.includes("지역응급의료기관")
                    ? "bg-gray-700/50"
                    : "opacity-40 hover:opacity-70"
                }`}
              >
                <svg width="10" height="10" viewBox="0 0 12 12">
                  <circle cx="6" cy="6" r="4" fill={selectedClassifications.includes("지역응급의료기관") ? "#9ca3af" : "#4b5563"} stroke="#374151" strokeWidth="0.5" />
                </svg>
                <span className={selectedClassifications.includes("지역응급의료기관") ? "text-gray-300" : "text-gray-500"}>기관</span>
              </button>
            </div>
          </div>

          {/* 범례: 가용성 */}
          <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
            <div className="text-[10px] text-gray-400 mb-1.5">가용성 (색상)</div>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => toggleStatus("24시간")}
                className={`flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded transition-all ${
                  selectedStatus.includes("24시간")
                    ? "bg-green-500/20"
                    : "opacity-40 hover:opacity-70"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${selectedStatus.includes("24시간") ? "bg-green-500" : "bg-green-500/40"}`} />
                <span className={selectedStatus.includes("24시간") ? "text-gray-300" : "text-gray-500"}>24시간</span>
              </button>
              <button
                onClick={() => toggleStatus("주간")}
                className={`flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded transition-all ${
                  selectedStatus.includes("주간")
                    ? "bg-blue-500/20"
                    : "opacity-40 hover:opacity-70"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${selectedStatus.includes("주간") ? "bg-blue-500" : "bg-blue-500/40"}`} />
                <span className={selectedStatus.includes("주간") ? "text-gray-300" : "text-gray-500"}>주간</span>
              </button>
              <button
                onClick={() => toggleStatus("야간")}
                className={`flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded transition-all ${
                  selectedStatus.includes("야간")
                    ? "bg-purple-500/20"
                    : "opacity-40 hover:opacity-70"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${selectedStatus.includes("야간") ? "bg-purple-500" : "bg-purple-500/40"}`} />
                <span className={selectedStatus.includes("야간") ? "text-gray-300" : "text-gray-500"}>야간</span>
              </button>
              <button
                onClick={() => toggleStatus("불가")}
                className={`flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded transition-all ${
                  selectedStatus.includes("불가")
                    ? "bg-gray-500/20"
                    : "opacity-40 hover:opacity-70"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${selectedStatus.includes("불가") ? "bg-gray-500" : "bg-gray-500/40"}`} />
                <span className={selectedStatus.includes("불가") ? "text-gray-400" : "text-gray-600"}>불가</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Map */}
        <main className="flex-1 relative">
          {!showDetailMap ? (
            <KoreaSidoMap
              hospitals={hospitals}
              diseaseData={allData}
              selectedDisease={selectedDisease}
              selectedDay={selectedDay}
              selectedStatus={selectedStatus}
              selectedClassifications={selectedClassifications}
              selectedRegion={selectedRegion}
              onRegionSelect={handleRegionSelect}
              hoveredHospitalCode={hoveredHospitalCode}
              onHospitalHover={handleHospitalHover}
              bedDataMap={bedDataMap}
              selectedBedTypes={selectedBedTypes}
              severeDataMap={severeDataMap}
            />
          ) : (
            <KoreaGugunMap
              selectedRegion={selectedRegion}
              hospitals={hospitals}
              diseaseData={allData}
              selectedDisease={selectedDisease}
              selectedDay={selectedDay}
              selectedStatus={selectedStatus}
              selectedClassifications={selectedClassifications}
              onBackToNational={handleBackToNational}
              hoveredHospitalCode={hoveredHospitalCode}
              onHospitalHover={handleHospitalHover}
              bedDataMap={bedDataMap}
              selectedBedTypes={selectedBedTypes}
              severeDataMap={severeDataMap}
            />
          )}
        </main>

        {/* 우측 사이드바: 병원 목록 */}
        <aside className="w-64 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="p-2 border-b border-gray-800">
            <label className="text-xs font-medium text-gray-400">
              {getSidebarRegionLabel()} 병원 ({filteredHospitals.length})
            </label>
          </div>
          <div
            ref={hospitalListRef}
            className="flex-1 overflow-y-auto p-2 space-y-0.5"
          >
            {filteredHospitals.map((hospital) => {
              const status = getHospitalStatus(hospital);
              const isHovered = hoveredHospitalCode === hospital.code;
              const shortClass = getClassificationShort(hospital.classification);
              return (
                <div
                  key={hospital.code}
                  data-hospital-code={hospital.code}
                  className={`px-1.5 py-1 rounded border text-[11px] cursor-pointer transition-all duration-200 ${getStatusBgColor(status, isHovered)} ${
                    isHovered ? 'ring-1 ring-white/30' : ''
                  }`}
                  onMouseEnter={() => handleHospitalHover(hospital.code)}
                  onMouseLeave={() => handleHospitalHover(null)}
                  onClick={() => handleHospitalHover(hospital.code)}
                >
                  <div className="flex items-center gap-1">
                    {shortClass && (
                      <span className={`shrink-0 text-[9px] px-1 py-0.5 rounded ${isHovered ? 'bg-gray-600 text-gray-200' : 'bg-gray-700 text-gray-400'}`}>
                        {shortClass}
                      </span>
                    )}
                    <span className={`font-medium truncate flex-1 ${isHovered ? 'text-white' : 'text-gray-200'}`}>
                      {hospital.name}
                    </span>
                    {status && (
                      <span className={`shrink-0 text-[10px] ${getStatusColor(status)}`}>
                        {status}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredHospitals.length === 0 && (
              <div className="text-center text-gray-500 text-xs py-4">
                조건에 맞는 병원이 없습니다
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
