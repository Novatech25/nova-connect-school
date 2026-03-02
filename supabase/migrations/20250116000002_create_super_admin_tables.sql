-- Migration: Super Admin Tables (Licenses and Support)
-- Created: 2025-01-16
-- Description: Creates tables for license management and support ticket system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- LICENSES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    license_key TEXT UNIQUE NOT NULL,
    license_type TEXT NOT NULL CHECK (license_type IN ('trial', 'basic', 'premium', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'suspended')),
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    activated_at TIMESTAMPTZ,
    max_activations INTEGER DEFAULT 1,
    activation_count INTEGER DEFAULT 0,
    hardware_fingerprint TEXT,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for licenses
CREATE INDEX idx_licenses_school_id ON licenses(school_id);
CREATE INDEX idx_licenses_license_key ON licenses(license_key);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_expires_at ON licenses(expires_at);
CREATE INDEX idx_licenses_license_type ON licenses(license_type);

-- =====================================================
-- LICENSE ACTIVATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS license_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    hardware_fingerprint TEXT NOT NULL,
    ip_address INET,
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated'))
);

-- Indexes for license_activations
CREATE INDEX idx_license_activations_license_id ON license_activations(license_id);
CREATE INDEX idx_license_activations_hardware_fingerprint ON license_activations(hardware_fingerprint);
CREATE INDEX idx_license_activations_school_id ON license_activations(school_id);

-- =====================================================
-- SUPPORT TICKETS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_response', 'resolved', 'closed')),
    category TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

