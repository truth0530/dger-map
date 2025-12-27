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
import { Legend } from "@/components/Legend";

// 전국 좌표 범위 (위도/경도 → SVG viewBox 변환용)
// SVG viewBox: 0 0 800 759
// 서울(37.56, 127.0) → SVG(251, 163), 부산(35.18, 129.08) → SVG(469, 490) 기준 역계산
const KOREA_BOUNDS = {
  minLat: 33.0,
  maxLat: 38.9,
  minLng: 124.6,
  maxLng: 131.9,
};

interface PathInfo {
  id: string;
  d: string;
  fillRule?: string;
}

interface BBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// SVG path d 속성에서 bounding box 계산
function parseBoundingBox(d: string): BBox {
  const numbers = d.match(/[-+]?[0-9]*\.?[0-9]+/g)?.map(Number) || [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  for (let i = 0; i < numbers.length - 1; i += 2) {
    const x = numbers[i];
    const y = numbers[i + 1];
    if (!isNaN(x) && !isNaN(y)) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  return { minX, maxX, minY, maxY };
}

// 시도별 하드코딩된 bounding box (fallback용)
const FALLBACK_BBOXES: Record<string, BBox> = {
  "제주특별자치도": { minX: 161, maxX: 252, minY: 697, maxY: 748 },
  "서울특별시": { minX: 236, maxX: 282, minY: 139, maxY: 190 },
  "부산광역시": { minX: 463, maxX: 502, minY: 481, maxY: 545 },
  "강원특별자치도": { minX: 290, maxX: 450, minY: 80, maxY: 230 },
};

type SevereTypeKey = typeof SEVERE_TYPES[number]['key'];

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
  severeDataMap,
  selectedSevereType,
}: KoreaSidoMapProps) {
  const { isDark } = useTheme();
  const [svgPaths, setSvgPaths] = useState<PathInfo[]>([]);
  const [viewBox, setViewBox] = useState<string>("0 0 800 800");
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [svgDimensions, setSvgDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 800 });
  const [regionBBoxes, setRegionBBoxes] = useState<Record<string, BBox>>({});
  const [showEmergencyMessages, setShowEmergencyMessages] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // 응급 메시지 훅
  const { messages: emergencyMessages, loading: messageLoading, fetchMessages } = useEmergencyMessages();

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

        // 각 시도별 bounding box 계산
        const bboxes: Record<string, BBox> = {};
        pathInfos.forEach((pathInfo) => {
          const regionName = PATH_ID_TO_REGION[pathInfo.id];
          if (regionName) {
            bboxes[regionName] = parseBoundingBox(pathInfo.d);
          }
        });
        console.log("[KoreaSidoMap] Region BBoxes:", bboxes);
        setRegionBBoxes(bboxes);
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

  // 병원 좌표를 시도 경계 내로 제한
  const constrainToRegion = useCallback((pos: { x: number; y: number }, region: string | undefined, hospitalCode?: string): { x: number; y: number } => {
    if (!region) return pos;

    const bbox = regionBBoxes[region] || FALLBACK_BBOXES[region];
    if (!bbox) return pos;
    const padding = 15; // 경계 안쪽으로 약간의 여유

    // 안전한 범위 계산
    const safeMinX = bbox.minX + padding;
    const safeMaxX = bbox.maxX - padding;
    const safeMinY = bbox.minY + padding;
    const safeMaxY = bbox.maxY - padding;

    // 좌표가 안전 범위를 벗어나는지 확인
    const isOutside = pos.x < safeMinX || pos.x > safeMaxX ||
                      pos.y < safeMinY || pos.y > safeMaxY;

    if (isOutside) {
      // 병원 코드 기반으로 일관된 오프셋 생성
      let hash = 0;
      if (hospitalCode) {
        for (let i = 0; i < hospitalCode.length; i++) {
          hash = ((hash << 5) - hash) + hospitalCode.charCodeAt(i);
          hash = hash & hash;
        }
      }
      const offsetX = (Math.abs(hash) % 100) / 100;
      const offsetY = (Math.abs(hash >> 8) % 100) / 100;

      const safeWidth = safeMaxX - safeMinX;
      const safeHeight = safeMaxY - safeMinY;

      // 경계 내로 클램핑하면서 오프셋 적용
      let newX = Math.max(safeMinX, Math.min(safeMaxX, pos.x));
      let newY = Math.max(safeMinY, Math.min(safeMaxY, pos.y));

      // X가 범위 밖이었으면 오프셋 적용
      if (pos.x < safeMinX || pos.x > safeMaxX) {
        newX = safeMinX + offsetX * safeWidth;
      }
      // Y가 범위 밖이었으면 오프셋 적용
      if (pos.y < safeMinY || pos.y > safeMaxY) {
        newY = safeMinY + offsetY * safeHeight;
      }

      return { x: newX, y: newY };
    }

    return pos;
  }, [regionBBoxes]);

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

  // 마커 색상 가져오기 - 모든 마커를 녹색으로 통일
  const getMarkerColor = (): string => {
    return "#22c55e"; // 녹색 - 모든 마커 통일
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
      className={`w-full h-full relative ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}
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
        style={{ background: isDark ? "#0f0f14" : "#f9fafb" }}
      >
        {/* 시도 경계선 */}
        {svgPaths.map((pathInfo) => {
          const isHovered = hoveredRegion === pathInfo.id;
          const regionFullName = PATH_ID_TO_REGION[pathInfo.id];
          const isDaegu = regionFullName === "대구광역시";

          // 대구는 살짝 밝게 (진료정보 있음 표시)
          let fillColor = isDark
            ? (isDaegu ? "rgba(100, 100, 110, 0.25)" : "rgba(30, 30, 40, 0.3)")
            : (isDaegu ? "rgba(200, 200, 210, 0.15)" : "rgba(220, 220, 230, 0.2)");

          // 호버 시 밝게
          if (isHovered) {
            fillColor = isDark
              ? (isDaegu ? "rgba(120, 120, 130, 0.35)" : "rgba(50, 50, 60, 0.4)")
              : (isDaegu ? "rgba(180, 180, 190, 0.25)" : "rgba(190, 190, 200, 0.3)");
          }

          const strokeColor = isDark
            ? (isHovered ? "#6b7280" : "#374151")
            : (isHovered ? "#94a3b8" : "#cbd5e1");
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

          const rawPos = latLngToSvg(hospital.lat, hospital.lng);
          const pos = constrainToRegion(rawPos, hospital.region, hospital.code);
          const status = getHospitalStatus(hospital);
          const isHovered = hoveredHospitalCode === hospital.code;
          const color = getMarkerColor();
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

      {/* 범례 - 공통 Legend 컴포넌트 사용 */}
      <Legend position="bottom-left" showBedStatus={false} />

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
            <div className="bg-gray-900/98 backdrop-blur-md rounded-xl shadow-2xl border border-gray-700/50 overflow-hidden min-w-[300px] max-w-[340px]">
              {/* 헤더 영역 */}
              <div className="bg-gradient-to-r from-gray-800 to-gray-800/80 px-3 py-2.5 border-b border-gray-700/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-sm leading-tight truncate">{hoveredHospital.name}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {hoveredHospital.classification && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-medium">
                          {hoveredHospital.classification.replace('응급의료', '')}
                        </span>
                      )}
                      {hoveredHospital.region && (
                        <span className="text-[10px] text-gray-500">
                          {hoveredHospital.district || hoveredHospital.region}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 업데이트 시간 */}
                  {bedInfo?.hvidate && (
                    <div className="text-[9px] text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded">
                      {bedInfo.hvidate.substring(8, 10)}:{bedInfo.hvidate.substring(10, 12)}
                    </div>
                  )}
                </div>
              </div>

              {/* 컨텐츠 영역 */}
              <div className="p-3 space-y-2.5">
                {/* 질환 가용성 (44개 질환) */}
                {selectedDisease && hoveredHospital.hasDiseaseData && diseaseStatus && (
                  <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-2.5 py-2">
                    <span className="text-[11px] text-gray-400 truncate flex-1 mr-2">{selectedDisease}</span>
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
                    <div className="text-[10px] text-gray-500 mb-1.5 font-medium flex items-center gap-1">
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
                            <div key={bedType} className="bg-gray-800/60 rounded-md px-1.5 py-1.5 text-center">
                              <div className="text-[9px] text-gray-500 truncate">{config.shortLabel}</div>
                              <div className="text-[13px] font-bold mt-0.5">
                                <span className={available > 0 ? "text-cyan-400" : "text-red-400"}>
                                  {available}
                                </span>
                                <span className="text-gray-600 text-[10px]">/{total}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-500 bg-gray-800/40 rounded-lg py-2 text-center">
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
                  const isLoadingMsg = messageLoading.get(hoveredHospital.code);

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
                  const isLoadingMsg = messageLoading.get(hoveredHospital.code);

                  if (isLoadingMsg) {
                    return (
                      <div className="text-[10px] text-gray-500 text-center py-1">
                        메시지 로딩 중...
                      </div>
                    );
                  }

                  if (msgData && msgData.emergency.length > 0) {
                    return (
                      <div className="bg-green-500/10 rounded-lg p-2 border border-green-500/20">
                        <div className="text-[10px] text-green-400 mb-1.5 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          응급실 운영 정보
                          <button
                            className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 hover:bg-green-500/30 pointer-events-auto"
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
                                <div key={idx} className="text-[9px] bg-gray-800/50 rounded p-1.5">
                                  <div className="flex items-center gap-1 flex-wrap mb-0.5">
                                    <span className="px-1 py-0.5 rounded bg-orange-500/20 text-orange-400">
                                      {parsed.department}
                                    </span>
                                    <span className={`px-1 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                                      {parsed.status.label}
                                    </span>
                                  </div>
                                  <div className="text-gray-400">{parsed.details}</div>
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
                  <div className="text-[10px] text-gray-500 text-center py-1">
                    등록된 진료정보가 없습니다
                  </div>
                )}
              </div>
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
          <div className={`backdrop-blur-sm rounded-lg p-2.5 border shadow-xl transition-colors ${isDark ? 'bg-gray-800/95 border-gray-600' : 'bg-white/95 border-gray-300'}`}>
            <div className={`font-bold text-sm mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {PATH_ID_TO_REGION[hoveredRegion] || hoveredRegion}
            </div>
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              응급의료기관: {regionHospitalCounts[hoveredRegion] || 0}개
            </div>
            <div className={`text-[10px] mt-1 ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
              클릭하여 상세 보기
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
