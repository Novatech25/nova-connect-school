import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth, useStudents, useAttendanceSessionByPlannedSession, useAttendanceRecords, useCreateAttendanceSession, useCreateBulkAttendanceRecords, useSubmitAttendanceSession, supabase } from '@novaconnect/data';
import { AttendanceStatusBadge } from '../../../components/attendance/AttendanceStatusBadge';
import type { AttendanceStatus, AttendanceSession } from '@core/schemas/attendance';

type StudentAttendance = {
  studentId: string;
  firstName: string;
  lastName: string;
  photo: string | null;
  status: AttendanceStatus;
  justification?: string;
  comment?: string;
};

export default function AttendanceSessionPage() {
  const { sessionId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [attendanceData, setAttendanceData] = useState<StudentAttendance[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Récupérer la session de présence
  const { data: attendanceSession, isLoading: sessionLoading, refetch: refetchSession } =
    useAttendanceSessionByPlannedSession(sessionId as string);

  // Créer une session si elle n'existe pas
  const createSession = useCreateAttendanceSession();
  const submitSession = useSubmitAttendanceSession();
  const createBulkRecords = useCreateBulkAttendanceRecords();

  // Récupérer les enregistrements existants
  const { data: existingRecords, isLoading: recordsLoading, refetch: refetchRecords } =
    useAttendanceRecords(attendanceSession?.id || '');

  // Récupérer les élèves de la classe
  const { data: students, isLoading: studentsLoading } = useStudents(attendanceSession?.classId || '');

  // Initialiser les données de présence
  useEffect(() => {
    if (students && existingRecords) {
      const initialData: StudentAttendance[] = students.map((student) => {
        const existingRecord = existingRecords.find((r) => r.studentId === student.id);
        return {
          studentId: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          photo: student.photo,
          status: existingRecord?.status || 'present',
          justification: existingRecord?.justification || '',
          comment: existingRecord?.comment || '',
        };
      });
      setAttendanceData(initialData);
      setNotes(attendanceSession?.notes || '');
    } else if (students && !existingRecords) {
      // Nouvelle session, tous présents par défaut
      const initialData: StudentAttendance[] = students.map((student) => ({
        studentId: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        photo: student.photo,
        status: 'present',
        justification: '',
        comment: '',
      }));
      setAttendanceData(initialData);
    }
  }, [students, existingRecords, attendanceSession]);

  // Créer la session si elle n'existe pas
  useEffect(() => {
    if (!sessionLoading && !attendanceSession && !isSubmitting && sessionId) {
      handleCreateSession();
    }
  }, [sessionLoading, attendanceSession, sessionId]);

  const handleCreateSession = async () => {
    try {
      setIsSubmitting(true);

      // Fetch the planned session to get classId and schoolId
      const { data: plannedSession, error: plannedError } = await supabase
        .from('planned_sessions')
        .select('id, class_id, school_id')
        .eq('id', sessionId)
        .single();

      if (plannedError || !plannedSession) {
        throw new Error('Failed to fetch planned session');
      }

      await createSession.mutateAsync({
        schoolId: plannedSession.school_id,
        plannedSessionId: sessionId as string,
        teacherId: user?.id || '',
        classId: plannedSession.class_id,
        sessionDate: new Date().toISOString().split('T')[0],
      });
      await refetchSession();
    } catch (error) {
      console.error('Error creating session:', error);
      Alert.alert('Erreur', 'Impossible de créer la session de présence');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceData((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? { ...s, status }
          : s
      )
    );
  };

  const handleJustificationChange = (studentId: string, justification: string) => {
    setAttendanceData((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? { ...s, justification }
          : s
      )
    );
  };

  const handleCommentChange = (studentId: string, comment: string) => {
    setAttendanceData((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? { ...s, comment }
          : s
      )
    );
  };

  const handleSaveDraft = async () => {
    if (!attendanceSession?.id) return;

    try {
      setIsSubmitting(true);
      await createBulkRecords.mutateAsync(
        attendanceData.map((data) => ({
          attendanceSessionId: attendanceSession.id,
          schoolId: user?.schoolId || '',
          studentId: data.studentId,
          status: data.status,
          justification: data.status === 'excused' ? data.justification : null,
          comment: data.comment || null,
        }))
      );
      Alert.alert('Succès', 'Brouillon enregistré');
    } catch (error) {
      console.error('Error saving draft:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer le brouillon');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!attendanceSession?.id) return;

    // Vérifier que tous les élèves ont un statut
    const unmarkedStudents = attendanceData.filter((s) => !s.status);
    if (unmarkedStudents.length > 0) {
      Alert.alert(
        'Attention',
        `${unmarkedStudents.length} élève(s) non marqué(s). Continuer quand même?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Continuer', onPress: submitAttendance },
        ]
      );
      return;
    }

    await submitAttendance();
  };

  const submitAttendance = async () => {
    if (!attendanceSession?.id) return;

    try {
      setIsSubmitting(true);
      await createBulkRecords.mutateAsync(
        attendanceData.map((data) => ({
          attendanceSessionId: attendanceSession.id,
          schoolId: user?.schoolId || '',
          studentId: data.studentId,
          status: data.status,
          justification: data.status === 'excused' ? data.justification : null,
          comment: data.comment || null,
        }))
      );
      await submitSession.mutateAsync({
        id: attendanceSession.id,
        notes: notes || null,
      });
      Alert.alert('Succès', 'Présence enregistrée', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error submitting attendance:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la présence');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = {
    total: attendanceData.length,
    present: attendanceData.filter((s) => s.status === 'present').length,
    absent: attendanceData.filter((s) => s.status === 'absent').length,
    late: attendanceData.filter((s) => s.status === 'late').length,
    excused: attendanceData.filter((s) => s.status === 'excused').length,
  };

  if (sessionLoading || studentsLoading || isSubmitting) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Présence',
          headerBackTitle: 'Retour',
        }}
      />

      {/* Header avec infos session */}
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionTitle}>
          {attendanceSession?.class?.name || 'Classe'} - {attendanceSession?.plannedSession?.subjectName || 'Matière'}
        </Text>
        <Text style={styles.sessionDate}>
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
        {attendanceSession && (
          <AttendanceStatusBadge status={attendanceSession.status} />
        )}
      </View>

      {/* Statistiques */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.statText}>Présents: {stats.present}</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.statText}>Absents: {stats.absent}</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={styles.statText}>Retards: {stats.late}</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: '#3b82f6' }]} />
          <Text style={styles.statText}>Excusés: {stats.excused}</Text>
        </View>
      </View>

      {/* Liste des élèves */}
      <ScrollView style={styles.studentsList}>
        {attendanceData.map((student) => (
          <View key={student.studentId} style={styles.studentCard}>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>
                {student.firstName} {student.lastName}
              </Text>
            </View>

            <View style={styles.statusButtons}>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  student.status === 'present' && styles.statusButtonPresent,
                ]}
                onPress={() => handleStatusChange(student.studentId, 'present')}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    student.status === 'present' && styles.statusButtonTextActive,
                  ]}
                >
                  Présent
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusButton,
                  student.status === 'absent' && styles.statusButtonAbsent,
                ]}
                onPress={() => handleStatusChange(student.studentId, 'absent')}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    student.status === 'absent' && styles.statusButtonTextActive,
                  ]}
                >
                  Absent
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusButton,
                  student.status === 'late' && styles.statusButtonLate,
                ]}
                onPress={() => handleStatusChange(student.studentId, 'late')}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    student.status === 'late' && styles.statusButtonTextActive,
                  ]}
                >
                  Retard
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusButton,
                  student.status === 'excused' && styles.statusButtonExcused,
                ]}
                onPress={() => handleStatusChange(student.studentId, 'excused')}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    student.status === 'excused' && styles.statusButtonTextActive,
                  ]}
                >
                  Excusé
                </Text>
              </TouchableOpacity>
            </View>

            {student.status === 'excused' && (
              <TextInput
                style={styles.justificationInput}
                placeholder="Justification..."
                value={student.justification}
                onChangeText={(text) => handleJustificationChange(student.studentId, text)}
                multiline
              />
            )}

            <TextInput
              style={styles.commentInput}
              placeholder="Commentaire (optionnel)..."
              value={student.comment || ''}
              onChangeText={(text) => handleCommentChange(student.studentId, text)}
              multiline
            />
          </View>
        ))}
      </ScrollView>

      {/* Notes globales */}
      <View style={styles.notesSection}>
        <Text style={styles.notesLabel}>Notes (optionnel)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Remarques sur la session..."
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </View>

      {/* Boutons d'action */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonDraft]}
          onPress={handleSaveDraft}
          disabled={isSubmitting}
        >
          <Text style={styles.actionButtonTextDraft}>Enregistrer brouillon</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSubmit]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.actionButtonTextSubmit}>Soumettre</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 40,
  },
  sessionHeader: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sessionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  sessionDate: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statText: {
    fontSize: 12,
    color: '#374151',
  },
  studentsList: {
    flex: 1,
    padding: 16,
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  studentInfo: {
    marginBottom: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  statusButtonPresent: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
  },
  statusButtonAbsent: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  statusButtonLate: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  statusButtonExcused: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  statusButtonTextActive: {
    color: '#111827',
  },
  justificationInput: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  commentInput: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 14,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  notesSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  notesInput: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonDraft: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  actionButtonSubmit: {
    backgroundColor: '#3b82f6',
  },
  actionButtonTextDraft: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  actionButtonTextSubmit: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
