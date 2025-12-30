import type { DayOfWeek, AvailabilityStatus } from "@/types";

// 요일 목록
export const DAYS_OF_WEEK: DayOfWeek[] = ["월", "화", "수", "목", "금", "토", "일"];

// 가용성 상태별 색상
export const AVAILABILITY_COLORS: Record<AvailabilityStatus, string> = {
  "24시간": "bg-green-500",
  "주간": "bg-blue-500",
  "야간": "bg-red-500",
  "불가": "bg-gray-300",
};

// 가용성 상태별 텍스트 색상
export const AVAILABILITY_TEXT_COLORS: Record<AvailabilityStatus, string> = {
  "24시간": "text-green-600",
  "주간": "text-blue-600",
  "야간": "text-red-600",
  "불가": "text-gray-400",
};

// 가용성 상태별 배지 스타일
export const AVAILABILITY_BADGE_STYLES: Record<AvailabilityStatus, string> = {
  "24시간": "bg-green-100 text-green-800 border-green-200",
  "주간": "bg-blue-100 text-blue-800 border-blue-200",
  "야간": "bg-red-100 text-red-800 border-red-200",
  "불가": "bg-gray-100 text-gray-500 border-gray-200",
};

// 대구 구군 목록 (추후 지도 확장 시 사용)
export const DAEGU_DISTRICTS = [
  { code: "2711", name: "중구" },
  { code: "2714", name: "동구" },
  { code: "2717", name: "서구" },
  { code: "2720", name: "남구" },
  { code: "2723", name: "북구" },
  { code: "2726", name: "수성구" },
  { code: "2729", name: "달서구" },
  { code: "2771", name: "달성군" },
  { code: "2772", name: "군위군" },
];
