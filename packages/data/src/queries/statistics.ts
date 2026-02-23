import { getSupabaseClient } from "../client";

const supabase = getSupabaseClient();

export const statisticsQueries = {
  // Get global platform statistics
  getGlobalStats: () => ({
    queryKey: ["global-stats"],
    queryFn: async () => {
      // Get school statistics
      const { data: schools, error: schoolsError } = await supabase
        .from("schools")
        .select("id, status, subscription_plan, max_students, max_teachers, max_classes");

      if (schoolsError) throw schoolsError;

      // Get user statistics
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, role, school_id");

      if (usersError) throw usersError;

      // Get license statistics
      const { data: licenses, error: licensesError } = await supabase
        .from("licenses")
        .select("id, status, license_type");

      if (licensesError) throw licensesError;

      // Get support ticket statistics
      const { data: tickets, error: ticketsError } = await supabase
        .from("support_tickets")
        .select("id, status, priority");

      if (ticketsError) throw ticketsError;

      // Calculate statistics
      const schoolStats = {
        total: schools.length,
        active: schools.filter((s) => s.status === "active").length,
        suspended: schools.filter((s) => s.status === "suspended").length,
        archived: schools.filter((s) => s.status === "archived").length,
        byPlan: {
          free: schools.filter((s) => s.subscription_plan === "free").length,
          basic: schools.filter((s) => s.subscription_plan === "basic").length,
          premium: schools.filter((s) => s.subscription_plan === "premium").length,
          enterprise: schools.filter((s) => s.subscription_plan === "enterprise").length,
        },
        limits: {
          totalMaxStudents: schools.reduce((sum, s) => sum + (s.max_students || 0), 0),
          totalMaxTeachers: schools.reduce((sum, s) => sum + (s.max_teachers || 0), 0),
          totalMaxClasses: schools.reduce((sum, s) => sum + (s.max_classes || 0), 0),
        },
      };

      const userStats = {
        total: users.length,
        byRole: {
          super_admin: users.filter((u) => u.role === "super_admin").length,
          school_admin: users.filter((u) => u.role === "school_admin").length,
          accountant: users.filter((u) => u.role === "accountant").length,
          teacher: users.filter((u) => u.role === "teacher").length,
          student: users.filter((u) => u.role === "student").length,
          parent: users.filter((u) => u.role === "parent").length,
          supervisor: users.filter((u) => u.role === "supervisor").length,
        },
      };

      const licenseStats = {
        total: licenses.length,
        active: licenses.filter((l) => l.status === "active").length,
        expired: licenses.filter((l) => l.status === "expired").length,
        revoked: licenses.filter((l) => l.status === "revoked").length,
        suspended: licenses.filter((l) => l.status === "suspended").length,
        byType: {
          trial: licenses.filter((l) => l.license_type === "trial").length,
          basic: licenses.filter((l) => l.license_type === "basic").length,
          premium: licenses.filter((l) => l.license_type === "premium").length,
          enterprise: licenses.filter((l) => l.license_type === "enterprise").length,
        },
      };

      const ticketStats = {
        total: tickets.length,
        open: tickets.filter((t) => t.status === "open").length,
        inProgress: tickets.filter((t) => t.status === "in_progress").length,
        waitingResponse: tickets.filter((t) => t.status === "waiting_response").length,
        resolved: tickets.filter((t) => t.status === "resolved").length,
        closed: tickets.filter((t) => t.status === "closed").length,
        byPriority: {
          low: tickets.filter((t) => t.priority === "low").length,
          medium: tickets.filter((t) => t.priority === "medium").length,
          high: tickets.filter((t) => t.priority === "high").length,
          urgent: tickets.filter((t) => t.priority === "urgent").length,
        },
      };

      return {
        schools: schoolStats,
        users: userStats,
        licenses: licenseStats,
        tickets: ticketStats,
      };
    },
  }),

  // Get school-specific statistics
  getSchoolStats: (schoolId: string) => ({
    queryKey: ["school-stats", schoolId],
    queryFn: async () => {
      // Get school details
      const { data: school, error: schoolError } = await supabase
        .from("schools")
        .select("*")
        .eq("id", schoolId)
        .single();

      if (schoolError) throw schoolError;

      // Get user count for this school
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, role")
        .eq("school_id", schoolId);

      if (usersError) throw usersError;

      // Get licenses for this school
      const { data: licenses, error: licensesError } = await supabase
        .from("licenses")
        .select("*")
        .eq("school_id", schoolId);

      if (licensesError) throw licensesError;

      // Get tickets for this school
      const { data: tickets, error: ticketsError } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("school_id", schoolId);

      if (ticketsError) throw ticketsError;

      // Calculate usage statistics
      const userStats = {
        total: users.length,
        byRole: {} as Record<string, number>,
      };

      users.forEach((user) => {
        userStats.byRole[user.role] = (userStats.byRole[user.role] || 0) + 1;
      });

      return {
        school: {
          name: school.name,
          code: school.code,
          status: school.status,
          subscriptionPlan: school.subscription_plan,
          subscriptionExpiresAt: school.subscription_expires_at,
          limits: {
            maxStudents: school.max_students,
            maxTeachers: school.max_teachers,
            maxClasses: school.max_classes,
          },
        },
        users: userStats,
        licenses: {
          total: licenses.length,
          active: licenses.filter((l) => l.status === "active").length,
          expired: licenses.filter((l) => l.status === "expired").length,
        },
        tickets: {
          total: tickets.length,
          open: tickets.filter((t) => t.status === "open").length,
          inProgress: tickets.filter((t) => t.status === "in_progress").length,
          resolved: tickets.filter((t) => t.status === "resolved").length,
        },
      };
    },
  }),

  // Get recent activity (last 7 days)
  getRecentActivity: () => ({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get recent schools
      const { data: recentSchools, error: schoolsError } = await supabase
        .from("schools")
        .select("id, name, code, created_at")
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      if (schoolsError) throw schoolsError;

      // Get recent users
      const { data: recentUsers, error: usersError } = await supabase
        .from("users")
        .select("id, first_name, last_name, email, role, school_id, created_at")
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      if (usersError) throw usersError;

      // Get recent licenses
      const { data: recentLicenses, error: licensesError } = await supabase
        .from("licenses")
        .select(`
          id,
          license_key,
          license_type,
          school_id,
          created_at,
          school:schools(name, code)
        `)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      if (licensesError) throw licensesError;

      // Get recent tickets
      const { data: recentTickets, error: ticketsError } = await supabase
        .from("support_tickets")
        .select(`
          id,
          title,
          priority,
          status,
          school_id,
          created_at,
          school:schools(name, code)
        `)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      if (ticketsError) throw ticketsError;

      // Get recent critical audit logs
      const { data: recentAuditLogs, error: auditError } = await supabase
        .from("audit_logs")
        .select("*")
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      if (auditError) throw auditError;

      return {
        recentSchools,
        recentUsers,
        recentLicenses,
        recentTickets,
        recentAuditLogs,
      };
    },
  }),

  // Get alerts (expiring subscriptions, limits reached, etc.)
  getAlerts: () => ({
    queryKey: ["alerts"],
    queryFn: async () => {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Get schools with expiring subscriptions
      const { data: expiringSchools, error: expiringError } = await supabase
        .from("schools")
        .select("id, name, code, subscription_expires_at")
        .lte("subscription_expires_at", sevenDaysFromNow.toISOString())
        .gt("subscription_expires_at", now.toISOString())
        .eq("status", "active");

      if (expiringError) throw expiringError;

      // Get urgent unassigned tickets
      const { data: urgentTickets, error: ticketsError } = await supabase
        .from("support_tickets")
        .select(`
          id,
          title,
          priority,
          school_id,
          created_at,
          school:schools(name, code)
        `)
        .eq("priority", "urgent")
        .is("assigned_to", null)
        .neq("status", "closed");

      if (ticketsError) throw ticketsError;

      // Get expired licenses
      const { data: expiredLicenses, error: licensesError } = await supabase
        .from("licenses")
        .select(`
          id,
          license_key,
          license_type,
          expires_at,
          school_id,
          school:schools(name, code)
        `)
        .lt("expires_at", now.toISOString())
        .neq("status", "revoked");

      if (licensesError) throw licensesError;

      // TODO: Add logic for schools reaching 90% of limits
      // This would require more complex queries to calculate current usage

      return {
        expiringSubscriptions: expiringSchools,
        urgentUnassignedTickets: urgentTickets,
        expiredLicenses,
      };
    },
  }),
};
