import React from "react";
import { View, Text, StyleSheet, ScrollView, Platform } from "react-native";
import { MobileCard } from "@novaconnect/ui";
import type { TeacherHoursBreakdown } from "@core/schemas/payroll";

interface HoursBreakdownTableProps {
  breakdown: TeacherHoursBreakdown[];
}

export const HoursBreakdownTable: React.FC<HoursBreakdownTableProps> = ({ breakdown }) => {
  if (!breakdown || breakdown.length === 0) {
    return (
      <MobileCard title="Détail des heures">
        <Text style={styles.emptyText}>Aucune donnée de breakdown disponible</Text>
      </MobileCard>
    );
  }

  const totalHours = breakdown.reduce((sum, item) => sum + item.totalHours, 0);
  const totalSessions = breakdown.reduce((sum, item) => sum + item.sessionsCount, 0);
  const totalAmount = breakdown.reduce((sum, item) => sum + item.amount, 0);

  return (
    <MobileCard title="Détail des heures par classe et matière">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, styles.cellClass]}>Classe</Text>
            <Text style={[styles.headerCell, styles.cellSubject]}>Matière</Text>
            <Text style={[styles.headerCell, styles.cellPeriod]}>Période</Text>
            <Text style={[styles.headerCell, styles.cellHours]}>Heures</Text>
            <Text style={[styles.headerCell, styles.cellSessions]}>Séances</Text>
            <Text style={[styles.headerCell, styles.cellRate]}>Taux</Text>
            <Text style={[styles.headerCell, styles.cellAmount]}>Montant</Text>
          </View>

          {/* Rows */}
          {breakdown.map((item, index) => (
            <View key={index} style={[styles.row, index % 2 === 0 && styles.rowEven]}>
              <Text style={[styles.cell, styles.cellClass]}>{item.className}</Text>
              <Text style={[styles.cell, styles.cellSubject]}>{item.subjectName}</Text>
              <Text style={[styles.cell, styles.cellPeriod]}>{item.periodName}</Text>
              <Text style={[styles.cell, styles.cellHours, styles.monospace]}>
                {item.totalHours.toFixed(2)}h
              </Text>
              <Text style={[styles.cell, styles.cellSessions]}>{item.sessionsCount}</Text>
              <Text style={[styles.cell, styles.cellRate, styles.monospace]}>
                {item.hourlyRate.toLocaleString("fr-FR")}
              </Text>
              <Text style={[styles.cell, styles.cellAmount, styles.monospace, styles.amountCell]}>
                {item.amount.toLocaleString("fr-FR")}
              </Text>
            </View>
          ))}

          {/* Total Row */}
          <View style={styles.totalRow}>
            <Text style={[styles.totalCell, styles.cellClass]}>TOTAL</Text>
            <Text style={[styles.totalCell, styles.cellSubject]}></Text>
            <Text style={[styles.totalCell, styles.cellPeriod]}></Text>
            <Text style={[styles.totalCell, styles.cellHours, styles.monospace]}>
              {totalHours.toFixed(2)}h
            </Text>
            <Text style={[styles.totalCell, styles.cellSessions]}>{totalSessions}</Text>
            <Text style={[styles.totalCell, styles.cellRate]}></Text>
            <Text style={[styles.totalCell, styles.cellAmount, styles.monospace, styles.totalAmount]}>
              {totalAmount.toLocaleString("fr-FR")}
            </Text>
          </View>
        </View>
      </ScrollView>
    </MobileCard>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 2,
    borderBottomColor: "#e5e7eb",
  },
  headerCell: {
    padding: 12,
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  rowEven: {
    backgroundColor: "#fafafa",
  },
  cell: {
    padding: 12,
    fontSize: 13,
    color: "#111827",
    textAlign: "center",
  },
  cellClass: {
    width: 80,
    textAlign: "left",
  },
  cellSubject: {
    width: 100,
    textAlign: "left",
  },
  cellPeriod: {
    width: 100,
    textAlign: "left",
  },
  cellHours: {
    width: 70,
  },
  cellSessions: {
    width: 60,
  },
  cellRate: {
    width: 80,
  },
  cellAmount: {
    width: 90,
  },
  monospace: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  amountCell: {
    fontWeight: "600",
  },
  totalRow: {
    flexDirection: "row",
    backgroundColor: "#e5e7eb",
    borderTopWidth: 2,
    borderTopColor: "#d1d5db",
  },
  totalCell: {
    padding: 12,
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  totalAmount: {
    color: "#2563eb",
  },
  emptyText: {
    textAlign: "center",
    color: "#6b7280",
    paddingVertical: 24,
  },
});
