// 요일별 가용성 상태
export type AvailabilityStatus = "24시간" | "주간" | "야간" | "불가";

// 요일 타입
export type DayOfWeek = "월" | "화" | "수" | "목" | "금" | "토" | "일";

// 일괄 적용 옵션
export type BatchApplyOption =
  | "모든요일 24시간가능"
  | "모든요일 주간만가능"
  | "모든요일 야간만가능"
  | "모든요일 불가능"
  | "요일마다 다름(아래에서 선택)";

// 병원별 질환 데이터
export interface HospitalDiseaseData {
  질환명: string;
  병원명: string;
  소속기관코드: string;
  이괄적용?: BatchApplyOption;
  진료정보?: string; // 전문의명
  비고?: string;
  수정일자?: string;
  // 요일별 가용성
  월: AvailabilityStatus;
  화: AvailabilityStatus;
  수: AvailabilityStatus;
  목: AvailabilityStatus;
  금: AvailabilityStatus;
  토: AvailabilityStatus;
  일: AvailabilityStatus;
}

// 병원 정보 (좌표 포함)
export interface Hospital {
  code: string;
  name: string;
  lat: number | null;
  lng: number | null;
  address?: string;
  region?: string;
  district?: string;
  classification?: string;
  hasDiseaseData: boolean; // 대구만 true
}

// 질환 정보
export interface Disease {
  id: string;
  name: string;
}

// 필터 상태
export interface FilterState {
  selectedDisease: string | null;
  selectedDay: DayOfWeek;
  selectedHospital: string | null;
}

// 가용성 통계
export interface AvailabilityStats {
  available24h: number;  // 24시간 가능
  dayOnly: number;       // 주간만 가능
  nightOnly: number;     // 야간만 가능
  unavailable: number;   // 불가
  total: number;
}

// 병원별 요약 데이터
export interface HospitalSummary {
  code: string;
  name: string;
  availableCount: number;     // 가능한 질환 수 (24시간 + 주간 + 야간)
  available24hCount: number;  // 24시간 가능 질환 수
  unavailableCount: number;   // 불가 질환 수
  totalDiseases: number;      // 전체 질환 수
}
