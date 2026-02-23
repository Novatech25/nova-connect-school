import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import React from 'react'
import { getSupabaseClient } from '../client'
import {
  generateClassQrPremium as generateClassQrMutation,
  getActiveClassQr,
  getClassQrHistory,
  getDeviceFingerprints,
  getSchoolDeviceFingerprints,
  getAnomalies,
  getAnomalyStatistics,
  getPremiumQrSettings,
  updatePremiumQrSettings,
  resolveAnomaly as resolveAnomalyMutation,
  blockDevice as blockDeviceMutation,
  unblockDevice as unblockDeviceMutation,
  manualRotateQr,
  deactivateClassQr,
  getQrRotationHistory,
} from '../queries/qrAttendancePremium'
import type { GenerateClassQrPremium } from '@my-sandbox/core/schemas/qrAttendancePremium'

// ============================================================================
// QR CODE MANAGEMENT HOOKS
// ============================================================================

/**
 * Hook to generate a class QR code
 */
export function useGenerateClassQr() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: GenerateClassQrPremium) => generateClassQrMutation(params),
    onSuccess: (data, variables) => {
      // Invalidate and refetch active QR for this class
      queryClient.invalidateQueries({
        queryKey: ['activeClassQr', variables.classId],
      })
      // Invalidate QR history
      queryClient.invalidateQueries({
        queryKey: ['classQrHistory', variables.classId],
      })
    },
  })
}

/**
 * Hook to get the active QR code for a class
 * Automatically refetches to keep countdown updated
 */
export function useClassQrPremium(classId: string, enabled = true, refetchInterval = 5000) {
  return useQuery({
    queryKey: ['activeClassQr', classId],
    queryFn: () => getActiveClassQr(classId),
    enabled,
    refetchInterval,
    staleTime: 1000, // Consider data stale after 1 second
  })
}

/**
 * Hook to get QR code history for a class
 */
export function useClassQrHistory(classId: string, limit = 10) {
  return useQuery({
    queryKey: ['classQrHistory', classId, limit],
    queryFn: () => getClassQrHistory(classId, limit),
    enabled: !!classId,
  })
}

/**
 * Hook to manually rotate a QR code
 */
export function useManualRotateQr() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ qrCodeId, reason }: { qrCodeId: string; reason: 'manual' | 'security_breach' }) =>
      manualRotateQr(qrCodeId, reason),
    onSuccess: (_, variables) => {
      // Invalidate active QR queries
      queryClient.invalidateQueries({
        queryKey: ['activeClassQr'],
      })
      // Invalidate rotation history
      queryClient.invalidateQueries({
        queryKey: ['qrRotationHistory'],
      })
    },
  })
}

/**
 * Hook to deactivate a QR code
 */
export function useDeactivateQr() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (qrCodeId: string) => deactivateClassQr(qrCodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['activeClassQr'],
      })
    },
  })
}

/**
 * Hook to get QR rotation history
 */
export function useQrRotationHistory(qrCodeId?: string, classId?: string, limit = 20) {
  return useQuery({
    queryKey: ['qrRotationHistory', qrCodeId, classId, limit],
    queryFn: () => getQrRotationHistory(qrCodeId, classId, limit),
    enabled: !!(qrCodeId || classId),
  })
}

// ============================================================================
// DEVICE FINGERPRINT HOOKS
// ============================================================================

/**
 * Hook to get device fingerprints for a student
 */
export function useDeviceFingerprints(studentId: string) {
  return useQuery({
    queryKey: ['deviceFingerprints', studentId],
    queryFn: () => getDeviceFingerprints(studentId),
    enabled: !!studentId,
  })
}

/**
 * Hook to get all device fingerprints for a school
 */
export function useSchoolDeviceFingerprints(schoolId: string, suspiciousOnly = false) {
  return useQuery({
    queryKey: ['schoolDeviceFingerprints', schoolId, suspiciousOnly],
    queryFn: () => getSchoolDeviceFingerprints(schoolId, suspiciousOnly),
    enabled: !!schoolId,
  })
}

/**
 * Hook to block a device
 */
export function useBlockDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ fingerprintId, reason }: { fingerprintId: string; reason: string }) =>
      blockDeviceMutation(fingerprintId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['schoolDeviceFingerprints'],
      })
      queryClient.invalidateQueries({
        queryKey: ['deviceFingerprints'],
      })
    },
  })
}

