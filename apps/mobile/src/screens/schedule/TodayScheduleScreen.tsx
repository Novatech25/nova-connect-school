import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MapPin, Clock, Users, ChevronRight } from 'lucide-react-native';
import { useTeacherRoomAssignments, useStudentRoomAssignments } from '@novaconnect/data';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Badge, Button } from '../../components/ui';

interface TodayScheduleScreenProps {
  navigation: any;
}

export function TodayScheduleScreen({ navigation }: TodayScheduleScreenProps) {
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Fetch assignments based on user role
  const { data: assignments, isLoading, refetch } = user?.role === 'teacher'
    ? useTeacherRoomAssignments(user.id, today)
    : useStudentRoomAssignments(user.id, today);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Chargement de l'emploi du temps...</Text>
      </View>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <MapPin size={48} color="#9ca3af" />
        <Text style={styles.emptyText}>Aucun cours aujourd'hui</Text>
        <Text style={styles.emptySubtext}>Profitez de votre journée!</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes cours aujourd'hui</Text>
        <Text style={styles.headerDate}>
          {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
        </Text>
      </View>

      <View style={styles.scheduleList}>
        {assignments.map((assignment) => (
          <ScheduleCard
            key={assignment.id}
            assignment={assignment}
            onPress={() =>
              navigation.navigate('RoomDetails', {
                roomId: assignment.assigned_room_id,
                roomName: assignment.assigned_room?.name,
              })
            }
          />
        ))}
      </View>
    </ScrollView>
  );
}

interface ScheduleCardProps {
  assignment: any;
  onPress: () => void;
}

function ScheduleCard({ assignment, onPress }: ScheduleCardProps) {
  const room = assignment.assigned_room;
  const subject = assignment.subject;
  const teacher = assignment.teacher;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'optimal':
        return '#10b981'; // green
      case 'sufficient':
        return '#3b82f6'; // blue
      case 'insufficient':
        return '#f59e0b'; // amber
      default:
        return '#6b7280';
    }
  };

  const isPast = new Date(`${assignment.session_date}T${assignment.end_time}`) < new Date();

  return (
    <TouchableOpacity
      style={[styles.card, isPast && styles.cardPast]}
      onPress={onPress}
      disabled={isPast}
    >
      <View style={styles.cardHeader}>
        <View style={styles.timeContainer}>
          <Clock size={16} color="#6b7280" />
          <Text style={styles.timeText}>
            {assignment.start_time} - {assignment.end_time}
          </Text>
        </View>
        {!isPast && (
          <Badge
            style={{
              backgroundColor: getStatusColor(assignment.capacity_status) + '20',
              color: getStatusColor(assignment.capacity_status),
            }}
          >
            {assignment.capacity_status === 'optimal' && '✓'}
            {assignment.capacity_status === 'sufficient' && '○'}
            {assignment.capacity_status === 'insufficient' && '!'}
          </Badge>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.subjectSection}>
          <Text style={styles.subjectName}>{subject?.name}</Text>
          {teacher && (
            <Text style={styles.teacherName}>
              {teacher.first_name} {teacher.last_name}
            </Text>
          )}
        </View>

        {room && (
          <View style={styles.roomSection}>
            <View style={styles.roomInfo}>
              <MapPin size={20} color="#3b82f6" />
              <View style={styles.roomDetails}>
                <Text style={styles.roomName}>{room.name}</Text>
                {room.code && <Text style={styles.roomCode}>{room.code}</Text>}
              </View>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </View>
        )}

        {assignment.capacity_status === 'insufficient' && !isPast && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              Capacité limite ({assignment.total_students} élèves)
            </Text>
          </View>
        )}
      </View>

      {!isPast && (
        <View style={styles.cardFooter}>
          <Text style={styles.studentsCount}>
            <Users size={14} color="#6b7280" /> {assignment.total_students} élèves
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  header: {
    padding: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  headerDate: {
    marginTop: 4,
    fontSize: 14,
    color: '#6b7280',
  },
  scheduleList: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardPast: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  cardBody: {
    padding: 16,
  },
  subjectSection: {
    marginBottom: 12,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  teacherName: {
    fontSize: 14,
    color: '#6b7280',
  },
  roomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
  },
  roomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roomDetails: {
    flex: 1,
  },
  roomName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 2,
  },
  roomCode: {
    fontSize: 12,
    color: '#3b82f6',
  },
  warningBanner: {
    marginTop: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
  },
  warningText: {
    fontSize: 13,
    color: '#92400e',
    textAlign: 'center',
  },
  cardFooter: {
    padding: 16,
    paddingTop: 0,
  },
  studentsCount: {
    fontSize: 12,
    color: '#6b7280',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

export default TodayScheduleScreen;
