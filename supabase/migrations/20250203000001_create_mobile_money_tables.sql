-- ============================================================================
-- Mobile Money Payment System - Database Schema
-- ============================================================================
-- This migration creates the database infrastructure for Mobile Money payments
-- in NovaConnect. It supports multiple providers (Orange Money, Moov Money, MTN, Wave)
-- with automatic reconciliation, audit logging, and multi-tenant isolation.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

-- Mobile Money transaction status
CREATE TYPE mobile_money_status AS ENUM (
  'initiated',   -- Payment initiated, waiting for user confirmation
  'pending',     -- Payment confirmation received from provider, waiting for webhook
  'success',     -- Payment completed successfully
  'failed',      -- Payment failed
  'cancelled',   -- Payment cancelled by user
  'expired',     -- Payment expired (timeout)
  'refunded'     -- Payment refunded
);

-- Reconciliation status
CREATE TYPE reconciliation_status AS ENUM (
  'pending',     -- Waiting for manual reconciliation
  'auto',        -- Automatically reconciled
  'manual',      -- Manually reconciled by accountant
  'failed'       -- Reconciliation failed
);

-- ----------------------------------------------------------------------------
-- Table: mobile_money_providers
-- ----------------------------------------------------------------------------
-- Stores configuration for Mobile Money providers (Orange, Moov, MTN, Wave)
-- Each school can configure multiple providers with specific credentials.
-- ----------------------------------------------------------------------------

CREATE TABLE mobile_money_providers (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant relationship
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- Provider identification
  provider_code VARCHAR(50) NOT NULL, -- 'orange_money', 'moov_money', 'mtn_money', 'wave'
  provider_name VARCHAR(255) NOT NULL,

  -- API configuration (encrypted in production)
  api_endpoint TEXT NOT NULL,
  api_key_encrypted TEXT,              -- Encrypted API key
  api_secret_encrypted TEXT,           -- Encrypted API secret
  merchant_id VARCHAR(255),            -- Merchant ID from provider

  -- Provider status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_test_mode BOOLEAN NOT NULL DEFAULT true,

  -- Configuration
  supported_countries JSONB NOT NULL DEFAULT '[]'::jsonb, -- ['CI', 'SN', 'ML', 'BF', 'NE', 'BJ', 'TG']
  transaction_fee_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  transaction_fee_fixed DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  min_amount DECIMAL(10, 2) NOT NULL DEFAULT 100.00,      -- Min amount in XOF
  max_amount DECIMAL(10, 2) NOT NULL DEFAULT 500000.00,   -- Max amount in XOF

  -- Additional settings and metadata
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,            -- Provider-specific config
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,            -- Additional metadata

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT mobile_money_providers_school_provider_unique UNIQUE (school_id, provider_code),
  CONSTRAINT mobile_money_providers_check_fees CHECK (
    transaction_fee_percent >= 0 AND
    transaction_fee_fixed >= 0 AND
    min_amount > 0 AND
    max_amount > min_amount
  )
);

-- Indexes
CREATE INDEX idx_mobile_money_providers_school_id ON mobile_money_providers(school_id);
CREATE INDEX idx_mobile_money_providers_provider_code ON mobile_money_providers(provider_code);
CREATE INDEX idx_mobile_money_providers_is_active ON mobile_money_providers(is_active);
CREATE INDEX idx_mobile_money_providers_school_active ON mobile_money_providers(school_id, is_active);

-- Comments
COMMENT ON TABLE mobile_money_providers IS
'Stores configuration for Mobile Money payment providers (Orange Money, Moov Money, MTN, Wave) with encrypted credentials and multi-tenant isolation.';

