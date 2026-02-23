import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { roomAssignmentQueries } from "../queries/roomAssignments";
import type { 
  CalculateRoomAssignmentsRequest, 
  PublishRoomAssignmentsRequest,
  SendRoomAssignmentNotificationsRequest,
  RoomAssignmentUpdate 
} from "../queries/roomAssignments";

// Hook to get room assignments by date range
export function useRoomAssignments(schoolId: string, startDate: string, endDate: string) {
  return useQuery({
    ...roomAssignmentQueries.getByDateRange(schoolId, startDate, endDate),
    enabled: !!schoolId && !!startDate && !!endDate,
  });
}

// Hook to get room assignments for a specific date
export function useRoomAssignmentsByDate(schoolId: string, sessionDate: string) {
  return useQuery({
    ...roomAssignmentQueries.getByDate(schoolId, sessionDate),
    enabled: !!schoolId && !!sessionDate,
  });
}

// Hook to get room assignment statistics
export function useRoomAssignmentStats(schoolId: string, startDate: string, endDate: string) {
  return useQuery({
    ...roomAssignmentQueries.getStats(schoolId, startDate, endDate),
    enabled: !!schoolId && !!startDate && !!endDate,
  });
}

// Hook to calculate room assignments
export function useCalculateRoomAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    ...roomAssignmentQueries.calculate(),
    onSuccess: (_, variables) => {
      // Invalidate room assignments queries for the relevant date range
      queryClient.invalidateQueries({
        queryKey: ["room_assignments", variables.schoolId],
      });
      queryClient.invalidateQueries({
        queryKey: ["room_assignment_stats", variables.schoolId],
      });
    },
  });
}

// Hook to publish room assignments
export function usePublishRoomAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    ...roomAssignmentQueries.publish(),
    onSuccess: (_, variables) => {
      // Invalidate room assignments for the published date
      queryClient.invalidateQueries({
        queryKey: ["room_assignments", variables.schoolId, variables.sessionDate],
      });
      queryClient.invalidateQueries({
        queryKey: ["room_assignment_stats", variables.schoolId],
      });
    },
  });
}

// Hook to send room assignment notifications
export function useSendRoomAssignmentNotifications() {
  return useMutation({
    ...roomAssignmentQueries.sendNotifications(),
  });
}

// Hook to update a room assignment manually
export function useUpdateRoomAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    ...roomAssignmentQueries.update(),
    onSuccess: (data) => {
      if (data?.school_id) {
        queryClient.invalidateQueries({
          queryKey: ["room_assignments", data.school_id],
        });
      }
    },
  });
}

// Hook to delete a room assignment
export function useDeleteRoomAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    ...roomAssignmentQueries.delete(),
    onSuccess: (_, id, context) => {
      // We need to find the school_id from the cached data
      // This is a simplified approach - in practice you might want to pass school_id explicitly
      queryClient.invalidateQueries({
        queryKey: ["room_assignments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["room_assignment_stats"],
      });
    },
  });
}

// Combined hook for room assignment operations
export function useRoomAssignmentOperations(schoolId: string, sessionDate: string) {
  const queryClient = useQueryClient();
  
  const calculate = useCalculateRoomAssignments();
  const publish = usePublishRoomAssignments();
  const sendNotifications = useSendRoomAssignmentNotifications();
  const update = useUpdateRoomAssignment();
  const deleteAssignment = useDeleteRoomAssignment();
  
  const assignments = useRoomAssignmentsByDate(schoolId, sessionDate);

  return {
    // Data
    assignments: assignments.data || [],
    isLoading: assignments.isLoading,
    error: assignments.error,
    
    // Operations
    calculate,
    publish,
    sendNotifications,
    update,
    delete: deleteAssignment,
    
    // Refetch
    refetch: assignments.refetch,
  };
}
