"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Hospital, HospitalDiseaseData, DayOfWeek, AvailabilityStatus } from "@/types";
import type { HospitalBedData } from "@/lib/hooks/useBedData";
import type { HospitalSevereData } from "@/lib/hooks/useSevereData";
import type { BedType } from "@/lib/constants/bedTypes";
import { BED_TYPE_CONFIG } from "@/lib/constants/bedTypes";
import { SEVERE_TYPES } from "@/lib/constants/dger";
import { useEmergencyMessages } from "@/lib/hooks/useEmergencyMessages";
import { parseMessage, getStatusColorClasses } from "@/lib/utils/messageClassifier";
import { useTheme } from "@/lib/contexts/ThemeContext";

// 시도명 → SVG 파일명 매핑
const SIDO_TO_SVG_FILE: Record<string, string> = {
  "서울특별시": "서울특별시_시군구_경계.svg",
  "부산광역시": "부산광역시_시군구_경계.svg",
  "대구광역시": "대구광역시_시군구_경계.svg",
  "인천광역시": "인천광역시_시군구_경계.svg",
  "광주광역시": "광주광역시_시군구_경계.svg",
  "대전광역시": "대전광역시_시군구_경계.svg",
  "울산광역시": "울산광역시_시군구_경계.svg",
  "세종특별자치시": "세종특별자치시_시군구_경계.svg",
  "경기도": "경기도_시군구_경계.svg",
  "강원특별자치도": "강원도_시군구_경계.svg",
  "충청북도": "충청북도_시군구_경계.svg",
  "충청남도": "충청남도_시군구_경계.svg",
  "전북특별자치도": "전라북도_시군구_경계.svg",
  "전라남도": "전라남도_시군구_경계.svg",
  "경상북도": "경상북도_시군구_경계.svg",
  "경상남도": "경상남도_시군구_경계.svg",
  "제주특별자치도": "제주특별자치도_시군구_경계.svg",
};

// 시도별 좌표 범위 (위도/경도 → SVG viewBox 변환용)
// 정밀 회귀 분석 기반 경계값 - SVG path 데이터와 실제 지리 좌표 정밀 매핑
// 각 시도의 SVG 구군 중심점과 실제 지리 좌표를 기반으로 선형 회귀 수행
const REGION_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  "서울특별시": { minLat: 37.41, maxLat: 37.72, minLng: 126.75, maxLng: 127.21 },
  "부산광역시": { minLat: 34.87, maxLat: 35.39, minLng: 128.76, maxLng: 129.34 },
  "대구광역시": { minLat: 35.68, maxLat: 36.22, minLng: 128.24, maxLng: 129.01 },
  "인천광역시": { minLat: 37.13, maxLat: 37.80, minLng: 126.00, maxLng: 126.82 },
  "광주광역시": { minLat: 35.02, maxLat: 35.29, minLng: 126.62, maxLng: 127.03 },
  "대전광역시": { minLat: 36.17, maxLat: 36.51, minLng: 127.22, maxLng: 127.57 },
  "울산광역시": { minLat: 35.35, maxLat: 35.75, minLng: 128.93, maxLng: 129.51 },
  "세종특별자치시": { minLat: 36.40, maxLat: 36.72, minLng: 127.01, maxLng: 127.43 },
  "경기도": { minLat: 36.85, maxLat: 38.32, minLng: 126.33, maxLng: 127.88 },
  "강원특별자치도": { minLat: 37.00, maxLat: 38.62, minLng: 127.05, maxLng: 129.40 },
  "충청북도": { minLat: 35.97, maxLat: 37.30, minLng: 127.21, maxLng: 128.44 },
  "충청남도": { minLat: 35.94, maxLat: 37.08, minLng: 125.89, maxLng: 127.37 },
  "전북특별자치도": { minLat: 35.24, maxLat: 36.17, minLng: 126.32, maxLng: 127.94 },
  "전라남도": { minLat: 33.91, maxLat: 35.55, minLng: 125.01, maxLng: 127.92 },
  "경상북도": { minLat: 35.56, maxLat: 37.30, minLng: 128.24, maxLng: 130.97 },
  "경상남도": { minLat: 34.52, maxLat: 35.94, minLng: 127.52, maxLng: 129.27 },
  "제주특별자치도": { minLat: 33.05, maxLat: 34.24, minLng: 126.08, maxLng: 127.02 },
};

