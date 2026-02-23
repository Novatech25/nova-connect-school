import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AttendanceStatusBadge } from './AttendanceStatusBadge';

interface AttendanceSessionCardProps {
  session: any; // Planned session with attendance session
  attendanceSession?: any; // Attendance session if exists
  onPress?: () => void;
}

export function AttendanceSessionCard({ session, attendanceSession, onPress }: AttendanceSessionCardProps) {
  const status = attendanceSession?.status || 'draft';
  const hasAttendance = !!attendanceSession;

  // Calculer les stats si les records existent
  const stats = attendanceSession?.stats || {
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
  };

  const formatTime = (time: string) => {
    return time; // Supposons que le format est déjà HH:mm
  };

  const getStatusText = () => {
    if (!hasAttendance) {
      return 'À faire';
    }
    switch (status) {
      case 'draft':
        return 'En cours';
      case 'submitted':
        return 'Soumis';
      case 'validated':
        return 'Validé';
      default:
        return 'Inconnu';
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, !hasAttendance && styles.cardTodo]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.cardHeader}>
        <View style={styles.timeContainer}>
          <Text style={styles.startTime}>{formatTime(session.startTime)}</Text>
          <Text style={styles.endTime}>{formatTime(session.endTime)}</Text>
        </View>

        <AttendanceStatusBadge status={status} size="small" />
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.subject}>{session.subjectName || 'Matière inconnue'}</Text>
        <Text style={styles.class}>
          {session.class?.name || session.className || 'Classe inconnue'}
        </Text>

        {session.roomName && (
          <Text style={styles.room}>Salle {session.roomName}</Text>
        )}
      </View>

      {hasAttendance && stats.total > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.statText}>
              {stats.present}/{stats.total}
            </Text>
          </View>

          {stats.absent > 0 && (
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.statText}>{stats.absent}</Text>
            </View>
          )}

          {stats.late > 0 && (
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.statText}>{stats.late}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.statusText}>{getStatusText()}</Text>
        <Text style={styles.arrow}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTodo: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeContainer: {
    flex: 1,
  },
  startTime: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  endTime: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  cardBody: {
    marginBottom: 12,
  },
  subject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  class: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  room: {
    fontSize: 12,
    color: '#9ca3af',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  arrow: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9ca3af',
  },
});