COMMENT ON COLUMN mobile_money_providers.id IS 'Unique identifier for the provider configuration';
COMMENT ON COLUMN mobile_money_providers.school_id IS 'Reference to the school (multi-tenant)';
COMMENT ON COLUMN mobile_money_providers.provider_code IS
'Provider identifier: orange_money, moov_money, mtn_money, wave';
COMMENT ON COLUMN mobile_money_providers.provider_name IS
'Custom provider name for display (e.g., "Orange Money CI")';
COMMENT ON COLUMN mobile_money_providers.api_endpoint IS
'API endpoint URL for the provider';
COMMENT ON COLUMN mobile_money_providers.api_key_encrypted IS
'Encrypted API key for authentication';
COMMENT ON COLUMN mobile_money_providers.api_secret_encrypted IS
'Encrypted API secret for authentication';
COMMENT ON COLUMN mobile_money_providers.merchant_id IS
'Merchant ID assigned by the provider';
COMMENT ON COLUMN mobile_money_providers.is_active IS
'Whether this provider is currently active for payments';
COMMENT ON COLUMN mobile_money_providers.is_test_mode IS
'Whether this provider is in test/sandbox mode';
COMMENT ON COLUMN mobile_money_providers.supported_countries IS
'Array of ISO country codes supported by this provider';
COMMENT ON COLUMN mobile_money_providers.transaction_fee_percent IS
'Transaction fee percentage charged by the provider';
COMMENT ON COLUMN mobile_money_providers.transaction_fee_fixed IS
'Fixed transaction fee charged by the provider';
COMMENT ON COLUMN mobile_money_providers.min_amount IS
'Minimum transaction amount in XOF';
COMMENT ON COLUMN mobile_money_providers.max_amount IS
'Maximum transaction amount in XOF';
COMMENT ON COLUMN mobile_money_providers.settings IS
'Provider-specific configuration (webhook URLs, timeouts, etc.)';
COMMENT ON COLUMN mobile_money_providers.metadata IS
'Additional metadata for extensibility';

-- ----------------------------------------------------------------------------
-- Table: mobile_money_transactions
-- ----------------------------------------------------------------------------
-- Stores all Mobile Money payment transactions with complete audit trail
-- Supports automatic and manual reconciliation with fee schedules.
-- ----------------------------------------------------------------------------