interface PathInfo {
  id: string;
  d: string;
  fillRule?: string;
}

type SevereTypeKey = typeof SEVERE_TYPES[number]['key'];

interface KoreaGugunMapProps {
  selectedRegion: string;
  hospitals: Hospital[];
  diseaseData: HospitalDiseaseData[];
  selectedDisease: string | null;
  selectedDay: DayOfWeek;
  selectedStatus: AvailabilityStatus[];
  selectedClassifications: string[];
  onBackToNational: () => void;
  hoveredHospitalCode: string | null;
  onHospitalHover: (code: string | null) => void;
  bedDataMap?: Map<string, HospitalBedData>;
  selectedBedTypes?: Set<BedType>;
  severeDataMap?: Map<string, HospitalSevereData>;
  selectedSevereType?: SevereTypeKey | null;
}

// 가용성 상태별 색상
const STATUS_COLORS: Record<AvailabilityStatus, string> = {
  "24시간": "#22c55e",
  "주간": "#3b82f6",
  "야간": "#a855f7",
  "불가": "#6b7280",
};

// 기관종류별 마커 모양 타입
type MarkerShape = "diamond" | "square" | "circle";

// 기관종류 → 마커 모양 매핑
const CLASSIFICATION_TO_SHAPE: Record<string, MarkerShape> = {
  "권역응급의료센터": "diamond",
  "지역응급의료센터": "square",
  "지역응급의료기관": "circle",
};

