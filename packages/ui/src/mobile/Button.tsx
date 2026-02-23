import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";

export interface MobileButtonProps extends PressableProps {
  variant?: "default" | "destructive" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  title: string;
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    padding: 12,
  },
  text: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  default: {
    backgroundColor: "#2563eb",
  },
  destructive: {
    backgroundColor: "#dc2626",
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  secondary: {
    backgroundColor: "#e5e7eb",
  },
  disabled: {
    opacity: 0.5,
  },
  outlineText: {
    color: "#000000",
  },
  secondaryText: {
    color: "#000000",
  },
  sm: {
    padding: 8,
    paddingHorizontal: 12,
  },
  lg: {
    padding: 16,
    paddingHorizontal: 24,
  },
  smText: {
    fontSize: 14,
  },
  lgText: {
    fontSize: 18,
  },
});

export const MobileButton = React.forwardRef<React.ComponentRef<typeof Pressable>, MobileButtonProps>(
  ({ variant = "default", size = "default", title, style, disabled, ...props }, ref) => {
    const buttonStyle: ViewStyle[] = [
      styles.button,
      styles[variant],
      size !== "default" && styles[size],
      disabled && styles.disabled,
      style,
    ].filter(Boolean) as ViewStyle[];

    const textStyle: TextStyle[] = [
      styles.text,
      (variant === "outline" || variant === "secondary") && styles.outlineText,
      size !== "default" && styles[`${size}Text`],
    ].filter(Boolean) as TextStyle[];

    return (
      <Pressable
        ref={ref}
        style={buttonStyle}
        disabled={disabled}
        android_ripple={{ color: "rgba(255, 255, 255, 0.3)" }}
        {...props}
      >
        <Text style={textStyle}>{title}</Text>
      </Pressable>
    );
  }
);

MobileButton.displayName = "MobileButton";
