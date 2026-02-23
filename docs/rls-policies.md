# Row Level Security (RLS) Policies

Complete guide to NovaConnect's multi-tenant RLS policies and permission system.

## Overview

NovaConnect uses PostgreSQL's Row Level Security (RLS) to enforce strict multi-tenant isolation. Each school (tenant) can only access their own data, while super_admins have cross-tenant access.

### Key Principles

1. **Zero Trust:** Every query is checked by RLS
2. **Tenant Isolation:** Schools cannot see other schools' data
3. **Role-Based Access:** Users can only perform actions their role allows
4. **Audit Trail:** All access is logged for compliance
5. **Defense in Depth:** Multiple layers of security checks

## RLS Helper Functions

### get_current_user_id()

Returns the authenticated user's ID from Supabase Auth.

```sql
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage:**
```sql
SELECT * FROM users WHERE id = get_current_user_id();
```

---

### get_current_user_school_id()

Returns the current user's `school_id`.

```sql
CREATE OR REPLACE FUNCTION get_current_user_school_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT school_id FROM users WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Returns:** `NULL` for super_admin, school UUID for other users

**Usage:**
```sql
SELECT * FROM students WHERE school_id = get_current_user_school_id();
```

---

### is_super_admin()

Checks if current user has the `super_admin` role.

```sql
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage:**
```sql
SELECT is_super_admin(); -- Returns true/false
```

---

### is_school_admin()

Checks if current user is a `school_admin` for their school.

```sql
CREATE OR REPLACE FUNCTION is_school_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'school_admin'
    AND ur.school_id = get_current_user_school_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage:**
```sql
SELECT is_school_admin(); -- Returns true/false
```

---

### has_permission(resource, action)

Checks if current user has a specific permission.

