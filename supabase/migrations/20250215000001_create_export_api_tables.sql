-- ============================================
-- Module Premium - API Export Avancé
-- Migration: Tables Export API
-- ============================================

-- Enums for export system
CREATE TYPE export_type_enum AS ENUM ('excel', 'pdf', 'csv');
CREATE TYPE export_resource_enum AS ENUM (
  'bulletins',
  'students',
  'attendance',
  'payments',
  'payroll',
  'grades',
  'schedules',
  'lesson_logs',
  'student_cards',
  'exam_results'
);
CREATE TYPE export_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed', 'expired');

-- ============================================
-- Table: export_templates
-- Stores customizable export templates per school
-- ============================================
CREATE TABLE export_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Type configuration
  export_type export_type_enum NOT NULL,
  resource_type export_resource_enum NOT NULL,

  -- Template configuration (JSONB)
  -- Structure:
  -- {
  --   columns: [
  --     { key: string, header: string, width: number, format: string, visible: boolean }
  --   ],
  --   filters: { ... },
  --   styles: {
  --     headerColor: string,
  --     headerFont: string,
  --     alternateRows: boolean,
  --     logo: boolean,
  --     ...
  --   },
  --   sortBy: { column: string, direction: 'asc' | 'desc' }
  -- }
  template_config JSONB NOT NULL DEFAULT '{}',

  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for export_templates
CREATE INDEX idx_export_templates_school_id ON export_templates(school_id);
CREATE INDEX idx_export_templates_resource_type ON export_templates(resource_type);
CREATE INDEX idx_export_templates_is_active ON export_templates(is_active);
CREATE INDEX idx_export_templates_school_resource ON export_templates(school_id, resource_type);

-- Updated at trigger
CREATE TRIGGER update_export_templates_updated_at
  BEFORE UPDATE ON export_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Table: export_jobs
-- Stores history and tracking of all exports
-- ============================================
CREATE TABLE export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  template_id UUID REFERENCES export_templates(id) ON DELETE SET NULL,

  -- Export configuration
  export_type export_type_enum NOT NULL,
  resource_type export_resource_enum NOT NULL,

  -- Status tracking
  status export_status_enum NOT NULL DEFAULT 'pending',

  -- File information
  file_path TEXT,
  file_size_bytes BIGINT,

  -- Configuration
  -- Structure: { dateRange: { start, end }, classes: [], status: [], ... }
  filters JSONB NOT NULL DEFAULT '{}',

  -- Statistics
  row_count INTEGER,

  -- User tracking
  initiated_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  scheduled_job_id UUID, -- Will add FK later after scheduled_exports table is created

  -- Error handling
  error_message TEXT,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for export_jobs
CREATE INDEX idx_export_jobs_school_id ON export_jobs(school_id);
CREATE INDEX idx_export_jobs_status ON export_jobs(status);
CREATE INDEX idx_export_jobs_created_at ON export_jobs(created_at DESC);
CREATE INDEX idx_export_jobs_template_id ON export_jobs(template_id);
CREATE INDEX idx_export_jobs_scheduled_job_id ON export_jobs(scheduled_job_id);
CREATE INDEX idx_export_jobs_school_status ON export_jobs(school_id, status);
-- Index removed: expires_at <= NOW() not IMMUTABLE for partial index

-- ============================================
-- Table: scheduled_exports
-- Stores automatic recurring export configurations
-- ============================================
CREATE TABLE scheduled_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  template_id UUID REFERENCES export_templates(id) ON DELETE SET NULL,

  -- Configuration
  name VARCHAR(255) NOT NULL,

  -- Cron expression (e.g., "0 9 * * 1" for every Monday at 9am)
  cron_expression VARCHAR(100) NOT NULL,

  -- Export configuration
  filters JSONB NOT NULL DEFAULT '{}',

  -- Email notification
  -- Array of email addresses to send export to
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Execution tracking
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL,

  -- Metadata
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for scheduled_exports
CREATE INDEX idx_scheduled_exports_school_id ON scheduled_exports(school_id);
CREATE INDEX idx_scheduled_exports_is_active ON scheduled_exports(is_active);
CREATE INDEX idx_scheduled_exports_next_run_at ON scheduled_exports(next_run_at) WHERE is_active = true;
CREATE INDEX idx_scheduled_exports_school_active ON scheduled_exports(school_id, is_active);

-- Updated at trigger
CREATE TRIGGER update_scheduled_exports_updated_at
  BEFORE UPDATE ON scheduled_exports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key for export_jobs.scheduled_job_id (after scheduled_exports is created)
ALTER TABLE export_jobs ADD CONSTRAINT export_jobs_scheduled_job_id_fkey
  FOREIGN KEY (scheduled_job_id) REFERENCES scheduled_exports(id) ON DELETE SET NULL;

-- ============================================
-- Table: export_api_tokens
-- Stores API tokens for external access
-- ============================================
CREATE TABLE export_api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- Token (hashed, not plain)
  token_hash TEXT NOT NULL UNIQUE,

  -- Token info
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Permissions
  -- Array of resource types this token can access
  -- Example: ['students', 'attendance', 'payments']
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Lifecycle
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER NOT NULL DEFAULT 0,
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 100,

  -- Metadata
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Indexes for export_api_tokens
CREATE INDEX idx_export_api_tokens_school_id ON export_api_tokens(school_id);
CREATE INDEX idx_export_api_tokens_token_hash ON export_api_tokens(token_hash);
CREATE INDEX idx_export_api_tokens_expires_at ON export_api_tokens(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_export_api_tokens_revoked_at ON export_api_tokens(revoked_at) WHERE revoked_at IS NOT NULL;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TYPE export_type_enum IS 'Export file types: excel, pdf, csv';
COMMENT ON TYPE export_resource_enum IS 'Resource types available for export';
COMMENT ON TYPE export_status_enum IS 'Export job status: pending, processing, completed, failed, expired';

COMMENT ON TABLE export_templates IS 'Customizable export templates per school';
COMMENT ON TABLE export_jobs IS 'History and tracking of all export jobs';
COMMENT ON TABLE scheduled_exports IS 'Automatic recurring export configurations';
COMMENT ON TABLE export_api_tokens IS 'API tokens for external export access';

COMMENT ON COLUMN export_templates.template_config IS 'JSONB configuration: columns, filters, styles, sorting';
COMMENT ON COLUMN export_jobs.filters IS 'JSONB filters applied to export data';
COMMENT ON COLUMN scheduled_exports.recipients IS 'JSONB array of email addresses for notifications';
COMMENT ON COLUMN export_api_tokens.permissions IS 'JSONB array of allowed resource types';
COMMENT ON COLUMN export_api_tokens.token_hash IS 'Hashed API token (bcrypt)';
