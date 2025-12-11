"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDiseases } from "@/lib/data";

interface DiseaseSelectorProps {
  selectedDisease: string | null;
  onDiseaseChange: (disease: string | null) => void;
}

export function DiseaseSelector({
  selectedDisease,
  onDiseaseChange,
}: DiseaseSelectorProps) {
  const diseases = getDiseases();

  return (
    <Select
      value={selectedDisease || "all"}
      onValueChange={(v) => onDiseaseChange(v === "all" ? null : v)}
    >
      <SelectTrigger className="w-full max-w-xs">
        <SelectValue placeholder="질환 선택" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">전체 질환</SelectItem>
        {diseases.map((disease) => (
          <SelectItem key={disease.id} value={disease.name}>
            {disease.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
