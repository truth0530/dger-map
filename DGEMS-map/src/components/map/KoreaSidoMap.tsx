"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Hospital, HospitalDiseaseData, DayOfWeek, AvailabilityStatus } from "@/types";
import type { HospitalBedData } from "@/lib/hooks/useBedData";
import type { BedType } from "@/lib/constants/bedTypes";
import { BED_TYPE_CONFIG } from "@/lib/constants/bedTypes";

// 전국 좌표 범위 (위도/경도 → SVG viewBox 변환용)
// SVG viewBox: 0 0 800 759
// 정밀 회귀 분석 기반 경계값 - SVG path와 실제 지리 좌표 정밀 매핑
const KOREA_BOUNDS = {
  minLat: 33.23,
  maxLat: 38.55,
  minLng: 124.59,
  maxLng: 131.64,
};

interface PathInfo {
  id: string;
  d: string;
  fillRule?: string;
}

interface KoreaSidoMapProps {
  hospitals: Hospital[];
  diseaseData: HospitalDiseaseData[];
  selectedDisease: string | null;
  selectedDay: DayOfWeek;
  selectedStatus: AvailabilityStatus[];
  selectedClassifications: string[];
  selectedRegion: string;
  onRegionSelect: (region: string) => void;
  hoveredHospitalCode?: string | null;
  onHospitalHover?: (code: string | null) => void;
  bedDataMap?: Map<string, HospitalBedData>;
  selectedBedTypes?: Set<BedType>;
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

// 시도명 정규화 (fullName → shortName)
const SIDO_NAME_MAP: Record<string, string> = {
  "서울특별시": "서울",
  "부산광역시": "부산",
  "인천광역시": "인천",
  "대구광역시": "대구",
  "대전광역시": "대전",
  "광주광역시": "광주",
  "울산광역시": "울산",
  "세종특별자치시": "세종",
  "경기도": "경기",
  "강원특별자치도": "강원",
  "충청북도": "충북",
  "충청남도": "충남",
  "전북특별자치도": "전북",
  "전라남도": "전남",
  "경상북도": "경북",
  "경상남도": "경남",
  "제주특별자치도": "제주",
};

// SVG path ID → 시도 전체명 매핑
const PATH_ID_TO_REGION: Record<string, string> = {
  "서울": "서울특별시",
  "서울특별시": "서울특별시",
  "부산": "부산광역시",
  "부산광역시": "부산광역시",
  "인천": "인천광역시",
  "인천광역시": "인천광역시",
  "대구": "대구광역시",
  "대구광역시": "대구광역시",
  "대전": "대전광역시",
  "대전광역시": "대전광역시",
  "광주": "광주광역시",
  "광주광역시": "광주광역시",
  "울산": "울산광역시",
  "울산광역시": "울산광역시",
  "세종": "세종특별자치시",
  "세종특별자치시": "세종특별자치시",
  "경기": "경기도",
  "경기도": "경기도",
  "강원": "강원특별자치도",
  "강원도": "강원특별자치도",
  "강원특별자치도": "강원특별자치도",
  "충북": "충청북도",
  "충청북도": "충청북도",
  "충남": "충청남도",
  "충청남도": "충청남도",
  "전북": "전북특별자치도",
  "전라북도": "전북특별자치도",
  "전북특별자치도": "전북특별자치도",
  "전남": "전라남도",
  "전라남도": "전라남도",
  "경북": "경상북도",
  "경상북도": "경상북도",
  "경남": "경상남도",
  "경상남도": "경상남도",
  "제주": "제주특별자치도",
  "제주도": "제주특별자치도",
  "제주특별자치도": "제주특별자치도",
};

export function KoreaSidoMap({
  hospitals,
  diseaseData,
  selectedDisease,
  selectedDay,
  selectedStatus,
  selectedClassifications,
  selectedRegion,
  onRegionSelect,
  hoveredHospitalCode,
  onHospitalHover,
  bedDataMap,
  selectedBedTypes,
}: KoreaSidoMapProps) {
  const [svgPaths, setSvgPaths] = useState<PathInfo[]>([]);
  const [viewBox, setViewBox] = useState<string>("0 0 800 800");
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [svgDimensions, setSvgDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 800 });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // SVG 파일 로드
  useEffect(() => {
    const loadSvg = async () => {
      setIsLoading(true);

      try {
        const response = await fetch("/maps/sigungu/전국_시도_경계.svg");
        if (!response.ok) {
          throw new Error("전국 지도 SVG를 찾을 수 없습니다");
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
        console.error("[KoreaSidoMap] SVG 로드 실패:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSvg();
  }, []);

  // 필터링된 병원 목록
  const filteredHospitals = useMemo(() => {
    return hospitals.filter((hospital) => {
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
      if (selectedDisease && hospital.hasDiseaseData) {
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
  }, [hospitals, selectedClassifications, selectedDisease, selectedDay, selectedStatus, diseaseData]);

  // 위도/경도를 SVG 좌표로 변환
  const latLngToSvg = useCallback((lat: number, lng: number): { x: number; y: number } => {
    const { minLat, maxLat, minLng, maxLng } = KOREA_BOUNDS;

    const x = ((lng - minLng) / (maxLng - minLng)) * svgDimensions.width;
    const y = ((maxLat - lat) / (maxLat - minLat)) * svgDimensions.height;

    return { x, y };
  }, [svgDimensions]);

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

  // 마우스 이동 핸들러
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (mapContainerRef.current && (hoveredHospitalCode || hoveredRegion)) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  }, [hoveredHospitalCode, hoveredRegion]);

  // 병원 좌표 기반 툴팁 위치 계산 (사이드바 호버용)
  const getHospitalTooltipPos = useCallback((hospital: Hospital): { x: number; y: number } | null => {
    if (!hospital.lat || !hospital.lng || !mapContainerRef.current || !svgRef.current) return null;

    const svgPos = latLngToSvg(hospital.lat, hospital.lng);
    const svgElement = svgRef.current;
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
  const getMarkerSize = (isHovered: boolean, hasDiseaseData: boolean): number => {
    if (isHovered) return 8;
    if (!hasDiseaseData) return 4;
    return 5;
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
    const status = getHospitalStatus(hospital);
    if (status) {
      return STATUS_COLORS[status];
    }
    // 대구 진료정보 있는 병원은 밝은 회색, 그 외는 파란색
    const isDaegu = hospital.region === "대구광역시";
    if (isDaegu && hospital.hasDiseaseData) {
      return "#9ca3af";  // 진료정보 있는 대구 병원
    }
    return "#60a5fa";  // 기본 파란색
  };

  // SVG 마커 렌더링
  const renderMarker = (
    x: number,
    y: number,
    shape: MarkerShape,
    color: string,
    size: number,
    isHovered: boolean,
    opacity: number
  ) => {
    const strokeColor = isHovered ? "#ffffff" : "#1f2937";
    const strokeWidth = isHovered ? 1.5 : 0.5;

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
            rx={0.5}
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

  // 시도별 병원 수 계산
  const regionHospitalCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredHospitals.forEach((h) => {
      if (h.region) {
        const shortName = SIDO_NAME_MAP[h.region] || h.region;
        counts[shortName] = (counts[shortName] || 0) + 1;
      }
    });
    return counts;
  }, [filteredHospitals]);

  // 시도 클릭 핸들러
  const handleRegionClick = (pathId: string) => {
    const regionFullName = PATH_ID_TO_REGION[pathId];
    if (regionFullName) {
      onRegionSelect(regionFullName);
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
      className="w-full h-full relative bg-gray-950"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (onHospitalHover) onHospitalHover(null);
        setHoveredRegion(null);
        setTooltipPos(null);
      }}
    >
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="w-full h-full"
        style={{ background: "#0f0f14" }}
      >
        {/* 시도 경계선 */}
        {svgPaths.map((pathInfo) => {
          const isHovered = hoveredRegion === pathInfo.id;
          const regionFullName = PATH_ID_TO_REGION[pathInfo.id];
          const isDaegu = regionFullName === "대구광역시";

          // 대구는 살짝 밝게 (진료정보 있음 표시)
          let fillColor = isDaegu
            ? "rgba(100, 100, 110, 0.25)"
            : "rgba(30, 30, 40, 0.3)";

          // 호버 시 밝게
          if (isHovered) {
            fillColor = isDaegu
              ? "rgba(120, 120, 130, 0.35)"
              : "rgba(50, 50, 60, 0.4)";
          }

          const strokeColor = isHovered ? "#6b7280" : "#374151";
          const strokeW = isHovered ? 1.2 : 0.5;

          return (
            <path
              key={pathInfo.id}
              id={pathInfo.id}
              d={pathInfo.d}
              fill={fillColor}
              fillRule={pathInfo.fillRule as "nonzero" | "evenodd" | undefined}
              stroke={strokeColor}
              strokeWidth={strokeW}
              className="cursor-pointer transition-all duration-200"
              onClick={() => handleRegionClick(pathInfo.id)}
              onMouseEnter={() => setHoveredRegion(pathInfo.id)}
              onMouseLeave={() => setHoveredRegion(null)}
            />
          );
        })}

        {/* 병원 마커 */}
        {filteredHospitals.map((hospital) => {
          if (!hospital.lat || !hospital.lng) return null;

          const pos = latLngToSvg(hospital.lat, hospital.lng);
          const status = getHospitalStatus(hospital);
          const isHovered = hoveredHospitalCode === hospital.code;
          const color = getMarkerColor(hospital);
          const shape = getMarkerShape(hospital);
          const size = getMarkerSize(isHovered, hospital.hasDiseaseData);
          const opacity = status === "불가" ? 0.4 : hospital.hasDiseaseData ? 0.9 : 0.5;

          return (
            <g
              key={hospital.code}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => onHospitalHover && onHospitalHover(hospital.code)}
            >
              {/* 호버 시 외곽 링 */}
              {isHovered && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={size + 4}
                  fill="transparent"
                  stroke={color}
                  strokeWidth={1.5}
                  opacity={0.6}
                  className="animate-pulse"
                />
              )}
              {/* 메인 마커 (모양별) */}
              {renderMarker(pos.x, pos.y, shape, color, size, isHovered, opacity)}
            </g>
          );
        })}
      </svg>

      {/* 병원 호버 툴팁 */}
      {hoveredHospital && (() => {
        // 마우스 위치가 있으면 사용, 없으면 병원 좌표 기반으로 계산
        const pos = tooltipPos || getHospitalTooltipPos(hoveredHospital);
        if (!pos) return null;

        return (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: Math.min(pos.x + 15, (mapContainerRef.current?.clientWidth || 300) - 280),
              top: Math.max(pos.y - 10, 10),
              transform: pos.y < 150 ? 'translateY(0)' : 'translateY(-100%)',
            }}
          >
          <div className="bg-gray-800/95 backdrop-blur-sm rounded-lg p-3 border border-gray-600 shadow-xl min-w-[240px] max-w-[280px]">
            <div className="font-bold text-white text-sm mb-1">{hoveredHospital.name}</div>

            {hoveredHospital.classification && (
              <div className="text-xs text-orange-400 mb-1">{hoveredHospital.classification}</div>
            )}

            {hoveredHospital.region && (
              <div className="text-xs text-gray-400 mb-2">
                {hoveredHospital.region} {hoveredHospital.district}
              </div>
            )}

            {selectedDisease && hoveredHospital.hasDiseaseData && (
              <div className="border-t border-gray-700 pt-2 mt-2">
                <div className="text-xs text-gray-500 mb-1">{selectedDisease}</div>
                {(() => {
                  const status = getHospitalStatus(hoveredHospital);
                  return (
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: status ? `${STATUS_COLORS[status]}30` : '#37415130',
                          color: status ? STATUS_COLORS[status] : '#9ca3af',
                        }}
                      >
                        {selectedDay}요일: {status || "정보없음"}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            {!hoveredHospital.hasDiseaseData && (
              <div className="text-xs text-gray-500 border-t border-gray-700 pt-2 mt-2">
                진료정보 미등록 기관
              </div>
            )}

            {/* 병상 정보 */}
            {bedDataMap && selectedBedTypes && selectedBedTypes.size > 0 && (() => {
              const bedInfo = bedDataMap.get(hoveredHospital.code);

              return (
                <div className="border-t border-gray-700 pt-2 mt-2">
                  <div className="text-xs text-gray-500 mb-1 flex items-center justify-between">
                    <span>병상 현황</span>
                    {bedInfo?.hvidate && (
                      <span className="text-[9px] text-gray-600">
                        {bedInfo.hvidate.substring(8, 10)}:{bedInfo.hvidate.substring(10, 12)}
                      </span>
                    )}
                  </div>
                  {bedInfo ? (
                    <div className="grid grid-cols-2 gap-1">
                      {Array.from(selectedBedTypes).map((bedType) => {
                        const config = BED_TYPE_CONFIG[bedType];
                        const available = bedInfo[config.availableKey] as number ?? 0;
                        const total = bedInfo[config.totalKey] as number ?? 0;
                        const occupancy = Math.max(0, total - available);

                        return (
                          <div key={bedType} className="bg-gray-700/50 rounded px-2 py-1">
                            <div className="text-[10px] text-gray-400">{config.label}</div>
                            <div className="text-xs">
                              <span className={available > 0 ? "text-cyan-400 font-medium" : "text-red-400 font-medium"}>
                                {available}
                              </span>
                              <span className="text-gray-500">/{total}</span>
                              {total > 0 && (
                                <span className="text-gray-500 ml-1">({occupancy}명)</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-500 bg-gray-700/30 rounded px-2 py-1.5 text-center">
                      실시간 병상 데이터 없음
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
        );
      })()}

      {/* 시도 호버 툴팁 */}
      {hoveredRegion && !hoveredHospitalCode && tooltipPos && (
        <div
          className="absolute z-40 pointer-events-none"
          style={{
            left: Math.min(tooltipPos.x + 15, (mapContainerRef.current?.clientWidth || 300) - 160),
            top: Math.max(tooltipPos.y - 10, 10),
          }}
        >
          <div className="bg-gray-800/95 backdrop-blur-sm rounded-lg p-2.5 border border-gray-600 shadow-xl">
            <div className="font-bold text-white text-sm mb-1">
              {PATH_ID_TO_REGION[hoveredRegion] || hoveredRegion}
            </div>
            <div className="text-xs text-gray-400">
              응급의료기관: {regionHospitalCounts[hoveredRegion] || 0}개
            </div>
            <div className="text-[10px] text-orange-400 mt-1">
              클릭하여 상세 보기
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
