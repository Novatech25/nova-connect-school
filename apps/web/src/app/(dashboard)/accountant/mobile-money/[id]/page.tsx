'use client';

import { useAuthContext } from '@novaconnect/data';
import { useMobileMoneyTransaction, useReconcileManually, useCheckStatus } from '@novaconnect/data';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Link as LinkIcon,
  FileText,
  AlertCircle,
  Info,
  Download,
  Copy,
  ChevronRight
} from 'lucide-react';

/**
 * Accountant Mobile Money Transaction Details Page
 *
 * Displays comprehensive transaction details including:
 * - Full metadata and audit trail
 * - Webhook logs
 * - Retry history
 * - Payment reconciliation
 * - Receipt export
 */
export default function AccountantTransactionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthContext();
  const router = useRouter();

  const [showReconcileDialog, setShowReconcileDialog] = useState(false);
  const [reconciliationPaymentId, setReconciliationPaymentId] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: transaction, isLoading, refetch } = useMobileMoneyTransaction(id || '');
  const reconcileMutation = useReconcileManually();
  const checkStatusMutation = useCheckStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Transaction non trouvée</h3>
        <p className="text-gray-500 mb-4">Cette transaction n'existe pas ou vous n'y avez pas accès.</p>
        <button
          onClick={() => router.push('/accountant/mobile-money')}
          className="text-blue-600 hover:text-blue-800"
        >
          Retour à la liste
        </button>
      </div>
    );
  }

  const handleReconcile = async () => {
    if (!id || !reconciliationPaymentId) return;

    try {
      await reconcileMutation.mutateAsync({
        transaction_id: id,
        payment_id: reconciliationPaymentId
      });

      setShowReconcileDialog(false);
      setReconciliationPaymentId('');
      refetch();
    } catch (error: any) {
      alert('Erreur lors de la réconciliation: ' + error.message);
    }
  };

  const handleCheckStatus = async () => {
    if (!id) return;

    try {
      await checkStatusMutation.mutateAsync(id);
      refetch();
    } catch (error: any) {
      alert('Erreur lors de la vérification: ' + error.message);
    }
  };

  const handleCopyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-4 w-4 mr-1" />
            Succès
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircle className="h-4 w-4 mr-1" />
            Échec
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-4 w-4 mr-1" />
            En attente
          </span>
        );
      case 'initiated':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            <Info className="h-4 w-4 mr-1" />
            Initié
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const getReconciliationBadge = (status: string) => {
    switch (status) {
      case 'reconciled':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            <LinkIcon className="h-4 w-4 mr-1" />
            Réconcilié
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            En attente
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/accountant/mobile-money')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Transaction {transaction.transaction_reference}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Créée le {new Date(transaction.initiated_at).toLocaleDateString('fr-FR')} à{' '}
              {new Date(transaction.initiated_at).toLocaleTimeString('fr-FR')}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {transaction.status === 'success' && transaction.reconciliation_status === 'pending' && (
            <button
              onClick={() => setShowReconcileDialog(true)}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Réconcilier
            </button>
          )}

          {(transaction.status === 'pending' || transaction.status === 'initiated') && (
            <button
              onClick={handleCheckStatus}
              disabled={checkStatusMutation.isPending}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${checkStatusMutation.isPending ? 'animate-spin' : ''}`} />
              Vérifier le statut
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </button>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex items-center space-x-4">
        {getStatusBadge(transaction.status)}
        {getReconciliationBadge(transaction.reconciliation_status)}
        {transaction.retry_count > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
            <RefreshCw className="h-4 w-4 mr-1" />
            {transaction.retry_count} tentative{transaction.retry_count > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations de transaction</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Référence</dt>
                <dd className="mt-1 flex items-center">
                  <span className="text-sm text-gray-900">{transaction.transaction_reference}</span>
                  <button
                    onClick={() => handleCopyToClipboard(transaction.transaction_reference, 'reference')}
                    className="ml-2 text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  {copiedField === 'reference' && (
                    <span className="ml-2 text-xs text-green-600">Copié!</span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">ID Transaction</dt>
                <dd className="mt-1 flex items-center">
                  <span className="text-sm text-gray-900 font-mono">{transaction.id}</span>
                  <button
                    onClick={() => handleCopyToClipboard(transaction.id, 'id')}
                    className="ml-2 text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">Montant</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900">
                  {transaction.amount?.toLocaleString('fr-FR')} {transaction.currency}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">Numéro de téléphone</dt>
                <dd className="mt-1 text-sm text-gray-900">{transaction.phone_number}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">Fournisseur</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {transaction.mobile_money_providers?.provider_name}
                  <span className="ml-2 text-xs text-gray-500">
                    ({transaction.mobile_money_providers?.provider_code})
                  </span>
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">ID Externe</dt>
                <dd className="mt-1 text-sm text-gray-900 font-mono">
                  {transaction.external_transaction_id || 'N/A'}
                </dd>
              </div>

              {transaction.completed_at && (
                <div className="col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Terminée le</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(transaction.completed_at).toLocaleString('fr-FR')}
                  </dd>
                </div>
              )}

              {transaction.expires_at && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Expire le</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(transaction.expires_at).toLocaleString('fr-FR')}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Student Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations élève</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Nom complet</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {transaction.students?.first_name} {transaction.students?.last_name}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">ID Élève</dt>
                <dd className="mt-1 text-sm text-gray-900">{transaction.students?.student_id}</dd>
              </div>

              {transaction.fee_schedules && (
                <>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Type de frais</dt>
                    <dd className="mt-1 text-sm text-gray-900">{transaction.fee_schedules.fee_type}</dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">Échéance</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(transaction.fee_schedules.due_date).toLocaleDateString('fr-FR')}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {/* Payment Information (if reconciled) */}
          {transaction.payments && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Paiement associé</h2>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Numéro de reçu</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {transaction.payments.receipt_number}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Date de paiement</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(transaction.payments.payment_date).toLocaleDateString('fr-FR')}
                  </dd>
                </div>
              </dl>

              <button
                onClick={() => router.push(`/accountant/payments/${transaction.payments.id}`)}
                className="mt-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
              >
                Voir les détails du paiement
                <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          )}

          {/* Error Information (if failed) */}
          {transaction.status === 'failed' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-red-900 mb-4">Détails de l'erreur</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-red-700">Code d'erreur</dt>
                  <dd className="mt-1 text-sm text-red-900 font-mono">
                    {transaction.error_code || 'N/A'}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-red-700">Message</dt>
                  <dd className="mt-1 text-sm text-red-900">
                    {transaction.error_message || 'Aucun message d\'erreur'}
                  </dd>
                </div>

                {transaction.retry_count > 0 && (
                  <div>
                    <dt className="text-sm font-medium text-red-700">Tentatives de retry</dt>
                    <dd className="mt-1 text-sm text-red-900">
                      {transaction.retry_count} / {transaction.max_retries}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Metadata */}
          {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Métadonnées</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-xs text-gray-800 overflow-x-auto">
                  {JSON.stringify(transaction.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">Initiée</p>
                  <p className="text-xs text-gray-500">
                    {new Date(transaction.initiated_at).toLocaleString('fr-FR')}
                  </p>
                </div>
              </div>

              {(transaction.status === 'pending' || transaction.status === 'initiated') && (
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-yellow-600 rounded-full mt-2 animate-pulse"></div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">En attente</p>
                    <p className="text-xs text-gray-500">En cours de traitement</p>
                  </div>
                </div>
              )}

              {transaction.status === 'success' && transaction.completed_at && (
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-green-600 rounded-full mt-2"></div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Réussie</p>
                    <p className="text-xs text-gray-500">
                      {new Date(transaction.completed_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
              )}

              {transaction.status === 'failed' && (
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-red-600 rounded-full mt-2"></div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Échouée</p>
                    <p className="text-xs text-gray-500">
                      {transaction.completed_at
                        ? new Date(transaction.completed_at).toLocaleString('fr-FR')
                        : 'En attente de confirmation'}
                    </p>
                  </div>
                </div>
              )}

              {transaction.reconciliation_status === 'reconciled' && (
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-purple-600 rounded-full mt-2"></div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Réconciliée</p>
                    <p className="text-xs text-gray-500">Liaison avec paiement créée</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Audit Trail */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Audit Trail
            </h2>
            <button
              onClick={() => router.push(`/super-admin/audit?resource_id=${transaction.id}`)}
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              <FileText className="h-4 w-4 mr-2" />
              Voir les logs d'audit
            </button>
          </div>

          {/* Quick Actions */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h2>
            <div className="space-y-2">
              <button
                onClick={() => router.push(`/accountant/students/${transaction.student_id}`)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center justify-between"
              >
                Voir le profil élève
                <ChevronRight className="h-4 w-4" />
              </button>

              {transaction.status === 'failed' && transaction.retry_count < transaction.max_retries && (
                <button
                  onClick={() => router.push(`/accountant/mobile-money/retry/${transaction.id}`)}
                  className="w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 rounded-lg flex items-center justify-between"
                >
                  Réessayer la transaction
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reconciliation Dialog */}
      {showReconcileDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Réconcilier la transaction
              </h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Transaction: {transaction.transaction_reference}
                </p>
                <p className="text-sm text-gray-600">
                  Montant: {transaction.amount?.toLocaleString('fr-FR')} {transaction.currency}
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID du paiement
                </label>
                <input
                  type="text"
                  value={reconciliationPaymentId}
                  onChange={(e) => setReconciliationPaymentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Entrez l'ID du paiement"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowReconcileDialog(false);
                    setReconciliationPaymentId('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Annuler
                </button>
                <button
                  onClick={handleReconcile}
                  disabled={reconcileMutation.isPending || !reconciliationPaymentId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {reconcileMutation.isPending ? 'Réconciliation...' : 'Réconcilier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
