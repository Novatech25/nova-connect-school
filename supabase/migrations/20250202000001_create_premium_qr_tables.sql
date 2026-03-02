-- Migration: Create Premium QR Attendance Tables
-- Description: Adds advanced QR code functionality with rapid rotation, device fingerprinting, and anomaly detection

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public;

-- Create Enums
CREATE TYPE qr_anomaly_type AS ENUM (
  'multiple_devices',
  'impossible_location',
  'rapid_scans',
  'signature_mismatch',
  'expired_reuse',
  'device_binding_violation'
);

CREATE TYPE qr_anomaly_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE qr_rotation_reason AS ENUM (
  'scheduled',
  'manual',
  'security_breach',
  'expiration'
);

-- Table: qr_class_codes
-- Stores QR codes generated for specific classes with rapid rotation (premium feature)
CREATE TABLE IF NOT EXISTS public.qr_class_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES public.campuses(id) ON DELETE SET NULL,

  -- QR Token and Signature
  qr_token TEXT NOT NULL,
  signature TEXT NOT NULL,

  -- Timing
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  rotation_interval_seconds INTEGER NOT NULL CHECK (rotation_interval_seconds BETWEEN 30 AND 600),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  generation_count INTEGER NOT NULL DEFAULT 1,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for qr_class_codes
CREATE INDEX idx_qr_class_codes_class_id ON public.qr_class_codes(class_id);
CREATE INDEX idx_qr_class_codes_expires_at ON public.qr_class_codes(expires_at);
CREATE INDEX idx_qr_class_codes_is_active ON public.qr_class_codes(is_active);
CREATE INDEX idx_qr_class_codes_school_id ON public.qr_class_codes(school_id);
CREATE INDEX idx_qr_class_codes_qr_token ON public.qr_class_codes(qr_token);

-- Table: qr_scan_device_fingerprints
-- Stores device fingerprints for fraud detection
CREATE TABLE IF NOT EXISTS public.qr_scan_device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,

  -- Device Identification
  device_fingerprint TEXT NOT NULL UNIQUE,
  device_info JSONB DEFAULT '{}',

  -- Tracking
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  scan_count INTEGER NOT NULL DEFAULT 1,

  -- Security
  is_suspicious BOOLEAN NOT NULL DEFAULT false,
  blocked_at TIMESTAMP WITH TIME ZONE,
  blocked_reason TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for qr_scan_device_fingerprints
CREATE INDEX idx_qr_scan_device_fingerprints_fingerprint ON public.qr_scan_device_fingerprints(device_fingerprint);
CREATE INDEX idx_qr_scan_device_fingerprints_student_id ON public.qr_scan_device_fingerprints(student_id);
CREATE INDEX idx_qr_scan_device_fingerprints_is_suspicious ON public.qr_scan_device_fingerprints(is_suspicious);
CREATE INDEX idx_qr_scan_device_fingerprints_school_id ON public.qr_scan_device_fingerprints(school_id);

-- Table: qr_scan_anomalies
-- Records detected anomalies and fraud attempts
CREATE TABLE IF NOT EXISTS public.qr_scan_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  qr_code_id UUID,

  -- Anomaly Details
  anomaly_type qr_anomaly_type NOT NULL,
  severity qr_anomaly_severity NOT NULL,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Context Data
  device_info JSONB DEFAULT '{}',
  location_data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',

  -- Resolution
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  resolution TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for qr_scan_anomalies
CREATE INDEX idx_qr_scan_anomalies_type ON public.qr_scan_anomalies(anomaly_type);
CREATE INDEX idx_qr_scan_anomalies_severity ON public.qr_scan_anomalies(severity);
CREATE INDEX idx_qr_scan_anomalies_detected_at ON public.qr_scan_anomalies(detected_at);
CREATE INDEX idx_qr_scan_anomalies_student_id ON public.qr_scan_anomalies(student_id);
CREATE INDEX idx_qr_scan_anomalies_school_id ON public.qr_scan_anomalies(school_id);

-- Table: qr_rotation_history
-- Tracks all QR code rotations for audit purposes
CREATE TABLE IF NOT EXISTS public.qr_rotation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  qr_code_id UUID NOT NULL REFERENCES public.qr_class_codes(id) ON DELETE CASCADE,

  -- Rotation Details
  old_token TEXT NOT NULL,
  new_token TEXT NOT NULL,
  rotated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  rotation_reason qr_rotation_reason NOT NULL,
  rotated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for qr_rotation_history
CREATE INDEX idx_qr_rotation_history_qr_code_id ON public.qr_rotation_history(qr_code_id);
CREATE INDEX idx_qr_rotation_history_rotated_at ON public.qr_rotation_history(rotated_at);
CREATE INDEX idx_qr_rotation_history_school_id ON public.qr_rotation_history(school_id);

-- Function: generate_device_fingerprint
-- Generates a unique device fingerprint from device information
CREATE OR REPLACE FUNCTION generate_device_fingerprint(
  p_device_info JSONB
) RETURNS TEXT AS $$
DECLARE
  v_fingerprint_data TEXT;
BEGIN
  -- Combine device attributes to create unique fingerprint
  v_fingerprint_data := CONCAT(
    COALESCE(p_device_info->>'platform', ''),
    '|',
    COALESCE(p_device_info->>'model', ''),
    '|',
    COALESCE(p_device_info->>'osVersion', ''),
    '|',
    COALESCE(p_device_info->>'screenResolution', ''),
    '|',
    COALESCE(p_device_info->>'timezone', '')
  );

  RETURN encode(digest(v_fingerprint_data, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: update_updated_at
-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER qr_class_codes_updated_at
  BEFORE UPDATE ON public.qr_class_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER qr_scan_device_fingerprints_updated_at
  BEFORE UPDATE ON public.qr_scan_device_fingerprints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER qr_scan_anomalies_updated_at
  BEFORE UPDATE ON public.qr_scan_anomalies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Grant permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.qr_class_codes TO postgres, service_role;
GRANT ALL ON public.qr_scan_device_fingerprints TO postgres, service_role;
GRANT ALL ON public.qr_scan_anomalies TO postgres, service_role;
GRANT ALL ON public.qr_rotation_history TO postgres, service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION generate_device_fingerprint TO postgres, service_role;
GRANT EXECUTE ON FUNCTION update_updated_at TO postgres, service_role;

-- Add comments for documentation
COMMENT ON TABLE public.qr_class_codes IS 'Premium QR codes generated for specific classes with rapid rotation';
COMMENT ON TABLE public.qr_scan_device_fingerprints IS 'Device fingerprints for fraud detection and device binding';
COMMENT ON TABLE public.qr_scan_anomalies IS 'Detected anomalies and fraud attempts in QR scanning';
COMMENT ON TABLE public.qr_rotation_history IS 'Audit trail of QR code rotations';
COMMENT ON FUNCTION generate_device_fingerprint IS 'Generates a unique SHA-256 hash from device information';
