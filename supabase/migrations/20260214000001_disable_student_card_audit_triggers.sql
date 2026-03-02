-- Migration: Disable student card audit triggers temporarily
-- Created: 2026-02-14
-- Description: Remove audit triggers that depend on missing log_audit_event function

-- Drop triggers that depend on log_audit_event
DROP TRIGGER IF EXISTS card_templates_audit_trigger ON card_templates;
DROP TRIGGER IF EXISTS student_cards_audit_trigger ON student_cards;

-- Drop the trigger functions
DROP FUNCTION IF EXISTS audit_card_templates() CASCADE;
DROP FUNCTION IF EXISTS audit_student_cards() CASCADE;

-- Note: These can be re-added later when log_audit_event function is properly created
