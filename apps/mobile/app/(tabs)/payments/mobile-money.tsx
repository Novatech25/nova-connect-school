// ============================================================================
// Mobile Money Payment Screen
// ============================================================================
// Allows parents/students to make payments via Mobile Money
// Supports multiple providers (Orange, Moov, MTN, Wave)
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Phone,
} from 'lucide-react-native';
import { useAuth, useProviders, useStudentFeeSchedules, useInitiatePayment, useCheckStatus } from '@novaconnect/data';

interface Provider {
  id: string;
  provider_code: string;
  provider_name: string;
  transaction_fee_percent: number;
  transaction_fee_fixed: number;
  min_amount: number;
  max_amount: number;
}

interface FeeSchedule {
  id: string;
  fee_type: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
}

export default function MobileMoneyPaymentScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const studentId = params.studentId as string;
  const { user } = useAuth();

  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedFees, setSelectedFees] = useState<string[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<'initiated' | 'pending' | 'success' | 'failed'>('initiated');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: providers, isLoading: providersLoading } = useProviders(user?.schoolId || '');
  const { data: feeSchedules, isLoading: feesLoading } = useStudentFeeSchedules(studentId);
  const initiatePayment = useInitiatePayment();
  const checkStatus = useCheckStatus();

  // Calculate total amount
  useEffect(() => {
    if (selectedFees.length > 0 && feeSchedules) {
      const total = feeSchedules
        .filter(fee => selectedFees.includes(fee.id))
        .reduce((sum, fee) => {
          const remaining = fee.amount_due - fee.amount_paid;
          return sum + Math.max(0, remaining);
        }, 0);
      setTotalAmount(total);
    }
  }, [selectedFees, feeSchedules]);

  // Poll for transaction status
  useEffect(() => {
    if (transactionStatus === 'pending' && transactionId) {
      const interval = setInterval(async () => {
        try {
          const result = await checkStatus.mutateAsync(transactionId);
          if (result.status === 'success') {
            setTransactionStatus('success');
            clearInterval(interval);
          } else if (result.status === 'failed') {
            setTransactionStatus('failed');
            setErrorMessage(result.message || 'Payment failed');
            clearInterval(interval);
          } else if (!result.can_retry) {
            setTransactionStatus('failed');
            setErrorMessage('Payment timeout - please check with support');
            clearInterval(interval);
          }
        } catch (error) {
          console.error('Error checking status:', error);
        }
      }, 10000); // Check every 10 seconds

      // Stop polling after 3 minutes
      const timeout = setTimeout(() => {
        clearInterval(interval);
        if (transactionStatus === 'pending') {
          setTransactionStatus('failed');
          setErrorMessage('Payment timeout - please check your transaction history');
        }
      }, 180000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [transactionStatus, transactionId]);

  const handleSelectFee = (feeId: string) => {
    if (selectedFees.includes(feeId)) {
      setSelectedFees(selectedFees.filter(id => id !== feeId));
    } else {
      setSelectedFees([...selectedFees, feeId]);
    }
  };

  const handleInitiatePayment = async () => {
    if (!selectedProvider) {
      Alert.alert('Erreur', 'Veuillez sélectionner un fournisseur de paiement');
      return;
    }

    if (selectedFees.length === 0) {
      Alert.alert('Erreur', 'Veuillez sélectionner au moins une dette à payer');
      return;
    }

    if (!phoneNumber) {
      Alert.alert('Erreur', 'Veuillez entrer votre numéro de téléphone');
      return;
    }

    // Validate phone number format
    const phoneRegex = /^\+?\d{10,15}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      Alert.alert('Erreur', 'Numéro de téléphone invalide');
      return;
    }

    setErrorMessage(null);
    setTransactionStatus('pending');

    try {
      const feeScheduleId = selectedFees.length === 1 ? selectedFees[0] : undefined;

      const result = await initiatePayment.mutateAsync({
        student_id: studentId,
        fee_schedule_id: feeScheduleId,
        amount: totalAmount,
        phone_number: phoneNumber,
        provider_code: selectedProvider.provider_code,
      });

      if (result.success) {
        setTransactionId(result.transaction_id);
        setTransactionStatus('pending');

        // Show payment instructions
        Alert.alert(
          'Paiement initié',
          result.payment_instructions?.message || 'Suivez les instructions pour compléter le paiement',
          [
            {
              text: 'OK',
              onPress: () => {
                // Start polling for status
              }
            }
          ]
        );
      } else {
        setTransactionStatus('failed');
        setErrorMessage(result.error || 'Failed to initiate payment');
      }
    } catch (error: any) {
      setTransactionStatus('failed');
      setErrorMessage(error.message || 'Une erreur est survenue');
    }
  };

  const handleRetry = () => {
    setTransactionId(null);
    setTransactionStatus('initiated');
    setErrorMessage(null);
  };

  const handleBack = () => {
    if (transactionStatus === 'success') {
      router.back();
    } else {
      router.back();
    }
  };

  if (providersLoading || feesLoading) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-gray-600">Chargement...</Text>
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-gray-50"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="bg-white px-4 py-4 border-b border-gray-200">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={handleBack}>
            <ChevronRight size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-xl font-semibold text-gray-900">
            Paiement Mobile Money
          </Text>
          <View style={{ width: 24 }} />
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Success State */}
        {transactionStatus === 'success' && (
          <View className="bg-green-50 rounded-lg p-6 mb-4">
            <View className="items-center">
              <CheckCircle size={64} color="#10b981" />
              <Text className="mt-4 text-2xl font-bold text-green-900">
                Paiement réussi !
              </Text>
              <Text className="mt-2 text-center text-green-700">
                Votre paiement de {totalAmount.toLocaleString('fr-FR')} FCFA a été confirmé
              </Text>
            </View>
          </View>
        )}

        {/* Failed State */}
        {transactionStatus === 'failed' && (
          <View className="bg-red-50 rounded-lg p-6 mb-4">
            <View className="items-center">
              <XCircle size={64} color="#ef4444" />
              <Text className="mt-4 text-2xl font-bold text-red-900">
                Échec du paiement
              </Text>
              {errorMessage && (
                <Text className="mt-2 text-center text-red-700">{errorMessage}</Text>
              )}
              <TouchableOpacity
                onPress={handleRetry}
                className="mt-4 bg-red-600 px-6 py-3 rounded-lg"
              >
                <Text className="text-white font-semibold">Réessayer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Pending State */}
        {transactionStatus === 'pending' && (
          <View className="bg-blue-50 rounded-lg p-6 mb-4">
            <View className="items-center">
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text className="mt-4 text-xl font-semibold text-blue-900">
                Paiement en cours...
              </Text>
              <Text className="mt-2 text-center text-blue-700">
                Nous attendons la confirmation de votre paiement.
                Veuillez vérifier votre téléphone et suivre les instructions.
              </Text>
              <Text className="mt-4 text-sm text-blue-600">
                Cette page se mettra à jour automatiquement.
              </Text>
            </View>
          </View>
        )}

        {/* Initiation Form */}
        {transactionStatus === 'initiated' && (
          <>
            {/* Provider Selection */}
            <View className="bg-white rounded-lg p-4 mb-4">
              <Text className="text-lg font-semibold text-gray-900 mb-3">
                Fournisseur de paiement
              </Text>
              {providers?.map((provider: Provider) => (
                <TouchableOpacity
                  key={provider.id}
                  onPress={() => setSelectedProvider(provider)}
                  className={`flex-row items-center justify-between p-3 rounded-lg mb-2 ${
                    selectedProvider?.id === provider.id ? 'bg-blue-50 border-2 border-blue-500' : 'bg-gray-50'
                  }`}
                >
                  <View>
                    <Text className="font-semibold text-gray-900">{provider.provider_name}</Text>
                    <Text className="text-sm text-gray-600">
                      Frais: {provider.transaction_fee_percent}% + {provider.transaction_fee_fixed} FCFA
                    </Text>
                  </View>
                  <View
                    className={`w-5 h-5 rounded-full border-2 ${
                      selectedProvider?.id === provider.id ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                    }`}
                  >
                    {selectedProvider?.id === provider.id && (
                      <CheckCircle size={20} color="white" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Fee Schedule Selection */}
            <View className="bg-white rounded-lg p-4 mb-4">
              <Text className="text-lg font-semibold text-gray-900 mb-3">
                Dettes à payer
              </Text>
              {feeSchedules
                ?.filter(fee => {
                  const remaining = fee.amount_due - fee.amount_paid;
                  return remaining > 0;
                })
                .map((fee: FeeSchedule) => {
                  const remaining = fee.amount_due - fee.amount_paid;
                  const isSelected = selectedFees.includes(fee.id);
                  return (
                    <TouchableOpacity
                      key={fee.id}
                      onPress={() => handleSelectFee(fee.id)}
                      className={`flex-row items-center justify-between p-3 rounded-lg mb-2 ${
                        isSelected ? 'bg-blue-50 border-2 border-blue-500' : 'bg-gray-50'
                      }`}
                    >
                      <View className="flex-1">
                        <Text className="font-semibold text-gray-900">{fee.fee_type}</Text>
                        <Text className="text-sm text-gray-600">
                          Reste à payer: {remaining.toLocaleString('fr-FR')} FCFA
                        </Text>
                        <Text className="text-xs text-gray-500">
                          Échéance: {new Date(fee.due_date).toLocaleDateString('fr-FR')}
                        </Text>
                      </View>
                      <View
                        className={`w-5 h-5 rounded-full border-2 ${
                          isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <CheckCircle size={20} color="white" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
            </View>

            {/* Phone Number Input */}
            <View className="bg-white rounded-lg p-4 mb-4">
              <Text className="text-lg font-semibold text-gray-900 mb-3">
                Numéro de téléphone
              </Text>
              <View className="flex-row items-center bg-gray-50 rounded-lg px-3 py-3">
                <Phone size={20} color="#6b7280" />
                <TextInput
                  className="flex-1 ml-3 text-base"
                  placeholder="+225 07 00 00 00 00"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
              </View>
              <Text className="mt-2 text-sm text-gray-600">
                Entrez le numéro associé à votre compte Mobile Money
              </Text>
            </View>

            {/* Summary */}
            {totalAmount > 0 && selectedProvider && (
              <View className="bg-white rounded-lg p-4 mb-4">
                <Text className="text-lg font-semibold text-gray-900 mb-3">
                  Récapitulatif
                </Text>
                <View className="space-y-2">
                  <View className="flex-row justify-between">
                    <Text className="text-gray-600">Montant:</Text>
                    <Text className="font-semibold">
                      {totalAmount.toLocaleString('fr-FR')} FCFA
                    </Text>
                  </View>
                  {selectedProvider.transaction_fee_percent > 0 && (
                    <View className="flex-row justify-between">
                      <Text className="text-gray-600">Frais (%):</Text>
                      <Text className="font-semibold">
                        {(totalAmount * selectedProvider.transaction_fee_percent / 100).toLocaleString('fr-FR')} FCFA
                      </Text>
                    </View>
                  )}
                  {selectedProvider.transaction_fee_fixed > 0 && (
                    <View className="flex-row justify-between">
                      <Text className="text-gray-600">Frais (fixe):</Text>
                      <Text className="font-semibold">
                        {selectedProvider.transaction_fee_fixed.toLocaleString('fr-FR')} FCFA
                      </Text>
                    </View>
                  )}
                  <View className="border-t border-gray-200 pt-2 mt-2">
                    <View className="flex-row justify-between">
                      <Text className="text-lg font-bold text-gray-900">Total:</Text>
                      <Text className="text-lg font-bold text-blue-600">
                        {(
                          totalAmount +
                          totalAmount * selectedProvider.transaction_fee_percent / 100 +
                          selectedProvider.transaction_fee_fixed
                        ).toLocaleString('fr-FR')} FCFA
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Pay Button */}
            <TouchableOpacity
              onPress={handleInitiatePayment}
              disabled={initiatePayment.isPending}
              className={`bg-blue-600 rounded-lg p-4 ${
                initiatePayment.isPending ? 'opacity-50' : ''
              }`}
            >
              {initiatePayment.isPending ? (
                <View className="flex-row items-center justify-center">
                  <ActivityIndicator size="small" color="white" />
                  <Text className="ml-2 text-white font-semibold text-center">
                    Traitement en cours...
                  </Text>
                </View>
              ) : (
                <Text className="text-white font-semibold text-center text-lg">
                  Payer maintenant
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}