CREATE TABLE mobile_money_transactions (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant relationship
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- Relationships
  provider_id UUID NOT NULL REFERENCES mobile_money_providers(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  fee_schedule_id UUID REFERENCES fee_schedules(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,

  -- Transaction identifiers
  transaction_reference VARCHAR(100) UNIQUE NOT NULL,  -- Internal reference: MM-{schoolId}-{timestamp}-{random}
  external_transaction_id VARCHAR(255),                -- External transaction ID from provider

  -- Payment details
  phone_number VARCHAR(20) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'XOF',

  -- Status tracking
  status mobile_money_status NOT NULL DEFAULT 'initiated',
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,

  -- Error handling
  error_code VARCHAR(50),
  error_message TEXT,

  -- Retry mechanism
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,

  -- Webhook tracking
  webhook_received_at TIMESTAMPTZ,

  -- Reconciliation tracking
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reconciliation_status reconciliation_status NOT NULL DEFAULT 'pending',

  -- Metadata and audit
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Provider response, API calls, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT mobile_money_transactions_check_amount CHECK (amount > 0),
  CONSTRAINT mobile_money_transactions_check_expires CHECK (expires_at > initiated_at),
  CONSTRAINT mobile_money_transactions_check_retry CHECK (retry_count >= 0 AND max_retries > 0)
);

-- Indexes
CREATE INDEX idx_mobile_money_transactions_school_id ON mobile_money_transactions(school_id);
CREATE INDEX idx_mobile_money_transactions_student_id ON mobile_money_transactions(student_id);
CREATE INDEX idx_mobile_money_transactions_provider_id ON mobile_money_transactions(provider_id);
CREATE INDEX idx_mobile_money_transactions_fee_schedule_id ON mobile_money_transactions(fee_schedule_id);
CREATE INDEX idx_mobile_money_transactions_payment_id ON mobile_money_transactions(payment_id);
CREATE INDEX idx_mobile_money_transactions_transaction_reference ON mobile_money_transactions(transaction_reference);
CREATE INDEX idx_mobile_money_transactions_external_transaction_id ON mobile_money_transactions(external_transaction_id);
CREATE INDEX idx_mobile_money_transactions_status ON mobile_money_transactions(status);
CREATE INDEX idx_mobile_money_transactions_reconciliation_status ON mobile_money_transactions(reconciliation_status);
CREATE INDEX idx_mobile_money_transactions_phone_number ON mobile_money_transactions(phone_number);
CREATE INDEX idx_mobile_money_transactions_initiated_at ON mobile_money_transactions(initiated_at);
CREATE INDEX idx_mobile_money_transactions_school_status ON mobile_money_transactions(school_id, status);
CREATE INDEX idx_mobile_money_transactions_school_pending_reconciliation ON mobile_money_transactions(school_id, reconciliation_status)
  WHERE reconciliation_status = 'pending';

-- Comments
COMMENT ON TABLE mobile_money_transactions IS
'Stores all Mobile Money payment transactions with complete audit trail, automatic reconciliation support, and multi-tenant isolation.';

COMMENT ON COLUMN mobile_money_transactions.id IS 'Unique identifier for the transaction';
COMMENT ON COLUMN mobile_money_transactions.school_id IS 'Reference to the school (multi-tenant)';
COMMENT ON COLUMN mobile_money_transactions.provider_id IS 'Reference to the Mobile Money provider used';
COMMENT ON COLUMN mobile_money_transactions.student_id IS 'Reference to the student making the payment';
COMMENT ON COLUMN mobile_money_transactions.fee_schedule_id IS
'Reference to the fee schedule being paid (optional, for automatic reconciliation)';
COMMENT ON COLUMN mobile_money_transactions.payment_id IS
'Reference to the created payment record after reconciliation';
COMMENT ON COLUMN mobile_money_transactions.transaction_reference IS
'Internal transaction reference (format: MM-{schoolId}-{timestamp}-{random})';
COMMENT ON COLUMN mobile_money_transactions.external_transaction_id IS
'External transaction ID from the Mobile Money provider';
COMMENT ON COLUMN mobile_money_transactions.phone_number IS
'Phone number used for the Mobile Money payment';
COMMENT ON COLUMN mobile_money_transactions.amount IS 'Transaction amount in specified currency';
COMMENT ON COLUMN mobile_money_transactions.currency IS 'Currency code (default: XOF - West African CFA franc)';
COMMENT ON COLUMN mobile_money_transactions.status IS
'Transaction status: initiated, pending, success, failed, cancelled, expired, refunded';
COMMENT ON COLUMN mobile_money_transactions.initiated_at IS 'Timestamp when the transaction was initiated';
COMMENT ON COLUMN mobile_money_transactions.completed_at IS 'Timestamp when the transaction was completed (success or failed)';
COMMENT ON COLUMN mobile_money_transactions.expires_at IS 'Timestamp when the transaction expires (typically +15 minutes)';
COMMENT ON COLUMN mobile_money_transactions.error_code IS 'Error code from the provider (if failed)';
COMMENT ON COLUMN mobile_money_transactions.error_message IS 'Detailed error message (if failed)';
COMMENT ON COLUMN mobile_money_transactions.retry_count IS 'Number of retry attempts';
COMMENT ON COLUMN mobile_money_transactions.max_retries IS 'Maximum number of retry attempts allowed';
COMMENT ON COLUMN mobile_money_transactions.webhook_received_at IS 'Timestamp when the webhook was received';
COMMENT ON COLUMN mobile_money_transactions.reconciled_at IS 'Timestamp when the transaction was reconciled';
COMMENT ON COLUMN mobile_money_transactions.reconciled_by IS 'User who performed manual reconciliation (if applicable)';
COMMENT ON COLUMN mobile_money_transactions.reconciliation_status IS
'Reconciliation status: pending, auto (automatic), manual (by accountant), failed';
COMMENT ON COLUMN mobile_money_transactions.metadata IS
'Additional metadata: provider responses, API call logs, webhook payloads, etc.';

-- ----------------------------------------------------------------------------
-- Triggers for updated_at
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mobile_money_providers_updated_at
  BEFORE UPDATE ON mobile_money_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER mobile_money_transactions_updated_at
  BEFORE UPDATE ON mobile_money_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Grant permissions (service role for Edge Functions)
-- ----------------------------------------------------------------------------

-- Allow service role to perform all operations
GRANT ALL ON mobile_money_providers TO service_role;
GRANT ALL ON mobile_money_transactions TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
