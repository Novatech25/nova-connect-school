import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useState } from "react";
import { useAuth, useScheduleSlotsByClass, useUpcomingSessions } from "@novaconnect/data";
import { usePushNotifications } from "../../hooks/usePushNotifications";

export default function ScheduleStudentPage() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>("monday");

  // Configurer les push notifications
  usePushNotifications(user?.id);

  // Récupérer la classe de l'élève (via enrollment)
  // TODO: Ajouter un hook useStudentEnrollment pour récupérer la classe actuelle
  const classId = "class-uuid"; // À remplacer par la vraie classe

  // Récupérer l'EDT de la classe
  const { data: slots, isLoading, refetch } = useScheduleSlotsByClass(classId);
  const { data: upcomingSessions } = useUpcomingSessions(classId, "class", 5);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Grouper les créneaux par jour
  const slotsByDay = slots?.reduce((acc, slot) => {
    if (!acc[slot.dayOfWeek]) acc[slot.dayOfWeek] = [];
    acc[slot.dayOfWeek].push(slot);
    return acc;
  }, {} as Record<string, typeof slots>);

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Chargement de l'emploi du temps...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Emploi du Temps</Text>
        <Text style={styles.subtitle}>
          {slots?.length || 0} cours cette semaine
        </Text>
      </View>

      {/* Prochains cours */}
      {upcomingSessions && upcomingSessions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prochains cours</Text>
          {upcomingSessions.map((session) => (
            <View key={session.id} style={styles.sessionCard}>
              <Text style={styles.sessionDate}>
                {new Date(session.sessionDate).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </Text>
              <Text style={styles.sessionTime}>
                {session.startTime} - {session.endTime}
              </Text>
              <Text style={styles.sessionSubject}>{session.subject?.name}</Text>
              <Text style={styles.sessionTeacher}>
                Prof. {session.teacher?.firstName} {session.teacher?.lastName}
              </Text>
              {session.room && <Text style={styles.sessionRoom}>Salle {session.room.name}</Text>}
            </View>
          ))}
        </View>
      )}

      {/* Sélecteur de jour */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daySelector}>
        {days.map((day) => (
          <TouchableOpacity
            key={day}
            style={[styles.dayButton, selectedDay === day && styles.dayButtonActive]}
            onPress={() => setSelectedDay(day)}
          >
            <Text style={[styles.dayButtonText, selectedDay === day && styles.dayButtonTextActive]}>
              {day.substring(0, 3).toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Créneaux du jour sélectionné */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)}
        </Text>
        {slotsByDay?.[selectedDay]?.length > 0 ? (
          slotsByDay[selectedDay]
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map((slot) => (
              <View key={slot.id} style={styles.slotCard}>
                <View style={styles.slotTime}>
                  <Text style={styles.slotTimeText}>{slot.startTime}</Text>
                  <Text style={styles.slotTimeSeparator}>-</Text>
                  <Text style={styles.slotTimeText}>{slot.endTime}</Text>
                </View>
                <View style={styles.slotDetails}>
                  <Text style={styles.slotSubject}>{slot.subject?.name}</Text>
                  <Text style={styles.slotTeacher}>
                    {slot.teacher?.firstName} {slot.teacher?.lastName}
                  </Text>
                  {slot.room && <Text style={styles.slotRoom}>Salle {slot.room.name}</Text>}
                </View>
              </View>
            ))
        ) : (
          <Text style={styles.emptyText}>Aucun cours ce jour</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    padding: 20,
    backgroundColor: "#3b82f6",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 14,
    color: "#e0e7ff",
    marginTop: 4,
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 40,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  sessionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sessionDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3b82f6",
    marginBottom: 4,
  },
  sessionTime: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  sessionSubject: {
    fontSize: 14,
    color: "#374151",
  },
  sessionTeacher: {
    fontSize: 14,
    color: "#6b7280",
  },
  sessionRoom: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  daySelector: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  dayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#ffffff",
  },
  dayButtonActive: {
    backgroundColor: "#3b82f6",
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  dayButtonTextActive: {
    color: "#ffffff",
  },
  slotCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  slotTime: {
    alignItems: "center",
    marginRight: 16,
    paddingRight: 16,
    borderRightWidth: 2,
    borderRightColor: "#e5e7eb",
  },
  slotTimeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  slotTimeSeparator: {
    fontSize: 12,
    color: "#9ca3af",
    marginVertical: 2,
  },
  slotDetails: {
    flex: 1,
  },
  slotSubject: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  slotTeacher: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 2,
  },
  slotRoom: {
    fontSize: 12,
    color: "#6b7280",
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 20,
  },
});
