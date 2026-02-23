# Lesson Log UI Implementation Guide

This document provides implementation guidance for the remaining UI components of the Lesson Log System. The backend infrastructure is complete, including database migrations, schemas, queries, hooks, and Edge Functions.

## Status Summary

### ✅ Completed Backend Components

1. **Database Schema** (4 migrations)
   - Tables: `lesson_logs`, `lesson_log_documents`
   - Storage bucket: `lesson-documents`
   - RLS policies for all roles
   - Audit triggers and notifications

2. **Type Safety**
   - Zod schemas in `packages/core/src/schemas/lessonLog.ts`
   - Full TypeScript types exported

3. **Business Logic**
   - Queries in `packages/data/src/queries/lessonLogs.ts`
   - React hooks in `packages/data/src/hooks/useLessonLogs.ts`

4. **Geolocation Validation**
   - Edge Function: `validate-lesson-log-location`
   - GPS distance calculation (Haversine formula)
   - Wi-Fi SSID validation

5. **Configuration**
   - Expo permissions for location and document picker
   - School settings in `schools.settings.gps`

### 🚧 Pending UI Components

The following UI components need to be implemented:

1. **Mobile - Teacher**
   - `apps/mobile/app/(tabs)/lesson-log.tsx` - Lesson log form
   - `apps/mobile/app/(tabs)/lesson-logs-list.tsx` - List of teacher's logs

2. **Web - Admin**
   - `apps/web/src/app/(dashboard)/admin/lesson-logs/page.tsx` - Validation page
   - `apps/web/src/app/(dashboard)/admin/lesson-logs/teacher-hours/page.tsx` - Hours tracking

3. **Mobile - Student/Parent**
   - `apps/mobile/app/(tabs)/lesson-logs-student.tsx` - View lesson logs

4. **Shared Components**
   - `packages/ui/src/mobile/LessonLogCard.tsx`
   - `packages/ui/src/mobile/LessonLogStatusBadge.tsx`
   - `apps/web/src/components/admin/lesson-logs/LessonLogDetailDialog.tsx`

---

## Implementation Priority

### Phase 1: Core Teacher Features (High Priority)

#### 1.1 Teacher Lesson Log Form

**File**: `apps/mobile/app/(tabs)/lesson-log.tsx`

**Key Features**:
```typescript
// Required imports
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import { useCreateLessonLog, useSubmitLessonLog, useValidateLessonLogLocation } from '@data/hooks/useLessonLogs';
import { useTodayPlannedSessionsWithoutLog } from '@data/hooks/useLessonLogs';
import { isValidCoordinates, calculateDistance } from '@core/utils/geolocation';

// Component structure
export default function LessonLogScreen() {
  const [selectedSession, setSelectedSession] = useState<PlannedSession | null>(null);
  const [theme, setTheme] = useState('');
  const [content, setContent] = useState('');
  const [homework, setHomework] = useState('');
  const [duration, setDuration] = useState(55);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  // Query today's sessions without lesson logs
  const { data: sessions } = useTodayPlannedSessionsWithoutLog(teacherId);

  // Geolocation validation
  const validateLocation = useValidateLessonLogLocation();

  // Mutations
  const createLog = useCreateLessonLog();
  const submitLog = useSubmitLessonLog();

  // Effects
  useEffect(() => {
    // Request location permission on mount
    requestLocationPermission();
  }, []);

  // Validation logic
  const isLocationValid = location && isValidCoordinates(
    location.coords.latitude,
    location.coords.longitude
  );

  const distance = location && schoolLocation
    ? calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        schoolLocation.latitude,
        schoolLocation.longitude
      )
    : null;

  const canSubmit = isLocationValid && distance <= schoolRadius && theme.length >= 3 && content.length >= 10;

  // Render
  return (
    <ScrollView>
      {/* Session selector */}
      {/* Location indicator */}
      {/* Form fields */}
      {/* Document upload */}
      {/* Save/Submit buttons */}
    </ScrollView>
  );
}
```

