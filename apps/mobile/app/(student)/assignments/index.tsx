import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStudentSubmissions } from '@data/hooks/useSubmissions';
import AssignmentCard from '@ui/components/assignment-card';
import SubmissionStatusBadge from '@ui/components/submission-status-badge';

type TabType = 'todo' | 'submitted' | 'graded';

export default function StudentAssignmentsScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<TabType>('todo');
  const [refreshing, setRefreshing] = useState(false);

  // TODO: Get studentId from auth context
  const studentId = 'student-id-here';

  const { data: submissions, isLoading, error, refetch } = useStudentSubmissions(studentId);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const filteredSubmissions = submissions?.filter((submission) => {
    if (activeTab === 'todo') {
      return submission.status === 'pending';
    }
    if (activeTab === 'submitted') {
      return submission.status === 'submitted';
    }
    if (activeTab === 'graded') {
      return ['graded', 'returned'].includes(submission.status);
    }
    return true;
  });

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Chargement des devoirs...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Erreur: {error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes Devoirs</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'todo' && styles.tabActive]}
          onPress={() => setActiveTab('todo')}
        >
          <Text style={[styles.tabText, activeTab === 'todo' && styles.tabTextActive]}>
            À faire
          </Text>
          {submissions?.filter(s => s.status === 'pending').length ?? 0 > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {submissions?.filter(s => s.status === 'pending').length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'submitted' && styles.tabActive]}
          onPress={() => setActiveTab('submitted')}
        >
          <Text style={[styles.tabText, activeTab === 'submitted' && styles.tabTextActive]}>
            Rendus
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'graded' && styles.tabActive]}
          onPress={() => setActiveTab('graded')}
        >
          <Text style={[styles.tabText, activeTab === 'graded' && styles.tabTextActive]}>
            Notés
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredSubmissions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.submissionCard}
            onPress={() =>
              navigation.navigate('AssignmentDetails' as never, { submissionId: item.id } as never)
            }
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.assignmentTitle}>{item.assignment.title}</Text>
                <Text style={styles.assignmentSubject}>{item.assignment.subject?.name || 'N/A'}</Text>
              </View>
              <SubmissionStatusBadge status={item.status} size="small" />
            </View>

            <View style={styles.cardDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date limite:</Text>
                <Text style={styles.detailValue}>
                  {new Date(item.assignment.dueDate).toLocaleDateString('fr-FR')}
                </Text>
              </View>

              {item.isLate && (
                <View style={styles.lateBadge}>
                  <Text style={styles.lateText}>En retard</Text>
                </View>
              )}

              {item.score !== null && (
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreText}>
                    Note: {item.score}/{item.assignment.maxScore}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
        contentContainerStyle={filteredSubmissions?.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucun devoir</Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'todo' && 'Aucun devoir à faire pour le moment'}
              {activeTab === 'submitted' && 'Aucun devoir rendu en attente de correction'}
              {activeTab === 'graded' && 'Aucun devoir noté pour le moment'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#3B82F6',
  },
  tabBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  submissionCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  assignmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  assignmentSubject: {
    fontSize: 14,
    color: '#6B7280',
  },
  cardDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  lateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  scoreBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
});
