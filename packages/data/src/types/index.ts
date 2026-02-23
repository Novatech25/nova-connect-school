import { Database } from "./database.generated";
export * from "./database.generated";
export type { Database };

// Helper types for RLS and RBAC
export type SchoolWithSettings = Database['public']['Tables']['schools']['Row'] & {
  settings: {
    academic_year?: string;
    currency?: string;
    timezone?: string;
    language?: string;
  };
};

export type UserWithRoles = Database['public']['Tables']['users']['Row'] & {
  roles: Array<{
    role_id: string;
    role_name: string;
    school_id: string | null;
  }>;
};

export type AuditLogWithUser = Database['public']['Tables']['audit_logs']['Row'] & {
  user?: {
    email: string;
    first_name: string;
    last_name: string;
  };
  school?: {
    name: string;
    code: string;
  };
};

// RLS helper types
export type SchoolFilter = {
  school_id: string;
};

export type RoleFilter = {
  role_name: string;
};

// Permission check result
export type PermissionCheck = {
  has_permission: boolean;
  role?: string;
  resource: string;
  action: string;
};
