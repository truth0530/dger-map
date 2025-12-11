"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { HospitalSummary } from "@/types";

interface HospitalSummaryCardProps {
  summary: HospitalSummary;
  onClick?: () => void;
  isSelected?: boolean;
}

export function HospitalSummaryCard({
  summary,
  onClick,
  isSelected = false,
}: HospitalSummaryCardProps) {
  const availablePercent = summary.totalDiseases > 0
    ? Math.round((summary.availableCount / summary.totalDiseases) * 100)
    : 0;

  // 가용률에 따른 색상
  const getColorClass = (percent: number) => {
    if (percent >= 80) return "bg-green-500";
    if (percent >= 60) return "bg-blue-500";
    if (percent >= 40) return "bg-yellow-500";
    if (percent >= 20) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? "ring-2 ring-blue-500" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{summary.name}</h3>
            <p className="text-xs text-gray-500 mt-1">
              가능: {summary.availableCount} / {summary.totalDiseases}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold ${getColorClass(
                availablePercent
              )}`}
            >
              {availablePercent}%
            </div>
          </div>
        </div>
        <div className="mt-2 flex gap-1">
          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500"
              style={{
                width: `${
                  (summary.available24hCount / summary.totalDiseases) * 100
                }%`,
              }}
            />
          </div>
        </div>
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>24시간: {summary.available24hCount}</span>
          <span>불가: {summary.unavailableCount}</span>
        </div>
      </CardContent>
    </Card>
  );
}
