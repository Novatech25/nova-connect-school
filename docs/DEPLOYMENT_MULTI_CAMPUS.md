# Multi-Campus Module Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying the multi-campus premium module to NovaConnect.

## Prerequisites
- ✅ License Premium or Enterprise active
- ✅ Supabase migrations up to date
- ✅ Edge Functions deployed
- ✅ Tests passing (unit + integration)

## Phase 1: Database Deployment

### Step 1: Run Database Migrations

Execute the migrations in order:

```bash
# 1. Create multi-campus tables
supabase migration up --file 20250210000001_create_multi_campus_premium.sql

# 2. Enable RLS policies
supabase migration up --file 20250210000002_enable_rls_multi_campus.sql

# 3. Create audit triggers
supabase migration up --file 20250210000003_create_multi_campus_audit_triggers.sql
```

### Step 2: Verify Migration Success

```sql
-- Check new tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_campus_access', 'campus_schedules');

-- Check RLS policies enabled
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('user_campus_access', 'campus_schedules', 'classes', 'planned_sessions')
ORDER BY tablename, policyname;

-- Check triggers created
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%campus%';
```

### Step 3: Optional Data Migration

If migrating existing data:

```bash
# Review the migration script first
cat supabase/migrations/20250210000004_migrate_existing_data_multi_campus.sql

# Run if appropriate
supabase migration up --file 20250210000004_migrate_existing_data_multi_campus.sql
```

## Phase 2: Edge Functions Deployment

### Step 1: Deploy Edge Functions

```bash
# Deploy campus location validation
supabase functions deploy validate-campus-location

# Deploy campus reports
supabase functions deploy generate-campus-report

# Verify deployment
supabase functions list
```

### Step 2: Test Edge Functions

```bash
# Test validate-campus-location
curl -X POST https://your-project.supabase.co/functions/v1/validate-campus-location \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schoolId": "school-uuid",
    "campusId": "campus-uuid",
    "userLat": 48.8566,
    "userLon": 2.3522,
    "action": "attendance"
  }'

# Test generate-campus-report
curl -X POST https://your-project.supabase.co/functions/v1/generate-campus-report \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schoolId": "school-uuid",
    "campusId": "campus-uuid",
    "reportType": "attendance",
    "startDate": "2025-01-01",
    "endDate": "2025-01-31"
  }'
```

### Step 3: Check Logs

```bash
# View Edge Function logs
supabase functions logs validate-campus-location
supabase functions logs generate-campus-report
```

## Phase 3: Application Build & Deploy

### Step 1: Build Web Application

```bash
# Install dependencies
pnpm install

# Build web app
pnpm build --filter=web

# Verify build output
ls -la apps/web/dist/
```

### Step 2: Build Mobile Application

```bash
# Build mobile app
eas build --platform all

# Or for development
pnpm build --filter=mobile
```

### Step 3: Deploy Web Application

```bash
# Deploy to Vercel (or your hosting platform)
cd apps/web
vercel --prod

# Or use your existing deployment pipeline
```

### Step 4: Deploy Mobile Application

```bash
# Submit to app stores
eas submit --platform ios
eas submit --platform android
```

## Phase 4: Configuration & Testing

### Step 1: Activate Module for Test Schools

1. Go to Super Admin Dashboard
2. Navigate to Schools → Select Test School
3. Edit School Settings
4. Add `multi_campus` to `enabled_modules`
5. Save changes

### Step 2: Create Test Campuses

```sql
-- Example: Create test campuses
INSERT INTO campuses (school_id, name, code, address, city, latitude, longitude, radius_meters, is_main)
VALUES
  ('school-uuid-1', 'Campus Principal', 'MAIN', '123 Rue Principale', 'Paris', 48.8566, 2.3522, 300, true),
  ('school-uuid-1', 'Campus Nord', 'NORTH', '456 Avenue Nord', 'Paris', 48.8766, 2.3722, 250, false),
  ('school-uuid-1', 'Campus Sud', 'SOUTH', '789 Boulevard Sud', 'Paris', 48.8366, 2.3322, 200, false);
```

### Step 3: Assign Test Users to Campuses

```sql
-- Grant test teachers access to campuses
INSERT INTO user_campus_access (school_id, user_id, campus_id, access_type, can_access)
VALUES
  ('school-uuid-1', 'teacher-uuid-1', 'campus-uuid-main', 'full_access', true),
  ('school-uuid-1', 'teacher-uuid-1', 'campus-uuid-north', 'full_access', true),
  ('school-uuid-1', 'teacher-uuid-2', 'campus-uuid-south', 'full_access', true);
```

### Step 4: Test Workflows

#### Admin Web
- ✅ View campuses list
- ✅ Create new campus
- ✅ Edit campus details
- ✅ Assign teachers to campuses
- ✅ Generate campus reports

#### Teacher Mobile
- ✅ Select campus (if multiple)
- ✅ View campus-specific schedule
- ✅ Take attendance with location validation
- ✅ View campus indicator

#### Student Mobile
- ✅ View class campus
- ✅ Scan QR with campus validation
- ✅ View campus-specific schedule

## Phase 5: Monitoring

### Step 1: Configure Error Tracking

```javascript
// Add to Sentry or your error tracking
Sentry.setTag('module', 'multi_campus');
Sentry.setTag('license_type', licenseType);
```

### Step 2: Set Up Alerts

- Database query performance (RLS policies)
- Edge Function success rate
- Location validation failures
- Campus access denials