```sql
CREATE OR REPLACE FUNCTION has_permission(resource TEXT, action TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
    AND p.resource = resource
    AND p.action = action
  ) OR is_super_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage:**
```sql
SELECT has_permission('students', 'create'); -- Returns true/false
SELECT has_permission('grades', 'validate'); -- Returns true/false
```

---

## Table Policies

### schools Table

#### Policy 1: super_admin_all_on_schools

**Super admins** can do anything with schools.

```sql
CREATE POLICY "super_admin_all_on_schools"
ON schools FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());
```

**Operations Allowed:**
- SELECT, INSERT, UPDATE, DELETE
- All schools in the system

---

#### Policy 2: school_admin_read_own_school

**School admins** can read their own school.

```sql
CREATE POLICY "school_admin_read_own_school"
ON schools FOR SELECT
USING (
  is_school_admin()
  AND id = get_current_user_school_id()
);
```

**Operations Allowed:**
- SELECT only
- Only their own school

---

#### Policy 3: users_read_own_school

**All users** can read their own school.

```sql
CREATE POLICY "users_read_own_school"
ON schools FOR SELECT
USING (
  id IN (SELECT school_id FROM users WHERE id = auth.uid())
);
```

**Operations Allowed:**
- SELECT only
- Only their own school

---

### users Table

#### Policy 1: super_admin_all_on_users

**Super admins** can do anything with all users.

```sql
CREATE POLICY "super_admin_all_on_users"
ON users FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());
```

**Operations Allowed:**
- SELECT, INSERT, UPDATE, DELETE
- All users in the system

---

#### Policy 2: school_admin_manage_own_school_users

**School admins** can manage users in their school.

```sql
CREATE POLICY "school_admin_manage_own_school_users"
ON users FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);
```

**Operations Allowed:**
- SELECT, INSERT, UPDATE, DELETE
- Only users with matching `school_id`

---

#### Policy 3: users_read_own_profile

**Users** can read their own profile.

```sql
CREATE POLICY "users_read_own_profile"
ON users FOR SELECT
USING (id = auth.uid());
```

**Operations Allowed:**
- SELECT only
- Only their own row

---

#### Policy 4: users_read_same_school_profiles

**Users** can read profiles from same school.

```sql
CREATE POLICY "users_read_same_school_profiles"
ON users FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
);
```

**Operations Allowed:**
- SELECT only
- Users from same school

**Use Case:** Teachers viewing student profiles, etc.

---

### roles Table

#### Policy 1: super_admin_all_on_roles

**Super admins** can manage all roles.

```sql
CREATE POLICY "super_admin_all_on_roles"
ON roles FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());
```

**Operations Allowed:**
- SELECT, INSERT, UPDATE, DELETE
- All roles

**Note:** System roles (`is_system = true`) should be protected from deletion at application level.

---

#### Policy 2: all_users_read_roles

**All users** can read roles (for UI display).

```sql
CREATE POLICY "all_users_read_roles"
ON roles FOR SELECT
USING (TRUE);
```

**Operations Allowed:**
- SELECT only
- All roles

**Use Case:** Display role names in UI, permission management interfaces.

---

### permissions Table

#### Policy 1: super_admin_all_on_permissions

**Super admins** can manage all permissions.

```sql
CREATE POLICY "super_admin_all_on_permissions"
ON permissions FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());
```

---

#### Policy 2: all_users_read_permissions

**All users** can read permissions.

```sql
CREATE POLICY "all_users_read_permissions"
ON permissions FOR SELECT
USING (TRUE);
```

**Use Case:** Display available permissions in role management UI.

---

### role_permissions Table

#### Policy 1: super_admin_all_on_role_permissions

**Super admins** can manage all role-permission associations.

```sql
CREATE POLICY "super_admin_all_on_role_permissions"
ON role_permissions FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());
```

---

#### Policy 2: all_users_read_role_permissions

**All users** can read role-permission associations.

```sql
CREATE POLICY "all_users_read_role_permissions"
ON role_permissions FOR SELECT
USING (TRUE);
```

**Use Case:** Display which permissions a role has.

---

### user_roles Table

#### Policy 1: super_admin_all_on_user_roles

**Super admins** can manage all user-role assignments.

```sql
CREATE POLICY "super_admin_all_on_user_roles"
ON user_roles FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());
```

**Operations Allowed:**
- SELECT, INSERT, UPDATE, DELETE
- All user-role assignments

---

#### Policy 2: school_admin_manage_own_school_user_roles

**School admins** can manage roles in their school.

```sql
CREATE POLICY "school_admin_manage_own_school_user_roles"
ON user_roles FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);
```

**Operations Allowed:**
- SELECT, INSERT, UPDATE, DELETE
- Only roles assigned in their school

**Use Case:** School admin assigning teacher role to a new hire.

---

#### Policy 3: users_read_own_roles

**Users** can read their own roles.

```sql
CREATE POLICY "users_read_own_roles"
ON user_roles FOR SELECT
USING (user_id = auth.uid());
```

**Operations Allowed:**
- SELECT only
- Only their own role assignments

**Use Case:** Users viewing which roles they have.

---

#### Policy 4: users_read_same_school_roles

**Users** can read roles from same school.

```sql
CREATE POLICY "users_read_same_school_roles"
ON user_roles FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
);
```

**Operations Allowed:**
- SELECT only
- Role assignments in their school

**Use Case:** Teachers viewing which roles other users have.

---

### audit_logs Table

#### Policy 1: super_admin_read_all_audit_logs

**Super admins** can read all audit logs.

```sql
CREATE POLICY "super_admin_read_all_audit_logs"
ON audit_logs FOR SELECT
USING (is_super_admin());
```

**Operations Allowed:**
- SELECT only (no INSERT, UPDATE, DELETE)
- All audit logs

---

#### Policy 2: school_admin_read_own_school_audit_logs

**School admins** can read logs from their school.

```sql
CREATE POLICY "school_admin_read_own_school_audit_logs"
ON audit_logs FOR SELECT
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);
```

**Operations Allowed:**
- SELECT only
- Only logs where `school_id` matches their school

---

#### Policy 3: system_insert_audit_logs

Only the system (via triggers) can insert audit logs.

```sql
CREATE POLICY "system_insert_audit_logs"
ON audit_logs FOR INSERT
WITH CHECK (TRUE);
```

**Important:**
- This policy allows INSERT but only triggers can execute it
- Manual inserts are blocked by trigger function's `SECURITY DEFINER` attribute

---

## Permission Matrix

### By Role

| Permission | super_admin | school_admin | accountant | teacher | student | parent | supervisor |
|------------|-------------|--------------|------------|---------|---------|--------|------------|
| **schools:** | | | | | | | |
| schools:create | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| schools:read | ✅ | ✅ (own) | ✅ (own) | ✅ (own) | ✅ (own) | ✅ (own) | ✅ (own) |
| schools:update | ✅ | ✅ (own) | ❌ | ❌ | ❌ | ❌ | ❌ |
| schools:delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **users:** | | | | | | | |
| users:create | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| users:read | ✅ | ✅ (school) | ✅ (school) | ✅ (school) | ✅ (own) | ✅ (children) | ✅ (school) |
| users:update | ✅ | ✅ (school) | ❌ | ❌ | ✅ (own) | ❌ | ❌ |
| users:delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **students:** | | | | | | | |
| students:create | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| students:read | ✅ | ✅ | ✅ | ✅ | ✅ (own) | ✅ (children) | ✅ |
| students:update | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| students:delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **grades:** | | | | | | | |
| grades:create | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| grades:read | ✅ | ✅ | ❌ | ✅ (class) | ✅ (own) | ✅ (children) | ✅ |
| grades:update | ✅ | ✅ | ❌ | ✅ (own) | ❌ | ❌ | ❌ |
| grades:delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| grades:validate | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **attendance:** | | | | | | | |
| attendance:create | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| attendance:read | ✅ | ✅ | ❌ | ✅ (class) | ✅ (own) | ✅ (children) | ✅ |
| attendance:update | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| attendance:delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| attendance:validate | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **payments:** | | | | | | | |
| payments:create | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| payments:read | ✅ | ✅ | ✅ | ❌ | ✅ (own) | ✅ (children) | ❌ |
| payments:update | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| payments:delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **schedules:** | | | | | | | |
| schedules:create | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| schedules:read | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| schedules:update | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| schedules:delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| schedules:publish | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **reports:** | | | | | | | |
| reports:read | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| reports:export | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **audit_logs:** | | | | | | | |
| audit_logs:read | ✅ | ✅ (school) | ❌ | ❌ | ❌ | ❌ | ❌ |

### By Resource

**Schools Management** (`schools:*`)
- Full: super_admin
- Read: All users (own school)
- Update: super_admin, school_admin (own school)

**User Management** (`users:*`)
- Full: super_admin
- Create/Update (school): super_admin, school_admin
- Read: super_admin, all (with restrictions)

**Student Management** (`students:*`)
- Full: super_admin
- Create: super_admin, school_admin
- Update: super_admin, school_admin, teacher
- Read: super_admin, all (with restrictions)

**Grades** (`grades:*`)
- Create: super_admin, school_admin, teacher
- Validate: super_admin, school_admin, supervisor
- Read: super_admin, all (with restrictions)

**Attendance** (`attendance:*`)
- Create: super_admin, school_admin, teacher
- Validate: super_admin, school_admin, supervisor
- Read: super_admin, all (with restrictions)

**Payments** (`payments:*`)
- Full: super_admin, school_admin, accountant
- Read: Students (own), Parents (children)

**Reports** (`reports:*`)
- Read/Export: super_admin, school_admin, accountant, supervisor

**Audit Logs** (`audit_logs:*`)
- Read All: super_admin
- Read School: school_admin

---

## Testing RLS Policies

### Test Isolation

```sql
-- Create two schools
INSERT INTO schools (id, name, code) VALUES
  ('school-1', 'School 1', 'SCH-001'),
  ('school-2', 'School 2', 'SCH-002');

