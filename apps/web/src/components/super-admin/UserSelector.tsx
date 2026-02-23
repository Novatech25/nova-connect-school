import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUsers } from "@novaconnect/data";
import { Loader2 } from "lucide-react";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

interface UserSelectorProps {
  value?: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  filterRole?: string;
  schoolId?: string;
}

export function UserSelector({
  value,
  onChange,
  placeholder = "Select a user",
  disabled = false,
  filterRole,
  schoolId,
}: UserSelectorProps) {
  // For now, we'll need to get users. This assumes there's a useUsers hook
  // If not, we'll need to create it or adjust the implementation
  const { users, isLoading } = useUsers();

  const filteredUsers = users?.filter((user) => {
    if (filterRole && user.role !== filterRole) return false;
    if (schoolId && user.schoolId !== schoolId) return false;
    return true;
  });

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger>
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading users...</span>
          </div>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {filteredUsers?.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            <div className="flex items-center gap-2">
              <div>
                <div className="font-medium">
                  {user.firstName} {user.lastName}
                </div>
                <div className="text-sm text-muted-foreground">{user.email}</div>
              </div>
              <span className="ml-auto text-xs bg-muted px-2 py-1 rounded">
                {user.role}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
