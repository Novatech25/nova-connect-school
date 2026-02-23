import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@novaconnect/data/src/client';
import { FileText, Download, Award, TrendingUp, CheckCircle } from 'lucide-react-native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type ExamResult = {
  id: string;
  exam_sessions: {
    id: string;
    name: string;
    exam_type: string;
    start_date: string;
    end_date: string;
  };
  overall_average: number;
  rank_in_class: number | null;
  class_size: number;
  is_passed: boolean;
  mention: string | null;
  mention_color: string | null;
  special_decision: string | null;
  jury_comments: string | null;
};

export default function ExamResultsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch exam results for the current student
  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ['examResults', 'student'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_results')
        .select(`
          *,
          exam_sessions(*)
        `)
        .eq('exam_sessions.status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ExamResult[];
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getExamTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      composition: 'Composition',
      exam: 'Examen',
      final_exam: 'Examen final',
      certification: 'Certification',
    };
    return labels[type] || type;
  };

  const handleDownloadDocument = (result: ExamResult) => {
    // In a real implementation, this would download the PDF document
    // For now, just show an alert
    Alert.alert(
      'Téléchargement',
      'Le document sera disponible une fois les paiements validés',
      [{ text: 'OK' }]
    );
  };

  const renderResultCard = (result: ExamResult) => (
    <View key={result.id} style={styles.resultCard}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <FileText size={24} color="#3b82f6" />
          <View style={styles.headerText}>
            <Text style={styles.examName}>{result.exam_sessions.name}</Text>
            <Text style={styles.examType}>
              {getExamTypeLabel(result.exam_sessions.exam_type)}
            </Text>
          </View>
        </View>
        <View style={[
          styles.passedBadge,
          { backgroundColor: result.is_passed ? '#dcfce7' : '#fee2e2' }
        ]}>
          <CheckCircle
            size={16}
            color={result.is_passed ? '#16a34a' : '#dc2626'}
          />
          <Text style={[
            styles.passedText,
            { color: result.is_passed ? '#16a34a' : '#dc2626' }
          ]}>
            {result.is_passed ? 'Admis' : 'Refusé'}
          </Text>
        </View>
      </View>

      {/* Results Summary */}
      <View style={styles.resultsGrid}>
        <View style={styles.resultItem}>
          <Text style={styles.resultLabel}>Moyenne</Text>
          <Text style={styles.resultValue}>{result.overall_average}/20</Text>
        </View>

        {result.rank_in_class && (
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Rang</Text>
            <View style={styles.rankContainer}>
              <TrendingUp size={16} color="#8b5cf6" />
              <Text style={styles.resultValue}>
                {result.rank_in_class}/{result.class_size}
              </Text>
            </View>
          </View>
        )}

        {result.mention && (
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Mention</Text>
            <View style={[
              styles.mentionBadge,
              { backgroundColor: result.mention_color || '#f3f4f6' }
            ]}>
              <Award size={16} color="#fff" />
              <Text style={styles.mentionText}>{result.mention}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Special Decision */}
      {result.special_decision && (
        <View style={styles.specialDecision}>
          <Text style={styles.specialDecisionLabel}>Décision du jury:</Text>
          <Text style={styles.specialDecisionText}>{result.special_decision}</Text>
        </View>
      )}

      {/* Jury Comments */}
      {result.jury_comments && (
        <View style={styles.commentsSection}>
          <Text style={styles.commentsLabel}>Commentaires du jury:</Text>
          <Text style={styles.commentsText}>{result.jury_comments}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={() => handleDownloadDocument(result)}
        >
          <Download size={18} color="#3b82f6" />
          <Text style={styles.downloadButtonText}>Télécharger le relevé</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Résultats des Examens</Text>
        <Text style={styles.headerSubtitle}>
          Consultez vos résultats d'examens officiels
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text>Chargement...</Text>
          </View>
        ) : results && results.length > 0 ? (
          results.map(renderResultCard)
        ) : (
          <View style={styles.emptyContainer}>
            <FileText size={48} color="#9ca3af" />
            <Text style={styles.emptyText}>
              Aucun résultat d'examen publié pour le moment
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  examName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  examType: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  passedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  passedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  resultItem: {
    flex: 1,
    minWidth: '30%',
  },
  resultLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  rankContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mentionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    alignSelf: 'flex-start',
  },
  mentionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  specialDecision: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  specialDecisionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  specialDecisionText: {
    fontSize: 14,
    color: '#78350f',
  },
  commentsSection: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  commentsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  commentsText: {
    fontSize: 14,
    color: '#4b5563',
  },
  actions: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 16,
  },
});