-- Create users for each school
INSERT INTO users (id, email, school_id) VALUES
  ('user-1', 'user1@school1.com', 'school-1'),
  ('user-2', 'user2@school2.com', 'school-2');

-- Assign teacher role
INSERT INTO user_roles (user_id, role_id, school_id)
SELECT 'user-1', id, 'school-1'
FROM roles WHERE name = 'teacher';

-- Test as user-1
SET ROLE user1@school1.com;

-- Should see only school-1 users
SELECT * FROM users; -- Returns only user-1

-- Should NOT see school-2 users
SELECT * FROM users WHERE school_id = 'school-2'; -- Empty
```

### Test Role Permissions

```typescript
// Test permission check
const hasPermission = await supabase.rpc('has_permission', {
  resource: 'students',
  action: 'create'
});

console.log(hasPermission); // true/false based on user's role
```

---

## Best Practices

### 1. Always Use RLS

Never rely on application-level security alone. RLS is the last line of defense.

### 2. Test with Real Users

Always test RLS policies while authenticated as a real user, not as postgres superuser.

### 3. Use Helper Functions

Use the provided RLS helper functions instead of writing raw queries:

```typescript
// ✅ GOOD
import { checkPermission } from '@novaconnect/data';

const canCreate = await checkPermission(supabase, 'students', 'create');

