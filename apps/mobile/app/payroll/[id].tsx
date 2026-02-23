import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePayrollEntry, useTeacherHoursBreakdown, useAuth } from "@novaconnect/data";
import { MobileCard, MobileButton } from "@novaconnect/ui";
import { HoursBreakdownTable } from "../../components/payroll/HoursBreakdownTable";
import { supabase } from "@novaconnect/data";
import * as Linking from "expo-linking";

const statusConfig = {
  draft: {
    label: "Brouillon",
    color: "#6b7280",
    backgroundColor: "#f3f4f6",
    iconName: "time-outline" as const,
  },
  pending_payment: {
    label: "En attente de paiement",
    color: "#d97706",
    backgroundColor: "#fef3c7",
    iconName: "time-outline" as const,
  },
  paid: {
    label: "Payé",
    color: "#059669",
    backgroundColor: "#d1fae5",
    iconName: "checkmark-circle" as const,
  },
  cancelled: {
    label: "Annulé",
    color: "#dc2626",
    backgroundColor: "#fee2e2",
    iconName: "close-circle" as const,
  },
};

export default function PayrollDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const { data: entry, isLoading } = usePayrollEntry(id);
  const { data: breakdown } = useTeacherHoursBreakdown(user?.id || "", entry?.payrollPeriodId);

  const handleDownloadPDF = async () => {
    if (!entry) return;

    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-payroll-slip`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ payrollEntryId: entry.id }),
        }
      );

      const result = await response.json();

      if (result.success && result.signedUrl) {
        await Linking.openURL(result.signedUrl);
      } else {
        Alert.alert("Erreur", result.message || "Impossible de télécharger la fiche de paie");
      }
    } catch (error) {
      console.error("Error downloading slip:", error);
      Alert.alert("Erreur", "Une erreur est survenue lors du téléchargement");
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Fiche de paie non trouvée</Text>
      </View>
    );
  }

  const config = statusConfig[entry.status];

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: entry.payrollPeriod?.periodName || "Détail de la paie",
          headerBackTitle: "Retour",
        }}
      />

      <View style={styles.content}>
        {/* Header Card */}
        <MobileCard style={styles.headerCard}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.periodName}>{entry.payrollPeriod?.periodName}</Text>
              <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
                <Ionicons name={config.iconName} size={16} color={config.color} />
                <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
              </View>
            </View>
          </View>
        </MobileCard>

        {/* Main Info Card */}
        <MobileCard title="Informations principales" style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Heures validées</Text>
            <Text style={styles.infoValue}>{entry.validatedHours.toFixed(2)}h</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Taux horaire</Text>
            <Text style={styles.infoValue}>{entry.hourlyRate.toLocaleString("fr-FR")} FCFA</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Montant brut</Text>
            <Text style={styles.infoValue}>{entry.grossAmount.toLocaleString("fr-FR")} FCFA</Text>
          </View>
          <View style={[styles.infoRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Net à payer</Text>
            <Text style={styles.totalAmount}>{entry.netAmount.toLocaleString("fr-FR")} FCFA</Text>
          </View>
        </MobileCard>

        {/* Adjustments Card */}
        {entry.salaryComponents && entry.salaryComponents.length > 0 && (
          <MobileCard title="Détail des ajustements" style={styles.card}>
            {entry.salaryComponents.map((comp) => (
              <View key={comp.id} style={styles.adjustmentRow}>
                <Text style={styles.adjustmentLabel}>{comp.label}</Text>
                <Text style={[styles.adjustmentValue, comp.amount > 0 ? styles.adjustmentPositive : styles.adjustmentNegative]}>
                  {comp.amount > 0 ? "+" : ""}{comp.amount.toLocaleString("fr-FR")} FCFA
                </Text>
              </View>
            ))}
          </MobileCard>
        )}

        {/* Breakdown Table */}
        {breakdown && breakdown.length > 0 && (
          <HoursBreakdownTable breakdown={breakdown} />
        )}

        {/* Payment History */}
        {entry.payments && entry.payments.length > 0 && (
          <MobileCard title="Historique des paiements" style={styles.card}>
            {entry.payments.map((payment) => (
              <View key={payment.id} style={styles.paymentRow}>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentDate}>
                    {new Date(payment.paymentDate).toLocaleDateString("fr-FR")}
                  </Text>
                  <Text style={styles.paymentMethod}>
                    {payment.paymentMethod === "cash" ? "Espèces" :
                     payment.paymentMethod === "bank_transfer" ? "Virement bancaire" :
                     payment.paymentMethod === "check" ? "Chèque" :
                     payment.paymentMethod === "mobile_money" ? "Mobile Money" :
                     payment.paymentMethod}
                  </Text>
                </View>
                <Text style={styles.paymentAmount}>{payment.amount.toLocaleString("fr-FR")} FCFA</Text>
              </View>
            ))}
          </MobileCard>
        )}

        {/* Download Button */}
        <MobileButton
          title={downloading ? "Téléchargement..." : "Télécharger la fiche PDF"}
          onPress={handleDownloadPDF}
          disabled={downloading}
          style={styles.downloadButton}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  errorText: {
    fontSize: 16,
    color: "#dc2626",
  },
  content: {
    padding: 16,
  },
  headerCard: {
    backgroundColor: "#f9fafb",
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  periodName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#111827",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  card: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  infoLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
  },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: "#e5e7eb",
    borderBottomWidth: 0,
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2563eb",
  },
  adjustmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  adjustmentLabel: {
    fontSize: 14,
    color: "#374151",
  },
  adjustmentValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  adjustmentPositive: {
    color: "#059669",
  },
  adjustmentNegative: {
    color: "#dc2626",
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  paymentInfo: {
    flex: 1,
  },
  paymentDate: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  paymentMethod: {
    fontSize: 14,
    color: "#6b7280",
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#059669",
  },
  downloadButton: {
    marginTop: 8,
    marginBottom: 24,
  },
});
