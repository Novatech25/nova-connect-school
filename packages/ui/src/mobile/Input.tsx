import React from "react";
import { TextInput, StyleSheet, type TextInputProps, View, Text } from "react-native";

export interface MobileInputProps extends TextInputProps {
  label?: string;
  error?: string;
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
    color: "#374151",
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: "#ffffff",
  },
  error: {
    color: "#dc2626",
    fontSize: 12,
    marginTop: 4,
  },
  inputError: {
    borderColor: "#dc2626",
  },
});

export const MobileInput = React.forwardRef<TextInput, MobileInputProps>(
  ({ label, error, style, ...props }, ref) => {
    return (
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <TextInput
          ref={ref}
          style={[styles.input, error && styles.inputError, style]}
          placeholderTextColor="#9ca3af"
          {...props}
        />
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }
);

MobileInput.displayName = "MobileInput";
