-- Table: document_access_logs
CREATE TABLE document_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

  -- Document info
  document_type VARCHAR(50) NOT NULL, -- 'report_card', 'certificate', 'student_card', 'exam_authorization'
  document_id UUID NOT NULL,
  document_name VARCHAR(255),

  -- Access control
  access_granted BOOLEAN NOT NULL,
  payment_status payment_block_status_enum NOT NULL,
  payment_status_override BOOLEAN DEFAULT false,
  denial_reason TEXT,

  -- Metadata
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes
  CONSTRAINT document_access_logs_document_type_check
    CHECK (document_type IN ('report_card', 'certificate', 'student_card', 'exam_authorization', 'other'))
);

CREATE INDEX idx_document_access_logs_school_id ON document_access_logs(school_id);
CREATE INDEX idx_document_access_logs_user_id ON document_access_logs(user_id);
CREATE INDEX idx_document_access_logs_student_id ON document_access_logs(student_id);
CREATE INDEX idx_document_access_logs_document_type ON document_access_logs(document_type);
CREATE INDEX idx_document_access_logs_access_granted ON document_access_logs(access_granted);
CREATE INDEX idx_document_access_logs_accessed_at ON document_access_logs(accessed_at DESC);

COMMENT ON TABLE document_access_logs IS 'Audit log for all document access attempts';

-- Enable RLS
ALTER TABLE document_access_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: school_admin et accountant voient tous les logs de leur école
CREATE POLICY "document_access_logs_select_admin"
  ON document_access_logs FOR SELECT TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  );

-- INSERT: tous les utilisateurs authentifiés peuvent créer des logs
CREATE POLICY "document_access_logs_insert_authenticated"
  ON document_access_logs FOR INSERT TO authenticated
  WITH CHECK (school_id = get_user_school_id());

-- No UPDATE or DELETE (immutable audit log)
