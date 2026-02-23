'use client';

import { useAuthContext } from '@novaconnect/data';
import { useGlobalStats, useAlerts, useRecentActivity } from '@novaconnect/data';
import { StatCard } from '@/components/super-admin/StatCard';
import { ActivityTimeline } from '@/components/super-admin/ActivityTimeline';
import { AlertsCard } from '@/components/super-admin/AlertCard';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { PieChart } from '@/components/charts/PieChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { Building2, Users, Key, MessageSquare, TrendingUp, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays } from 'date-fns';

/**
 * Dashboard Super Admin
 *
 * Ce dashboard :
 * - Affiche des statistiques globales en temps réel
 * - Affiche des graphiques d'évolution
 * - Affiche les alertes actives
 * - Affiche l'activité récente
 * - Permet un accès rapide aux sections principales
 */
export default function SuperAdminDashboard() {
  const { user, profile } = useAuthContext();
  const { stats, isLoading: statsLoading } = useGlobalStats();
  const { alerts, isLoading: alertsLoading } = useAlerts();
  const { activity, isLoading: activityLoading } = useRecentActivity();

  const userName = user?.user_metadata
    ? `${user.user_metadata.firstName || ''} ${user.user_metadata.lastName || ''}`.trim()
    : user?.email || 'Utilisateur';

  // Prepare chart data
  const schoolsByPlan = stats?.schools?.byPlan
    ? Object.entries(stats.schools.byPlan).map(([name, value]) => ({
        name,
        value,
        color:
          name === 'free'
            ? '#3b82f6'
            : name === 'basic'
            ? '#10b981'
            : name === 'premium'
            ? '#f59e0b'
            : '#ef4444',
      }))
    : [];

  const licensesByType = stats?.licenses?.byType
    ? Object.entries(stats.licenses.byType).map(([name, value]) => ({
        name,
        value,
        color:
          name === 'trial'
            ? '#3b82f6'
            : name === 'basic'
            ? '#8b5cf6'
            : name === 'premium'
            ? '#f59e0b'
            : '#10b981',
      }))
    : [];

  const ticketsByPriority = stats?.tickets?.byPriority
    ? Object.entries(stats.tickets.byPriority).map(([name, value]) => ({
        name,
        value,
        color:
          name === 'low'
            ? '#6b7280'
            : name === 'medium'
            ? '#3b82f6'
            : name === 'high'
            ? '#f59e0b'
            : '#ef4444',
      }))
    : [];

  const ticketsByStatus = [
    { name: 'Open', value: stats?.tickets?.open || 0, color: '#3b82f6' },
    { name: 'In Progress', value: stats?.tickets?.inProgress || 0, color: '#f59e0b' },
    { name: 'Resolved', value: stats?.tickets?.resolved || 0, color: '#10b981' },
    { name: 'Closed', value: stats?.tickets?.closed || 0, color: '#6b7280' },
  ];

  // Prepare activity items
  const activityItems = activity
    ? [
        ...activity.recentSchools?.map((school: any) => ({
          id: school.id,
          type: 'school' as const,
          title: `New school created: ${school.name}`,
          description: `Code: ${school.code}`,
          timestamp: school.created_at,
        })) || [],
        ...activity.recentUsers?.map((user: any) => ({
          id: user.id,
          type: 'user' as const,
          title: `New user registered: ${user.first_name} ${user.last_name}`,
          description: `Role: ${user.role}`,
          timestamp: user.created_at,
        })) || [],
        ...activity.recentLicenses?.map((license: any) => ({
          id: license.id,
          type: 'license' as const,
          title: `License generated for ${license.school?.name || 'Unknown'}`,
          description: `Type: ${license.license_type} - Key: ${license.license_key}`,
          timestamp: license.created_at,
        })) || [],
        ...activity.recentTickets?.map((ticket: any) => ({
          id: ticket.id,
          type: 'ticket' as const,
          title: `Support ticket created: ${ticket.title}`,
          description: `Priority: ${ticket.priority}`,
          timestamp: ticket.created_at,
        })) || [],
      ]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10)
    : [];

  // Prepare alerts
  const alertList = alerts
    ? [
        ...(alerts.expiringSubscriptions?.map((school: any) => ({
          id: school.id,
          type: 'expiring_subscription' as const,
          title: `Subscription expiring soon: ${school.name}`,
          description: `Expires on ${format(new Date(school.subscription_expires_at), 'MMM d, yyyy')}`,
          severity: 'warning' as const,
          actionLabel: 'View School',
          action: () => (window.location.href = `/super-admin/schools/${school.id}`),
        })) || []),
        ...(alerts.urgentUnassignedTickets?.map((ticket: any) => ({
          id: ticket.id,
          type: 'urgent_ticket' as const,
          title: `Urgent ticket unassigned: ${ticket.title}`,
          description: `From: ${ticket.school?.name || 'Unknown'}`,
          severity: 'error' as const,
          actionLabel: 'View Ticket',
          action: () => (window.location.href = `/super-admin/support/${ticket.id}`),
        })) || []),
        ...(alerts.expiredLicenses?.map((license: any) => ({
          id: license.id,
          type: 'expired_license' as const,
          title: `License expired: ${license.license_key}`,
          description: `School: ${license.school?.name || 'Unknown'}`,
          severity: 'error' as const,
          actionLabel: 'View License',
          action: () => (window.location.href = `/super-admin/licenses/${license.id}`),
        })) || []),
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Tableau de bord Super Admin
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Bienvenue, {userName}
        </p>
      </div>

      {/* KPIs principaux */}
      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Schools"
            value={stats?.schools?.total || 0}
            icon={Building2}
            description={`${stats?.schools?.active || 0} active`}
            trend={{ value: 5, isPositive: true }}
          />
          <StatCard
            title="Total Users"
            value={stats?.users?.total || 0}
            icon={Users}
            description={`${stats?.users?.byRole?.school_admin || 0} admins`}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Active Licenses"
            value={stats?.licenses?.active || 0}
            icon={Key}
            description={`${stats?.licenses?.expiringSoon || 0} expiring soon`}
            trend={{ value: 2, isPositive: false }}
          />
          <StatCard
            title="Open Tickets"
            value={stats?.tickets?.open || 0}
            icon={MessageSquare}
            description={`${stats?.tickets?.resolvedToday || 0} resolved today`}
            trend={{ value: 8, isPositive: true }}
          />
        </div>
      )}

      {/* Alertes */}
      {(alertList.length > 0 || alertsLoading) && (
        <AlertsCard alerts={alertList} isLoading={alertsLoading} />
      )}

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Schools by Subscription Plan</h3>
          <PieChart data={schoolsByPlan} height={250} />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Licenses by Type</h3>
          <DonutChart data={licensesByType} height={250} />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Tickets by Priority</h3>
          <BarChart
            data={ticketsByPriority}
            xAxisKey="name"
            bars={[
              { dataKey: 'value', name: 'Tickets', color: '#3b82f6' },
            ]}
            height={250}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Tickets by Status</h3>
          <DonutChart data={ticketsByStatus} height={250} />
        </div>
      </div>

      {/* Activité récente */}
      <ActivityTimeline activities={activityItems} isLoading={activityLoading} />

      {/* Liens rapides */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Actions rapides</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/super-admin/schools"
            className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Gérer les écoles</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Ajouter, modifier, supprimer</p>
            </div>
          </a>

          <a
            href="/super-admin/licenses"
            className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <Key className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Gérer les licences</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Générer, révoquer</p>
            </div>
          </a>

          <a
            href="/super-admin/support"
            className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="h-10 w-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Support tickets</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Répondre, résoudre</p>
            </div>
          </a>

          <a
            href="/super-admin/audit"
            className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Audit logs</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Tracer les actions</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
