import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth, useTodayAttendanceSessions } from '@novaconnect/data';
import { AttendanceSessionCard } from '../../components/attendance/AttendanceSessionCard';
import type { AttendanceSession } from '@core/schemas/attendance';

export default function AttendancePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Récupérer les sessions de présence du jour
  const { data: sessions, isLoading, refetch } = useTodayAttendanceSessions(user?.id || '');

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Filtrer pour n'afficher que les planned_sessions avec leur attendance_session
  const todaySessions = sessions?.filter((session: any) => session) || [];

  // Compter les sessions par statut
  const stats = {
    total: todaySessions.length,
    draft: todaySessions.filter((s: any) => s.attendance_session?.status === 'draft' || !s.attendance_session).length,
    submitted: todaySessions.filter((s: any) => s.attendance_session?.status === 'submitted').length,
    validated: todaySessions.filter((s: any) => s.attendance_session?.status === 'validated').length,
  };

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const handleSessionPress = (session: any) => {
    // Naviguer vers l'écran de prise de présence
    router.push(`/attendance/${session.id}` as any);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Chargement de la présence...</Text>
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
        <Text style={styles.subtitle}>{today}</Text>
        <Text style={styles.stats}>
          {stats.total} session{stats.total > 1 ? 's' : ''} • {stats.draft} à faire
        </Text>
      </View>

      {/* Liste des sessions du jour */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sessions du jour</Text>

        {todaySessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Aucune session prévue pour aujourd'hui
            </Text>
          </View>
        ) : (
          todaySessions.map((session: any) => {
            const attendanceSession = session.attendance_session;
            const status = attendanceSession?.status || 'draft';

            return (
              <AttendanceSessionCard
                key={session.id}
                session={session}
                attendanceSession={attendanceSession}
                onPress={() => handleSessionPress(session)}
              />
            );
          })
        )}
      </View>

      {/* Statistiques rapides */}
      {(stats.submitted > 0 || stats.validated > 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Résumé</Text>
          <View style={styles.statsContainer}>
            {stats.draft > 0 && (
              <View style={styles.statItem}>
                <View style={[styles.statIndicator, { backgroundColor: '#f59e0b' }]} />
                <Text style={styles.statLabel}>À faire: {stats.draft}</Text>
              </View>
            )}
            {stats.submitted > 0 && (
              <View style={styles.statItem}>
                <View style={[styles.statIndicator, { backgroundColor: '#3b82f6' }]} />
                <Text style={styles.statLabel}>Soumises: {stats.submitted}</Text>
              </View>
            )}
            {stats.validated > 0 && (
              <View style={styles.statItem}>
                <View style={[styles.statIndicator, { backgroundColor: '#10b981' }]} />
                <Text style={styles.statLabel}>Validées: {stats.validated}</Text>
              </View>
            )}
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
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  stats: {
    fontSize: 14,
    color: '#3b82f6',
    marginTop: 8,
    fontWeight: '600',
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
  statsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statLabel: {
    fontSize: 14,
    color: '#374151',
  },
});