/**
 * Hook to unblock a device
 */
export function useUnblockDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (fingerprintId: string) => unblockDeviceMutation(fingerprintId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['schoolDeviceFingerprints'],
      })
      queryClient.invalidateQueries({
        queryKey: ['deviceFingerprints'],
      })
    },
  })
}

// ============================================================================
// ANOMALY HOOKS
// ============================================================================

/**
 * Hook to get anomalies with filters and pagination
 */
export function useAnomalies(
  schoolId: string,
  filters?: {
    anomalyType?: string
    severity?: string
    studentId?: string
    status?: 'resolved' | 'unresolved'
    page?: number
    pageSize?: number
  }
) {
  return useQuery({
    queryKey: ['anomalies', schoolId, filters],
    queryFn: () => getAnomalies(schoolId, filters),
    enabled: !!schoolId,
  })
}

/**
 * Hook to get anomaly statistics
 */
export function useAnomalyStatistics(
  schoolId: string,
  startDate?: Date,
  endDate?: Date
) {
  return useQuery({
    queryKey: ['anomalyStatistics', schoolId, startDate, endDate],
    queryFn: () => getAnomalyStatistics(schoolId, startDate, endDate),
    enabled: !!schoolId,
  })
}

/**
 * Hook to resolve an anomaly
 */
export function useResolveAnomaly() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      anomalyId,
      resolution,
      reviewedBy,
    }: {
      anomalyId: string
      resolution: string
      reviewedBy: string
    }) => resolveAnomalyMutation(anomalyId, resolution, reviewedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['anomalies'],
      })
      queryClient.invalidateQueries({
        queryKey: ['anomalyStatistics'],
      })
    },
  })
}

// ============================================================================
// SETTINGS HOOKS
// ============================================================================

/**
 * Hook to get premium QR settings for a school
 */
export function usePremiumQrSettings(schoolId: string) {
  return useQuery({
    queryKey: ['premiumQrSettings', schoolId],
    queryFn: () => getPremiumQrSettings(schoolId),
    enabled: !!schoolId,
  })
}

/**
 * Hook to update premium QR settings
 */
export function useUpdatePremiumQrSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ schoolId, settings }: { schoolId: string; settings: Record<string, any> }) =>
      updatePremiumQrSettings(schoolId, settings),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['premiumQrSettings', variables.schoolId],
      })
    },
  })
}

// ============================================================================
// REALTIME HOOKS
// ============================================================================

/**
 * Hook to subscribe to QR rotation events in real-time
 */
export function useQrRotationSubscription(classId: string, callback: () => void) {
  React.useEffect(() => {
    const channel = getSupabaseClient()
      .channel(`qr_rotation:${classId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'qr_rotation_history',
          filter: `qr_code_id=in.(select id from qr_class_codes where class_id = ${classId})`,
        },
        () => {
          callback()
        }
      )
      .subscribe()

    return () => {
      getSupabaseClient().removeChannel(channel)
    }
  }, [classId, callback])
}

/**
 * Hook to subscribe to new anomalies in real-time
 */
export function useAnomalySubscription(schoolId: string, callback: (anomaly: any) => void) {
  React.useEffect(() => {
    const channel = getSupabaseClient()
      .channel(`anomalies:${schoolId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'qr_scan_anomalies',
          filter: `school_id=eq.${schoolId}`,
        },
        (payload) => {
          callback(payload.new)
        }
      )
      .subscribe()

    return () => {
      getSupabaseClient().removeChannel(channel)
    }
  }, [schoolId, callback])
}

/**
 * Hook to subscribe to attendance updates in real-time for a class
 */
export function useClassAttendanceSubscription(classId: string, callback: () => void) {
  React.useEffect(() => {
    const channel = getSupabaseClient()
      .channel(`class_attendance:${classId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'qr_scan_logs',
          filter: `qr_code_id=in.(select id from qr_class_codes where class_id = ${classId})`,
        },
        () => {
          callback()
        }
      )
      .subscribe()

    return () => {
      getSupabaseClient().removeChannel(channel)
    }
  }, [classId, callback])
}
