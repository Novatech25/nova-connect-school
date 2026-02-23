# Système de Présence - Documentation

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture des tables](#architecture-des-tables)
3. [Flux de travail](#flux-de-travail)
4. [Intégration avec l'EDT](#intégration-avec-ledt)
5. [Système de notifications](#système-de-notifications)
6. [Interfaces utilisateurs](#interfaces-utilisateurs)
7. [Exemples d'utilisation](#exemples-dutilisation)
8. [Sécurité et RLS](#sécurité-et-rls)

---

## Vue d'ensemble

Le système de présence de NovaConnect permet aux professeurs de faire l'appel en classe, aux administrateurs de valider les feuilles de présence, et aux parents de consulter l'historique de présence de leurs enfants.

### Fonctionnalités principales

- ✅ **Prise de présence en temps réel** par les professeurs
- ✅ **Validation des feuilles** par les administrateurs
- ✅ **Notifications automatiques** aux parents en cas d'absence/retard
- ✅ **Consultation d'historique** pour les parents
- ✅ **Rapports et statistiques** pour l'administration
- ✅ **Traçabilité complète** avec audit logs

---

## Architecture des tables

### 1. Tables principales

#### `attendance_sessions`

Représente une session d'appel pour une séance planifiée.

```sql
CREATE TABLE attendance_sessions (
  id UUID PRIMARY KEY,
  school_id UUID NOT NULL,
  planned_session_id UUID NOT NULL,  -- Lien avec l'EDT
  teacher_id UUID NOT NULL,
  class_id UUID NOT NULL,
  session_date DATE NOT NULL,
  status attendance_session_status_enum,  -- draft, submitted, validated
  submitted_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  validated_by UUID,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Workflow :**
- `draft` : Le professeur est en train de faire l'appel
- `submitted` : Le professeur a soumis la présence
- `validated` : Un administrateur a validé la feuille

#### `attendance_records`

Enregistrements individuels de présence par élève.

```sql
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY,
  attendance_session_id UUID NOT NULL,
  school_id UUID NOT NULL,
  student_id UUID NOT NULL,
  status attendance_status_enum,  -- present, absent, late, excused
  source attendance_source_enum,  -- teacher_manual, qr_scan
  justification TEXT,             -- Requis si status = excused
  comment TEXT,
  marked_by UUID NOT NULL,
  marked_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Statuts :**
- `present` : Élève présent
- `absent` : Élève absent
- `late` : Élève en retard
- `excused` : Absence justifiée (nécessite une justification)

### 2. Index et contraintes

```sql
-- Contraintes d'unicité
UNIQUE (attendance_sessions.planned_session_id, session_date)
UNIQUE (attendance_records.attendance_session_id, student_id)

-- Index pour les performances
CREATE INDEX idx_attendance_sessions_teacher_date
  ON attendance_sessions(teacher_id, session_date);
CREATE INDEX idx_attendance_records_student_date
  ON attendance_records(student_id, marked_at);
```

### 3. Triggers

#### Trigger de notification aux parents

```sql
CREATE FUNCTION notify_parents_on_absence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('absent', 'late') THEN
    -- Créer des notifications pour tous les parents
    INSERT INTO notifications (user_id, type, title, body, data)
    SELECT
      parent_id,
      'attendance_marked',
      'Absence de ' || student.first_name,
      'Votre enfant a été marqué absent...',
      jsonb_build_object(...)
    FROM student_parent_relations
    WHERE student_id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Flux de travail

### 1. Création de la session

Quand un professeur ouvre l'écran de présence :

1. Le système vérifie si une `attendance_session` existe pour cette `planned_session`
2. Si non, il crée une nouvelle session en statut `draft`
3. Si oui, il charge la session existante

```typescript
const { data: existingSession } = useAttendanceSessionByPlannedSession(plannedSessionId);

if (!existingSession) {
  await createAttendanceSession({
    plannedSessionId: plannedSessionId,
    teacherId: user.id,
    classId: classId,
    sessionDate: new Date().toISOString().split('T')[0],
  });
}
```

### 2. Saisie de la présence

Le professeur marque chaque élève :

```typescript
await createBulkAttendanceRecords([
  {
    attendanceSessionId: sessionId,
    studentId: 'student-1',
    status: 'present',
  },
  {
    attendanceSessionId: sessionId,
    studentId: 'student-2',
    status: 'absent',
  },
  {
    attendanceSessionId: sessionId,
    studentId: 'student-3',
    status: 'late',
  },
]);
```

**⚠️ Important :** Le trigger SQL `notify_parents_on_absence()` crée automatiquement les notifications pour les parents des élèves absents/retard.

### 3. Soumission de la session

Le professeur soumet la feuille de présence :

```typescript
await submitAttendanceSession({
  id: sessionId,
  notes: 'Tout s\'est bien passé',
});
```

Cela change le statut de `draft` → `submitted`.

### 4. Validation par l'administration

Un administrateur valide la session :

```typescript
await validateAttendanceSession({
  id: sessionId,
});
```

Cela change le statut de `submitted` → `validated`.

---

## Intégration avec l'EDT

### Lien avec les planned_sessions

Chaque `attendance_session` est liée à une `planned_session` de l'EDT :

```sql
ALTER TABLE attendance_sessions
  ADD CONSTRAINT fk_planned_session
  FOREIGN KEY (planned_session_id)
  REFERENCES planned_sessions(id);
```

### Récupération des sessions du jour

```typescript
// Récupérer les séances planifiées du jour pour un professeur
const { data: todaySessions } = useTodayAttendanceSessions(teacherId);

// todaySessions contient :
// - planned_sessions du jour
// - avec leurs attendance_session associées (si elles existent)
```

### Structure des données

```typescript
interface TodaySession {
  id: string;                    // planned_session.id
  date: string;                  // YYYY-MM-DD
  startTime: string;             // HH:mm
  endTime: string;               // HH:mm
  subjectName: string;
  className: string;
  attendance_session?: {         // Optionnel (pas encore créé)
    id: string;
    status: 'draft' | 'submitted' | 'validated';
  };
}
```

---

## Système de notifications

### Flux de notification

```
Élève marqué absent/retard
  ↓
Trigger SQL : notify_parents_on_absence()
  ↓
Insertion dans table notifications
  ↓
Création notification mobile (in-app)
  ↓
Envoi push notification (Expo)
  ↓
Parent reçoit notification
```

### Types de notifications

| Type | Trigger | Cibles |
|------|---------|--------|
| `attendance_marked` | Insert/Update sur `attendance_records` | Parents de l'élève |

### Structure de la notification

```typescript
{
  type: 'attendance_marked',
  title: 'Absence de Jean',
  body: 'Votre enfant Jean a été marqué absent le 21/01/2025 pour Mathématiques',
  data: {
    studentId: 'student-1',
    attendanceRecordId: 'record-1',
    status: 'absent',
    sessionDate: '2025-01-21',
    sessionId: 'session-1'
  },
  channels: ['in_app', 'push']
}
```

### Edge Function

Une Edge Function Supabase gère l'envoi des notifications push via Expo :

```typescript
// supabase/functions/send-attendance-notification/index.ts
// Appelée automatiquement par le trigger SQL
```

---

## Interfaces utilisateurs

### 1. Mobile Professeur

#### Liste des sessions du jour (`/attendance`)

- Affiche les séances planifiées du jour
- Indique le statut de chaque session (brouillon/soumis/validé)
- Permet d'accéder à l'écran de saisie

#### Écran de saisie (`/attendance/[sessionId]`)

- Liste tous les élèves de la classe
- Sélecteur de statut par élève (présent/absent/retard/excusé)
- Champ de justification si "excusé"
- Boutons "Enregistrer brouillon" et "Soumettre"

### 2. Web Administration

#### Validation des présences (`/admin/attendance`)

- Tableau des sessions avec filtres
- Actions : Voir détails, Valider
- Modal de détail avec liste des élèves

#### Rapports (`/admin/attendance/reports`)

- Statistiques globales
- Graphique d'évolution
- Tableau par élève avec taux de présence
- Export CSV

### 3. Mobile Parent

#### Consultation de présence (`/attendance-parent`)

- Sélecteur d'enfant (si plusieurs)
- Sélecteur de mois
- Calendrier visuel avec indicateurs de couleur
- Liste des absences/retards avec justifications
- Statistiques mensuelles

---

## Exemples d'utilisation

### Hooks React Query

#### Récupérer les sessions du jour

```typescript
import { useTodayAttendanceSessions } from '@novaconnect/data';

function AttendanceList() {
  const { data: sessions, isLoading } = useTodayAttendanceSessions(user.id);

  if (isLoading) return <Text>Chargement...</Text>;

  return (
    <FlatList
      data={sessions}
      renderItem={({ item }) => <SessionCard session={item} />}
    />
  );
}
```

#### Créer une session de présence

```typescript
import { useCreateAttendanceSession } from '@novaconnect/data';

function CreateSessionButton({ plannedSessionId }) {
  const createSession = useCreateAttendanceSession();

  const handleCreate = async () => {
    await createSession.mutateAsync({
      plannedSessionId,
      teacherId: user.id,
      classId: classId,
      sessionDate: new Date().toISOString().split('T')[0],
    });
  };

  return <Button onPress={handleCreate}>Créer session</Button>;
}
```

#### Soumettre une présence

```typescript
import { useCreateBulkAttendanceRecords, useSubmitAttendanceSession } from '@novaconnect/data';

function SubmitAttendance({ sessionId, records }) {
  const createRecords = useCreateBulkAttendanceRecords();
  const submitSession = useSubmitAttendanceSession();

  const handleSubmit = async () => {
    // Créer tous les enregistrements
    await createRecords.mutateAsync(records);

    // Soumettre la session
    await submitSession.mutateAsync({
      id: sessionId,
      notes: 'Appel terminé',
    });
  };

  return <Button onPress={handleSubmit}>Soumettre</Button>;
}
```

### Schémas Zod

#### Validation de création

```typescript
import { createAttendanceRecordSchema } from '@core/schemas/attendance';

const input = {
  attendanceSessionId: 'session-1',
  studentId: 'student-1',
  status: 'excused',
  justification: 'Certificat médical', // Requis si status = excused
};

const validated = createAttendanceRecordSchema.parse(input);
```

#### Validation de mise à jour

```typescript
import { updateAttendanceSessionSchema } from '@core/schemas/attendance';

const update = {
  id: 'session-1',
  status: 'submitted',
  notes: 'Feuille de présence complétée',
};

const validated = updateAttendanceSessionSchema.parse(update);
```

---

## Sécurité et RLS

### Politiques RLS

#### Professeurs

- `SELECT` : Uniquement leurs sessions
- `INSERT` : Sessions pour leurs planned_sessions
- `UPDATE` : Uniquement leurs sessions en `draft`
- `DELETE` : Non autorisé

#### Parents

- `SELECT` : Uniquement les records de leurs enfants
- `INSERT/UPDATE/DELETE` : Non autorisé

#### Administrateurs

- `SELECT` : Toutes les sessions de leur école
- `INSERT` : Autorisé
- `UPDATE` : Toutes les sessions (y compris validation)
- `DELETE` : Sessions en `draft` uniquement

### Exemple de politique

```sql
-- Professeurs peuvent voir leurs sessions
CREATE POLICY "Teachers can view their own sessions"
  ON attendance_sessions FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
    AND teacher_id = auth.uid()
  );

-- Professeurs peuvent modifier leurs brouillons
CREATE POLICY "Teachers can update draft sessions"
  ON attendance_sessions FOR UPDATE
  USING (
    teacher_id = auth.uid()
    AND status = 'draft'
  );
```

---

## Bonnes pratiques

### 1. Toujours invalider les queries après mutation

```typescript
const createSession = useCreateAttendanceSession();

await createSession.mutateAsync(input, {
  onSuccess: () => {
    queryClient.invalidateQueries(['attendance-sessions']);
    queryClient.invalidateQueries(['attendance-session']);
  },
});
```

### 2. Gérer les optimistes updates

```typescript
const submitSession = useSubmitAttendanceSession();

submitSession.mutate(
  { id: sessionId },
  {
    onMutate: async () => {
      // Annuler les queries en cours
      await queryClient.cancelQueries(['attendance-session', sessionId]);

      // Sauvegarder l'ancienne valeur
      const previousSession = queryClient.getQueryData(['attendance-session', sessionId]);

      // Optimiste update
      queryClient.setQueryData(['attendance-session', sessionId], (old) => ({
        ...old,
        status: 'submitted',
      }));

      return { previousSession };
    },
    onError: (err, variables, context) => {
      // Rollback en cas d'erreur
      queryClient.setQueryData(['attendance-session', sessionId], context.previousSession);
    },
  }
);
```

### 3. Valider les données avec Zod

```typescript
import { createAttendanceRecordSchema } from '@core/schemas/attendance';

try {
  const validated = createAttendanceRecordSchema.parse(rawInput);
  await createRecord(validated);
} catch (error) {
  console.error('Validation failed:', error.errors);
}
```

---

## Dépannage

### Problème : Les notifications ne sont pas envoyées

**Causes possibles :**
1. Le trigger SQL n'est pas activé
2. L'Edge Function n'est pas déployée
3. Les tokens push Expo sont invalides

**Solutions :**
```sql
-- Vérifier que le trigger existe
SELECT * FROM pg_trigger WHERE tgname = 'trigger_notify_parents_on_absence';

-- Tester manuellement
SELECT notify_parents_on_absence();
```

### Problème : Impossible de créer une session

**Causes possibles :**
1. L'utilisateur n'est pas le professeur de cette planned_session
2. Une session existe déjà pour cette date

**Solutions :**
```typescript
// Vérifier si une session existe déjà
const existing = await attendanceSessionQueries.getByPlannedSession(plannedSessionId);

if (existing) {
  console.log('Session already exists:', existing.id);
} else {
  // Créer la session
}
```

---

## Évolutions futures

### Phase 2 : Fusion avec QR Code élève

- Ajout du champ `source` pour distinguer les sources
- Compatibilité avec le système de scan QR

### Phase 3 : Liaison cahier de texte

- Une session validée peut déclencher la création d'heures payables
- Bloquer l'accès aux documents pour les absences non justifiées

---

## Contact

Pour toute question ou problème concernant le système de présence, consultez :

- 📚 Documentation technique : `docs/attendance-system.md`
- 💬 Issues GitHub : [github.com/.../issues](https://github.com/...)
- 📧 Support technique : support@novaconnect.fr
