import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { AssignmentWithRelations } from '@novaconnect/core/schemas';

interface AssignmentCardProps {
  assignment: AssignmentWithRelations;
  variant?: 'teacher' | 'student';
  onPress?: () => void;
}

export function AssignmentCard({ assignment, variant = 'student', onPress }: AssignmentCardProps) {
  const isLate = new Date(assignment.dueDate) < new Date() && assignment.status === 'published';
  const isOverdue = assignment.status === 'closed';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return '#9CA3AF';
      case 'published':
        return '#10B981';
      case 'closed':
        return '#EF4444';
      case 'archived':
        return '#6B7280';
      default:
        return '#9CA3AF';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Brouillon';
      case 'published':
        return 'Publié';
      case 'closed':
        return 'Fermé';
      case 'archived':
        return 'Archivé';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <TouchableOpacity
      style={[styles.container, onPress && styles.pressable]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {assignment.title}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(assignment.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(assignment.status)}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Matière:</Text>
          <Text style={styles.value}>{assignment.subject.name}</Text>
        </View>

        {variant === 'student' && (
          <View style={styles.detailRow}>
            <Text style={styles.label}>Classe:</Text>
            <Text style={styles.value}>{assignment.class.name}</Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.label}>Date limite:</Text>
          <Text style={[styles.value, (isLate || isOverdue) && styles.overdueText]}>
            {formatDate(assignment.dueDate)}
          </Text>
        </View>

        {variant === 'teacher' && (
          <View style={styles.detailRow}>
            <Text style={styles.label}>Soumissions:</Text>
            <Text style={styles.value}>
              {assignment._count.submissions || 0} / {assignment._count.gradedSubmissions || 0} notées
            </Text>
          </View>
        )}
      </View>

      {(isLate || isOverdue) && (
        <View style={styles.lateBadge}>
          <Text style={styles.lateText}>
            {isOverdue ? 'Expiré' : 'En retard'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pressable: {
    cursor: 'pointer',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  details: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  overdueText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  lateBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
});

export default AssignmentCard;
