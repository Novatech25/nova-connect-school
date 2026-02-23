import type { Database } from "../types";
import { getSupabaseClient } from "../client";

const supabase = getSupabaseClient();

type SupportTicketInsert = Database["public"]["Tables"]["support_tickets"]["Insert"];
type SupportTicketUpdate = Database["public"]["Tables"]["support_tickets"]["Update"];
type TicketMessageInsert = Database["public"]["Tables"]["support_ticket_messages"]["Insert"];

export const supportTicketQueries = {
  // Get all tickets with optional filters
  getAll: (filters?: {
    school_id?: string;
    status?: string;
    priority?: string;
    assigned_to?: string;
    category?: string;
    created_by?: string;
    search?: string;
    created_after?: Date;
    created_before?: Date;
    assigned_to_me?: boolean;
    currentUserId?: string;
    unassigned?: boolean;
  }) => ({
    queryKey: ["support-tickets", filters],
    queryFn: async () => {
      let query = supabase
        .from("support_tickets")
        .select(`
          *,
          school:schools(
            id,
            name,
            code,
            city
          ),
          creator:users!support_tickets_created_by_fkey(
            id,
            first_name,
            last_name,
            email,
            avatar_url
          ),
          assignee:users!support_tickets_assigned_to_fkey(
            id,
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .order("created_at", { ascending: false });

      if (filters?.school_id) {
        query = query.eq("school_id", filters.school_id);
      }

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.priority) {
        query = query.eq("priority", filters.priority);
      }

      if (filters?.assigned_to) {
        query = query.eq("assigned_to", filters.assigned_to);
      }

      if (filters?.created_by) {
        query = query.eq("created_by", filters.created_by);
      }

      if (filters?.category) {
        query = query.eq("category", filters.category);
      }

      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      if (filters?.created_after) {
        query = query.gte("created_at", filters.created_after.toISOString());
      }

      if (filters?.created_before) {
        query = query.lte("created_at", filters.created_before.toISOString());
      }

      // Fix: assigned_to_me now uses currentUserId to properly filter
      if (filters?.assigned_to_me === true && filters?.currentUserId) {
        query = query.eq("assigned_to", filters.currentUserId);
      }

      if (filters?.unassigned === true) {
        query = query.is("assigned_to", null);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  }),

  // Get ticket by ID with messages
  getById: (id: string) => ({
    queryKey: ["support-tickets", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(`
          *,
          school:schools(
            id,
            name,
            code,
            city,
            country
          ),
          creator:users!support_tickets_created_by_fkey(
            id,
            first_name,
            last_name,
            email,
            avatar_url
          ),
          assignee:users!support_tickets_assigned_to_fkey(
            id,
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Get ticket messages
  getMessages: (ticketId: string) => ({
    queryKey: ["support-ticket-messages", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .select(`
          *,
          user:users(
            id,
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  }),

  // Get tickets by school
  getBySchool: (schoolId: string) => ({
    queryKey: ["support-tickets", "school", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  }),

  // Get tickets by user (created by or assigned to)
  getByUser: (userId: string) => ({
    queryKey: ["support-tickets", "user", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  }),

  // Get ticket statistics
  getStats: () => ({
    queryKey: ["support-ticket-stats"],
    queryFn: async () => {
      const { data: tickets, error } = await supabase
        .from("support_tickets")
        .select("status, priority, category, created_at, resolved_at, closed_at");

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = {
        total: tickets.length,
        open: 0,
        inProgress: 0,
        waitingResponse: 0,
        resolved: 0,
        closed: 0,
        byPriority: {} as Record<string, number>,
        byCategory: {} as Record<string, number>,
        resolvedToday: 0,
        unassigned: 0,
        avgResolutionTime: 0,
      };

      let totalResolutionTime = 0;
      let resolvedCount = 0;

      tickets.forEach((ticket) => {
        // Count by status
        if (ticket.status === "open") stats.open++;
        else if (ticket.status === "in_progress") stats.inProgress++;
        else if (ticket.status === "waiting_response") stats.waitingResponse++;
        else if (ticket.status === "resolved") stats.resolved++;
        else if (ticket.status === "closed") stats.closed++;

        // Count by priority
        stats.byPriority[ticket.priority] = (stats.byPriority[ticket.priority] || 0) + 1;

        // Count by category
        if (ticket.category) {
          stats.byCategory[ticket.category] = (stats.byCategory[ticket.category] || 0) + 1;
        }

        // Count resolved today
        if (ticket.resolved_at) {
          const resolvedDate = new Date(ticket.resolved_at);
          if (resolvedDate >= today) {
            stats.resolvedToday++;
          }

          // Calculate resolution time
          if (ticket.created_at) {
            const created = new Date(ticket.created_at);
            const resolved = resolvedDate;
            const hours = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
            totalResolutionTime += hours;
            resolvedCount++;
          }
        }
      });

      // Calculate average resolution time
      if (resolvedCount > 0) {
        stats.avgResolutionTime = Math.round(totalResolutionTime / resolvedCount);
      }

      return stats;
    },
  }),

  // Create ticket
  create: () => ({
    mutationFn: async (ticket: SupportTicketInsert) => {
      const { data, error } = await supabase
        .from("support_tickets")
        .insert(ticket)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Update ticket
  update: () => ({
    mutationFn: async ({ id, ...update }: SupportTicketUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("support_tickets")
        .update(update)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Assign ticket
  assign: () => ({
    mutationFn: async ({ id, assignedTo }: { id: string; assignedTo: string }) => {
      const { data, error } = await supabase
        .from("support_tickets")
        .update({ assigned_to: assignedTo })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Change ticket status
  changeStatus: () => ({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from("support_tickets")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Close ticket
  close: () => ({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("support_tickets")
        .update({ status: "closed" })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Delete ticket
  delete: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("support_tickets").delete().eq("id", id);

      if (error) throw error;
      return id;
    },
  }),

  // Create ticket message
  createMessage: () => ({
    mutationFn: async (message: TicketMessageInsert) => {
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .insert(message)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Delete ticket message
  deleteMessage: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("support_ticket_messages")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return id;
    },
  }),
};