**Location Indicator Component**:
```tsx
<View style={[styles.locationIndicator, { backgroundColor: isLocationValid ? '#dcfce7' : '#fee2e2' }]}>
  {isLocationValid ? (
    <>
      <Text style={styles.successText}>✓ À l'école</Text>
      <Text>{Math.round(distance)}m</Text>
    </>
  ) : (
    <>
      <Text style={styles.errorText}>✗ Trop loin</Text>
      <Text>{Math.round(distance)}m (max: {schoolRadius}m)</Text>
    </>
  )}
</View>
```

#### 1.2 Teacher Lesson Logs List

**File**: `apps/mobile/app/(tabs)/lesson-logs-list.tsx`

**Key Features**:
```typescript
export default function LessonLogsListScreen() {
  const [statusFilter, setStatusFilter] = useState<'all' | LessonLogStatus>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const { data: logs } = useTeacherLessonLogs(teacherId, {
    status: statusFilter === 'all' ? undefined : statusFilter,
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  return (
    <View>
      {/* Filters */}
      {/* List of LessonLogCard components */}
    </View>
  );
}
```

### Phase 2: Admin Validation (High Priority)

#### 2.1 Admin Lesson Logs Validation Page

**File**: `apps/web/src/app/(dashboard)/admin/lesson-logs/page.tsx`

**Key Features**:
```typescript
export default function AdminLessonLogsPage() {
  const [tab, setTab] = useState<'pending' | 'validated' | 'rejected' | 'all'>('pending');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const { data: logs } = tab === 'pending'
    ? usePendingLessonLogs(schoolId)
    : useLessonLogs(schoolId, { status: tab === 'all' ? undefined : tab });

  const validateMutation = useValidateLessonLog();
  const rejectMutation = useRejectLessonLog();

  return (
    <div>
      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v)}>
        <TabsList>
          <TabsTrigger value="pending">En attente ({logs?.length || 0})</TabsTrigger>
          <TabsTrigger value="validated">Validés</TabsTrigger>
          <TabsTrigger value="rejected">Rejetés</TabsTrigger>
          <TabsTrigger value="all">Tous</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Professeur</TableHead>
            <TableHead>Classe</TableHead>
            <TableHead>Matière</TableHead>
            <TableHead>Thème</TableHead>
            <TableHead>Durée</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs?.map((log) => (
            <TableRow key={log.id}>
              <TableCell>{log.sessionDate}</TableCell>
              <TableCell>{log.teacher.firstName} {log.teacher.lastName}</TableCell>
              <TableCell>{log.class.name}</TableCell>
              <TableCell>{log.subject.name}</TableCell>
              <TableCell>{log.theme}</TableCell>
              <TableCell>{log.durationMinutes} min</TableCell>
              <TableCell><LessonLogStatusBadge status={log.status} /></TableCell>
              <TableCell>
                <Button onClick={() => setSelectedLogId(log.id)}>Voir</Button>
                {log.status === 'pending_validation' && (
                  <>
                    <Button onClick={() => validateMutation.mutate({ id: log.id })}>
                      Valider
                    </Button>
                    <Button onClick={() => handleReject(log.id)}>
                      Rejeter
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Detail Dialog */}
      {selectedLogId && (
        <LessonLogDetailDialog
          lessonLogId={selectedLogId}
          open={!!selectedLogId}
          onClose={() => setSelectedLogId(null)}
        />
      )}
    </div>
  );
}
```

#### 2.2 Lesson Log Detail Dialog

**File**: `apps/web/src/components/admin/lesson-logs/LessonLogDetailDialog.tsx`

