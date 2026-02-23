import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth, useActiveStudentCard, useDownloadStudentCardPdf } from '@novaconnect/data';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useQuery } from '@tanstack/react-query';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
}

export default function StudentCardScreen() {
  const { user } = useAuth();
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);

  // Fetch parent's children if user is a parent
  const { data: children = [], isLoading: childrenLoading } = useQuery({
    queryKey: ['parent_children', user?.id],
    queryFn: async () => {
      if (!user?.id || user.role !== 'parent') return [];

      // This would typically use a dedicated hook like useParentChildren
      // For now, implementing a simple query
      const response = await fetch(`/api/parents/${user.id}/children`);
      if (!response.ok) return [];
      const data = await response.json();
      return data;
    },
    enabled: user?.role === 'parent',
  });

  // Determine student ID based on user role
  const studentId = user?.role === 'parent' && children.length > 0
    ? children[selectedChildIndex]?.id
    : user?.studentId || user?.id;

  const { data: card, isLoading } = useActiveStudentCard(studentId || '');
  const downloadPdf = useDownloadStudentCardPdf();

  // Show loading state while fetching children
  if (childrenLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Parent with no children selected
  if (user?.role === 'parent' && (!studentId || !card)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="people-outline" size={80} color="#9ca3af" />
          <Text style={styles.noCardTitle}>Aucun enfant sélectionné</Text>
          <Text style={styles.noCardText}>
            Sélectionnez un enfant pour voir sa carte scolaire.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleDownload = async () => {
    if (!card) return;

    try {
      const result = await downloadPdf.mutateAsync(card.id);

      // In a real app, you would open the PDF or download it
      Alert.alert('Succès', 'Carte téléchargée avec succès');
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Échec du téléchargement');
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; label: string }> = {
      active: { color: '#22c55e', label: 'Active' },
      expired: { color: '#f59e0b', label: 'Expirée' },
      revoked: { color: '#ef4444', label: 'Révoquée' },
      lost: { color: '#6b7280', label: 'Perdue' },
    };

    const { color, label } = config[status] || config.active;
    return { color, label };
  };

  const getPaymentStatusBadge = (status: string, override: boolean) => {
    if (override) {
      return { color: '#8b5cf6', label: 'Override' };
    }

    const config: Record<string, { color: string; label: string }> = {
      ok: { color: '#22c55e', label: 'OK' },
      warning: { color: '#f59e0b', label: 'Attention' },
      blocked: { color: '#ef4444', label: 'Bloqué' },
    };

    return config[status] || config.ok;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Chargement de la carte...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="card-outline" size={80} color="#9ca3af" />
          <Text style={styles.noCardTitle}>Aucune carte disponible</Text>
          <Text style={styles.noCardText}>
            Vous n'avez pas encore de carte scolaire. Contactez l'administration.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusBadge = getStatusBadge(card.status);
  const paymentBadge = getPaymentStatusBadge(card.paymentStatus, card.paymentStatusOverride);

  // Parse QR data
  let qrData = '';
  try {
    const qrPayload = {
      data: card.qrCodeData,
      sig: card.qrCodeSignature,
    };
    qrData = JSON.stringify(qrPayload);
  } catch (e) {
    console.error('Error parsing QR data:', e);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Ma Carte Scolaire</Text>
        </View>

        {/* Child Selector for Parents */}
        {user?.role === 'parent' && children.length > 0 && (
          <View style={styles.childSelector}>
            <Text style={styles.childSelectorLabel}>Enfant:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {children.map((child: Child, index: number) => (
                <TouchableOpacity
                  key={child.id}
                  style={[
                    styles.childChip,
                    selectedChildIndex === index && styles.childChipSelected,
                  ]}
                  onPress={() => setSelectedChildIndex(index)}
                >
                  {child.photoUrl && (
                    <Image source={{ uri: child.photoUrl }} style={styles.childPhoto} />
                  )}
                  <Text
                    style={[
                      styles.childName,
                      selectedChildIndex === index && styles.childNameSelected,
                    ]}
                  >
                    {child.firstName} {child.lastName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Card Display */}
        <View style={styles.cardContainer}>
          <View style={[styles.card, { backgroundColor: card.template?.layoutConfig?.backgroundColor || '#ffffff' }]}>
            {/* School Header */}
            <Text style={[styles.cardSchoolName, { color: card.template?.layoutConfig?.textColor || '#000000' }]}>
              {card.student?.schools?.name || 'École'}
            </Text>

            {/* Student Photo */}
            {card.student?.photoUrl && (
              <Image
                source={{ uri: card.student.photoUrl }}
                style={styles.studentPhoto}
              />
            )}

            {/* QR Code */}
            <View style={styles.qrContainer}>
              {qrData ? (
                <QRCode
                  value={qrData}
                  size={120}
                  color="#000000"
                  backgroundColor="#ffffff"
                />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Ionicons name="qr-code-outline" size={60} color="#9ca3af" />
                </View>
              )}
              <Text style={styles.qrLabel}>QR Code d'identification</Text>
            </View>

            {/* Student Info */}
            <View style={styles.studentInfo}>
              <Text style={[styles.studentName, { color: card.template?.layoutConfig?.textColor || '#000000' }]}>
                {card.student?.firstName} {card.student?.lastName}
              </Text>
              {card.student?.matricule && (
                <Text style={[styles.infoText, { color: card.template?.layoutConfig?.textColor || '#000000' }]}>
                  Mat: {card.student.matricule}
                </Text>
              )}
              {card.student?.classes && (
                <Text style={[styles.infoText, { color: card.template?.layoutConfig?.textColor || '#000000' }]}>
                  Classe: {card.student.classes.name}
                </Text>
              )}
              <Text style={[styles.infoText, { color: card.template?.layoutConfig?.textColor || '#000000' }]}>
                N° {card.cardNumber}
              </Text>
            </View>
          </View>
        </View>

        {/* Status Badges */}
        <View style={styles.statusContainer}>
          <View style={[styles.badge, { backgroundColor: `${statusBadge.color}20` }]}>
            <View style={[styles.badgeDot, { backgroundColor: statusBadge.color }]} />
            <Text style={[styles.badgeLabel, { color: statusBadge.color }]}>
              {statusBadge.label}
            </Text>
          </View>

          <View style={[styles.badge, { backgroundColor: `${paymentBadge.color}20` }]}>
            <View style={[styles.badgeDot, { backgroundColor: paymentBadge.color }]} />
            <Text style={[styles.badgeLabel, { color: paymentBadge.color }]}>
              Paiement: {paymentBadge.label}
            </Text>
          </View>
        </View>

        {/* Payment Warning */}
        {card.paymentStatus === 'blocked' && !card.paymentStatusOverride && (
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={24} color="#ef4444" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Accès bloqué</Text>
              <Text style={styles.warningText}>
                Vous avez des arriérés de paiement. Veuillez contacter l'administration.
              </Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              card.status !== 'active' && styles.actionButtonDisabled,
            ]}
            onPress={handleDownload}
            disabled={card.status !== 'active'}
          >
            <Ionicons name="download-outline" size={24} color="#ffffff" />
            <Text style={styles.actionButtonText}>Télécharger PDF</Text>
          </TouchableOpacity>

          {card.paymentStatus === 'blocked' && !card.paymentStatusOverride && (
            <Text style={styles.blockedText}>
              Téléchargement bloqué pour cause d'arriérés de paiement
            </Text>
          )}
        </View>

        {/* Card Details */}
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>Détails de la carte</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Numéro de carte</Text>
            <Text style={styles.detailValue}>{card.cardNumber}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date d'émission</Text>
            <Text style={styles.detailValue}>
              {new Date(card.issueDate).toLocaleDateString('fr-FR')}
            </Text>
          </View>

          {card.expiryDate && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date d'expiration</Text>
              <Text style={styles.detailValue}>
                {new Date(card.expiryDate).toLocaleDateString('fr-FR')}
              </Text>
            </View>
          )}

          {card.template && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Modèle</Text>
              <Text style={styles.detailValue}>{card.template.name}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  noCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
  },
  noCardText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  cardContainer: {
    padding: 24,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardSchoolName: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  studentPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignSelf: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrPlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  studentInfo: {
    alignItems: 'center',
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  badgeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#fef2f2',
    padding: 16,
    marginHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#991b1b',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#b91c1c',
  },
  actionsContainer: {
    padding: 24,
  },
  actionButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  blockedText: {
    fontSize: 12,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 8,
  },
  detailsContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  childSelector: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  childSelectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  childChipSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  childPhoto: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
  },
  childName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  childNameSelected: {
    color: '#1d4ed8',
  },
});
