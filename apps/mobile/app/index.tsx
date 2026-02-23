import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Link } from "expo-router";
import { usePWA } from "../src/hooks/usePWA";

export default function IndexPage() {
  // Only use PWA hook on web platform
  const isWeb = Platform.OS === 'web';
  const { isInstallable, isInstalled, installPWA } = usePWA();

  const showInstallButton = isWeb && isInstallable && !isInstalled;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to NovaConnectSchool</Text>
        <Text style={styles.subtitle}>
          School management system built with Expo
        </Text>

        <View style={styles.cardContainer}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mobile App</Text>
            <Text style={styles.cardText}>
              iOS and Android support
            </Text>
          </View>

          <View style={[styles.card, styles.cardDark]}>
            <Text style={[styles.cardTitle, styles.cardDarkTitle]}>Web App</Text>
            <Text style={[styles.cardText, styles.cardDarkText]}>
              Progressive Web App with offline support
            </Text>
          </View>
        </View>

        {showInstallButton && (
          <Pressable
            style={[styles.button, styles.installButton]}
            onPress={installPWA}
          >
            <Text style={styles.buttonText}>Installer l'application</Text>
          </Pressable>
        )}

        <Link href="/(tabs)" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Get Started</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
    color: "#111827",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 32,
  },
  cardContainer: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 32,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 140,
    alignItems: "center",
  },
  cardDark: {
    backgroundColor: "#1f2937",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    color: "#111827",
  },
  cardDarkTitle: {
    color: "#f9fafb",
  },
  cardText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  cardDarkText: {
    color: "#d1d5db",
  },
  button: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    minWidth: 200,
    alignItems: "center",
    marginBottom: 12,
  },
  installButton: {
    backgroundColor: "#10b981",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