-- Indexes for support_tickets
CREATE INDEX idx_support_tickets_school_id ON support_tickets(school_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_tickets_category ON support_tickets(category);

-- =====================================================
-- SUPPORT TICKET MESSAGES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for support_ticket_messages
CREATE INDEX idx_support_ticket_messages_ticket_id ON support_ticket_messages(ticket_id);
CREATE INDEX idx_support_ticket_messages_created_at ON support_ticket_messages(created_at);
CREATE INDEX idx_support_ticket_messages_user_id ON support_ticket_messages(user_id);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_licenses_updated_at
    BEFORE UPDATE ON licenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to increment activation count
CREATE OR REPLACE FUNCTION increment_activation_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment when a new activation is created with status 'active'
    IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
        UPDATE licenses
        SET activation_count = activation_count + 1,
            activated_at = COALESCE(licenses.activated_at, NOW())
        WHERE id = NEW.license_id;
    END IF;

    -- Decrement when an activation is changed from 'active' to 'deactivated'
    IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status = 'deactivated' THEN
        UPDATE licenses
        SET activation_count = GREATEST(activation_count - 1, 0)
        WHERE id = NEW.license_id;
    END IF;

    -- If deactivated status is changed back to active, increment again
    IF TG_OP = 'UPDATE' AND OLD.status = 'deactivated' AND NEW.status = 'active' THEN
        UPDATE licenses
        SET activation_count = activation_count + 1
        WHERE id = NEW.license_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER license_activation_increment
    AFTER INSERT OR UPDATE ON license_activations
    FOR EACH ROW
    EXECUTE FUNCTION increment_activation_count();

-- =====================================================
-- AUDIT LOG FUNCTIONS
-- =====================================================

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (school_id, user_id, action, resource_type, resource_id, new_data)
        VALUES (
            NEW.school_id,
            auth.uid(),
            'INSERT',
            TG_TABLE_NAME,
            NEW.id,
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (school_id, user_id, action, resource_type, resource_id, old_data, new_data)
        VALUES (
            COALESCE(NEW.school_id, OLD.school_id),
            auth.uid(),
            'UPDATE',
            TG_TABLE_NAME,
            NEW.id,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (school_id, user_id, action, resource_type, resource_id, old_data)
        VALUES (
            OLD.school_id,
            auth.uid(),
            'DELETE',
            TG_TABLE_NAME,
            OLD.id,
            to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Audit triggers for licenses
CREATE TRIGGER license_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON licenses
    FOR EACH ROW
    EXECUTE FUNCTION create_audit_log();

-- Audit triggers for license_activations
CREATE TRIGGER license_activation_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON license_activations
    FOR EACH ROW
    EXECUTE FUNCTION create_audit_log();

-- Audit triggers for support_tickets
CREATE TRIGGER support_ticket_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION create_audit_log();

-- Audit triggers for support_ticket_messages
CREATE TRIGGER support_ticket_message_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON support_ticket_messages
    FOR EACH ROW
    EXECUTE FUNCTION create_audit_log();

-- Function to set resolved_at and closed_at
CREATE OR REPLACE FUNCTION update_ticket_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
        NEW.resolved_at = NOW();
    END IF;

    IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
        NEW.closed_at = NOW();
        IF NEW.resolved_at IS NULL THEN
            NEW.resolved_at = NOW();
        END IF;
    END IF;

    IF NEW.status != 'resolved' AND OLD.status = 'resolved' THEN
        NEW.resolved_at = NULL;
    END IF;

    IF NEW.status NOT IN ('resolved', 'closed') AND OLD.status IN ('resolved', 'closed') THEN
        NEW.closed_at = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_support_ticket_timestamps
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_timestamps();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Licenses Policies
-- Super admins can do everything
CREATE POLICY "Super admins can view all licenses"
    ON licenses FOR SELECT
    USING (is_super_admin());

CREATE POLICY "Super admins can insert licenses"
    ON licenses FOR INSERT
    WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update licenses"
    ON licenses FOR UPDATE
    USING (is_super_admin());

CREATE POLICY "Super admins can delete licenses"
    ON licenses FOR DELETE
    USING (is_super_admin());

-- School admins can view their school's licenses
CREATE POLICY "School admins can view own school licenses"
    ON licenses FOR SELECT
    USING (
        is_school_admin() AND
        school_id = get_current_user_school_id()
    );

-- License Activations Policies
CREATE POLICY "Super admins can view all license activations"
    ON license_activations FOR SELECT
    USING (is_super_admin());

CREATE POLICY "School admins can view own school license activations"
    ON license_activations FOR SELECT
    USING (
        is_school_admin() AND
        school_id = get_current_user_school_id()
    );

-- Support Tickets Policies
CREATE POLICY "Super admins can view all tickets"
    ON support_tickets FOR SELECT
    USING (is_super_admin());

CREATE POLICY "Super admins can insert tickets"
    ON support_tickets FOR INSERT
    WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update tickets"
    ON support_tickets FOR UPDATE
    USING (is_super_admin());

CREATE POLICY "Super admins can delete tickets"
    ON support_tickets FOR DELETE
    USING (is_super_admin());

-- School users can view their school's tickets
CREATE POLICY "School users can view own school tickets"
    ON support_tickets FOR SELECT
    USING (
        get_current_user_school_id() IS NOT NULL AND
        school_id = get_current_user_school_id()
    );

-- School users can create tickets for their school
CREATE POLICY "School users can create tickets"
    ON support_tickets FOR INSERT
    WITH CHECK (
        get_current_user_school_id() IS NOT NULL AND
        school_id = get_current_user_school_id() AND
        created_by = auth.uid()
    );

-- School users can update their own tickets
CREATE POLICY "School users can update own tickets"
    ON support_tickets FOR UPDATE
    USING (
        created_by = auth.uid() OR
        assigned_to = auth.uid()
    );

-- Support Ticket Messages Policies
CREATE POLICY "Super admins can view all ticket messages"
    ON support_ticket_messages FOR SELECT
    USING (is_super_admin());

CREATE POLICY "Super admins can insert ticket messages"
    ON support_ticket_messages FOR INSERT
    WITH CHECK (is_super_admin());

CREATE POLICY "Ticket participants can view messages"
    ON support_ticket_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM support_tickets
            WHERE support_tickets.id = support_ticket_messages.ticket_id
            AND (
                support_tickets.school_id = get_current_user_school_id()
                OR is_super_admin()
            )
        )
    );

CREATE POLICY "Ticket participants can insert messages"
    ON support_ticket_messages FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM support_tickets
            WHERE support_tickets.id = support_ticket_messages.ticket_id
            AND (
                support_tickets.school_id = get_current_user_school_id()
                OR is_super_admin()
            )
        )
    );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE licenses IS 'Stores license information for each school';
COMMENT ON TABLE license_activations IS 'Tracks license activations for anti-copy protection';
COMMENT ON TABLE support_tickets IS 'Support tickets created by schools';
COMMENT ON TABLE support_ticket_messages IS 'Messages within support tickets';

COMMENT ON COLUMN licenses.license_key IS 'Unique license key in format NOVA-XXXX-XXXX-XXXX-XXXX';
COMMENT ON COLUMN licenses.hardware_fingerprint IS 'Hardware fingerprint for anti-copy protection';
COMMENT ON COLUMN licenses.max_activations IS 'Maximum number of allowed activations';
COMMENT ON COLUMN support_ticket_messages.is_internal IS 'Internal notes visible only to super admins';
