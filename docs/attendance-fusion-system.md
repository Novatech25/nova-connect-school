# Attendance Fusion System

## Overview

The Attendance Fusion System is a sophisticated feature that intelligently merges attendance data from two independent sources: teacher manual marking and student QR code scans. The system ensures data integrity, provides configurable conflict resolution strategies, and maintains a complete audit trail of all changes.

## Table of Contents

1. [Architecture](#architecture)
2. [Fusion Strategies](#fusion-strategies)
3. [Database Schema](#database-schema)
4. [Configuration](#configuration)
5. [Fusion Logic](#fusion-logic)
6. [Edge Functions](#edge-functions)
7. [API & Hooks](#api--hooks)
8. [User Interface](#user-interface)
9. [Security & RLS](#security--rls)
10. [Troubleshooting](#troubleshooting)

---

## Architecture

### Key Components

1. **Database Layer**
   - `attendance_records` table with fusion fields
   - `attendance_record_history` audit table
   - Triggers for automatic history logging

2. **Business Logic**
   - Fusion algorithms in `packages/core/src/utils/attendanceFusion.ts`
   - Shared utilities for Edge Functions in `supabase/functions/_shared/attendanceFusion.ts`

3. **API Layer**
   - Edge Function: `validate-qr-scan` (modified for fusion)
   - Edge Function: `merge-attendance-records` (manual merge)

4. **Application Layer**
   - React Query hooks for data fetching
   - Admin interfaces for conflict resolution
   - Mobile UI indicators

---

## Fusion Strategies

The system supports three configurable strategies per school:

### 1. Teacher Priority (`teacher_priority`)

**Principle**: Teacher markings always override QR scans.

**Behavior**:
- If teacher marks after QR scan → Teacher's marking wins, record marked as `overridden`
- If QR scan after teacher marking → QR scan is rejected
- Duplicate QR scans → Rejected

**Use Case**: Schools where teachers have the final authority on attendance.

**Example**:
```
08:00 - Student scans QR → status=present, record_status=auto
08:15 - Teacher marks absent → status=absent, record_status=overridden, original_source=qr_scan
```

---

### 2. QR Priority (`qr_priority`)

**Principle**: QR scans prevail if within the configured time window, but teachers can override with "absent".

**Behavior**:
- QR scan within time window (default: 15 min) → Accepted, status=present
- Teacher marks "present" after QR → Confirmed, record_status=confirmed
- Teacher marks "absent" after QR → Teacher wins, record_status=overridden
- QR scan outside time window → Rejected if teacher already marked

**Use Case**: Schools that trust QR scans for presence but want teachers to control absences.

**Example**:
```
08:00 - Student scans QR → status=present, record_status=auto
08:05 - Teacher marks present → status=present, record_status=confirmed
```

```
08:20 - Student scans QR (outside 15-min window)
08:00 - Teacher had marked absent → QR rejected, teacher's absent kept
```

---

### 3. Coexist (`coexist`)

**Principle**: Both sources are preserved with a calculated final status.

**Behavior**:
- Both sources agree (e.g., both "present") → Confirmed, record_status=confirmed
- Sources disagree → New source wins, marked as `overridden`

**Use Case**: Schools that want transparency and manual review of all conflicts.

**Example**:
```
08:00 - Student scans QR → status=present, record_status=auto
08:10 - Teacher marks present → status=present, record_status=confirmed (agreement)
```

```
08:00 - Student scans QR → status=present, record_status=auto
08:10 - Teacher marks absent → status=absent, record_status=overridden (conflict)
```

---

## Database Schema

### Attendance Records Table

New columns added to support fusion:

| Column | Type | Description |
|--------|------|-------------|
| `record_status` | `attendance_record_status_enum` | Status of the record: `auto`, `confirmed`, `overridden`, `manual` |
| `original_source` | `attendance_source_enum` (nullable) | The source before fusion (e.g., `qr_scan` if teacher overrode) |
| `merged_at` | `TIMESTAMPTZ` (nullable) | Timestamp when the record was merged |
| `merged_by` | `UUID` (nullable, FK to users) | User who performed the merge |

### Record Status Values

| Value | Meaning | Example |
|-------|---------|---------|
| `auto` | QR scan only, no teacher intervention | Student scanned QR, teacher didn't mark |
| `confirmed` | Both sources agree | Teacher confirmed QR scan with same status |
| `overridden` | One source overrode the other | Teacher marked absent after QR scan |
| `manual` | Teacher manual only | Teacher marked without any QR scan |

### Attendance Record History Table

Complete audit trail of all changes:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `attendance_record_id` | UUID | Reference to current record |
| `school_id` | UUID | School identifier |
| `student_id` | UUID | Student identifier |
| `status` | attendance_status_enum | Status at this point in time |
| `source` | attendance_source_enum | Source (teacher_manual or qr_scan) |
| `record_status` | attendance_record_status_enum | Record status |
| `action` | TEXT | Action type: `created`, `updated`, `merged`, `overridden` |
| `marked_by` | UUID | User who made the change |
| `marked_at` | TIMESTAMPTZ | When the change was made |
| `metadata` | JSONB | Additional context (merge strategy, conflict details, etc.) |
| `created_at` | TIMESTAMPTZ | When history entry was created |

**Trigger**: Automatically inserts into history on INSERT/UPDATE to `attendance_records`.

---

## Configuration

### School Settings

Configure fusion in school settings:

```typescript
{
  "attendanceFusion": {
    "enabled": true,                           // Enable/disable fusion
    "strategy": "teacher_priority",            // Strategy: teacher_priority, qr_priority, coexist
    "qrTimeWindowMinutes": 15,                 // Time window for QR validity
    "autoMerge": true,                         // Automatically merge when possible
    "notifyOnConflict": true                   // Notify teachers of conflicts
  }
}
```

### Configuration UI

Located at: `/admin/settings` → "Fusion de présence" tab

Configuration options:
- **Enable fusion**: Toggle to enable/disable the entire system
- **Strategy**: Radio buttons with detailed descriptions
- **QR Time Window**: Slider (5-60 minutes) for qr_priority strategy
- **Auto Merge**: Toggle for automatic vs manual approval
- **Notify on Conflict**: Toggle for teacher notifications

---

## Fusion Logic

### Determination Algorithm

Located in: `packages/core/src/utils/attendanceFusion.ts`

#### Function: `determineRecordStatus()`

```typescript
function determineRecordStatus(
  existingRecord: AttendanceRecord,
  newRecord: AttendanceRecord,
  strategy: FusionStrategy,
  qrTimeWindowMinutes: number,
  sessionStartTime?: Date
): FusionResult
```

**Returns**:
```typescript
{
  status: AttendanceStatus,           // Final status
  recordStatus: RecordStatus,         // auto, confirmed, overridden, manual
  originalSource?: AttendanceSource,  // Source before merge (if overridden)
  shouldMerge: boolean,               // Whether to apply the merge
  reason?: string                     // Explanation for debugging
}
```

#### Decision Matrix

| Scenario | Teacher Priority | QR Priority | Coexist |
|----------|------------------|-------------|---------|
| QR only | `auto` | `auto` | `auto` |
| Teacher only | `manual` | `manual` | `manual` |
| QR then Teacher (same) | `overridden` | `confirmed` | `confirmed` |
| QR then Teacher (different) | `overridden` | `overridden` | `overridden` |
| Teacher then QR (within window) | Rejected | Rejected | `confirmed` (if same) |

### Time Window Calculation

For `qr_priority` strategy:

```typescript
function isQRInTimeWindow(scanTime, timeWindowMinutes, sessionStartTime): boolean
```

**Logic**: Calculates absolute time difference between scan and session start, returns true if within window.

---

## Edge Functions

### 1. Validate QR Scan (Modified)

**Location**: `supabase/functions/validate-qr-scan/index.ts`

**Changes**:
- Retrieves school fusion configuration from `school.settings`
- Checks for **existing** attendance record (any source, not just QR)
- Applies fusion logic if record exists:
  - Calls `determineRecordStatus()` with appropriate parameters
  - If `shouldMerge=false`: Returns duplicate scan error
  - If `shouldMerge=true`: Updates record with fusion metadata
- Sends conflict notification if `notifyOnConflict=true` and `recordStatus=overridden`
- Logs successful merge in `qr_scan_logs` with `fusionApplied=true`

**Flow**:
```
1. QR scanned
2. Fetch session
3. Check for existing record (any source)
4. If exists:
   - Get school fusion config
   - Determine merge strategy
   - Apply fusion or reject
5. If not exists:
   - Create new record with record_status=auto
```

### 2. Merge Attendance Records (New)

**Location**: `supabase/functions/merge-attendance-records/index.ts`

**Endpoint**: `POST /functions/v1/merge-attendance-records`

**Request**:
```json
{
  "attendanceRecordId": "uuid",
  "newStatus": "present" | "absent" | "late" | "excused",
  "recordStatus": "confirmed" | "overridden",
  "justification": "string (optional)",
  "comment": "string (optional)"
}
```

**Response**:
```json
{
  "success": true,
  "attendanceRecord": { ... }
}
```

**Permissions**: Admins, supervisors, and teachers (draft sessions only)

**Actions**:
1. Validates authentication
2. Fetches existing record
3. Checks permissions (role + session status)
4. Updates record with merge metadata
5. Inserts into `audit_logs`
6. Invalidates related queries

---

## API & Hooks

### Queries

**Location**: `packages/data/src/queries/attendance.ts`

#### New Queries:

1. **`getRecordHistory(recordId)`**
   - Returns complete history for a specific record
   - Ordered by most recent first
   - Includes user who made each change

2. **`getConflictingRecords(schoolId, filters)`**
   - Returns records with conflicts (overridden)
   - Filterable by date range, class, record status
   - Includes student and session information

3. **`getFusionStats(schoolId, filters)`**
   - Aggregates fusion statistics
   - Returns counts by status and source
   - Filterable by date range

### React Query Hooks

**Location**: `packages/data/src/hooks/useAttendance.ts`

#### New Hooks:

1. **`useAttendanceRecordHistory(recordId)`**
   ```typescript
   const { data: history, isLoading } = useAttendanceRecordHistory(recordId);
   ```

2. **`useConflictingRecords(schoolId, filters)`**
   ```typescript
   const { data: conflicts, isLoading } = useConflictingRecords(schoolId, {
     startDate: '2025-01-01',
     recordStatus: 'overridden'
   });
   ```

3. **`useFusionStats(schoolId, filters)`**
   ```typescript
   const { data: stats } = useFusionStats(schoolId);
   ```

4. **`useMergeAttendanceRecord()`**
   ```typescript
   const mergeRecord = useMergeAttendanceRecord();

   mergeRecord.mutate({
     attendanceRecordId: 'uuid',
     newStatus: 'present',
     recordStatus: 'confirmed'
   });
   ```

---

## User Interface

### Admin: Attendance Fusion Settings

**Location**: `/admin/settings` → "Fusion de présence" tab

**Features**:
- Enable/disable toggle
- Strategy selection (radio buttons with descriptions)
- QR time window slider
- Auto-merge toggle
- Conflict notification toggle
- Save button

### Admin: Conflicts Page

**Location**: `/admin/attendance/conflicts`

**Features**:
- Table of conflicting records (record_status=overridden)
- Filters: Date range, class, status
- Columns: Date, Class, Student, Original Source, Original Status, New Source, New Status, Actions
- Badges: Color-coded by record_status
- Actions: "View History" (opens modal), "Resolve" (opens dialog)

**Conflict Resolution Dialog**:
- Displays both sources side by side
- Allows selection of final status
- Allows setting record_status (confirmed/overridden)
- Justification field (for excused)
- Comment field
- "Confirm Merge" button

### Admin: Attendance Record History

**Location**: Modal accessible from conflicts page

**Features**:
- Timeline view of all changes
- Each entry shows:
  - Icon by action type (created/updated/merged/overridden)
  - Timestamp
  - User name
  - Status change (old → new)
  - Source badge
  - Metadata (merge strategy, etc.)
- Export to CSV button

### Mobile: Attendance Marking

**Location**: Mobile app attendance screen

**Features**:
- For each student:
  - Record status badge
    - `auto`: Blue badge "QR scanné" with QR icon
    - `confirmed`: Green badge "Confirmé"
    - `overridden`: Orange badge "Modifié" with alert icon
    - `manual`: Gray badge "Manuel"
  - "Voir détails" button → Bottom sheet with full history

---

## Security & RLS

### RLS Policies

**Location**: `supabase/migrations/20250123000002_update_attendance_rls_for_fusion.sql`

#### Attendance Records Policies

1. **"Teachers can update records in draft sessions"** (Modified)
   - Allows updates to `auto` and `manual` records
   - Allows updates to `overridden`/`confirmed` records only if they were the one who merged them
   - Draft sessions only

2. **"Students can update their own QR records for fusion"** (New)
   - Allows students to update their own QR-scanned records
   - Only when `record_status=auto`
   - Draft sessions only
   - Cannot change `source` field

#### Attendance Record History Policies

1. **"Users can view history of their school's records"**
   - All authenticated users can view history for their school
   - Transparent audit trail

2. **"Service role can insert/update history"**
   - Trigger functions run as service role
   - No manual inserts allowed

### Constraints

```sql
-- Check constraint: overridden records must have original_source
ALTER TABLE attendance_records
  ADD CONSTRAINT check_overridden_has_original_source
  CHECK (NOT (record_status = 'overridden' AND original_source IS NULL));
```

---

## Troubleshooting

### Common Issues

#### 1. QR scans being rejected when teacher hasn't marked

**Symptom**: Students get "Votre présence a déjà été enregistrée par le professeur" error, but teacher hasn't marked attendance.

**Possible Causes**:
- School settings have `strategy='teacher_priority'`
- Previous QR scan exists with `record_status=auto`

**Solution**:
- Check school fusion strategy configuration
- Verify existing records don't have stale `auto` status
- Consider using `qr_priority` or `coexist` strategy

#### 2. Conflicts not being resolved

**Symptom**: Records remain in `overridden` status despite manual merge.

**Possible Causes**:
- User doesn't have permission (not admin/supervisor)
- Session is not in `draft` status (for teachers)
- RLS policy blocking update

**Solution**:
- Verify user role in `user_school_roles`
- Check session status
- Check RLS policy logs

#### 3. History not being created

**Symptom**: `attendance_record_history` table is empty despite updates.

**Possible Causes**:
- Trigger not created or disabled
- Trigger function error
- RLS blocking insert

**Solution**:
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'attendance_record_changes_trigger';

-- Check trigger function
SELECT * FROM pg_proc WHERE proname = 'log_attendance_record_changes';

-- Test trigger manually
SELECT log_attendance_record_changes();
```

#### 4. Notifications not being sent

**Symptom**: No notifications when conflicts occur.

**Possible Causes**:
- `notifyOnConflict=false` in school settings
- Notification insertion failing
- Teacher ID not found

**Solution**:
- Check school settings: `school.settings->'attendanceFusion'->>'notifyOnConflict'`
- Check `notifications` table for errors
- Verify `attendance_sessions.teacher_id` is set

### Debug Queries

```sql
-- Check fusion configuration for a school
SELECT
  id,
  name,
  settings->'attendanceFusion' as fusion_config
FROM schools
WHERE id = 'school-uuid';

-- Find all overridden records
SELECT
  ar.id,
  ar.status,
  ar.record_status,
  ar.source,
  ar.original_source,
  s.first_name || ' ' || s.last_name as student,
  asess.session_date
FROM attendance_records ar
JOIN students s ON ar.student_id = s.id
JOIN attendance_sessions asess ON ar.attendance_session_id = asess.id
WHERE ar.record_status = 'overridden'
ORDER BY ar.marked_at DESC;

-- View history for a specific record
SELECT
  arh.*,
  u.first_name || ' ' || u.last_name as marked_by_name
FROM attendance_record_history arh
LEFT JOIN users u ON arh.marked_by = u.id
WHERE arh.attendance_record_id = 'record-uuid'
ORDER BY arh.created_at DESC;

-- Check fusion statistics
SELECT
  record_status,
  source,
  COUNT(*) as count
FROM attendance_records
WHERE school_id = 'school-uuid'
GROUP BY record_status, source
ORDER BY record_status, source;
```

---

## Performance Considerations

1. **Indexes**: All foreign keys and frequently filtered columns are indexed
2. **History Table**: Separate table prevents bloating main table
3. **Trigger**: Minimal overhead, single insert per update
4. **Queries**: Use specific column selection to reduce payload

---

## Future Enhancements

Potential improvements for future versions:

1. **Machine Learning**: Learn which sources are more reliable over time
2. **Geofencing Integration**: Consider location in fusion logic
3. **Parent Notifications**: Alert parents of conflicts
4. **Batch Resolution**: Resolve multiple conflicts at once
5. **Analytics Dashboard**: Visual trends in fusion patterns
6. **Custom Strategies**: Allow schools to define custom fusion rules

---

## Support

For issues or questions:
1. Check this documentation first
2. Review logs in `audit_logs` table
3. Check Edge Function logs in Supabase dashboard
4. Open a GitHub issue with:
   - School ID
   - Fusion strategy
   - Specific scenario
   - Error messages
   - Relevant logs

---

**Last Updated**: 2025-01-23
**Version**: 1.0.0
