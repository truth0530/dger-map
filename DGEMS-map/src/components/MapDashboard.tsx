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
import { SEVERE_TYPES } from "@/lib/constants/dger";

// 모바일 사이드바 상태
type MobilePanelType = "filter" | "list" | null;

type EmergencyClassification = "권역응급의료센터" | "지역응급의료센터" | "지역응급의료기관";
type SevereTypeKey = typeof SEVERE_TYPES[number]['key'];

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
  const [selectedRegion, setSelectedRegion] = useState<string>("대구광역시");
  const [hoveredHospitalCode, setHoveredHospitalCode] = useState<string | null>(null);
  const [showDetailMap, setShowDetailMap] = useState(true);  // 상세 지도 표시 여부 (대구 기본)
  const [selectedBedTypes, setSelectedBedTypes] = useState<Set<BedType>>(new Set(['general']));
  const [selectedSevereType, setSelectedSevereType] = useState<SevereTypeKey | null>(null);  // 선택된 27개 중증질환
  const [searchQuery, setSearchQuery] = useState<string>("");  // 병원명 검색어
  const [mobilePanel, setMobilePanel] = useState<MobilePanelType>(null);  // 모바일 패널 상태

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

  // 선택된 27개 중증질환 통계
  const severeStats = useMemo(() => {
    if (!selectedSevereType) return null;
    let available = 0;
    let unavailable = 0;
    let noInfo = 0;

    severeData.forEach((hospital) => {
      const status = (hospital.severeStatus[selectedSevereType] || '').trim().toUpperCase();
      if (status === 'Y') available++;
      else if (status === 'N' || status === '불가능') unavailable++;
      else noInfo++;
    });

    return { available, unavailable, noInfo, total: severeData.length };
  }, [severeData, selectedSevereType]);

  // 선택된 지역의 병원 목록 (사이드바용)
  const filteredHospitals = useMemo(() => {
    // 전국 선택 시 대구 병원만 표시 (진료정보 있음), 그 외는 해당 지역 병원 전체
    const targetRegion = selectedRegion === "all" ? "대구광역시" : selectedRegion;
    const isDaeguRegion = selectedRegion === "all" || selectedRegion === "대구광역시";

    // 27개 중증질환이 선택된 경우 severeDataMap에서 필터링
    if (selectedSevereType) {
      return severeData
        .filter((severe) => {
          const severeStatus = (severe.severeStatus[selectedSevereType] || '').trim().toUpperCase();
          return severeStatus === 'Y';  // 가능한 병원만 표시
        })
        .map((severe) => {
          // severeData에서 hospitals 정보와 매칭
          const hospital = hospitals.find((h) => h.code === severe.hpid);
          return hospital || {
            code: severe.hpid,
            name: severe.dutyName,
            lat: null,
            lng: null,
            classification: severe.dutyEmclsName,
            region: selectedRegion === "all" ? "대구광역시" : selectedRegion,
            hasDiseaseData: false,
          } as Hospital;
        })
        .filter((hospital) => {
          // 기관 종류 필터
          if (
            selectedClassifications.length > 0 &&
            hospital.classification &&
            !selectedClassifications.includes(hospital.classification as EmergencyClassification)
          ) {
            return false;
          }
          return true;
        });
    }

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
  }, [hospitals, allData, selectedRegion, selectedDisease, selectedDay, selectedStatus, selectedClassifications, selectedSevereType, severeData]);

  // 검색어로 필터링된 병원 목록
  const searchedHospitals = useMemo(() => {
    if (!searchQuery.trim()) return filteredHospitals;
    const query = searchQuery.trim().toLowerCase();
    return filteredHospitals.filter((hospital) =>
      hospital.name.toLowerCase().includes(query)
    );
  }, [filteredHospitals, searchQuery]);

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

  // 모바일 패널 닫기
  const closeMobilePanel = () => setMobilePanel(null);

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-3 md:px-4 py-2">
        <div className="flex items-center justify-between">
          <h1 className="text-sm md:text-lg font-bold text-white truncate">중증응급질환 진료 현황</h1>
          <span className="text-[10px] md:text-xs text-gray-500 hidden sm:block">
            전국 {meta.totalHospitals}개 응급의료기관 | 대구 {meta.daeguHospitals}개 진료정보
          </span>
          {/* 모바일 메뉴 버튼 */}
          <div className="flex md:hidden gap-1">
            <button
              onClick={() => setMobilePanel(mobilePanel === "filter" ? null : "filter")}
              className={`p-2 rounded ${mobilePanel === "filter" ? "bg-cyan-600" : "bg-gray-800"}`}
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
            <button
              onClick={() => setMobilePanel(mobilePanel === "list" ? null : "list")}
              className={`p-2 rounded ${mobilePanel === "list" ? "bg-cyan-600" : "bg-gray-800"}`}
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* 좌측 사이드바 - 데스크탑에서만 표시 */}
        <aside className="hidden md:flex w-56 bg-gray-900 border-r border-gray-800 flex-col overflow-y-auto">
          {/* 지역/요일 선택 */}
          <div className="px-3 py-3 border-b border-gray-800">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">지역</label>
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
                <label className="text-[10px] text-gray-500 mb-1 block">요일</label>
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
          </div>

          {/* 질환 선택 (44개 + 27개 가로 배치) */}
          <div className="px-3 py-3 border-b border-gray-800">
            <div className="grid grid-cols-2 gap-2">
              {/* 자원조사 44개 */}
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">자원조사 44개</label>
                <Select
                  value={selectedDisease || "none"}
                  onValueChange={(v) => setSelectedDisease(v === "none" ? null : v)}
                >
                  <SelectTrigger className="h-7 text-xs bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="선택..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 bg-gray-800 border-gray-700">
                    <SelectItem value="none" className="text-xs text-gray-400 hover:bg-gray-700">전체</SelectItem>
                    {diseases.map((d) => (
                      <SelectItem key={d.id} value={d.name} className="text-xs text-white hover:bg-gray-700">
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* 실시간 27개 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-gray-500">실시간 27개</label>
                  {severeLoading && <span className="text-[9px] text-orange-400">로딩...</span>}
                </div>
                <Select
                  value={selectedSevereType || "none"}
                  onValueChange={(v) => setSelectedSevereType(v === "none" ? null : v as SevereTypeKey)}
                >
                  <SelectTrigger className="h-7 text-xs bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="선택..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 bg-gray-800 border-gray-700">
                    <SelectItem value="none" className="text-xs text-gray-400 hover:bg-gray-700">전체</SelectItem>
                    {SEVERE_TYPES.map((type) => (
                      <SelectItem key={type.key} value={type.key} className="text-xs text-white hover:bg-gray-700">
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* 통계 표시 */}
            {(stats || severeStats) && (
              <div className="flex items-center gap-3 mt-2 text-[11px]">
                {stats && (
                  <>
                    <span className="text-green-400">{stats.h24} <span className="text-gray-600">24h</span></span>
                    <span className="text-blue-400">{stats.day} <span className="text-gray-600">주간</span></span>
                    <span className="text-purple-400">{stats.night} <span className="text-gray-600">야간</span></span>
                  </>
                )}
                {severeStats && (
                  <>
                    <span className="text-green-400">{severeStats.available} <span className="text-gray-600">가능</span></span>
                    <span className="text-red-400">{severeStats.unavailable} <span className="text-gray-600">불가</span></span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 병상 유형 */}
          <div className="px-3 py-3 border-b border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] text-gray-500">병상 유형</label>
              {bedLoading && <span className="text-[9px] text-orange-400">로딩...</span>}
            </div>
            <div className="flex flex-wrap gap-1">
              {(Object.entries(BED_TYPE_CONFIG) as [BedType, typeof BED_TYPE_CONFIG[BedType]][]).map(([type, config]) => (
                <button
                  key={type}
                  onClick={() => toggleBedType(type)}
                  className={`text-[10px] px-2 py-1 rounded transition-colors ${
                    selectedBedTypes.has(type)
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "text-gray-500 hover:text-gray-400"
                  }`}
                >
                  {config.shortLabel}
                </button>
              ))}
            </div>
          </div>

          {/* 기관종류 필터 */}
          <div className="px-3 py-3 border-b border-gray-800">
            <label className="text-[10px] text-gray-500 mb-2 block">기관분류</label>
            <div className="flex gap-3">
              <button
                onClick={() => toggleClassification("권역응급의료센터")}
                className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                  selectedClassifications.includes("권역응급의료센터") ? "text-gray-300" : "text-gray-600"
                }`}
              >
                <span className={`w-2 h-2 rotate-45 border ${selectedClassifications.includes("권역응급의료센터") ? "border-gray-300" : "border-gray-600"}`} />
                권역
              </button>
              <button
                onClick={() => toggleClassification("지역응급의료센터")}
                className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                  selectedClassifications.includes("지역응급의료센터") ? "text-gray-300" : "text-gray-600"
                }`}
              >
                <span className={`w-2 h-2 rounded-sm border ${selectedClassifications.includes("지역응급의료센터") ? "border-gray-300" : "border-gray-600"}`} />
                센터
              </button>
              <button
                onClick={() => toggleClassification("지역응급의료기관")}
                className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                  selectedClassifications.includes("지역응급의료기관") ? "text-gray-300" : "text-gray-600"
                }`}
              >
                <svg width="8" height="8" viewBox="0 0 10 10">
                  <path
                    d="M5 1 L9 9 L1 9 Z"
                    fill="none"
                    stroke={selectedClassifications.includes("지역응급의료기관") ? "#d1d5db" : "#4b5563"}
                    strokeWidth="1.5"
                  />
                </svg>
                기관
              </button>
            </div>
          </div>

          {/* 가용성 필터 */}
          <div className="px-3 py-3">
            <label className="text-[10px] text-gray-500 mb-2 block">가용성</label>
            <div className="flex gap-3">
              <button
                onClick={() => toggleStatus("24시간")}
                className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                  selectedStatus.includes("24시간") ? "text-green-400" : "text-gray-600"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${selectedStatus.includes("24시간") ? "bg-green-500" : "bg-gray-600"}`} />
                24h
              </button>
              <button
                onClick={() => toggleStatus("주간")}
                className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                  selectedStatus.includes("주간") ? "text-blue-400" : "text-gray-600"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${selectedStatus.includes("주간") ? "bg-blue-500" : "bg-gray-600"}`} />
                주간
              </button>
              <button
                onClick={() => toggleStatus("야간")}
                className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                  selectedStatus.includes("야간") ? "text-purple-400" : "text-gray-600"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${selectedStatus.includes("야간") ? "bg-purple-500" : "bg-gray-600"}`} />
                야간
              </button>
              <button
                onClick={() => toggleStatus("불가")}
                className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                  selectedStatus.includes("불가") ? "text-gray-400" : "text-gray-600"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${selectedStatus.includes("불가") ? "bg-gray-500" : "bg-gray-600"}`} />
                불가
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
              selectedSevereType={selectedSevereType}
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
              selectedSevereType={selectedSevereType}
            />
          )}
        </main>

        {/* 우측 사이드바: 병원 목록 - 데스크탑에서만 표시 */}
        <aside className="hidden md:flex w-64 bg-gray-900 border-l border-gray-800 flex-col">
          {/* 검색창 */}
          <div className="p-2 border-b border-gray-800">
            <div className="relative">
              <svg
                className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="병원명 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 pl-7 pr-2 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="px-2 py-1.5 border-b border-gray-800">
            <label className="text-xs font-medium text-gray-400">
              {getSidebarRegionLabel()} 병원 ({searchedHospitals.length}{searchQuery ? `/${filteredHospitals.length}` : ''})
            </label>
          </div>
          <div
            ref={hospitalListRef}
            className="flex-1 overflow-y-auto p-2 space-y-0.5"
          >
            {searchedHospitals.map((hospital) => {
              const status = getHospitalStatus(hospital);
              const isHovered = hoveredHospitalCode === hospital.code;
              const shortClass = getClassificationShort(hospital.classification);

              // 27개 중증질환 선택 시 배경색 및 상태 표시 변경
              const severeInfo = selectedSevereType ? severeDataMap.get(hospital.code) : null;
              const severeStatus = severeInfo ? (severeInfo.severeStatus[selectedSevereType!] || '').trim().toUpperCase() : null;
              const isSevereAvailable = severeStatus === 'Y';

              // 배경색 결정
              const bgClass = selectedSevereType
                ? (isHovered
                    ? "bg-green-500/30 border-green-400"
                    : "bg-green-500/20 border-green-500/40")
                : getStatusBgColor(status, isHovered);

              return (
                <div
                  key={hospital.code}
                  data-hospital-code={hospital.code}
                  className={`px-1.5 py-1 rounded border text-[11px] cursor-pointer transition-all duration-200 ${bgClass} ${
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
                    {selectedSevereType && isSevereAvailable ? (
                      <span className="shrink-0 text-[10px] text-green-400">가능</span>
                    ) : status && !selectedSevereType ? (
                      <span className={`shrink-0 text-[10px] ${getStatusColor(status)}`}>
                        {status}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {searchedHospitals.length === 0 && (
              <div className="text-center text-gray-500 text-xs py-4">
                {searchQuery ? "검색 결과가 없습니다" : "조건에 맞는 병원이 없습니다"}
              </div>
            )}
          </div>
        </aside>

        {/* 모바일 오버레이 */}
        {mobilePanel && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={closeMobilePanel}
          />
        )}

        {/* 모바일 필터 패널 */}
        <div
          className={`md:hidden fixed top-12 left-0 bottom-0 w-64 bg-gray-900 border-r border-gray-800 z-50 transform transition-transform duration-300 ${
            mobilePanel === "filter" ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-3 border-b border-gray-800">
            <span className="text-sm font-medium text-white">필터</span>
            <button onClick={closeMobilePanel} className="p-1 text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto h-[calc(100%-48px)]">
            {/* 지역/요일 선택 */}
            <div className="px-3 py-3 border-b border-gray-800">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">지역</label>
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
                  <label className="text-[10px] text-gray-500 mb-1 block">요일</label>
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
            </div>

            {/* 질환 선택 */}
            <div className="px-3 py-3 border-b border-gray-800">
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">자원조사 44개</label>
                  <Select
                    value={selectedDisease || "none"}
                    onValueChange={(v) => setSelectedDisease(v === "none" ? null : v)}
                  >
                    <SelectTrigger className="h-7 text-xs bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="선택..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 bg-gray-800 border-gray-700">
                      <SelectItem value="none" className="text-xs text-gray-400 hover:bg-gray-700">전체</SelectItem>
                      {diseases.map((d) => (
                        <SelectItem key={d.id} value={d.name} className="text-xs text-white hover:bg-gray-700">
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">실시간 27개</label>
                  <Select
                    value={selectedSevereType || "none"}
                    onValueChange={(v) => setSelectedSevereType(v === "none" ? null : v as SevereTypeKey)}
                  >
                    <SelectTrigger className="h-7 text-xs bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="선택..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 bg-gray-800 border-gray-700">
                      <SelectItem value="none" className="text-xs text-gray-400 hover:bg-gray-700">전체</SelectItem>
                      {SEVERE_TYPES.map((type) => (
                        <SelectItem key={type.key} value={type.key} className="text-xs text-white hover:bg-gray-700">
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 기관분류 필터 */}
            <div className="px-3 py-3 border-b border-gray-800">
              <label className="text-[10px] text-gray-500 mb-2 block">기관분류</label>
              <div className="flex gap-3">
                <button
                  onClick={() => toggleClassification("권역응급의료센터")}
                  className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                    selectedClassifications.includes("권역응급의료센터") ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  <span className={`w-2 h-2 rotate-45 border ${selectedClassifications.includes("권역응급의료센터") ? "border-gray-300" : "border-gray-600"}`} />
                  권역
                </button>
                <button
                  onClick={() => toggleClassification("지역응급의료센터")}
                  className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                    selectedClassifications.includes("지역응급의료센터") ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-sm border ${selectedClassifications.includes("지역응급의료센터") ? "border-gray-300" : "border-gray-600"}`} />
                  센터
                </button>
                <button
                  onClick={() => toggleClassification("지역응급의료기관")}
                  className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                    selectedClassifications.includes("지역응급의료기관") ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  <svg width="8" height="8" viewBox="0 0 10 10">
                    <path
                      d="M5 1 L9 9 L1 9 Z"
                      fill="none"
                      stroke={selectedClassifications.includes("지역응급의료기관") ? "#d1d5db" : "#4b5563"}
                      strokeWidth="1.5"
                    />
                  </svg>
                  기관
                </button>
              </div>
            </div>

            {/* 가용성 필터 */}
            <div className="px-3 py-3">
              <label className="text-[10px] text-gray-500 mb-2 block">가용성</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => toggleStatus("24시간")}
                  className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                    selectedStatus.includes("24시간") ? "text-green-400" : "text-gray-600"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${selectedStatus.includes("24시간") ? "bg-green-500" : "bg-gray-600"}`} />
                  24h
                </button>
                <button
                  onClick={() => toggleStatus("주간")}
                  className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                    selectedStatus.includes("주간") ? "text-blue-400" : "text-gray-600"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${selectedStatus.includes("주간") ? "bg-blue-500" : "bg-gray-600"}`} />
                  주간
                </button>
                <button
                  onClick={() => toggleStatus("야간")}
                  className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                    selectedStatus.includes("야간") ? "text-purple-400" : "text-gray-600"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${selectedStatus.includes("야간") ? "bg-purple-500" : "bg-gray-600"}`} />
                  야간
                </button>
                <button
                  onClick={() => toggleStatus("불가")}
                  className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                    selectedStatus.includes("불가") ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${selectedStatus.includes("불가") ? "bg-gray-500" : "bg-gray-600"}`} />
                  불가
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 모바일 병원 목록 패널 */}
        <div
          className={`md:hidden fixed top-12 right-0 bottom-0 w-72 bg-gray-900 border-l border-gray-800 z-50 transform transition-transform duration-300 ${
            mobilePanel === "list" ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-2 border-b border-gray-800">
            <span className="text-sm font-medium text-white">{getSidebarRegionLabel()} 병원 ({searchedHospitals.length})</span>
            <button onClick={closeMobilePanel} className="p-1 text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* 검색창 */}
          <div className="p-2 border-b border-gray-800">
            <div className="relative">
              <svg
                className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="병원명 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 pl-7 pr-2 text-xs bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          {/* 병원 목록 */}
          <div className="overflow-y-auto h-[calc(100%-96px)] p-2 space-y-0.5">
            {searchedHospitals.map((hospital) => {
              const status = getHospitalStatus(hospital);
              const isHovered = hoveredHospitalCode === hospital.code;
              const shortClass = getClassificationShort(hospital.classification);
              const severeInfo = selectedSevereType ? severeDataMap.get(hospital.code) : null;
              const severeStatus = severeInfo ? (severeInfo.severeStatus[selectedSevereType!] || '').trim().toUpperCase() : null;
              const isSevereAvailable = severeStatus === 'Y';
              const bgClass = selectedSevereType
                ? (isHovered ? "bg-green-500/30 border-green-400" : "bg-green-500/20 border-green-500/40")
                : getStatusBgColor(status, isHovered);

              return (
                <div
                  key={hospital.code}
                  className={`px-1.5 py-1 rounded border text-[11px] cursor-pointer transition-all duration-200 ${bgClass}`}
                  onClick={() => {
                    handleHospitalHover(hospital.code);
                    closeMobilePanel();
                  }}
                >
                  <div className="flex items-center gap-1">
                    {shortClass && (
                      <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-gray-700 text-gray-400">
                        {shortClass}
                      </span>
                    )}
                    <span className="font-medium truncate flex-1 text-gray-200">
                      {hospital.name}
                    </span>
                    {selectedSevereType && isSevereAvailable ? (
                      <span className="shrink-0 text-[10px] text-green-400">가능</span>
                    ) : status && !selectedSevereType ? (
                      <span className={`shrink-0 text-[10px] ${getStatusColor(status)}`}>
                        {status}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {searchedHospitals.length === 0 && (
              <div className="text-center text-gray-500 text-xs py-4">
                {searchQuery ? "검색 결과가 없습니다" : "조건에 맞는 병원이 없습니다"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
