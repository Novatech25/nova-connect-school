import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { AttendanceSessionStatus, AttendanceStatus } from '@core/schemas/attendance';

interface AttendanceStatusBadgeProps {
  status: AttendanceSessionStatus | AttendanceStatus;
  size?: 'small' | 'medium' | 'large';
}

export function AttendanceStatusBadge({ status, size = 'medium' }: AttendanceStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'present':
        return {
          backgroundColor: '#d1fae5',
          textColor: '#065f46',
          borderColor: '#10b981',
          label: 'Présent',
        };
      case 'absent':
        return {
          backgroundColor: '#fee2e2',
          textColor: '#991b1b',
          borderColor: '#ef4444',
          label: 'Absent',
        };
      case 'late':
        return {
          backgroundColor: '#fef3c7',
          textColor: '#92400e',
          borderColor: '#f59e0b',
          label: 'Retard',
        };
      case 'excused':
        return {
          backgroundColor: '#dbeafe',
          textColor: '#1e40af',
          borderColor: '#3b82f6',
          label: 'Excusé',
        };
      case 'draft':
        return {
          backgroundColor: '#fef3c7',
          textColor: '#92400e',
          borderColor: '#f59e0b',
          label: 'Brouillon',
        };
      case 'submitted':
        return {
          backgroundColor: '#dbeafe',
          textColor: '#1e40af',
          borderColor: '#3b82f6',
          label: 'Soumis',
        };
      case 'validated':
        return {
          backgroundColor: '#d1fae5',
          textColor: '#065f46',
          borderColor: '#10b981',
          label: 'Validé',
        };
      default:
        return {
          backgroundColor: '#f3f4f6',
          textColor: '#6b7280',
          borderColor: '#d1d5db',
          label: 'Inconnu',
        };
    }
  };

  const config = getStatusConfig();
  const sizeStyles = size === 'small' ? styles.small : size === 'large' ? styles.large : styles.medium;

  return (
    <View
      style={[
        styles.badge,
        sizeStyles,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.borderColor }]} />
      <Text style={[styles.label, { color: config.textColor }, sizeStyles]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 6,
  },
  small: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  medium: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  large: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  small: {
    fontSize: 10,
  },
  large: {
    fontSize: 14,
  },
});
