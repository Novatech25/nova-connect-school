import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MobileCard } from "@novaconnect/ui";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PayrollEntryCardProps {
  periodName: string;
  startDate: string;
  endDate: string;
  status: "draft" | "pending_payment" | "paid" | "cancelled";
  validatedHours: number;
  netAmount: number;
  onPress: () => void;
}

const statusConfig = {
  draft: {
    label: "Brouillon",
    color: "#6b7280",
    backgroundColor: "#f3f4f6",
    iconName: "time-outline" as const,
  },
  pending_payment: {
    label: "En attente",
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

export const PayrollEntryCard: React.FC<PayrollEntryCardProps> = ({
  periodName,
  startDate,
  endDate,
  status,
  validatedHours,
  netAmount,
  onPress,
}) => {
  const config = statusConfig[status];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <MobileCard style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <Text style={styles.periodName}>{periodName}</Text>
            <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
              <Ionicons name={config.iconName} size={14} color={config.color} />
              <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </View>

        <Text style={styles.dateText}>
          Du {format(new Date(startDate), "dd MMM yyyy", { locale: fr })} au{" "}
          {format(new Date(endDate), "dd MMM yyyy", { locale: fr })}
        </Text>

        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>Heures validées</Text>
            <Text style={styles.footerValue}>{validatedHours.toFixed(2)}h</Text>
          </View>
          <View style={[styles.footerItem, styles.footerItemRight]}>
            <Text style={styles.footerLabel}>Net à payer</Text>
            <Text style={styles.amount}>{netAmount.toLocaleString("fr-FR")} FCFA</Text>
          </View>
        </View>
      </MobileCard>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  periodName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 12,
  },
  footerItem: {
    flex: 1,
  },
  footerItemRight: {
    alignItems: "flex-end",
  },
  footerLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  footerValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  amount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2563eb",
  },
});
