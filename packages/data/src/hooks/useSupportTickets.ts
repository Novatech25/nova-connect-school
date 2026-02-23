import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supportTicketQueries } from "../queries/supportTickets";

export function useSupportTickets(filters?: {
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
  unassigned?: boolean;
}) {
  const queryClient = useQueryClient();

  const tickets = useQuery({
    ...supportTicketQueries.getAll(filters),
  });

  const createTicket = useMutation({
    ...supportTicketQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["support-ticket-stats"] });
    },
  });

  const updateTicket = useMutation({
    ...supportTicketQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });

  const assignTicket = useMutation({
    ...supportTicketQueries.assign(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });

  const changeTicketStatus = useMutation({
    ...supportTicketQueries.changeStatus(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });

  const closeTicket = useMutation({
    ...supportTicketQueries.close(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["support-ticket-stats"] });
    },
  });

  const deleteTicket = useMutation({
    ...supportTicketQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["support-ticket-stats"] });
    },
  });

  return {
    tickets: tickets.data,
    isLoading: tickets.isLoading,
    error: tickets.error,
    createTicket,
    updateTicket,
    assignTicket,
    changeTicketStatus,
    closeTicket,
    deleteTicket,
  };
}

export function useSupportTicket(id: string) {
  const queryClient = useQueryClient();

  const ticket = useQuery({
    ...supportTicketQueries.getById(id),
    enabled: !!id,
  });

  const messages = useQuery({
    ...supportTicketQueries.getMessages(id),
    enabled: !!id,
  });

  const updateTicket = useMutation({
    ...supportTicketQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets", id] });
    },
  });

  const assignTicket = useMutation({
    ...supportTicketQueries.assign(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets", id] });
    },
  });

  const changeTicketStatus = useMutation({
    ...supportTicketQueries.changeStatus(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets", id] });
    },
  });

  const closeTicket = useMutation({
    ...supportTicketQueries.close(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets", id] });
    },
  });

  const createMessage = useMutation({
    ...supportTicketQueries.createMessage(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-ticket-messages", id] });
    },
  });

  const deleteMessage = useMutation({
    ...supportTicketQueries.deleteMessage(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-ticket-messages", id] });
    },
  });

  return {
    ticket: ticket.data,
    messages: messages.data,
    isLoading: ticket.isLoading || messages.isLoading,
    error: ticket.error || messages.error,
    updateTicket,
    assignTicket,
    changeTicketStatus,
    closeTicket,
    createMessage,
    deleteMessage,
  };
}

export function useTicketsBySchool(schoolId: string) {
  const tickets = useQuery({
    ...supportTicketQueries.getBySchool(schoolId),
    enabled: !!schoolId,
  });

  return {
    tickets: tickets.data,
    isLoading: tickets.isLoading,
    error: tickets.error,
  };
}

export function useTicketsByUser(userId: string) {
  const tickets = useQuery({
    ...supportTicketQueries.getByUser(userId),
    enabled: !!userId,
  });

  return {
    tickets: tickets.data,
    isLoading: tickets.isLoading,
    error: tickets.error,
  };
}

export function useTicketStats() {
  const stats = useQuery({
    ...supportTicketQueries.getStats(),
    refetchInterval: 60000, // Refetch every minute
  });

  return {
    stats: stats.data,
    isLoading: stats.isLoading,
    error: stats.error,
  };
}
