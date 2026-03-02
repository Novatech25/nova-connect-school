-- Function to send notification when document access is blocked
CREATE OR REPLACE FUNCTION notify_document_blocked()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify on blocked access attempts
  IF NEW.access_granted = false AND NEW.payment_status = 'blocked' THEN
    -- Call Edge Function asynchronously (fire and forget)
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/notify-document-blocked',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'studentId', NEW.student_id,
        'documentType', NEW.document_type
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER trigger_notify_document_blocked
  AFTER INSERT ON document_access_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_document_blocked();

COMMENT ON FUNCTION notify_document_blocked IS 'Sends notification to parents when document access is blocked';