**Key Features**:
```typescript
interface LessonLogDetailDialogProps {
  lessonLogId: string;
  open: boolean;
  onClose: () => void;
}

export function LessonLogDetailDialog({ lessonLogId, open, onClose }: LessonLogDetailDialogProps) {
  const { data: log } = useLessonLog(lessonLogId);
  const validateMutation = useValidateLessonLog();
  const rejectMutation = useRejectLessonLog();
  const [rejectionReason, setRejectionReason] = useState('');

  if (!log) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Détails du cahier de texte</DialogTitle>
        </DialogHeader>

        {/* Lesson Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Professeur</Label>
            <p>{log.teacher.firstName} {log.teacher.lastName}</p>
          </div>
          <div>
            <Label>Date</Label>
            <p>{log.sessionDate}</p>
          </div>
          <div>
            <Label>Classe</Label>
            <p>{log.class.name}</p>
          </div>
          <div>
            <Label>Matière</Label>
            <p>{log.subject.name}</p>
          </div>
        </div>

        {/* Theme and Content */}
        <div>
          <Label>Thème</Label>
          <p>{log.theme}</p>
        </div>
        <div>
          <Label>Contenu</Label>
          <p className="whitespace-pre-wrap">{log.content}</p>
        </div>
        {log.homework && (
          <div>
            <Label>Devoirs</Label>
            <p className="font-semibold">{log.homework}</p>
          </div>
        )}

        {/* GPS Location */}
        <div>
          <Label>Position GPS</Label>
          <p>Latitude: {log.latitude}</p>
          <p>Longitude: {log.longitude}</p>
          {/* Optional: Map component */}
        </div>

        {/* Documents */}
        {log.documents && log.documents.length > 0 && (
          <div>
            <Label>Documents</Label>
            {log.documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-2">
                <FileText />
                <a href={doc.filePath} download={doc.fileName}>
                  {doc.fileName}
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Validation/Rejection */}
        {log.status === 'pending_validation' && (
          <div className="flex gap-2">
            <Button
              onClick={() => validateMutation.mutate({ id: log.id })}
              className="bg-green-600"
            >
              Valider
            </Button>
            <Button
              onClick={() => setShowRejectDialog(true)}
              variant="destructive"
            >
              Rejeter
            </Button>
          </div>
        )}

        {/* Rejection reason (if rejected) */}
        {log.status === 'rejected' && log.rejectionReason && (
          <div className="bg-red-50 p-4 rounded">
            <Label className="text-red-600">Raison du rejet</Label>
            <p>{log.rejectionReason}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### Phase 3: Student/Parent Features (Medium Priority)

#### 3.1 Student Lesson Logs View

**File**: `apps/mobile/app/(tabs)/lesson-logs-student.tsx`

**Key Features**:
```typescript
export default function StudentLessonLogsScreen() {
  const { data: classes } = useStudentClasses(studentId);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  const { data: logs } = useClassLessonLogs(
    selectedClass || classes?.[0]?.id,
    { status: 'validated' }
  );

  return (
    <ScrollView>
      {/* Class selector (if multiple) */}
      {classes?.length > 1 && (
        <Picker
          selectedValue={selectedClass}
          onValueChange={setSelectedClass}
        >
          {classes.map((cls) => (
            <Picker.Item key={cls.id} label={cls.name} value={cls.id} />
          ))}
        </Picker>
      )}

      {/* List of validated lesson logs */}
      {logs?.map((log) => (
        <LessonLogCard
          key={log.id}
          lessonLog={log}
          onPress={() => navigation.navigate('LessonLogDetail', { id: log.id })}
          showActions={false}
        />
      ))}
    </ScrollView>
  );
}
```

### Phase 4: Shared Components (Medium Priority)

#### 4.1 Lesson Log Card Component

**File**: `packages/ui/src/mobile/LessonLogCard.tsx`

```typescript
interface LessonLogCardProps {
  lessonLog: LessonLogWithRelations;
  onPress: () => void;
  showActions?: boolean;
}

export function LessonLogCard({ lessonLog, onPress, showActions }: LessonLogCardProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <LessonLogStatusBadge status={lessonLog.status} />

      <View style={styles.header}>
        <Text style={styles.date}>{formatDate(lessonLog.sessionDate)}</Text>
        <Text style={styles.duration}>{lessonLog.durationMinutes} min</Text>
      </View>

      <Text style={styles.class}>{lessonLog.class.name}</Text>
      <Text style={styles.subject}>{lessonLog.subject.name}</Text>

      <Text style={styles.theme} numberOfLines={2}>
        {lessonLog.theme}
      </Text>

      {lessonLog.homework && (
        <Text style={styles.homework}>
          📝 Devoirs: {lessonLog.homework}
        </Text>
      )}

      {lessonLog.documents && lessonLog.documents.length > 0 && (
        <Text style={styles.documents}>
          📎 {lessonLog.documents.length} document(s)
        </Text>
      )}

      {showActions && lessonLog.status === 'draft' && (
        <View style={styles.actions}>
          <Button size="sm" variant="outline">Modifier</Button>
          <Button size="sm">Soumettre</Button>
        </View>
      )}
    </TouchableOpacity>
  );
}
```

#### 4.2 Lesson Log Status Badge

**File**: `packages/ui/src/mobile/LessonLogStatusBadge.tsx`

```typescript
interface LessonLogStatusBadgeProps {
  status: LessonLogStatus;
}

