import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useStudentGrades, useStudentGradeSummary } from '@novaconnect/data';

export default function GradesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [showSubjectModal, setShowSubjectModal] = useState(false);

  // In a real app, get periodId from context or user selection
  const periodId = 'current-period-id';

  const { data: grades, isLoading, refetch } = useStudentGrades(user?.id || '', periodId);
  const { data: summary } = useStudentGradeSummary(user?.id || '', periodId);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Group grades by subject
  const gradesBySubject = React.useMemo(() => {
    if (!grades) return {};

    return grades.reduce((acc: any, grade: any) => {
      const subjectId = grade.subjectId;
      if (!acc[subjectId]) {
        acc[subjectId] = {
          subjectId: grade.subject?.id,
          subjectName: grade.subject?.name,
          grades: [],
          average: 0,
        };
      }
      acc[subjectId].grades.push(grade);
      return acc;
    }, {});
  }, [grades]);

  // Calculate average for each subject
  Object.values(gradesBySubject).forEach((subject: any) => {
    const totalScore = subject.grades.reduce((sum: number, g: any) => {
      return sum + (g.score / g.maxScore) * 20;
    }, 0);
    subject.average = totalScore / subject.grades.length;
  });

  const handleSubjectPress = (subject: any) => {
    setSelectedSubject(subject);
    setShowSubjectModal(true);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Chargement des notes...</Text>
      </View>
    );
  }

  const overallAverage = summary?.overallAverage || 0;
  const subjectAverages = summary?.subjectAverages || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Notes</Text>
        <Text style={styles.subtitle}>Moyenne Générale</Text>
        <View style={styles.averageContainer}>
          <Text style={styles.averageText}>{overallAverage.toFixed(2)}/20</Text>
        </View>
      </View>

      {/* Subject Cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes par Matière</Text>

        {Object.keys(gradesBySubject).length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Aucune note disponible</Text>
          </View>
        ) : (
          Object.values(gradesBySubject).map((subject: any) => (
            <TouchableOpacity
              key={subject.subjectId}
              style={styles.subjectCard}
              onPress={() => handleSubjectPress(subject)}
            >
              <View style={styles.subjectHeader}>
                <View style={styles.subjectInfo}>
                  <Text style={styles.subjectName}>{subject.subjectName}</Text>
                  <Text style={styles.gradeCount}>{subject.grades.length} note(s)</Text>
                </View>
                <View style={styles.averageBadge}>
                  <Text style={styles.averageBadgeText}>
                    {subject.average.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Last grade */}
              {subject.grades.length > 0 && (
                <View style={styles.lastGradeContainer}>
                  <Text style={styles.lastGradeLabel}>Dernière note:</Text>
                  <Text style={styles.lastGradeText}>
                    {subject.grades[0].score}/{subject.grades[0].maxScore}
                  </Text>
                  <Text style={styles.lastGradeTitle}>{subject.grades[0].title}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Statistics */}
      {subjectAverages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistiques</Text>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Matières</Text>
              <Text style={styles.statValue}>{subjectAverages.length}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total Notes</Text>
              <Text style={styles.statValue}>{summary?.totalGrades || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Meilleure Moy.</Text>
              <Text style={styles.statValue}>
                {Math.max(...subjectAverages.map((s: any) => s.average)).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Subject Detail Modal */}
      <Modal
        visible={showSubjectModal}
        animationType="slide"
        onRequestClose={() => setShowSubjectModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSubjectModal(false)}>
              <Text style={styles.modalCloseButton}>Fermer</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{selectedSubject?.subjectName}</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Subject Average */}
            <View style={styles.modalAverageContainer}>
              <Text style={styles.modalAverageLabel}>Moyenne</Text>
              <Text style={styles.modalAverageText}>
                {selectedSubject?.average.toFixed(2)}/20
              </Text>
            </View>

            {/* Grades List */}
            <Text style={styles.modalSectionTitle}>Notes</Text>
            {selectedSubject?.grades.map((grade: any) => (
              <View key={grade.id} style={styles.gradeCard}>
                <View style={styles.gradeHeader}>
                  <Text style={styles.gradeTitle}>{grade.title}</Text>
                  <View style={styles.gradeScoreContainer}>
                    <Text style={styles.gradeScoreText}>
                      {grade.score}/{grade.maxScore}
                    </Text>
                  </View>
                </View>

                <View style={styles.gradeDetails}>
                  <Text style={styles.gradeDate}>
                    {new Date(grade.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                  <Text style={styles.gradeCoefficient}>
                    Coeff: {grade.coefficient}
                  </Text>
                </View>

                {grade.comments && (
                  <Text style={styles.gradeComments}>{grade.comments}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 40,
  },
  header: {
    backgroundColor: '#3b82f6',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
  },
  averageContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  averageText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  subjectCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  gradeCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  averageBadge: {
    backgroundColor: '#10b981',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  averageBadgeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  lastGradeContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  lastGradeLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  lastGradeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  lastGradeTitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    backgroundColor: '#3b82f6',
    padding: 16,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCloseButton: {
    fontSize: 16,
    color: '#ffffff',
    width: 60,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalAverageContainer: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  modalAverageLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  modalAverageText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    marginTop: 24,
  },
  gradeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  gradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gradeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  gradeScoreContainer: {
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  gradeScoreText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  gradeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gradeDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  gradeCoefficient: {
    fontSize: 12,
    color: '#6b7280',
  },
  gradeComments: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
