'use client';
import { useAuthContext } from '@novaconnect/data';
import { useMobileMoneyProviders, useStudentFeeSchedules, useInitiatePayment, useCheckStatus } from '@novaconnect/data';
import { useState, useEffect } from 'react';
import { CreditCard, Smartphone, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Parent Mobile Money Payment Page
 *
 * Allows parents to make payments via Mobile Money for their children's fees
 */
export default function ParentMobileMoneyPage() {
  const { user } = useAuthContext();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [selectedFees, setSelectedFees] = useState<string[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<'initiated' | 'pending' | 'success' | 'failed'>('initiated');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: providers, isLoading: providersLoading } = useMobileMoneyProviders(user?.schoolId || '');
  const { data: feeSchedules, isLoading: feesLoading } = useStudentFeeSchedules(selectedStudentId || '');
  const initiatePayment = useInitiatePayment();
  const checkStatus = useCheckStatus();

  // Calculate total amount
  useEffect(() => {
    if (selectedFees.length > 0 && feeSchedules) {
      const total = feeSchedules
        .filter((fee: any) => selectedFees.includes(fee.id))
        .reduce((sum: number, fee: any) => {
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
    if (!selectedStudentId) {
      setErrorMessage('Veuillez sélectionner un élève');
      return;
    }

    if (!selectedProvider) {
      setErrorMessage('Veuillez sélectionner un fournisseur de paiement');
      return;
    }

    if (selectedFees.length === 0) {
      setErrorMessage('Veuillez sélectionner au moins une dette à payer');
      return;
    }

    if (!phoneNumber) {
      setErrorMessage('Veuillez entrer votre numéro de téléphone');
      return;
    }

    // Validate phone number format
    const phoneRegex = /^\+?\d{10,15}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      setErrorMessage('Numéro de téléphone invalide');
      return;
    }

    setErrorMessage(null);
    setTransactionStatus('pending');

    try {
      const feeScheduleId = selectedFees.length === 1 ? selectedFees[0] : undefined;

      const result = await initiatePayment.mutateAsync({
        student_id: selectedStudentId,
        fee_schedule_id: feeScheduleId,
        amount: totalAmount,
        phone_number: phoneNumber,
        provider_code: selectedProvider.provider_code,
      });

      if (result.success) {
        setTransactionId(result.transaction_id);
        setTransactionStatus('pending');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Paiement Mobile Money</h1>
        <p className="mt-2 text-gray-600">Payez les frais scolaires via Mobile Money</p>
      </div>

      {/* Success State */}
      {transactionStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8">
          <div className="flex flex-col items-center text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mb-4" />
            <h2 className="text-2xl font-bold text-green-900 mb-2">Paiement réussi !</h2>
            <p className="text-green-700 mb-6">
              Votre paiement de {Math.round(totalAmount).toLocaleString('fr-FR')} FCFA a été confirmé
            </p>
            <button
              onClick={handleRetry}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
            >
              Effectuer un autre paiement
            </button>
          </div>
        </div>
      )}

      {/* Failed State */}
      {transactionStatus === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-8">
          <div className="flex flex-col items-center text-center">
            <XCircle className="h-16 w-16 text-red-600 mb-4" />
            <h2 className="text-2xl font-bold text-red-900 mb-2">Échec du paiement</h2>
            {errorMessage && (
              <p className="text-red-700 mb-6">{errorMessage}</p>
            )}
            <button
              onClick={handleRetry}
              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
            >
              Réessayer
            </button>
          </div>
        </div>
      )}

      {/* Pending State */}
      {transactionStatus === 'pending' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8">
          <div className="flex flex-col items-center text-center">
            <RefreshCw className="h-16 w-16 text-blue-600 mb-4 animate-spin" />
            <h2 className="text-2xl font-bold text-blue-900 mb-2">Paiement en cours...</h2>
            <p className="text-blue-700 mb-2">
              Nous attendons la confirmation de votre paiement.
            </p>
            <p className="text-blue-600 text-sm">
              Veuillez vérifier votre téléphone et suivre les instructions.
              Cette page se mettra à jour automatiquement.
            </p>
          </div>
        </div>
      )}

      {/* Initiation Form */}
      {transactionStatus === 'initiated' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Provider Selection */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Fournisseur de paiement
              </h2>
              {providersLoading ? (
                <div className="text-center py-8 text-gray-500">Chargement...</div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {providers?.map((provider: any) => (
                    <button
                      key={provider.id}
                      onClick={() => setSelectedProvider(provider)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        selectedProvider?.id === provider.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{provider.provider_name}</p>
                          <p className="text-sm text-gray-600">
                            Frais: {provider.transaction_fee_percent}% + {provider.transaction_fee_fixed} FCFA
                          </p>
                        </div>
                        {selectedProvider?.id === provider.id && (
                          <CheckCircle className="h-5 w-5 text-blue-500" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fee Schedule Selection */}
            {selectedStudentId && (
              <div className="bg-white shadow rounded-lg p-6 mt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Dettes à payer
                </h2>
                {feesLoading ? (
                  <div className="text-center py-8 text-gray-500">Chargement...</div>
                ) : (
                  <div className="space-y-3">
                    {feeSchedules
                      ?.filter((fee: any) => {
                        const remaining = fee.amount_due - fee.amount_paid;
                        return remaining > 0;
                      })
                      .map((fee: any) => {
                        const remaining = fee.amount_due - fee.amount_paid;
                        const isSelected = selectedFees.includes(fee.id);
                        return (
                          <button
                            key={fee.id}
                            onClick={() => handleSelectFee(fee.id)}
                            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-gray-900">{fee.fee_type}</p>
                                <p className="text-sm text-gray-600">
                                  Reste à payer: {Math.round(remaining).toLocaleString('fr-FR')} FCFA
                                </p>
                                <p className="text-xs text-gray-500">
                                  Échéance: {new Date(fee.due_date).toLocaleDateString('fr-FR')}
                                </p>
                              </div>
                              {isSelected && (
                                <CheckCircle className="h-5 w-5 text-blue-500" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Phone Number Input */}
            <div className="bg-white shadow rounded-lg p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Numéro de téléphone
              </h2>
              <div className="flex items-center space-x-3">
                <Smartphone className="h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  placeholder="+225 07 00 00 00 00"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Entrez le numéro associé à votre compte Mobile Money
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Récapitulatif
              </h2>

              {totalAmount > 0 && selectedProvider && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Montant:</span>
                    <span className="font-semibold">
                      {Math.round(totalAmount).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                  {selectedProvider.transaction_fee_percent > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Frais (%):</span>
                      <span className="font-semibold">
                        {Math.round(totalAmount * selectedProvider.transaction_fee_percent / 100).toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                  )}
                  {selectedProvider.transaction_fee_fixed > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Frais (fixe):</span>
                      <span className="font-semibold">
                        {Math.round(selectedProvider.transaction_fee_fixed).toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="flex justify-between">
                      <span className="text-lg font-bold text-gray-900">Total:</span>
                      <span className="text-lg font-bold text-blue-600">
                        {(
                          totalAmount +
                          totalAmount * selectedProvider.transaction_fee_percent / 100 +
                          selectedProvider.transaction_fee_fixed
                        ).toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Pay Button */}
              <button
                onClick={handleInitiatePayment}
                disabled={initiatePayment.isPending}
                className={`w-full mt-6 bg-blue-600 text-white py-3 rounded-lg font-semibold transition-colors ${
                  initiatePayment.isPending ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
                }`}
              >
                {initiatePayment.isPending ? 'Traitement en cours...' : 'Payer maintenant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
