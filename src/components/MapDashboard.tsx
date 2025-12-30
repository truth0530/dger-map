"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Combobox } from "@/components/ui/combobox";
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
import { useTheme } from "@/lib/contexts/ThemeContext";
import dynamic from "next/dynamic";
import { shortenHospitalName } from "@/lib/utils/hospitalUtils";
import { OccupancyBattery } from "@/components/ui/OccupancyBattery";

// HybridMap은 클라이언트에서만 로드 (MapLibre + SVG 토글)
const HybridMap = dynamic(() => import("@/components/maplibre/HybridMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-900">
      <div className="text-gray-400 text-sm">지도 로딩 중...</div>
    </div>
  ),
});
import { useBedData, HospitalBedData } from "@/lib/hooks/useBedData";
import { useSevereData, HospitalSevereData } from "@/lib/hooks/useSevereData";
import { useEmergencyMessages } from "@/lib/hooks/useEmergencyMessages";
import { useTravelTime, HospitalTravelTime, HospitalCoordinate } from "@/lib/hooks/useTravelTime";
import { mapSidoName } from "@/lib/utils/regionMapping";
import { BedType, BED_TYPE_CONFIG } from "@/lib/constants/bedTypes";
import { SEVERE_TYPES } from "@/lib/constants/dger";
import { DISEASE_CATEGORIES, getCategoryByKey, getDiseaseNamesByCategory, getMatchedSevereKeys } from "@/lib/constants/diseaseCategories";
import { parseMessage, parseMessageWithHighlights, getHighlightClassWithTheme, replaceUnavailableWithX } from "@/lib/utils/messageClassifier";

// 모바일 사이드바 상태
type MobilePanelType = "filter" | "list" | null;

