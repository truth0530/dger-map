"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DaySelector } from "@/components/dashboard/DaySelector";
import { DiseaseSelector } from "@/components/dashboard/DiseaseSelector";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { HospitalTable } from "@/components/dashboard/HospitalTable";
import { HospitalSummaryCard } from "@/components/dashboard/HospitalSummaryCard";
import {
  getAllData,
  getDataByDisease,
  getDataByHospital,
  getAvailabilityStats,
  getHospitalSummaries,
  getMeta,
} from "@/lib/data";
import type { DayOfWeek, AvailabilityStats } from "@/types";

export function Dashboard() {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("월");
  const [selectedDisease, setSelectedDisease] = useState<string | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);

  const meta = getMeta();

  // 병원 요약 데이터
  const hospitalSummaries = useMemo(() => {
    return getHospitalSummaries(selectedDay);
  }, [selectedDay]);

  // 테이블에 표시할 데이터
  const tableData = useMemo(() => {
    if (selectedHospital) {
      const hospitalData = getDataByHospital(selectedHospital);
      if (selectedDisease) {
        return hospitalData.filter((d) => d.질환명 === selectedDisease);
      }
      return hospitalData;
    }
    if (selectedDisease) {
      return getDataByDisease(selectedDisease);
    }
    return getAllData();
  }, [selectedDisease, selectedHospital]);

  // 통계 데이터
  const stats = useMemo((): AvailabilityStats => {
    const data = tableData;
    const result: AvailabilityStats = {
      available24h: 0,
      dayOnly: 0,
      nightOnly: 0,
      unavailable: 0,
      total: data.length,
    };

    data.forEach((item) => {
      const status = item[selectedDay];
      switch (status) {
        case "24시간":
          result.available24h++;
          break;
        case "주간":
          result.dayOnly++;
          break;
        case "야간":
          result.nightOnly++;
          break;
        default:
          result.unavailable++;
      }
    });

    return result;
  }, [tableData, selectedDay]);

  // 선택된 병원 이름
  const selectedHospitalName = useMemo(() => {
    if (!selectedHospital) return null;
    const summary = hospitalSummaries.find((h) => h.code === selectedHospital);
    return summary?.name || null;
  }, [selectedHospital, hospitalSummaries]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            대구 중증응급질환 진료 현황
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {meta.totalHospitals}개 병원 · {meta.totalDiseases}개 질환 · 실시간 가용성 정보
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  요일 선택
                </label>
                <DaySelector selectedDay={selectedDay} onDayChange={setSelectedDay} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  질환 선택
                </label>
                <DiseaseSelector
                  selectedDisease={selectedDisease}
                  onDiseaseChange={(d) => {
                    setSelectedDisease(d);
                    setSelectedHospital(null);
                  }}
                />
              </div>
              {(selectedDisease || selectedHospital) && (
                <button
                  onClick={() => {
                    setSelectedDisease(null);
                    setSelectedHospital(null);
                  }}
                  className="text-sm text-blue-600 hover:underline mt-6"
                >
                  필터 초기화
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Hospital List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">병원 목록</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {hospitalSummaries.map((summary) => (
                    <HospitalSummaryCard
                      key={summary.code}
                      summary={summary}
                      isSelected={selectedHospital === summary.code}
                      onClick={() => {
                        setSelectedHospital(
                          selectedHospital === summary.code ? null : summary.code
                        );
                      }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Stats & Table */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatsCard
                stats={stats}
                title={
                  selectedHospitalName
                    ? `${selectedHospitalName} 현황`
                    : selectedDisease
                    ? `${selectedDisease} 현황`
                    : "전체 현황"
                }
              />
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    선택 정보
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">선택 요일</dt>
                      <dd className="font-semibold">{selectedDay}요일</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">선택 질환</dt>
                      <dd className="font-semibold">
                        {selectedDisease || "전체"}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">선택 병원</dt>
                      <dd className="font-semibold">
                        {selectedHospitalName || "전체"}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">표시 건수</dt>
                      <dd className="font-semibold">{tableData.length}건</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">상세 정보</CardTitle>
              </CardHeader>
              <CardContent>
                <HospitalTable
                  data={tableData}
                  selectedDay={selectedDay}
                  showDisease={!selectedDisease}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
