import { View, Text, StyleSheet } from 'react-native';
import type { SubmissionStatus } from '@novaconnect/core/schemas';

interface SubmissionStatusBadgeProps {
  status: SubmissionStatus;
  size?: 'small' | 'medium' | 'large';
}

export function SubmissionStatusBadge({ status, size = 'medium' }: SubmissionStatusBadgeProps) {
  const getStatusConfig = (status: SubmissionStatus) => {
    switch (status) {
      case 'pending':
        return {
          label: 'En attente',
          backgroundColor: '#F3F4F6',
          textColor: '#6B7280',
        };
      case 'submitted':
        return {
          label: 'Soumis',
          backgroundColor: '#DBEAFE',
          textColor: '#1D4ED8',
        };
      case 'graded':
        return {
          label: 'Noté',
          backgroundColor: '#FEF3C7',
          textColor: '#D97706',
        };
      case 'returned':
        return {
          label: 'Retourné',
          backgroundColor: '#D1FAE5',
          textColor: '#059669',
        };
      default:
        return {
          label: status,
          backgroundColor: '#F3F4F6',
          textColor: '#6B7280',
        };
    }
  };

  const config = getStatusConfig(status);
  const padding = size === 'small' ? 4 : size === 'medium' ? 6 : 8;
  const fontSize = size === 'small' ? 11 : size === 'medium' ? 12 : 14;

  return (
    <View style={[styles.container, { backgroundColor: config.backgroundColor, padding }]}>
      <Text style={[styles.text, { color: config.textColor, fontSize }]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
  },
});

export default SubmissionStatusBadge;