type EmergencyClassification = "권역응급의료센터" | "지역응급의료센터" | "지역응급의료기관";
type SevereTypeKey = typeof SEVERE_TYPES[number]['key'];
type BedStatus = "여유" | "적정" | "부족";
type SortMode = "default" | "travelTime";

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
  const { isDark } = useTheme();
  // 42개 자원조사: 대분류 + 소분류 상태
  const [selectedDiseaseCategory, setSelectedDiseaseCategory] = useState<string | null>(null);  // 대분류 키
  const [selectedDiseaseSubcategories, setSelectedDiseaseSubcategories] = useState<Set<string>>(new Set());  // 소분류 질환명들
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getTodayDayOfWeek());
  const [selectedStatus, setSelectedStatus] = useState<AvailabilityStatus[]>(["24시간", "주간", "야간"]);
  const [selectedClassifications, setSelectedClassifications] = useState<EmergencyClassification[]>([
    "권역응급의료센터", "지역응급의료센터", "지역응급의료기관"
  ]);
  const [selectedRegion, setSelectedRegion] = useState<string>("대구광역시");
  const [hoveredHospitalCode, setHoveredHospitalCode] = useState<string | null>(null);
  const [selectedBedTypes, setSelectedBedTypes] = useState<Set<BedType>>(new Set(['general']));
  const [selectedBedStatus, setSelectedBedStatus] = useState<BedStatus[]>(["여유", "적정", "부족"]);  // 병상 상태 필터
  const [selectedSevereType, setSelectedSevereType] = useState<SevereTypeKey | null>(null);  // 선택된 27개 중증질환
  const [searchQuery, setSearchQuery] = useState<string>("");  // 병원명 검색어
  const [mobilePanel, setMobilePanel] = useState<MobilePanelType>(null);  // 모바일 패널 상태
  const [expandedHospitalCode, setExpandedHospitalCode] = useState<string | null>(null);  // 확장된 병원 코드
  const [sortMode, setSortMode] = useState<SortMode>("default");  // 정렬 모드

  // 아코디언 상태 관리
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["region", "disease", "bed"]));

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  const hospitalListRef = useRef<HTMLDivElement>(null);

  const hospitals = getHospitals();
  const diseases = getDiseases();
  const allData = getAllData();
  const meta = getMeta();

  // 병상 데이터 훅
  const { data: bedData, fetchBedData, loading: bedLoading } = useBedData();
  // 중증질환 데이터 훅
  const { data: severeData, fetchSevereData, loading: severeLoading } = useSevereData();
  // 응급 메시지 훅
  const { messages: emergencyMessages, fetchMessages: fetchEmergencyMessages } = useEmergencyMessages();
  // 소요시간 훅
  const {
    userLocation,
    locationLoading,
    locationError,
    requestLocation,
    travelTimes,
    travelTimeLoading,
    fetchTravelTimes,
    formatDuration,
  } = useTravelTime();

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

  // 선택된 소분류들의 통계 (OR 조건으로 집계)
  const stats = useMemo(() => {
    if (selectedDiseaseSubcategories.size === 0) return null;

    // 선택된 모든 소분류의 데이터 합산
    const diseaseData = allData.filter((d) => selectedDiseaseSubcategories.has(d.질환명));
    const result = { h24: 0, day: 0, night: 0, no: 0, total: diseaseData.length };
    diseaseData.forEach((item) => {
      const status = item[selectedDay] as AvailabilityStatus;
      if (status === "24시간") result.h24++;
      else if (status === "주간") result.day++;
      else if (status === "야간") result.night++;
      else result.no++;
    });
    return result;
  }, [allData, selectedDiseaseSubcategories, selectedDay]);

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

  // 병상 상태 계산 헬퍼 함수
  const getBedStatusForHospital = useCallback((hospitalCode: string): BedStatus | null => {
    const bed = bedDataMap.get(hospitalCode);
    if (!bed) return null;

    const occupancyRate = bed.occupancyRate ?? 0;
    if (occupancyRate < 70) return "여유";
    if (occupancyRate < 90) return "적정";
    return "부족";
  }, [bedDataMap]);

  // 병상 유형 운영 여부 확인 헬퍼 함수
  const hasBedType = useCallback((hospitalCode: string, bedType: BedType): boolean => {
    const bed = bedDataMap.get(hospitalCode);
    if (!bed) return false;

    const config = BED_TYPE_CONFIG[bedType];
    const totalBeds = bed[config.totalKey] as number;
    return totalBeds > 0;
  }, [bedDataMap]);

  // 선택된 병상 유형 중 하나라도 운영하는지 확인
  const hasAnySelectedBedType = useCallback((hospitalCode: string): boolean => {
    if (selectedBedTypes.size === 0) return true;

    for (const bedType of selectedBedTypes) {
      if (hasBedType(hospitalCode, bedType)) {
        return true;
      }
    }
    return false;
  }, [selectedBedTypes, hasBedType]);

  // 선택된 지역의 병원 목록 (사이드바용)
  // 모든 필터가 AND 조건으로 작동
  const filteredHospitals = useMemo(() => {
    // 전국 선택 시 대구 병원만 표시 (진료정보 있음), 그 외는 해당 지역 병원 전체
    const targetRegion = selectedRegion === "all" ? "대구광역시" : selectedRegion;
    const isDaeguRegion = selectedRegion === "all" || selectedRegion === "대구광역시";

    // 27개 중증질환이 'Y'인 병원 코드 Set 생성
    const severeAvailableHospitals = new Set<string>();
    if (selectedSevereType) {
      severeData.forEach((severe) => {
        const severeStatus = (severe.severeStatus[selectedSevereType] || '').trim().toUpperCase();
        if (severeStatus === 'Y') {
          severeAvailableHospitals.add(severe.hpid);
        }
      });
    }

    return hospitals.filter((hospital) => {
      // 1. 지역 필터
      if (hospital.region !== targetRegion) return false;

      // 2. 대구 지역은 진료정보 있는 병원만
      if (isDaeguRegion && !hospital.hasDiseaseData) return false;

      // 3. 기관 종류 필터
      if (
        selectedClassifications.length > 0 &&
        hospital.classification &&
        !selectedClassifications.includes(hospital.classification as EmergencyClassification)
      ) {
        return false;
      }

      // 4. 병상 유형 필터 - 선택된 병상 유형을 운영하는 병원만
      if (!hasAnySelectedBedType(hospital.code)) {
        return false;
      }

      // 5. 병상 상태 필터
      if (selectedBedStatus.length < 3) {
        const bedStatus = getBedStatusForHospital(hospital.code);
        if (bedStatus && !selectedBedStatus.includes(bedStatus)) {
          return false;
        }
      }

      // 6. 27개 중증질환 필터 (AND 조건)
      if (selectedSevereType) {
        if (!severeAvailableHospitals.has(hospital.code)) {
          return false;
        }
      }

      // 7. 42개 자원조사 필터 (소분류끼리는 OR 조건, 다른 필터와는 AND)
      if (isDaeguRegion && selectedDiseaseSubcategories.size > 0) {
        // 소분류 중 하나라도 가용성 조건 만족하면 통과 (OR)
        let hasMatchingDisease = false;
        for (const diseaseName of selectedDiseaseSubcategories) {
          const data = allData.find(
            (d) => d.소속기관코드 === hospital.code && d.질환명 === diseaseName
          );
          if (data) {
            const status = data[selectedDay] as AvailabilityStatus;
            if (selectedStatus.includes(status)) {
              hasMatchingDisease = true;
              break;
            }
          }
        }
        if (!hasMatchingDisease) return false;
      }

      return true;
    });
  }, [hospitals, allData, selectedRegion, selectedDiseaseSubcategories, selectedDay, selectedStatus, selectedClassifications, selectedSevereType, severeData, selectedBedStatus, getBedStatusForHospital, hasAnySelectedBedType]);

  // 센터급 여부 확인 (권역응급의료센터, 지역응급의료센터는 센터급)
  const isCenterLevel = (classification: string | undefined): boolean => {
    return classification === "권역응급의료센터" || classification === "지역응급의료센터";
  };

  // 검색어로 필터링 및 정렬된 병원 목록
  const searchedHospitals = useMemo(() => {
    let result = filteredHospitals;

    // 검색어 필터링
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((hospital) =>
        hospital.name.toLowerCase().includes(query)
      );
    }

    // 정렬: 센터급/기관급 그룹 분리 후 각 그룹 내에서 정렬
    result = [...result].sort((a, b) => {
      // 1. 센터급 vs 기관급 그룹 분리 (센터급이 먼저)
      const aIsCenter = isCenterLevel(a.classification);
      const bIsCenter = isCenterLevel(b.classification);
      if (aIsCenter && !bIsCenter) return -1;
      if (!aIsCenter && bIsCenter) return 1;

      // 2. 같은 그룹 내에서 정렬
      if (sortMode === "travelTime" && travelTimes.size > 0) {
        // 소요시간순 정렬
        const aTime = travelTimes.get(a.code)?.duration;
        const bTime = travelTimes.get(b.code)?.duration;

        // 소요시간이 있는 병원 우선
        if (aTime !== null && aTime !== undefined && (bTime === null || bTime === undefined)) return -1;
        if ((aTime === null || aTime === undefined) && bTime !== null && bTime !== undefined) return 1;

        // 둘 다 소요시간이 있으면 짧은 순
        if (aTime !== null && aTime !== undefined && bTime !== null && bTime !== undefined) {
          return aTime - bTime;
        }
      } else {
        // 포화도순 정렬 (default)
        const aRate = bedDataMap.get(a.code)?.occupancyRate ?? 100;
        const bRate = bedDataMap.get(b.code)?.occupancyRate ?? 100;
        return aRate - bRate; // 낮은 포화도(여유)가 먼저
      }

      return 0;
    });

    return result;
  }, [filteredHospitals, searchQuery, sortMode, travelTimes, bedDataMap]);

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

  const toggleBedStatus = (status: BedStatus) => {
    setSelectedBedStatus((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
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

  // 대분류 선택 시 모든 소분류 자동 선택
  const handleCategoryChange = useCallback((categoryKey: string | null) => {
    setSelectedDiseaseCategory(categoryKey);
    if (categoryKey) {
      const diseaseNames = getDiseaseNamesByCategory(categoryKey);
      setSelectedDiseaseSubcategories(new Set(diseaseNames));
    } else {
      setSelectedDiseaseSubcategories(new Set());
    }
  }, []);

  // 소분류 토글 (최소 1개는 선택 유지)
  const toggleDiseaseSubcategory = useCallback((diseaseName: string) => {
    setSelectedDiseaseSubcategories(prev => {
      const next = new Set(prev);
      if (next.has(diseaseName)) {
        if (next.size > 1) {
          next.delete(diseaseName);
        }
      } else {
        next.add(diseaseName);
      }
      return next;
    });
  }, []);

  // 현재 선택된 대분류의 카테고리 정보
  const currentCategory = useMemo(() => {
    if (!selectedDiseaseCategory) return null;
    return getCategoryByKey(selectedDiseaseCategory);
  }, [selectedDiseaseCategory]);

  // 병원별 해당 질환 가용성 상태 (OR 조건으로 소분류 중 하나라도 해당되면)
  const getHospitalStatus = (hospital: Hospital): AvailabilityStatus | null => {
    if (selectedDiseaseSubcategories.size === 0) return null;

    // 소분류 중 하나라도 매칭되면 해당 상태 반환 (OR 조건)
    for (const diseaseName of selectedDiseaseSubcategories) {
      const data = allData.find(
        (d) => d.소속기관코드 === hospital.code && d.질환명 === diseaseName
      );
      if (data) {
        const status = data[selectedDay] as AvailabilityStatus;
        // 24시간 > 주간 > 야간 > 불가 순으로 우선순위
        if (status === "24시간") return status;
      }
    }

    // 24시간이 아닌 경우 다시 확인
    for (const diseaseName of selectedDiseaseSubcategories) {
      const data = allData.find(
        (d) => d.소속기관코드 === hospital.code && d.질환명 === diseaseName
      );
      if (data) {
        const status = data[selectedDay] as AvailabilityStatus;
        if (status === "주간" || status === "야간") return status;
      }
    }

    return "불가";
  };

  // 상태별 색상
  const getStatusColor = (status: AvailabilityStatus | null, isDarkMode: boolean = true): string => {
    if (isDarkMode) {
      switch (status) {
        case "24시간": return "text-green-400";
        case "주간": return "text-blue-400";
        case "야간": return "text-purple-400";
        case "불가": return "text-gray-500";
        default: return "text-gray-400";
      }
    } else {
      // Light mode
      switch (status) {
        case "24시간": return "text-green-600";
        case "주간": return "text-blue-600";
        case "야간": return "text-purple-600";
        case "불가": return "text-gray-500";
        default: return "text-gray-500";
      }
    }
  };

  const getStatusBgColor = (status: AvailabilityStatus | null, isHovered: boolean, isDarkMode: boolean = true): string => {
    if (isDarkMode) {
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
    } else {
      // Light mode - 아이보리 계열 테마 적용
      if (isHovered) {
        switch (status) {
          case "24시간": return "bg-green-100 border-green-500";
          case "주간": return "bg-blue-100 border-blue-500";
          case "야간": return "bg-purple-100 border-purple-500";
          case "불가": return "bg-[#ddd6cc] border-[#c8c2b8]";
          default: return "bg-[#ddd6cc] border-[#c8c2b8]";
        }
      }
      switch (status) {
        case "24시간": return "bg-green-50 border-green-300";
        case "주간": return "bg-blue-50 border-blue-300";
        case "야간": return "bg-purple-50 border-purple-300";
        case "불가": return "bg-[#E8E2D8] border-[#d4cdc4]";
        default: return "bg-[#E8E2D8] border-[#d4cdc4]";
      }
    }
  };

  // 사이드바 지역 Select 변경 핸들러
  const handleSidebarRegionChange = (region: string) => {
    setSelectedRegion(region);
  };

  // 내 위치 기반 소요시간 조회
  const handleLocationRequest = useCallback(async () => {
    const location = await requestLocation();
    if (location && filteredHospitals.length > 0) {
      // 병원 좌표 추출
      const hospitalCoords: HospitalCoordinate[] = filteredHospitals
        .filter(h => h.lat && h.lng)
        .map(h => ({
          code: h.code,
          lat: h.lat!,
          lng: h.lng!
        }));

      if (hospitalCoords.length > 0) {
        await fetchTravelTimes(hospitalCoords, location);
        setSortMode("travelTime");
      }
    }
  }, [requestLocation, fetchTravelTimes, filteredHospitals]);

  // 전국 지도로 돌아가기 (HybridMap에서 호출)
  const handleBackToNational = () => {
    setSelectedRegion("all");
  };

  // 병원 호버 핸들러
  const handleHospitalHover = useCallback((code: string | null) => {
    setHoveredHospitalCode(code);
    // 호버된 병원의 응급 메시지 가져오기
    if (code) {
      fetchEmergencyMessages(code).catch(err => {
        console.error(`[MapDashboard] 응급 메시지 조회 오류 (${code}):`, err);
      });
    }
  }, [fetchEmergencyMessages]);

  // 사이드바에 표시할 필터 조건 요약
  const getFilterSummary = (): string => {
    const parts: string[] = [];

    // 1. 지역
    if (selectedRegion === "all") {
      parts.push("대구");
    } else {
      const region = REGIONS.find((r) => r.value === selectedRegion);
      parts.push(region?.label || selectedRegion);
    }

    // 2. 요일 (질환 선택 시에만)
    if (selectedDiseaseCategory) {
      parts.push(`${selectedDay}요일`);
    }

    // 3. 질환 대분류
    if (selectedDiseaseCategory) {
      const category = DISEASE_CATEGORIES.find((c) => c.key === selectedDiseaseCategory);
      if (category) {
        parts.push(category.label);
      }
    }

    // 4. 실시간 중증질환
    if (selectedSevereType) {
      const severe = SEVERE_TYPES.find((t) => t.key === selectedSevereType);
      if (severe) {
        parts.push(severe.label);
      }
    }

    return parts.join(", ");
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

  // 기관종류 아이콘 렌더링 (모양으로 구분)
  const renderClassificationIcon = (shortClass: string, isDarkMode: boolean) => {
    const fillClass = isDarkMode ? "fill-gray-400" : "fill-gray-500";
    switch (shortClass) {
      case "권역":
        return <span className={`w-2.5 h-2.5 shrink-0 ${isDarkMode ? "bg-gray-400" : "bg-gray-500"}`} />;
      case "센터":
        return <span className={`w-2.5 h-2.5 shrink-0 rounded-full ${isDarkMode ? "bg-gray-400" : "bg-gray-500"}`} />;
      case "기관":
        return (
          <svg className={`w-2.5 h-2.5 shrink-0 ${fillClass}`} viewBox="0 0 10 10">
            <polygon points="5,0 10,10 0,10" />
          </svg>
        );
      default:
        return null;
    }
  };

  // 사이드바 병원 목록 표시 여부 (항상 표시)
  const showHospitalList = true;

  // 모바일 패널 닫기
  const closeMobilePanel = () => setMobilePanel(null);

  return (
    <div className={`w-screen h-screen flex flex-col overflow-hidden ${isDark ? 'bg-gray-950' : 'bg-[#F5F0E8]'}`}>
      {/* Header */}
      <header className={`border-b px-3 md:px-4 py-2 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-[#E8E2D8] border-gray-300'}`}>
        <div className="flex items-center justify-between">
          <h1 className={`text-sm md:text-lg font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>중증응급질환 진료 현황</h1>

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

      <div className="flex-1 flex relative">
        {/* 좌측 필터 사이드바 */}
        <aside className={`hidden md:flex w-48 flex-col border-r ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-[#E8E2D8] border-[#d4cdc4]'}`}>
          <div className={`flex-1 overflow-y-auto ${isDark ? '' : 'bg-[#E8E2D8]'}`}>
          {/* 지역 + 기관분류 */}
          <div className={`px-2 py-2 border-b ${isDark ? 'border-gray-800' : 'border-[#d4cdc4] bg-[#E8E2D8]'}`}>
            <div className="flex items-start gap-1">
              <div className="w-14 shrink-0">
                <label className={`text-[11px] mb-0.5 block ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>지역</label>
                <Select value={selectedRegion} onValueChange={handleSidebarRegionChange}>
                  <SelectTrigger size="xs" className={`[&_svg]:size-2 ${isDark ? 'bg-transparent border-gray-700 text-white' : 'bg-transparent border border-[#d4cdc4] text-gray-900'}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={isDark ? 'bg-gray-800 border-gray-700' : 'bg-[#FAF7F2] border-[#d4cdc4]'}>
                    {REGIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value} className={`text-[11px] py-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-0">
                <label className={`text-[11px] mb-0.5 block ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>기관</label>
                <div className="flex gap-0.5 items-center">
                  <button
                    onClick={() => toggleClassification("권역응급의료센터")}
                    className={`flex items-center gap-0.5 h-6 text-[10px] px-1 py-0.5 rounded transition-colors whitespace-nowrap ${
                      selectedClassifications.includes("권역응급의료센터")
                        ? isDark ? "bg-cyan-500/20 text-white" : "bg-[#4A5D5D] text-white"
                        : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <span className={`w-2 h-2 shrink-0 ${selectedClassifications.includes("권역응급의료센터") ? "bg-white" : isDark ? "bg-gray-500" : "bg-gray-400"}`} />
                    권역
                  </button>
                  <button
                    onClick={() => toggleClassification("지역응급의료센터")}
                    className={`flex items-center gap-0.5 h-6 text-[10px] px-1 py-0.5 rounded transition-colors whitespace-nowrap ${
                      selectedClassifications.includes("지역응급의료센터")
                        ? isDark ? "bg-cyan-500/20 text-white" : "bg-[#4A5D5D] text-white"
                        : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <span className={`w-2 h-2 shrink-0 rounded-full ${selectedClassifications.includes("지역응급의료센터") ? "bg-white" : isDark ? "bg-gray-500" : "bg-gray-400"}`} />
                    센터
                  </button>
                  <button
                    onClick={() => toggleClassification("지역응급의료기관")}
                    className={`flex items-center gap-0.5 h-6 text-[10px] px-1 py-0.5 rounded transition-colors whitespace-nowrap ${
                      selectedClassifications.includes("지역응급의료기관")
                        ? isDark ? "bg-cyan-500/20 text-white" : "bg-[#4A5D5D] text-white"
                        : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <svg className={`w-2 h-2 shrink-0 ${selectedClassifications.includes("지역응급의료기관") ? "fill-white" : isDark ? "fill-gray-500" : "fill-gray-400"}`} viewBox="0 0 10 10">
                      <polygon points="5,0 10,10 0,10" />
                    </svg>
                    기관
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 질환 선택 */}
          <div className={`px-2 py-2 border-b space-y-1.5 ${isDark ? 'border-gray-800' : 'border-[#d4cdc4] bg-[#E8E2D8]'}`}>
            {/* 42개 자원조사 */}
            <div>
              <Combobox
                options={[
                  { value: "", label: "중증자원조사 42개 선택" },
                  ...DISEASE_CATEGORIES.map((cat) => ({ value: cat.key, label: cat.label })),
                ]}
                value={selectedDiseaseCategory || ""}
                onValueChange={(v) => handleCategoryChange(v || null)}
                placeholder="대분류 선택..."
                size="xs"
                triggerClassName={`${isDark ? 'bg-transparent border-gray-700 text-white' : 'bg-transparent border border-[#d4cdc4] text-gray-900'}`}
                contentClassName={`${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-[#FAF7F2] border-[#d4cdc4] text-gray-900'}`}
              />
              <div className="flex items-center gap-0.5 mt-1">
                <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)}>
                  <SelectTrigger size="xs" className={`w-[58px] [&_svg]:w-[5px] [&_svg]:h-[5px] [&_svg]:ml-0 ${isDark ? 'bg-transparent border-gray-700 text-white' : 'bg-transparent border border-[#d4cdc4] text-gray-900'}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={isDark ? 'bg-gray-800 border-gray-700' : 'bg-[#FAF7F2] border-[#d4cdc4]'}>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day} value={day} className={`text-[11px] py-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {day}요일
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={() => selectedDiseaseCategory && toggleStatus("24시간")}
                  disabled={!selectedDiseaseCategory}
                  className={`text-[9px] px-0.5 py-0.5 rounded transition-colors whitespace-nowrap ${
                    !selectedDiseaseCategory
                      ? isDark ? "text-gray-700 cursor-not-allowed" : "text-gray-400 cursor-not-allowed"
                      : selectedStatus.includes("24시간")
                        ? isDark ? "border border-green-500 text-green-400" : "border border-green-600 text-green-700 bg-green-50"
                        : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  24h{stats ? `(${stats.h24})` : ''}
                </button>
                <button
                  onClick={() => selectedDiseaseCategory && toggleStatus("주간")}
                  disabled={!selectedDiseaseCategory}
                  className={`text-[9px] px-0.5 py-0.5 rounded transition-colors whitespace-nowrap ${
                    !selectedDiseaseCategory
                      ? isDark ? "text-gray-700 cursor-not-allowed" : "text-gray-400 cursor-not-allowed"
                      : selectedStatus.includes("주간")
                        ? isDark ? "border border-blue-500 text-blue-400" : "border border-blue-600 text-blue-700 bg-blue-50"
                        : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  주간{stats ? `(${stats.day})` : ''}
                </button>
                <button
                  onClick={() => selectedDiseaseCategory && toggleStatus("야간")}
                  disabled={!selectedDiseaseCategory}
                  className={`text-[9px] px-0.5 py-0.5 rounded transition-colors whitespace-nowrap ${
                    !selectedDiseaseCategory
                      ? isDark ? "text-gray-700 cursor-not-allowed" : "text-gray-400 cursor-not-allowed"
                      : selectedStatus.includes("야간")
                        ? isDark ? "border border-purple-500 text-purple-400" : "border border-purple-600 text-purple-700 bg-purple-50"
                        : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  야간{stats ? `(${stats.night})` : ''}
                </button>
              </div>
              {currentCategory && currentCategory.subcategories.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {currentCategory.subcategories.map((sub) => (
                    <button
                      key={sub.key}
                      onClick={() => toggleDiseaseSubcategory(sub.key)}
                      className={`text-[11px] px-1 py-0.5 rounded transition-colors ${
                        selectedDiseaseSubcategories.has(sub.key)
                          ? isDark ? "bg-cyan-500/20 text-white" : "bg-[#4A5D5D] text-white"
                          : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* 실시간 27개 */}
            <div className="flex items-center gap-1">
              <Combobox
                options={[
                  { value: "", label: "27개 중증질환 선택" },
                  ...SEVERE_TYPES.map((type) => ({ value: type.key, label: type.label })),
                ]}
                value={selectedSevereType || ""}
                onValueChange={(v) => setSelectedSevereType(v ? (v as SevereTypeKey) : null)}
                placeholder="선택..."
                size="xs"
                triggerClassName={`${isDark ? 'bg-transparent border-gray-700 text-white' : 'bg-transparent border border-[#d4cdc4] text-gray-900'}`}
                contentClassName={`${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-[#FAF7F2] border-[#d4cdc4] text-gray-900'}`}
              />
              {severeLoading && <span className="text-[10px] text-orange-400">로딩...</span>}
            </div>
            {severeStats && (
              <div className="flex items-center gap-3 text-[11px]">
                <span className={isDark ? "text-green-400" : "text-green-600"}>가능 {severeStats.available}</span>
                <span className={isDark ? "text-red-400" : "text-red-600"}>불가 {severeStats.unavailable}</span>
              </div>
            )}
          </div>

          {/* 병상 */}
          <div className={`px-2 py-2 border-b ${isDark ? 'border-gray-800' : 'border-[#d4cdc4] bg-[#E8E2D8]'}`}>
            <div className="flex items-center justify-between mb-1">
              <label className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>병상 정보</label>
              {bedLoading && <span className={`text-[10px] ${isDark ? 'text-orange-400' : 'text-orange-500'}`}>로딩...</span>}
            </div>
            <div className="flex flex-wrap gap-0.5">
              {(Object.entries(BED_TYPE_CONFIG) as [BedType, typeof BED_TYPE_CONFIG[BedType]][]).map(([type, config]) => (
                <button
                  key={type}
                  onClick={() => toggleBedType(type)}
                  className={`text-[10px] px-1 py-0.5 rounded transition-colors ${
                    selectedBedTypes.has(type)
                      ? isDark ? "bg-cyan-500/20 text-white" : "bg-[#4A5D5D] text-white"
                      : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {config.shortLabel}
                </button>
              ))}
            </div>
            <div className="flex gap-1 mt-1">
              <button
                onClick={() => toggleBedStatus("여유")}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  selectedBedStatus.includes("여유")
                    ? isDark ? "bg-green-600 text-white font-medium" : "bg-green-600 text-white font-medium"
                    : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                여유
              </button>
              <button
                onClick={() => toggleBedStatus("적정")}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  selectedBedStatus.includes("적정")
                    ? isDark ? "bg-yellow-500 text-white font-medium" : "bg-yellow-500 text-white font-medium"
                    : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                적정
              </button>
              <button
                onClick={() => toggleBedStatus("부족")}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  selectedBedStatus.includes("부족")
                    ? isDark ? "bg-red-600 text-white font-medium" : "bg-red-600 text-white font-medium"
                    : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                부족
              </button>
            </div>
          </div>

          </div>
        </aside>

        {/* 병원 목록 사이드바 */}
        <aside className={`hidden md:flex w-64 flex-col border-r ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-[#E8E2D8] border-[#d4cdc4]'}`}>
          <div className={`px-1.5 py-1.5 space-y-1.5 border-b ${isDark ? 'border-gray-800' : 'border-[#d4cdc4] bg-[#ddd6cc]'}`}>
            <div className="flex items-center justify-between">
              <label className={`text-[10px] font-medium ${isDark ? 'text-gray-400' : 'text-[#4A5D5D]'}`}>
                {getFilterSummary()} ({searchedHospitals.length})
              </label>
              {(locationLoading || travelTimeLoading) && (
                <span className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin border-current opacity-50"></span>
              )}
            </div>
            {/* 정렬 토글 스위치 */}
            <div className={`flex rounded-md overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-[#c8c2b8]'}`}>
              <button
                onClick={() => setSortMode("default")}
                className={`flex-1 px-2 py-1 text-[11px] font-medium transition-colors ${
                  sortMode === "default"
                    ? isDark ? "bg-cyan-600 text-white" : "bg-[#4A5D5D] text-white"
                    : isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-800"
                }`}
              >
                포화도순
              </button>
              <button
                onClick={handleLocationRequest}
                disabled={locationLoading || travelTimeLoading}
                className={`flex-1 px-2 py-1 text-[11px] font-medium transition-colors ${
                  sortMode === "travelTime"
                    ? isDark ? "bg-cyan-600 text-white" : "bg-[#4A5D5D] text-white"
                    : isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-800"
                } ${(locationLoading || travelTimeLoading) ? "opacity-50" : ""}`}
                title={userLocation ? `현재 위치: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : "내 위치 기반 소요시간 조회"}
              >
                내위치순
              </button>
            </div>
            {locationError && (
              <div className="text-[11px] text-red-400">{locationError}</div>
            )}
            <div className="relative">
              <svg
                className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
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
                className={`w-full h-5 pr-2 text-[11px] rounded focus:outline-none ${isDark ? 'bg-transparent border-none text-white placeholder-gray-500' : 'bg-[#F5F0E8] border border-[#d4cdc4] text-gray-900 placeholder-gray-400'}`}
                style={{ paddingLeft: '20px' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-400 hover:text-gray-500'}`}
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div
            ref={hospitalListRef}
            className={`flex-1 overflow-y-auto p-1.5 space-y-0.5 ${isDark ? 'bg-gray-900' : 'bg-[#F5F0E8]'}`}
          >
            {searchedHospitals.map((hospital) => {
              const status = getHospitalStatus(hospital);
              const isHovered = hoveredHospitalCode === hospital.code;
              const shortClass = getClassificationShort(hospital.classification);
              const bedInfo = bedDataMap.get(hospital.code);
              const occupancyRate = bedInfo?.occupancyRate ?? null;

              const severeInfo = selectedSevereType ? severeDataMap.get(hospital.code) : null;
              const severeStatus = severeInfo ? (severeInfo.severeStatus[selectedSevereType!] || '').trim().toUpperCase() : null;
              const isSevereAvailable = severeStatus === 'Y';

              const bgClass = selectedSevereType
                ? (isHovered ? "bg-green-500/30 border-green-400" : "bg-green-500/20 border-green-500/40")
                : getStatusBgColor(status, isHovered, isDark);

              const isExpanded = expandedHospitalCode === hospital.code;
              const msgData = emergencyMessages.get(hospital.code);

              // 진료제한 항목 수집
              const urgentItems: { label: string; content: string }[] = [];
              if (msgData?.emergency) {
                msgData.emergency.forEach(item => {
                  const parsed = parseMessage(item.msg, item.symTypCod);
                  if (parsed.status.color === 'red') {
                    urgentItems.push({ label: parsed.department, content: parsed.details || '진료불가' });
                  }
                });
              }
              if (msgData?.allDiseases) {
                msgData.allDiseases.forEach(disease => {
                  if (disease.content.includes('불가') || disease.content.includes('중단')) {
                    const displayName = disease.displayName.replace(/\[.*?\]\s*/, '');
                    urgentItems.push({ label: displayName, content: disease.content });
                  }
                });
              }

              // 진료 가능 질환 목록 (severeDataMap에서 직접 조회)
              const hospitalSevereData = severeDataMap.get(hospital.code);
              const matchedSevereKeys = selectedDiseaseCategory ? getMatchedSevereKeys(selectedDiseaseCategory) : [];

              // 연관 질환 중 가용/불가 분리
              const matchedAvailable = matchedSevereKeys
                .map(key => {
                  const disease = SEVERE_TYPES.find(t => t.key === key);
                  const isAvailable = hospitalSevereData?.severeStatus?.[key] === 'Y';
                  return disease && isAvailable ? disease : null;
                })
                .filter((t): t is typeof SEVERE_TYPES[0] => !!t);

              const matchedUnavailable = matchedSevereKeys
                .map(key => {
                  const disease = SEVERE_TYPES.find(t => t.key === key);
                  const isAvailable = hospitalSevereData?.severeStatus?.[key] === 'Y';
                  return disease && !isAvailable ? disease : null;
                })
                .filter((t): t is typeof SEVERE_TYPES[0] => !!t);

              // 연관 질환 제외한 가용 질환
              const otherAvailableDiseases = hospitalSevereData?.severeStatus
                ? Object.entries(hospitalSevereData.severeStatus)
                    .filter(([key, status]) => status === 'Y' && !matchedSevereKeys.includes(key))
                    .map(([key]) => SEVERE_TYPES.find(t => t.key === key))
                    .filter((t): t is typeof SEVERE_TYPES[0] => !!t)
                : [];

              const totalAvailable = matchedAvailable.length + otherAvailableDiseases.length;
              const hasMatchedContent = matchedAvailable.length > 0 || matchedUnavailable.length > 0;

              return (
                <div
                  key={hospital.code}
                  data-hospital-code={hospital.code}
                  className={`rounded text-[11px] cursor-pointer transition-all duration-200 ${bgClass} ${
                    isHovered ? (isDark ? 'ring-1 ring-white/30' : 'ring-1 ring-gray-400/30') : ''
                  }`}
                  onMouseEnter={() => handleHospitalHover(hospital.code)}
                  onMouseLeave={() => handleHospitalHover(null)}
                >
                  {/* 헤더 (클릭 시 아코디언 토글) */}
                  <div
                    className="flex items-center gap-1 px-1.5 py-0.5"
                    onClick={() => setExpandedHospitalCode(isExpanded ? null : hospital.code)}
                  >
                    {shortClass && renderClassificationIcon(shortClass, isDark)}
                    <span
                      className={`font-medium truncate min-w-0 ${isDark ? (isHovered ? 'text-white' : 'text-gray-200') : (isHovered ? 'text-gray-900' : 'text-gray-700')}`}
                      title={hospital.name}
                      style={{ maxWidth: selectedDiseaseCategory ? '70px' : '100px' }}
                    >
                      {shortenHospitalName(hospital.name)}
                    </span>
                    {/* 소요시간 (활성화 시) */}
                    {sortMode === "travelTime" && (
                      <span className="shrink-0 text-[9px] font-medium text-blue-400 whitespace-nowrap">
                        {formatDuration(travelTimes.get(hospital.code)?.duration ?? null)}
                      </span>
                    )}
                    {/* 선택된 질환명(대분류) - 작게 표시 */}
                    {selectedDiseaseCategory && currentCategory && (
                      <span
                        className={`shrink-0 text-[8px] px-1 py-0.5 rounded truncate ${
                          isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                        }`}
                        style={{ maxWidth: '50px' }}
                        title={currentCategory.label}
                      >
                        {currentCategory.label.length > 4 ? currentCategory.label.slice(0, 4) : currentCategory.label}
                      </span>
                    )}
                    {/* 가용상태 */}
                    {selectedSevereType && isSevereAvailable ? (
                      <span className="shrink-0 text-[10px] text-green-400 whitespace-nowrap">가능</span>
                    ) : status && !selectedSevereType ? (
                      <span className={`shrink-0 text-[10px] ${getStatusColor(status, isDark)}`}>
                        {status}
                      </span>
                    ) : null}
                    {/* 배터리 (항상 우측) */}
                    <div className="flex-1" />
                    {occupancyRate !== null && (
                      <div className="shrink-0 scale-[0.7] origin-right whitespace-nowrap">
                        <OccupancyBattery rate={occupancyRate} isDark={isDark} size="medium" />
                      </div>
                    )}
                    <svg
                      className={`w-3 h-3 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* 확장된 상세 정보 */}
                  {isExpanded && (
                    <div className={`px-1.5 py-1 border-t space-y-1 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-[#d4cdc4] bg-[#EDE7DD]'}`}>
                      {/* 병상 현황 */}
                      {bedInfo && (
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>응급실</span>
                          <span className={`text-[10px] font-semibold ${
                            (bedInfo.hvec ?? 0) > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>{bedInfo.hvec ?? 0}</span>
                          <span className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>/ {bedInfo.hvs01 ?? 0}</span>
                          <span className="flex-1" />
                          {bedInfo.hvidate && (
                            <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                              {bedInfo.hvidate.slice(0, 4)}-{bedInfo.hvidate.slice(4, 6)}-{bedInfo.hvidate.slice(6, 8)} {bedInfo.hvidate.slice(8, 10)}:{bedInfo.hvidate.slice(10, 12)} 기준
                            </span>
                          )}
                        </div>
                      )}

                      {/* 실시간 중증질환 (27개) */}
                      <div>
                        <div className={`text-[11px] mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                          실시간 중증질환 ({totalAvailable}/{SEVERE_TYPES.length})
                        </div>

                        {/* 연관 질환 (상위 배치) */}
                        {hasMatchedContent && (
                          <div className="mb-1">
                            {/* 가용 연관 질환 */}
                            {matchedAvailable.length > 0 && (
                              <div className="flex items-baseline gap-1 mb-0.5">
                                <span className="text-[10px] text-green-500">○</span>
                                <span className={`text-[11px] leading-relaxed ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                  {matchedAvailable.map(d => d.label.replace(/\[.*?\]\s*/, '')).join(', ')}
                                </span>
                              </div>
                            )}
                            {/* 불가 연관 질환 */}
                            {matchedUnavailable.length > 0 && (
                              <div className="flex items-baseline gap-1">
                                <span className="text-[10px] text-red-500">✕</span>
                                <span className={`text-[11px] leading-relaxed ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                                  {matchedUnavailable.map(d => d.label.replace(/\[.*?\]\s*/, '')).join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 기타 가용 질환 (점선 구분) */}
                        {otherAvailableDiseases.length > 0 && (
                          <>
                            {hasMatchedContent && (
                              <div className={`border-t border-dashed my-1 ${isDark ? 'border-gray-700' : 'border-gray-300'}`} />
                            )}
                            <div className="flex items-baseline gap-1">
                              <span className="text-[10px] text-green-500">○</span>
                              <span className={`text-[11px] leading-relaxed ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                {otherAvailableDiseases.map(d => d.label.replace(/\[.*?\]\s*/, '')).join(', ')}
                              </span>
                            </div>
                          </>
                        )}

                        {totalAvailable === 0 && !hasMatchedContent && (
                          <div className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>없음</div>
                        )}
                      </div>

                      {/* 진료 제한 (있을 때만 표시) - 하이라이트 정책 적용 */}
                      {urgentItems.length > 0 && (
                        <div className={`p-1 rounded ${isDark ? 'bg-red-900/20' : 'bg-red-50'}`}>
                          <div className={`text-[11px] mb-0.5 font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                            진료제한 ({urgentItems.length})
                          </div>
                          {urgentItems.map((item, idx) => {
                            // 모바일 정책 적용: 수용불가능 문구를 X로 대체
                            const processedContent = replaceUnavailableWithX(item.content);
                            const segments = parseMessageWithHighlights(processedContent);
                            return (
                              <div key={idx} className="text-[11px] leading-relaxed">
                                <span className={`font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>{item.label} </span>
                                <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                  {segments.map((seg, segIdx) => (
                                    <span key={segIdx} className={getHighlightClassWithTheme(seg.type, isDark)}>
                                      {seg.text}
                                    </span>
                                  ))}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {searchedHospitals.length === 0 && (
              <div className={`text-center text-[10px] py-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {searchQuery ? "검색 결과가 없습니다" : "조건에 맞는 병원이 없습니다"}
              </div>
            )}
          </div>
        </aside>

        {/* Map */}
        <main className="flex-1 relative min-h-0 overflow-hidden" style={{ minHeight: 0 }}>
          <HybridMap
            hospitals={filteredHospitals}
            bedDataMap={bedDataMap}
            severeDataMap={severeDataMap}
            emergencyMessages={emergencyMessages}
            selectedRegion={selectedRegion}
            selectedSevereType={selectedSevereType}
            selectedDiseaseCategory={selectedDiseaseCategory}
            selectedClassifications={selectedClassifications}
            hoveredHospitalCode={hoveredHospitalCode}
            onHospitalHover={handleHospitalHover}
            diseaseData={allData}
            selectedDiseases={selectedDiseaseSubcategories}
            selectedDay={selectedDay}
            selectedStatus={selectedStatus}
            selectedBedTypes={selectedBedTypes}
            onBackToNational={handleBackToNational}
          />
        </main>

        {/* 모바일 오버레이 */}
        {mobilePanel && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={closeMobilePanel}
          />
        )}

        {/* 모바일 필터 패널 */}
        <div
          className={`md:hidden fixed top-12 left-0 bottom-0 w-64 border-r z-50 transform transition-transform duration-300 ${
            isDark ? 'bg-gray-900 border-gray-800' : 'bg-[#E8E2D8] border-[#d4cdc4]'
          } ${mobilePanel === "filter" ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className={`flex items-center justify-between p-3 border-b ${isDark ? 'border-gray-800' : 'border-[#d4cdc4]'}`}>
            <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>필터</span>
            <button onClick={closeMobilePanel} className={`p-1 ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto h-[calc(100%-48px)]">
            {/* 지역/요일 선택 */}
            {/* 지역 + 기관분류 */}
            <div className={`px-3 py-3 border-b ${isDark ? 'border-gray-800' : 'border-[#d4cdc4]'}`}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[10px] mb-1 block ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>지역</label>
                  <Select value={selectedRegion} onValueChange={handleSidebarRegionChange}>
                    <SelectTrigger size="xs" className={`${isDark ? 'bg-transparent border-gray-700 text-white' : 'bg-transparent border border-[#d4cdc4] text-gray-900'}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={isDark ? 'bg-gray-800 border-gray-700' : 'bg-[#FAF7F2] border-[#d4cdc4]'}>
                      {REGIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value} className={isDark ? 'text-white' : 'text-gray-900'}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={`text-[10px] mb-1 block ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>기관</label>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <button
                      onClick={() => toggleClassification("권역응급의료센터")}
                      className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors ${
                        selectedClassifications.includes("권역응급의료센터")
                          ? isDark ? "bg-cyan-500/20 text-white" : "bg-[#4A5D5D] text-white"
                          : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 ${selectedClassifications.includes("권역응급의료센터") ? "bg-white" : isDark ? "bg-gray-500" : "bg-gray-400"}`} />
                      권역
                    </button>
                    <button
                      onClick={() => toggleClassification("지역응급의료센터")}
                      className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors ${
                        selectedClassifications.includes("지역응급의료센터")
                          ? isDark ? "bg-cyan-500/20 text-white" : "bg-[#4A5D5D] text-white"
                          : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${selectedClassifications.includes("지역응급의료센터") ? "bg-white" : isDark ? "bg-gray-500" : "bg-gray-400"}`} />
                      센터
                    </button>
                    <button
                      onClick={() => toggleClassification("지역응급의료기관")}
                      className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors ${
                        selectedClassifications.includes("지역응급의료기관")
                          ? isDark ? "bg-cyan-500/20 text-white" : "bg-[#4A5D5D] text-white"
                          : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <svg className={`w-2.5 h-2.5 ${selectedClassifications.includes("지역응급의료기관") ? "fill-white" : isDark ? "fill-gray-500" : "fill-gray-400"}`} viewBox="0 0 10 10">
                        <polygon points="5,0 10,10 0,10" />
                      </svg>
                      기관
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 질환 선택 */}
            <div className={`px-3 py-3 border-b ${isDark ? 'border-gray-800' : 'border-[#d4cdc4]'}`}>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>중증자원조사 42개</label>
                    <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)}>
                      <SelectTrigger size="xs" className={`w-[68px] [&_svg]:size-2 [&_svg]:ml-0 ${isDark ? 'bg-transparent border-gray-700 text-white' : 'bg-transparent border border-[#d4cdc4] text-gray-900'}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={isDark ? 'bg-gray-800 border-gray-700' : 'bg-[#FAF7F2] border-[#d4cdc4]'}>
                        {DAYS_OF_WEEK.map((day) => (
                          <SelectItem key={day} value={day} className={isDark ? 'text-white' : 'text-gray-900'}>
                            {day}요일
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Select
                    value={selectedDiseaseCategory || "none"}
                    onValueChange={(v) => handleCategoryChange(v === "none" ? null : v)}
                  >
                    <SelectTrigger size="xs" className={`${isDark ? 'bg-transparent border-gray-700 text-white' : 'bg-transparent border border-[#d4cdc4] text-gray-900'}`}>
                      <SelectValue placeholder="대분류 선택..." />
                    </SelectTrigger>
                    <SelectContent className={`max-h-64 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-[#FAF7F2] border-[#d4cdc4]'}`}>
                      <SelectItem value="none" className={isDark ? 'text-gray-400' : 'text-gray-500'}>전체</SelectItem>
                      {DISEASE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.key} value={cat.key} className={isDark ? 'text-white' : 'text-gray-900'}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* 소분류 버튼 (대분류 선택 시 표시) */}
                  {currentCategory && currentCategory.subcategories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {currentCategory.subcategories.map((sub) => (
                        <button
                          key={sub.key}
                          onClick={() => toggleDiseaseSubcategory(sub.key)}
                          className={`text-[11px] px-1.5 py-0.5 rounded transition-colors ${
                            selectedDiseaseSubcategories.has(sub.key)
                              ? isDark ? "bg-cyan-500/20 text-white" : "bg-[#4A5D5D] text-white"
                              : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* 가용성 필터 - 대분류 선택 시에만 활성화 */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <button
                      onClick={() => selectedDiseaseCategory && toggleStatus("24시간")}
                      disabled={!selectedDiseaseCategory}
                      className={`text-[11px] px-2 py-1 rounded transition-colors ${
                        !selectedDiseaseCategory
                          ? isDark ? "text-gray-700 cursor-not-allowed" : "text-gray-400 cursor-not-allowed"
                          : selectedStatus.includes("24시간")
                            ? isDark ? "border border-green-500 text-green-400" : "border border-green-600 text-green-700 bg-green-50"
                            : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      24h
                    </button>
                    <button
                      onClick={() => selectedDiseaseCategory && toggleStatus("주간")}
                      disabled={!selectedDiseaseCategory}
                      className={`text-[11px] px-2 py-1 rounded transition-colors ${
                        !selectedDiseaseCategory
                          ? isDark ? "text-gray-700 cursor-not-allowed" : "text-gray-400 cursor-not-allowed"
                          : selectedStatus.includes("주간")
                            ? isDark ? "border border-blue-500 text-blue-400" : "border border-blue-600 text-blue-700 bg-blue-50"
                            : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      주간
                    </button>
                    <button
                      onClick={() => selectedDiseaseCategory && toggleStatus("야간")}
                      disabled={!selectedDiseaseCategory}
                      className={`text-[11px] px-2 py-1 rounded transition-colors ${
                        !selectedDiseaseCategory
                          ? isDark ? "text-gray-700 cursor-not-allowed" : "text-gray-400 cursor-not-allowed"
                          : selectedStatus.includes("야간")
                            ? isDark ? "border border-purple-500 text-purple-400" : "border border-purple-600 text-purple-700 bg-purple-50"
                            : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      야간
                    </button>
                  </div>
                </div>
                <div>
                  <label className={`text-[10px] mb-1 block ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>27개 실시간 중증질환</label>
                  <Select
                    value={selectedSevereType || "none"}
                    onValueChange={(v) => setSelectedSevereType(v === "none" ? null : v as SevereTypeKey)}
                  >
                    <SelectTrigger size="xs" className={`${isDark ? 'bg-transparent border-gray-700 text-white' : 'bg-transparent border border-[#d4cdc4] text-gray-900'}`}>
                      <SelectValue placeholder="선택..." />
                    </SelectTrigger>
                    <SelectContent className={`max-h-64 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-[#FAF7F2] border-[#d4cdc4]'}`}>
                      <SelectItem value="none" className={isDark ? 'text-gray-400' : 'text-gray-500'}>전체</SelectItem>
                      {SEVERE_TYPES.map((type) => (
                        <SelectItem key={type.key} value={type.key} className={isDark ? 'text-white' : 'text-gray-900'}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 병상 필터 (유형 + 상태) */}
            <div className="px-3 py-3">
              <div className="flex items-center justify-between mb-2">
                <label className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>실시간 병상정보</label>
                {bedLoading && <span className={`text-[11px] ${isDark ? 'text-orange-400' : 'text-orange-500'}`}>로딩...</span>}
              </div>
              {/* 병상 유형 */}
              <div className="flex flex-wrap gap-1 mb-2">
                {(Object.entries(BED_TYPE_CONFIG) as [BedType, typeof BED_TYPE_CONFIG[BedType]][]).map(([type, config]) => (
                  <button
                    key={type}
                    onClick={() => toggleBedType(type)}
                    className={`text-[11px] px-1.5 py-0.5 rounded transition-colors ${
                      selectedBedTypes.has(type)
                        ? isDark ? "bg-cyan-500/20 text-white" : "bg-[#4A5D5D] text-white"
                        : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {config.shortLabel}
                  </button>
                ))}
              </div>
              {/* 병상 상태 */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => toggleBedStatus("여유")}
                  className={`text-[11px] px-1.5 py-0.5 rounded transition-colors ${
                    selectedBedStatus.includes("여유")
                      ? isDark ? "bg-green-600 text-white font-medium" : "bg-green-600 text-white font-medium"
                      : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  여유
                </button>
                <button
                  onClick={() => toggleBedStatus("적정")}
                  className={`text-[11px] px-1.5 py-0.5 rounded transition-colors ${
                    selectedBedStatus.includes("적정")
                      ? isDark ? "bg-yellow-500 text-white font-medium" : "bg-yellow-500 text-white font-medium"
                      : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  적정
                </button>
                <button
                  onClick={() => toggleBedStatus("부족")}
                  className={`text-[11px] px-1.5 py-0.5 rounded transition-colors ${
                    selectedBedStatus.includes("부족")
                      ? isDark ? "bg-red-600 text-white font-medium" : "bg-red-600 text-white font-medium"
                      : isDark ? "text-gray-500 hover:text-gray-400" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  부족
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 모바일 병원 목록 패널 */}
        <div
          className={`md:hidden fixed top-12 right-0 bottom-0 w-72 border-l z-50 transform transition-transform duration-300 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-[#E8E2D8] border-[#d4cdc4]'} ${
            mobilePanel === "list" ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className={`p-2 border-b ${isDark ? 'border-gray-800 bg-gray-900' : 'border-[#d4cdc4] bg-[#ddd6cc]'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-[#4A5D5D]'}`}>{getFilterSummary()} ({searchedHospitals.length})</span>
              <button onClick={closeMobilePanel} className={`p-1 ${isDark ? 'text-gray-400 hover:text-white' : 'text-[#4A5D5D] hover:text-[#3a4a4a]'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* 정렬 토글 스위치 */}
            <div className={`flex rounded-md overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-[#c8c2b8]'}`}>
              <button
                onClick={() => setSortMode("default")}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  sortMode === "default"
                    ? isDark ? "bg-cyan-600 text-white" : "bg-[#4A5D5D] text-white"
                    : isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-800"
                }`}
              >
                포화도순
              </button>
              <button
                onClick={handleLocationRequest}
                disabled={locationLoading || travelTimeLoading}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  sortMode === "travelTime"
                    ? isDark ? "bg-cyan-600 text-white" : "bg-[#4A5D5D] text-white"
                    : isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-800"
                } ${(locationLoading || travelTimeLoading) ? "opacity-50" : ""}`}
                title={userLocation ? `현재 위치: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : "내 위치 기반 소요시간 조회"}
              >
                {(locationLoading || travelTimeLoading) && (
                  <span className="inline-block w-3 h-3 mr-1 border-2 border-t-transparent rounded-full animate-spin border-current"></span>
                )}
                내위치순
              </button>
            </div>
            {locationError && (
              <div className="text-[10px] text-red-400 mt-1">{locationError}</div>
            )}
          </div>
          {/* 검색창 */}
          <div className={`p-2 border-b ${isDark ? 'border-gray-800' : 'border-[#d4cdc4]'}`}>
            <div className="relative">
              <svg
                className={`absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
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
                className={`w-full h-7 pr-2 text-xs rounded focus:outline-none ${isDark ? 'bg-transparent border-none text-white placeholder-gray-500' : 'bg-[#F5F0E8] border border-[#d4cdc4] text-gray-900 placeholder-gray-400'}`}
                style={{ paddingLeft: '28px' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-400 hover:text-gray-500'}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          {/* 병원 목록 */}
          <div className={`overflow-y-auto h-[calc(100%-96px)] p-2 space-y-0.5 ${isDark ? 'bg-gray-900' : 'bg-[#F5F0E8]'}`}>
            {searchedHospitals.map((hospital) => {
              const status = getHospitalStatus(hospital);
              const isHovered = hoveredHospitalCode === hospital.code;
              const shortClass = getClassificationShort(hospital.classification);
              const severeInfo = selectedSevereType ? severeDataMap.get(hospital.code) : null;
              const severeStatus = severeInfo ? (severeInfo.severeStatus[selectedSevereType!] || '').trim().toUpperCase() : null;
              const isSevereAvailable = severeStatus === 'Y';
              const bgClass = selectedSevereType
                ? (isHovered ? "bg-green-500/30 border-green-400" : "bg-green-500/20 border-green-500/40")
                : getStatusBgColor(status, isHovered, isDark);
              const bedInfo = bedDataMap.get(hospital.code);
              const occupancyRate = bedInfo?.occupancyRate ?? null;

              return (
                <div
                  key={hospital.code}
                  className={`px-1.5 py-1 rounded border text-xs cursor-pointer transition-all duration-200 ${bgClass}`}
                  onClick={() => {
                    handleHospitalHover(hospital.code);
                    closeMobilePanel();
                  }}
                >
                  <div className="flex items-center gap-1">
                    {shortClass && renderClassificationIcon(shortClass, isDark)}
                    <span
                      className={`font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-700'}`}
                      title={hospital.name}
                      style={{ maxWidth: selectedDiseaseCategory ? '80px' : '110px' }}
                    >
                      {shortenHospitalName(hospital.name)}
                    </span>
                    {/* 소요시간 (활성화 시) */}
                    {sortMode === "travelTime" && travelTimes.get(hospital.code)?.duration && (
                      <span className="shrink-0 text-[9px] font-medium text-blue-400">
                        {formatDuration(travelTimes.get(hospital.code)?.duration ?? null)}
                      </span>
                    )}
                    {/* 선택된 질환명(대분류) - 작게 표시 */}
                    {selectedDiseaseCategory && currentCategory && (
                      <span
                        className={`shrink-0 text-[8px] px-1 py-0.5 rounded truncate ${
                          isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                        }`}
                        style={{ maxWidth: '45px' }}
                        title={currentCategory.label}
                      >
                        {currentCategory.label.length > 4 ? currentCategory.label.slice(0, 4) : currentCategory.label}
                      </span>
                    )}
                    {/* 가용상태 */}
                    {selectedSevereType && isSevereAvailable ? (
                      <span className="shrink-0 text-[10px] text-green-400">가능</span>
                    ) : status && !selectedSevereType ? (
                      <span className={`shrink-0 text-[10px] ${getStatusColor(status, isDark)}`}>
                        {status}
                      </span>
                    ) : null}
                    {/* 배터리 (항상 우측) */}
                    <div className="flex-1" />
                    {occupancyRate !== null && (
                      <div className="shrink-0 scale-[0.7] origin-right">
                        <OccupancyBattery rate={occupancyRate} isDark={isDark} size="medium" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {searchedHospitals.length === 0 && (
              <div className={`text-center text-xs py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {searchQuery ? "검색 결과가 없습니다" : "조건에 맞는 병원이 없습니다"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
