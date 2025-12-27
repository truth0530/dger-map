"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DAYS_OF_WEEK } from "@/lib/constants";
import type { DayOfWeek } from "@/types";

interface DaySelectorProps {
  selectedDay: DayOfWeek;
  onDayChange: (day: DayOfWeek) => void;
}

export function DaySelector({ selectedDay, onDayChange }: DaySelectorProps) {
  return (
    <Tabs value={selectedDay} onValueChange={(v) => onDayChange(v as DayOfWeek)}>
      <TabsList className="grid grid-cols-7 w-full max-w-md">
        {DAYS_OF_WEEK.map((day) => (
          <TabsTrigger
            key={day}
            value={day}
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            {day}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
