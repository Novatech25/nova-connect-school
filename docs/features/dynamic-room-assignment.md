# Dynamic Room Assignment System

## Overview

The Dynamic Room Assignment system automatically assigns rooms to classes based on:
- **Class grouping**: Combines multiple classes with the same teacher, subject, time, and campus
- **Student capacity**: Calculates total enrollment and selects appropriate rooms
- **Intelligent selection**: Prioritizes rooms by capacity or size category
- **Conflict detection**: Avoids double-booking rooms
- **Automatic notifications**: Sends reminders at T-60 and T-15 minutes before class

## Configuration

### Enabling the Module

1. Navigate to **Settings > Dynamic Room Assignment**
2. Toggle **Enable Dynamic Room Assignment** to ON
3. Configure the module settings (see below)
4. Click **Save Settings**

### Room Selection Strategy

#### Selection Priority
- **By Capacity**: Selects the largest available room that meets requirements
- **By Size Category**: Prioritizes by category (Very Large > Large > Medium > Small)

#### Capacity Margin
- Default: **10%**
- Range: **0-100%**
- Adds a buffer to ensure comfortable space
- Rooms meeting the margin are marked as "**optimal**"
- Rooms below the margin are marked as "**sufficient**"

#### Conflict Resolution
- **Largest Available Room**: Assigns the largest room (default)
- **Split Classes**: (Future feature) Separates grouped classes
- **Manual Fallback**: Requires manual intervention

### Notification Settings

#### Notification Windows
- **First Notification (T-60)**: Default 60 minutes before class
- **Reminder (T-15)**: Default 15 minutes before class

#### Notification Channels
- **In-App**: Shows notifications in the NovaConnect app (default: ON)
- **Push**: Sends push notifications to mobile devices (default: ON)
- **Email**: Sends email notifications (default: OFF, T-60 only)
- **SMS**: Sends SMS notifications (default: OFF, T-60 only)

#### Floor Plan
When enabled, notifications include campus maps and directions to the assigned room.

### Advanced Options

#### Auto-Recalculate on Schedule Changes
- Default: **ON**
- Automatically recalculates room assignments when the schedule is modified
- Marks affected assignments as "updated" for recalculation

## Usage Guide

### For School Administrators

#### 1. Configure Room Categories

Navigate to **Rooms Management** and set the **Size Category** for each room:
- **Very Large**: Amphitheaters, large halls (100+ students)
- **Large**: Big classrooms (60-100 students)
- **Medium**: Standard classrooms (30-60 students)
- **Small**: Small rooms (< 30 students)

#### 2. Calculate Room Assignments

Navigate to **Room Assignments** and select a date:
1. Click **"Calculate Assignments"**
2. The system will:
   - Group schedule slots by teacher, subject, time, and campus
   - Calculate total enrollment for each group
   - Select optimal rooms based on configuration
   - Create draft assignments

#### 3. Review and Publish

Review the calculated assignments:
- Check for **insufficient capacity** warnings
- Verify room assignments
- Manually adjust if needed
- Click **"Publish and Notify"** to:
  - Publish assignments (status: **published**)
  - Send notifications to teachers, students, and parents

#### 4. View Logs

Access **Assignment Logs** to see:
- All changes and events
- Who made changes and when
- Reason for changes
- Old and new room assignments

### For Teachers

#### Viewing Room Assignments

1. Open NovaConnect (Web or Mobile)
2. Navigate to **"My Schedule"** or **"Today's Classes"**
3. Each class shows:
   - Subject and time
   - Assigned room (with location icon)
   - Campus (if applicable)
   - **View Floor Plan** button (if enabled)

#### Receiving Notifications

- **T-60**: First reminder with room details
- **T-15**: Final reminder before class

### For Students

#### Viewing Room Assignments

1. Open NovaConnect Mobile App
2. Navigate to **"My Schedule"** or **"Today's Classes"**
3. Each class shows:
   - Subject and time
   - Teacher name
   - Assigned room (with location icon)
   - **View Floor Plan** button (if enabled)

