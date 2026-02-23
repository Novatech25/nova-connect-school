'use client';
import { useState } from 'react';
import { useGlobalMobileMoneyKpis } from '@novaconnect/data';
import { StatCard } from '@/components/super-admin/StatCard';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { PieChart } from '@/components/charts/PieChart';
import { Building2, Smartphone, CreditCard, TrendingUp, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format, subDays } from 'date-fns';

/**
 * Super Admin Mobile Money Monitoring Dashboard
 *
 * Displays global Mobile Money statistics across all schools
 */
export default function SuperAdminMobileMoneyPage() {
  const [dateRange, setDateRange] = useState('30'); // days

  const dateFrom = format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd');
  const dateTo = format(new Date(), 'yyyy-MM-dd');

  const { data: kpis, isLoading } = useGlobalMobileMoneyKpis(dateFrom, dateTo);

  // Prepare chart data
  const providerData = kpis?.provider_breakdown?.map((p: any) => ({
    name: p.provider_name,
    value: p.total_transactions,
    amount: p.total_amount,
    color:
      p.provider_code === 'orange'
        ? '#f97316'
        : p.provider_code === 'moov'
        ? '#eab308'
        : p.provider_code === 'mtn'
        ? '#fbbf24'
        : '#3b82f6'
  })) || [];

  const schoolsData = kpis?.top_schools?.map((s: any, index: number) => ({
    name: `${s.school_name} (${index + 1})`,
    value: s.total_amount,
    transactions: s.total_transactions
  })) || [];

  const dailyTrendData = kpis?.daily_trend?.map((d: any) => ({
    date: format(new Date(d.date), 'MMM dd'),
    amount: d.amount,
    count: d.count,
    successRate: d.success_rate
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Surveillance Mobile Money
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Vue d'ensemble des transactions Mobile Money à travers toutes les écoles
          </p>
        </div>

        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="7">Derniers 7 jours</option>
          <option value="30">Derniers 30 jours</option>
          <option value="90">Derniers 90 jours</option>
        </select>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Transactions"
            value={kpis?.total_transactions || 0}
            icon={Smartphone}
            description={`${kpis?.total_schools || 0} écoles`}
            trend={{ value: 12, isPositive: true }}
          />

          <StatCard
            title="Montant Total"
            value={`${Math.round(kpis?.total_amount || 0).toLocaleString('fr-FR')} FCFA`}
            icon={CreditCard}
            description="Volume traité"
            trend={{ value: 8, isPositive: true }}
          />

          <StatCard
            title="Taux de Succès"
            value={`${kpis?.success_rate?.toFixed(0) || 0}%`}
            icon={CheckCircle}
            description="Transactions réussies"
            trend={{ value: 2, isPositive: true }}
          />

          <StatCard
            title="Écoles Actives"
            value={kpis?.total_schools || 0}
            icon={Building2}
            description="Ayant des transactions"
            trend={{ value: 5, isPositive: true }}
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Répartition par Fournisseur</h3>
          <div className="space-y-4">
            {kpis?.provider_breakdown?.map((provider: any) => (
              <div key={provider.provider_code} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {provider.provider_name}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {provider.total_transactions} transactions
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${kpis.total_transactions > 0 ? (provider.total_transactions / kpis.total_transactions) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {Math.round(provider.total_amount).toLocaleString('fr-FR')} FCFA
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {provider.success_rate.toFixed(0)}% succès
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Schools */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Top Écoles par Volume</h3>
          <div className="space-y-3">
            {kpis?.top_schools?.slice(0, 5).map((school: any, index: number) => (
              <div key={school.school_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 ? 'bg-yellow-100 text-yellow-800' :
                    index === 1 ? 'bg-gray-100 text-gray-800' :
                    index === 2 ? 'bg-orange-100 text-orange-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {school.school_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {school.total_transactions} transactions
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {Math.round(school.total_amount).toLocaleString('fr-FR')} FCFA
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Tendance Quotidienne</h3>
          <LineChart
            data={dailyTrendData}
            xAxisKey="date"
            lines={[
              { dataKey: 'amount', name: 'Montant (FCFA)', color: '#3b82f6' },
              { dataKey: 'count', name: 'Transactions', color: '#10b981' }
            ]}
            height={250}
          />
        </div>

        {/* Provider Success Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Taux de Succès par Fournisseur</h3>
          <BarChart
            data={providerData}
            xAxisKey="name"
            bars={[
              { dataKey: 'value', name: 'Transactions', color: '#3b82f6' }
            ]}
            height={250}
          />
        </div>

        {/* Transaction Success Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Taux de Succès Global</h3>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-6xl font-bold text-gray-900 dark:text-white mb-2">
                {kpis?.success_rate?.toFixed(0)}%
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                des transactions réussies
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Statistics Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Statistiques Détaillées par Fournisseur
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fournisseur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transactions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Taux de Succès
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant Moyen
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {kpis?.provider_breakdown?.map((provider: any) => (
                <tr key={provider.provider_code}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {provider.provider_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {provider.total_transactions}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-semibold">
                    {Math.round(provider.total_amount).toLocaleString('fr-FR')} FCFA
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      provider.success_rate >= 80
                        ? 'bg-green-100 text-green-800'
                        : provider.success_rate >= 50
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {provider.success_rate.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {provider.total_transactions > 0
                      ? Math.round(provider.total_amount / provider.total_transactions).toLocaleString('fr-FR')
                      : 0} FCFA
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts and Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-1" />
            <div>
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Performance Globale
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {kpis && kpis.success_rate >= 80
                  ? 'Le système Mobile Money fonctionne bien avec un taux de succès élevé.'
                  : 'Le taux de succès pourrait être amélioré. Vérifiez les configurations des providers.'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400 mt-1" />
            <div>
              <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
                Croissance
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300">
                {kpis?.total_schools || 0} écoles utilisent activement Mobile Money. Continuez à promouvoir cette fonctionnalité.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
