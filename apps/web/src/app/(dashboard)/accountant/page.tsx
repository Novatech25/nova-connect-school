'use client';

import { useAuthContext, useAccountantDashboardStats, useSchool } from '@novaconnect/data';
import { formatCurrency } from '@/lib/utils';

/**
 * Dashboard Comptable
 *
 * Ce dashboard :
 * - Affiche les statistiques financières (encaissements, arriérés)
 * - Affiche des liens vers paiements et salaires
 * - Utilise les données réelles de Supabase
 */
export default function AccountantDashboard() {
  const { user, profile } = useAuthContext();
  const schoolId = profile?.school?.id;

  const { data: stats, isLoading, error } = useAccountantDashboardStats(schoolId || '');
  const { school } = useSchool(schoolId || '');

  const userName = 
    // Prefer the profile full name from the database
    (profile?.first_name && profile?.last_name)
      ? `${profile.first_name} ${profile.last_name}`.trim()
    : (profile?.first_name || profile?.last_name)
      ? (profile.first_name || profile.last_name).trim()
    // Fallback to user metadata
    : (user?.user_metadata?.firstName || user?.user_metadata?.first_name)
      ? `${user?.user_metadata?.firstName || user?.user_metadata?.first_name || ''} ${user?.user_metadata?.lastName || user?.user_metadata?.last_name || ''}`.trim()
    : user?.email?.split('@')[0] || 'Utilisateur';

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const schoolName = school?.name || profile?.school?.name || '';

  // Helper pour afficher les valeurs avec loading state
  const renderValue = (value: number | undefined, isCurrency = false) => {
    if (isLoading) {
      return (
        <span className="animate-pulse inline-block">
          <span className="inline-block h-8 w-24 bg-gray-200 rounded"></span>
        </span>
      );
    }
    
    if (error) {
      console.error('Dashboard error:', error);
      return <span className="text-red-500 text-sm" title={error.message}>Erreur</span>;
    }

    if (value === undefined || value === null) {
      return <span className="text-gray-400">--</span>;
    }

    if (isCurrency) {
      return formatCurrency(value);
    }

    return value.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-600 uppercase tracking-widest">
              {getGreeting()}
            </p>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold text-slate-900">
              {userName} 👋
            </h1>
            <p className="mt-2 text-slate-500 text-sm">
              Voici le résumé financier de <span className="font-semibold text-slate-700">{schoolName}</span> pour aujourd&apos;hui.
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-xs text-slate-400">Rôle</span>
            <span className="text-sm font-semibold text-slate-700 mt-0.5">Comptable</span>
            <span className="mt-2 text-xs text-slate-400">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Statistiques financières */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Encaissements du mois */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Encaissements (mois)</p>
              <div className="mt-2 text-3xl font-bold text-gray-900">
                {renderValue(stats?.monthlyCollections, true)}
              </div>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Total des paiements reçus ce mois
          </p>
        </div>

        {/* Arriérés */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Arriérés</p>
              <div className="mt-2 text-3xl font-bold text-red-600">
                {renderValue(stats?.totalArrears, true)}
              </div>
            </div>
            <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Frais scolaires non payés en retard
          </p>
        </div>

        {/* Salaires à payer */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Salaires à payer</p>
              <div className="mt-2 text-3xl font-bold text-yellow-600">
                {renderValue(stats?.pendingSalaries, true)}
              </div>
            </div>
            <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Salaires du mois en attente de paiement
          </p>
        </div>

        {/* Total transactions */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Transactions (mois)</p>
              <div className="mt-2 text-3xl font-bold text-blue-600">
                {renderValue(stats?.monthlyTransactions)}
              </div>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Nombre de transactions ce mois
          </p>
        </div>
      </div>

      {/* Message d'erreur détaillé */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Erreur de chargement</h3>
          <p className="text-red-600 text-sm mt-1">{error.message}</p>
          <p className="text-red-500 text-xs mt-2">
            Vérifiez que les fonctions SQL sont bien déployées dans Supabase.
          </p>
        </div>
      )}

      {/* Liens rapides */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Actions rapides</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="/accountant/payments"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">Paiements</p>
              <p className="text-sm text-gray-500">Gérer les paiements des élèves</p>
            </div>
          </a>

          <a
            href="/accountant/salaries"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="h-10 w-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">Salaires</p>
              <p className="text-sm text-gray-500">Gérer les salaires du personnel</p>
            </div>
          </a>

          <a
            href="/accountant/payroll"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">Payroll</p>
              <p className="text-sm text-gray-500">Gérer les périodes de paie</p>
            </div>
          </a>

          <a
            href="/accountant/reports"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">Rapports</p>
              <p className="text-sm text-gray-500">Voir les rapports financiers</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
