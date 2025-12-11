"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AvailabilityStats } from "@/types";

interface StatsCardProps {
  stats: AvailabilityStats;
  title?: string;
}

export function StatsCard({ stats, title = "가용성 현황" }: StatsCardProps) {
  const availableTotal = stats.available24h + stats.dayOnly + stats.nightOnly;
  const availablePercent = stats.total > 0
    ? Math.round((availableTotal / stats.total) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm">24시간</span>
              <span className="ml-auto font-semibold">{stats.available24h}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm">주간</span>
              <span className="ml-auto font-semibold">{stats.dayOnly}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-sm">야간</span>
              <span className="ml-auto font-semibold">{stats.nightOnly}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <span className="text-sm">불가</span>
              <span className="ml-auto font-semibold">{stats.unavailable}</span>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-blue-600">
              {availablePercent}%
            </div>
            <div className="text-xs text-gray-500">가용률</div>
            <div className="text-sm text-gray-600 mt-1">
              {availableTotal} / {stats.total}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
