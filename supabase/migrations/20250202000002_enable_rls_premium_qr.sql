-- Migration: Enable RLS on Premium QR Tables
-- Description: Enables Row Level Security and creates policies for premium QR tables

-- Enable RLS on all premium tables
ALTER TABLE public.qr_class_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_scan_device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_scan_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_rotation_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES FOR qr_class_codes
-- ============================================================================

-- Helper function to check if user has admin/supervisor role in school
CREATE OR REPLACE FUNCTION has_school_role(user_id UUID, school_id UUID, required_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = has_school_role.user_id
    AND ur.school_id = has_school_role.school_id
    AND r.name = ANY(required_roles)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- SELECT: School admins, supervisors, and teachers can view QR codes for their school
CREATE POLICY "School admins and supervisors can view class QR codes"
  ON public.qr_class_codes FOR SELECT
  USING (
    school_id IN (
      SELECT ur.school_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND ur.school_id = qr_class_codes.school_id
      AND r.name IN ('school_admin', 'supervisor', 'teacher')
    )
  );

-- INSERT: Only school admins and supervisors can generate QR codes
CREATE POLICY "School admins and supervisors can insert class QR codes"
  ON public.qr_class_codes FOR INSERT
  WITH CHECK (
    school_id IN (
      SELECT ur.school_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND ur.school_id = qr_class_codes.school_id
      AND r.name IN ('school_admin', 'supervisor')
    )
  );

-- UPDATE: School admins and supervisors can update QR codes (deactivation, etc.)
CREATE POLICY "School admins and supervisors can update class QR codes"
  ON public.qr_class_codes FOR UPDATE
  USING (
    school_id IN (
      SELECT ur.school_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND ur.school_id = qr_class_codes.school_id
      AND r.name IN ('school_admin', 'supervisor')
    )
  );

-- DELETE: Only school admins can delete QR codes
CREATE POLICY "School admins can delete class QR codes"
  ON public.qr_class_codes FOR DELETE
  USING (
    school_id IN (
      SELECT ur.school_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND ur.school_id = qr_class_codes.school_id
      AND r.name = 'school_admin'
    )
  );

-- ============================================================================
-- POLICIES FOR qr_scan_device_fingerprints
-- ============================================================================

-- SELECT: School admins and supervisors can view device fingerprints
CREATE POLICY "School admins and supervisors can view device fingerprints"
  ON public.qr_scan_device_fingerprints FOR SELECT
  USING (
    school_id IN (
      SELECT ur.school_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND ur.school_id = qr_scan_device_fingerprints.school_id
      AND r.name IN ('school_admin', 'supervisor')
    )
  );

-- INSERT: Service role only (via Edge Functions)
CREATE POLICY "Service role can insert device fingerprints"
  ON public.qr_scan_device_fingerprints FOR INSERT
  WITH CHECK (false); -- auth.role_id() not available, use service_role key instead

-- UPDATE: Service role only (via Edge Functions)
CREATE POLICY "Service role can update device fingerprints"
  ON public.qr_scan_device_fingerprints FOR UPDATE
  USING (false); -- auth.role_id() not available, use service_role key instead

-- DELETE: School admins can delete device fingerprints (for unblocking)
CREATE POLICY "School admins can delete device fingerprints"
  ON public.qr_scan_device_fingerprints FOR DELETE
  USING (
    school_id IN (
      SELECT ur.school_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND ur.school_id = qr_scan_device_fingerprints.school_id
      AND r.name = 'school_admin'
    )
  );

-- ============================================================================
-- POLICIES FOR qr_scan_anomalies
-- ============================================================================

-- SELECT: School admins and supervisors can view anomalies
CREATE POLICY "School admins and supervisors can view anomalies"
  ON public.qr_scan_anomalies FOR SELECT
  USING (
    school_id IN (
      SELECT ur.school_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND ur.school_id = qr_scan_anomalies.school_id
      AND r.name IN ('school_admin', 'supervisor')
    )
  );

-- INSERT: Service role only (automatic detection via Edge Functions)
CREATE POLICY "Service role can insert anomalies"
  ON public.qr_scan_anomalies FOR INSERT
  WITH CHECK (false); -- auth.role_id() not available, use service_role key instead

-- UPDATE: School admins and supervisors can resolve anomalies
CREATE POLICY "School admins and supervisors can update anomalies"
  ON public.qr_scan_anomalies FOR UPDATE
  USING (
    school_id IN (
      SELECT ur.school_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND ur.school_id = qr_scan_anomalies.school_id
      AND r.name IN ('school_admin', 'supervisor')
    )
  );

-- DELETE: School admins can delete anomalies
CREATE POLICY "School admins can delete anomalies"
  ON public.qr_scan_anomalies FOR DELETE
  USING (
    school_id IN (
      SELECT ur.school_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND ur.school_id = qr_scan_anomalies.school_id
      AND r.name = 'school_admin'
    )
  );

-- ============================================================================
-- POLICIES FOR qr_rotation_history
-- ============================================================================

-- SELECT: School admins and supervisors can view rotation history
CREATE POLICY "School admins and supervisors can view rotation history"
  ON public.qr_rotation_history FOR SELECT
  USING (
    school_id IN (
      SELECT ur.school_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND ur.school_id = qr_rotation_history.school_id
      AND r.name IN ('school_admin', 'supervisor')
    )
  );

-- INSERT: Service role only (automatic logging via Edge Functions)
CREATE POLICY "Service role can insert rotation history"
  ON public.qr_rotation_history FOR INSERT
  WITH CHECK (false); -- auth.role_id() not available, use service_role key instead

-- UPDATE: No updates allowed (immutable history)
CREATE POLICY "No updates allowed on rotation history"
  ON public.qr_rotation_history FOR UPDATE
  USING (false);

-- DELETE: No deletes allowed (immutable history)
CREATE POLICY "No deletes allowed on rotation history"
  ON public.qr_rotation_history FOR DELETE
  USING (false);

-- ============================================================================
-- AUDIT TRIGGERS FOR PREMIUM QR TABLES
-- ============================================================================

-- Function to log QR class code changes to audit_logs
CREATE OR REPLACE FUNCTION audit_qr_class_codes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at
    ) VALUES (
      'qr_class_codes',
      NEW.id,
      'INSERT',
      NULL,
      to_jsonb(NEW),
      auth.uid(),
      NOW()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at
    ) VALUES (
      'qr_class_codes',
      NEW.id,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      auth.uid(),
      NOW()
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at
    ) VALUES (
      'qr_class_codes',
      OLD.id,
      'DELETE',
      to_jsonb(OLD),
      NULL,
      auth.uid(),
      NOW()
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for audit logging
CREATE TRIGGER audit_qr_class_codes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.qr_class_codes
  FOR EACH ROW EXECUTE FUNCTION audit_qr_class_codes();

-- Function to log device fingerprint changes to audit_logs
CREATE OR REPLACE FUNCTION audit_qr_scan_device_fingerprints()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at
    ) VALUES (
      'qr_scan_device_fingerprints',
      NEW.id,
      'INSERT',
      NULL,
      to_jsonb(NEW),
      auth.uid(),
      NOW()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at
    ) VALUES (
      'qr_scan_device_fingerprints',
      NEW.id,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      auth.uid(),
      NOW()
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at
    ) VALUES (
      'qr_scan_device_fingerprints',
      OLD.id,
      'DELETE',
      to_jsonb(OLD),
      NULL,
      auth.uid(),
      NOW()
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_qr_scan_device_fingerprints_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.qr_scan_device_fingerprints
  FOR EACH ROW EXECUTE FUNCTION audit_qr_scan_device_fingerprints();

-- Grant permissions for audit function
GRANT EXECUTE ON FUNCTION audit_qr_class_codes TO service_role;
GRANT EXECUTE ON FUNCTION audit_qr_scan_device_fingerprints TO service_role;
GRANT EXECUTE ON FUNCTION has_school_role TO postgres, authenticated, service_role;

-- Add comments for documentation
COMMENT ON FUNCTION has_school_role IS 'Helper function to check if user has specific roles in a school';
COMMENT ON FUNCTION audit_qr_class_codes IS 'Audit trigger for qr_class_codes table';
COMMENT ON FUNCTION audit_qr_scan_device_fingerprints IS 'Audit trigger for qr_scan_device_fingerprints table';
