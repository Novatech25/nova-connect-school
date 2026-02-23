import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, usePayrollEntriesByTeacher, useTeacherCurrentMonthEstimate } from "@novaconnect/data";
import { MobileCard, MobileButton } from "@novaconnect/ui";
import { PayrollEntryCard } from "../../components/payroll/PayrollEntryCard";

export default function PayrollPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const { data: entries, isLoading, refetch } = usePayrollEntriesByTeacher(user?.id || "", { status: filter });
  const { data: currentMonthEstimate } = useTeacherCurrentMonthEstimate(user?.id || "");

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Calculate totals
  const totals = entries?.reduce(
    (acc, entry) => ({
      hours: acc.hours + (entry.validatedHours || 0),
      gross: acc.gross + (entry.grossAmount || 0),
      net: acc.net + (entry.netAmount || 0),
      paid: acc.paid + (entry.status === "paid" ? entry.netAmount || 0 : 0),
      pending: acc.pending + (entry.status === "draft" || entry.status === "pending_payment" ? entry.netAmount || 0 : 0),
    }),
    { hours: 0, gross: 0, net: 0, paid: 0, pending: 0 }
  ) || { hours: 0, gross: 0, net: 0, paid: 0, pending: 0 };

  const filteredEntries = filter
    ? entries?.filter((entry) => entry.status === filter)
    : entries;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Ma Paie</Text>
        <Text style={styles.subtitle}>Consultez vos fiches de paie et historique des paiements</Text>

        {/* Current Month Estimate */}
        {currentMonthEstimate && currentMonthEstimate.currentMonthHours > 0 && (
          <MobileCard style={styles.estimateCard}>
            <View style={styles.estimateHeader}>
              <View style={styles.estimateTitleRow}>
                <Ionicons name="trending-up" size={20} color="#2563eb" />
                <Text style={styles.estimateTitle}>Paie en cours (estimation)</Text>
              </View>
              <View style={styles.estimateBadge}>
                <Text style={styles.estimateBadgeText}>Estimation</Text>
              </View>
            </View>
            <View style={styles.estimateGrid}>
              <View style={styles.estimateItem}>
                <Text style={styles.estimateLabel}>Heures validées</Text>
                <Text style={styles.estimateValue}>{currentMonthEstimate.currentMonthHours.toFixed(2)}h</Text>
              </View>
              <View style={styles.estimateItem}>
                <Text style={styles.estimateLabel}>Montant estimé</Text>
                <Text style={styles.estimateValueAmount}>
                  {currentMonthEstimate.estimatedAmount.toLocaleString("fr-FR")} FCFA
                </Text>
              </View>
              <View style={styles.estimateItem}>
                <Text style={styles.estimateLabel}>Séances validées</Text>
                <Text style={styles.estimateValue}>{currentMonthEstimate.validatedSessionsCount}</Text>
              </View>
            </View>
          </MobileCard>
        )}

        {/* Stats Overview */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={24} color="#6b7280" />
            <Text style={styles.statLabel}>Heures Total</Text>
            <Text style={styles.statValue}>{totals.hours.toFixed(2)}h</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={24} color="#6b7280" />
            <Text style={styles.statLabel}>Montant Brut</Text>
            <Text style={styles.statValue}>{totals.gross.toLocaleString("fr-FR")}</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={24} color="#059669" />
            <Text style={styles.statLabel}>Payé</Text>
            <Text style={[styles.statValue, styles.statValueGreen]}>
              {totals.paid.toLocaleString("fr-FR")} FCFA
            </Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={24} color="#d97706" />
            <Text style={styles.statLabel}>En attente</Text>
            <Text style={[styles.statValue, styles.statValueYellow]}>
              {totals.pending.toLocaleString("fr-FR")} FCFA
            </Text>
          </View>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <MobileButton
            title="Toutes"
            variant={filter === undefined ? "default" : "outline"}
            size="sm"
            style={[styles.filterButton, filter === undefined && styles.filterButtonActive]}
            onPress={() => setFilter(undefined)}
          />
          <MobileButton
            title="Payées"
            variant={filter === "paid" ? "default" : "outline"}
            size="sm"
            style={[styles.filterButton, filter === "paid" && styles.filterButtonActive]}
            onPress={() => setFilter("paid")}
          />
          <MobileButton
            title="En attente"
            variant={filter === "pending_payment" ? "default" : "outline"}
            size="sm"
            style={[styles.filterButton, filter === "pending_payment" && styles.filterButtonActive]}
            onPress={() => setFilter("pending_payment")}
          />
        </View>

        {/* Entries List */}
        <Text style={styles.sectionTitle}>Historique des paiements</Text>
        {filteredEntries && filteredEntries.length > 0 ? (
          filteredEntries.map((entry) => (
            <PayrollEntryCard
              key={entry.id}
              periodName={entry.payrollPeriod?.periodName || "Période inconnue"}
              startDate={entry.payrollPeriod?.startDate || ""}
              endDate={entry.payrollPeriod?.endDate || ""}
              status={entry.status}
              validatedHours={entry.validatedHours}
              netAmount={entry.netAmount}
              onPress={() => router.push(`/payroll/${entry.id}`)}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyStateTitle}>Aucune fiche de paie</Text>
            <Text style={styles.emptyStateText}>
              Vous n'avez pas encore de fiches de paie disponibles
            </Text>
          </View>
        )}
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
  content: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 24,
  },
  estimateCard: {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
    marginBottom: 20,
  },
  estimateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  estimateTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  estimateTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e40af",
  },
  estimateBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  estimateBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1e40af",
  },
  estimateGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  estimateItem: {
    flex: 1,
  },
  estimateLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  estimateValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  estimateValueAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2563eb",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  statValueGreen: {
    color: "#059669",
  },
  statValueYellow: {
    color: "#d97706",
  },
  filterContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  filterButton: {
    flex: 1,
  },
  filterButtonActive: {
    backgroundColor: "#2563eb",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#111827",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
    color: "#111827",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
});
