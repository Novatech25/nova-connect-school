-- Migration: Create QR Attendance Tables
-- Description: Tables for QR code-based attendance system with security features

-- Create enum for QR code types
CREATE TYPE qr_code_type AS ENUM ('school_global', 'class_specific', 'student_card');

-- Create enum for QR scan status
CREATE TYPE qr_scan_status AS ENUM (
  'success',
  'expired_qr',
  'invalid_signature',
  'wrong_class',
  'wrong_time',
  'out_of_range',
  'rate_limited',
  'duplicate_scan'
);

-- Table: qr_attendance_codes
-- Stores generated QR codes with HMAC signatures and expiration
CREATE TABLE IF NOT EXISTS public.qr_attendance_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code_type qr_code_type NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES public.campuses(id) ON DELETE SET NULL,
  qr_token TEXT NOT NULL UNIQUE,
  signature TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rotation_interval_minutes INTEGER NOT NULL DEFAULT 10,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure class_id is provided for class_specific codes
  CONSTRAINT qr_codes_class_specific_requires_class
    CHECK (code_type != 'class_specific' OR class_id IS NOT NULL),

  -- Ensure student_id is provided for student_card codes
  CONSTRAINT qr_codes_student_card_requires_student
    CHECK (code_type != 'student_card' OR student_id IS NOT NULL),

  -- Ensure QR expires after it's generated
  CONSTRAINT qr_codes_expires_after_generated
    CHECK (expires_at > generated_at),

  -- Ensure rotation interval is positive
  CONSTRAINT qr_codes_rotation_positive
    CHECK (rotation_interval_minutes > 0)
);

-- Table: qr_scan_logs
-- Logs all QR scan attempts (success and failures) for audit trail
CREATE TABLE IF NOT EXISTS public.qr_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  qr_code_id UUID REFERENCES public.qr_attendance_codes(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_record_id UUID REFERENCES public.attendance_records(id) ON DELETE SET NULL,
  scan_status qr_scan_status NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  device_info JSONB,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for qr_attendance_codes
CREATE INDEX idx_qr_codes_school_id ON public.qr_attendance_codes(school_id);
CREATE INDEX idx_qr_codes_class_id ON public.qr_attendance_codes(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX idx_qr_codes_student_id ON public.qr_attendance_codes(student_id) WHERE student_id IS NOT NULL;
CREATE INDEX idx_qr_codes_expires_at ON public.qr_attendance_codes(expires_at);
CREATE INDEX idx_qr_codes_is_active ON public.qr_attendance_codes(is_active);
CREATE INDEX idx_qr_codes_qr_token ON public.qr_attendance_codes(qr_token);

-- Create indexes for qr_scan_logs
CREATE INDEX idx_qr_scan_logs_school_id ON public.qr_scan_logs(school_id);
CREATE INDEX idx_qr_scan_logs_student_id ON public.qr_scan_logs(student_id);
CREATE INDEX idx_qr_scan_logs_scanned_at ON public.qr_scan_logs(scanned_at);
CREATE INDEX idx_qr_scan_logs_scan_status ON public.qr_scan_logs(scan_status);
CREATE INDEX idx_qr_scan_logs_qr_code_id ON public.qr_scan_logs(qr_code_id);

-- Create trigger to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_qr_attendance_codes_updated_at
  BEFORE UPDATE ON public.qr_attendance_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.qr_attendance_codes IS 'Stores generated QR codes with HMAC signatures for attendance tracking';
COMMENT ON TABLE public.qr_scan_logs IS 'Logs all QR scan attempts (success and failures) for security audit';
COMMENT ON COLUMN public.qr_attendance_codes.qr_token IS 'Unique token signed with HMAC';
COMMENT ON COLUMN public.qr_attendance_codes.signature IS 'HMAC-SHA256 signature of qr_token';
COMMENT ON COLUMN public.qr_scan_logs.scan_status IS 'Status of scan attempt: success, expired_qr, invalid_signature, wrong_class, wrong_time, out_of_range, rate_limited, duplicate_scan';
COMMENT ON COLUMN public.qr_scan_logs.device_info IS 'JSON containing user agent, device ID, IP address';