#### Receiving Notifications

Students (and their parents) receive the same T-60 and T-15 reminders as teachers.

### For Parents

Parents receive room assignment notifications for their children via:
- In-App notifications
- Push notifications
- Email (if enabled)
- SMS (if enabled)

## Algorithm Details

### Grouping Logic

Schedule slots are grouped when they share:
- Same **teacher**
- Same **subject**
- Same **campus**
- Same **time slot** (start and end time)

Example:
- Teacher: M. Dupont
- Subject: Mathématiques
- Time: 09:00 - 10:00
- Campus: Main Campus
- Classes: 6ème A, 6ème B, 6ème C

Total enrollment = sum of all 3 classes

### Room Selection

1. **Filter available rooms**:
   - Rooms on the same campus
   - Rooms not already booked at that time
   - Rooms with `isAvailable = true`

2. **Calculate target capacity**:
   ```
   targetCapacity = totalStudents × (1 + capacityMarginPercent / 100)
   ```

3. **Find sufficient rooms**:
   - Rooms with `capacity >= targetCapacity`

4. **Select optimal room**:
   - If **priority = capacity**: Choose largest room
   - If **priority = size_category**: Choose highest category

5. **Fallback**:
   - If no sufficient rooms, assign the largest available room
   - Mark as "**insufficient**" capacity

### Conflict Detection

Before assigning a room, the system checks existing assignments for the same date and time to avoid conflicts.

## Edge Functions

### calculate-room-assignments

**Endpoint**: `/functions/v1/calculate-room-assignments`

**Method**: `POST`

**Body**:
```json
{
  "schoolId": "uuid",
  "sessionDate": "2025-03-01",  // Optional, defaults to today
  "scheduleId": "uuid",          // Optional, calculate for specific schedule
  "autoPublish": false           // Optional, auto-publish after calculation
}
```

**Response**:
```json
{
  "success": true,
  "assignmentsCreated": 15,
  "assignmentsUpdated": 3,
  "insufficientCapacity": [],
  "message": "Processed 18 groups: 15 created, 3 updated"
}
```

### publish-room-assignments

**Endpoint**: `/functions/v1/publish-room-assignments`

**Method**: `POST`

**Body**:
```json
{
  "schoolId": "uuid",
  "sessionDate": "2025-03-01"
}
```

**Response**:
```json
{
  "success": true,
  "published": 15,
  "notificationsSent": 127,
  "message": "Successfully published 15 assignments and sent 127 notifications"
}
```

### send-room-assignment-notifications

**Endpoint**: `/functions/v1/send-room-assignment-notifications`

**Method**: `POST`

**Body**:
```json
{
  "notificationWindow": 60,  // or 15
  "sessionDate": "2025-03-01"  // Optional, defaults to today
}
```

**Response**:
```json
{
  "success": true,
  "notificationsSent": 45,
  "message": "Sent 45 T-60 reminder notifications"
}
```

## Database Schema

### room_assignments

Stores calculated room assignments with status tracking.

Key fields:
- `grouped_class_ids`: Array of class IDs grouped together
- `total_students`: Sum of all enrollments
- `assigned_room_id`: Selected room (nullable)
- `capacity_status`: 'optimal' | 'sufficient' | 'insufficient'
- `status`: 'draft' | 'published' | 'updated' | 'cancelled'
- `version`: Incremented on recalculation

### room_assignment_events

Audit log for all assignment changes.

Key fields:
- `event_type`: 'created' | 'updated' | 'published' | 'notified' | 'cancelled'
- `old_room_id` / `new_room_id`: Track room changes
- `reason`: Explanation for the change
- `metadata`: Additional context

### rooms

Extended with `size_category` field:
- 'very_large' | 'large' | 'medium' | 'small'

## Automated Jobs (Cron)

### Daily Calculation
- **Schedule**: 06:00 every day
- **Action**: Calculates and publishes room assignments for the day