### Step 3: Monitor Key Metrics

```sql
-- Campus usage statistics
SELECT
  c.name,
  COUNT(DISTINCT ps.id) as sessions_count,
  COUNT(DISTINCT e.student_id) as students_count
FROM campuses c
LEFT JOIN planned_sessions ps ON ps.campus_id = c.id
LEFT JOIN classes cl ON cl.id = ps.class_id
LEFT JOIN enrollments e ON e.class_id = cl.id
GROUP BY c.id, c.name;

-- User campus access distribution
SELECT
  access_type,
  COUNT(*) as user_count
FROM user_campus_access
GROUP BY access_type;

-- Location validation success rate
SELECT
  action,
  COUNT(*) FILTER (WHERE details->>'success' = 'true') as success_count,
  COUNT(*) FILTER (WHERE details->>'success' = 'false') as failure_count,
  COUNT(*) as total_count,
  ROUND(
    (COUNT(*) FILTER (WHERE details->>'success' = 'true')::float / COUNT(*)::float) * 100,
    2
  ) as success_rate
FROM audit_logs
WHERE resource_type = 'campus'
  AND action = 'validate_campus_location'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY action;
```

### Step 4: Review Audit Logs

```sql
-- Recent campus access changes
SELECT
  al.created_at,
  al.action,
  al.resource_type,
  u.first_name,
  u.last_name,
  c.name as campus_name,
  al.details
FROM audit_logs al
JOIN users u ON u.id = al.user_id
LEFT JOIN campuses c ON c.id = al.resource_id
WHERE al.resource_type IN ('campus_access', 'campus_schedule', 'campus_assignment')
ORDER BY al.created_at DESC
LIMIT 100;
```

## Phase 6: Documentation

### Step 1: Update User Guides

- ✅ Admin documentation for campus management
- ✅ Teacher guide for multi-campus usage
- ✅ Student guide for campus features

### Step 2: Create FAQ

Add common questions to help documentation:

- How do I create a new campus?
- How do I assign teachers to campuses?
- What happens when GPS validation fails?
- Can I move a class to a different campus?

### Step 3: Training Materials

- Video demo for school admins
- Screenshot tutorials
- Best practices guide

## Rollback Procedure

If critical issues are discovered:

### Option 1: Disable Module (Recommended)

```sql
-- Disable multi-campus for affected schools
UPDATE schools
SET enabled_modules = array_remove(enabled_modules, 'multi_campus')
WHERE id IN ('affected-school-uuid-1', 'affected-school-uuid-2');
```

### Option 2: Full Rollback

```sql
-- Drop new tables (WARNING: This deletes data)
DROP TABLE IF EXISTS campus_schedules;
DROP TABLE IF EXISTS user_campus_access;

-- Remove campus_id columns (WARNING: This deletes data)
ALTER TABLE classes DROP COLUMN IF EXISTS campus_id;
ALTER TABLE planned_sessions DROP COLUMN IF EXISTS campus_id;

-- Drop functions
DROP FUNCTION IF EXISTS check_multi_campus_enabled(UUID);
DROP FUNCTION IF EXISTS check_user_campus_access(UUID, UUID);
DROP FUNCTION IF EXISTS get_accessible_campuses(UUID);
```

## Support

### Issue Escalation

1. **Level 1**: Application errors, UI issues
   - Check: Application logs, browser console
   - Action: Fix in next patch release

2. **Level 2**: Database performance, RLS policy issues
   - Check: Database logs, query performance
   - Action: Optimize queries, add indexes

3. **Level 3**: Data integrity, migration failures
   - Check: Audit logs, data consistency
   - Action: Emergency rollback, data fix scripts

### Common Issues

**Issue**: Users can't access their assigned campus
- **Check**: Verify `user_campus_access` record exists
- **Check**: Verify `can_access = true`
- **Check**: Verify user role in `users` table

**Issue**: GPS validation always fails
- **Check**: Campus has latitude/longitude configured
- **Check**: Radius is reasonable (≥ 100m)
- **Check**: Device GPS accuracy

**Issue**: Campus reports return no data
- **Check**: Sessions have `campus_id` assigned
- **Check**: User has permission to view campus
- **Check**: Date range is valid

## Completion Checklist

### Pre-Deployment
- [ ] All migrations tested in staging
- [ ] Edge Functions tested locally
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Rollback plan prepared

### Deployment
- [ ] Database migrations applied
- [ ] RLS policies verified
- [ ] Edge Functions deployed
- [ ] Applications built and deployed
- [ ] Smoke tests passed

### Post-Deployment
- [ ] Module activated for pilot schools
- [ ] Test campuses created
- [ ] Test users configured
- [ ] Monitoring configured
- [ ] Support team trained

### Production Validation
- [ ] No critical errors in logs
- [ ] Performance metrics acceptable
- [ ] User feedback positive
- [ ] All test scenarios passed
- [ ] Documentation accessible

## Next Steps

After successful deployment:

1. **Gather Feedback**: Collect feedback from pilot schools for 2 weeks
2. **Iterate**: Address issues and improve UX based on feedback
3. **Expand**: Gradually roll out to all eligible schools
4. **Optimize**: Continuously monitor and optimize performance
5. **Enhance**: Plan future enhancements based on usage patterns

---

**Document Version**: 1.0.0
**Last Updated**: 2025-02-10
**Maintained By**: NovaConnect Development Team
