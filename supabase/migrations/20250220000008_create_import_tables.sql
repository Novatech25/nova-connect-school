-- Enums
CREATE TYPE import_type_enum AS ENUM ('schedules', 'grades', 'students');
CREATE TYPE import_status_enum AS ENUM ('uploaded', 'parsing', 'validating', 'previewing', 'importing', 'completed', 'failed', 'rolled_back');
CREATE TYPE import_action_enum AS ENUM ('created', 'updated', 'skipped');

-- Table: import_jobs
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  import_type import_type_enum NOT NULL,
  file_name VARCHAR(255),
  file_path TEXT,
  file_size_bytes BIGINT,
  status import_status_enum DEFAULT 'uploaded',
  total_rows INTEGER DEFAULT 0,
  valid_rows INTEGER DEFAULT 0,
  invalid_rows INTEGER DEFAULT 0,
  imported_rows INTEGER DEFAULT 0,
  column_mapping JSONB DEFAULT '{}'::jsonb,
  validation_errors JSONB DEFAULT '[]'::jsonb,
  import_config JSONB DEFAULT '{}'::jsonb,
  initiated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  error_message TEXT,
  can_rollback BOOLEAN DEFAULT false,
  rolled_back_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: import_templates
CREATE TABLE import_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  import_type import_type_enum NOT NULL,
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_values JSONB DEFAULT '{}'::jsonb,
  validation_rules JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: import_history
CREATE TABLE import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  entity_type VARCHAR(100),
  entity_id UUID,
  action import_action_enum NOT NULL,
  row_number INTEGER,
  original_data JSONB DEFAULT '{}'::jsonb,
  imported_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_import_jobs_school_id ON import_jobs(school_id);
CREATE INDEX idx_import_jobs_status ON import_jobs(status);
CREATE INDEX idx_import_jobs_import_type ON import_jobs(import_type);
CREATE INDEX idx_import_jobs_created_at ON import_jobs(created_at DESC);
CREATE INDEX idx_import_jobs_school_status ON import_jobs(school_id, status);

CREATE INDEX idx_import_templates_school_id ON import_templates(school_id);
CREATE INDEX idx_import_templates_import_type ON import_templates(import_type);
CREATE INDEX idx_import_templates_is_active ON import_templates(is_active);

CREATE INDEX idx_import_history_import_job_id ON import_history(import_job_id);
CREATE INDEX idx_import_history_school_id ON import_history(school_id);
CREATE INDEX idx_import_history_entity_id ON import_history(entity_id);
CREATE INDEX idx_import_history_entity_type ON import_history(entity_type);