### T-60 Notifications
- **Schedule**: Every hour at minute 0
- **Action**: Sends notifications 60 minutes before class

### T-15 Notifications
- **Schedule**: Every 15 minutes
- **Action**: Sends reminder notifications 15 minutes before class

## Offline/LAN Mode

The Gateway LAN component supports offline room assignment calculation:

1. **Sync from Cloud**: Download schedule, enrollment, and room data
2. **Calculate Offline**: Run the grouping and selection algorithm locally
3. **Store Locally**: Save assignments in SQLite database
4. **Sync to Cloud**: Upload assignments when connection restored

See: `apps/gateway/src/sync/roomAssignments.ts`

## Troubleshooting

### No Rooms Assigned

**Possible causes**:
1. Module not enabled in settings
2. No rooms with capacity defined
3. All rooms already booked
4. No schedule slots for the date

**Solution**:
1. Check settings are enabled
2. Verify rooms have capacity and size_category set
3. Check existing assignments for conflicts
4. Verify schedule exists for the date

### Insufficient Capacity Warnings

**Meaning**: No room has enough capacity for the grouped classes.

**Solutions**:
1. Adjust `capacityMarginPercent` to a lower value
2. Add larger rooms to the campus
3. Split classes (future feature)
4. Manually assign larger rooms

### Notifications Not Sending

**Check**:
1. Notification channels are enabled in settings
2. Recipients have valid contact information (email, phone)
4. Cron jobs are running (check pg_cron)

### Assignments Not Updating After Schedule Changes

**Check**:
1. `autoRecalculateOnChange` is enabled
2. Trigger `trigger_room_assignment_recalculation` exists
3. Manually recalculate via admin interface

## API Integration

### React Query Hooks

```typescript
import {
  useRoomAssignmentsByDate,
  useCalculateRoomAssignments,
  usePublishRoomAssignments
} from '@novaconnect/data';

// Get assignments for a date
const { data: assignments } = useRoomAssignmentsByDate(schoolId, '2025-03-01');

// Calculate assignments
const calculateMutation = useCalculateRoomAssignments();
await calculateMutation.mutateAsync({
  schoolId,
  sessionDate: '2025-03-01'
});

// Publish assignments
const publishMutation = usePublishRoomAssignments();
await publishMutation.mutateAsync({
  schoolId,
  sessionDate: '2025-03-01'
});
```

### TypeScript Types

```typescript
import type {
  RoomAssignment,
  RoomSizeCategory,
  DynamicRoomAssignmentConfig
} from '@novaconnect/core';
```

## FAQ

**Q: Can I manually override room assignments?**
A: Yes, administrators can manually edit draft assignments before publishing.

**Q: What happens if a room becomes unavailable?**
A: The system will exclude it from selection. Existing assignments remain but are marked for recalculation.

**Q: Can I disable notifications?**
A: Yes, disable individual channels in the notification settings or set the module to inactive.

**Q: How are rooms selected when multiple have the same capacity?**
A: The system uses the `size_category` as a tiebreaker (very_large > large > medium > small).

**Q: What happens to assignments when a schedule is deleted?**
A: Related assignments are marked as 'cancelled' and logged in the events table.

**Q: Can I use this feature without GPS/QR attendance?**
A: Yes, this is a standalone module independent of attendance features.

## Best Practices

1. **Set accurate room capacities**: Ensure all rooms have correct capacity values
2. **Configure size categories**: Assign categories for better room prioritization
3. **Review before publishing**: Check draft assignments and resolve insufficient capacity warnings
4. **Monitor logs**: Regularly review assignment events for issues
5. **Test notifications**: Verify notification channels work before important days
6. **Plan capacity**: Add rooms or adjust margins based on enrollment trends

## Support

For issues or questions:
- Check the logs in **Admin > Room Assignments > Logs**
- Review the configuration in **Settings > Dynamic Room Assignment**
- Contact NovaConnect support with error details from the logs
