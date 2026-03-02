CREATE OR REPLACE VIEW user_school_roles AS
SELECT
  ur.id,
  ur.user_id,
  ur.role_id,
  r.name AS role,
  ur.school_id,
  ur.assigned_by,
  ur.assigned_at
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id;

COMMENT ON VIEW user_school_roles IS 'Compatibility view for legacy role lookups (maps user_roles + roles)';
