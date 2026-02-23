import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { useAuth, useStudentAttendance } from '@novaconnect/data';
import { AttendanceStatusBadge } from '../../components/attendance/AttendanceStatusBadge';
import { useChildren } from '../../hooks/useChildren';

export default function ParentAttendancePage() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Récupérer les enfants du parent
  const { data: children, isLoading: childrenLoading } = useChildren();

  // Sélectionner le premier enfant par défaut
  useEffect(() => {
    if (children && children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children]);

  // Calculer les dates de début et de fin du mois
  const startDate = selectedMonth ? `${selectedMonth}-01` : undefined;
  const endDate = selectedMonth
    ? `${selectedMonth}-${new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) + 1, 0).getDate()}`
    : undefined;

  // Récupérer l'historique de présence de l'enfant
  const { data: attendanceRecords, isLoading, refetch } = useStudentAttendance(
    selectedChildId,
    startDate,
    endDate
  );

  const selectedChild = children?.find((c) => c.id === selectedChildId);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Calculer les statistiques du mois
  const stats = {
    total: attendanceRecords?.length || 0,
    present: attendanceRecords?.filter((r) => r.status === 'present').length || 0,
    absent: attendanceRecords?.filter((r) => r.status === 'absent').length || 0,
    late: attendanceRecords?.filter((r) => r.status === 'late').length || 0,
    excused: attendanceRecords?.filter((r) => r.status === 'excused').length || 0,
  };

  const attendanceRate = stats.total > 0
    ? Math.round(((stats.present + stats.excused) / stats.total) * 100)
    : 0;

  // Filtrer les absences et retards
  const absencesAndLates = attendanceRecords?.filter(
    (r) => r.status === 'absent' || r.status === 'late'
  ) || [];

  // Grouper par date pour le calendrier
  const getDaysInMonth = () => {
    if (!selectedMonth) return [];
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  const getDayStatus = (day: number) => {
    const date = `${selectedMonth}-${String(day).padStart(2, '0')}`;
    const dayRecords = attendanceRecords?.filter((r) =>
      r.markedAt.startsWith(date)
    );

    if (!dayRecords || dayRecords.length === 0) return null;

    const hasAbsence = dayRecords.some((r) => r.status === 'absent');
    const hasLate = dayRecords.some((r) => r.status === 'late');
    const hasExcused = dayRecords.some((r) => r.status === 'excused');
    const allPresent = dayRecords.every((r) => r.status === 'present');

    if (hasAbsence) return 'absent';
    if (hasLate) return 'late';
    if (hasExcused) return 'excused';
    if (allPresent) return 'present';
    return 'mixed';
  };

  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      value: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    });
  }

  if (childrenLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Présence</Text>

        {/* Sélecteur d'enfant */}
        {children && children.length > 1 && (
          <View style={styles.childSelector}>
            {children.map((child) => (
              <TouchableOpacity
                key={child.id}
                style={[
                  styles.childButton,
                  selectedChildId === child.id && styles.childButtonActive,
                ]}
                onPress={() => setSelectedChildId(child.id)}
              >
                <Text
                  style={[
                    styles.childButtonText,
                    selectedChildId === child.id && styles.childButtonTextActive,
                  ]}
                >
                  {child.firstName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Sélecteur de mois */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.monthSelector}
        >
          {months.map((month) => (
            <TouchableOpacity
              key={month.value}
              style={[
                styles.monthButton,
                selectedMonth === month.value && styles.monthButtonActive,
              ]}
              onPress={() => setSelectedMonth(month.value)}
            >
              <Text
                style={[
                  styles.monthButtonText,
                  selectedMonth === month.value && styles.monthButtonTextActive,
                ]}
              >
                {month.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Statistiques du mois */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistiques du mois</Text>
        <View style={styles.statsCard}>
          <View style={styles.attendanceRateContainer}>
            <Text style={styles.attendanceRateValue}>{attendanceRate}%</Text>
            <Text style={styles.attendanceRateLabel}>Taux de présence</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: '#10b981' }]} />
              <Text style={styles.statLabel}>Présents: {stats.present}</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.statLabel}>Absents: {stats.absent}</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.statLabel}>Retards: {stats.late}</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: '#3b82f6' }]} />
              <Text style={styles.statLabel}>Excusés: {stats.excused}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Calendrier du mois */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Calendrier</Text>
        <View style={styles.calendarGrid}>
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day) => (
            <View key={day} style={styles.calendarDayHeader}>
              <Text style={styles.calendarDayHeaderText}>{day}</Text>
            </View>
          ))}

          {getDaysInMonth().map((day) => {
            const status = getDayStatus(day);
            const dayOfWeek = new Date(
              parseInt(selectedMonth.split('-')[0]),
              parseInt(selectedMonth.split('-')[1]) - 1,
              day
            ).getDay();

            // Adjust for Monday-first week (0 = Monday, 6 = Sunday)
            const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

            return (
              <View
                key={day}
                style={[
                  styles.calendarDay,
                  status === 'absent' && styles.calendarDayAbsent,
                  status === 'late' && styles.calendarDayLate,
                  status === 'excused' && styles.calendarDayExcused,
                  status === 'present' && styles.calendarDayPresent,
                ]}
              >
                <Text style={styles.calendarDayText}>{day}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.calendarLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.legendText}>Présent</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.legendText}>Absent</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.legendText}>Retard</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
            <Text style={styles.legendText}>Excusé</Text>
          </View>
        </View>
      </View>

      {/* Liste des absences/retards */}
      {absencesAndLates.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Absences et retards</Text>
          {absencesAndLates.map((record) => {
            const session = record.attendanceSession as any;
            return (
              <View key={record.id} style={styles.incidentCard}>
                <View style={styles.incidentHeader}>
                  <Text style={styles.incidentDate}>
                    {new Date(record.markedAt).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </Text>
                  <AttendanceStatusBadge status={record.status} />
                </View>

                {session?.plannedSession && (
                  <Text style={styles.incidentSubject}>
                    {session.plannedSession.subjectName}
                  </Text>
                )}

                {record.justification && (
                  <View style={styles.justificationBox}>
                    <Text style={styles.justificationLabel}>Justification:</Text>
                    <Text style={styles.justificationText}>{record.justification}</Text>
                  </View>
                )}

                {record.comment && (
                  <Text style={styles.incidentComment}>{record.comment}</Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {absencesAndLates.length === 0 && stats.total > 0 && (
        <View style={styles.section}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Aucune absence ou retard ce mois-ci. Continue comme ça !
            </Text>
          </View>
        </View>
      )}

      {stats.total === 0 && (
        <View style={styles.section}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Aucune donnée de présence pour ce mois
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
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
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  childSelector: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  childButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  childButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  childButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  childButtonTextActive: {
    color: '#fff',
  },
  monthSelector: {
    marginTop: 16,
  },
  monthButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  monthButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  monthButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  monthButtonTextActive: {
    color: '#fff',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  attendanceRateContainer: {
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  attendanceRateValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#10b981',
  },
  attendanceRateLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '45%',
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#374151',
  },
  calendarGrid: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayHeader: {
    width: '14.28%',
    padding: 8,
    alignItems: 'center',
  },
  calendarDayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  calendarDayPresent: {
    backgroundColor: '#d1fae5',
  },
  calendarDayAbsent: {
    backgroundColor: '#fee2e2',
  },
  calendarDayLate: {
    backgroundColor: '#fef3c7',
  },
  calendarDayExcused: {
    backgroundColor: '#dbeafe',
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  calendarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#6b7280',
  },
  incidentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  incidentDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  incidentSubject: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
  },
  justificationBox: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  justificationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  justificationText: {
    fontSize: 14,
    color: '#78350f',
  },
  incidentComment: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});
