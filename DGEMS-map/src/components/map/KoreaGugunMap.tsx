"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Hospital, HospitalDiseaseData, DayOfWeek, AvailabilityStatus } from "@/types";
import type { HospitalBedData } from "@/lib/hooks/useBedData";
import type { BedType } from "@/lib/constants/bedTypes";
import { BED_TYPE_CONFIG } from "@/lib/constants/bedTypes";

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
  "강원특별자치도": { minLat: 36.97, maxLat: 38.65, minLng: 127.01, maxLng: 129.40 },
  "충청북도": { minLat: 35.97, maxLat: 37.30, minLng: 127.21, maxLng: 128.44 },
  "충청남도": { minLat: 35.94, maxLat: 37.08, minLng: 125.89, maxLng: 127.37 },
  "전북특별자치도": { minLat: 35.24, maxLat: 36.17, minLng: 126.32, maxLng: 127.94 },
  "전라남도": { minLat: 33.91, maxLat: 35.55, minLng: 125.01, maxLng: 127.92 },
  "경상북도": { minLat: 35.56, maxLat: 37.30, minLng: 128.24, maxLng: 130.97 },
  "경상남도": { minLat: 34.52, maxLat: 35.94, minLng: 127.52, maxLng: 129.27 },
  "제주특별자치도": { minLat: 33.06, maxLat: 34.00, minLng: 126.04, maxLng: 127.04 },
};

interface PathInfo {
  id: string;
  d: string;
  fillRule?: string;
}

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
}: KoreaGugunMapProps) {
  const [svgPaths, setSvgPaths] = useState<PathInfo[]>([]);
  const [viewBox, setViewBox] = useState<string>("0 0 800 800");
  const [isLoading, setIsLoading] = useState(true);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [svgDimensions, setSvgDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 800 });

  const mapContainerRef = useRef<HTMLDivElement>(null);
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
      className="w-full h-full relative bg-gray-950"
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
        style={{ background: "#0f0f14" }}
      >
        {/* 시군구 경계선만 표시 */}
        {svgPaths.map((pathInfo) => (
          <path
            key={pathInfo.id}
            id={pathInfo.id}
            d={pathInfo.d}
            fill="transparent"
            fillRule={pathInfo.fillRule as "nonzero" | "evenodd" | undefined}
            stroke="#374151"
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

      {/* 툴팁 */}
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
              {/* 병원명 */}
              <div className="font-bold text-white text-sm mb-1">{hoveredHospital.name}</div>

              {/* 기관 종류 */}
              {hoveredHospital.classification && (
                <div className="text-xs text-orange-400 mb-2">{hoveredHospital.classification}</div>
              )}

              {/* 주소 */}
              {hoveredHospital.address && (
                <div className="text-xs text-gray-400 mb-2">{hoveredHospital.address}</div>
              )}

              {/* 질환 선택 시 가용성 정보 */}
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

              {/* 대구 외 지역 안내 */}
              {!hoveredHospital.hasDiseaseData && selectedDisease && (
                <div className="border-t border-gray-700 pt-2 mt-2">
                  <div className="text-xs text-gray-500">진료정보 미등록 기관</div>
                </div>
              )}

              {/* 병상 정보 */}
              {bedDataMap && selectedBedTypes && (() => {
                const bedInfo = bedDataMap.get(hoveredHospital.code);
                if (!bedInfo) return null;

                return (
                  <div className="border-t border-gray-700 pt-2 mt-2">
                    <div className="text-xs text-gray-500 mb-1">병상 현황</div>
                    <div className="grid grid-cols-2 gap-1">
                      {Array.from(selectedBedTypes).map((bedType) => {
                        const config = BED_TYPE_CONFIG[bedType];
                        const available = bedInfo[config.availableKey] as number || 0;
                        const total = bedInfo[config.totalKey] as number || 0;
                        const occupancy = Math.max(0, total - available);

                        return (
                          <div key={bedType} className="bg-gray-700/50 rounded px-2 py-1">
                            <div className="text-[10px] text-gray-400">{config.label}</div>
                            <div className="text-xs">
                              <span className={available > 0 ? "text-cyan-400" : "text-red-400"}>
                                {available}
                              </span>
                              <span className="text-gray-500">/{total}</span>
                              <span className="text-gray-500 ml-1">({occupancy}명)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
