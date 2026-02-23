// React Hooks for QR Attendance System
// Re-exports all QR attendance hooks from the queries module

export {
  // QR Code hooks
  useActiveQrCodes,
  useClassQrCode,
  useStudentQrCode,
  useGenerateQrCode,
  useDeactivateQrCode,
  // Scan Log hooks
  useValidateQrScan,
  useStudentScanLogs,
  useSchoolScanLogs,
  // Utility hooks
  useQrScanStats,
} from '../queries/qrAttendance';

// Re-export types for convenience
export type {
  QrAttendanceCode,
  QrScanLog,
  GenerateQrCodeInput,
  GenerateQrCodeResponse,
  ValidateQrScanInput,
  ValidateQrScanResponse,
  QrScanLogsFilter,
  QrCodeType,
  QrScanStatus,
  QrAttendanceConfig,
} from '@nova-connect/core';