const statusConfig = {
  draft: { label: 'Brouillon', color: '#6b7280' },
  pending_validation: { label: 'En attente', color: '#f59e0b' },
  validated: { label: 'Validé', color: '#10b981' },
  rejected: { label: 'Rejeté', color: '#ef4444' },
};

export function LessonLogStatusBadge({ status }: LessonLogStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.color }]}>
      <Text style={styles.label}>{config.label}</Text>
    </View>
  );
}
```

---

## Testing Checklist

For each implemented component, verify:

- [ ] Location permission is requested and granted
- [ ] GPS coordinates are captured correctly
- [ ] Distance to school is calculated and displayed
- [ ] Wi-Fi validation works (if required)
- [ ] Form validation works (theme length, content length, duration)
- [ ] Document upload works (file type, size limits)
- [ ] Draft save works
- [ ] Submit triggers location validation
- [ ] Pending logs appear in admin view
- [ ] Validation/rejection works
- [ ] Notifications are sent
- [ ] Planned session is marked as completed
- [ ] Students can see validated logs
- [ ] Homework is highlighted for students

---

## Styling Guidelines

### Mobile (React Native)

Use consistent styling:
```typescript
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // ... other styles
});
```

### Web (Tailwind CSS)

Use NovaConnect design tokens:
```tsx
<div className="bg-white rounded-lg shadow-md p-6">
  {/* Content */}
</div>
```

---

## Navigation Setup

### Mobile Navigation

Update `apps/mobile/app/(tabs)/_layout.tsx`:

```typescript
<Tabs>
  {/* Existing tabs... */}

  {/* Teacher: Lesson log tab */}
  {userRole === 'teacher' && (
    <Tabs.Screen
      name="lesson-log"
      options={{
        title: 'Cahier',
        tabBarIcon: ({ color }) => <TabBarIcon name="book" color={color} />,
      }}
    />
  )}

  {/* Teacher: Lesson logs list */}
  {userRole === 'teacher' && (
    <Tabs.Screen
      name="lesson-logs-list"
      options={{
        title: 'Mes Cahiers',
        tabBarIcon: ({ color }) => <TabBarIcon name="list" color={color} />,
      }}
    />
  )}

  {/* Student/Parent: Lesson logs */}
  {(userRole === 'student' || userRole === 'parent') && (
    <Tabs.Screen
      name="lesson-logs-student"
      options={{
        title: 'Cours',
        tabBarIcon: ({ color }) => <TabBarIcon name="book-open" color={color} />,
      }}
    />
  )}
</Tabs>
```

---

## Dependencies Required

Ensure these packages are installed:

### Mobile
```bash
npm install expo-location expo-document-picker
npm install @react-navigation/native
npm install react-native-maps  # For GPS map display
```

### Web
```bash
npm install react-leaflet leaflet  # For GPS map display
npm install recharts  # For charts in teacher hours page
```

---

## Next Steps

1. **Implement Phase 1** (Teacher mobile features) - Estimated 2-3 days
2. **Implement Phase 2** (Admin validation) - Estimated 1-2 days
3. **Implement Phase 3** (Student/Parent features) - Estimated 1 day
4. **Implement Phase 4** (Shared components) - Estimated 1 day
5. **Testing and polish** - Estimated 1-2 days

Total estimated time: **5-9 days**

---

**Last Updated**: 2025-01-24
**Version**: 1.0.0
