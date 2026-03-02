-- Ensure storage bucket for report cards exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-cards', 'report-cards', false)
ON CONFLICT (id) DO NOTHING;