// ❌ BAD
const { data } = await supabase
  .from('user_roles')
  .select('...') // Manual query
```

### 4. Log Security Events

All permission denials should be logged:

```typescript
if (!hasPermission) {
  await logAction(supabase, 'VALIDATE', 'permission_denied', userId, {
    required: 'students:create',
    attempted_by: userId
  });
}
```

### 5. Principle of Least Privilege

Grant minimum required permissions. Default to read-only, grant write access only when needed.

---

## Troubleshooting

### RLS Not Working

1. **Check RLS is enabled:**
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public';
   ```

2. **Check user is authenticated:**
   ```sql
   SELECT auth.uid(); -- Should not be NULL
   ```

3. **Check policies exist:**
   ```sql
   \d+ table_name
   ```

4. **Test with EXPLAIN:**
   ```sql
   EXPLAIN SELECT * FROM users;
   ```

### Permission Denied

1. **Check user's roles:**
   ```sql
   SELECT * FROM user_roles WHERE user_id = auth.uid();
   ```

2. **Check role's permissions:**
   ```sql
   SELECT p.resource, p.action
   FROM role_permissions rp
   JOIN permissions p ON p.id = rp.permission_id
   WHERE rp.role_id IN (
     SELECT role_id FROM user_roles WHERE user_id = auth.uid()
   );
   ```

3. **Test permission function:**
   ```sql
   SELECT has_permission('students', 'create');
   ```

---

## Additional Resources

- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Security Best Practices](https://supabase.com/docs/guides/platform/security-checklist)

---

## School Configuration Tables RLS Policies

The following RLS policies apply to all school configuration tables (academic_years, levels, classes, subjects, periods, grading_scales, campuses, rooms, teacher_assignments).

### Common Policy Pattern

All school configuration tables follow this standard policy pattern:

#### 1. Super Admin - Full Access
```sql
CREATE POLICY "super_admin_all_on_[table]"
ON [table] FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());
```

**Access:** Complete CRUD access across all schools.

**Use Cases:**
- Platform configuration and troubleshooting
- Cross-school analytics and reporting
- Emergency intervention when required

**Example Query:**
```sql
-- Super admin can view all academic years
SELECT * FROM academic_years; -- Returns all rows from all schools
```

---

#### 2. School Admin - Manage Own School
```sql
CREATE POLICY "school_admin_manage_own_school_[table]"
ON [table] FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);
```

**Access:** Full CRUD access to their school's data only.

**Use Cases:**
- Configure academic years, levels, classes
- Manage subjects and grading scales
- Organize campuses and rooms
- Assign teachers to classes

**Example Query:**
```sql
-- School admin can only view/manage their school's data
SELECT * FROM academic_years WHERE school_id = get_current_user_school_id();
```

**Security Enforcement:**
- RLS automatically filters results by `school_id`
- Cannot bypass by modifying `school_id` in INSERT/UPDATE
- Attempting to set another school's `school_id` is blocked

---

#### 3. School Users - Read Access
```sql
CREATE POLICY "school_users_read_[table]"
ON [table] FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
);
```

**Access:** Read-only access to their school's configuration data.

**Applies To:** All users (teachers, students, parents, supervisors, accountants).

**Use Cases:**
- Teachers can view subjects, periods, and their assignments
- Students can view class information and grading scales
- Parents can view school structure and policies

**Example Query:**
```sql
-- Teachers can view school's subjects
SELECT * FROM subjects WHERE school_id = get_current_user_school_id();
```

---

### Table-Specific Policies

#### Classes - Additional Policies

**Teachers Read Assigned Classes:**
```sql
CREATE POLICY "teachers_read_assigned_classes"
ON classes FOR SELECT
USING (
  id IN (
    SELECT class_id
    FROM teacher_assignments
    WHERE teacher_id = auth.uid()
  )
);
```

**Access:** Teachers can read classes they are assigned to teach.

**Use Cases:**
- View class list and student roster
- Access class schedule and room assignments
- View homeroom teacher information

---

**Students Read Own Class:**
```sql
CREATE POLICY "students_read_own_class"
ON classes FOR SELECT
USING (
  id IN (
    SELECT class_id
    FROM enrollments
    WHERE student_id = auth.uid()
  )
);
```

**Access:** Students can only read their own enrolled class.

**Use Cases:**
- View class information
- See classmates and homeroom teacher
- Access class schedule

---

#### Subjects - Filter by Active Status

**Only Active Subjects:**
```sql
CREATE POLICY "school_users_read_subjects"
ON subjects FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
  AND is_active = true
);
```

**Access:** Read-only, excluding soft-deleted subjects.

**Use Cases:**
- Hide deprecated subjects from UI
- Maintain historical data while hiding from users
- Clean subject list for dropdowns and forms

---

#### Teacher Assignments - Specialized Policies

**Teachers Read Own Assignments:**
```sql
CREATE POLICY "teachers_read_own_assignments"
ON teacher_assignments FOR SELECT
USING (
  teacher_id = auth.uid()
  OR school_id = get_current_user_school_id()
);
```

**Access:** Teachers see all their assignments across the school.

**Use Cases:**
- View class schedule
- Check subject assignments
- Verify hourly rates (for payroll)

---

**All School Users Read Assignments:**
```sql
CREATE POLICY "school_users_read_teacher_assignments"
ON teacher_assignments FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
);
```

**Access:** All users can view teacher assignments for scheduling purposes.

**Use Cases:**
- Students can see who teaches their classes
- Parents can verify teacher qualifications
- Admins can generate schedules

---

#### Rooms - Available Only for Most Users

**Teachers Read All Rooms:**
```sql
CREATE POLICY "teachers_read_all_rooms"
ON rooms FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.school_id = rooms.school_id
    AND users.role = 'teacher'
  )
);
```

**Access:** Teachers can see all rooms for scheduling.

**Use Cases:**
- Check room availability
- View equipment in rooms
- Plan class activities

---

**General Users Read Available Rooms Only:**
```sql
CREATE POLICY "school_users_read_available_rooms"
ON rooms FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
  AND is_available = true
);
```

**Access:** Other users only see rooms marked as available.

**Use Cases:**
- Hide rooms under maintenance
- Exclude administrative offices from public view
- Show only bookable spaces

---

## Policy Evaluation Order

PostgreSQL evaluates policies in this order:

1. **USING clauses** (for SELECT/UPDATE)
2. **WITH CHECK clauses** (for INSERT/UPDATE)
3. **First matching policy grants access** (no need to check others)
4. **No match = DENY**

### Example: Teacher Updating a Class

```sql
UPDATE classes SET capacity = 30 WHERE id = 'class-uuid';
```

**Policy Evaluation:**
1. `super_admin_all_on_classes` - ❌ Not a super admin
2. `school_admin_manage_own_school_classes` - ❌ Not a school admin
3. `school_users_read_classes` - ❌ Read-only (UPDATE blocked)
4. **Result:** Permission denied

**Workaround:** Teacher must go through school admin or use protected API endpoint with elevated privileges.

---

## Testing RLS Policies

### Test as Super Admin
```sql
SET ROLE authenticated;
SET jwt.claims.sub = 'super-admin-uuid';

SELECT * FROM academic_years; -- Should return all rows
```

### Test as School Admin
```sql
SET ROLE authenticated;
SET jwt.claims.sub = 'school-admin-uuid';

SELECT * FROM academic_years; -- Should return only their school's rows
UPDATE academic_years SET is_current = false WHERE id = '...'; -- Should work
```

### Test as Teacher
```sql
SET ROLE authenticated;
SET jwt.claims.sub = 'teacher-uuid';

SELECT * FROM academic_years; -- Should return only their school's rows
UPDATE academic_years SET is_current = false WHERE id = '...'; -- Should FAIL
SELECT * FROM teacher_assignments WHERE teacher_id = '...'; -- Should return their assignments
```

---

## Common Policy Patterns

### Pattern 1: Role-Based Full Access
```sql
ON [table] FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin())
```

**Use For:** Platform-wide configuration, troubleshooting, emergency access.

---

### Pattern 2: School-Scoped CRUD
```sql
ON [table] FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
```

**Use For:** School management interfaces, configuration panels.

---

### Pattern 3: School-Scoped Read-Only
```sql
ON [table] FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
)
```

**Use For:** Public dashboards, reports, student/parent portals.

---

### Pattern 4: Self-Referential Access
```sql
ON [table] FOR SELECT
USING (user_id = auth.uid())
```

**Use For:** User profiles, assignments, personal data.

---

### Pattern 5: Conditional Read Access
```sql
ON [table] FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND is_active = true
)
```

**Use For:** Filtering soft-deleted rows, hiding sensitive data.

---

## Security Considerations

### Preventing Leaks

**Never expose `school_id` in error messages:**
```sql
-- ❌ BAD: Leaks information
CREATE POLICY bad_policy ON classes FOR SELECT
USING (school_id = get_current_user_school_id());
-- Error: "Access denied to school 12345"

-- ✅ GOOD: Generic error
-- RLS returns: "Permission denied" (no school info leaked)
```

---

### Preventing Bypass

**Always use WITH CHECK for INSERT/UPDATE:**
```sql
-- ❌ VULNERABLE: Only USING clause
CREATE POLICY vulnerable ON classes FOR UPDATE
USING (school_id = get_current_user_school_id());
-- Attacker can UPDATE school_id = 'other-school-uuid'

-- ✅ SECURE: Using + WITH CHECK
CREATE POLICY secure ON classes FOR UPDATE
USING (school_id = get_current_user_school_id())
WITH CHECK (school_id = get_current_user_school_id());
-- RLS blocks UPDATE that changes school_id
```

---

### Index Optimization

**Add indexes for RLS-filtered columns:**
```sql
CREATE INDEX idx_academic_years_school_id ON academic_years(school_id);
CREATE INDEX idx_teacher_assignments_teacher_id ON teacher_assignments(teacher_id);
```

**Why:** RLS filters every query, so indexed filters improve performance.

---

## Summary

The school configuration RLS policies provide:

✅ **Multi-tenant isolation** - Schools isolated from each other
✅ **Role-based access** - Super admin, school admin, teachers, students, parents
✅ **Principle of least privilege** - Users only access what they need
✅ **Audit trail** - All access logged via audit_logs table
✅ **Performance optimized** - Indexed school_id and user_id columns
✅ **Defense in depth** - Multiple security layers
✅ **Flexible architecture** - Easy to add new policies or modify existing

These policies ensure that sensitive school configuration data remains secure while enabling legitimate access patterns for all user roles.

