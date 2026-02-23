import React from "react";
import { View, Text, StyleSheet, type ViewProps } from "react-native";

export interface MobileCardProps extends ViewProps {
  title?: string;
  description?: string;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
    color: "#111827",
  },
  description: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
  },
});

export const MobileCard = React.forwardRef<View, MobileCardProps>(
  ({ title, description, children, style, ...props }, ref) => {
    return (
      <View ref={ref} style={[styles.card, style]} {...props}>
        {title && <Text style={styles.title}>{title}</Text>}
        {description && <Text style={styles.description}>{description}</Text>}
        {children}
      </View>
    );
  }
);

MobileCard.displayName = "MobileCard";
