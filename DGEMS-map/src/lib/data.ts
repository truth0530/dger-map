import daeguData from "@/data/daegu-data.json";
import type { HospitalDiseaseData, Hospital, Disease, DayOfWeek, AvailabilityStatus, AvailabilityStats, HospitalSummary } from "@/types";

// 전체 데이터 가져오기
export function getAllData(): HospitalDiseaseData[] {
  return daeguData.data as HospitalDiseaseData[];
}

// 병원 목록 가져오기
export function getHospitals(): Hospital[] {
  return daeguData.hospitals as Hospital[];
}

// 질환 목록 가져오기
export function getDiseases(): Disease[] {
  return daeguData.diseases as Disease[];
}

// 메타 정보 가져오기
export function getMeta() {
  return daeguData.meta;
}

// 특정 질환의 병원별 데이터 가져오기
export function getDataByDisease(diseaseName: string): HospitalDiseaseData[] {
  return getAllData().filter((item) => item.질환명 === diseaseName);
}

// 특정 병원의 질환별 데이터 가져오기
export function getDataByHospital(hospitalCode: string): HospitalDiseaseData[] {
  return getAllData().filter((item) => item.소속기관코드 === hospitalCode);
}

// 특정 질환 + 요일의 가용성 통계
export function getAvailabilityStats(diseaseName: string, day: DayOfWeek): AvailabilityStats {
  const diseaseData = getDataByDisease(diseaseName);

  const stats: AvailabilityStats = {
    available24h: 0,
    dayOnly: 0,
    nightOnly: 0,
    unavailable: 0,
    total: diseaseData.length,
  };

  diseaseData.forEach((item) => {
    const status = item[day] as AvailabilityStatus;
    switch (status) {
      case "24시간":
        stats.available24h++;
        break;
      case "주간":
        stats.dayOnly++;
        break;
      case "야간":
        stats.nightOnly++;
        break;
      case "불가":
      default:
        stats.unavailable++;
        break;
    }
  });

  return stats;
}

// 대구 병원만 가져오기 (진료 데이터가 있는 병원)
export function getDaeguHospitals(): Hospital[] {
  return getHospitals().filter((h) => h.hasDiseaseData);
}

// 병원별 요약 데이터 (특정 요일 기준)
export function getHospitalSummaries(day: DayOfWeek): HospitalSummary[] {
  const hospitals = getDaeguHospitals();
  const allData = getAllData();

  return hospitals.map((hospital) => {
    const hospitalData = allData.filter(
      (item) => item.소속기관코드 === hospital.code
    );

    let availableCount = 0;
    let available24hCount = 0;
    let unavailableCount = 0;

    hospitalData.forEach((item) => {
      const status = item[day] as AvailabilityStatus;
      if (status === "24시간") {
        available24hCount++;
        availableCount++;
      } else if (status === "주간" || status === "야간") {
        availableCount++;
      } else {
        unavailableCount++;
      }
    });

    return {
      code: hospital.code,
      name: hospital.name,
      availableCount,
      available24hCount,
      unavailableCount,
      totalDiseases: hospitalData.length,
    };
  });
}

// 특정 질환의 가용 병원 목록 (특정 요일 기준)
export function getAvailableHospitals(
  diseaseName: string,
  day: DayOfWeek,
  statusFilter?: AvailabilityStatus[]
): HospitalDiseaseData[] {
  const diseaseData = getDataByDisease(diseaseName);

  if (!statusFilter || statusFilter.length === 0) {
    return diseaseData;
  }

  return diseaseData.filter((item) => {
    const status = item[day] as AvailabilityStatus;
    return statusFilter.includes(status);
  });
}
