"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AVAILABILITY_BADGE_STYLES } from "@/lib/constants";
import type { HospitalDiseaseData, DayOfWeek, AvailabilityStatus } from "@/types";

interface HospitalTableProps {
  data: HospitalDiseaseData[];
  selectedDay: DayOfWeek;
  showDisease?: boolean;
}

export function HospitalTable({ data, selectedDay, showDisease = false }: HospitalTableProps) {
  // 가용성 순서로 정렬: 24시간 > 주간 > 야간 > 불가
  const sortedData = [...data].sort((a, b) => {
    const order: Record<AvailabilityStatus, number> = {
      "24시간": 0,
      "주간": 1,
      "야간": 2,
      "불가": 3,
    };
    const statusA = a[selectedDay] as AvailabilityStatus;
    const statusB = b[selectedDay] as AvailabilityStatus;
    return order[statusA] - order[statusB];
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">병원명</TableHead>
            {showDisease && <TableHead>질환</TableHead>}
            <TableHead className="w-[100px] text-center">{selectedDay}요일</TableHead>
            <TableHead>진료정보</TableHead>
            <TableHead>비고</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showDisease ? 5 : 4} className="text-center text-gray-500 py-8">
                데이터가 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((item, idx) => {
              const status = item[selectedDay] as AvailabilityStatus;
              return (
                <TableRow key={`${item.소속기관코드}-${item.질환명}-${idx}`}>
                  <TableCell className="font-medium">{item.병원명}</TableCell>
                  {showDisease && <TableCell>{item.질환명}</TableCell>}
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={AVAILABILITY_BADGE_STYLES[status]}
                    >
                      {status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {item.진료정보 || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {item.비고 || "-"}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