export function KoreaGugunMap({
  selectedRegion,
  hospitals,
  diseaseData,
  selectedDisease,
  selectedDay,
  selectedStatus,
  selectedClassifications,
  onBackToNational,
  hoveredHospitalCode,
  onHospitalHover,
  bedDataMap,
  selectedBedTypes,
  severeDataMap,
  selectedSevereType,
}: KoreaGugunMapProps) {
  const { isDark } = useTheme();
  const [svgPaths, setSvgPaths] = useState<PathInfo[]>([]);
  const [viewBox, setViewBox] = useState<string>("0 0 800 800");
  const [isLoading, setIsLoading] = useState(true);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [svgDimensions, setSvgDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 800 });
  const [showEmergencyMessages, setShowEmergencyMessages] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);

  // 응급 메시지 훅
  const { messages: emergencyMessages, loading: messageLoading, fetchMessages } = useEmergencyMessages();
  const svgRef = useRef<SVGSVGElement>(null);

  // SVG 파일 로드
  useEffect(() => {
    const loadSvg = async () => {
      const svgFile = SIDO_TO_SVG_FILE[selectedRegion];
      if (!svgFile) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const response = await fetch(`/maps/sigungu/${svgFile}`);
        if (!response.ok) {
          throw new Error(`SVG 파일을 찾을 수 없습니다: ${svgFile}`);
        }

        const svgText = await response.text();
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
        const svgElement = svgDoc.querySelector("svg");

        if (!svgElement) {
          throw new Error("유효한 SVG 파일이 아닙니다");
        }

        const vb = svgElement.getAttribute("viewBox") || "0 0 800 800";
        setViewBox(vb);

        // viewBox에서 dimensions 추출
        const vbParts = vb.split(" ").map(Number);
        if (vbParts.length === 4) {
          setSvgDimensions({ width: vbParts[2], height: vbParts[3] });
        }

        const paths = svgElement.querySelectorAll("path");
        const pathInfos: PathInfo[] = [];

        paths.forEach((path) => {
          const id = path.getAttribute("id");
          const d = path.getAttribute("d");
          const fillRule = path.getAttribute("fill-rule") || undefined;

          if (id && d) {
            pathInfos.push({ id, d, fillRule });
          }
        });

        setSvgPaths(pathInfos);
      } catch (err) {
        console.error("[KoreaGugunMap] SVG 로드 실패:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSvg();
  }, [selectedRegion]);

  // 필터링된 병원 목록
  const filteredHospitals = useMemo(() => {
    return hospitals.filter((hospital) => {
      if (hospital.region !== selectedRegion) return false;
      if (!hospital.lat || !hospital.lng) return false;

      // 기관 종류 필터
      if (
        selectedClassifications.length > 0 &&
        hospital.classification &&
        !selectedClassifications.includes(hospital.classification)
      ) {
        return false;
      }

      // 대구 지역이고 질환이 선택된 경우 가용성 필터 적용
      if (selectedRegion === "대구광역시" && selectedDisease && hospital.hasDiseaseData) {
        const data = diseaseData.find(
          (d) => d.소속기관코드 === hospital.code && d.질환명 === selectedDisease
        );
        if (data) {
          const status = data[selectedDay] as AvailabilityStatus;
          if (!selectedStatus.includes(status)) return false;
        }
      }

      return true;
    });
  }, [hospitals, selectedRegion, selectedClassifications, selectedDisease, selectedDay, selectedStatus, diseaseData]);

  // 위도/경도를 SVG 좌표로 변환
  const latLngToSvg = useCallback((lat: number, lng: number): { x: number; y: number } | null => {
    const bounds = REGION_BOUNDS[selectedRegion];
    if (!bounds) return null;

    const { minLat, maxLat, minLng, maxLng } = bounds;

    // 위도는 Y축 (위쪽이 큰 값이므로 반전)
    // 경도는 X축
    const x = ((lng - minLng) / (maxLng - minLng)) * svgDimensions.width;
    const y = ((maxLat - lat) / (maxLat - minLat)) * svgDimensions.height;

    return { x, y };
  }, [selectedRegion, svgDimensions]);

  // 병원 가용성 상태 가져오기
  const getHospitalStatus = useCallback((hospital: Hospital): AvailabilityStatus | null => {
    if (!selectedDisease || !hospital.hasDiseaseData) return null;

    const data = diseaseData.find(
      (d) => d.소속기관코드 === hospital.code && d.질환명 === selectedDisease
    );
    if (!data) return null;
    return data[selectedDay] as AvailabilityStatus;
  }, [diseaseData, selectedDisease, selectedDay]);

  // 병원 진료정보 가져오기
  const getHospitalDiseaseInfo = useCallback((hospital: Hospital) => {
    if (!selectedDisease) return null;
    return diseaseData.find(
      (d) => d.소속기관코드 === hospital.code && d.질환명 === selectedDisease
    );
  }, [diseaseData, selectedDisease]);

  // 병원 호버 시 응급 메시지 가져오기
  useEffect(() => {
    if (hoveredHospitalCode && !emergencyMessages.has(hoveredHospitalCode)) {
      fetchMessages(hoveredHospitalCode);
    }
    // 호버 변경 시 응급 메시지 표시 상태 초기화
    setShowEmergencyMessages(false);
  }, [hoveredHospitalCode, fetchMessages, emergencyMessages]);

  // 마우스 이동 핸들러
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (mapContainerRef.current && hoveredHospitalCode) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  }, [hoveredHospitalCode]);

  // 병원 좌표 기반 툴팁 위치 계산 (사이드바 호버용)
  const getHospitalTooltipPos = useCallback((hospital: Hospital): { x: number; y: number } | null => {
    if (!hospital.lat || !hospital.lng || !mapContainerRef.current || !svgRef.current) return null;

    const svgPos = latLngToSvg(hospital.lat, hospital.lng);
    if (!svgPos) return null;

    const containerRect = mapContainerRef.current.getBoundingClientRect();

    // SVG viewBox 파싱
    const vbParts = viewBox.split(" ").map(Number);
    if (vbParts.length !== 4) return null;

    const [vbX, vbY, vbWidth, vbHeight] = vbParts;

    // SVG 좌표를 화면 좌표로 변환
    const scaleX = containerRect.width / vbWidth;
    const scaleY = containerRect.height / vbHeight;
    const scale = Math.min(scaleX, scaleY);

    // 중앙 정렬 오프셋 계산
    const offsetX = (containerRect.width - vbWidth * scale) / 2;
    const offsetY = (containerRect.height - vbHeight * scale) / 2;

    const screenX = (svgPos.x - vbX) * scale + offsetX;
    const screenY = (svgPos.y - vbY) * scale + offsetY;

    return { x: screenX, y: screenY };
  }, [latLngToSvg, viewBox]);

  // 호버된 병원 찾기
  const hoveredHospital = useMemo(() => {
    if (!hoveredHospitalCode) return null;
    return filteredHospitals.find((h) => h.code === hoveredHospitalCode) || null;
  }, [hoveredHospitalCode, filteredHospitals]);

  // 마커 크기 계산
  const getMarkerSize = (isHovered: boolean): number => {
    return isHovered ? 10 : 7;
  };

  // 마커 모양 가져오기
  const getMarkerShape = (hospital: Hospital): MarkerShape => {
    if (hospital.classification && CLASSIFICATION_TO_SHAPE[hospital.classification]) {
      return CLASSIFICATION_TO_SHAPE[hospital.classification];
    }
    return "circle"; // 기본값
  };

  // 마커 색상 가져오기 (가용성 기반)
  const getMarkerColor = (hospital: Hospital): string => {
    // 27개 중증질환이 선택된 경우 해당 상태에 따른 색상
    if (selectedSevereType && severeDataMap) {
      const severeInfo = severeDataMap.get(hospital.code);
      if (severeInfo) {
        const severeStatus = (severeInfo.severeStatus[selectedSevereType] || '').trim().toUpperCase();
        if (severeStatus === 'Y') return "#22c55e";  // 녹색 - 가능
        if (severeStatus === 'N' || severeStatus === '불가능') return "#ef4444";  // 빨강 - 불가
      }
      return "#6b7280";  // 회색 - 정보없음
    }

    // 기존 44개 질환 가용성 기반 색상
    const status = getHospitalStatus(hospital);
    if (status) {
      return STATUS_COLORS[status];
    }
    return "#60a5fa"; // 기본 파란색 (가용성 정보 없을 때)
  };

  // SVG 마커 렌더링
  const renderMarker = (
    x: number,
    y: number,
    shape: MarkerShape,
    color: string,
    size: number,
    isHovered: boolean,
    status: AvailabilityStatus | null
  ) => {
    const strokeColor = isHovered ? "#ffffff" : "#1f2937";
    const strokeWidth = isHovered ? 2 : 1;
    const opacity = status === "불가" ? 0.5 : 0.9;

    switch (shape) {
      case "diamond":
        // 다이아몬드 (권역응급의료센터)
        const diamondSize = size * 1.2;
        return (
          <polygon
            points={`${x},${y - diamondSize} ${x + diamondSize},${y} ${x},${y + diamondSize} ${x - diamondSize},${y}`}
            fill={color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        );
      case "square":
        // 사각형 (지역응급의료센터)
        const squareSize = size * 0.9;
        return (
          <rect
            x={x - squareSize}
            y={y - squareSize}
            width={squareSize * 2}
            height={squareSize * 2}
            fill={color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            rx={1}
          />
        );
      case "circle":
      default:
        // 원형 (지역응급의료기관)
        return (
          <circle
            cx={x}
            cy={y}
            r={size}
            fill={color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-950">
        <div className="text-gray-400">지도 로딩 중...</div>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className={`w-full h-full relative ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        onHospitalHover(null);
        setTooltipPos(null);
      }}
    >
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="w-full h-full"
        style={{ background: isDark ? "#0f0f14" : "#f9fafb" }}
      >
        {/* 시군구 경계선만 표시 */}
        {svgPaths.map((pathInfo) => (
          <path
            key={pathInfo.id}
            id={pathInfo.id}
            d={pathInfo.d}
            fill="transparent"
            fillRule={pathInfo.fillRule as "nonzero" | "evenodd" | undefined}
            stroke={isDark ? "#374151" : "#cbd5e1"}
            strokeWidth={1}
            className="pointer-events-none"
          />
        ))}

        {/* 병원 마커 */}
        {filteredHospitals.map((hospital) => {
          if (!hospital.lat || !hospital.lng) return null;

          const pos = latLngToSvg(hospital.lat, hospital.lng);
          if (!pos) return null;

          const status = getHospitalStatus(hospital);
          const isHovered = hoveredHospitalCode === hospital.code;
          const color = getMarkerColor(hospital);
          const shape = getMarkerShape(hospital);
          const size = getMarkerSize(isHovered);

          return (
            <g
              key={hospital.code}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => onHospitalHover(hospital.code)}
            >
              {/* 호버 시 외곽 링 */}
              {isHovered && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={size + 5}
                  fill="transparent"
                  stroke={color}
                  strokeWidth={2}
                  opacity={0.5}
                  className="animate-pulse"
                />
              )}
              {/* 메인 마커 (모양별) */}
              {renderMarker(pos.x, pos.y, shape, color, size, isHovered, status)}
            </g>
          );
        })}
      </svg>

      {/* 병원 호버 툴팁 - 개선된 디자인 */}
      {hoveredHospital && (() => {
        const pos = tooltipPos || getHospitalTooltipPos(hoveredHospital);
        if (!pos) return null;

        const bedInfo = bedDataMap?.get(hoveredHospital.code);
        const severeInfo = severeDataMap?.get(hoveredHospital.code);
        const diseaseStatus = getHospitalStatus(hoveredHospital);

        // 가용한 중증질환 목록
        const availableDiseases = severeInfo ? SEVERE_TYPES.filter(type => {
          const status = (severeInfo.severeStatus[type.key] || '').trim().toUpperCase();
          return status === 'Y';
        }) : [];

        return (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: Math.min(pos.x + 15, (mapContainerRef.current?.clientWidth || 300) - 320),
              top: Math.max(pos.y - 10, 10),
              transform: pos.y < 150 ? 'translateY(0)' : 'translateY(-100%)',
            }}
          >
            <div className={`backdrop-blur-md rounded-xl shadow-2xl border overflow-hidden min-w-[300px] max-w-[340px] transition-colors ${isDark ? 'bg-gray-900/98 border-gray-700/50' : 'bg-white/98 border-gray-300/50'}`}>
              {/* 헤더 영역 */}
              <div className={`px-3 py-2.5 border-b transition-colors ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-800/80 border-gray-700/50' : 'bg-gradient-to-r from-gray-100 to-gray-50 border-gray-200/50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold text-sm leading-tight truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{hoveredHospital.name}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {hoveredHospital.classification && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700'}`}>
                          {hoveredHospital.classification.replace('응급의료', '')}
                        </span>
                      )}
                      {hoveredHospital.district && (
                        <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                          {hoveredHospital.district}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 업데이트 시간 */}
                  {bedInfo?.hvidate && (
                    <div className={`text-[9px] px-1.5 py-0.5 rounded ${isDark ? 'text-gray-500 bg-gray-700/50' : 'text-gray-600 bg-gray-200/50'}`}>
                      {bedInfo.hvidate.substring(8, 10)}:{bedInfo.hvidate.substring(10, 12)}
                    </div>
                  )}
                </div>
              </div>

              {/* 컨텐츠 영역 */}
              <div className="p-3 space-y-2.5">
                {/* 질환 가용성 (44개 질환) */}
                {selectedDisease && hoveredHospital.hasDiseaseData && diseaseStatus && (
                  <div className={`flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors ${isDark ? 'bg-gray-800/50' : 'bg-gray-200/50'}`}>
                    <span className={`text-[11px] truncate flex-1 mr-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{selectedDisease}</span>
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: `${STATUS_COLORS[diseaseStatus]}25`,
                        color: STATUS_COLORS[diseaseStatus],
                      }}
                    >
                      {selectedDay}요일 {diseaseStatus}
                    </span>
                  </div>
                )}

                {/* 병상 현황 - 컴팩트 그리드 */}
                {bedDataMap && selectedBedTypes && selectedBedTypes.size > 0 && (
                  <div>
                    <div className={`text-[10px] mb-1.5 font-medium flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      병상 현황
                    </div>
                    {bedInfo ? (
                      <div className="grid grid-cols-4 gap-1">
                        {Array.from(selectedBedTypes).map((bedType) => {
                          const config = BED_TYPE_CONFIG[bedType];
                          const available = bedInfo[config.availableKey] as number ?? 0;
                          const total = bedInfo[config.totalKey] as number ?? 0;

                          return (
                            <div key={bedType} className={`rounded-md px-1.5 py-1.5 text-center transition-colors ${isDark ? 'bg-gray-800/60' : 'bg-gray-200/60'}`}>
                              <div className={`text-[9px] truncate ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{config.shortLabel}</div>
                              <div className="text-[13px] font-bold mt-0.5">
                                <span className={available > 0 ? (isDark ? "text-cyan-400" : "text-cyan-600") : (isDark ? "text-red-400" : "text-red-600")}>
                                  {available}
                                </span>
                                <span className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>/{total}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={`text-[10px] rounded-lg py-2 text-center transition-colors ${isDark ? 'text-gray-500 bg-gray-800/40' : 'text-gray-600 bg-gray-200/40'}`}>
                        실시간 데이터 없음
                      </div>
                    )}
                  </div>
                )}

                {/* 중증질환 진료 가능 */}
                {availableDiseases.length > 0 && (
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1.5 font-medium flex items-center gap-1">
                      <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      중증질환 진료 가능
                      <span className="text-green-400 ml-auto">{availableDiseases.length}개</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {availableDiseases.slice(0, 8).map(type => (
                        <span key={type.key} className="text-[9px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-md border border-green-500/20">
                          {type.label.replace(/\[.*?\]\s*/, '')}
                        </span>
                      ))}
                      {availableDiseases.length > 8 && (
                        <span className="text-[9px] text-gray-500 px-1.5 py-0.5">+{availableDiseases.length - 8}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* 응급 메시지 섹션 */}
                {(() => {
                  const msgData = emergencyMessages.get(hoveredHospital.code);
                  const isLoading = messageLoading.get(hoveredHospital.code);

                  // 중증질환 메시지
                  if (msgData && msgData.allDiseases.length > 0) {
                    return (
                      <div className="bg-red-500/10 rounded-lg p-2 border border-red-500/20">
                        <div className="text-[10px] text-red-400 mb-1.5 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          중증질환 메시지
                        </div>
                        <div className="space-y-1">
                          {msgData.allDiseases.slice(0, 3).map((disease, idx) => (
                            <div key={idx} className="text-[9px]">
                              <span className="text-red-300 font-medium">{disease.displayName.replace(/\[.*?\]\s*/, '')}:</span>
                              <span className="text-gray-400 ml-1">{disease.content}</span>
                            </div>
                          ))}
                          {msgData.allDiseases.length > 3 && (
                            <div className="text-[9px] text-gray-500">+{msgData.allDiseases.length - 3}개 메시지</div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* 응급실 메시지 섹션 */}
                {(() => {
                  const msgData = emergencyMessages.get(hoveredHospital.code);
                  const isLoading = messageLoading.get(hoveredHospital.code);

                  if (isLoading) {
                    return (
                      <div className={`text-[10px] text-center py-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                        메시지 로딩 중...
                      </div>
                    );
                  }

                  if (msgData && msgData.emergency.length > 0) {
                    return (
                      <div className={`rounded-lg p-2 border transition-colors ${isDark ? 'bg-green-500/10 border-green-500/20' : 'bg-green-100/50 border-green-400/20'}`}>
                        <div className={`text-[10px] mb-1.5 font-medium flex items-center gap-1 ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          응급실 운영 정보
                          <button
                            className={`ml-auto text-[9px] px-1.5 py-0.5 rounded pointer-events-auto transition-colors ${isDark ? 'bg-green-500/20 hover:bg-green-500/30' : 'bg-green-200/50 hover:bg-green-200/70'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowEmergencyMessages(!showEmergencyMessages);
                            }}
                          >
                            {showEmergencyMessages ? '접기' : `${msgData.emergency.length}개 보기`}
                          </button>
                        </div>
                        {showEmergencyMessages && (
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {msgData.emergency.map((item, idx) => {
                              const parsed = parseMessage(item.msg, item.symTypCod);
                              const colors = getStatusColorClasses(parsed.status.color);
                              return (
                                <div key={idx} className={`text-[9px] rounded p-1.5 transition-colors ${isDark ? 'bg-gray-800/50' : 'bg-gray-200/50'}`}>
                                  <div className="flex items-center gap-1 flex-wrap mb-0.5">
                                    <span className={`px-1 py-0.5 rounded ${isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-200/70 text-orange-700'}`}>
                                      {parsed.department}
                                    </span>
                                    <span className={`px-1 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                                      {parsed.status.label}
                                    </span>
                                  </div>
                                  <div className={isDark ? 'text-gray-400' : 'text-gray-600'}>{parsed.details}</div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* 진료정보 미등록 */}
                {!hoveredHospital.hasDiseaseData && !bedInfo && availableDiseases.length === 0 && (
                  <div className={`text-[10px] text-center py-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                    등록된 진료정보가 없습니다
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
