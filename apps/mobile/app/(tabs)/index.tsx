import { View, Text, StyleSheet, ScrollView } from "react-native";

export default function HomePage() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Welcome back, Student!</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Classes</Text>
          <Text style={styles.cardText}>Mathematics - 9:00 AM</Text>
          <Text style={styles.cardText}>Physics - 10:30 AM</Text>
          <Text style={styles.cardText}>English - 1:00 PM</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Grades</Text>
          <Text style={styles.cardText}>Math Quiz: 92%</Text>
          <Text style={styles.cardText}>Physics Test: 88%</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#111827",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#111827",
  },
  cardText: {
    fontSize: 16,
    color: "#374151",
    marginBottom: 8,
  },
});
