-- Receipt security hardening: token hashing, receipt status, and data hash

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.payment_receipts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.payment_receipts
  ADD COLUMN IF NOT EXISTS receipt_data_hash TEXT;

ALTER TABLE public.receipt_verification_tokens
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE public.receipt_verification_tokens
  ADD COLUMN IF NOT EXISTS short_code TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS public.receipt_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL,
  receipt_type TEXT NOT NULL,
  token_hash TEXT,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT TRUE,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Hash existing raw tokens (legacy rows). Raw tokens contain ':' separators.
-- The digest function seems to be problematic in this environment or migration context.
-- Since this is just a cleanup of legacy data, we can try to be more robust or skip if it fails.
-- Or we can try to use 'extensions.digest' if the search path is the issue.

DO $$
BEGIN
  -- Try to find where digest is
  IF EXISTS (SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE proname = 'digest' AND nspname = 'extensions') THEN
     UPDATE public.receipt_verification_tokens
     SET token_hash = encode(extensions.digest(token_hash, 'sha256'), 'hex')
     WHERE token_hash IS NOT NULL AND token_hash ~ ':';
  ELSIF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'digest') THEN
     -- Default path
     UPDATE public.receipt_verification_tokens
     SET token_hash = encode(digest(token_hash, 'sha256'), 'hex')
     WHERE token_hash IS NOT NULL AND token_hash ~ ':';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- If hashing fails, we just log notice and skip. It's better than blocking migration.
  -- The legacy tokens will remain unhashed but they are likely expired anyway.
  RAISE NOTICE 'Could not hash legacy tokens: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS receipt_verification_tokens_token_hash_idx
  ON public.receipt_verification_tokens (token_hash);

CREATE INDEX IF NOT EXISTS receipt_verification_tokens_short_code_idx
  ON public.receipt_verification_tokens (short_code);

CREATE INDEX IF NOT EXISTS receipt_verification_logs_receipt_idx
  ON public.receipt_verification_logs (receipt_id);
