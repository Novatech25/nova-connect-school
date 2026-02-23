import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSchools } from "@novaconnect/data";
import { Loader2 } from "lucide-react";

interface School {
  id: string;
  name: string;
  code: string;
  city?: string;
  country?: string;
}

interface SchoolSelectorProps {
  value?: string;
  onChange: (schoolId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  filterStatus?: "active" | "suspended" | "archived" | "all";
}

export function SchoolSelector({
  value,
  onChange,
  placeholder = "Select a school",
  disabled = false,
  filterStatus = "all",
}: SchoolSelectorProps) {
  const { schools, isLoading } = useSchools();

  const filteredSchools = schools?.filter((school) => {
    if (filterStatus === "all") return true;
    return school.status === filterStatus;
  });

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger>
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading schools...</span>
          </div>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {filteredSchools?.map((school) => (
          <SelectItem key={school.id} value={school.id}>
            <div className="flex items-center gap-2">
              <span className="font-medium">{school.name}</span>
              <span className="text-sm text-muted-foreground">({school.code})</span>
              {school.city && (
                <span className="text-sm text-muted-foreground">
                  - {school.city}, {school.country}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
